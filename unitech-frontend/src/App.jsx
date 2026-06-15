import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import { PageLoadingState } from './components/PageState';
import { canAccessResource, getDefaultRouteForRole, isSuperAdminRole } from './utils/roles.js';

const Login = lazy(() => import('./pages/Login.jsx'));
const StaffLogin = lazy(() => import('./pages/StaffLogin.jsx'));
const RegisterSchool = lazy(() => import('./pages/inscription.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const IconGallery = lazy(() => import('./pages/icon.jsx'));
const Classes = lazy(() => import('./pages/Classes.jsx'));
const ElevesListe = lazy(() => import('./pages/ElevesListe.jsx'));
const EleveForm = lazy(() => import('./pages/EleveForm.jsx'));
const Enseignants = lazy(() => import('./pages/enseignants.jsx'));
const Personnels = lazy(() => import('./pages/personnels.jsx'));
const Matriere = lazy(() => import('./pages/Matriere.jsx'));
const Affectation = lazy(() => import('./pages/affestation.jsx'));
const Administrateur = lazy(() => import('./pages/Administrateur.jsx'));
const Setup = lazy(() => import('./pages/Setup.jsx'));
const Finances = lazy(() => import('./pages/Finances.jsx'));
const Salaires = lazy(() => import('./pages/Salaires.jsx'));
const Depenses = lazy(() => import('./pages/Depenses.jsx'));
const Retraits = lazy(() => import('./pages/Retraits.jsx'));
const Tresorerie = lazy(() => import('./pages/Tresorerie.jsx'));
const Utilisateurs = lazy(() => import('./pages/Utilisateurs.jsx'));
const Rapports = lazy(() => import('./pages/Rapports.jsx'));
const HistoriqueActions = lazy(() => import('./pages/HistoriqueActions.jsx'));
const SyncStatus = lazy(() => import('./pages/SyncStatus.jsx'));
const EmploisDuTemps = lazy(() => import('./pages/EmploisDuTemps.jsx'));
const TrimestresCharges = lazy(() => import('./pages/TrimestresCharges.jsx'));
const Notes = lazy(() => import('./pages/Notes.jsx'));
const Transferts = lazy(() => import('./pages/Transferts.jsx'));
const NotificationsTransferts = lazy(() => import('./pages/NotificationsTransferts.jsx'));
const RetardsPaiement = lazy(() => import('./pages/RetardsPaiement.jsx'));
const Absences = lazy(() => import('./pages/Absences.jsx'));
const AbsencesEnseignants = lazy(() => import('./pages/AbsencesEnseignants.jsx'));
const ProfilEleve = lazy(() => import('./pages/profiles/eleves.jsx'));
const PersonnelProfile = lazy(() => import('./pages/profiles/personnel.jsx'));
const BulletinEleve = lazy(() => import('./pages/BulletinEleve.jsx'));
const BulletinVerification = lazy(() => import('./pages/BulletinVerification.jsx'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin.jsx'));

function HomeRedirect() {
  const role = localStorage.getItem('role');
  const target = getDefaultRouteForRole(role);
  if (target && target !== '/') {
    return <Navigate to={target} replace />;
  }
  return isSuperAdminRole(role) ? <Navigate to="/super-admin" replace /> : <Dashboard />;
}

function ProtectedResourceRoute({ resource, roles = [], element }) {
  const role = localStorage.getItem('role');
  if (canAccessResource(role, resource, 'read', roles)) {
    return element;
  }
  return <Navigate to="/" replace />;
}

function ProtectedSuperAdminRoute({ element }) {
  const role = localStorage.getItem('role');
  return isSuperAdminRole(role) ? element : <Navigate to="/" replace />;
}

function App() {
  return (
    <>
      <BrowserRouter>
        <Suspense fallback={<PageLoadingState />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/connexion-personnel" element={<StaffLogin />} />
            <Route path="/auth/register-school" element={<RegisterSchool />} />
            <Route path="/bulletins/verifier/:id" element={<BulletinVerification />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<HomeRedirect />} />
              <Route path="icones" element={<ProtectedResourceRoute resource="dashboard" roles={['directeur']} element={<IconGallery />} />} />
              <Route path="setup" element={<ProtectedResourceRoute resource="students" roles={['directeur', 'secretaire']} element={<Setup />} />} />
              <Route path="classes" element={<ProtectedResourceRoute resource="classes" roles={['directeur', 'censeur', 'surveillant']} element={<Classes />} />} />
              <Route path="eleves" element={<ProtectedResourceRoute resource="students" roles={['directeur', 'promoteur', 'comptable', 'secretaire', 'censeur', 'surveillant']} element={<ElevesListe />} />} />
              <Route path="eleves/ajouter" element={<ProtectedResourceRoute resource="students" roles={['directeur', 'secretaire']} element={<EleveForm />} />} />
              <Route path="enseignants" element={<ProtectedResourceRoute resource="teachers" roles={['directeur', 'promoteur', 'comptable', 'secretaire', 'censeur', 'surveillant']} element={<Enseignants />} />} />
              <Route path="personnels" element={<ProtectedResourceRoute resource="personnels" roles={['directeur', 'promoteur', 'comptable', 'secretaire']} element={<Personnels />} />} />
              <Route path="matieres" element={<ProtectedResourceRoute resource="subjects" roles={['directeur', 'censeur', 'surveillant']} element={<Matriere />} />} />
              <Route path="affectation" element={<ProtectedResourceRoute resource="assignments" roles={['directeur', 'censeur', 'surveillant']} element={<Affectation />} />} />
              <Route path="emplois-du-temps" element={<ProtectedResourceRoute resource="schedules" roles={['directeur', 'promoteur', 'censeur', 'surveillant', 'enseignant']} element={<EmploisDuTemps />} />} />
              <Route path="trimestres-charges" element={<ProtectedResourceRoute resource="trimestres" roles={['directeur', 'promoteur', 'censeur', 'surveillant']} element={<TrimestresCharges />} />} />
              <Route path="notes" element={<ProtectedResourceRoute resource="notes" roles={['directeur', 'promoteur', 'censeur', 'surveillant', 'enseignant']} element={<Notes />} />} />
              <Route path="absences" element={<ProtectedResourceRoute resource="attendance" roles={['directeur', 'censeur', 'surveillant', 'enseignant']} element={<Absences />} />} />
              <Route path="absences-enseignants" element={<ProtectedResourceRoute resource="schedules" roles={['directeur', 'promoteur', 'comptable', 'secretaire', 'censeur', 'surveillant']} element={<AbsencesEnseignants />} />} />
              <Route path="transferts" element={<ProtectedResourceRoute resource="students" roles={['directeur', 'secretaire']} element={<Transferts />} />} />
              <Route path="notifications-transferts" element={<ProtectedResourceRoute resource="transfer_notifications" roles={['directeur']} element={<NotificationsTransferts />} />} />
              <Route path="retards-paiement" element={<ProtectedResourceRoute resource="finances" roles={['directeur', 'promoteur', 'comptable', 'secretaire']} element={<RetardsPaiement />} />} />
              <Route path="finances" element={<ProtectedResourceRoute resource="finances" roles={['directeur', 'promoteur', 'comptable', 'secretaire']} element={<Finances />} />} />
              <Route path="salaires" element={<ProtectedResourceRoute resource="salaries" roles={['directeur', 'promoteur', 'comptable', 'secretaire']} element={<Salaires />} />} />
              <Route path="depenses" element={<ProtectedResourceRoute resource="expenses" roles={['directeur', 'promoteur', 'comptable', 'secretaire']} element={<Depenses />} />} />
              <Route path="retraits" element={<ProtectedResourceRoute resource="finances" roles={['directeur', 'promoteur']} element={<Retraits />} />} />
              <Route path="tresorerie" element={<ProtectedResourceRoute resource="finances" roles={['directeur', 'promoteur', 'comptable']} element={<Tresorerie />} />} />
              <Route path="utilisateurs" element={<ProtectedResourceRoute resource="users" roles={['directeur']} element={<Utilisateurs />} />} />
              <Route path="rapports" element={<ProtectedResourceRoute resource="reports" roles={['directeur', 'promoteur', 'comptable', 'secretaire', 'censeur', 'surveillant']} element={<Rapports />} />} />
              <Route path="historique-actions" element={<ProtectedResourceRoute resource="activity_logs" roles={['directeur', 'promoteur']} element={<HistoriqueActions />} />} />
              <Route path="sync-status" element={<ProtectedResourceRoute resource="dashboard" roles={['directeur', 'promoteur']} element={<SyncStatus />} />} />
              <Route path="administrateur" element={<ProtectedResourceRoute resource="teachers" roles={['directeur']} element={<Administrateur />} />} />
              <Route path="super-admin" element={<ProtectedSuperAdminRoute element={<SuperAdmin />} />} />
              <Route path="eleveProfil/:id" element={<ProtectedResourceRoute resource="students" roles={['directeur', 'promoteur', 'comptable', 'secretaire', 'censeur', 'surveillant']} element={<ProfilEleve />} />} />
              <Route path="eleves/:id/bulletin" element={<ProtectedResourceRoute resource="bulletins" roles={['directeur', 'promoteur', 'censeur', 'surveillant', 'enseignant']} element={<BulletinEleve />} />} />
              <Route path="personnelProfil/:type/:id" element={<ProtectedResourceRoute resource="teachers" roles={['directeur', 'promoteur', 'comptable', 'secretaire', 'censeur', 'surveillant']} element={<PersonnelProfile />} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 2500 }} />
    </>
  );
}

export default App;
