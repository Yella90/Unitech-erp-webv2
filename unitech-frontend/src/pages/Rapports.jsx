import { useEffect, useState } from 'react';
import api from '../services/api';
import { PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

function Rapports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const showLoading = usePageLoadingVisibility(loading);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/system/rapports');
        setData(response.data);
      } catch (err) {
        setError('Impossible de charger les rapports.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (showLoading) {
    return <PageLoadingState title="Chargement des rapports" message="Les indicateurs et rapports sont en cours de chargement." />;
  }

  if (error && !data) {
    return <PageErrorState title="Rapports indisponibles" message={error} action={<button type="button" onClick={() => window.location.reload()} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Reessayer</button>} />;
  }

  const cards = [
    { label: 'Revenus', value: `${data?.finances?.totalRevenus || 0} FCFA` },
    { label: 'Depenses', value: `${data?.finances?.totalDepenses || 0} FCFA` },
    { label: 'Moyenne generale', value: `${data?.academique?.moyenneGenerale || 0}` },
  ];

  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((item) => (
          <div key={item.label} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold">Synthese financiere</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="flex justify-between"><span>Total paiements</span><strong>{data?.finances?.totalPaiements || 0} FCFA</strong></div>
            <div className="flex justify-between"><span>Total salaires</span><strong>{data?.finances?.totalSalaires || 0} FCFA</strong></div>
            <div className="flex justify-between"><span>Total retraits</span><strong>{data?.finances?.totalRetraits || 0} FCFA</strong></div>
            <div className="flex justify-between"><span>Solde</span><strong>{data?.finances?.solde || 0} FCFA</strong></div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold">Alertes</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="flex justify-between"><span>Eleves en retard</span><strong>{data?.retards?.eleves || 0}</strong></div>
            <div className="flex justify-between"><span>Personnel en retard</span><strong>{data?.retards?.personnels || 0}</strong></div>
            <div className="flex justify-between"><span>Creneaux planifies</span><strong>{data?.academique?.emploisCount || 0}</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Rapports;
