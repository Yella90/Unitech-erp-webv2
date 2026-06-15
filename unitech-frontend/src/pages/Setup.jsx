import { useEffect, useState } from 'react';
import { createWorker } from 'tesseract.js';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

const initialClassForm = {
  nom: '',
  niveau: '',
  cycle: '',
  mensuel: '',
  frais_inscription: '',
  effectif_max: '50',
};

const initialStudentForm = {
  nom: '',
  prenom: '',
  sexe: '',
  dateNaissance: '',
  classe: '',
  telparent: '',
  nomparent: '',
};

const initialNoteMeta = {
  classe: '',
  matiere: '',
  trimestre: '1',
  note_type: 'devoir',
  annee: '',
};

function buildInitialNoteMeta(activeSchoolYear = '') {
  return {
    ...initialNoteMeta,
    annee: activeSchoolYear || '',
  };
}

const steps = [
  { key: 'classes', title: 'Etape 1/3', label: 'Classes' },
  { key: 'eleves', title: 'Etape 2/3', label: 'Eleves' },
  { key: 'notes', title: 'Etape 3/3', label: 'Notes' },
];

const setupTemplateDownloads = {
  classes: `${import.meta.env.BASE_URL}setup-models/CLASSE.csv`,
  eleves: `${import.meta.env.BASE_URL}setup-models/eleves.csv`,
  notes: `${import.meta.env.BASE_URL}setup-models/notes.csv`,
};

function detectDelimiter(line) {
  if (line.includes(';')) return ';';
  if (line.includes('\t')) return '\t';
  return ',';
}

function parseDelimitedText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((cell) => cell.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((cell) => cell.trim());
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] || '';
      return acc;
    }, {});
  });
}

function mapClassImportRows(rows) {
  return rows.map((row) => ({
    nom: row.Nom || row.nom || row.classe || '',
    niveau: (row.Niveau || row.niveau || '').toLowerCase(),
    cycle: (row.Cycle || row.cycle || '').toLowerCase(),
    mensuel:
      row.Mensuel ||
      row.mensuel ||
      row.Mensualite ||
      row.mensualite ||
      row.Frais_mensuel ||
      row.frais_mensuel ||
      row.Fras_mensuel ||
      row.fras_mensuel ||
      '0',
    frais_inscription: row.Frais_inscription || row.frais_inscription || row.fraisInscription || '0',
    effectif_max: row.Effectif_max || row.effectif_max || '50',
    annee: row.Annee || row.annee || '',
  }));
}

function mapStudentImportRows(rows) {
  return rows.map((row) => ({
    matricule: row.Matricule || row.matricule || '',
    nom: row.Nom || row.nom || '',
    prenom: row.Prenom || row.prenom || '',
    sexe: row.Sexe || row.sexe || '',
    dateNaissance: row.Date_naissance || row.date_naissance || row.dateNaissance || '',
    classe: row.Classe || row.classe || '',
    telparent: row.Telephone_parent || row.telephone_parent || row.telparent || '',
    nomparent: row.Nom_parent || row.nom_parent || row.nomparent || '',
  }));
}

function mapNoteImportRows(rows) {
  return rows.map((row) => ({
    matricule: row.Matricule || row.matricule || '',
    note: row.Note || row.note || '',
  }));
}

function normalizeMatricule(value) {
  return String(value || '').trim().toLowerCase();
}

function mergeImportedNotesIntoStudents(students, importedNotes) {
  const noteByMatricule = new Map(
    importedNotes
      .map((row) => [normalizeMatricule(row.matricule), row.note])
      .filter(([matricule]) => Boolean(matricule))
  );

  return students.map((student) => {
    const matricule = normalizeMatricule(student.matricule);
    if (!noteByMatricule.has(matricule)) return student;
    return {
      ...student,
      note: noteByMatricule.get(matricule),
    };
  });
}

function normalizeOcrText(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[’']/g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/\t+/g, ' ')
    .replace(/\u00a0/g, ' ');
}

function extractNotesFromOcrText(text) {
  const lines = normalizeOcrText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = [];
  for (const line of lines) {
    if (/^matricule\b/i.test(line) && /note\b/i.test(line)) {
      continue;
    }

    const matriculeMatch = line.match(/\b([A-Z]{0,5}[A-Z0-9-]*\d[A-Z0-9-]*)\b/i);
    const noteMatches = [...line.matchAll(/\b(20(?:[.,]0{1,2})?|1?\d(?:[.,]\d{1,2})?)\b/g)].map((match) => match[1]);
    const note = noteMatches.length ? noteMatches[noteMatches.length - 1].replace(',', '.') : '';
    const matricule = matriculeMatch ? matriculeMatch[1].replace(/\s+/g, '').toUpperCase() : '';

    if (!matricule || !note) continue;

    const numericNote = Number(note);
    if (!Number.isFinite(numericNote) || numericNote < 0 || numericNote > 20) continue;

    rows.push({ matricule, note: numericNote.toFixed(2).replace(/\.00$/, '') });
  }

  return rows;
}

async function readFileAsText(file) {
  if (!file) return '';
  return file.text();
}

function Setup() {
  const [activeStep, setActiveStep] = useState('classes');
  const [context, setContext] = useState({ classes: [], matieres: [], activeSchoolYear: '' });
  const [affectations, setAffectations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const showLoading = usePageLoadingVisibility(loading);

  const [classForm, setClassForm] = useState(initialClassForm);
  const [classImportText, setClassImportText] = useState('');
  const [studentForm, setStudentForm] = useState(initialStudentForm);
  const [studentImportText, setStudentImportText] = useState('');
  const [studentPreviewRows, setStudentPreviewRows] = useState([]);
  const [studentPreviewErrors, setStudentPreviewErrors] = useState([]);
  const [noteMeta, setNoteMeta] = useState(buildInitialNoteMeta());
  const [dynamicNoteRows, setDynamicNoteRows] = useState([]);
  const [noteImportText, setNoteImportText] = useState('');
  const [notePreviewRows, setNotePreviewRows] = useState([]);
  const [notePreviewErrors, setNotePreviewErrors] = useState([]);
  const [noteOcrFile, setNoteOcrFile] = useState(null);
  const [noteOcrProgress, setNoteOcrProgress] = useState({ running: false, value: 0, message: '' });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [contextResponse, affectationsResponse] = await Promise.all([
        api.get('/system/setup/context'),
        api.get('/affectation'),
      ]);
      const payload = contextResponse.data || {};
      setContext({
        classes: payload.classes || [],
        matieres: payload.matieres || [],
        activeSchoolYear: payload.activeSchoolYear || '',
      });
      setAffectations(affectationsResponse.data || []);
      setNoteMeta((prev) => ({
        ...prev,
        annee: prev.annee || payload.activeSchoolYear || '',
      }));
    } catch (err) {
      setError("Impossible de charger l'assistant de setup.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selectedSetupClasse = context.classes.find((classe) => String(classe.nom) === String(noteMeta.classe));
  const availableSetupMatieres = (() => {
    if (!noteMeta.classe) return context.matieres;
    const classeId = String(selectedSetupClasse?.id || '');
    const matiereNames = new Set(
      affectations
        .filter((item) => {
          const affectationClasseId = String(item.classe_id || '');
          const affectationClasseName = String(item.classe_nom || item.classe || '');
          return (classeId && affectationClasseId === classeId) || affectationClasseName === String(noteMeta.classe);
        })
        .map((item) => String(item.nom_matiere || '').trim())
        .filter(Boolean)
    );
    return context.matieres.filter((matiere) => matiereNames.has(String(matiere.nom || '').trim()));
  })();

  useEffect(() => {
    if (!noteMeta.matiere) return;
    const stillAvailable = availableSetupMatieres.some((matiere) => String(matiere.nom) === String(noteMeta.matiere));
    if (!stillAvailable) {
      setNoteMeta((prev) => ({ ...prev, matiere: '' }));
    }
  }, [noteMeta.matiere, availableSetupMatieres]);

  async function handleCreateClass(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/system/setup/classes', {
        ...classForm,
        annee: context.activeSchoolYear,
      });
      setClassForm(initialClassForm);
      await load();
      setSuccess('Classe ajoutee avec succes.');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'ajout de la classe.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImportClasses() {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const rows = mapClassImportRows(parseDelimitedText(classImportText)).filter((row) => row.nom);
      if (!rows.length) throw new Error('Aucune ligne classe detectee.');
      for (const row of rows) {
        await api.post('/system/setup/classes', {
          ...row,
          annee: row.annee || context.activeSchoolYear,
        });
      }
      setClassImportText('');
      await load();
      setSuccess(`${rows.length} classe(s) importee(s) avec succes.`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Erreur lors de l'import des classes.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStudentManualSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/system/setup/eleves/manual', studentForm);
      setStudentForm(initialStudentForm);
      await load();
      setSuccess('Eleve ajoute avec succes.');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'ajout de l'eleve.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreviewStudents() {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const rows = mapStudentImportRows(parseDelimitedText(studentImportText));
      const response = await api.post('/system/setup/eleves/preview', { rows });
      setStudentPreviewRows(response.data?.validRows || []);
      setStudentPreviewErrors(response.data?.errors || []);
      if ((response.data?.validRows || []).length) {
        setSuccess('Apercu des eleves genere. Verifiez puis confirmez.');
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'aperçu des eleves.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCommitStudents() {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.post('/system/setup/eleves/commit', { rows: studentPreviewRows });
      setStudentPreviewRows([]);
      setStudentPreviewErrors([]);
      setStudentImportText('');
      await load();
      setSuccess(`${response.data?.inserted || 0} eleve(s) importe(s) avec succes.`);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'import final des eleves.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoadStudentsForNotes() {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.get('/system/setup/notes/eleves', {
        params: {
          classe: noteMeta.classe,
          matiere: noteMeta.matiere,
          trimestre: noteMeta.trimestre,
          note_type: noteMeta.note_type,
          annee: noteMeta.annee,
        },
      });
      setDynamicNoteRows((response.data || []).map((row) => ({ ...row, note: row.note ?? '' })));
      setSuccess('Liste des eleves chargee pour la saisie des notes.');
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de charger les eleves de cette classe.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDynamicNotes() {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const rows = dynamicNoteRows
        .map((row) => ({ matricule: row.matricule, note: Number(row.note) }))
        .filter((row) => Number.isFinite(row.note));
      const response = await api.post('/system/setup/notes/save', { ...noteMeta, rows });
      setDynamicNoteRows([]);
      setNoteMeta(buildInitialNoteMeta(context.activeSchoolYear));
      setSuccess(`${response.data?.inserted || 0} note(s) enregistree(s).`);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'enregistrement des notes.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreviewNotesImport() {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const rows = mapNoteImportRows(parseDelimitedText(noteImportText));
      const validRows = rows.filter((row) => row.matricule && row.note !== '');
      const dropped = rows.length - validRows.length;
      setNotePreviewRows(validRows);
      setNotePreviewErrors(dropped ? [`${dropped} ligne(s) ignoree(s) car invalides.`] : []);
      setSuccess('Apercu des notes genere. Verifiez puis confirmez.');
    } catch (err) {
      setError(err.message || "Erreur lors de l'aperçu des notes.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOcrNotesImport() {
    if (!noteOcrFile) {
      setError('Choisissez d abord une image scannee de la page notes.');
      return;
    }

    if (!noteOcrFile.type.startsWith('image/')) {
      setError("Pour l instant, l OCR accepte surtout les images JPG/PNG. Si vous avez un PDF, exportez d abord la page en image.");
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    setNoteOcrProgress({ running: true, value: 0, message: 'Initialisation OCR...' });

    let worker = null;
    try {
      worker = await createWorker('eng+fra', 1, {
        logger: (message) => {
          if (message?.status) {
            setNoteOcrProgress({
              running: true,
              value: Math.round((message.progress || 0) * 100),
              message: message.status,
            });
          }
        },
      });

      const result = await worker.recognize(noteOcrFile);
      await worker.terminate();

      const extractedText = String(result?.data?.text || '').trim();
      if (!extractedText) {
        setNotePreviewRows([]);
        setNotePreviewErrors(['Aucun texte exploitable detecte par l OCR.']);
        setNoteImportText('');
        setSuccess('');
        return;
      }

      const rows = extractNotesFromOcrText(extractedText);
      const validRows = rows.filter((row) => row.matricule && row.note !== '');
      const dropped = rows.length - validRows.length;

      setNoteImportText(extractedText);
      setNotePreviewRows(validRows);
      setNotePreviewErrors([
        ...(dropped ? [`${dropped} ligne(s) ignoree(s) car non reconnues correctement.`] : []),
      ]);
      setSuccess(validRows.length ? 'OCR termine. Verifiez puis appliquez les notes au tableau.' : 'OCR termine mais aucune paire matricule/note exploitable n a ete trouvee.');
    } catch (err) {
      console.error('Erreur OCR notes:', err);
      setError(err?.message || "Erreur lors de l'analyse OCR des notes.");
    } finally {
      if (worker) {
        await worker.terminate();
      }
      setNoteOcrProgress({ running: false, value: 0, message: '' });
      setSubmitting(false);
    }
  }

  function handleApplyNotesImportToLoadedStudents() {
    if (!notePreviewRows.length || !dynamicNoteRows.length) {
      setError('Chargez les eleves de la classe avant d appliquer le CSV.');
      return;
    }

    const studentMatricules = new Set(dynamicNoteRows.map((row) => normalizeMatricule(row.matricule)).filter(Boolean));
    const matchedCount = notePreviewRows.filter((row) => studentMatricules.has(normalizeMatricule(row.matricule))).length;
    const updatedRows = mergeImportedNotesIntoStudents(dynamicNoteRows, notePreviewRows);

    setDynamicNoteRows(updatedRows);
    setSuccess(`${matchedCount} note(s) appliquee(s) au tableau de la classe.`);
  }

  async function handleCommitNotesImport() {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const classeLabel = noteMeta.classe;
      const rows = notePreviewRows.map((row) => ({ matricule: row.matricule, note: Number(row.note) }));
      const response = await api.post('/system/setup/notes/save', { ...noteMeta, rows });
      const insertedCount = response.data?.inserted || 0;
      setNotePreviewRows([]);
      setNotePreviewErrors([]);
      setNoteImportText('');
      setNoteOcrFile(null);
      setNoteMeta(buildInitialNoteMeta(context.activeSchoolYear));
      setSuccess(`${insertedCount} note(s) attribuee(s) aux eleves de la classe ${classeLabel || 'selectionnee'}.`);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'import final des notes.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleTextFileImport(setter) {
    return async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await readFileAsText(file);
      setter(text);
      event.target.value = '';
    };
  }

  if (showLoading) {
    return <PageLoadingState title="Chargement du setup" message="L'assistant de configuration est en cours de preparation." />;
  }

  if (error && !context.classes.length && !context.matieres.length && !context.activeSchoolYear) {
    return (
      <PageErrorState
        title="Setup indisponible"
        message={error}
        action={
          <button type="button" onClick={load} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Reessayer
          </button>
        }
      />
    );
  }

  return (
    <section className="space-y-5">
      <PageBanner tone="success" title={success ? 'Operation reussie' : ''} message={success} />
      <PageBanner tone="error" title={error ? 'Action impossible' : ''} message={error} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Assistant setup de l'ancien systeme</h2>
            <p className="mt-1 text-sm text-slate-500">
              Configuration rapide en 3 etapes: classes, eleves et notes. Annee active: <strong>{context.activeSchoolYear || 'Non definie'}</strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {steps.map((step) => (
              <button
                key={step.key}
                type="button"
                onClick={() => setActiveStep(step.key)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeStep === step.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {step.title}: {step.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeStep === 'classes' ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">Creation manuelle</h3>
              <form onSubmit={handleCreateClass} className="mt-4 grid gap-3 md:grid-cols-2">
                <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Nom classe" value={classForm.nom} onChange={(e) => setClassForm((prev) => ({ ...prev, nom: e.target.value }))} />
                <select className="rounded-md border border-slate-300 px-3 py-2" value={classForm.niveau} onChange={(e) => setClassForm((prev) => ({ ...prev, niveau: e.target.value }))}>
                  <option value="">Selectionner niveau</option>
                  {['jardin', '1ere', '2eme', '3eme', '4eme', '5eme', '6eme', '7eme', '8eme', '9eme', '10eme', '11eme', 'terminale'].map((niveau) => (
                    <option key={niveau} value={niveau}>{niveau}</option>
                  ))}
                </select>
                <input className="rounded-md border border-slate-300 px-3 py-2" type="number" min="0" placeholder="Mensuel" value={classForm.mensuel} onChange={(e) => setClassForm((prev) => ({ ...prev, mensuel: e.target.value }))} />
                <input className="rounded-md border border-slate-300 px-3 py-2" type="number" min="0" placeholder="Frais inscription" value={classForm.frais_inscription} onChange={(e) => setClassForm((prev) => ({ ...prev, frais_inscription: e.target.value }))} />
                <input className="rounded-md border border-slate-300 px-3 py-2" type="number" min="1" placeholder="Effectif max" value={classForm.effectif_max} onChange={(e) => setClassForm((prev) => ({ ...prev, effectif_max: e.target.value }))} />
                <button className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 md:col-span-2" disabled={submitting}>
                  {submitting ? 'Enregistrement...' : 'Ajouter classe'}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">Import CSV / collage</h3>
              <p className="mt-1 text-xs text-slate-500">Colonnes: Nom, Niveau, Cycle, Mensuel, Frais_inscription, Effectif_max</p>
              <a
                href={setupTemplateDownloads.classes}
                download="modele-classes.csv"
                className="mt-3 inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
              >
                Telecharger le modele CSV classes
              </a>
              <input type="file" accept=".csv,.txt" onChange={handleTextFileImport(setClassImportText)} className="mt-4 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <textarea
                className="mt-3 h-48 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder={'Nom;Niveau;Mensuel;Frais_inscription;Effectif_max\n7eme A;7eme;15000;10000;60'}
                value={classImportText}
                onChange={(e) => setClassImportText(e.target.value)}
              />
              <button type="button" onClick={handleImportClasses} className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700" disabled={submitting}>
                {submitting ? 'Import en cours...' : 'Importer classes'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">Classes existantes</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Nom</th>
                    <th className="px-3 py-2 text-left">Niveau</th>
                    <th className="px-3 py-2 text-left">Annee</th>
                  </tr>
                </thead>
                <tbody>
                  {context.classes.map((classe) => (
                    <tr key={classe.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">{classe.nom}</td>
                      <td className="px-3 py-2">{classe.niveau || '-'}</td>
                      <td className="px-3 py-2">{classe.annee || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {activeStep === 'eleves' ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">Ajout manuel rapide</h3>
              <form onSubmit={handleStudentManualSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
                <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Nom" value={studentForm.nom} onChange={(e) => setStudentForm((prev) => ({ ...prev, nom: e.target.value }))} />
                <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Prenom" value={studentForm.prenom} onChange={(e) => setStudentForm((prev) => ({ ...prev, prenom: e.target.value }))} />
                <select className="rounded-md border border-slate-300 px-3 py-2" value={studentForm.sexe} onChange={(e) => setStudentForm((prev) => ({ ...prev, sexe: e.target.value }))}>
                  <option value="">Sexe</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
                <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={studentForm.dateNaissance} onChange={(e) => setStudentForm((prev) => ({ ...prev, dateNaissance: e.target.value }))} />
                <select className="rounded-md border border-slate-300 px-3 py-2" value={studentForm.classe} onChange={(e) => setStudentForm((prev) => ({ ...prev, classe: e.target.value }))}>
                  <option value="">Selectionner une classe</option>
                  {context.classes.map((classe) => (
                    <option key={classe.id} value={classe.nom}>{classe.nom}</option>
                  ))}
                </select>
                <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Telephone parent" value={studentForm.telparent} onChange={(e) => setStudentForm((prev) => ({ ...prev, telparent: e.target.value }))} />
                <input className="rounded-md border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Nom parent" value={studentForm.nomparent} onChange={(e) => setStudentForm((prev) => ({ ...prev, nomparent: e.target.value }))} />
                <button className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 md:col-span-2" disabled={submitting}>
                  {submitting ? 'Enregistrement...' : 'Ajouter eleve'}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">Import CSV / collage avec apercu</h3>
              <p className="mt-1 text-xs text-slate-500">Colonnes: Nom, Prenom, Sexe, Date_naissance, Classe, Matricule, Telephone_parent, Nom_parent</p>
              <a
                href={setupTemplateDownloads.eleves}
                download="modele-eleves.csv"
                className="mt-3 inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
              >
                Telecharger le modele CSV eleves
              </a>
              <input type="file" accept=".csv,.txt" onChange={handleTextFileImport(setStudentImportText)} className="mt-4 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <textarea
                className="mt-3 h-48 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder={'Nom;Prenom;Sexe;Date_naissance;Classe\nDiallo;Aminata;F;2012-01-20;7eme A'}
                value={studentImportText}
                onChange={(e) => setStudentImportText(e.target.value)}
              />
              <button type="button" onClick={handlePreviewStudents} className="mt-3 rounded-md bg-slate-800 px-4 py-2 text-white hover:bg-slate-900" disabled={submitting}>
                {submitting ? 'Apercu...' : 'Generer apercu'}
              </button>
            </div>
          </div>

          {studentPreviewErrors.length ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <h3 className="font-semibold text-rose-700">Erreurs de validation</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-rose-700">
                {studentPreviewErrors.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}

          {studentPreviewRows.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">Apercu avant insertion</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Matricule</th>
                      <th className="px-3 py-2 text-left">Nom</th>
                      <th className="px-3 py-2 text-left">Prenom</th>
                      <th className="px-3 py-2 text-left">Sexe</th>
                      <th className="px-3 py-2 text-left">Classe</th>
                      <th className="px-3 py-2 text-left">Naissance</th>
                      <th className="px-3 py-2 text-left">Tel parent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentPreviewRows.map((row, index) => (
                      <tr key={`${row.nom}-${row.prenom}-${index}`} className="border-b border-slate-100">
                        <td className="px-3 py-2"><input className="w-full rounded-md border border-slate-300 px-2 py-1" value={row.matricule || ''} onChange={(e) => setStudentPreviewRows((prev) => prev.map((item, idx) => idx === index ? { ...item, matricule: e.target.value } : item))} /></td>
                        <td className="px-3 py-2"><input className="w-full rounded-md border border-slate-300 px-2 py-1" value={row.nom} onChange={(e) => setStudentPreviewRows((prev) => prev.map((item, idx) => idx === index ? { ...item, nom: e.target.value } : item))} /></td>
                        <td className="px-3 py-2"><input className="w-full rounded-md border border-slate-300 px-2 py-1" value={row.prenom} onChange={(e) => setStudentPreviewRows((prev) => prev.map((item, idx) => idx === index ? { ...item, prenom: e.target.value } : item))} /></td>
                        <td className="px-3 py-2"><input className="w-full rounded-md border border-slate-300 px-2 py-1" value={row.sexe || ''} onChange={(e) => setStudentPreviewRows((prev) => prev.map((item, idx) => idx === index ? { ...item, sexe: e.target.value } : item))} /></td>
                        <td className="px-3 py-2"><input className="w-full rounded-md border border-slate-300 px-2 py-1" value={row.classe} onChange={(e) => setStudentPreviewRows((prev) => prev.map((item, idx) => idx === index ? { ...item, classe: e.target.value } : item))} /></td>
                        <td className="px-3 py-2"><input className="w-full rounded-md border border-slate-300 px-2 py-1" type="date" value={row.dateNaissance || ''} onChange={(e) => setStudentPreviewRows((prev) => prev.map((item, idx) => idx === index ? { ...item, dateNaissance: e.target.value } : item))} /></td>
                        <td className="px-3 py-2"><input className="w-full rounded-md border border-slate-300 px-2 py-1" value={row.telparent || ''} onChange={(e) => setStudentPreviewRows((prev) => prev.map((item, idx) => idx === index ? { ...item, telparent: e.target.value } : item))} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={handleCommitStudents} className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700" disabled={submitting}>
                {submitting ? 'Insertion...' : 'Confirmer insertion'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {activeStep === 'notes' ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">Saisie dynamique</h3>
            <p className="mt-1 text-xs text-slate-500">
              Saisissez la note dans la colonne Note ou chargez un CSV <strong>Matricule, Note</strong> pour attribuer automatiquement chaque note au bon eleve.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-5">
              <select className="rounded-md border border-slate-300 px-3 py-2" value={noteMeta.classe} onChange={(e) => setNoteMeta((prev) => ({ ...prev, classe: e.target.value }))}>
                <option value="">Classe</option>
                {context.classes.map((classe) => <option key={classe.id} value={classe.nom}>{classe.nom}</option>)}
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2" value={noteMeta.matiere} onChange={(e) => setNoteMeta((prev) => ({ ...prev, matiere: e.target.value }))}>
                <option value="">{noteMeta.classe ? 'Matieres affectees a la classe' : 'Matiere'}</option>
                {availableSetupMatieres.map((matiere) => <option key={matiere.id} value={matiere.nom}>{matiere.nom}</option>)}
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2" value={noteMeta.trimestre} onChange={(e) => setNoteMeta((prev) => ({ ...prev, trimestre: e.target.value }))}>
                <option value="1">T1</option>
                <option value="2">T2</option>
                <option value="3">T3</option>
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2" value={noteMeta.note_type} onChange={(e) => setNoteMeta((prev) => ({ ...prev, note_type: e.target.value }))}>
                <option value="devoir">Devoir</option>
                <option value="composition">Composition</option>
              </select>
              <input className="rounded-md border border-slate-300 px-3 py-2" value={noteMeta.annee} onChange={(e) => setNoteMeta((prev) => ({ ...prev, annee: e.target.value }))} placeholder="Annee" />
            </div>
            {noteMeta.classe && availableSetupMatieres.length === 0 ? (
              <p className="mt-2 text-xs text-amber-600">Aucune matiere affectee a cette classe pour le moment.</p>
            ) : null}
            <button type="button" onClick={handleLoadStudentsForNotes} className="mt-3 rounded-md bg-slate-800 px-4 py-2 text-white hover:bg-slate-900" disabled={submitting}>
              {submitting ? 'Chargement...' : 'Charger eleves'}
            </button>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Matricule</th>
                    <th className="px-3 py-2 text-left">Nom</th>
                    <th className="px-3 py-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {dynamicNoteRows.length ? dynamicNoteRows.map((row, index) => (
                    <tr key={row.matricule} className="border-b border-slate-100">
                      <td className="px-3 py-2">{row.matricule}</td>
                      <td className="px-3 py-2">{row.nom} {row.prenom}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.01"
                          className="w-full rounded-md border border-slate-300 px-2 py-1"
                          value={row.note}
                          onChange={(e) => setDynamicNoteRows((prev) => prev.map((item, idx) => idx === index ? { ...item, note: e.target.value } : item))}
                        />
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="3" className="px-3 py-3 text-slate-500">Chargez une classe pour commencer.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={handleSaveDynamicNotes} className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700" disabled={submitting || !dynamicNoteRows.length}>
              {submitting ? 'Enregistrement...' : 'Enregistrer notes'}
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h3 className="font-semibold text-slate-900">Import CSV / collage</h3>
              <p className="mt-1 text-xs text-slate-500">
                Modele: <strong>Matricule, Note</strong>. La note est associee automatiquement a l eleve dont le matricule correspond.
              </p>
              <a
                href={setupTemplateDownloads.notes}
                download="modele-notes.csv"
                className="mt-3 inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
              >
                Telecharger le modele CSV notes
              </a>
              <input type="file" accept=".csv,.txt" onChange={handleTextFileImport(setNoteImportText)} className="mt-4 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <textarea
                className="mt-3 h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder={'Matricule;Note\nELV001;14.5'}
                value={noteImportText}
                onChange={(e) => setNoteImportText(e.target.value)}
              />
              <button type="button" onClick={handlePreviewNotesImport} className="mt-3 rounded-md bg-slate-800 px-4 py-2 text-white hover:bg-slate-900" disabled={submitting}>
                {submitting ? 'Apercu...' : 'Generer apercu des notes'}
              </button>
              <button
                type="button"
                onClick={handleApplyNotesImportToLoadedStudents}
                className="mt-3 ml-2 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={!notePreviewRows.length || !dynamicNoteRows.length || submitting}
              >
                Appliquer au tableau charge
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">OCR image de notes</h3>
              <p className="mt-1 text-xs text-slate-500">
              Importez une image scannee ou une capture de la page notes. L OCR cherche les couples <strong>matricule / note</strong> puis remplit le tableau pour verification.
              </p>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setNoteOcrFile(file);
                event.target.value = '';
              }}
              className="mt-4 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOcrNotesImport}
                className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={submitting || !noteOcrFile}
              >
                {submitting && noteOcrProgress.running ? 'Analyse OCR...' : 'Analyser image OCR'}
              </button>
              {noteOcrFile ? (
                <span className="rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-600">{noteOcrFile.name}</span>
              ) : null}
            </div>
            {noteOcrProgress.running ? (
              <p className="mt-3 text-xs text-slate-500">
                {noteOcrProgress.message} ({noteOcrProgress.value}%)
              </p>
            ) : null}
          </div>

          {notePreviewErrors.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="font-semibold text-amber-800">Avertissements import notes</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
                {notePreviewErrors.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}

          {notePreviewRows.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">Correction manuelle avant insertion</h3>
              <p className="mt-1 text-xs text-slate-500">
                Verifiez le matricule et la note avant de confirmer. Les valeurs seront enregistrees sur l eleve correspondant.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Matricule</th>
                      <th className="px-3 py-2 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notePreviewRows.map((row, index) => (
                      <tr key={`${row.matricule}-${index}`} className="border-b border-slate-100">
                        <td className="px-3 py-2">
                          <input className="w-full rounded-md border border-slate-300 px-2 py-1" value={row.matricule} onChange={(e) => setNotePreviewRows((prev) => prev.map((item, idx) => idx === index ? { ...item, matricule: e.target.value } : item))} />
                        </td>
                        <td className="px-3 py-2">
                          <input className="w-full rounded-md border border-slate-300 px-2 py-1" type="number" min="0" max="20" step="0.01" value={row.note} onChange={(e) => setNotePreviewRows((prev) => prev.map((item, idx) => idx === index ? { ...item, note: e.target.value } : item))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={handleCommitNotesImport} className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700" disabled={submitting}>
                {submitting ? 'Envoi...' : 'Envoyer les notes'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default Setup;
