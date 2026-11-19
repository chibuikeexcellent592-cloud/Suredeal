import { useEffect, useState } from 'react';
import { AdminPage } from './components/AdminPage';
import { AuthView } from './components/AuthView';
import { FloatingWhatsAppButton } from './components/FloatingWhatsAppButton';
import { LandingPage } from './components/LandingPage';
import { ToastContainer } from './components/ToastContainer';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { AppProvider, useApp } from './context/AppContext';

function AppRouter() {
  const { user, authLoading, catalog } = useApp();
  const [view, setView] = useState<'landing' | 'auth' | 'workspace' | 'admin'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    if (catalog?.settings.siteName) {
      document.title = `${catalog.settings.siteName} — SMS Verification, Social Boosting & Digital Marketplace`;
    }
  }, [catalog?.settings.siteName]);

  useEffect(() => {
    if (!authLoading && user && view === 'auth') {
      setView('workspace');
    }
  }, [authLoading, user, view]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--site-bg)] text-sm text-slate-500">
        Loading SureDeal Store...
      </div>
    );
  }

  return (
    <>
      {view === 'admin' && user?.role === 'admin' ? (
        <AdminPage
          onBackHome={() => setView('landing')}
          onOpenWorkspace={() => setView('workspace')}
        />
      ) : view === 'workspace' && user ? (
        <WorkspaceLayout
          onBackHome={() => setView('landing')}
          onOpenAdmin={user.role === 'admin' ? () => setView('admin') : undefined}
        />
      ) : view === 'auth' ? (
        <AuthView
          initialMode={authMode}
          onBack={() => setView('landing')}
          onSuccess={() => setView('workspace')}
        />
      ) : (
        <LandingPage
          onNavigateAuth={(mode) => {
            setAuthMode(mode);
            setView('auth');
          }}
          onEnterWorkspace={() => {
            if (user) {
              setView('workspace');
            } else {
              setAuthMode('login');
              setView('auth');
            }
          }}
        />
      )}
      {view !== 'admin' && <FloatingWhatsAppButton />}
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
