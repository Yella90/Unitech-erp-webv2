import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
}

function sanitizeFileName(value) {
  return String(value || 'retards-paiement')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function RetardsPaiement() {
  const [data, setData] = useState({ eleves: [], personnels: [], enseignants: [], mois: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('');
  const showLoading = usePageLoadingVisibility(loading);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/system/retards-paiement');
        setData(response.data || { eleves: [], personnels: [], enseignants: [], mois: 0 });
      } catch (err) {
        console.error('Erreur chargement retards paiement:', err);
        setError(err?.response?.data?.error || 'Impossible de charger les retards de paiement.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const overdue = (data.eleves || []).filter((item) => Number(item.reste || 0) > 0);
  const overduePersonnels = (data.personnels || []).filter((item) => Number(item.reste || 0) > 0);
  const overdueEnseignants = (data.enseignants || []).filter((item) => Number(item.reste || 0) > 0);
  const studentClassOptions = useMemo(
    () => Array.from(new Set(overdue.map((item) => item.classe || 'Sans classe'))).sort((a, b) => String(a).localeCompare(String(b))),
    [overdue]
  );
  const filteredOverdue = useMemo(() => {
    const normalizedQuery = String(studentQuery || '').trim().toLowerCase();
    return overdue.filter((item) => {
      const className = item.classe || 'Sans classe';
      const matchesClass = !studentClassFilter || className === studentClassFilter;
      const fullName = `${item.nom || ''} ${item.prenom || ''}`.trim().toLowerCase();
      const matricule = String(item.matricule || '').trim().toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        fullName.includes(normalizedQuery) ||
        matricule.includes(normalizedQuery);
      return matchesClass && matchesQuery;
    });
  }, [overdue, studentClassFilter, studentQuery]);
  const overdueElevesByClass = useMemo(() => {
    const map = new Map();
    filteredOverdue.forEach((item) => {
      const key = item.classe || 'Sans classe';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(item);
    });
    return Array.from(map.entries()).sort(([a], [b]) => String(a).localeCompare(String(b)));
  }, [filteredOverdue]);

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const title = 'Retards de paiement';
    const generatedAt = new Date().toLocaleDateString('fr-FR');

    const addHeader = (subtitle) => {
      doc.setFillColor(30, 58, 138);
      doc.roundedRect(12, 10, pageWidth - 24, 26, 5, 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.text(title, 18, 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Genere le ${generatedAt}`, pageWidth - 18, 22, { align: 'right' });
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      if (subtitle) {
        doc.text(subtitle, 18, 40);
      }
    };

    addHeader(`Mois consideres: ${data.mois || 0}`);

    autoTable(doc, {
      startY: 48,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
      head: [['Categorie', 'Nombre', 'Total reste']],
      body: [
        ['Eleves', String(overdue.length), formatMoney(overdue.reduce((sum, item) => sum + Number(item.reste || 0), 0))],
        ['Personnels', String(overduePersonnels.length), formatMoney(overduePersonnels.reduce((sum, item) => sum + Number(item.reste || 0), 0))],
        ['Enseignants', String(overdueEnseignants.length), formatMoney(overdueEnseignants.reduce((sum, item) => sum + Number(item.reste || 0), 0))],
      ],
    });

    autoTable(doc, {
      startY: doc.lastAutoTable?.finalY + 8 || 70,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
      headStyles: { fillColor: [220, 252, 231], textColor: [6, 78, 59], fontStyle: 'bold' },
      head: [['Eleve', 'Classe', 'Mois dus', 'Total du', 'Total paye', 'Reste']],
      body: filteredOverdue.length
        ? filteredOverdue.map((item) => [
            `${item.nom} ${item.prenom}`.trim(),
            item.classe || '-',
            String(item.mois || 0),
            formatMoney(item.total_du),
            formatMoney(item.total_paye),
            formatMoney(item.reste),
          ])
        : [['-', '-', '-', '-', '-', 'Aucun eleve en retard']],
    });

    overdueElevesByClass.forEach(([classe, rows]) => {
      doc.addPage();
      addHeader(`Eleves en retard - Classe ${classe}`);
      autoTable(doc, {
        startY: 48,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
        headStyles: { fillColor: [239, 246, 255], textColor: [30, 64, 175], fontStyle: 'bold' },
        head: [['Eleve', 'Mois dus', 'Total du', 'Total paye', 'Reste']],
        body: rows.map((item) => [
          `${item.nom} ${item.prenom}`.trim(),
          String(item.mois || 0),
          formatMoney(item.total_du),
          formatMoney(item.total_paye),
          formatMoney(item.reste),
        ]),
      });
    });

    if (overduePersonnels.length) {
      doc.addPage();
      addHeader('Personnels en retard');
      autoTable(doc, {
        startY: 48,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
        headStyles: { fillColor: [254, 242, 242], textColor: [153, 27, 27], fontStyle: 'bold' },
        head: [['Matricule', 'Nom', 'Poste', 'Mensuel', 'Total du', 'Total paye', 'Reste']],
        body: overduePersonnels.map((item) => [
          item.matricule || '-',
          item.full_name || '-',
          item.poste || '-',
          formatMoney(item.montant_mensuel),
          formatMoney(item.total_du),
          formatMoney(item.total_paye),
          formatMoney(item.reste),
        ]),
      });
    }

    if (overdueEnseignants.length) {
      doc.addPage();
      addHeader('Enseignants en retard');
      autoTable(doc, {
        startY: 48,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
        headStyles: { fillColor: [240, 249, 255], textColor: [30, 64, 175], fontStyle: 'bold' },
        head: [['Matricule', 'Nom', 'Matiere / Poste', 'Mensuel', 'Total du', 'Total paye', 'Reste']],
        body: overdueEnseignants.map((item) => [
          item.matricule || '-',
          item.full_name || '-',
          item.poste || '-',
          formatMoney(item.montant_mensuel),
          formatMoney(item.total_du),
          formatMoney(item.total_paye),
          formatMoney(item.reste),
        ]),
      });
    }

    doc.save(`${sanitizeFileName(title)}.pdf`);
  };
  const stats = [
    { label: 'Eleves en retard', value: overdue.length },
    { label: 'Personnels en retard', value: overduePersonnels.length },
    { label: 'Enseignants en retard', value: overdueEnseignants.length },
    { label: 'Mois consideres', value: data.mois || 0 },
  ];

  if (showLoading) {
    return <PageLoadingState title="Chargement des retards" message="Les retards de paiement sont en cours de chargement." />;
  }

  if (error && !overdue.length && !overduePersonnels.length && !overdueEnseignants.length) {
    return (
      <PageErrorState
        title="Retards de paiement indisponibles"
        message={error}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Reessayer
          </button>
        }
      />
    );
  }

  return (
    <section className="space-y-5">
      <PageBanner tone="error" title={error ? 'Action impossible' : ''} message={error} />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportPdf}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Exporter PDF
        </button>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_220px_auto]">
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
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Classe</label>
          <select
            value={studentClassFilter}
            onChange={(event) => setStudentClassFilter(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Toutes les classes</option>
            {studentClassOptions.map((className) => (
              <option key={className} value={className}>{className}</option>
            ))}
          </select>
        </div>
        <div className="md:self-end">
          <button
            type="button"
            onClick={() => {
              setStudentQuery('');
              setStudentClassFilter('');
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reinitialiser
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <h2 className="text-base font-semibold">Eleves en retard</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left">Eleve</th>
                <th className="px-4 py-3 text-left">Classe</th>
                <th className="px-4 py-3 text-left">Mois dus</th>
                <th className="px-4 py-3 text-left">Total du</th>
                <th className="px-4 py-3 text-left">Total paye</th>
                <th className="px-4 py-3 text-left">Reste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOverdue.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.nom} {item.prenom}</td>
                  <td className="px-4 py-3">{item.classe || '-'}</td>
                  <td className="px-4 py-3">{item.mois || 0}</td>
                  <td className="px-4 py-3">{formatMoney(item.total_du)}</td>
                  <td className="px-4 py-3">{formatMoney(item.total_paye)}</td>
                  <td className="px-4 py-3 text-rose-600">{formatMoney(item.reste)}</td>
                </tr>
              ))}
              {filteredOverdue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aucun eleve en retard pour ce filtre.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <h2 className="text-base font-semibold">Personnels en retard</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left">Matricule</th>
                <th className="px-4 py-3 text-left">Nom</th>
                <th className="px-4 py-3 text-left">Poste</th>
                <th className="px-4 py-3 text-left">Mensuel</th>
                <th className="px-4 py-3 text-left">Total du</th>
                <th className="px-4 py-3 text-left">Total paye</th>
                <th className="px-4 py-3 text-left">Reste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overduePersonnels.map((item) => (
                <tr key={item.matricule || item.full_name}>
                  <td className="px-4 py-3">{item.matricule || '-'}</td>
                  <td className="px-4 py-3">{item.full_name || '-'}</td>
                  <td className="px-4 py-3">{item.poste || '-'}</td>
                  <td className="px-4 py-3">{formatMoney(item.montant_mensuel)}</td>
                  <td className="px-4 py-3">{formatMoney(item.total_du)}</td>
                  <td className="px-4 py-3">{formatMoney(item.total_paye)}</td>
                  <td className="px-4 py-3 text-rose-600">{formatMoney(item.reste)}</td>
                </tr>
              ))}
              {overduePersonnels.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucun personnel en retard.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <h2 className="text-base font-semibold">Enseignants en retard</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left">Matricule</th>
                <th className="px-4 py-3 text-left">Nom</th>
                <th className="px-4 py-3 text-left">Matiere / Poste</th>
                <th className="px-4 py-3 text-left">Mensuel</th>
                <th className="px-4 py-3 text-left">Total du</th>
                <th className="px-4 py-3 text-left">Total paye</th>
                <th className="px-4 py-3 text-left">Reste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overdueEnseignants.map((item) => (
                <tr key={item.matricule || item.full_name}>
                  <td className="px-4 py-3">{item.matricule || '-'}</td>
                  <td className="px-4 py-3">{item.full_name || '-'}</td>
                  <td className="px-4 py-3">{item.poste || '-'}</td>
                  <td className="px-4 py-3">{formatMoney(item.montant_mensuel)}</td>
                  <td className="px-4 py-3">{formatMoney(item.total_du)}</td>
                  <td className="px-4 py-3">{formatMoney(item.total_paye)}</td>
                  <td className="px-4 py-3 text-rose-600">{formatMoney(item.reste)}</td>
                </tr>
              ))}
              {overdueEnseignants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucun enseignant en retard.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default RetardsPaiement;
