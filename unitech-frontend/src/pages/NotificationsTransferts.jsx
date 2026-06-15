import { useEffect, useState } from 'react';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

function StatusBadge({ status }) {
  const tone =
    status === 'accepted'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'rejected'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-amber-100 text-amber-700';

  const label =
    status === 'accepted'
      ? 'Accepte'
      : status === 'rejected'
        ? 'Rejete'
        : 'En attente';

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function TransferTable({ title, rows, emptyMessage }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm overflow-x-auto">
      <h2 className="text-base font-semibold">{title}</h2>
      <table className="mt-4 w-full min-w-[820px] border-collapse text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 text-left">Eleve</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Origine</th>
            <th className="px-4 py-3 text-left">Destination</th>
            <th className="px-4 py-3 text-left">Statut</th>
            <th className="px-4 py-3 text-left">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((item) => (
            <tr key={`${title}-${item.id}`}>
              <td className="px-4 py-3">{item.nom} {item.prenom}</td>
              <td className="px-4 py-3">{item.transfer_type === 'external' ? 'Inter-etablissements' : 'Interne'}</td>
              <td className="px-4 py-3">{item.from_school_name || '-'}{item.from_classe ? ` / ${item.from_classe}` : ''}</td>
              <td className="px-4 py-3">{item.to_school_name || '-'}{item.to_classe ? ` / ${item.to_classe}` : ''}</td>
              <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
              <td className="px-4 py-3">{item.requested_at || '-'}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">{emptyMessage}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function NotificationsTransferts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const showLoading = usePageLoadingVisibility(loading);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/system/transfer-notifications');
      setData(response.data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Impossible de charger les notifications de transferts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (showLoading) {
    return <PageLoadingState title="Chargement des notifications de transferts" message="Le systeme recupere les demandes sortantes et celles recues par votre etablissement." />;
  }

  if (error && !data) {
    return (
      <PageErrorState
        title="Notifications indisponibles"
        message={error}
        action={(
          <button type="button" onClick={load} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Reessayer
          </button>
        )}
      />
    );
  }

  return (
    <section className="space-y-5">
      <PageBanner tone="error" title={error && data ? 'Action impossible' : ''} message={data ? error : ''} />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Transferts en cours</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{data?.stats?.ongoing || 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Demandes recues a traiter</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{data?.stats?.receivedPending || 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Transferts acceptes</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-700">{data?.stats?.accepted || 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Transferts rejetes</p>
          <p className="mt-3 text-3xl font-semibold text-rose-700">{data?.stats?.rejected || 0}</p>
        </div>
      </div>

      <TransferTable
        title="Demandes recues par votre etablissement"
        rows={data?.incoming || []}
        emptyMessage="Aucune demande entrante pour le moment."
      />

      <TransferTable
        title="Transferts sortants etat en cours"
        rows={data?.ongoing || []}
        emptyMessage="Aucun transfert sortant en attente."
      />

      <TransferTable
        title="Historique recent des transferts"
        rows={data?.recent || []}
        emptyMessage="Aucun transfert enregistre."
      />
    </section>
  );
}

export default NotificationsTransferts;
