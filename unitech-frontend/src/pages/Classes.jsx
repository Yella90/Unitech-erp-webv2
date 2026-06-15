import { useEffect, useState } from 'react';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

const initialFormData = {
  className: '',
  cycle: '',
  niveau: '',
  mensualite: '',
  fraisInscription: '',
  maxEffectif: '',
};

const levels = {
  Primaire: ["jardin d'enfants", '1ere annee', '2eme annee', '3eme annee', '4eme annee', '5eme annee', '6eme annee'],
  'Second Cycle': ['7eme annee', '8eme annee', '9eme annee'],
};

export default function Classes() {
  const [formData, setFormData] = useState(initialFormData);
  const [editingClassId, setEditingClassId] = useState(null);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const showPageLoading = usePageLoadingVisibility(pageLoading);
  const [classes, setClasses] = useState([]);
  const [niveauOptions, setNiveauOptions] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (errors.submit) setErrors((prev) => ({ ...prev, submit: '' }));
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingClassId(null);
    setErrors({});
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.className.trim()) newErrors.className = 'Le nom de la classe est requis';
    if (!formData.cycle.trim()) newErrors.cycle = 'Le cycle est requis';
    if (!formData.niveau.trim()) newErrors.niveau = 'Le niveau est requis';
    if (!formData.mensualite || Number(formData.mensualite) <= 0) newErrors.mensualite = 'Mensualite valide requise';
    if (formData.fraisInscription === '' || Number(formData.fraisInscription) < 0) newErrors.fraisInscription = "Frais d'inscription valide";
    if (!formData.maxEffectif || Number(formData.maxEffectif) <= 0) newErrors.maxEffectif = 'Effectif maximum valide requis';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchClasses = async () => {
    setPageLoading(true);
    setPageError('');
    try {
      const response = await api.get('/classes');
      setClasses(response.data || []);
    } catch (err) {
      if (err.response?.status === 401) {
        window.location.href = '/login';
        return;
      }
      console.error('Erreur lors de la recuperation des classes:', err);
      setPageError('Impossible de charger la liste des classes.');
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (formData.cycle) {
      setNiveauOptions(levels[formData.cycle] || []);
      if (!levels[formData.cycle]?.includes(formData.niveau)) {
        setFormData((prev) => ({ ...prev, niveau: '' }));
      }
    } else {
      setNiveauOptions([]);
    }
  }, [formData.cycle, formData.niveau]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSuccess('');
    setPageError('');
    try {
      if (editingClassId) {
        await api.put(`/classes/${editingClassId}`, formData);
        setSuccess('Classe modifiee avec succes.');
      } else {
        await api.post('/classes', formData);
        setSuccess('Classe ajoutee avec succes.');
      }
      resetForm();
      await fetchClasses();
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Erreur serveur' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClass = (classe) => {
    setSuccess('');
    setPageError('');
    setErrors({});
    setEditingClassId(classe.id);
    setFormData({
      className: classe.name || '',
      cycle: classe.cycle || '',
      niveau: classe.niveau || '',
      mensualite: classe.mensualite ?? '',
      fraisInscription: classe.frais_inscription ?? '',
      maxEffectif: classe.max_effectif ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (showPageLoading) {
    return <PageLoadingState title="Chargement des classes" message="Les classes de l'etablissement sont en cours de chargement." />;
  }

  if (pageError && classes.length === 0) {
    return (
      <PageErrorState
        title="Liste des classes indisponible"
        message={pageError}
        action={
          <button
            type="button"
            onClick={fetchClasses}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Reessayer
          </button>
        }
      />
    );
  }

  return (
    <div className="app-page space-y-6">
      <PageBanner tone="success" title={success ? 'Operation reussie' : ''} message={success} />
      <PageBanner tone="error" title={errors.submit || pageError ? 'Action impossible' : ''} message={errors.submit || (classes.length > 0 ? pageError : '')} />

      <section className="surface-card mx-auto max-w-3xl rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-900">{editingClassId ? 'Modifier une classe' : 'Nouvelle classe'}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {editingClassId ? 'Mettez a jour les informations de la classe selectionnee.' : 'Renseigne les informations pour creer une classe.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nom de classe</label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              type="text"
              name="className"
              placeholder="Ex: 6eme A, 9eme B"
              value={formData.className}
              onChange={handleChange}
              required
            />
            {errors.className && <p className="mt-1 text-sm text-red-600">{errors.className}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Cycle</label>
            <select
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              name="cycle"
              value={formData.cycle}
              onChange={handleChange}
              required
            >
              <option value="">Selectionner</option>
              <option value="Primaire">Primaire</option>
              <option value="Second Cycle">Second Cycle</option>
            </select>
            {errors.cycle && <p className="mt-1 text-sm text-red-600">{errors.cycle}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Niveau</label>
            <select
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              name="niveau"
              value={formData.niveau}
              onChange={handleChange}
              required
              disabled={!formData.cycle}
            >
              <option value="">{formData.cycle ? 'Selectionner' : "Choisir d'abord un cycle"}</option>
              {niveauOptions.map((niveau) => (
                <option key={niveau} value={niveau}>
                  {niveau}
                </option>
              ))}
            </select>
            {errors.niveau && <p className="mt-1 text-sm text-red-600">{errors.niveau}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mensualite (FCFA)</label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              type="number"
              name="mensualite"
              value={formData.mensualite}
              onChange={handleChange}
              required
            />
            {errors.mensualite && <p className="mt-1 text-sm text-red-600">{errors.mensualite}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Frais d'inscription (FCFA)</label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              type="number"
              name="fraisInscription"
              value={formData.fraisInscription}
              onChange={handleChange}
              required
            />
            {errors.fraisInscription && <p className="mt-1 text-sm text-red-600">{errors.fraisInscription}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Effectif max</label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              type="number"
              name="maxEffectif"
              value={formData.maxEffectif}
              onChange={handleChange}
              min="1"
              required
            />
            {errors.maxEffectif && <p className="mt-1 text-sm text-red-600">{errors.maxEffectif}</p>}
          </div>

          <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:justify-end">
            {editingClassId ? (
              <button
                type="button"
                onClick={resetForm}
                className="w-full rounded-2xl bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200 sm:w-auto"
              >
                Annuler la modification
              </button>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-2xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 sm:w-auto"
              disabled={loading}
            >
              {loading ? (editingClassId ? 'Modification en cours...' : 'Creation en cours...') : (editingClassId ? 'Enregistrer les modifications' : 'Creer la classe')}
            </button>
          </div>
        </form>
      </section>

      <section className="surface-card overflow-x-auto rounded-2xl p-6">
        <h2 className="text-base font-semibold">Liste des classes</h2>
        <table className="mt-4 w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Cycle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Niveau</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Mensualite</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Frais d'inscription</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Effectif max</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Effectif actuel</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {classes.map((classe) => (
              <tr key={classe.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{classe.name}</td>
                <td className="px-4 py-3 text-slate-700">{classe.cycle}</td>
                <td className="px-4 py-3 text-slate-700">{classe.niveau}</td>
                <td className="px-4 py-3 text-slate-700">{classe.mensualite}</td>
                <td className="px-4 py-3 text-slate-700">{classe.frais_inscription}</td>
                <td className="px-4 py-3 text-slate-700">{classe.max_effectif}</td>
                <td className="px-4 py-3 text-slate-700">{classe.effectif ?? 0}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleEditClass(classe)}
                    className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
