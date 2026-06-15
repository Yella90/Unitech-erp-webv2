import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

const initialFormData = {
  nomComplet: '',
  email: '',
  telephone: '',
  matiere: '',
  typePayement: 'salaire',
  statut: 'actif',
  salaire: '',
  tauxHoraire: '',
};

function formatMoney(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('fr-FR')} F`;
}

function formatTeacherRate(enseignant) {
  if (enseignant.typePayement === 'tauxHoraire') {
    return enseignant.tauxHoraire ? `${Number(enseignant.tauxHoraire).toLocaleString('fr-FR')} F / h` : '-';
  }
  return enseignant.salaire ? formatMoney(enseignant.salaire) : '-';
}

function Administration() {
  const [school, setSchool] = useState(null);
  const [schoolYears, setSchoolYears] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [yearSaving, setYearSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [schoolYearForm, setSchoolYearForm] = useState({
    label: '',
    start_date: '',
    end_date: '',
    is_active: true,
  });
  const showLoading = usePageLoadingVisibility(loading);

  const loadPageData = async () => {
    setLoading(true);
    setError('');

    try {
      const [schoolResponse, schoolYearsResponse, enseignantsResponse, utilisateursResponse, matieresResponse] = await Promise.all([
        api.get('/auth/me'),
        api.get('/system/school-years'),
        api.get('/enseignants'),
        api.get('/administrateur/utilisateurs'),
        api.get('/matieres'),
      ]);

      setSchool(schoolResponse.data || null);
      setSchoolYears(schoolYearsResponse.data || []);
      setEnseignants(enseignantsResponse.data || []);
      setUtilisateurs(utilisateursResponse.data || []);
      setMatieres(matieresResponse.data || []);
    } catch (err) {
      console.error("Erreur chargement administration:", err);
      if (err?.response?.status === 401) {
        window.location.href = '/login';
        return;
      }
      setError("Impossible de charger la page d'administration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const stats = useMemo(() => {
    const totalActifs = enseignants.filter((item) => item.statut === 'actif').length;
    const totalSalaire = enseignants.filter((item) => item.typePayement === 'salaire').length;
    const totalHoraire = enseignants.filter((item) => item.typePayement === 'tauxHoraire').length;

    return [
      { label: 'Enseignants', value: enseignants.length, tone: 'text-slate-900' },
      { label: 'Actifs', value: totalActifs, tone: 'text-emerald-600' },
      { label: 'Au salaire', value: totalSalaire, tone: 'text-indigo-600' },
      { label: 'Taux horaire', value: totalHoraire, tone: 'text-amber-600' },
      { label: 'Utilisateurs', value: utilisateurs.length, tone: 'text-sky-600' },
    ];
  }, [enseignants, utilisateurs]);

  const filteredEnseignants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return enseignants;

    return enseignants.filter((enseignant) =>
      [enseignant.nomComplet, enseignant.email, enseignant.telephone, enseignant.matiere, enseignant.matricule]
        .some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [enseignants, search]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'typePayement') {
        if (value === 'salaire') next.tauxHoraire = '';
        if (value === 'tauxHoraire') next.salaire = '';
      }
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.nomComplet || !formData.email || !formData.telephone || !formData.matiere) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (formData.typePayement === 'salaire' && !formData.salaire) {
      setError('Le salaire est obligatoire pour ce type de paiement.');
      return;
    }

    if (formData.typePayement === 'tauxHoraire' && !formData.tauxHoraire) {
      setError("Le taux horaire est obligatoire pour ce type de paiement.");
      return;
    }

    setSaving(true);
    try {
      await api.post('/enseignants', {
        ...formData,
        salaire: formData.typePayement === 'salaire' ? Number(formData.salaire) : null,
        tauxHoraire: formData.typePayement === 'tauxHoraire' ? Number(formData.tauxHoraire) : null,
      });

      setFormData(initialFormData);
      setSuccess('Enseignant ajoute avec succes.');
      await loadPageData();
    } catch (err) {
      console.error("Erreur ajout enseignant:", err);
      if (err?.response?.status === 401) {
        window.location.href = '/login';
        return;
      }
      setError(err?.response?.data?.error || "Erreur lors de l'ajout de l'enseignant.");
    } finally {
      setSaving(false);
    }
  };

  const handleSchoolYearSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!schoolYearForm.label) {
      setError("Le libelle de l'annee scolaire est obligatoire.");
      return;
    }

    setYearSaving(true);
    try {
      await api.post('/system/school-years', schoolYearForm);
      setSchoolYearForm({
        label: '',
        start_date: '',
        end_date: '',
        is_active: true,
      });
      setSuccess('Annee scolaire enregistree avec succes.');
      await loadPageData();
    } catch (err) {
      console.error("Erreur enregistrement annee scolaire:", err);
      setError(err?.response?.data?.error || "Impossible d'enregistrer l'annee scolaire.");
    } finally {
      setYearSaving(false);
    }
  };

  if (showLoading) {
    return <PageLoadingState title="Chargement de l'administration" message="Les donnees administratives sont en cours de chargement." />;
  }

  if (error && !enseignants.length && !utilisateurs.length) {
    return (
      <PageErrorState
        title="Administration indisponible"
        message={error}
        action={(
          <button
            type="button"
            onClick={loadPageData}
            className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Reessayer
          </button>
        )}
      />
    );
  }

  return (
    <section className="app-page space-y-5">
      <PageBanner tone="success" title={success ? 'Operation reussie' : ''} message={success} />
      <PageBanner tone="error" title={error && (enseignants.length > 0 || utilisateurs.length > 0) ? 'Action impossible' : ''} message={enseignants.length > 0 || utilisateurs.length > 0 ? error : ''} />

      <div className="surface-card premium-card rounded-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Administration academique</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Centre de gestion classique</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Retrouvez la logique de l&apos;ancienne version: informations de l&apos;etablissement, annee scolaire,
            enseignants et utilisateurs sur une meme page d&apos;administration.
          </p>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="premium-card rounded-2xl border border-slate-200 bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
              <p className={`mt-3 text-3xl font-bold ${stat.tone}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="surface-card premium-card rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-slate-900">Administration academique</h2>
          <p className="mt-1 text-sm text-slate-500">Informations principales de l&apos;etablissement, dans l&apos;esprit de l&apos;ancienne page.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nom ecole</label>
              <div className="premium-card rounded-2xl border border-slate-300 bg-white/80 px-3 py-2 text-slate-700">{school?.name || '-'}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <div className="premium-card rounded-2xl border border-slate-300 bg-white/80 px-3 py-2 text-slate-700">{school?.email || '-'}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Telephone</label>
              <div className="premium-card rounded-2xl border border-slate-300 bg-white/80 px-3 py-2 text-slate-700">{school?.phone || '-'}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Adresse</label>
              <div className="premium-card rounded-2xl border border-slate-300 bg-white/80 px-3 py-2 text-slate-700">{school?.address || '-'}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Plan</label>
              <div className="premium-card rounded-2xl border border-slate-300 bg-white/80 px-3 py-2 text-slate-700">{school?.plan || '-'}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Facturation</label>
              <div className="premium-card rounded-2xl border border-slate-300 bg-white/80 px-3 py-2 text-slate-700">{school?.billing || '-'}</div>
            </div>
          </div>

          
        </div>

        <div className="surface-card rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-slate-900">Annee scolaire</h2>
          <p className="mt-1 text-sm text-slate-500">Gestion simple de l&apos;annee scolaire active.</p>

          <form onSubmit={handleSchoolYearSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Libelle</label>
              <input
                className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                value={schoolYearForm.label}
                onChange={(event) => setSchoolYearForm((prev) => ({ ...prev, label: event.target.value }))}
                placeholder="Ex: 2026-2027"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date de debut</label>
              <input
                type="date"
                className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                value={schoolYearForm.start_date}
                onChange={(event) => setSchoolYearForm((prev) => ({ ...prev, start_date: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date de fin</label>
              <input
                type="date"
                className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                value={schoolYearForm.end_date}
                onChange={(event) => setSchoolYearForm((prev) => ({ ...prev, end_date: event.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={schoolYearForm.is_active}
                onChange={(event) => setSchoolYearForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              Definir comme annee active
            </label>
            <button
              type="submit"
              disabled={yearSaving}
              className="premium-action w-full rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {yearSaving ? 'Enregistrement...' : 'Enregistrer annee scolaire'}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-800">Annees enregistrees</p>
            <div className="mt-3 space-y-2">
              {schoolYears.length ? (
                schoolYears.slice(0, 5).map((year) => (
                  <div key={year.id} className="premium-card flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{year.label}</p>
                      <p className="text-xs text-slate-500">
                        {year.start_date || '-'} au {year.end_date || '-'}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${year.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                      {year.is_active ? 'Active' : 'Archivee'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Aucune annee scolaire disponible.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-card premium-card rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Nouvel enseignant</h2>
              <p className="mt-1 text-sm text-slate-500">Le matricule est genere automatiquement a la creation.</p>
            </div>
            <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Formulaire rapide
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Nom complet</label>
              <input
                className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                name="nomComplet"
                value={formData.nomComplet}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Telephone</label>
              <input
                className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                name="telephone"
                value={formData.telephone}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Matiere</label>
              <select
                className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                name="matiere"
                value={formData.matiere}
                onChange={handleChange}
                required
              >
                <option value="">Selectionner une matiere</option>
                {matieres.map((matiere) => (
                  <option key={matiere.id || matiere.nom} value={matiere.nom}>
                    {matiere.nom}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type de paiement</label>
              <select
                className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                name="typePayement"
                value={formData.typePayement}
                onChange={handleChange}
              >
                <option value="salaire">Salaire mensuel</option>
                <option value="tauxHoraire">Taux horaire</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Salaire</label>
              <input
                className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-100"
                type="number"
                min="0"
                name="salaire"
                value={formData.salaire}
                onChange={handleChange}
                disabled={formData.typePayement !== 'salaire'}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Taux horaire</label>
              <input
                className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-100"
                type="number"
                min="0"
                name="tauxHoraire"
                value={formData.tauxHoraire}
                onChange={handleChange}
                disabled={formData.typePayement !== 'tauxHoraire'}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Statut</label>
              <select
                className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                name="statut"
                value={formData.statut}
                onChange={handleChange}
              >
                <option value="actif">Actif</option>
                <option value="suspendu">Suspendu</option>
              </select>
            </div>

            <div className="md:col-span-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setFormData(initialFormData)}
                className="premium-action rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reinitialiser
              </button>
              <button
                type="submit"
                disabled={saving}
                className="premium-action rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'Enregistrement...' : 'Ajouter enseignant'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-5">
          <div className="surface-card premium-card rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-slate-900">Utilisateurs et roles</h2>
            <p className="mt-1 text-sm text-slate-500">Apercu des comptes disponibles dans l&apos;espace d&apos;administration.</p>
            <div className="mt-4 space-y-3">
              {utilisateurs.length ? (
                utilisateurs.slice(0, 5).map((user) => (
                  <div key={user.id} className="premium-card flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-800">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                      {user.role || 'user'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Aucun utilisateur a afficher pour le moment.
                </div>
              )}
            </div>
          </div>

          <div className="surface-card premium-card rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-slate-900">Rappel administratif</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p className="rounded-2xl bg-slate-50 px-4 py-3">Les enseignants ajoutes ici sont immediatement disponibles dans les modules emplois du temps, profils et notes.</p>
              <p className="rounded-2xl bg-slate-50 px-4 py-3">Si aucune matiere n&apos;apparait dans la liste, ajoutez-la d&apos;abord dans la section Matieres.</p>
            
            </div>
          </div>
        </div>
      </div>

      <div className="surface-card premium-card rounded-2xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Liste des enseignants</h2>
            <p className="mt-1 text-sm text-slate-500">Consultez rapidement les affectations et types de paiement.</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un enseignant..."
          className="premium-control w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:w-72"
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nom complet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Matiere</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Telephone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Paiement</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Montant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEnseignants.length ? (
                filteredEnseignants.map((enseignant) => (
                  <tr key={enseignant.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800">
                      <div className="font-medium">{enseignant.nomComplet || '-'}</div>
                      <div className="text-xs text-slate-500">{enseignant.matricule || 'Matricule auto'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{enseignant.matiere || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{enseignant.email || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{enseignant.telephone || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{enseignant.typePayement || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatTeacherRate(enseignant)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          enseignant.statut === 'actif'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {enseignant.statut || '-'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-sm text-slate-500">
                    Aucun enseignant ne correspond a votre recherche.
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

export default Administration;
