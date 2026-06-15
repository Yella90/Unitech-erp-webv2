import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ConfirmDialog from './ConfirmDialog';
import api from '../services/api';
import { logoutUser } from '../services/auth';

function Layout() {
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogoutRequest = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutCancel = () => {
    if (logoutLoading) return;
    setLogoutDialogOpen(false);
  };

  const handleLogoutConfirm = async () => {
    setLogoutLoading(true);
    await logoutUser({ apiClient: api, redirect: true });
    setLogoutLoading(false);
    setLogoutDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-slate-800">
      <Header onLogoutRequest={handleLogoutRequest} onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
      <div className="flex-1 lg:pl-[72px]">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogoutRequest={handleLogoutRequest}
        />
        <main className="app-page mx-auto w-full max-w-[1600px] p-3 sm:p-4 lg:p-5">
          <Outlet />
        </main>
      </div>
      <footer className="border-t border-slate-200 bg-white/90 px-4 py-3 text-center text-xs text-slate-500 backdrop-blur">
        UNITECH ERP - SaaS scolaire
      </footer>
      <ConfirmDialog
        open={logoutDialogOpen}
        title="Confirmer la deconnexion"
        message="Vous allez fermer votre session en cours et revenir a l'ecran de connexion."
        confirmLabel="Oui, me deconnecter"
        cancelLabel="Rester connecte"
        tone="danger"
        loading={logoutLoading}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />
    </div>
  );
}
export default Layout;
