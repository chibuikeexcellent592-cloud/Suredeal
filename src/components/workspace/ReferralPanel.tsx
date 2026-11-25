import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  RefreshCw,
  Share2,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, copyText, formatNaira } from '../../lib/api';
import { getSectionCopy } from '../../lib/sectionCopy';

interface InvitedFriend {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  deposited?: boolean;
  rewarded?: boolean;
}

interface ReferralResponse {
  referralCode: string;
  bonusPerReferral: number;
  invited: InvitedFriend[];
  totalEarned: number;
  rewardedCount?: number;
  pendingCount?: number;
}

export function ReferralPanel() {
  const { user, catalog, notify } = useApp();
  const symbol = catalog?.settings?.currencySymbol || '₦';
  const [data, setData] = useState<ReferralResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReferral = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<ReferralResponse>('/api/user/referral');
      setData(res);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load referral stats', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadReferral();
  }, [loadReferral]);

  const code = data?.referralCode || user?.referralCode || '';
  const shareUrl = `${window.location.origin}/?ref=${code}`;
  const bonusAmount = data?.bonusPerReferral ?? catalog?.settings?.referralBonusAmount ?? 500;
  const rewardedCount =
    data?.rewardedCount ?? (data?.invited || []).filter((i) => i.rewarded || i.deposited).length;

  const copyVars = {
    symbol,
    site: catalog?.settings?.siteName || 'SureDeal Store',
    bonus: formatNaira(bonusAmount, symbol),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Gift className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {getSectionCopy(catalog?.settings, 'referralTitle', copyVars)}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {getSectionCopy(catalog?.settings, 'referralSubtitle', copyVars)}
          </p>
        </div>

        <button
          type="button"
          onClick={loadReferral}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* Share Hero Card */}
      <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-sky-500 p-6 text-white shadow-lg shadow-blue-600/15 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/15 text-[11px] font-bold uppercase tracking-wider">
              <Share2 className="w-3.5 h-3.5" />
              {getSectionCopy(catalog?.settings, 'referralCardBadge', copyVars)}
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold">
              {getSectionCopy(catalog?.settings, 'referralCardHeadline', copyVars)}
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
              {getSectionCopy(catalog?.settings, 'referralCardDesc', copyVars)}
            </p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-white/15 backdrop-blur-xs text-right">
            <p className="text-[11px] uppercase tracking-wider text-blue-100 font-semibold">
              Your Referral Code
            </p>
            <p className="font-mono text-lg font-extrabold tracking-widest mt-0.5">
              {code || '—'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            readOnly
            value={shareUrl}
            aria-label="Referral link"
            className="flex-1 min-w-[220px] px-4 py-2.5 text-xs font-mono rounded-xl bg-white/15 border border-white/25 text-white placeholder:text-blue-200 focus:outline-none"
          />
          <button
            type="button"
            onClick={async () => {
              const site = catalog?.settings?.siteName || 'SureDeal Store';
              const inviteText = `Join ${site} for instant virtual SMS numbers, social growth boosting & verified digital accounts: ${shareUrl}`;
              if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                try {
                  await navigator.share({
                    title: site,
                    text: `Join ${site} — Virtual SMS Numbers, Social Boosting & Digital Vault`,
                    url: shareUrl,
                  });
                  return;
                } catch (err) {
                  if (err instanceof Error && err.name === 'AbortError') return;
                }
              }
              await copyText(inviteText);
              notify(`${site} invite link & message copied!`, 'success');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow-xs cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share Link
          </button>
          <button
            type="button"
            onClick={async () => {
              await copyText(shareUrl);
              notify(`${catalog?.settings?.siteName || 'SureDeal Store'} link copied!`, 'success');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-white text-blue-700 hover:bg-blue-50 rounded-xl shadow-xs cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Link
          </button>
          <button
            type="button"
            onClick={async () => {
              await copyText(code);
              notify('Referral code copied!', 'success');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-white/20 hover:bg-white/30 text-white rounded-xl cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Code
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Invited</span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-2 tabular-nums">
            {loading ? '—' : data?.invited.length ?? 0}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Verified &amp; Rewarded</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="font-display text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            {loading ? '—' : rewardedCount}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Bonus Earned</span>
            <Gift className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-2 tabular-nums">
            {loading ? '—' : formatNaira(data?.totalEarned || 0, symbol)}
          </p>
        </div>
      </div>

      {/* Invited Friends List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Invited Friends ({data?.invited.length || 0})
          </h2>
          <span className="text-xs text-slate-500">
            Rewards unlock on first verified deposit
          </span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Loading invited users...</div>
        ) : !data || data.invited.length === 0 ? (
          <div className="py-12 text-center space-y-2 px-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No referrals yet.
            </p>
            <p className="text-xs text-slate-500">
              Share your link above — every friend who signs up and completes a verified deposit
              earns you {formatNaira(bonusAmount, symbol)}.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.invited.map((inv) => {
              const unlocked = Boolean(inv.rewarded || inv.deposited);
              return (
                <div
                  key={inv.id}
                  className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {inv.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {inv.email} · Joined {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {unlocked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified · +{formatNaira(bonusAmount, symbol)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      Awaiting First Deposit
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
