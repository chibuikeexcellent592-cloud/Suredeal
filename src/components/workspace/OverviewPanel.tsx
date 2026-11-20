import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Eye,
  EyeOff,
  History,
  KeyRound,
  MessageSquare,
  Phone,
  Plus,
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

  return (
    <div className="space-y-6">
      {/* Quick Action Row matching IMG_6035 */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => onNavigate('wallet')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-600/20 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Fund Account
        </button>
        <button
          type="button"
          onClick={() => onNavigate('marketplace')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 text-slate-800 dark:text-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Buy Accounts
        </button>
        <button
          type="button"
          onClick={() => onNavigate('sms')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 text-slate-800 dark:text-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Buy Number
        </button>
        <button
          type="button"
          onClick={() => onNavigate('boosting')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 text-slate-800 dark:text-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Social Boost
        </button>
        {user?.role === 'admin' && (
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open Overwatch
          </button>
        )}
      </div>

      {/* Vibrant Brand Balance Hero Card */}
      <section className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-sky-500 p-6 sm:p-7 text-white shadow-xl shadow-blue-600/20 space-y-5">
        <div className="space-y-1">
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
            Dashboard Overview, {firstName} 👋
          </h1>
          <p className="text-xs sm:text-sm text-blue-100">
            {user?.role === 'admin'
              ? 'Overwatch creator access is active across your storefront and catalog.'
              : 'Rent virtual SMS numbers, launch social campaigns, and manage your digital Vault.'}
          </p>
        </div>

        <div className="pt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-100">
              <span>Account Balance</span>
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
              Add Funds
            </button>
            <button
              type="button"
              onClick={() => onNavigate('transactions')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold backdrop-blur-xs transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              History
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
