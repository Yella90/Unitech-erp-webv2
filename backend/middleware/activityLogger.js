const db = require('../database/db');

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_FIELDS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'photo',
  'documents',
  'document',
]);

function summarizeBody(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  return Object.keys(payload)
    .filter((key) => !SENSITIVE_FIELDS.has(key))
    .slice(0, 12);
}

function toText(value) {
  return String(value || '').trim();
}

function firstValue(...values) {
  return values.map((value) => toText(value)).find(Boolean) || '';
}

function quoted(value, fallback = '') {
  const text = toText(value) || fallback;
  return text ? `"${text}"` : '';
}

function buildActionDescription(req) {
  const path = req.path || req.originalUrl || '';
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const params = req.params || {};

  if (req.method === 'POST' && path === '/api/matieres') {
    return `Creation de la matiere ${quoted(body.nom, 'sans nom')}`;
  }
  if (req.method === 'PUT' && path.startsWith('/api/matieres/')) {
    return `Mise a jour de la matiere ${quoted(body.nom || params.id)}`;
  }
  if (req.method === 'DELETE' && path.startsWith('/api/matieres/')) {
    return `Suppression d'une matiere (${firstValue(params.id)})`;
  }
  if (req.method === 'POST' && path === '/api/classes') {
    return `Creation de la classe ${quoted(body.className || body.name, 'sans nom')}`;
  }
  if (req.method === 'PUT' && path.startsWith('/api/classes/')) {
    return `Mise a jour de la classe ${quoted(body.className || body.name || params.id)}`;
  }
  if (req.method === 'POST' && path === '/api/eleves') {
    return `Inscription de l'eleve ${quoted(`${firstValue(body.nom)} ${firstValue(body.prenom)}`.trim(), firstValue(body.matricule, body.eleve_matricule, 'sans nom'))} (${firstValue(body.matricule, body.eleve_matricule, 'sans matricule')})`;
  }
  if (req.method === 'PUT' && path.startsWith('/api/eleves/')) {
    return `Mise a jour de la fiche eleve ${quoted(`${firstValue(body.nom)} ${firstValue(body.prenom)}`.trim(), firstValue(body.matricule, params.id))}`;
  }
  if (req.method === 'PATCH' && path.includes('/deactivate')) {
    return `Desactivation de l'eleve (${firstValue(body.matricule, params.id)})`;
  }
  if (req.method === 'POST' && path === '/api/enseignants') {
    return `Creation de l'enseignant ${quoted(body.nomComplet, firstValue(body.matricule, body.matiere, 'sans nom'))}`;
  }
  if (req.method === 'PUT' && path.startsWith('/api/enseignants/')) {
    return `Mise a jour de l'enseignant ${quoted(body.nomComplet || body.matricule || params.id)}`;
  }
  if (req.method === 'PATCH' && path.startsWith('/api/enseignants/')) {
    return `Changement de statut de l'enseignant ${quoted(body.nomComplet || body.matricule || params.id)}`;
  }
  if (req.method === 'DELETE' && path.startsWith('/api/enseignants/')) {
    return `Suppression de l'enseignant (${firstValue(params.id)})`;
  }
  if (req.method === 'POST' && path === '/api/personnels') {
    return `Creation du personnel ${quoted(body.nomComplet, firstValue(body.matricule, body.poste, 'sans nom'))}`;
  }
  if (req.method === 'PUT' && path.startsWith('/api/personnels/')) {
    return `Mise a jour du personnel ${quoted(body.nomComplet || body.matricule || params.id)}`;
  }
  if (req.method === 'PATCH' && path.startsWith('/api/personnels/')) {
    return `Changement de statut du personnel ${quoted(body.nomComplet || body.matricule || params.id)}`;
  }
  if (req.method === 'DELETE' && path.startsWith('/api/personnels/')) {
    return `Suppression du personnel (${firstValue(params.id)})`;
  }
  if (req.method === 'POST' && path === '/api/affectation') {
    return `Affectation de la matiere ${quoted(body.nom_matiere, 'sans matiere')} a la classe ${quoted(body.classe_nom || body.classe_id, 'non definie')} pour l'enseignant ${quoted(body.enseignant_nom || body.enseignant_id, 'non defini')}`;
  }
  if (req.method === 'DELETE' && path.startsWith('/api/affectation/')) {
    return `Suppression d'une affectation (${firstValue(params.id)})`;
  }
  if (req.method === 'POST' && path === '/api/system/paiements') {
    return `Enregistrement du paiement de l'eleve (${firstValue(body.eleve_matricule, body.matricule, body.eleve_id)})`;
  }
  if (req.method === 'POST' && path === '/api/system/salaires') {
    return `Enregistrement du paiement du personnel (${firstValue(body.personnel_matricule, body.matricule, body.source_type)})`;
  }
  if (req.method === 'POST' && path === '/api/system/salaires/generate-monthly') {
    return `Generation automatique des salaires fixes pour ${firstValue(body.month, 'le mois courant')}`;
  }
  if (req.method === 'POST' && path === '/api/system/salaires/generate-hourly') {
    return `Generation automatique des salaires horaires pour ${firstValue(body.month, 'le mois courant')}`;
  }
  if (req.method === 'POST' && path === '/api/system/notes') {
    return `Saisie de note en ${quoted(body.matiere, 'matiere')} pour l'eleve ${firstValue(body.eleve_matricule, body.eleve_id)} au ${firstValue(body.trimestre, 'trimestre')}`;
  }
  if (req.method === 'DELETE' && path.startsWith('/api/system/notes/')) {
    return `Suppression d'une note (${firstValue(params.id)})`;
  }
  if (req.method === 'POST' && path === '/api/system/trimestres') {
    return `Creation du trimestre ${quoted(body.label || body.code, 'sans libelle')}`;
  }
  if (req.method === 'PUT' && path.startsWith('/api/system/trimestres/')) {
    return `Mise a jour du trimestre ${quoted(body.label || body.code || params.id)}`;
  }
  if (req.method === 'POST' && path === '/api/system/emplois') {
    return `Creation d'un creneau d'emploi du temps le ${firstValue(body.jour)} de ${firstValue(body.heure_debut)} a ${firstValue(body.heure_fin, '--')}`;
  }
  if (req.method === 'POST' && path === '/api/system/attendance/sheet') {
    return `Enregistrement de l'appel quotidien du ${firstValue(body.date)} pour la classe ${firstValue(body.classe_nom, body.classe_id)}`;
  }
  if (req.method === 'PUT' && path.startsWith('/api/system/emplois/')) {
    return `Mise a jour d'un creneau d'emploi du temps (${firstValue(params.id)})`;
  }
  if (req.method === 'POST' && path === '/api/system/depenses') {
    return `Enregistrement d'une depense pour ${quoted(body.motif || body.categorie, firstValue(body.montant))}`;
  }
  if (req.method === 'POST' && path === '/api/system/retraits') {
    return `Enregistrement d'un retrait promoteur pour ${quoted(body.motif, firstValue(body.montant))}`;
  }
  if (req.method === 'POST' && path === '/api/system/setup/classes') {
    return `Creation de la classe ${quoted(body.nom || body.className, 'sans nom')} depuis le setup rapide`;
  }
  if (req.method === 'POST' && path === '/api/system/setup/eleves/manual') {
    return `Ajout manuel d'un eleve ${quoted(`${firstValue(body.nom)} ${firstValue(body.prenom)}`.trim(), firstValue(body.matricule, 'sans nom'))} depuis le setup rapide`;
  }
  if (req.method === 'POST' && path === '/api/system/setup/eleves/commit') {
    return `Import d'eleves depuis le setup rapide`;
  }
  return '';
}

function activityLogger(req, res, next) {
  res.on('finish', () => {
    if (!MUTATION_METHODS.has(req.method)) return;
    if (!req.user?.id || !req.user?.school_id) return;
    if (req.originalUrl.startsWith('/api/auth/')) return;
    if (res.statusCode >= 400) return;

    const details = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      params: req.params || {},
      query: req.query || {},
      bodyFields: summarizeBody(req.body),
      description: buildActionDescription(req),
      ip: req.ip || req.socket?.remoteAddress || '',
      userAgent: req.get('user-agent') || '',
    };

    db.run(
      'INSERT INTO activity_logs (actor_user_id, school_id, action, details) VALUES (?, ?, ?, ?)',
      [req.user.id, req.user.school_id, 'api_write', JSON.stringify(details)],
      (error) => {
        if (error) {
          console.error('Erreur journalisation action API:', error);
        }
      }
    );
  });

  next();
}

module.exports = activityLogger;
