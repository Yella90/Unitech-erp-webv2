import { useEffect, useState } from 'react';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

function SyncStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const showLoading = usePageLoadingVisibility(loading);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/system/sync-status');
      setStatus(response.data);
    } catch (err) {
      setError('Impossible de charger le statut de synchronisation.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSync() {
    try {
      setError('');
      setSuccess('');
      await api.post('/system/sync-status/sync-now');
      await load();
      setSuccess('Synchronisation lancee avec succes.');
    } catch (err) {
      setError("Erreur lors du declenchement de la synchronisation.");
    }
  }

  if (showLoading) {
    return <PageLoadingState title="Chargement du statut de synchronisation" message="Le systeme recupere les informations de synchronisation." />;
  }

  if (error && !status) {
    return (
      <PageErrorState
        title="Synchronisation indisponible"
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
      <PageBanner tone="error" title={error && status ? 'Action impossible' : ''} message={status ? error : ''} />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Derniere synchronisation</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{status?.lastSync || 'Jamais'}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Statut global</p>
          <p className={`mt-3 text-2xl font-semibold ${status?.status === 'ok' ? 'text-emerald-600' : 'text-amber-600'}`}>{status?.status || 'ok'}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Notifications non lues</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{status?.unreadNotifications || 0}</p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Etat de synchronisation</h2>
          <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700" onClick={handleSync}>
            Synchroniser maintenant
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-500">Elements en attente</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{status?.pending || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-500">Elements en erreur</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{status?.failed || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-500">Dernier etat</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{status?.status || 'ok'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SyncStatus;
