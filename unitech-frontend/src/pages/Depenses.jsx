import { useEffect, useState } from 'react';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

const initialForm = { categorie: '', motif: '', montant: '', date_depenses: '', description: '' };
const depenseCategories = [
  'Loyer',
  'Electricite',
  'Eau',
  'Internet',
  'Fournitures scolaires',
  'Fournitures de bureau',
  'Entretien',
  'Transport',
  'Cantine',
  'Securite',
  'Evenement',
  'Maintenance',
  'Impression',
  'Sante',
  'Autre',
];

function Depenses() {
  const [depenses, setDepenses] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const showLoading = usePageLoadingVisibility(loading);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/system/depenses');
      setDepenses(response.data || []);
    } catch (err) {
      setError("Erreur lors du chargement des depenses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/system/depenses', formData);
      setFormData(initialForm);
      await load();
      setSuccess('Depense ajoutee avec succes.');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'ajout.");
    }
  }

  async function handleDelete(id) {
    try {
      setError('');
      setSuccess('');
      await api.delete(`/system/depenses/${id}`);
      await load();
      setSuccess('Depense supprimee avec succes.');
    } catch (err) {
      setError("Erreur lors de la suppression de la depense.");
    }
  }

  const total = depenses.reduce((sum, item) => sum + Number(item.montant || 0), 0);

  if (showLoading) {
    return <PageLoadingState title="Chargement des depenses" message="Les depenses de l'etablissement sont en cours de chargement." />;
  }

  if (error && depenses.length === 0) {
    return (
      <PageErrorState
        title="Liste des depenses indisponible"
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
      <PageBanner tone="error" title={error && depenses.length > 0 ? 'Action impossible' : ''} message={depenses.length > 0 ? error : ''} />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Total depenses</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{total} FCFA</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Operations</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{depenses.length}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Derniere depense</p>
          <p className="mt-3 text-xl font-semibold text-slate-900">{depenses[0]?.date_depenses || '-'}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-base font-semibold">Nouvelle depense</h2>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={formData.categorie}
            onChange={(e) => setFormData((prev) => ({ ...prev, categorie: e.target.value }))}
          >
            <option value="">Selectionner une categorie</option>
            {depenseCategories.map((categorie) => (
              <option key={categorie} value={categorie}>
                {categorie}
              </option>
            ))}
          </select>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Motif" value={formData.motif} onChange={(e) => setFormData((prev) => ({ ...prev, motif: e.target.value }))} />
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Montant" type="number" value={formData.montant} onChange={(e) => setFormData((prev) => ({ ...prev, montant: e.target.value }))} />
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={formData.date_depenses} onChange={(e) => setFormData((prev) => ({ ...prev, date_depenses: e.target.value }))} />
          <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" rows={3} placeholder="Description" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} />
          <button className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">Ajouter</button>
        </form>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
          <h2 className="text-base font-semibold">Historique des depenses</h2>
          <table className="w-full min-w-[640px] mt-4 border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left">Categorie</th>
                <th className="px-4 py-3 text-left">Motif</th>
                <th className="px-4 py-3 text-left">Montant</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {depenses.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.categorie || '-'}</td>
                  <td className="px-4 py-3">{item.motif}</td>
                  <td className="px-4 py-3">{item.montant} FCFA</td>
                  <td className="px-4 py-3">{item.date_depenses || '-'}</td>
                  <td className="px-4 py-3 text-right"><button className="rounded-md bg-rose-600 px-3 py-1 text-xs text-white" onClick={() => handleDelete(item.id)}>Supprimer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default Depenses;
