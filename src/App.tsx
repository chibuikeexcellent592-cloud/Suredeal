import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { AdminPage } from './components/AdminPage';
import { AuthView } from './components/AuthView';
import { FloatingWhatsAppButton } from './components/FloatingWhatsAppButton';
import { LandingPage } from './components/LandingPage';
import { ToastContainer } from './components/ToastContainer';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { AppProvider, useApp } from './context/AppContext';

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unexpected application error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught UI error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[var(--site-bg)] text-slate-900 dark:text-slate-100">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-sm">
            <h1 className="font-display text-xl font-bold">SureDeal Store</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Something went wrong while rendering the page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppRouter() {
  const { user, authLoading, catalog } = useApp();
  const [view, setView] = useState<'landing' | 'auth' | 'workspace' | 'admin'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    if (catalog?.settings?.siteName) {
      document.title = `${catalog.settings.siteName} — SMS Verification, Social Boosting & Digital Marketplace`;
    }
  }, [catalog?.settings?.siteName]);

  const isMaintenanceLocked =
    Boolean(catalog?.settings?.maintenanceMode) && user?.role !== 'admin';

  useEffect(() => {
    if (!authLoading && user && view === 'auth') {
      if (isMaintenanceLocked) {
        setView('landing');
      } else {
        setView('workspace');
      }
    }
  }, [authLoading, user, view, isMaintenanceLocked]);

  useEffect(() => {
    if (view === 'admin' && user && user.role !== 'admin') {
      setView('workspace');
    }
  }, [view, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--site-bg)] text-sm text-slate-500">
        Loading SureDeal Store...
      </div>
    );
  }

  return (
    <>
      {isMaintenanceLocked ? (
        view === 'auth' ? (
          <AuthView
            initialMode="login"
            onBack={() => setView('landing')}
            onSuccess={(loggedUser) =>
              setView(loggedUser.role === 'admin' ? 'admin' : 'landing')
            }
          />
        ) : (
          <LandingPage
            onNavigateAuth={(mode) => {
              setAuthMode(mode);
              setView('auth');
            }}
            onEnterWorkspace={() => {
              setAuthMode('login');
              setView('auth');
            }}
          />
        )
      ) : view === 'admin' && user?.role === 'admin' ? (
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
          onOpenAdmin={user?.role === 'admin' ? () => setView('admin') : undefined}
        />
      )}
      {view !== 'admin' && !isMaintenanceLocked && <FloatingWhatsAppButton />}
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProvider>
        <AppRouter />
      </AppProvider>
    </AppErrorBoundary>
  );
}
