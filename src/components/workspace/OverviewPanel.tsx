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

export function OverviewPanel({ onNavigate }: OverviewPanelProps) {
  const { user, catalog } = useApp();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideBalance, setHideBalance] = useState(false);
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

  return (
    <div className="space-y-5">
      {/* Admin-Configurable Dashboard Notice Alert Box (IMG_6077) */}
      {noticeEnabled && noticeText && (
        <div
          className={`rounded-2xl border px-4 py-3.5 flex items-start gap-3 text-xs sm:text-sm font-medium leading-relaxed shadow-2xs ${noticeBoxStyles}`}
        >
          <NoticeIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
          <p className="min-w-0 whitespace-pre-line">{noticeText}</p>
        </div>
      )}

      {/* Quick Action Pills Row (IMG_6077 + Open Overwatch on the Left) */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
        {user?.role === 'admin' && (
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-sm whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-white shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span>Open Overwatch</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onNavigate('wallet')}
          className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold shadow-2xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4" />
          </span>
          <span>Fund Account</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('marketplace')}
          className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold shadow-2xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </span>
          <span>Buy Accounts</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('sms')}
          className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold shadow-2xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4" />
          </span>
          <span>Buy Number</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('boosting')}
          className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold shadow-2xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
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
                className="p-1 rounded-md hover:bg-white/15 text-white/90 cursor-pointer"
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

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Active OTP Numbers</span>
            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {loading ? '—' : data?.stats.activeSmsCount ?? 0}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('sms')}
            className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Rent Virtual Number
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Active Boosting</span>
            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {loading ? '—' : data?.stats.activeBoostingCount ?? 0}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('boosting')}
            className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Launch Campaign
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Vault Credentials</span>
            <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {loading ? '—' : data?.stats.vaultCount ?? 0}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('marketplace')}
            className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Open Marketplace &amp; Vault
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Deposit Wallet</span>
            <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {loading ? '—' : data?.stats.referralsCount ?? 0} Invites
          </p>
          <button
            type="button"
            onClick={() => onNavigate('referral')}
            className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Refer &amp; Earn →
          </button>
        </div>
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
                <div
                  key={n.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800"
                >
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{n.title}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {n.message}
                  </p>
                </div>
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
    </div>
  );
}
