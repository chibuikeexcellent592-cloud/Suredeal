import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  Info,
  KeyRound,
  MessageSquare,
  Phone,
  Plus,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, formatNaira } from '../../lib/api';
import type { NotificationItem, TutorialItem, WalletTransaction } from '../../types';

interface OverviewResponse {
  stats: {
    activeSmsCount: number;
    totalSmsCount: number;
    activeBoostingCount: number;
    vaultCount: number;
    referralsCount: number;
    unreadNotifications: number;
  };
  recentTransactions: WalletTransaction[];
  notifications: NotificationItem[];
  tutorials: TutorialItem[];
}

interface OverviewPanelProps {
  onNavigate: (tab: string) => void;
}

import { SafeImage } from '../SafeImage';

function getSafeExternalUrl(raw?: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

export function OverviewPanel({ onNavigate }: OverviewPanelProps) {
  const { user, catalog, impersonatingFromAdmin } = useApp();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideBalance, setHideBalance] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<NotificationItem | null>(null);
  const symbol = catalog?.settings?.currencySymbol || '₦';
  const firstName = (user?.name || 'User').trim().split(/\s+/)[0];

  useEffect(() => {
    let active = true;
    apiFetch<OverviewResponse>('/api/dashboard/overview')
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.balance]);

  const settings = catalog?.settings;
  const noticeEnabled = settings?.dashboardNoticeEnabled !== false;
  const noticeText =
    settings?.dashboardNoticeText?.trim() ||
    'This platform provides digital tools for legitimate use only. Users are responsible.';
  const noticeTone = settings?.dashboardNoticeTone || 'amber';

  const walletBadge = settings?.dashboardWalletBadge?.trim() || '';
  const rawWalletTitle = settings?.dashboardWalletTitle?.trim() || 'Dashboard Overview, {{NAME}} 👋';
  const walletTitle = rawWalletTitle.replace(/\{\{NAME\}\}/gi, firstName);
  const walletSubtitle =
    settings?.dashboardWalletSubtitle?.trim() ||
    (user?.role === 'admin'
      ? 'Overwatch creator access is active across your storefront and catalog.'
      : 'Rent virtual SMS numbers, launch social campaigns, and manage your digital Vault.');
  const balanceLabel = settings?.dashboardBalanceLabel?.trim() || 'Account Balance';
  const fundButtonLabel = settings?.dashboardFundButtonLabel?.trim() || 'Add Funds';
  const historyButtonLabel = settings?.dashboardHistoryButtonLabel?.trim() || 'History';

  const activeDashboardBanners = (settings?.dashboardBanners || []).filter(
    (b) => b.active && b.imageUrl?.trim(),
  );

  const noticeBoxStyles =
    noticeTone === 'info'
      ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/70 text-sky-900 dark:text-sky-100'
      : noticeTone === 'emerald'
        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-100'
        : noticeTone === 'rose'
          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-100'
          : 'bg-[#FFF8E7] dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200';

  const NoticeIcon =
    noticeTone === 'info' ? Info : noticeTone === 'emerald' ? CheckCircle2 : AlertTriangle;

  const horizontalKpis = [
    {
      label: 'Active OTP Numbers',
      subtitle: 'Live virtual SMS sessions waiting for codes',
      value: loading ? '—' : String(data?.stats.activeSmsCount ?? 0),
      cta: 'Rent Number',
      tab: 'sms',
      icon: MessageSquare,
      iconClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Active Boosting',
      subtitle: 'Ongoing social growth & engagement orders',
      value: loading ? '—' : String(data?.stats.activeBoostingCount ?? 0),
      cta: 'Launch Campaign',
      tab: 'boosting',
      icon: TrendingUp,
      iconClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Vault Credentials',
      subtitle: 'Delivered digital accounts & instant keys',
      value: loading ? '—' : String(data?.stats.vaultCount ?? 0),
      cta: 'Open Vault',
      tab: 'marketplace',
      icon: KeyRound,
      iconClass: 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400',
    },
    {
      label: 'Referral Invites',
      subtitle: 'Invite friends & unlock wallet commission rewards',
      value: loading ? '—' : `${data?.stats.referralsCount ?? 0} Invites`,
      cta: 'Refer & Earn',
      tab: 'referral',
      icon: Wallet,
      iconClass: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Admin-Configurable Dashboard Notice Alert Box */}
      {noticeEnabled && noticeText && (
        <div
          className={`rounded-2xl border px-4 py-3.5 flex items-start gap-3 text-xs sm:text-sm font-medium leading-relaxed shadow-2xs ${noticeBoxStyles}`}
        >
          <NoticeIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
          <p className="min-w-0 whitespace-pre-line">{noticeText}</p>
        </div>
      )}

      {/* Quick Action Pills Row (Open Overwatch on the Left for Admins) */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
        {(user?.role === 'admin' || Boolean(impersonatingFromAdmin)) && (
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-sm whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-white shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span>{impersonatingFromAdmin ? 'Exit to Overwatch' : 'Open Overwatch'}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onNavigate('wallet')}
          className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold shadow-2xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4" />
          </span>
          <span>Fund Account</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('marketplace')}
          className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold shadow-2xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </span>
          <span>Buy Accounts</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('sms')}
          className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold shadow-2xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4" />
          </span>
          <span>Buy Number</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('boosting')}
          className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold shadow-2xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </span>
          <span>Social Boost</span>
        </button>
      </div>

      {/* Vibrant Admin-Editable Balance Hero Card */}
      <section className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-sky-500 p-6 sm:p-7 text-white shadow-xl shadow-blue-600/20 space-y-5">
        <div className="space-y-1.5">
          {walletBadge && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider text-blue-50">
              {walletBadge}
            </span>
          )}
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
            {walletTitle}
          </h1>
          <p className="text-xs sm:text-sm text-blue-100">
            {walletSubtitle}
          </p>
        </div>

        <div className="pt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-100">
              <span>{balanceLabel}</span>
              <button
                type="button"
                onClick={() => setHideBalance((v) => !v)}
                className="inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/15 text-white/90 cursor-pointer"
                aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
              >
                {hideBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 tabular-nums">
              {hideBalance ? `${symbol}••••••` : formatNaira(user?.balance || 0, symbol)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {fundButtonLabel}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('transactions')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold backdrop-blur-xs transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              {historyButtonLabel}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Admin-Managed Dashboard Images / Banners directly beneath Dashboard Overview */}
      {activeDashboardBanners.length > 0 && (
        <div
          className={`grid gap-3.5 ${
            activeDashboardBanners.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
          }`}
        >
          {activeDashboardBanners.map((banner) => {
            const safeUrl = getSafeExternalUrl(banner.linkUrl);
            const inner = (
              <div className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                <div className="aspect-[16/6] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <SafeImage
                    src={banner.imageUrl}
                    alt={banner.title || 'Featured Banner'}
                    fallbackTitle={banner.title || 'Featured'}
                    className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                  />
                </div>
                {banner.title && (
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 sm:line-clamp-1 leading-snug">
                      {banner.title}
                    </p>
                    {safeUrl && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        Open
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            );

            return safeUrl ? (
              <a
                key={banner.id}
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {inner}
              </a>
            ) : (
              <div key={banner.id}>{inner}</div>
            );
          })}
        </div>
      )}

      {/* 4 Long Panoramic Horizontal KPI Bars — organized 2-row stack on mobile, full horizontal bar on sm+ */}
      <div className="grid grid-cols-1 gap-3.5">
        {horizontalKpis.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 sm:px-8 py-4 sm:py-5 sm:min-h-[94px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 sm:gap-8 shadow-2xs hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
            >
              <div className="flex items-start sm:items-center justify-between gap-3 min-w-0 flex-1">
                <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                  <span
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.iconClass}`}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white leading-snug">
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5 line-clamp-2 sm:line-clamp-1">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                {/* Mobile numeric KPI badge on top right */}
                <p className="sm:hidden font-mono text-base font-extrabold text-slate-900 dark:text-white leading-tight tabular-nums shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {item.value}
                </p>
              </div>

              <div className="hidden lg:flex items-center flex-1 max-w-xs px-4">
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full w-2/3 rounded-full bg-blue-600/25 dark:bg-blue-500/35" />
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80">
                <p className="hidden sm:block font-mono text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight tabular-nums min-w-[3.5ch] text-right">
                  {item.value}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate(item.tab)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-xs font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <span>{item.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Split: Recent Ledger + Announcements & Tutorials */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Recent Account Ledger
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('transactions')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Loading ledger...</div>
          ) : !data || data.recentTransactions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No transactions yet. Fund your wallet via {catalog?.settings?.bankName || 'Moniepoint'} to begin.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('wallet')}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                <span>Fund Wallet Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {data.recentTransactions.slice(0, 6).map((tx) => {
                const isCredit =
                  tx.type === 'deposit' ||
                  tx.type === 'refund' ||
                  tx.type === 'admin_credit' ||
                  tx.type === 'referral_bonus' ||
                  tx.type === 'welcome_bonus';
                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {tx.description}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {new Date(tx.createdAt).toLocaleString()} · {tx.status}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-sm font-semibold tabular-nums shrink-0 ${
                        isCredit
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-slate-200'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {formatNaira(tx.amount, symbol)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* Broadcasts */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Platform Notices
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('notifications')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                All Alerts
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {(data?.notifications || []).slice(0, 3).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setSelectedNotice(n);
                    void apiFetch(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(
                      () => {},
                    );
                  }}
                  className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-950 dark:hover:bg-slate-800/60 border border-slate-100 dark:border-slate-800 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{n.title}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                    {n.message}
                  </p>
                  <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1.5">
                    Tap to read in full →
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Guides */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Quick Tutorials
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tutorials')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                View Guides
              </button>
            </div>
            <div className="mt-3 space-y-2.5">
              {(data?.tutorials || []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onNavigate('tutorials')}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{t.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {t.category} · {t.duration}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedNotice && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedNotice(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                      {selectedNotice.type || 'notice'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(selectedNotice.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h2 className="font-display text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1 break-words">
                    {selectedNotice.title}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer shrink-0"
                aria-label="Close notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line break-words">
                {selectedNotice.message}
              </p>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/50">
              <button
                type="button"
                onClick={() => {
                  setSelectedNotice(null);
                  onNavigate('notifications');
                }}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Open All Notifications
              </button>
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
