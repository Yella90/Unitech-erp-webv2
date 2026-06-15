import api from '../services/api'; // ton instance axios
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EleveForm() {
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    date_naissance: '',
    classe_actuelle_id: '',
    nomparent: '',
    contactparent: ''
  });
  const [classe, setClasse] = useState([]);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
    const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    console.log(formData);
    // Efface l'erreur du champ quand l'utilisateur tape

    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.nom.trim()) newErrors.nom = 'Le nom est requis';
    if (!formData.prenom.trim()) newErrors.prenom = 'Le prénom est requis';
    if (!formData.date_naissance) newErrors.date_naissance = 'La date de naissance est requise';
    if (!formData.classe_actuelle_id) newErrors.classe_actuelle_id = 'La classe actuelle est requise';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
   useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await api.get('/classes');
        setClasse(response.data);
        } catch (err) {
          if (err.response && err.response.status === 401) {
            console.error('Erreur API:', err.response.data);
            // Rediriger vers la page de connexion
            window.location.href = '/login';
            return;
          }
        console.error('Erreur lors du chargement des classes:', err);
      }
    };
    fetchClasses();
  }
, []);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setSuccess('');
    try {
      await api.post('/eleves', formData);
      setSuccess('Élève ajouté avec succès !');
      setFormData({ nom: '', prenom: '', date_naissance: '', classe_actuelle_id: '' });
      navigate('/eleves'); // Redirige vers la liste des élèves après ajout
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Erreur serveur' });
    } finally {
      setLoading(false);
    }
    };
    return (
    <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm max-w-4xl mx-auto">
      <h2 className="text-lg font-semibold text-slate-900">Inscrire un élève</h2>
      <p className="mt-1 text-sm text-slate-500">Toutes les données restent isolées par école.</p>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nom</label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            type="text"
            name="nom"
            value={formData.nom}
            onChange={handleChange}
            required
          />
          {errors.nom && <p className="mt-1 text-sm text-red-600">{errors.nom}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prénom</label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            type="text"
            name="prenom"
            value={formData.prenom}
            onChange={handleChange}
            required
          />
          {errors.prenom && <p className="mt-1 text-sm text-red-600">{errors.prenom}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date de naissance</label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            type="date"
            name="date_naissance"
            value={formData.date_naissance}
            onChange={handleChange}
            required
          />
          {errors.date_naissance && <p className="mt-1 text-sm text-red-600">{errors.date_naissance}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Classe</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            name="classe_actuelle_id"
            value={formData.classe_actuelle_id}
            onChange={handleChange}
            required
          >
            <option value="">Sélectionner</option>
            {classe.map((classeItem) => (
              <option key={classeItem.id} value={classeItem.id}>
                {classeItem.name}
              </option>
            ))}
          </select>
          {errors.classe_actuelle_id && <p className="mt-1 text-sm text-red-600">{errors.classe_actuelle_id}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nom du parent</label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            type="text"
            name="nomparent"
            value={formData.nomparent}
            onChange={handleChange}
          />
          {errors.nomparent && <p className="mt-1 text-sm text-red-600">{errors.nomparent}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone du parent</label>
          <input
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            type="tel"
            name="contactparent"
            value={formData.contactparent}
            onChange={handleChange}
            required
          />
          {errors.contactparent && <p className="mt-1 text-sm text-red-600">{errors.contactparent}</p>}
        </div>
        <div className="md:col-span-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate('/eleves')}
            className="bg-slate-600 text-white px-4 py-2 rounded-md hover:bg-slate-700 w-full sm:w-auto"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 w-full sm:w-auto"
            disabled={loading}
          >
            {loading ? 'Inscription en cours...' : 'Inscrire'}
          </button>
        </div>
      </form>
      {errors.submit && <p className="mt-4 text-sm text-red-600">{errors.submit}</p>}
      {success && <p className="mt-4 text-sm text-green-600">{success}</p>}
    </section>
  );
}