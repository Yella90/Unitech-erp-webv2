import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';
import SearchableSelect from '../components/SearchableSelect';

const initialForm = {
  personnel_matricule: '',
  source_type: 'personnel',
  mois: '',
  montant: '',
  mode_payement: 'cash',
  date_payement: '',
};

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR');
}

function sanitizeFileName(value) {
  return String(value || 'salaires')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function parseDateLike(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;
  const monthMatch = String(value).match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const monthDate = new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1);
    if (!Number.isNaN(monthDate.getTime())) return monthDate;
  }
  return null;
}

function getQuarterMeta(value) {
  const date = parseDateLike(value);
  if (!date) {
    return { key: 'T-1', label: 'Trimestre inconnu', index: -1 };
  }
  const year = date.getFullYear();
  const month = date.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  return {
    key: `${year}-T${quarter}`,
    label: `T${quarter} ${year}`,
    index: quarter,
  };
}

function describeSalaryMode(row) {
  const mode = String(row?.mode_payement || '').trim().toLowerCase();
  if (mode.includes('taux') || mode.includes('horaire')) return 'Salaire horaire';
  if (mode.includes('salaire') || mode.includes('mensuel')) return 'Salaire fixe';
  if (row?.source_type === 'enseignant' || row?.source_type === 'personnel') return 'Paiement manuel';
  return 'Versement';
}

function monthLabelFromValue(value) {
  const parsed = parseDateLike(value);
  if (!parsed) return String(value || '-');
  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(parsed);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function summarizeQuarterRows(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const sourceDate = parseDateLike(row.date_payement) || parseDateLike(row.mois);
    const quarter = getQuarterMeta(sourceDate || row.date_payement || row.mois);
    const key = quarter.key;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        label: quarter.label,
        index: quarter.index,
        totalAmount: 0,
        count: 0,
        rows: [],
      });
    }

    const bucket = grouped.get(key);
    bucket.totalAmount += Number(row.montant || 0);
    bucket.count += 1;
    bucket.rows.push(row);
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.key === 'T-1') return 1;
    if (b.key === 'T-1') return -1;
    return String(b.key).localeCompare(String(a.key));
  });
}

function Salaires() {
  const [salaires, setSalaires] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [generationMonth, setGenerationMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generationMode, setGenerationMode] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [salaryPreview, setSalaryPreview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const showLoading = usePageLoadingVisibility(loading);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [salairesResponse, personnelsResponse, enseignantsResponse, dashboardResponse] = await Promise.all([
        api.get('/system/salaires'),
        api.get('/personnels'),
        api.get('/enseignants'),
        api.get('/system/dashboard/summary'),
      ]);
      setSalaires(salairesResponse.data || []);
      setDashboardSummary(dashboardResponse.data || null);
      setStaffOptions([
        ...(personnelsResponse.data || []).map((row) => ({ type: 'personnel', matricule: row.matricule, label: `${row.nomComplet} (${row.matricule || 'sans matricule'})` })),
        ...(enseignantsResponse.data || []).map((row) => ({ type: 'enseignant', matricule: row.matricule, label: `${row.nomComplet} (${row.matricule || 'sans matricule'})` })),
      ]);
    } catch {
      setError("Erreur lors du chargement des salaires.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/system/salaires', formData);
      setFormData(initialForm);
      await load();
      setSuccess('Salaire enregistre avec succes.');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'enregistrement.");
    }
  }

  async function handleGenerate(mode) {
    setError('');
    setSuccess('');
    setGenerationMode(mode);
    try {
      const endpoint = mode === 'monthly'
        ? '/system/salaires/generate-monthly'
        : '/system/salaires/generate-hourly';
      const response = await api.post(endpoint, { month: generationMonth });
      await load();

      const generated = Number(response.data?.generated || 0);
      const skipped = Number(response.data?.skipped || 0);
      const label = mode === 'monthly' ? 'salaires fixes' : 'salaires horaires';
      setSuccess(`${generated} ${label} generes${skipped ? `, ${skipped} element(s) ignores` : ''}.`);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de la generation automatique.");
    } finally {
      setGenerationMode('');
    }
  }

  async function handlePreview() {
    setError('');
    setSuccess('');
    setPreviewLoading(true);
    try {
      const response = await api.get('/system/salaires/preview-generation', {
        params: { month: generationMonth },
      });
      setSalaryPreview(response.data || null);
      setSuccess('Aperçu de generation charge avec succes.');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de la previsualisation.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDelete(id) {
    try {
      setError('');
      setSuccess('');
      await api.post(`/system/salaires/${id}/annuler`);
      await load();
      setSuccess('Paiement RH annule avec succes.');
    } catch (err) {
      setError(err?.response?.data?.error || "Erreur lors de l'annulation du paiement RH.");
    }
  }

  const total = salaires.reduce((sum, row) => sum + Number(row.montant || 0), 0);
  const staffLabelByMatricule = useMemo(() => {
    return new Map(
      staffOptions.map((item) => [String(item.matricule || '').trim().toLowerCase(), item.label])
    );
  }, [staffOptions]);
  const quarterGroups = useMemo(() => summarizeQuarterRows(salaires), [salaires]);
  const generationForecast = dashboardSummary?.forecast || {};
  const generationFixed = Number(generationForecast.sortieMensuelleSalaires || 0);
  const generationHourly = Number(generationForecast.sortieMensuelleHoraire || 0);
  const generationTotal = Number(generationForecast.sortieMensuellePrevue || 0);

  const handleDownloadSalairesPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const schoolName = dashboardSummary?.school?.name || dashboardSummary?.schoolName || 'Etablissement';
    const latestPayment = salaires[0] || null;
    const monthlyCount = salaires.filter((row) => String(row.mode_payement || '').toLowerCase().includes('salaire')).length;
    const hourlyCount = salaires.filter((row) => String(row.mode_payement || '').toLowerCase().includes('horaire')).length;
    const manualCount = salaires.length - monthlyCount - hourlyCount;
    const totalPaid = total;

    doc.setFillColor(5, 150, 105);
    doc.roundedRect(12, 10, pageWidth - 24, 26, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('Bulletin des salaires', 18, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Genere le ${formatDate(new Date().toISOString())}`, pageWidth - 18, 22, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(schoolName, 18, 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Historique des versements par trimestre`, 18, 52);
    doc.text(`Dernier versement: ${latestPayment ? formatDate(latestPayment.date_payement || latestPayment.created_at) : '-'}`, 18, 58);
    doc.text(`Paiements totaux: ${salaires.length}`, 18, 64);
    doc.text(`Total verse: ${formatMoney(totalPaid)}`, 18, 70);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(pageWidth - 82, 46, 70, 30, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Resume paie', pageWidth - 77, 54);
    doc.setFont('helvetica', 'normal');
    doc.text(`Mensuels: ${monthlyCount}`, pageWidth - 77, 60);
    doc.text(`Horaires: ${hourlyCount}`, pageWidth - 77, 66);
    doc.text(`Manuels: ${manualCount}`, pageWidth - 77, 72);

    autoTable(doc, {
      startY: 80,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5, textColor: [15, 23, 42] },
      headStyles: { fillColor: [220, 252, 231], textColor: [6, 78, 59], fontStyle: 'bold' },
      body: [
        ['Total verse', formatMoney(totalPaid)],
        ['Nombre de versements', String(salaires.length)],
        ['Versements mensuels', String(monthlyCount)],
        ['Versements horaires', String(hourlyCount)],
        ['Versements manuels', String(manualCount)],
      ],
    });

    const summaryEndY = doc.lastAutoTable?.finalY || 80;
    const groupedRows = quarterGroups.length ? quarterGroups : [];

    if (!groupedRows.length) {
      autoTable(doc, {
        startY: summaryEndY + 10,
        head: [['Trimestre', 'Nombre', 'Montant']],
        body: [['-', '0', 'Aucun versement']],
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
        headStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold' },
      });
    } else {
      groupedRows.forEach((quarter, index) => {
        const sectionStartY = index === 0 ? summaryEndY + 10 : (doc.lastAutoTable?.finalY || summaryEndY) + 14;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(`${quarter.label}`, 14, sectionStartY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`${quarter.count} versement(s) - ${formatMoney(quarter.totalAmount)}`, 14, sectionStartY + 5);

        autoTable(doc, {
          startY: sectionStartY + 8,
          theme: 'grid',
          styles: { fontSize: 7.8, cellPadding: 2.1, textColor: [15, 23, 42] },
          headStyles: { fillColor: [239, 246, 255], textColor: [30, 64, 175], fontStyle: 'bold' },
          margin: { left: 14, right: 14 },
          head: [['Type', 'Matricule', 'Nom', 'Mode', 'Periode', 'Montant']],
          body: quarter.rows.map((row) => {
            const matricule = String(row.personnel_matricule || '').trim();
            const name = staffLabelByMatricule.get(matricule.toLowerCase()) || row.nomComplet || row.personnel_nom || '-';
            const mode = describeSalaryMode(row);
            const period = row.mois ? monthLabelFromValue(row.mois) : formatDate(row.date_payement || row.created_at);
            return [
              String(row.source_type || '-'),
              matricule || '-',
              name || '-',
              mode,
              period || '-',
              formatMoney(row.montant),
            ];
          }),
        });
      });
    }

    doc.save(`${sanitizeFileName(schoolName)}-salaires-trimestriel.pdf`);
  };

  if (showLoading) {
    return <PageLoadingState title="Chargement des salaires" message="Les paiements RH sont en cours de chargement." />;
  }

  if (error && salaires.length === 0) {
    return (
      <PageErrorState
        title="Liste des salaires indisponible"
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
    <section className="app-page space-y-5">
      <PageBanner tone="success" title={success ? 'Operation reussie' : ''} message={success} />
      <PageBanner tone="error" title={error && salaires.length > 0 ? 'Action impossible' : ''} message={salaires.length > 0 ? error : ''} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="surface-card rounded-2xl p-5">
          <p className="text-sm text-slate-500">Total salaires</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{total} FCFA</p>
        </div>
        <div className="surface-card rounded-2xl p-5">
          <p className="text-sm text-slate-500">Paiements RH</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{salaires.length}</p>
        </div>
        <div className="surface-card rounded-2xl p-5">
          <p className="text-sm text-slate-500">Derniere date</p>
          <p className="mt-3 text-xl font-semibold text-slate-900">{salaires[0]?.date_payement || '-'}</p>
        </div>
      </div>

      <div className="surface-card flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Export PDF</h2>
          <p className="mt-1 text-sm text-slate-500">
            Historique des versements regroupé par trimestre, avec le mode de paie et le détail de chaque ligne.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadSalairesPdf}
          className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Télécharger le PDF
        </button>
      </div>

      <div className="surface-card space-y-3 rounded-2xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">Generation automatique</h2>
            <p className="mt-1 text-sm text-slate-500">
              Genere les salaires fixes et horaires pour un mois donne, sans dupliquer les enregistrements deja existants.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr_1fr] lg:w-[620px]">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Mois</label>
              <input
                className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                type="month"
                value={generationMonth}
                onChange={(e) => setGenerationMonth(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading}
              className="rounded-2xl bg-slate-700 px-4 py-2 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {previewLoading ? 'Chargement...' : 'Prévisualiser avant génération'}
            </button>
            <button
              type="button"
              onClick={() => handleGenerate('monthly')}
              disabled={generationMode === 'monthly'}
              className="rounded-2xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generationMode === 'monthly' ? 'Generation...' : 'Generer fixes'}
            </button>
            <button
              type="button"
              onClick={() => handleGenerate('hourly')}
              disabled={generationMode === 'hourly'}
              className="rounded-2xl bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generationMode === 'hourly' ? 'Generation...' : 'Generer horaires'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Salaire fixe prevu</p>
            <p className="mt-1 text-base font-bold text-slate-900">{generationFixed.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Salaire horaire prevu</p>
            <p className="mt-1 text-base font-bold text-slate-900">{generationHourly.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total automatique</p>
            <p className="mt-1 text-base font-bold text-slate-900">{generationTotal.toLocaleString('fr-FR')} FCFA</p>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Formule: salaires fixes des personnels et enseignants mensuels + salaires horaires des enseignants calcules sur les creneaux du mois actif.
        </p>

        {salaryPreview && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Détail de prévisualisation</h3>
                <p className="text-xs text-slate-500">Mois: {salaryPreview.month || generationMonth}</p>
              </div>
              <div className="text-xs text-slate-500">
                {salaryPreview.fixed?.generated || 0} fixes • {salaryPreview.hourly?.generated || 0} horaires
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fixes concernés</p>
                <p className="mt-1 text-base font-bold text-slate-900">{Number(salaryPreview.fixed?.generated || 0).toLocaleString('fr-FR')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Horaires concernés</p>
                <p className="mt-1 text-base font-bold text-slate-900">{Number(salaryPreview.hourly?.generated || 0).toLocaleString('fr-FR')}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total prévisionnel</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {Number((salaryPreview.totals?.fixed || 0) + (salaryPreview.totals?.hourly || 0)).toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left">Profil</th>
                    <th className="px-4 py-3 text-left">Matricule</th>
                    <th className="px-4 py-3 text-left">Nom complet</th>
                    <th className="px-4 py-3 text-left">Nature</th>
                    <th className="px-4 py-3 text-left">Détail</th>
                    <th className="px-4 py-3 text-left">Montant</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ...(salaryPreview.fixed?.items || []),
                    ...(salaryPreview.hourly?.items || []),
                  ].map((item) => (
                    <tr key={`${item.mode}:${item.source_type}:${item.matricule}`}>
                      <td className="px-4 py-3">{item.source_type === 'enseignant' ? 'Enseignant' : 'Personnel'}</td>
                      <td className="px-4 py-3">{item.matricule || '-'}</td>
                      <td className="px-4 py-3">{item.nomComplet || '-'}</td>
                      <td className="px-4 py-3">{item.mode === 'monthly' ? 'Salaire fixe' : 'Salaire horaire'}</td>
                      <td className="px-4 py-3">
                        {item.mode === 'monthly'
                          ? `${Number(item.details?.salaire_base || 0).toLocaleString('fr-FR')} FCFA`
                          : `${Number(item.details?.heures || 0).toLocaleString('fr-FR')} h × ${Number(item.details?.taux_horaire || 0).toLocaleString('fr-FR')} FCFA`}
                      </td>
                      <td className="px-4 py-3 font-medium">{Number(item.montant || 0).toLocaleString('fr-FR')} FCFA</td>
                      <td className="px-4 py-3">
                        {item.already_generated ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Déjà généré</span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">À générer</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!(salaryPreview.fixed?.items?.length || salaryPreview.hourly?.items?.length) && (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={7}>
                        Aucun personnel ou enseignant concerné pour ce mois.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <form onSubmit={handleSubmit} className="surface-card space-y-3 rounded-2xl p-5">
          <h2 className="text-base font-semibold">Enregistrer un salaire</h2>
          <SearchableSelect
            value={`${formData.source_type}:${formData.personnel_matricule}`}
            onChange={(nextValue) => {
              const [type, matricule] = String(nextValue || ':').split(':');
              setFormData((prev) => ({ ...prev, source_type: type || 'personnel', personnel_matricule: matricule || '' }));
            }}
            placeholder="Rechercher un personnel ou enseignant"
            emptyLabel="Aucun resultat"
            options={staffOptions.map((item) => ({
              value: `${item.type}:${item.matricule}`,
              label: item.label,
              keywords: `${item.type} ${item.matricule || ''} ${item.label || ''}`,
            }))}
          />
          <input className="w-full rounded-2xl border border-slate-300 px-3 py-2" type="month" value={formData.mois} onChange={(e) => setFormData((prev) => ({ ...prev, mois: e.target.value }))} />
          <input className="w-full rounded-2xl border border-slate-300 px-3 py-2" type="number" placeholder="Montant" value={formData.montant} onChange={(e) => setFormData((prev) => ({ ...prev, montant: e.target.value }))} />
          <input className="w-full rounded-2xl border border-slate-300 px-3 py-2" type="date" value={formData.date_payement} onChange={(e) => setFormData((prev) => ({ ...prev, date_payement: e.target.value }))} />
          <select className="w-full rounded-2xl border border-slate-300 px-3 py-2" value={formData.mode_payement} onChange={(e) => setFormData((prev) => ({ ...prev, mode_payement: e.target.value }))}>
            <option value="cash">Cash</option>
            <option value="virement">Virement</option>
            <option value="mobile-money">Mobile Money</option>
          </select>
          <button className="w-full rounded-2xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">Ajouter</button>
        </form>

        <div className="surface-card overflow-x-auto rounded-2xl p-5">
          <h2 className="text-base font-semibold">Paiements recents</h2>
          <table className="w-full min-w-[640px] mt-4 border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left">Matricule</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Mois</th>
                <th className="px-4 py-3 text-left">Montant</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salaires.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.personnel_matricule}</td>
                  <td className="px-4 py-3">{item.source_type || '-'}</td>
                  <td className="px-4 py-3">{item.mois || '-'}</td>
                  <td className="px-4 py-3">{item.montant} FCFA</td>
                  <td className="px-4 py-3">{item.date_payement || '-'}</td>
                  <td className="px-4 py-3 text-right"><button className="rounded-md bg-rose-600 px-3 py-1 text-xs text-white" onClick={() => handleDelete(item.id)}>Annuler</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default Salaires;
