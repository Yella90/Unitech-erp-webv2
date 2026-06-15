import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import { PageBanner, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

function formatDateInput(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatDateDisplay(value) {
  if (!value) return '-';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR');
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

function getTrimesterLabel(trimestre) {
  if (!trimestre) return '-';
  return `${trimestre.code || trimestre.label || 'Trimestre'}${trimestre.label && trimestre.code && trimestre.label !== trimestre.code ? ` - ${trimestre.label}` : ''}`;
}

function getAbsenceTypeLabel(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'retard') return 'Retard';
  if (normalized === 'conge') return 'Congé';
  if (normalized === 'mission') return 'Mission';
  return 'Absence';
}

function pickDefaultTrimestre(rows = []) {
  const today = new Date();
  const current = rows.find((row) => {
    const start = new Date(`${row.start_date}T12:00:00`);
    const end = new Date(`${row.end_date}T12:00:00`);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= today && end >= today;
  });
  return current || rows[rows.length - 1] || rows[0] || null;
}

function AbsencesEnseignants() {
  const navigate = useNavigate();
  const role = String(localStorage.getItem('role') || '').trim().toLowerCase();
  const canChooseTeacher = role !== 'enseignant';
  const isTeacher = role === 'enseignant';

  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [trimestres, setTrimestres] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedTrimestreId, setSelectedTrimestreId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [motifFilter, setMotifFilter] = useState('');
  const [justifieFilter, setJustifieFilter] = useState('all');
  const [report, setReport] = useState({ rows: [], summary: null, trimestre: null, scopeTeacher: null });
  const [accessBlockedMessage, setAccessBlockedMessage] = useState('');
  const [optionsWarning, setOptionsWarning] = useState('');
  const [form, setForm] = useState({
    teacher_id: '',
    date: formatDateInput(),
    heure_debut: '',
    heure_fin: '',
    type: 'absence',
    justifie: false,
    motif: '',
  });

  const showLoading = usePageLoadingVisibility(bootstrapping);

  const loadReport = async (params = {}) => {
    const trimestreId = params.trimestreId ?? selectedTrimestreId;
    if (!trimestreId) return;
    setLoading(true);
    setError('');
    setAccessBlockedMessage('');
    try {
      const response = await api.get('/system/teacher-absences', {
        params: {
          trimestre_id: trimestreId,
          teacher_id: canChooseTeacher ? ((params.teacherId ?? selectedTeacherId) || undefined) : undefined,
          motif: ((params.motif ?? motifFilter) || undefined),
          justifie: params.justifie ?? (justifieFilter === 'all' ? undefined : justifieFilter),
        },
      });
      setReport(response.data || { rows: [], summary: null, trimestre: null, scopeTeacher: null });
      if (response.data?.scopeTeacher?.id && isTeacher) {
        setForm((prev) => ({ ...prev, teacher_id: String(response.data.scopeTeacher.id) }));
      }
    } catch (err) {
      const apiCode = String(err?.response?.data?.code || '');
      const apiMessage = err?.response?.data?.subscriptionStatus?.message || err?.response?.data?.error || 'Impossible de charger les absences enseignants.';
      if (apiCode.startsWith('SUBSCRIPTION_')) {
        setAccessBlockedMessage(apiMessage);
      }
      setError(apiMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    setBootstrapping(true);
    setError('');
    setAccessBlockedMessage('');
    setOptionsWarning('');
    try {
      const trimesterResponse = await api.get('/system/trimestres');
      const trimesterRows = trimesterResponse?.data || [];
      setTrimestres(trimesterRows);

      const defaultTrimestre = selectedTrimestreId || (pickDefaultTrimestre(trimesterRows)?.id ? String(pickDefaultTrimestre(trimesterRows).id) : '');
      if (defaultTrimestre && String(defaultTrimestre) !== String(selectedTrimestreId)) {
        setSelectedTrimestreId(String(defaultTrimestre));
      }
      if (!isTeacher && !selectedTeacherId) {
        setSelectedTeacherId('');
      }
      if (canChooseTeacher) {
        api.get('/enseignants')
          .then((teachersResponse) => {
            setTeachers(teachersResponse?.data || []);
          })
          .catch((teachersErr) => {
            const teachersMessage = teachersErr?.response?.data?.error || "Impossible de charger la liste des enseignants.";
            setOptionsWarning(teachersMessage);
          });
      }

      if (defaultTrimestre) {
        await loadReport({
          trimestreId: defaultTrimestre,
          teacherId: selectedTeacherId,
          motif: motifFilter,
          justifie: justifieFilter === 'all' ? undefined : justifieFilter,
        });
      }
    } catch (err) {
      const apiCode = String(err?.response?.data?.code || '');
      const apiMessage = err?.response?.data?.subscriptionStatus?.message || err?.response?.data?.error || 'Impossible de charger les options.';
      if (apiCode.startsWith('SUBSCRIPTION_')) {
        setAccessBlockedMessage(apiMessage);
      }
      setError(apiMessage);
    } finally {
      setBootstrapping(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadOptions();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const rows = report.rows || [];
    const total = rows.length;
    const justifiees = rows.filter((row) => Number(row.justifie || 0) === 1).length;
    const nonJustifiees = total - justifiees;
    const missedSlots = rows.reduce((sum, row) => sum + Number(row.missed_slots || 0), 0);
    const missedHours = rows.reduce((sum, row) => sum + Number(row.missed_hours || 0), 0);
    const teachersCount = new Set(rows.map((row) => String(row.teacher_id || '')).filter(Boolean)).size;
    return {
      total,
      justifiees,
      nonJustifiees,
      missedSlots,
      missedHours,
      teachersCount,
    };
  }, [report.rows]);

  const selectedTrimestre = trimestres.find((row) => String(row.id) === String(selectedTrimestreId)) || report.trimestre || null;
  const exportTitle = `Absences enseignants ${selectedTrimestre ? getTrimesterLabel(selectedTrimestre) : ''}`.trim();

  const handleApplyFilters = async () => {
    await loadReport({
      trimestreId: selectedTrimestreId,
      teacherId: selectedTeacherId,
      motif: motifFilter,
      justifie: justifieFilter === 'all' ? undefined : justifieFilter,
    });
  };

  const handleTrimestreChange = async (value) => {
    setSelectedTrimestreId(value);
    if (!value) return;
    await loadReport({
      trimestreId: value,
      teacherId: selectedTeacherId,
      motif: motifFilter,
      justifie: justifieFilter === 'all' ? undefined : justifieFilter,
    });
  };

  const handleCreateAbsence = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const teacherId = isTeacher ? report.scopeTeacher?.id : form.teacher_id;
      if (!teacherId) {
        throw new Error('Veuillez selectionner un enseignant.');
      }
      if (!form.date) {
        throw new Error('La date est obligatoire.');
      }
      await api.post(`/system/teachers/${teacherId}/absences`, {
        date: form.date,
        heure_debut: form.heure_debut || undefined,
        heure_fin: form.heure_fin || undefined,
        type: form.type,
        justifie: form.justifie ? 1 : 0,
        motif: form.motif,
      });
      setSuccess('Absence enseignante enregistree avec succes.');
      setForm((prev) => ({
        ...prev,
        date: formatDateInput(),
        heure_debut: '',
        heure_fin: '',
        type: 'absence',
        justifie: false,
        motif: '',
      }));
      await handleApplyFilters();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Erreur lors de l'enregistrement de l'absence.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAbsence = async (absenceId) => {
    const confirmed = window.confirm('Supprimer cette absence ?');
    if (!confirmed) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.delete(`/system/teacher-absences/${absenceId}`);
      setSuccess('Absence enseignant supprimee avec succes.');
      await handleApplyFilters();
    } catch (err) {
      setError(err?.response?.data?.error || 'Erreur lors de la suppression.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const rows = report.rows || [];
    const summaryBox = [
      ['Absences', summary.total],
      ['Justifiees', summary.justifiees],
      ['Non justifiees', summary.nonJustifiees],
      ['Creneaux manques', summary.missedSlots],
      ['Heures manquantes', `${Number(summary.missedHours || 0).toFixed(2)} h`],
      ['Enseignants', summary.teachersCount],
    ];

    doc.setFillColor(15, 118, 110);
    doc.roundedRect(12, 10, pageWidth - 24, 24, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('Absences enseignants', 18, 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 18, 21, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(exportTitle || 'Absences enseignants', 18, 43);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Trimestre: ${selectedTrimestre ? getTrimesterLabel(selectedTrimestre) : '-'}`, 18, 50);
    doc.text(`Justificatif: ${justifieFilter === 'all' ? 'Tous' : justifieFilter === '1' ? 'Justifiees' : 'Non justifiees'}`, 18, 56);
    doc.text(`Motif: ${motifFilter || 'Tous'}`, 18, 62);
    if (report.scopeTeacher) {
      doc.text(`Enseignant: ${report.scopeTeacher.nomComplet || '-'}${report.scopeTeacher.matricule ? ` (${report.scopeTeacher.matricule})` : ''}`, 18, 68);
    }

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(pageWidth - 108, 42, 94, 36, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Synthese du filtre', pageWidth - 103, 49);
    doc.setFont('helvetica', 'normal');
    summaryBox.forEach((item, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      doc.text(`${item[0]}: ${item[1]}`, pageWidth - 103 + (col * 40), 55 + (row * 6));
    });

    autoTable(doc, {
      startY: 78,
      theme: 'grid',
      margin: { left: 12, right: 12 },
      styles: { fontSize: 7.6, cellPadding: 2, textColor: [15, 23, 42] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Date', 'Enseignant', 'Matricule', 'Type', 'Début', 'Fin', 'Justifie', 'Motif', 'Creneaux manques', 'Heures manquantes']],
      body: rows.length
        ? rows.map((row) => [
            formatDateDisplay(row.date),
            row.teacher_nomComplet || '-',
            row.teacher_matricule || '-',
            getAbsenceTypeLabel(row.type),
            row.heure_debut || '-',
            row.heure_fin || '-',
            Number(row.justifie || 0) === 1 ? 'Oui' : 'Non',
            row.motif || '-',
            String(row.missed_slots || 0),
            `${Number(row.missed_hours || 0).toFixed(2)} h`,
          ])
        : [['-', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
    });

    doc.save(`${sanitizeFileName(exportTitle || 'absences-enseignants')}.pdf`);
  };

  if (showLoading) {
    return <PageLoadingState title="Chargement des absences enseignants" message="Les filtres et les absences sont en cours de préparation." />;
  }

  return (
    <section className="space-y-5">
      <PageBanner tone="success" title={success ? 'Operation reussie' : ''} message={success} />
      <PageBanner tone="error" title={error ? 'Action impossible' : ''} message={error} />
      {optionsWarning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {optionsWarning}
        </div>
      ) : null}
      {accessBlockedMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {accessBlockedMessage}
        </div>
      ) : null}
      {error && !trimestres.length && !report.rows.length ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
                {accessBlockedMessage ? 'Acces abonnement' : 'Module absences enseignants indisponible'}
              </p>
              <p className="mt-1 text-sm text-amber-900">{error}</p>
            </div>
            <button
              type="button"
              onClick={loadOptions}
              className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800"
            >
              Reessayer
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Absences enseignants</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Suivi trimestriel des absences et des créneaux manqués</h1>
            <p className="mt-2 text-sm text-slate-600">
              Centralisez les absences, filtrez par trimestre et justificatif, puis exportez un PDF fidèle au filtre choisi.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportPdf}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Retour
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Absences</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total.toLocaleString('fr-FR')}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Justifiees</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{summary.justifiees.toLocaleString('fr-FR')}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Non justifiees</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{summary.nonJustifiees.toLocaleString('fr-FR')}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Creneaux manques</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{summary.missedSlots.toLocaleString('fr-FR')}</p>
        </div>
        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Heures manquantes</p>
          <p className="mt-2 text-2xl font-bold text-orange-700">{Number(summary.missedHours || 0).toFixed(2)} h</p>
        </div>
        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 shadow-sm">
          <p className="text-sm text-slate-500">Enseignants</p>
          <p className="mt-2 text-2xl font-bold text-teal-700">{summary.teachersCount.toLocaleString('fr-FR')}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Trimestre</label>
            <select
              value={selectedTrimestreId}
              onChange={(event) => handleTrimestreChange(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500"
            >
              <option value="">Selectionner un trimestre</option>
              {trimestres.map((trimestre) => (
                <option key={trimestre.id} value={trimestre.id}>
                  {getTrimesterLabel(trimestre)}
                </option>
              ))}
            </select>
          </div>

          {canChooseTeacher ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Enseignant</label>
              <select
                value={selectedTeacherId}
                onChange={(event) => setSelectedTeacherId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500"
              >
                <option value="">Tous les enseignants</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.nomComplet || '-'}{teacher.matricule ? ` (${teacher.matricule})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Enseignant</p>
              <p className="mt-1 font-semibold text-slate-900">{report.scopeTeacher?.nomComplet || 'Votre profil'}</p>
              <p className="text-sm text-slate-500">{report.scopeTeacher?.matricule || '-'}</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Motif</label>
            <input
              value={motifFilter}
              onChange={(event) => setMotifFilter(event.target.value)}
              placeholder="Rechercher un motif"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Justificatif</label>
            <select
              value={justifieFilter}
              onChange={(event) => setJustifieFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500"
            >
              <option value="all">Tous</option>
              <option value="1">Justifiees</option>
              <option value="0">Non justifiees</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleApplyFilters}
            disabled={loading || !selectedTrimestreId}
            className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Filtrage...' : 'Appliquer les filtres'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMotifFilter('');
              setJustifieFilter('all');
              setSelectedTeacherId('');
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Reinitialiser
          </button>
        </div>
      </div>

      <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={handleCreateAbsence}>
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nouvelle absence</h2>
            <p className="text-sm text-slate-500">Ajoutez un retard, une absence ou un congé pour un enseignant.</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer l’absence'}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {canChooseTeacher ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Enseignant</label>
              <select
                value={form.teacher_id}
                onChange={(event) => setForm((prev) => ({ ...prev, teacher_id: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500"
              >
                <option value="">Selectionner un enseignant</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.nomComplet || '-'}{teacher.matricule ? ` (${teacher.matricule})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Enseignant</p>
              <p className="mt-1 font-semibold text-slate-900">{report.scopeTeacher?.nomComplet || 'Votre profil'}</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Heure debut</label>
            <input
              type="time"
              value={form.heure_debut}
              onChange={(event) => setForm((prev) => ({ ...prev, heure_debut: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Heure fin</label>
            <input
              type="time"
              value={form.heure_fin}
              onChange={(event) => setForm((prev) => ({ ...prev, heure_fin: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
            <select
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500"
            >
              <option value="absence">Absence</option>
              <option value="retard">Retard</option>
              <option value="conge">Congé</option>
              <option value="mission">Mission</option>
            </select>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <input
              id="teacher-justify"
              type="checkbox"
              checked={form.justifie}
              onChange={(event) => setForm((prev) => ({ ...prev, justifie: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <label htmlFor="teacher-justify" className="text-sm font-medium text-slate-700">Justifiee</label>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">Motif</label>
          <textarea
            value={form.motif}
            onChange={(event) => setForm((prev) => ({ ...prev, motif: event.target.value }))}
            rows={3}
            placeholder="Renseignez le motif ou la justification de l’absence"
            className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500"
          />
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Historique des absences</h2>
            <p className="text-sm text-slate-500">
              {selectedTrimestre ? `Trimestre ${getTrimesterLabel(selectedTrimestre)}` : 'Selectionnez un trimestre pour voir le detail.'}
            </p>
          </div>
          <div className="text-sm text-slate-500">
            {report.rows?.length ? `${report.rows.length} enregistrement(s)` : 'Aucun enregistrement'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1320px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Enseignant</th>
                <th className="px-4 py-3">Matricule</th>
                <th className="px-4 py-3">Trimestre</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Debut</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3">Justifie</th>
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3 text-right">Creneaux manques</th>
                <th className="px-4 py-3 text-right">Heures manquantes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {report.rows?.length ? report.rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-700">{formatDateDisplay(row.date)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.teacher_nomComplet || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.teacher_matricule || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{getTrimesterLabel(report.trimestre || selectedTrimestre)}</td>
                  <td className="px-4 py-3 text-slate-700">{getAbsenceTypeLabel(row.type)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.heure_debut || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.heure_fin || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{Number(row.justifie || 0) === 1 ? 'Oui' : 'Non'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.motif || '-'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{Number(row.missed_slots || 0)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{Number(row.missed_hours || 0).toFixed(2)} h</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/personnelProfil/enseignant/${row.teacher_id}`)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Profil
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAbsence(row.id)}
                        disabled={saving}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-slate-400">
                    Aucune absence ne correspond aux filtres choisis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default AbsencesEnseignants;
