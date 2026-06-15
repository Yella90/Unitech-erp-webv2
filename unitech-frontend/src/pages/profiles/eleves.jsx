import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../../components/PageState';
import {
  AcademicCapIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  PhoneIcon,
  PrinterIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const emptyStudentData = {
  nom: '',
  prenom: '',
  matricule: '',
  sexe: '',
  dateNaissance: '',
  age: '',
  classeActuelleId: '',
  classe: '',
  serie: '',
  numeroTable: '',
  nationalite: '',
  adresse: '',
  telephone: '',
  email: '',
  statut: 'actif',
  dateInscription: '',
  anneeScolaire: '',
  photo: '',
  classeActuelle: '',
  ancienneClasse: '',
  niveauEtude: '',
  etablissementPrecedent: '',
  redoublant: '',
  option: '',
  groupePedagogique: '',
  professeurPrincipal: '',
  tuteur: '',
  lienTuteur: '',
  adresseTuteur: '',
  telephoneTuteur: '',
  contactUrgence: '',
  emailTuteur: '',
  fraisTotal: '',
  montantPaye: '',
  resteAPayer: '',
  reduction: '',
  etatPaiement: '',
  exonereFraisInscription: false,
  dernierPaiement: '',
  mensualiteClasse: '',
  moisCouverts: '',
  totalVerse: '',
  totalVerseHorsInscription: '',
  moyenneGenerale: '',
  rangEleve: '',
  nombreMatieres: '',
  notesMatieres: '',
  appreciations: '',
  nombreAbsences: '',
  absencesJustifiees: '',
  absencesNonJustifiees: '',
  retards: '',
  sanctions: '',
  comportement: '',
  documents: '',
};

const tabs = [
  { id: 'general', label: 'General', icon: UserIcon },
  { id: 'scolaire', label: 'Scolaire', icon: AcademicCapIcon },
  { id: 'parents', label: 'Parents', icon: PhoneIcon },
  { id: 'finances', label: 'Finances', icon: CurrencyDollarIcon },
  { id: 'resultats', label: 'Resultats', icon: ChartBarIcon },
  { id: 'presence', label: 'Presence', icon: ClockIcon },
  { id: 'documents', label: 'Documents', icon: DocumentTextIcon },
];

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().split('T')[0];
}

function displayDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR');
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`;
}

function displayMoney(value) {
  return `${Number(value || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`;
}

function sanitizeFileName(value) {
  return String(value || 'profil')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function computeAge(dateValue) {
  if (!dateValue) return '';
  const birth = new Date(dateValue);
  if (Number.isNaN(birth.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());

  if (!hasBirthdayPassed) age--;
  return age;
}

function countMonthsBetweenInclusive(startValue, endValue) {
  if (!startValue || !endValue) return 0;
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const startMonth = start.getFullYear() * 12 + start.getMonth();
  const endMonth = end.getFullYear() * 12 + end.getMonth();
  return Math.max(endMonth - startMonth + 1, 1);
}
function parseObjectText(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function parseArrayText(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function objectToText(value) {
  const parsed = parseObjectText(value);
  return Object.keys(parsed).length ? JSON.stringify(parsed, null, 2) : '';
}

function arrayToText(value) {
  const parsed = parseArrayText(value);
  return parsed.length ? JSON.stringify(parsed, null, 2) : '';
}

function classNameFromId(classes, classId) {
  const classe = classes.find((item) => Number(item.id) === Number(classId));
  return classe?.name || '';
}
function classCycleFromId(classes, classId) {
  const classe = classes.find((item) => Number(item.id) === Number(classId));
  return classe?.cycle || '';
}

function classMonthlyFeeFromId(classes, classId) {
  const classe = classes.find((item) => Number(item.id) === Number(classId));
  return Number(classe?.mensualite || 0);
}

function computeFinanceFromPayments(record, classes, payments) {
  const classeMensualite = Number(record?.mensualite_classe ?? classMonthlyFeeFromId(classes, record?.classe_actuelle_id) ?? 0);
  const studentPayments = (payments || []).filter((item) => Number(item.eleve_id) === Number(record?.id));
  const totalVerse = studentPayments.reduce((sum, item) => sum + Number(item.montant || 0), 0);
  const totalVerseHorsInscription = studentPayments
    .filter((item) => String(item.mois || '').toLowerCase() !== 'inscription')
    .reduce((sum, item) => sum + Number(item.montant || 0), 0);
  const dateDebut = record?.date_inscription || record?.created_at;
  const moisAttendus = countMonthsBetweenInclusive(dateDebut, new Date());
  const reduction = Number(record?.reduction || 0);
  const mensualitesDues = classeMensualite * moisAttendus;
  const mensualitesNettes = Math.max(mensualitesDues - reduction, 0);
  const resteAPayer = Math.max(mensualitesNettes - totalVerseHorsInscription, 0);
  const dernierPaiement = studentPayments
    .map((item) => item.date_payement || item.created_at || '')
    .filter(Boolean)
    .sort()
    .at(-1) || record?.dernier_paiement_calcule || record?.dernier_paiement || '';

  return {
    montantPaye: record?.total_verse ?? record?.montant_paye ?? totalVerse,
    totalVerse: record?.total_verse ?? totalVerse,
    totalVerseHorsInscription: record?.total_verse_hors_inscription ?? totalVerseHorsInscription,
    mensualiteClasse: record?.mensualite_classe ?? classeMensualite,
    moisCouverts: record?.mois_couverts ?? (classeMensualite > 0 ? Math.floor(totalVerseHorsInscription / classeMensualite) : 0),
    resteAPayer,
    etatPaiement:
      record?.etat_paiement ||
      (mensualitesNettes <= 0 ? 'paye' : totalVerseHorsInscription <= 0 ? 'non paye' : resteAPayer > 0 ? 'partiel' : 'paye'),
    dernierPaiement,
  };
}

function profileFromRecord(record, classes) {
  if (!record) return emptyStudentData;

  const classeName = classNameFromId(classes, record.classe_actuelle_id);
  const age = computeAge(record.date_naissance);

  return {
    
    nom: record.nom || '',
    prenom: record.prenom || '',
    matricule: record.matricule || '',
    sexe: record.sexe || '',
    dateNaissance: formatDate(record.date_naissance),
    age,
    classeActuelleId: record.classe_actuelle_id || '',
    classe: classeName,
    serie: record.serie || '',
    numeroTable: record.numero_table || '',
    nationalite: record.nationalite || '',
    adresse: record.adresse || '',
    telephone: record.telephone || '',
    email: record.email || '',
    statut: record.statut || 'actif',
    dateInscription: formatDate(record.date_inscription || record.created_at),
    anneeScolaire: record.annee_scolaire_id || '',
    photo: record.photo || 'https://via.placeholder.com/160x160?text=Eleve',
    classeActuelle: classeName,
    ancienneClasse: record.classe_precedente || '',
    niveauEtude: record.niveau_etude || '',
    etablissementPrecedent: record.etablissement_precedent || '',
    redoublant: record.redoublant || '',
    option: record.option_etude || '',
    groupePedagogique: record.groupe_pedagogique || '',
    professeurPrincipal: record.professeur_principal || '',
    tuteur: record.nom_parent || '',
    lienTuteur: record.lien_tuteur || '',
    adresseTuteur: record.adresse_tuteur || '',
    telephoneTuteur: record.telephone_parent || '',
    contactUrgence: record.contact_urgence || '',
    emailTuteur: record.email_parent || '',
    fraisTotal: record.frais_total ?? '',
    montantPaye: record.total_verse ?? record.montant_paye ?? '',
    resteAPayer: record.reste_a_payer ?? '',
    reduction: record.reduction ?? '',
    etatPaiement: record.etat_paiement || '',
    exonereFraisInscription: Number(record.exonere_frais_inscription || 0) === 1,
    dernierPaiement: formatDate(record.dernier_paiement_calcule || record.dernier_paiement),
    mensualiteClasse: record.mensualite_classe ?? '',
    moisCouverts: record.mois_couverts ?? '',
    totalVerse: record.total_verse ?? record.montant_paye ?? '',
    totalVerseHorsInscription: record.total_verse_hors_inscription ?? '',
    moyenneGenerale: record.moyenne_generale ?? '',
    rangEleve: record.rang_eleve ?? '',
    nombreMatieres: record.nombre_matieres ?? '',
    notesMatieres: objectToText(record.notes_matieres),
    appreciations: record.appreciations || '',
    nombreAbsences: record.nombre_absences ?? '',
    absencesJustifiees: record.absences_justifiees ?? '',
    absencesNonJustifiees: record.absences_non_justifiees ?? '',
    retards: record.retards ?? '',
    sanctions: record.sanctions || '',
    comportement: record.comportement || '',
    documents: arrayToText(record.documents),
  };
}

function profileFromRecordWithPayments(record, classes, payments) {
  const baseProfile = profileFromRecord(record, classes);
  const finance = computeFinanceFromPayments(record, classes, payments);

  return {
    ...baseProfile,
    montantPaye: finance.montantPaye,
    resteAPayer: finance.resteAPayer,
    etatPaiement: finance.etatPaiement,
    dernierPaiement: formatDate(finance.dernierPaiement),
    mensualiteClasse: finance.mensualiteClasse,
    moisCouverts: finance.moisCouverts,
    totalVerse: finance.totalVerse,
    totalVerseHorsInscription: finance.totalVerseHorsInscription,
  };
}

function parseJsonOrFallback(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildPayload(studentData, classes) {
  return {
    nom: studentData.nom,
    prenom: studentData.prenom,
    matricule: studentData.matricule,
    sexe: studentData.sexe,
    date_naissance: studentData.dateNaissance || null,
    classe_actuelle_id: studentData.classeActuelleId || null,
    serie: studentData.serie,
    numero_table: studentData.numeroTable,
    nationalite: studentData.nationalite,
    adresse: studentData.adresse,
    telephone: studentData.telephone,
    email: studentData.email,
    statut: studentData.statut,
    date_inscription: studentData.dateInscription || null,
    annee_scolaire_id: studentData.anneeScolaire || null,
    photo: studentData.photo,
    classe_precedente: studentData.ancienneClasse,
    niveau_etude: classCycleFromId(classes,studentData.classeActuelleId) ,
    etablissement_precedent: studentData.etablissementPrecedent,
    redoublant: studentData.redoublant,
    option_etude: studentData.option,
    groupe_pedagogique: studentData.groupePedagogique,
    professeur_principal: studentData.professeurPrincipal,
    nom_parent: studentData.tuteur,
    lien_tuteur: studentData.lienTuteur,
    adresse_tuteur: studentData.adresseTuteur,
    telephone_parent: studentData.telephoneTuteur,
    contact_urgence: studentData.contactUrgence,
    email_parent: studentData.emailTuteur,
    frais_total: studentData.fraisTotal || null,
    montant_paye: studentData.montantPaye || null,
    reste_a_payer: studentData.resteAPayer || null,
    reduction: studentData.reduction || null,
    etat_paiement: studentData.etatPaiement,
    dernier_paiement: studentData.dernierPaiement || null,
    moyenne_generale: studentData.moyenneGenerale || null,
    rang_eleve: studentData.rangEleve || null,
    nombre_matieres: studentData.nombreMatieres || null,
    notes_matieres: parseJsonOrFallback(studentData.notesMatieres, {}),
    appreciations: studentData.appreciations,
    nombre_absences: studentData.nombreAbsences || null,
    absences_justifiees: studentData.absencesJustifiees || null,
    absences_non_justifiees: studentData.absencesNonJustifiees || null,
    retards: studentData.retards || null,
    sanctions: studentData.sanctions,
    comportement: studentData.comportement,
    documents: parseJsonOrFallback(studentData.documents, []),
  };
}

function Field({ label, value, field, editMode, onChange, type = 'text', textarea = false, selectOptions = null }) {
  const displayValue = value === '' || value === null || value === undefined ? '-' : value;

  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {editMode ? (
        selectOptions ? (
          <select
            value={value ?? ''}
            onChange={(e) => onChange(field, e.target.value)}
            className="premium-control w-full rounded-2xl border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {selectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : textarea ? (
          <textarea
            value={value ?? ''}
            onChange={(e) => onChange(field, e.target.value)}
            rows={5}
            className="premium-control w-full rounded-2xl border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        ) : (
          <input
            type={type}
            value={value ?? ''}
            onChange={(e) => onChange(field, e.target.value)}
            className="premium-control w-full rounded-2xl border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        )
      ) : (
        <p className="min-h-[42px] rounded-2xl bg-gray-50 px-3 py-2 text-gray-700">{displayValue}</p>
      )}
    </div>
  );
}

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="surface-card premium-card mb-6 rounded-2xl p-6">
    <div className="mb-4 flex items-center border-b-2 border-gray-200 pb-3">
      <Icon className="mr-3 h-6 w-6 text-blue-600" />
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    </div>
    {children}
  </div>
);

function ProfilEleve() {
  const location = useLocation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [record, setRecord] = useState(null);
  const [studentData, setStudentData] = useState(emptyStudentData);
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({ absences: 0, retards: 0, justifiees: 0, nonJustifiees: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const showLoading = usePageLoadingVisibility(loading);
  const currentSchoolYear = new URLSearchParams(location.search).get('annee') || '';

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setPageError('');
      try {
        const [classesResponse, eleveResponse, paiementsResponse, authResponse, attendanceResponse] = await Promise.all([
          api.get('/classes'),
          api.get(`/eleves/${id}`),
          api.get('/system/paiements'),
          api.get('/auth/me'),
          api.get(`/system/attendance/history/${id}`).catch(() => null),
        ]);
        const classesData = classesResponse.data || [];
        const eleveData = eleveResponse.data;
        const paiementsData = paiementsResponse.data || [];
        setClasses(classesData);
        setPayments(paiementsData);
        setRecord(eleveData);
        setSchoolInfo(authResponse.data || null);
        setAttendanceHistory(attendanceResponse?.data?.rows || []);
        setAttendanceSummary(attendanceResponse?.data?.summary || { absences: 0, retards: 0, justifiees: 0, nonJustifiees: 0 });
        setStudentData(profileFromRecordWithPayments(eleveData, classesData, paiementsData));
      } catch (error) {
        console.error('Erreur chargement profil eleve:', error);
        setPageError(error.response?.data?.error || "Impossible de charger le profil de l'eleve.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const financeStats = useMemo(() => ({
    fraisTotal: formatMoney(studentData.fraisTotal),
    montantPaye: formatMoney(studentData.montantPaye),
    resteAPayer: formatMoney(studentData.resteAPayer),
    reduction: formatMoney(studentData.reduction),
    mensualiteClasse: formatMoney(studentData.mensualiteClasse),
    totalVerseHorsInscription: formatMoney(studentData.totalVerseHorsInscription),
    moisCouverts: Number(studentData.moisCouverts || 0),
  }), [studentData]);
  const inscriptionWaived = Boolean(studentData.exonereFraisInscription);

  const studentPayments = useMemo(
    () => payments.filter((item) => Number(item.eleve_id) === Number(id)),
    [payments, id]
  );

  const exportAttendanceHistoryPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const fullName = `${studentData.prenom} ${studentData.nom}`.trim();

    doc.setFillColor(30, 58, 138);
    doc.roundedRect(12, 10, pageWidth - 24, 26, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('Historique des absences', 18, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Genere le ${displayDate(new Date().toISOString())}`, pageWidth - 18, 22, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(fullName || 'Eleve', 18, 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Matricule: ${studentData.matricule || '-'}`, 18, 55);
    doc.text(`Classe: ${studentData.classeActuelle || '-'}`, 18, 61);
    doc.text(`Annee scolaire: ${studentData.anneeScolaire || '-'}`, 18, 67);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(pageWidth - 82, 48, 70, 40, 3, 3, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Synthese absences', pageWidth - 77, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(`Absences: ${attendanceSummary.absences || 0}`, pageWidth - 77, 61);
    doc.text(`Retards: ${attendanceSummary.retards || 0}`, pageWidth - 77, 67);
    doc.text(`Justifiees: ${attendanceSummary.justifiees || 0}`, pageWidth - 77, 73);
    doc.text(`Non justifiees: ${attendanceSummary.nonJustifiees || 0}`, pageWidth - 77, 79);

    autoTable(doc, {
      startY: 94,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
      head: [['Date', 'Type', 'Justifie', 'Duree', 'Motif']],
      body: attendanceHistory.length
        ? attendanceHistory.map((item) => [
            displayDate(item.date),
            item.type === 'retard' ? 'Retard' : 'Absence',
            Number(item.justifie || 0) === 1 ? 'Oui' : 'Non',
            item.duree_minutes ? `${item.duree_minutes} min` : '-',
            item.motif || '-',
          ])
        : [['-', '-', '-', '-', 'Aucune absence enregistree']],
    });

    doc.save(`${sanitizeFileName(studentData.prenom)}-${sanitizeFileName(studentData.nom)}-absences.pdf`);
  };

  const handleDownloadProfilePdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const fullName = `${studentData.prenom} ${studentData.nom}`.trim();

    doc.setFillColor(30, 58, 138);
    doc.roundedRect(12, 10, pageWidth - 24, 26, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text("Fiche d'informations eleve", 18, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Genere le ${displayDate(new Date().toISOString())}`, pageWidth - 18, 22, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(fullName || 'Eleve', 18, 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Matricule: ${studentData.matricule || '-'}`, 18, 55);
    doc.text(`Classe: ${studentData.classeActuelle || '-'}`, 18, 61);
    doc.text(`Statut: ${studentData.statut || '-'}`, 18, 67);
    doc.text(`Frais d'inscription: ${inscriptionWaived ? 'Exonere' : 'Applique'}`, 18, 73);

    if (studentData.photo && String(studentData.photo).startsWith('data:image/')) {
      try {
        const imageFormat = String(studentData.photo).includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(studentData.photo, imageFormat, pageWidth - 42, 44, 24, 24);
      } catch (imageError) {
        console.error("Erreur ajout photo profil eleve au PDF:", imageError);
      }
    }

    autoTable(doc, {
      startY: 82,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5, textColor: [15, 23, 42] },
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
      body: [
        [{ content: 'Informations generales', colSpan: 2, styles: { fontStyle: 'bold' } }],
        ['Nom complet', fullName || '-'],
        ['Matricule', studentData.matricule || '-'],
        ['Sexe', studentData.sexe || '-'],
        ['Date de naissance', displayDate(studentData.dateNaissance)],
        ['Age', studentData.age || '-'],
        ['Classe', studentData.classeActuelle || '-'],
        ['Serie', studentData.serie || '-'],
        ['Nationalite', studentData.nationalite || '-'],
        ['Adresse', studentData.adresse || '-'],
        ['Telephone', studentData.telephone || '-'],
        ['Email', studentData.email || '-'],
        ['Date inscription', displayDate(studentData.dateInscription)],
        [{ content: 'Parents et tuteurs', colSpan: 2, styles: { fontStyle: 'bold' } }],
        ['Nom du tuteur', studentData.tuteur || '-'],
        ['Lien tuteur', studentData.lienTuteur || '-'],
        ['Telephone tuteur', studentData.telephoneTuteur || '-'],
        ['Email tuteur', studentData.emailTuteur || '-'],
        ['Adresse tuteur', studentData.adresseTuteur || '-'],
        ['Contact urgence', studentData.contactUrgence || '-'],
        [{ content: 'Finance et scolarite', colSpan: 2, styles: { fontStyle: 'bold' } }],
        ['Frais total', displayMoney(studentData.fraisTotal)],
        ['Montant paye', displayMoney(studentData.montantPaye)],
        ['Reste a payer', displayMoney(studentData.resteAPayer)],
        ['Reduction', displayMoney(studentData.reduction)],
        ['Etat paiement', studentData.etatPaiement || '-'],
        ['Exonere frais inscription', inscriptionWaived ? 'Oui' : 'Non'],
        ['Dernier paiement', displayDate(studentData.dernierPaiement)],
        ['Mois couverts', String(studentData.moisCouverts || 0)],
      ],
    });

    doc.save(`${sanitizeFileName(studentData.prenom)}-${sanitizeFileName(studentData.nom)}-profil.pdf`);
  };

  const handleDownloadPaymentPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const fullName = `${studentData.prenom} ${studentData.nom}`.trim();

    doc.setFillColor(5, 150, 105);
    doc.roundedRect(12, 10, pageWidth - 24, 26, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('Bulletin de versement eleve', 18, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Genere le ${displayDate(new Date().toISOString())}`, pageWidth - 18, 22, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    if (studentData.photo && String(studentData.photo).startsWith('data:image/')) {
      try {
        const imageFormat = String(studentData.photo).includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(studentData.photo, imageFormat, 18, 46, 22, 22);
      } catch (imageError) {
        console.error("Erreur ajout photo eleve au bulletin de versement:", imageError);
      }
    }
    doc.text(fullName || 'Eleve', 44, 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Matricule: ${studentData.matricule || '-'}`, 44, 55);
    doc.text(`Classe: ${studentData.classeActuelle || '-'}`, 44, 61);
    doc.text(`Telephone eleve: ${studentData.telephone || '-'}`, 44, 67);
    doc.text(`Email eleve: ${studentData.email || '-'}`, 44, 73);
    doc.text(`Telephone parent: ${studentData.telephoneTuteur || '-'}`, 44, 79);
    doc.text(`Email parent: ${studentData.emailTuteur || '-'}`, 44, 85);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(pageWidth - 82, 48, 70, 40, 3, 3, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Contact etablissement', pageWidth - 77, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolInfo?.name || '-', pageWidth - 77, 61);
    doc.text(`Tel: ${schoolInfo?.phone || '-'}`, pageWidth - 77, 67);
    doc.text(`Email: ${schoolInfo?.email || '-'}`, pageWidth - 77, 73);
    doc.text(`Adresse: ${schoolInfo?.address || '-'}`, pageWidth - 77, 79);

    autoTable(doc, {
      startY: 94,
      head: [['Date', 'Mois', 'Mode', 'Description', 'Montant']],
      body: studentPayments.length
        ? studentPayments.map((item) => [
            displayDate(item.date_payement || item.created_at),
            item.mois || '-',
            item.mode_payement || '-',
            item.description || '-',
            displayMoney(item.montant),
          ])
        : [['-', '-', '-', 'Aucun versement enregistre', '-']],
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42] },
      headStyles: { fillColor: [220, 252, 231], textColor: [6, 78, 59], fontStyle: 'bold' },
    });

    const finalY = doc.lastAutoTable?.finalY || 94;
    doc.setFontSize(10);
    doc.text(`Total verse: ${displayMoney(studentData.montantPaye)}`, 14, finalY + 10);
    doc.text(`Reste a payer: ${displayMoney(studentData.resteAPayer)}`, 14, finalY + 16);
    doc.text(`Etat de paiement: ${studentData.etatPaiement || '-'}`, 14, finalY + 22);

    doc.save(`${sanitizeFileName(studentData.prenom)}-${sanitizeFileName(studentData.nom)}-versements.pdf`);
  };

  const handleInputChange = (field, value) => {
    setStudentData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'dateNaissance') next.age = computeAge(value);
      if (field === 'classeActuelleId') {
        next.classe = classNameFromId(classes, value);
        next.classeActuelle = classNameFromId(classes, value);
      }
      return next;
    });
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPageError("Veuillez choisir une image valide pour la photo de profil.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setStudentData((prev) => ({ ...prev, photo: String(reader.result || '') }));
      setPageError('');
    };
    reader.onerror = () => {
      setPageError("Impossible de lire cette image. Veuillez reessayer.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setPageError('');
    setPageSuccess('');
    try {
      await api.put(`/eleves/${id}`, buildPayload(studentData, classes));
      const [refreshed, paiementsResponse] = await Promise.all([
        api.get(`/eleves/${id}`),
        api.get('/system/paiements'),
      ]);
      setPayments(paiementsResponse.data || []);
      setRecord(refreshed.data);
      setStudentData(profileFromRecordWithPayments(refreshed.data, classes, paiementsResponse.data || []));
      setEditMode(false);
      setPageSuccess("Le profil de l'eleve a ete enregistre avec succes.");
    } catch (error) {
      console.error('Erreur sauvegarde profil eleve:', error);
      setPageError(error.response?.data?.error || "La mise a jour du profil de l'eleve a echoue.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setStudentData(profileFromRecordWithPayments(record, classes, payments));
    setPageSuccess('');
  };

  if (showLoading) {
    return (
      <div className="p-6">
        <PageLoadingState
          title="Chargement du profil eleve"
          message="Les informations de l'eleve sont en cours de chargement."
        />
      </div>
    );
  }

  if (pageError && !record) {
    return (
      <div className="p-6">
        <PageErrorState
          title="Profil eleve indisponible"
          message={pageError}
          action={(
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="premium-action rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Reessayer
            </button>
          )}
        />
      </div>
    );
  }
  return (
    <div className="app-page min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <PageBanner tone="success" title={pageSuccess ? 'Enregistrement reussi' : ''} message={pageSuccess} />
        <PageBanner tone="error" title={pageError && record ? 'Action impossible' : ''} message={record ? pageError : ''} />
        <div className="surface-card premium-card mb-6 rounded-2xl p-5 sm:p-6">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex-1">
              <h1 className="mb-2 text-3xl font-bold text-gray-800">Profil de l'eleve</h1>
              <p className="text-gray-600">
                {studentData.prenom} {studentData.nom} - {studentData.classeActuelle || '-'}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {editMode ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="premium-action flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="premium-action flex items-center gap-2 rounded-2xl bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
                  >
                    <XMarkIcon className="h-5 w-5" />
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className="premium-action flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  <PencilSquareIcon className="h-5 w-5" />
                  Modifier
                </button>
              )}
              <button
                onClick={() => navigate(`/eleves/${id}/bulletin?trimestre=1${currentSchoolYear ? `&annee=${encodeURIComponent(currentSchoolYear)}` : ''}`)}
                className="premium-action flex items-center gap-2 rounded-2xl bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
              >
                <PrinterIcon className="h-5 w-5" />
                Bulletin
              </button>
              <button
                onClick={handleDownloadProfilePdf}
                className="premium-action flex items-center gap-2 rounded-2xl bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                Telecharger
              </button>
              <button
                onClick={handleDownloadPaymentPdf}
                className="premium-action flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                <CurrencyDollarIcon className="h-5 w-5" />
                Bulletin versement
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-1">
              <div className="mb-6 rounded-2xl bg-white/60 p-4 text-center shadow-sm">
                <img
                  src={studentData.photo}
                  alt="Photo de l'eleve"
                  className="mx-auto mb-4 h-40 w-40 rounded-full border-4 border-blue-200 object-cover shadow-lg"
                />
                {editMode ? (
                  <div className="mb-4">
                    <label className="premium-action inline-flex cursor-pointer items-center rounded-2xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
                      Changer la photo
                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                    </label>
                  </div>
                ) : null}
                <div className="mb-3 inline-block rounded-full bg-blue-100 px-3 py-1">
                  <span className="text-sm font-semibold text-blue-800">{studentData.statut || 'Non renseigne'}</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-800">
                  {studentData.prenom} {studentData.nom}
                </h3>
                <p className="text-gray-600">{studentData.matricule || '-'}</p>
              </div>

              <div className="premium-card space-y-3 rounded-2xl bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <PhoneIcon className="h-5 w-5 text-blue-600" />
                  <div className="text-sm">
                    <p className="text-gray-600">Telephone eleve</p>
                    <p className="font-semibold">{studentData.telephone || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <PhoneIcon className="h-5 w-5 text-green-600" />
                  <div className="text-sm">
                    <p className="text-gray-600">Telephone tuteur</p>
                    <p className="font-semibold">{studentData.telephoneTuteur || '-'}</p>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs text-gray-600">Contact d'urgence</p>
                  <p className="text-sm font-semibold">{studentData.contactUrgence || '-'}</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nom complet" value={`${studentData.prenom} ${studentData.nom}`.trim()} field="nom" editMode={false} onChange={handleInputChange} />
                <Field label="Matricule" value={studentData.matricule} field="matricule" editMode={false} onChange={handleInputChange} />
                <Field label="Classe" value={studentData.classeActuelle} field="classe" editMode={false} onChange={handleInputChange} />
                <Field label="Serie" value={studentData.serie} field="serie" editMode={false} onChange={handleInputChange} />
                <Field label="Date de naissance" value={displayDate(studentData.dateNaissance)} field="dateNaissance" editMode={false} onChange={handleInputChange} />
                <Field label="Age" value={studentData.age} field="age" editMode={false} onChange={handleInputChange} />
                <Field label="Nationalite" value={studentData.nationalite} field="nationalite" editMode={false} onChange={handleInputChange} />
                <Field label="Statut" value={studentData.statut} field="statut" editMode={false} onChange={handleInputChange} />
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card premium-card rounded-t-2xl border-b bg-white shadow-lg">
          <div className="flex flex-wrap">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`premium-action flex items-center gap-2 border-b-2 px-4 py-3 font-medium transition-colors ${
                    activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <IconComponent className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="surface-card premium-card rounded-b-2xl bg-white p-6">
          {activeTab === 'general' && (
            <SectionCard title="Informations Generales" icon={UserIcon}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Nom" value={studentData.nom} field="nom" editMode={editMode} onChange={handleInputChange} />
                <Field label="Prenom" value={studentData.prenom} field="prenom" editMode={editMode} onChange={handleInputChange} />
                <Field label="Matricule" value={studentData.matricule} field="matricule" editMode={editMode} onChange={handleInputChange} />
                <Field label="Sexe" value={studentData.sexe} field="sexe" editMode={editMode} onChange={handleInputChange} selectOptions={[{ value: '', label: 'Selectionner' }, { value: 'M', label: 'Masculin' }, { value: 'F', label: 'Feminin' }]} />
                <Field label="Date de naissance" value={studentData.dateNaissance} field="dateNaissance" type="date" editMode={editMode} onChange={handleInputChange} />
                <Field label="Age" value={studentData.age} field="age" editMode={false} onChange={handleInputChange} />
                <Field
                  label="Classe actuelle"
                  value={studentData.classeActuelleId}
                  field="classeActuelleId"
                  editMode={editMode}
                  onChange={handleInputChange}
                  selectOptions={[{ value: '', label: 'Selectionner' }, ...classes.map((classe) => ({ value: classe.id, label: classe.name }))]}
                />
                <Field label="Numero de table" value={studentData.numeroTable} field="numeroTable" editMode={editMode} onChange={handleInputChange} />
                <Field label="Serie" value={studentData.serie} field="serie" editMode={editMode} onChange={handleInputChange} />
                <Field label="Nationalite" value={studentData.nationalite} field="nationalite" editMode={editMode} onChange={handleInputChange} />
                <Field label="Adresse" value={studentData.adresse} field="adresse" editMode={editMode} onChange={handleInputChange} />
                <Field label="Telephone" value={studentData.telephone} field="telephone" editMode={editMode} onChange={handleInputChange} />
                <Field label="Email" value={studentData.email} field="email" type="email" editMode={editMode} onChange={handleInputChange} />
                <Field label="Date inscription" value={studentData.dateInscription} field="dateInscription" type="date" editMode={editMode} onChange={handleInputChange} />
                <Field label="Annee scolaire" value={studentData.anneeScolaire} field="anneeScolaire" editMode={editMode} onChange={handleInputChange} />
                <Field label="Statut" value={studentData.statut} field="statut" editMode={editMode} onChange={handleInputChange} selectOptions={[{ value: 'actif', label: 'Actif' }, { value: 'transfere', label: 'Transfere' }, { value: 'exclu', label: 'Exclu' }, { value: 'diplome', label: 'Diplome' }]} />
              </div>
            </SectionCard>
          )}

          {activeTab === 'scolaire' && (
            <SectionCard title="Informations Scolaires" icon={AcademicCapIcon}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Classe actuelle" value={studentData.classeActuelle} field="classeActuelle" editMode={false} onChange={handleInputChange} />
                <Field label="Ancienne classe" value={studentData.ancienneClasse} field="ancienneClasse" editMode={editMode} onChange={handleInputChange} />
                <Field label="Niveau d'etude" value={studentData.niveauEtude} field="niveauEtude" editMode={editMode} onChange={handleInputChange} />
                <Field label="Etablissement precedent" value={studentData.etablissementPrecedent} field="etablissementPrecedent" editMode={editMode} onChange={handleInputChange} />
                <Field label="Redoublant" value={studentData.redoublant} field="redoublant" editMode={editMode} onChange={handleInputChange} />
                <Field label="Option" value={studentData.option} field="option" editMode={editMode} onChange={handleInputChange} />
                <Field label="Groupe pedagogique" value={studentData.groupePedagogique} field="groupePedagogique" editMode={editMode} onChange={handleInputChange} />
                <Field label="Professeur principal" value={studentData.professeurPrincipal} field="professeurPrincipal" editMode={editMode} onChange={handleInputChange} />
              </div>
            </SectionCard>
          )}

          {activeTab === 'parents' && (
            <SectionCard title="Parents Et Tuteurs" icon={PhoneIcon}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Nom du tuteur" value={studentData.tuteur} field="tuteur" editMode={editMode} onChange={handleInputChange} />
                <Field label="Lien avec l'eleve" value={studentData.lienTuteur} field="lienTuteur" editMode={editMode} onChange={handleInputChange} />
                <Field label="Adresse du tuteur" value={studentData.adresseTuteur} field="adresseTuteur" editMode={editMode} onChange={handleInputChange} />
                <Field label="Telephone du tuteur" value={studentData.telephoneTuteur} field="telephoneTuteur" editMode={editMode} onChange={handleInputChange} />
                <Field label="Email du tuteur" value={studentData.emailTuteur} field="emailTuteur" type="email" editMode={editMode} onChange={handleInputChange} />
                <div className="md:col-span-2">
                  <Field label="Contact d'urgence" value={studentData.contactUrgence} field="contactUrgence" editMode={editMode} onChange={handleInputChange} />
                </div>
              </div>
            </SectionCard>
          )}

          {activeTab === 'finances' && (
            <SectionCard title="Situation Financiere" icon={CurrencyDollarIcon}>
              <div className="mb-4">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${inscriptionWaived ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                  {inscriptionWaived ? 'Frais d inscription exoneres' : 'Frais d inscription applique'}
                </span>
              </div>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
                <div className="premium-card rounded-2xl bg-blue-50 p-4">
                  <p className="text-sm text-gray-600">Frais totaux</p>
                  <p className="text-2xl font-bold text-blue-600">{financeStats.fraisTotal}</p>
                </div>
                <div className="premium-card rounded-2xl bg-green-50 p-4">
                  <p className="text-sm text-gray-600">Montant paye</p>
                  <p className="text-2xl font-bold text-green-600">{financeStats.montantPaye}</p>
                </div>
                <div className="premium-card rounded-2xl bg-red-50 p-4">
                  <p className="text-sm text-gray-600">Reste a payer</p>
                  <p className="text-2xl font-bold text-red-600">{financeStats.resteAPayer}</p>
                </div>
                <div className="premium-card rounded-2xl bg-purple-50 p-4">
                  <p className="text-sm text-gray-600">Reduction</p>
                  <p className="text-2xl font-bold text-purple-600">{financeStats.reduction}</p>
                </div>
                <div className="premium-card rounded-2xl bg-amber-50 p-4">
                  <p className="text-sm text-gray-600">Mois couverts</p>
                  <p className="text-2xl font-bold text-amber-600">{financeStats.moisCouverts}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Frais total" value={studentData.fraisTotal} field="fraisTotal" type="number" editMode={editMode} onChange={handleInputChange} />
                <Field label="Montant paye" value={studentData.montantPaye} field="montantPaye" type="number" editMode={editMode} onChange={handleInputChange} />
                <Field label="Reste a payer" value={studentData.resteAPayer} field="resteAPayer" type="number" editMode={editMode} onChange={handleInputChange} />
                <Field label="Reduction" value={studentData.reduction} field="reduction" type="number" editMode={editMode} onChange={handleInputChange} />
                <Field label="Mensualite de la classe" value={studentData.mensualiteClasse} field="mensualiteClasse" editMode={false} onChange={handleInputChange} />
                <Field label="Total verse hors inscription" value={studentData.totalVerseHorsInscription} field="totalVerseHorsInscription" editMode={false} onChange={handleInputChange} />
                <Field label="Nombre de mois couverts" value={studentData.moisCouverts} field="moisCouverts" editMode={false} onChange={handleInputChange} />
                <Field label="Etat de paiement" value={studentData.etatPaiement} field="etatPaiement" editMode={editMode} onChange={handleInputChange} />
                <Field label="Dernier paiement" value={studentData.dernierPaiement} field="dernierPaiement" type="date" editMode={editMode} onChange={handleInputChange} />
              </div>
            </SectionCard>
          )}

          {activeTab === 'resultats' && (
            <SectionCard title="Resultats Scolaires" icon={ChartBarIcon}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Moyenne generale" value={studentData.moyenneGenerale} field="moyenneGenerale" type="number" editMode={editMode} onChange={handleInputChange} />
                <Field label="Rang de l'eleve" value={studentData.rangEleve} field="rangEleve" type="number" editMode={editMode} onChange={handleInputChange} />
                <Field label="Nombre de matieres" value={studentData.nombreMatieres} field="nombreMatieres" type="number" editMode={editMode} onChange={handleInputChange} />
                <div className="md:col-span-2">
                  <Field label="Notes par matiere (JSON)" value={studentData.notesMatieres} field="notesMatieres" editMode={editMode} onChange={handleInputChange} textarea />
                </div>
                <div className="md:col-span-2">
                  <Field label="Appreciations" value={studentData.appreciations} field="appreciations" editMode={editMode} onChange={handleInputChange} textarea />
                </div>
              </div>
            </SectionCard>
          )}

          {activeTab === 'presence' && (
            <SectionCard title="Presence Et Discipline" icon={ClockIcon}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Nombre absences" value={studentData.nombreAbsences} field="nombreAbsences" type="number" editMode={editMode} onChange={handleInputChange} />
                <Field label="Absences justifiees" value={studentData.absencesJustifiees} field="absencesJustifiees" type="number" editMode={editMode} onChange={handleInputChange} />
                <Field label="Absences non justifiees" value={studentData.absencesNonJustifiees} field="absencesNonJustifiees" type="number" editMode={editMode} onChange={handleInputChange} />
                <Field label="Retards" value={studentData.retards} field="retards" type="number" editMode={editMode} onChange={handleInputChange} />
                <Field label="Comportement" value={studentData.comportement} field="comportement" editMode={editMode} onChange={handleInputChange} />
                <div className="md:col-span-2">
                  <Field label="Sanctions" value={studentData.sanctions} field="sanctions" editMode={editMode} onChange={handleInputChange} textarea />
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Historique des absences</h3>
                    <p className="text-xs text-slate-500">Absences et retards enregistres pour cet eleve.</p>
                  </div>
                  <button
                    type="button"
                    onClick={exportAttendanceHistoryPdf}
                    className="rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Exporter PDF
                  </button>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-white text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Justifie</th>
                        <th className="px-4 py-3 text-left">Duree</th>
                        <th className="px-4 py-3 text-left">Motif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {attendanceHistory.length ? attendanceHistory.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">{displayDate(item.date)}</td>
                          <td className="px-4 py-3">{item.type === 'retard' ? 'Retard' : 'Absence'}</td>
                          <td className="px-4 py-3">{Number(item.justifie || 0) === 1 ? 'Oui' : 'Non'}</td>
                          <td className="px-4 py-3">{item.duree_minutes ? `${item.duree_minutes} min` : '-'}</td>
                          <td className="px-4 py-3">{item.motif || '-'}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Aucune absence enregistree.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </SectionCard>
          )}

          {activeTab === 'documents' && (
            <SectionCard title="Documents" icon={DocumentTextIcon}>
              <Field label="Documents (JSON)" value={studentData.documents} field="documents" editMode={editMode} onChange={handleInputChange} textarea />
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilEleve;
