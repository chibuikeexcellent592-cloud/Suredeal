import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { AdminPage } from './components/AdminPage';
import { AuthView } from './components/AuthView';
import { FloatingWhatsAppButton } from './components/FloatingWhatsAppButton';
import { LandingPage } from './components/LandingPage';
import { MaintenanceScreen } from './components/MaintenanceScreen';
import { ToastContainer } from './components/ToastContainer';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { AppProvider, useApp } from './context/AppContext';
import { resolveApiUrl } from './lib/api';
import { getCachedSiteLogo } from './lib/themeColor';

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
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
            >
              Try Again
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
  const [previewMaintenance, setPreviewMaintenance] = useState(false);

  useEffect(() => {
    const name = catalog?.settings?.siteName || 'SureDeal Store';
    const tag = catalog?.settings?.siteTagline || 'Digital solutions for every market';
    document.title = `${name} — ${tag}`;
  }, [catalog?.settings?.siteName, catalog?.settings?.siteTagline]);

  useEffect(() => {
    const rawLogo =
      catalog?.settings?.siteLogoUrl !== undefined
        ? catalog.settings.siteLogoUrl.trim()
        : getCachedSiteLogo().trim();
    const existing = document.getElementById('dynamic-site-favicon') as HTMLLinkElement | null;
    if (rawLogo) {
      const link = existing || document.createElement('link');
      link.id = 'dynamic-site-favicon';
      link.rel = 'icon';
      link.href = resolveApiUrl(rawLogo);
      if (!existing) {
        document.head.appendChild(link);
      }
    } else if (existing) {
      existing.remove();
    }
  }, [catalog?.settings?.siteLogoUrl]);

  useEffect(() => {
    try {
      const lastPing = Number(sessionStorage.getItem('sd_visit_last_at') || '0');
      const now = Date.now();
      if (now - lastPing < 5 * 60 * 1000) return;

      let visitorId = sessionStorage.getItem('sd_visitor_id') || '';
      if (!visitorId) {
        visitorId = `vis_${now}_${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem('sd_visitor_id', visitorId);
      }
      sessionStorage.setItem('sd_visit_last_at', String(now));

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const device = /mobile|iphone|android|ipad/i.test(ua) ? 'Mobile Browser' : 'Desktop Browser';

      void fetch(resolveApiUrl('/api/public/visit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          path: typeof window !== 'undefined' ? window.location.pathname : '/',
          device,
          referrer: typeof document !== 'undefined' ? document.referrer : '',
        }),
      }).catch(() => {});
    } catch {
      // ignore storage or network failure
    }
  }, []);

  const isMaintenanceLocked =
    Boolean(catalog?.settings?.maintenanceMode) && user?.role !== 'admin';

  useEffect(() => {
    if (!authLoading && user && view === 'auth') {
      if (isMaintenanceLocked) {
        setView('landing');
      } else if (user.role === 'admin' && catalog?.settings?.maintenanceMode) {
        setView('admin');
      } else {
        setView('workspace');
      }
    }
  }, [authLoading, user, view, isMaintenanceLocked, catalog?.settings?.maintenanceMode]);

  useEffect(() => {
    if (view === 'admin' && user && user.role !== 'admin') {
      setView('workspace');
    }
  }, [view, user]);

  useEffect(() => {
    if (user?.role !== 'admin' && previewMaintenance) {
      setPreviewMaintenance(false);
    }
  }, [user?.role, previewMaintenance]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--site-bg)] text-sm text-slate-500">
        Loading SureDeal Store...
      </div>
    );
  }

  const showMaintenanceScreen =
    (isMaintenanceLocked || (user?.role === 'admin' && previewMaintenance)) && view !== 'auth';

  return (
    <>
      {showMaintenanceScreen ? (
        <MaintenanceScreen
          isPreview={user?.role === 'admin' && previewMaintenance}
          onExitPreview={() => setPreviewMaintenance(false)}
          onAdminSignIn={() => {
            setPreviewMaintenance(false);
            setAuthMode('login');
            setView('auth');
          }}
        />
      ) : isMaintenanceLocked ? (
        <AuthView
          initialMode="login"
          onBack={() => setView('landing')}
          onSuccess={(loggedUser) =>
            setView(loggedUser.role === 'admin' ? 'admin' : 'landing')
          }
        />
      ) : view === 'admin' && user?.role === 'admin' ? (
        <AdminPage
          onBackHome={() => setView('landing')}
          onOpenWorkspace={() => setView('workspace')}
          onPreviewMaintenance={() => setPreviewMaintenance(true)}
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
          onSuccess={(loggedUser) =>
            setView(loggedUser.role === 'admin' ? 'admin' : 'workspace')
          }
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
          onPreviewMaintenance={() => setPreviewMaintenance(true)}
        />
      )}
      {view !== 'admin' && !showMaintenanceScreen && <FloatingWhatsAppButton />}
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
