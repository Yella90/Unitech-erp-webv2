import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

function formatDateInput(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function sanitizeFileName(value) {
  return String(value || 'export')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function Absences() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(formatDateInput());
  const [studentQuery, setStudentQuery] = useState('');
  const [sheet, setSheet] = useState({ students: [] });
  const showLoading = usePageLoadingVisibility(loading);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [classesResponse, sheetResponse] = await Promise.all([
        api.get('/classes'),
        selectedClassId
          ? api.get('/system/attendance/sheet', { params: { classe_id: selectedClassId, date: selectedDate } })
          : Promise.resolve({ data: null }),
      ]);

      const classRows = classesResponse.data || [];
      setClasses(classRows);

      const nextClassId = selectedClassId || classRows[0]?.id || '';
      if (!selectedClassId && nextClassId) {
        setSelectedClassId(String(nextClassId));
      }

      if (nextClassId && String(nextClassId) !== String(selectedClassId)) {
        const response = await api.get('/system/attendance/sheet', {
          params: { classe_id: nextClassId, date: selectedDate },
        });
        setSheet(response.data || { students: [] });
      } else if (sheetResponse?.data) {
        setSheet(sheetResponse.data || { students: [] });
      } else {
        setSheet({ students: [] });
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Impossible de charger la feuille de presence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    let cancelled = false;
    const loadSheet = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/system/attendance/sheet', {
          params: { classe_id: selectedClassId, date: selectedDate },
        });
        if (!cancelled) {
          setSheet(response.data || { students: [] });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || 'Impossible de charger la feuille de presence.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadSheet();
    return () => {
      cancelled = true;
    };
  }, [selectedClassId, selectedDate]);

  const summary = useMemo(() => {
    const students = sheet.students || [];
    const present = students.filter((row) => String(row.statut_presence || 'present') === 'present').length;
    const absent = students.filter((row) => String(row.statut_presence || '') === 'absence').length;
    const retard = students.filter((row) => String(row.statut_presence || '') === 'retard').length;
    const justifies = students.filter((row) => Number(row.justifie || 0) === 1).length;
    const nonJustifies = students.filter((row) => Number(row.justifie || 0) === 0 && String(row.statut_presence || '') !== 'present').length;
    return { present, absent, retard, justifies, nonJustifies, total: students.length };
  }, [sheet]);

  const filteredStudents = useMemo(() => {
    const query = String(studentQuery || '').trim().toLowerCase();
    const students = sheet.students || [];
    if (!query) return students;
    return students.filter((student) => {
      const fullName = `${student.nom || ''} ${student.prenom || ''}`.trim().toLowerCase();
      const matricule = String(student.matricule || '').trim().toLowerCase();
      return fullName.includes(query) || matricule.includes(query);
    });
  }, [sheet.students, studentQuery]);

  const updateStudent = (studentId, patch) => {
    setSheet((prev) => ({
      ...prev,
      students: (prev.students || []).map((student) =>
        Number(student.id) === Number(studentId)
          ? { ...student, ...patch }
          : student
      ),
    }));
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const students = filteredStudents;

    doc.setFillColor(30, 58, 138);
    doc.roundedRect(12, 10, pageWidth - 24, 26, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('Feuille de presence', 18, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generee le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 18, 22, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Classe: ${sheet.classe?.name || '-'}`, 18, 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Date: ${sheet.date || selectedDate}`, 18, 55);
    doc.text(`Annee scolaire: ${sheet.schoolYear || '-'}`, 18, 61);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(pageWidth - 82, 48, 70, 40, 3, 3, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Synthese jour', pageWidth - 77, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(`Presences: ${summary.present}`, pageWidth - 77, 61);
    doc.text(`Absences: ${summary.absent}`, pageWidth - 77, 67);
    doc.text(`Retards: ${summary.retard}`, pageWidth - 77, 73);
    doc.text(`Justifiees: ${summary.justifies}`, pageWidth - 77, 79);

    autoTable(doc, {
      startY: 94,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
      head: [['Eleve', 'Matricule', 'Statut', 'Justifie', 'Motif', 'Duree']],
      body: students.length
        ? students.map((student) => [
            `${student.nom || ''} ${student.prenom || ''}`.trim(),
            student.matricule || '-',
            student.statut_presence === 'retard' ? 'Retard' : student.statut_presence === 'absence' ? 'Absence' : 'Present',
            Number(student.justifie || 0) === 1 ? 'Oui' : 'Non',
            student.motif || '-',
            student.duree_minutes ? `${student.duree_minutes} min` : '-',
          ])
        : [['-', '-', '-', '-', '-', '-']],
    });

    doc.save(`feuille-presence-${sanitizeFileName(sheet.classe?.name || 'classe')}-${selectedDate}.pdf`);
  };

  const handleSave = async () => {
    if (!selectedClassId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/system/attendance/sheet', {
        classe_id: selectedClassId,
        date: selectedDate,
        entries: (sheet.students || []).map((student) => ({
          eleve_id: student.id,
          statut_presence: student.statut_presence || 'present',
          justifie: Number(student.justifie || 0),
          motif: student.motif || '',
          duree_minutes: student.duree_minutes || null,
        })),
      });
      setSuccess('Feuille de presence enregistree avec succes.');
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || "Erreur lors de l'enregistrement des absences.");
    } finally {
      setSaving(false);
    }
  };

  if (showLoading) {
    return <PageLoadingState title="Chargement des absences" message="La feuille de presence est en cours de preparation." />;
  }

  if (error && !classes.length) {
    return (
      <PageErrorState
        title="Module absences indisponible"
        message={error}
        action={<button type="button" onClick={load} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Reessayer</button>}
      />
    );
  }

  const className = classes.find((item) => String(item.id) === String(selectedClassId))?.name || '-';

  return (
    <section className="space-y-5">
      <PageBanner tone="success" title={success ? 'Operation reussie' : ''} message={success} />
      <PageBanner tone="error" title={error ? 'Action impossible' : ''} message={error} />

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Feuille de presence</h2>
            <p className="mt-1 text-sm text-slate-500">Saisissez les absences, retards et justifications par classe et par date.</p>
          </div>
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={handleSave}
            disabled={saving || !selectedClassId}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_160px]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Classe</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              <option value="">Selectionner une classe</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={load}
            >
              Recharger
            </button>
          </div>
        </div>

      </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Classe</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{className}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm text-emerald-700">Presences</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{summary.present}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-sm text-rose-700">Absences</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{summary.absent}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm text-amber-700">Retards</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{summary.retard}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
          <p className="text-sm text-indigo-700">Justifiees</p>
          <p className="mt-2 text-2xl font-bold text-indigo-700">{summary.justifies}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Non justifiees</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.nonJustifies}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Recherche eleve</label>
              <input
                type="text"
                value={studentQuery}
                onChange={(event) => setStudentQuery(event.target.value)}
                placeholder="Nom ou matricule"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </div>
            <div className="md:self-end">
              <button
                type="button"
                onClick={() => setStudentQuery('')}
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Effacer recherche
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Saisie des eleves</h3>
            <button
              type="button"
              onClick={handleExportPdf}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              disabled={!selectedClassId}
            >
              Exporter PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Eleve</th>
                <th className="px-4 py-3 text-left">Matricule</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Justifie</th>
                <th className="px-4 py-3 text-left">Motif</th>
                <th className="px-4 py-3 text-left">Duree (min)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{student.nom} {student.prenom}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{student.matricule || '-'}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2"
                      value={student.statut_presence || 'present'}
                      onChange={(event) => updateStudent(student.id, { statut_presence: event.target.value })}
                    >
                      <option value="present">Present</option>
                      <option value="absence">Absent</option>
                      <option value="retard">Retard</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={Number(student.justifie || 0) === 1}
                      onChange={(event) => updateStudent(student.id, { justifie: event.target.checked ? 1 : 0 })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                      value={student.motif || ''}
                      onChange={(event) => updateStudent(student.id, { motif: event.target.value })}
                      placeholder="Motif ou observation"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      className="w-32 rounded-md border border-slate-300 px-3 py-2"
                      value={student.duree_minutes || ''}
                      onChange={(event) => updateStudent(student.id, { duree_minutes: event.target.value })}
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
              {!selectedClassId ? (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-slate-400">
                    Selectionnez une classe pour charger la feuille de presence.
                  </td>
                </tr>
              ) : !(sheet.students || []).length ? (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-slate-400">
                    Aucun eleve actif dans cette classe.
                  </td>
                </tr>
              ) : !filteredStudents.length ? (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-slate-400">
                    Aucun eleve ne correspond a la recherche.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default Absences;
