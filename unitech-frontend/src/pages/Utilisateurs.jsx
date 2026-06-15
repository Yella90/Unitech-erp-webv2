import { useState, useEffect } from 'react';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

const roleOptions = [
  { value: 'directeur', label: 'Directeur' },
  { value: 'promoteur', label: 'Promoteur' },
  { value: 'comptable', label: 'Comptable' },
  { value: 'secretaire', label: 'Secretaire' },
  { value: 'censeur', label: 'Censeur' },
  { value: 'surveillant', label: 'Surveillant' },
  { value: 'enseignant', label: 'Enseignant' },
  { value: 'personnel', label: 'Personnel' },
];

const initialForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'secretaire',
};

function Utilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const showLoading = usePageLoadingVisibility(loading);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/administrateur/utilisateurs');
      setUtilisateurs(response.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/administrateur/utilisateurs', formData);
      setFormData(initialForm);
      await load();
      setSuccess('Utilisateur cree avec succes.');
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur lors de la creation de l'utilisateur");
    } finally {
      setSaving(false);
    }
  }

  if (showLoading) {
    return <PageLoadingState title="Chargement des utilisateurs" message="Les comptes et roles sont en cours de chargement." />;
  }

  if (error && utilisateurs.length === 0) {
    return (
      <PageErrorState
        title="Utilisateurs indisponibles"
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
      <PageBanner tone="error" title={error && utilisateurs.length > 0 ? 'Action impossible' : ''} message={utilisateurs.length > 0 ? error : ''} />

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-base font-semibold">Nouveau compte</h2>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Nom complet"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            type="password"
            placeholder="Mot de passe"
            value={formData.password}
            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
            required
          />
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Telephone"
            value={formData.phone}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={formData.role}
            onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700" disabled={saving}>
            {saving ? 'Creation...' : 'Creer le compte'}
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm overflow-x-auto">
          <h2 className="text-base font-semibold">Utilisateurs & Roles</h2>
          <table className="w-full min-w-[640px] mt-4 border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {utilisateurs.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{user.name}</td>
                  <td className="px-4 py-3 text-slate-700">{user.email}</td>
                  <td className="px-4 py-3 text-slate-700">{user.role}</td>
                  <td className="px-4 py-3 text-slate-700">{Number(user.is_active || 0) ? 'Actif' : 'Inactif'}</td>
                </tr>
              ))}
              {!utilisateurs.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aucun utilisateur enregistre.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default Utilisateurs;
