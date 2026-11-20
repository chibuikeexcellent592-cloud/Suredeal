import { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  MessageCircle,
  RefreshCw,
  Shield,
  Wrench,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from './BrandLogo';

interface MaintenanceScreenProps {
  onAdminSignIn: () => void;
  isPreview?: boolean;
  onExitPreview?: () => void;
  initialHeadline?: string;
  initialMessage?: string;
}

export function MaintenanceScreen({
  onAdminSignIn,
  isPreview = false,
  onExitPreview,
  initialHeadline,
  initialMessage,
}: MaintenanceScreenProps) {
  const { catalog, checkMaintenanceStatus, logout, user } = useApp();
  const [checking, setChecking] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    kind: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);
  const [liveOverrides, setLiveOverrides] = useState<{
    headline?: string;
    message?: string;
  } | null>(null);

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<number | null>(null);

  const settings = catalog?.settings;
  const siteName = settings?.siteName || 'SureDeal Store';
  const symbol = settings?.currencySymbol || '₦';
  const contactEmail = settings?.supportEmail || 'chibuikeexcellent592@gmail.com';
  const whatsappDisplay =
    settings?.supportWhatsapp || settings?.adminNotifyPhone || '+2347031537390';
  const whatsappDigits = whatsappDisplay.replace(/[^\d]/g, '') || '2347031537390';
  const whatsappHref = `https://wa.me/${whatsappDigits}`;
  const creatorName = settings?.creatorName?.trim() || siteName;

  const headline =
    liveOverrides?.headline ||
    initialHeadline ||
    settings?.maintenanceHeadline ||
    'Scheduled Maintenance in Progress';
  const message =
    liveOverrides?.message ||
    initialMessage ||
    settings?.maintenanceMessage ||
    'We’re currently performing scheduled maintenance. Please check back shortly.';

  const handleScreenTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) {
      window.clearTimeout(tapTimerRef.current);
    }
    if (tapCountRef.current >= 10) {
      tapCountRef.current = 0;
      onAdminSignIn();
      return;
    }
    tapTimerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
    }, 4500);
  };

  const handleCheckAgain = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (checking) return;
    setChecking(true);
    setStatusFeedback(null);
    try {
      const res = await checkMaintenanceStatus();
      if (res.error) {
        setStatusFeedback({
          kind: 'error',
          text: res.error,
        });
      } else if (!res.maintenanceMode) {
        setStatusFeedback({
          kind: 'success',
          text: 'Maintenance is complete! Restoring your storefront access...',
        });
        if (isPreview && onExitPreview) {
          onExitPreview();
        }
      } else {
        setLiveOverrides({
          headline: res.maintenanceHeadline,
          message: res.maintenanceMessage,
        });
        setStatusFeedback({
          kind: 'info',
          text: 'Maintenance is still active. Please check back shortly.',
        });
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      onClick={handleScreenTap}
      className="min-h-screen flex flex-col justify-between px-5 sm:px-6 py-8 sm:py-10 bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 select-none touch-manipulation"
    >
      {isPreview && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-w-xl w-full mx-auto mb-4 px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-sm"
        >
          <span>Previewing public Maintenance Screen (as normal users see it)</span>
          {onExitPreview && (
            <button
              type="button"
              onClick={onExitPreview}
              className="px-3 py-1 rounded-lg bg-slate-950 text-white hover:bg-slate-800 cursor-pointer"
            >
              Exit Preview
            </button>
          )}
        </div>
      )}

      <header className="max-w-xl w-full mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandLogo
            logoUrl={settings?.siteLogoUrl}
            siteName={siteName}
            size="sm"
            shape="rounded"
          />
          <span className="font-display text-base font-bold tracking-tight truncate">
            {siteName}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold uppercase tracking-wider shrink-0">
          <Wrench className="w-3 h-3" />
          Maintenance
        </span>
      </header>

      <main
        onClick={(e) => e.stopPropagation()}
        className="max-w-xl w-full mx-auto my-auto py-8"
      >
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Wrench className="w-6 h-6" />
          </div>

          <div className="space-y-2.5">
            <h1
              className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight"
              style={{ textWrap: 'balance' }}
            >
              {headline}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {message}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              All Naira ({symbol}) wallet balances, submitted receipts, active SMS orders, and Vault
              credentials remain completely safe.
            </p>
          </div>

          {statusFeedback && (
            <div
              role="status"
              className={`rounded-2xl px-4 py-3 text-xs font-medium flex items-start gap-2.5 border ${
                statusFeedback.kind === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : statusFeedback.kind === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              }`}
            >
              {statusFeedback.kind === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : statusFeedback.kind === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{statusFeedback.text}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleCheckAgain}
              disabled={checking}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold shadow-md shadow-blue-600/20 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Checking Status...' : 'Check Again'}</span>
            </button>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/15 transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>WhatsApp Support</span>
              </span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </a>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Email:{' '}
              <a
                href={`mailto:${contactEmail}`}
                className="font-medium text-slate-700 dark:text-slate-200 underline hover:text-blue-600"
              >
                {contactEmail}
              </a>
            </span>
            {user && user.role !== 'admin' && (
              <button
                type="button"
                onClick={logout}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-xl w-full mx-auto pt-4 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <span>
          &copy; {new Date().getFullYear()} {creatorName}. All rights reserved.
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdminSignIn();
          }}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium underline cursor-pointer"
        >
          <Shield className="w-3.5 h-3.5" />
          Team Access
        </button>
      </footer>
    </div>
  );
}
