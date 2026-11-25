import React, { useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  Award,
  Bell,
  BookOpen,
  CheckCircle2,
  Crown,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Gift,
  Globe,
  KeyRound,
  Layers,
  LifeBuoy,
  Lock,
  Mail,
  Megaphone,
  Package,
  Percent,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, formatNaira } from '../../lib/api';
import type {
  AccountingRecord,
  AdminAlert,
  AdminFeatureTab,
  AuditLogEntry,
  BoostingOrder,
  PlatformSettings,
  PromoCode,
  PublicUser,
  SmsOrder,
  SmsPoolNumber,
  VisitorStats,
  WalletTransaction,
} from '../../types';
import type { AdminOverviewPayload } from './AdminCatalogAndCms';
import type { SeasonalThemeId } from '../SeasonalEffects';

export type PowerQuickToggleKey =
  | 'maintenanceMode'
  | 'autoApproveDeposits'
  | 'welcomePromoEnabled'
  | 'pinnedTickerEnabled'
  | 'allowNewSignups'
  | 'requireEmailVerification'
  | 'googleAuthEnabled'
  | 'enableSmsService'
  | 'enableBoostingService'
  | 'enableMarketplace'
  | 'allowPromoCodes'
  | 'supportAllowTickets'
  | 'showFloatingWhatsapp'
  | 'showLandingShowcase'
  | 'showLandingRates'
  | 'showPopularBadges'
  | 'leaderboardVisible';

type PowerDomain =
  | 'all'
  | 'pricing'
  | 'users'
  | 'sms_boost'
  | 'marketplace'
  | 'storefront'
  | 'support'
  | 'security';

interface PowerFeatureItem {
  id: string;
  title: string;
  description: string;
  domain: Exclude<PowerDomain, 'all'>;
  kind: 'toggle' | 'action' | 'jump';
  toggleKey?: PowerQuickToggleKey;
  targetTab?: AdminFeatureTab;
  badge?: string;
  actionId?:
    | 'bulk_approve_matched'
    | 'verify_pending_users'
    | 'sweep_sms'
    | 'export_users_csv'
    | 'export_accounting_csv'
    | 'export_json_backup'
    | 'season_christmas'
    | 'season_new_year'
    | 'season_black_friday'
    | 'season_none';
}

export interface AdminPowerSuiteData extends AdminOverviewPayload {
  metrics: {
    totalUsers: number;
    totalRevenue: number;
    totalDeposits: number;
    totalUserBalances: number;
    pendingDepositsCount: number;
    pendingBoostingCount: number;
    activeSmsCount: number;
    openTickets: number;
    unreadAlerts: number;
  };
  transactions: WalletTransaction[];
  smsOrders: SmsOrder[];
  smsPool: SmsPoolNumber[];
  boostingOrders: BoostingOrder[];
  adminAlerts: AdminAlert[];
  promoCodes: PromoCode[];
  auditLogs: AuditLogEntry[];
  accountingRecords?: AccountingRecord[];
  visitorStats?: VisitorStats;
}

interface AdminPowerSuitePanelProps {
  data: AdminPowerSuiteData;
  symbol: string;
  selectTab: (tab: AdminFeatureTab) => void;
  loadAdmin: () => Promise<void>;
  handleToggleQuickSetting: (key: PowerQuickToggleKey, val: boolean) => Promise<void>;
  handleSweepExpiredSms: () => Promise<void>;
  handleExportUsersCsv: () => void;
  handleExportAccountingCsv: () => void;
  handleExportJsonBackup: () => void;
  handleQuickSeasonApply: (seasonId: SeasonalThemeId) => Promise<void>;
  sweepingSms?: boolean;
  matchedPendingDepositsCount?: number;
}

const DOMAIN_META: {
  id: PowerDomain;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'all', label: 'All Controls', icon: Layers },
  { id: 'pricing', label: 'Pricing & Revenue', icon: Percent },
  { id: 'users', label: 'Users & Wallets', icon: Users },
  { id: 'sms_boost', label: 'SMS & Boosting', icon: Smartphone },
  { id: 'marketplace', label: 'Marketplace & Stock', icon: Package },
  { id: 'storefront', label: 'Storefront & Seasons', icon: Sparkles },
  { id: 'support', label: 'Support & Channels', icon: LifeBuoy },
  { id: 'security', label: 'Security & Audit', icon: ShieldCheck },
];

export function AdminPowerSuitePanel({
  data,
  symbol,
  selectTab,
  loadAdmin,
  handleToggleQuickSetting,
  handleSweepExpiredSms,
  handleExportUsersCsv,
  handleExportAccountingCsv,
  handleExportJsonBackup,
  handleQuickSeasonApply,
  sweepingSms = false,
  matchedPendingDepositsCount = 0,
}: AdminPowerSuitePanelProps) {
  const { user, notify, refreshCatalog } = useApp();
  const s = data.settings;

  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<PowerDomain>('all');

  // Bulk Price Adjuster State
  const [priceTarget, setPriceTarget] = useState<'marketplace' | 'sms' | 'boosting'>('marketplace');
  const [pricePct, setPricePct] = useState<number>(10);
  const [priceBusy, setPriceBusy] = useState(false);

  // Bulk Restock State
  const [restockTarget, setRestockTarget] = useState<'marketplace' | 'sms'>('marketplace');
  const [restockMode, setRestockMode] = useState<'add' | 'floor'>('add');
  const [restockAmount, setRestockAmount] = useState<number>(25);
  const [restockBusy, setRestockBusy] = useState(false);

  // Popular Tag Batch State
  const [popularTagInput, setPopularTagInput] = useState('Popular');
  const [popularBusy, setPopularBusy] = useState(false);

  // Batch Approve & Verify Users State
  const [batchApproving, setBatchApproving] = useState(false);
  const [verifyingUsers, setVerifyingUsers] = useState(false);

  // NEW 1: Flash Sale Auto-Discount Engine State
  const [flashEnabled, setFlashEnabled] = useState<boolean>(Boolean(s.flashSaleEnabled));
  const [flashLabel, setFlashLabel] = useState<string>(s.flashSaleLabel || 'Flash Deal');
  const [flashPercent, setFlashPercent] = useState<number>(Number(s.flashSalePercent ?? 15));
  const [flashTarget, setFlashTarget] = useState<'all' | 'marketplace' | 'sms' | 'boosting'>(
    s.flashSaleTarget || 'all',
  );
  const [flashEndsAt, setFlashEndsAt] = useState<string>(() => {
    if (!s.flashSaleEndsAt) return '';
    const d = new Date(s.flashSaleEndsAt);
    if (Number.isNaN(d.getTime())) return '';
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [savingFlashSale, setSavingFlashSale] = useState(false);

  // NEW 2: Bulk User Wallet Credit / Debit by Segment State
  const [walletSegment, setWalletSegment] = useState<
    'all' | 'verified' | 'zero_balance' | 'active_only'
  >('verified');
  const [walletMode, setWalletMode] = useState<'credit' | 'debit'>('credit');
  const [walletAmount, setWalletAmount] = useState<number>(500);
  const [walletNote, setWalletNote] = useState<string>('Creator Segment Reward');
  const [walletBulkBusy, setWalletBulkBusy] = useState(false);

  // NEW 3: Bulk Boosting Order Batch Processor State
  const [boostBatchBusy, setBoostBatchBusy] = useState(false);
  const [confirmCancelBoostBatch, setConfirmCancelBoostBatch] = useState(false);

  // NEW 4: Targeted Segment Broadcast Campaign State
  const [broadcastSegment, setBroadcastSegment] = useState<
    'all' | 'verified' | 'unfunded' | 'spenders'
  >('all');
  const [broadcastType, setBroadcastType] = useState<'info' | 'success' | 'warning'>('info');
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastEmail, setBroadcastEmail] = useState<boolean>(false);
  const [broadcastBusy, setBroadcastBusy] = useState(false);

  // NEW 5: Emergency Session Kill Switch State
  const [confirmKillSwitch, setConfirmKillSwitch] = useState(false);
  const [killSwitchBusy, setKillSwitchBusy] = useState(false);

  // NEW 6: JSON Store Backup Restore State (Main Admin only)
  const [backupJsonText, setBackupJsonText] = useState<string>('');
  const [confirmRestoreBackup, setConfirmRestoreBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);

  // Financial, SMS & Security Guardrails Form State
  const [minimumDeposit, setMinimumDeposit] = useState<number>(s.minimumDeposit ?? 500);
  const [maxDepositAmount, setMaxDepositAmount] = useState<number>(s.maxDepositAmount ?? 5000000);
  const [depositBonusPercent, setDepositBonusPercent] = useState<number>(
    s.depositBonusPercent ?? 0,
  );
  const [smsOrderExpiryMinutes, setSmsOrderExpiryMinutes] = useState<number>(
    s.smsOrderExpiryMinutes ?? 20,
  );
  const [referralBonusAmount, setReferralBonusAmount] = useState<number>(
    s.referralBonusAmount ?? 500,
  );
  const [welcomePromoAmount, setWelcomePromoAmount] = useState<number>(
    s.welcomePromoAmount ?? 250,
  );
  const [blockedDomainsText, setBlockedDomainsText] = useState<string>(
    (s.blockedEmailDomains || []).join(', '),
  );
  const [blockedNamesText, setBlockedNamesText] = useState<string>(
    (s.blockedNameKeywords || []).join(', '),
  );
  const [cannedRepliesText, setCannedRepliesText] = useState<string>(
    (s.supportCannedReplies || []).join('\n'),
  );
  const [savingGuardrails, setSavingGuardrails] = useState(false);

  const pendingUsersCount = useMemo(
    () => (data.users as PublicUser[]).filter((u) => u.emailVerified === false).length,
    [data.users],
  );
  const readySmsPoolCount = useMemo(
    () => data.smsPool.filter((p) => !p.used).length,
    [data.smsPool],
  );
  const lowStockCount = useMemo(
    () =>
      data.marketplaceListings.filter((l) => l.stock <= 3).length +
      data.smsServices.filter((svc) => svc.stock <= 5).length,
    [data.marketplaceListings, data.smsServices],
  );

  const handleBulkPriceAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setPriceBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; updatedCount: number; percent: number }>(
        '/api/admin/tools/bulk-price-adjust',
        {
          method: 'POST',
          body: JSON.stringify({ target: priceTarget, percent: Number(pricePct) }),
        },
      );
      notify(
        `Adjusted ${res.updatedCount} ${priceTarget} item(s) by ${res.percent >= 0 ? '+' : ''}${res.percent}%!`,
        'success',
      );
      await Promise.all([loadAdmin(), refreshCatalog()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Bulk price update failed', 'error');
    } finally {
      setPriceBusy(false);
    }
  };

  const handleBulkRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestockBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; updatedCount: number }>(
        '/api/admin/tools/bulk-restock',
        {
          method: 'POST',
          body: JSON.stringify({
            target: restockTarget,
            mode: restockMode,
            amount: Number(restockAmount),
          }),
        },
      );
      notify(`Updated stock on ${res.updatedCount} ${restockTarget} item(s)!`, 'success');
      await Promise.all([loadAdmin(), refreshCatalog()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Bulk restock failed', 'error');
    } finally {
      setRestockBusy(false);
    }
  };

  const handleBatchPopularTag = async (mode: 'apply' | 'clear') => {
    setPopularBusy(true);
    try {
      const nextTag = popularTagInput.trim() || 'Popular';
      const res = await apiFetch<{ ok: boolean; updatedCount: number }>(
        '/api/admin/tools/toggle-popular',
        {
          method: 'POST',
          body: JSON.stringify({
            popular: mode === 'apply',
            mode,
            popularTag: nextTag,
          }),
        },
      );
      notify(
        mode === 'apply'
          ? `Marked ${res.updatedCount} listings with "${nextTag}" badge!`
          : `Cleared popular badges across ${res.updatedCount} listings.`,
        'success',
      );
      await Promise.all([loadAdmin(), refreshCatalog()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Popular tag update failed', 'error');
    } finally {
      setPopularBusy(false);
    }
  };

  const handleBatchApproveMatched = async () => {
    setBatchApproving(true);
    try {
      const res = await apiFetch<{ ok: boolean; approvedCount: number }>(
        '/api/admin/transactions/bulk-approve-matched',
        { method: 'POST' },
      );
      notify(
        res.approvedCount > 0
          ? `Auto-approved ${res.approvedCount} AI-matched Moniepoint deposit(s)!`
          : 'No AI-matched pending deposits waiting right now.',
        res.approvedCount > 0 ? 'success' : 'info',
      );
      await loadAdmin();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Batch approve failed', 'error');
    } finally {
      setBatchApproving(false);
    }
  };

  const handleVerifyPendingUsers = async () => {
    setVerifyingUsers(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        verifiedUsers?: number;
        verifiedCount?: number;
        clearedPending?: number;
      }>(
        '/api/admin/tools/verify-pending-users',
        { method: 'POST' },
      );
      const count = res.verifiedUsers ?? res.verifiedCount ?? 0;
      notify(
        count > 0
          ? `Verified ${count} pending user email account(s)!`
          : 'All user accounts are already email-verified.',
        count > 0 ? 'success' : 'info',
      );
      await loadAdmin();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Verification sweep failed', 'error');
    } finally {
      setVerifyingUsers(false);
    }
  };

  const handleSaveGuardrails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGuardrails(true);
    try {
      const blockedEmailDomains = blockedDomainsText
        .split(/[\n,]+/)
        .map((d) => d.trim().toLowerCase().replace(/^@+/, ''))
        .filter(Boolean);
      const blockedNameKeywords = blockedNamesText
        .split(/[\n,]+/)
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      const supportCannedReplies = cannedRepliesText
        .split(/\n+/)
        .map((r) => r.trim())
        .filter(Boolean);

      await apiFetch<PlatformSettings>('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          minimumDeposit: Math.max(0, Number(minimumDeposit) || 0),
          maxDepositAmount: Math.max(100, Number(maxDepositAmount) || 5000000),
          depositBonusPercent: Math.max(0, Math.min(100, Number(depositBonusPercent) || 0)),
          smsOrderExpiryMinutes: Math.max(5, Math.min(120, Number(smsOrderExpiryMinutes) || 20)),
          referralBonusAmount: Math.max(0, Number(referralBonusAmount) || 0),
          welcomePromoAmount: Math.max(0, Number(welcomePromoAmount) || 0),
          blockedEmailDomains,
          blockedNameKeywords,
          supportCannedReplies,
        }),
      });
      await Promise.all([loadAdmin(), refreshCatalog()]);
      notify('Financial, SMS & Security guardrails saved permanently!', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save guardrails', 'error');
    } finally {
      setSavingGuardrails(false);
    }
  };

  const handleSaveFlashSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFlashSale(true);
    try {
      const endsIso = flashEndsAt.trim() ? new Date(flashEndsAt).toISOString() : '';
      await apiFetch<PlatformSettings>('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          flashSaleEnabled: flashEnabled,
          flashSaleLabel: flashLabel.trim() || 'Flash Deal',
          flashSalePercent: Math.max(1, Math.min(90, Number(flashPercent) || 1)),
          flashSaleTarget: flashTarget,
          flashSaleEndsAt: endsIso,
        }),
      });
      await Promise.all([loadAdmin(), refreshCatalog()]);
      notify(
        flashEnabled
          ? `Flash Sale "${flashLabel.trim() || 'Flash Deal'}" (-${flashPercent}%) is LIVE on ${flashTarget.toUpperCase()}!`
          : 'Flash Sale Auto-Discount Engine saved (OFF).',
        'success',
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save Flash Sale settings', 'error');
    } finally {
      setSavingFlashSale(false);
    }
  };

  const handleSegmentWalletBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletBulkBusy(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        affectedCount: number;
        totalAmount: number;
      }>('/api/admin/tools/bulk-credit-users', {
        method: 'POST',
        body: JSON.stringify({
          segment: walletSegment,
          mode: walletMode,
          amount: Math.max(1, Number(walletAmount) || 0),
          note: walletNote.trim(),
        }),
      });
      notify(
        `${walletMode === 'credit' ? 'Credited' : 'Debited'} ${res.affectedCount} user(s) · Total ${formatNaira(res.totalAmount, symbol)}`,
        'success',
      );
      await loadAdmin();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Bulk wallet operation failed', 'error');
    } finally {
      setWalletBulkBusy(false);
    }
  };

  const handleBoostBatchAction = async (
    action: 'complete_boosting' | 'cancel_refund_boosting',
  ) => {
    setBoostBatchBusy(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        updatedCount: number;
        refundedAmount: number;
      }>('/api/admin/tools/bulk-process-orders', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setConfirmCancelBoostBatch(false);
      notify(
        action === 'complete_boosting'
          ? `Marked ${res.updatedCount} active boosting order(s) completed!`
          : `Cancelled ${res.updatedCount} boosting order(s) and refunded ${formatNaira(res.refundedAmount, symbol)}.`,
        res.updatedCount > 0 ? 'success' : 'info',
      );
      await loadAdmin();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Bulk boosting batch failed', 'error');
    } finally {
      setBoostBatchBusy(false);
    }
  };

  const handleTargetedBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastBusy(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        recipientCount: number;
        sentEmails: number;
      }>('/api/admin/tools/targeted-broadcast', {
        method: 'POST',
        body: JSON.stringify({
          segment: broadcastSegment,
          type: broadcastType,
          title: broadcastTitle.trim(),
          message: broadcastMessage.trim(),
          sendEmail: broadcastEmail,
        }),
      });
      setBroadcastTitle('');
      setBroadcastMessage('');
      notify(
        `Broadcast sent to ${res.recipientCount} ${broadcastSegment} member(s)${
          res.sentEmails > 0 ? ` (${res.sentEmails} email(s) delivered)` : ''
        }!`,
        'success',
      );
      await loadAdmin();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Targeted broadcast failed', 'error');
    } finally {
      setBroadcastBusy(false);
    }
  };

  const handleForceLogoutAll = async () => {
    setKillSwitchBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; authSessionEpoch: number }>(
        '/api/admin/tools/force-logout-all',
        { method: 'POST' },
      );
      setConfirmKillSwitch(false);
      notify(
        `Emergency Kill Switch triggered! Session epoch bumped to v${res.authSessionEpoch}. All non-main-admin sessions logged out.`,
        'success',
      );
      await loadAdmin();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Kill switch request failed', 'error');
    } finally {
      setKillSwitchBusy(false);
    }
  };

  const handleBackupFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setBackupJsonText(text);
      notify(`Loaded backup file "${file.name}" (${Math.round(file.size / 1024)} KB)`, 'info');
    } catch {
      notify('Could not read selected JSON file', 'error');
    }
  };

  const handleImportBackupRestore = async () => {
    if (!backupJsonText.trim()) {
      notify('Paste JSON or pick a backup file first', 'error');
      return;
    }
    setRestoringBackup(true);
    try {
      const parsed = JSON.parse(backupJsonText) as Record<string, unknown>;
      const backupPayload =
        parsed.backup && typeof parsed.backup === 'object'
          ? parsed.backup
          : parsed.store && typeof parsed.store === 'object'
            ? parsed.store
            : parsed;
      const res = await apiFetch<{ ok: boolean; restoredParts: string[] }>(
        '/api/admin/tools/import-backup',
        {
          method: 'POST',
          body: JSON.stringify({ backup: backupPayload }),
        },
      );
      setConfirmRestoreBackup(false);
      notify(
        `Backup restored permanently (${res.restoredParts.join(', ')})!`,
        'success',
      );
      await Promise.all([loadAdmin(), refreshCatalog()]);
    } catch (err) {
      notify(
        err instanceof Error ? err.message : 'Invalid JSON or restore failed',
        'error',
      );
    } finally {
      setRestoringBackup(false);
    }
  };

  // Comprehensive 104+ Live Platform Features & Controls Registry
  const allControls = useMemo<PowerFeatureItem[]>(
    () => [
      // --- PRICING & REVENUE (15) ---
      { id: 'pr_cogs', title: 'Profit & COGS Margin Analyzer', description: 'Configure Marketplace, SMS & Boosting cost percentages for net profit tracking.', domain: 'pricing', kind: 'jump', targetTab: 'revenue', badge: 'Live P&L' },
      { id: 'pr_dep_bonus', title: 'Deposit Cashback Promo (%)', description: `Auto-credit +${s.depositBonusPercent ?? 0}% bonus on every verified Moniepoint deposit.`, domain: 'pricing', kind: 'jump', targetTab: 'settings', badge: `${s.depositBonusPercent ?? 0}%` },
      { id: 'pr_min_dep', title: 'Minimum Deposit Threshold', description: `Reject bank transfer requests below ${formatNaira(s.minimumDeposit || 500, symbol)}.`, domain: 'pricing', kind: 'jump', targetTab: 'settings', badge: formatNaira(s.minimumDeposit || 500, symbol) },
      { id: 'pr_max_dep', title: 'Maximum Single Deposit Cap', description: `Cap single deposit submissions at ${formatNaira(s.maxDepositAmount || 5000000, symbol)}.`, domain: 'pricing', kind: 'jump', targetTab: 'settings', badge: formatNaira(s.maxDepositAmount || 5000000, symbol) },
      { id: 'pr_promo_toggle', title: 'Checkout Promo & Coupon Codes', description: 'Enable or pause promo code redemption across Storefront, SMS & Boosting.', domain: 'pricing', kind: 'toggle', toggleKey: 'allowPromoCodes' },
      { id: 'pr_promo_mgr', title: 'Coupon & Discount Generator', description: `${data.promoCodes.length} active or archived discount codes with usage limits.`, domain: 'pricing', kind: 'jump', targetTab: 'promos', badge: `${data.promoCodes.length} codes` },
      { id: 'pr_welcome_toggle', title: 'Welcome Signup Bonus Credit', description: `Automatically credit ${formatNaira(s.welcomePromoAmount || 0, symbol)} to newly verified users.`, domain: 'pricing', kind: 'toggle', toggleKey: 'welcomePromoEnabled' },
      { id: 'pr_ref_bonus', title: 'Referral Commission Reward', description: `Pay ${formatNaira(s.referralBonusAmount || 0, symbol)} referrer bonus on invited friend deposit.`, domain: 'pricing', kind: 'jump', targetTab: 'settings', badge: formatNaira(s.referralBonusAmount || 0, symbol) },
      { id: 'pr_ai_auto', title: 'AI Receipt Auto-Credit Engine', description: 'Automatically approve and credit wallet deposits when Moniepoint AI audit matches.', domain: 'pricing', kind: 'toggle', toggleKey: 'autoApproveDeposits' },
      { id: 'pr_bulk_match', title: 'Batch Approve Matched Receipts', description: `Approve all ${matchedPendingDepositsCount} AI-verified pending deposits in 1 click.`, domain: 'pricing', kind: 'action', actionId: 'bulk_approve_matched', badge: `${matchedPendingDepositsCount} ready` },
      { id: 'pr_bank_cfg', title: 'Moniepoint Settlement Account', description: `${s.bankName || 'Moniepoint'} · ${s.bankAccountNumber || '—'} receipt instructions.`, domain: 'pricing', kind: 'jump', targetTab: 'settings' },
      { id: 'pr_currency', title: 'Currency Symbol & Locale', description: `Storewide price prefix currently set to "${symbol}".`, domain: 'pricing', kind: 'jump', targetTab: 'settings' },
      { id: 'pr_acc_archive', title: 'Permanent Accounting Archive', description: `${(data.accountingRecords || []).length} immutable sales, deposit & refund ledger records.`, domain: 'pricing', kind: 'jump', targetTab: 'accounting', badge: `${(data.accountingRecords || []).length}` },
      { id: 'pr_acc_csv', title: 'Export Accounting CSV Ledger', description: 'Download filtered financial records for external spreadsheets & tax reports.', domain: 'pricing', kind: 'action', actionId: 'export_accounting_csv' },
      { id: 'pr_alt_tier', title: 'SMS Alternate Tier Markup/Discount', description: `Alternate SMS server set to ${s.smsAlternateMode === 'markup' ? `+${s.smsAlternateDiscountPct ?? 15}% higher` : `-${s.smsAlternateDiscountPct ?? 15}% lower`}.`, domain: 'pricing', kind: 'jump', targetTab: 'catalog' },

      // --- USERS & WALLETS (15) ---
      { id: 'us_directory', title: 'Full User Directory & Balances', description: `Inspect, credit, debit, edit, suspend, or delete across ${data.users.length} accounts.`, domain: 'users', kind: 'jump', targetTab: 'users', badge: `${data.users.length} users` },
      { id: 'us_signups', title: 'Public Account Registrations', description: 'Open or temporarily close new user signups across login & hero CTA.', domain: 'users', kind: 'toggle', toggleKey: 'allowNewSignups' },
      { id: 'us_email_otp', title: '6-Digit Email Code Verification', description: 'Require direct inbox verification OTP before new accounts become active.', domain: 'users', kind: 'toggle', toggleKey: 'requireEmailVerification' },
      { id: 'us_google_auth', title: 'Google One-Tap Sign-Up & Login', description: 'Let customers sign in or register in 1 tap with verified Google OAuth.', domain: 'users', kind: 'toggle', toggleKey: 'googleAuthEnabled' },
      { id: 'us_verify_sweep', title: 'Verify All Pending Email Users', description: `Instantly mark ${pendingUsersCount} unverified account(s) as email-verified.`, domain: 'users', kind: 'action', actionId: 'verify_pending_users', badge: `${pendingUsersCount} pending` },
      { id: 'us_360', title: 'User 360° Full Activity Inspector', description: 'Inspect wallet history, SMS rentals, Vault deliveries, boosting, referrals & timeline.', domain: 'users', kind: 'jump', targetTab: 'users' },
      { id: 'us_impersonate', title: 'Live User View (Impersonation)', description: 'Browse the full live website exactly as any customer sees it with safe return.', domain: 'users', kind: 'jump', targetTab: 'users' },
      { id: 'us_airdrop', title: 'Creator Mass Wallet Airdrop', description: 'Credit bonus loyalty rewards to all active wallets with broadcast alerts.', domain: 'users', kind: 'jump', targetTab: 'overview' },
      { id: 'us_bulk_actions', title: 'Multi-Select User Bulk Actions', description: 'Select multiple accounts to credit, debit, suspend, activate, or notify at once.', domain: 'users', kind: 'jump', targetTab: 'users' },
      { id: 'us_create_acc', title: 'Provision New User / Sub-Admin', description: 'Create ready-to-use accounts with preset wallet balance and role.', domain: 'users', kind: 'jump', targetTab: 'users' },
      { id: 'us_pass_reset', title: 'Instant Password Override', description: 'Reset any non-protected user password directly from User Directory.', domain: 'users', kind: 'jump', targetTab: 'users' },
      { id: 'us_avatar_edit', title: 'User Avatar & Referral Code Editor', description: 'Upload custom user avatars or customize referral invite codes.', domain: 'users', kind: 'jump', targetTab: 'users' },
      { id: 'us_leaderboard', title: 'Wallet & Referral Visibility', description: 'Toggle referral leaderboard / reward visibility across member overview.', domain: 'users', kind: 'toggle', toggleKey: 'leaderboardVisible' },
      { id: 'us_csv', title: 'Export All Users CSV', description: 'Download complete member directory with balances, roles, status & codes.', domain: 'users', kind: 'action', actionId: 'export_users_csv' },
      { id: 'us_subadmins', title: 'Single-Feature Sub-Admin Delegation', description: 'Assign helper admins locked strictly to 1 Overwatch module.', domain: 'users', kind: 'jump', targetTab: 'team' },

      // --- SMS & BOOSTING (14) ---
      { id: 'sb_sms_toggle', title: 'Virtual SMS Numbers Service', description: 'Master switch to enable or pause virtual OTP number rentals globally.', domain: 'sms_boost', kind: 'toggle', toggleKey: 'enableSmsService' },
      { id: 'sb_boost_toggle', title: 'Social Boosting Desk Service', description: 'Master switch to enable or pause social growth & engagement campaigns.', domain: 'sms_boost', kind: 'toggle', toggleKey: 'enableBoostingService' },
      { id: 'sb_sms_desk', title: 'Dedicated SMS Numbers & Pool Desk', description: `${readySmsPoolCount} ready pool numbers · ${data.metrics.activeSmsCount} waiting OTP.`, domain: 'sms_boost', kind: 'jump', targetTab: 'sms_numbers', badge: `${readySmsPoolCount} ready` },
      { id: 'sb_bulk_pool', title: 'Bulk SMS Pool Importer (Pipe Format)', description: 'Paste +number | otp lines to load dozens of virtual numbers in seconds.', domain: 'sms_boost', kind: 'jump', targetTab: 'sms_numbers' },
      { id: 'sb_otp_push', title: 'Instant Live OTP Code Injector', description: 'Push verification codes or assign phone numbers to waiting user orders.', domain: 'sms_boost', kind: 'jump', targetTab: 'sms_numbers' },
      { id: 'sb_sms_sweep', title: 'Sweep & Auto-Refund Expired SMS', description: 'Refund waiting SMS orders whose countdown timer expired without an OTP.', domain: 'sms_boost', kind: 'action', actionId: 'sweep_sms' },
      { id: 'sb_sms_expiry', title: 'Dynamic SMS Rental Expiry Timer', description: `OTP waiting countdown currently set to ${s.smsOrderExpiryMinutes ?? 20} minutes.`, domain: 'sms_boost', kind: 'jump', targetTab: 'settings', badge: `${s.smsOrderExpiryMinutes ?? 20}m` },
      { id: 'sb_sms_svcs', title: 'SMS Apps & Base Pricing', description: `Manage ${data.smsServices.length} SMS services (WhatsApp, Telegram, OpenAI, etc.).`, domain: 'sms_boost', kind: 'jump', targetTab: 'catalog', badge: `${data.smsServices.length} apps` },
      { id: 'sb_sms_cnt', title: 'Country Multipliers & Dial Codes', description: `Configure ${data.smsCountries.length} country multipliers and flags.`, domain: 'sms_boost', kind: 'jump', targetTab: 'catalog', badge: `${data.smsCountries.length} countries` },
      { id: 'sb_pool_clear', title: 'Pool Cleanup (Ready / Used / All)', description: 'Purge consumed or outdated pool numbers in 1 click.', domain: 'sms_boost', kind: 'jump', targetTab: 'sms_numbers' },
      { id: 'sb_boost_queue', title: 'Boosting Order Status Pipeline', description: `${data.metrics.pendingBoostingCount} pending campaigns · Pending -> Processing -> Completed / Refund.`, domain: 'sms_boost', kind: 'jump', targetTab: 'orders', badge: `${data.metrics.pendingBoostingCount} pending` },
      { id: 'sb_boost_pkg', title: 'Boosting Packages & Min/Max Limits', description: `Edit ${data.boostingServices.length} social packages, rate per 1k & refill rules.`, domain: 'sms_boost', kind: 'jump', targetTab: 'catalog', badge: `${data.boostingServices.length} pkgs` },
      { id: 'sb_sms_labels', title: 'Prime vs Alternate Server Naming', description: 'Rename Prime/Alternate labels and descriptions shown on SMS panel.', domain: 'sms_boost', kind: 'jump', targetTab: 'catalog' },
      { id: 'sb_sms_refund', title: 'Manual SMS Cancel & Wallet Refund', description: 'Cancel any waiting SMS rental and return full funds to user wallet.', domain: 'sms_boost', kind: 'jump', targetTab: 'sms_numbers' },

      // --- MARKETPLACE & STOCK (14) ---
      { id: 'mk_toggle', title: 'Marketplace & Digital Vault', description: 'Master switch for buying proxies, VPNs, creator accounts & custom sections.', domain: 'marketplace', kind: 'toggle', toggleKey: 'enableMarketplace' },
      { id: 'mk_popular_badges', title: 'Popular Badges on Product Cards', description: 'Show or hide highlighted popular tags directly on marketplace product banners.', domain: 'marketplace', kind: 'toggle', toggleKey: 'showPopularBadges' },
      { id: 'mk_listings', title: 'Marketplace Listings & Vault Keys', description: `Manage ${data.marketplaceListings.length} digital products, banners & credential pools.`, domain: 'marketplace', kind: 'jump', targetTab: 'catalog', badge: `${data.marketplaceListings.length} items` },
      { id: 'mk_categories', title: 'Marketplace Category Organizer', description: `Add, rename, reorder & color-coordinate ${data.marketplaceCategories.length} categories.`, domain: 'marketplace', kind: 'jump', targetTab: 'catalog', badge: `${data.marketplaceCategories.length} cats` },
      { id: 'mk_custom_sec', title: 'Custom Storefront Sections Studio', description: `Manage ${data.customSections.length} extra workspace tabs with custom products & stock.`, domain: 'marketplace', kind: 'jump', targetTab: 'catalog', badge: `${data.customSections.length} sections` },
      { id: 'mk_banners_fit', title: 'Product Cover Banner & Inline Logo', description: 'Upload crisp cover photos & animated logos per product card.', domain: 'marketplace', kind: 'jump', targetTab: 'catalog' },
      { id: 'mk_buy_warn', title: 'Global & Per-Product Buyer Warnings', description: 'Customize yellow/rose safety alerts shown inside purchase checkout modal.', domain: 'marketplace', kind: 'jump', targetTab: 'catalog' },
      { id: 'mk_low_stock', title: 'Low-Stock Inventory Radar', description: `${lowStockCount} marketplace or SMS items currently at low inventory threshold.`, domain: 'marketplace', kind: 'jump', targetTab: 'catalog', badge: `${lowStockCount} low` },
      { id: 'mk_vault_log', title: 'Delivered Vault Credentials Log', description: `Search, copy, inspect buyer, or clear Overwatch vault delivery feed.`, domain: 'marketplace', kind: 'jump', targetTab: 'orders' },
      { id: 'mk_reorder', title: 'Drag / Top / Up / Down Reordering', description: 'Pin featured products to #1 Top or reorder category sequence anytime.', domain: 'marketplace', kind: 'jump', targetTab: 'catalog' },
      { id: 'mk_multi_qty', title: 'Multi-Quantity Credential Delivery', description: 'Automatically pull unique credential lines per unit when users buy 2x+.', domain: 'marketplace', kind: 'jump', targetTab: 'catalog' },
      { id: 'mk_duplicate', title: '1-Click Listing Cloner', description: 'Duplicate any product card with settings, pricing, and banner intact.', domain: 'marketplace', kind: 'jump', targetTab: 'catalog' },
      { id: 'mk_inline_edit', title: 'Inline Price & Stock Quick Edit', description: 'Edit listing price and stock numbers directly in Catalog table.', domain: 'marketplace', kind: 'jump', targetTab: 'catalog' },
      { id: 'mk_bulk_select', title: 'Multi-Select Catalog Pause/Resume', description: 'Select multiple marketplace products to pause, activate, or delete in bulk.', domain: 'marketplace', kind: 'jump', targetTab: 'catalog' },

      // --- STOREFRONT & SEASONS (16) ---
      { id: 'sf_showcase', title: 'Landing Showcase Picture Cards', description: 'Show or hide the visual feature showcase grid on public storefront.', domain: 'storefront', kind: 'toggle', toggleKey: 'showLandingShowcase' },
      { id: 'sf_rates', title: 'Landing Live Pricing Preview', description: 'Show or hide real-time SMS & Boosting price table on landing page.', domain: 'storefront', kind: 'toggle', toggleKey: 'showLandingRates' },
      { id: 'sf_ticker', title: 'Pinned Scrolling Marquee Ticker', description: 'Display scrolling announcement bar at the top of user workspace.', domain: 'storefront', kind: 'toggle', toggleKey: 'pinnedTickerEnabled' },
      { id: 'sf_xmas', title: 'Activate Christmas Season Mode', description: 'Turn on festive Christmas snow accents, holiday ribbon & greeting banner.', domain: 'storefront', kind: 'action', actionId: 'season_christmas', badge: s.seasonalTheme === 'christmas' ? 'ACTIVE' : 'Apply' },
      { id: 'sf_newyear', title: 'Activate New Year Celebration', description: 'Turn on gold & fireworks New Year storefront atmosphere.', domain: 'storefront', kind: 'action', actionId: 'season_new_year', badge: s.seasonalTheme === 'new_year' ? 'ACTIVE' : 'Apply' },
      { id: 'sf_blkfri', title: 'Activate Black Friday Promo Mode', description: 'Turn on high-contrast Black Friday deal ribbon across storefront.', domain: 'storefront', kind: 'action', actionId: 'season_black_friday', badge: s.seasonalTheme === 'black_friday' ? 'ACTIVE' : 'Apply' },
      { id: 'sf_std_season', title: 'Restore Standard Storefront Mode', description: 'Turn off seasonal celebration overlays and banners immediately.', domain: 'storefront', kind: 'action', actionId: 'season_none' },
      { id: 'sf_brand_mix', title: 'Dual-Color Brand Name Mixer', description: 'Customize SureDeal Store light & dark mode gradient / word colors.', domain: 'storefront', kind: 'jump', targetTab: 'settings' },
      { id: 'sf_site_logo', title: 'Permanent Website Logo Uploader', description: 'Upload permanent brand icon displayed across header, auth & sidebar.', domain: 'storefront', kind: 'jump', targetTab: 'cms' },
      { id: 'sf_dash_banners', title: 'User Dashboard Promo Banners', description: `${(s.dashboardBanners || []).filter((b) => b.active).length} active image banner(s) displayed directly under Dashboard Overview.`, domain: 'storefront', kind: 'jump', targetTab: 'cms' },
      { id: 'sf_hero_copy', title: 'Landing Hero Headline & CTAs', description: 'Edit landing kicker, main headline, subheadline & button labels.', domain: 'storefront', kind: 'jump', targetTab: 'cms' },
      { id: 'sf_stats_row', title: 'Landing Trust Metrics Row', description: 'Edit hero stats counters (uptime, deliveries, countries, support).', domain: 'storefront', kind: 'jump', targetTab: 'cms' },
      { id: 'sf_workflow', title: '3-Step How-It-Works Designer', description: 'Customize onboarding workflow titles and descriptions on homepage.', domain: 'storefront', kind: 'jump', targetTab: 'cms' },
      { id: 'sf_wallet_copy', title: 'Wallet & Workspace Copy Editor', description: 'Edit every write-up on Dashboard Overview, Wallet, Orders, SMS, Boosting & Settings.', domain: 'storefront', kind: 'jump', targetTab: 'copy' },
      { id: 'sf_footer_credit', title: 'Storefront Footer & Brand Attribution', description: 'Customize footer disclaimer, contact email & made-by attribution.', domain: 'storefront', kind: 'jump', targetTab: 'cms' },
      { id: 'sf_dash_notice', title: 'Top Dashboard Alert Notice Box', description: 'Edit tone (amber/info/emerald/rose) & notice copy above user dashboard.', domain: 'storefront', kind: 'jump', targetTab: 'copy' },

      // --- SUPPORT & CHANNELS (14) ---
      { id: 'su_tickets_on', title: 'Support Ticket Submissions', description: 'Allow or temporarily pause customers opening new in-app support tickets.', domain: 'support', kind: 'toggle', toggleKey: 'supportAllowTickets' },
      { id: 'su_wa_ball', title: 'Floating Green WhatsApp Bubble', description: 'Show or hide bottom-right quick WhatsApp support button sitewide.', domain: 'support', kind: 'toggle', toggleKey: 'showFloatingWhatsapp' },
      { id: 'su_designer', title: 'Support Desk Layout & Theme Designer', description: 'Switch split/stacked grid, surface theme, SLA badge, WhatsApp & Telegram cards.', domain: 'support', kind: 'jump', targetTab: 'support' },
      { id: 'su_inbox', title: 'Live Support Ticket Inbox', description: `${data.metrics.openTickets} open ticket(s) waiting for reply or resolution.`, domain: 'support', kind: 'jump', targetTab: 'support', badge: `${data.metrics.openTickets} open` },
      { id: 'su_wa_group', title: 'Copyable Official Community Group Link', description: 'Configure WhatsApp or Telegram group URL users can copy in 1 tap.', domain: 'support', kind: 'jump', targetTab: 'support' },
      { id: 'su_canned', title: 'Support Ticket Quick Canned Replies', description: `${(s.supportCannedReplies || []).length} 1-click reply templates for fast ticket responses.`, domain: 'support', kind: 'jump', targetTab: 'support', badge: `${(s.supportCannedReplies || []).length} templates` },
      { id: 'su_tg_handle', title: 'Telegram Direct Support Handle', description: `Configure Telegram DM handle (${s.supportTelegram || 'Not set'}).`, domain: 'support', kind: 'jump', targetTab: 'support' },
      { id: 'su_wa_num', title: 'WhatsApp Official Support Line', description: `Direct WhatsApp support line (${s.supportWhatsapp || '+2347031537390'}).`, domain: 'support', kind: 'jump', targetTab: 'support' },
      { id: 'su_broadcast', title: 'Global User Broadcast Alerts', description: 'Push sitewide info/success/warning banners to every member inbox.', domain: 'support', kind: 'jump', targetTab: 'notifications' },
      { id: 'su_dm_notif', title: 'Targeted Private User Notification', description: 'Search any user by name/email and send a private workspace alert.', domain: 'support', kind: 'jump', targetTab: 'notifications' },
      { id: 'su_email_out', title: 'Direct Outbound User Email Tool', description: 'Compose and dispatch formatted direct emails to any customer.', domain: 'support', kind: 'jump', targetTab: 'notifications' },
      { id: 'su_tutorials', title: 'User Video & Help Tutorials CMS', description: `${data.tutorials.length} published step-by-step guides inside user workspace.`, domain: 'support', kind: 'jump', targetTab: 'tutorials', badge: `${data.tutorials.length} guides` },
      { id: 'su_notify_phone', title: 'Admin Alert Notification Phone', description: 'Set owner phone/WhatsApp target for system alert routing.', domain: 'support', kind: 'jump', targetTab: 'settings' },
      { id: 'su_notif_clear', title: 'Broadcast History Cleanup', description: 'Remove outdated global or personal notifications cleanly.', domain: 'support', kind: 'jump', targetTab: 'notifications' },

      // --- SECURITY & AUDIT (16) ---
      { id: 'sc_maint', title: 'Maintenance Mode Lockdown', description: 'Block standard user logins with custom maintenance banner (admins bypass).', domain: 'security', kind: 'toggle', toggleKey: 'maintenanceMode' },
      { id: 'sc_live_mon', title: 'Live Monitor Pro Telemetry', description: `${(data.visitorStats?.recentSessions || []).length} live session(s) · realtime firehose & audio alerts.`, domain: 'security', kind: 'jump', targetTab: 'live' },
      { id: 'sc_audit', title: 'Immutable Admin Audit Trail', description: `${data.auditLogs.length} recorded admin edits, approvals, refunds & config changes.`, domain: 'security', kind: 'jump', targetTab: 'audit', badge: `${data.auditLogs.length} logs` },
      { id: 'sc_owner_shield', title: 'Protected Main Admin Shield', description: `Owner (${s.mainAdminEmail || 'chibuikeexcellent592@gmail.com'}) cannot be deleted, demoted, or suspended.`, domain: 'security', kind: 'jump', targetTab: 'team' },
      { id: 'sc_owner_email', title: 'Change Main Admin Login Email', description: 'Password-verified Main Admin owner email transfer control.', domain: 'security', kind: 'jump', targetTab: 'team' },
      { id: 'sc_blocked_domains', title: 'Blocked Signup Email Domains', description: `${(s.blockedEmailDomains || []).length} disposable/blocked domain(s) auto-rejected at registration.`, domain: 'security', kind: 'jump', targetTab: 'settings', badge: `${(s.blockedEmailDomains || []).length} blocked` },
      { id: 'sc_receipt_dup', title: 'Duplicate Receipt Reference Guard', description: 'AI receipt scanner flags reused Moniepoint transaction references automatically.', domain: 'security', kind: 'jump', targetTab: 'orders' },
      { id: 'sc_backup_json', title: 'Full Overwatch JSON Snapshot Backup', description: 'Download complete settings, catalog, users, ledger & orders JSON archive.', domain: 'security', kind: 'action', actionId: 'export_json_backup' },
      { id: 'sc_refresh_ops', title: 'Safe Queue Reset (Preserve Users & Catalog)', description: 'Clear active order queues while retaining users, balances, products & Archive.', domain: 'security', kind: 'jump', targetTab: 'overview' },
      { id: 'sc_clear_orders', title: 'Overwatch Queue Cleanup (Completed/All)', description: 'Hide completed queues from Overwatch without erasing customer receipts.', domain: 'security', kind: 'jump', targetTab: 'orders' },
      { id: 'sc_clear_tx', title: 'Scoped Transaction View Cleanup', description: 'Clear deposits/purchases/refunds from Overwatch view safely.', domain: 'security', kind: 'jump', targetTab: 'orders' },
      { id: 'sc_clear_audit', title: 'Purge Audit Log History', description: 'Clear older audit trail entries after exporting backup.', domain: 'security', kind: 'jump', targetTab: 'audit' },
      { id: 'sc_session_inspect', title: 'Visitor Device & Path Tracker', description: 'Monitor active visitor browsers, OS versions, and visited sections live.', domain: 'security', kind: 'jump', targetTab: 'live' },
      { id: 'sc_cmd_palette', title: 'Overwatch Quick-Jump Palette (⌘K)', description: 'Press Ctrl+K / ⌘K anywhere in Overwatch to search users, tabs & tools.', domain: 'security', kind: 'jump', targetTab: 'overview' },
      // --- NEW POWER SUITE ENGINES ---
      { id: 'pr_flash_sale', title: 'Flash Sale Auto-Discount Engine', description: `Automated sitewide checkout discount (${s.flashSaleEnabled ? `ACTIVE -${s.flashSalePercent ?? 15}%` : 'OFF'}) with optional expiry.`, domain: 'pricing', kind: 'jump', targetTab: 'power_suite', badge: s.flashSaleEnabled ? `-${s.flashSalePercent ?? 15}%` : 'OFF' },
      { id: 'us_bulk_wallet_seg', title: 'Bulk Segment Wallet Credit / Debit', description: 'Credit or debit verified, zero-balance, active, or all member wallets in 1 batch.', domain: 'users', kind: 'jump', targetTab: 'power_suite' },
      { id: 'sb_boost_batch', title: 'Bulk Boosting Order Batch Processor', description: 'Complete all active boosting campaigns or cancel & auto-refund queues cleanly.', domain: 'sms_boost', kind: 'jump', targetTab: 'power_suite' },
      { id: 'su_targeted_camp', title: 'Targeted Segment Broadcast Campaign', description: 'Send workspace + email campaigns to verified, unfunded, spender, or all users.', domain: 'support', kind: 'jump', targetTab: 'power_suite' },
      { id: 'sc_kill_switch', title: 'Emergency Session Kill Switch', description: `Force-logout all non-main-admin sessions instantly (Session Epoch v${s.authSessionEpoch ?? 1}).`, domain: 'security', kind: 'jump', targetTab: 'power_suite', badge: `v${s.authSessionEpoch ?? 1}` },
      { id: 'sc_blocked_names', title: 'Blocked Signup Name Keywords Guard', description: `${(s.blockedNameKeywords || []).length} spam/restricted name keyword(s) rejected at signup.`, domain: 'security', kind: 'jump', targetTab: 'power_suite' },
      { id: 'sc_restore_json', title: 'Full JSON Store Backup Import / Restore', description: 'Main Admin restore of settings, listings, categories, SMS, boosting & sections from JSON.', domain: 'security', kind: 'jump', targetTab: 'power_suite' },
      { id: 'sc_alerts_read', title: 'Unread Admin Alert Counter', description: `${data.metrics.unreadAlerts} unread operational alert(s) tracked in Overwatch.`, domain: 'security', kind: 'jump', targetTab: 'live', badge: `${data.metrics.unreadAlerts}` },
      { id: 'sc_sync_now', title: 'Force Sync Full Backend State', description: 'Pull fresh snapshot from server database and synchronize storefront.', domain: 'security', kind: 'jump', targetTab: 'overview' },
    ],
    [
      data.accountingRecords,
      data.auditLogs.length,
      data.boostingServices.length,
      data.customSections.length,
      data.marketplaceCategories.length,
      data.marketplaceListings.length,
      data.metrics.activeSmsCount,
      data.metrics.openTickets,
      data.metrics.pendingBoostingCount,
      data.metrics.unreadAlerts,
      data.promoCodes.length,
      data.smsCountries.length,
      data.smsServices.length,
      data.tutorials.length,
      data.users.length,
      data.visitorStats?.recentSessions,
      lowStockCount,
      matchedPendingDepositsCount,
      pendingUsersCount,
      readySmsPoolCount,
      s.bankAccountNumber,
      s.bankName,
      s.blockedEmailDomains,
      s.dashboardBanners,
      s.depositBonusPercent,
      s.mainAdminEmail,
      s.maxDepositAmount,
      s.minimumDeposit,
      s.referralBonusAmount,
      s.seasonalTheme,
      s.smsAlternateDiscountPct,
      s.smsAlternateMode,
      s.smsOrderExpiryMinutes,
      s.supportCannedReplies,
      s.supportTelegram,
      s.supportWhatsapp,
      s.welcomePromoAmount,
      symbol,
    ],
  );

  const filteredControls = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allControls.filter((item) => {
      const matchDomain = domain === 'all' || item.domain === domain;
      const matchQ =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.domain.toLowerCase().includes(q);
      return matchDomain && matchQ;
    });
  }, [allControls, domain, query]);

  const runAction = async (actionId: NonNullable<PowerFeatureItem['actionId']>) => {
    switch (actionId) {
      case 'bulk_approve_matched':
        await handleBatchApproveMatched();
        return;
      case 'verify_pending_users':
        await handleVerifyPendingUsers();
        return;
      case 'sweep_sms':
        await handleSweepExpiredSms();
        return;
      case 'export_users_csv':
        handleExportUsersCsv();
        return;
      case 'export_accounting_csv':
        handleExportAccountingCsv();
        return;
      case 'export_json_backup':
        handleExportJsonBackup();
        return;
      case 'season_christmas':
        await handleQuickSeasonApply('christmas');
        return;
      case 'season_new_year':
        await handleQuickSeasonApply('new_year');
        return;
      case 'season_black_friday':
        await handleQuickSeasonApply('black_friday');
        return;
      case 'season_none':
        await handleQuickSeasonApply('none');
        return;
    }
  };

  return (
    <div className="space-y-6">
      {/* Legendary Hero Header */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white border border-blue-500/30 p-6 shadow-xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
              <Crown className="w-3.5 h-3.5" />
              Overwatch Legendary Power Suite · {allControls.length}+ Controls
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
              Master Automation, Bulk Operations &amp; Platform Guardrails
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Search and operate every storefront switch, batch price/stock studio, deposit cashback rule, email security policy, and operations shortcut from one high-speed desk.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={batchApproving}
              onClick={() => void handleBatchApproveMatched()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {batchApproving
                ? 'Approving...'
                : `Approve Matched (${matchedPendingDepositsCount})`}
            </button>
            <button
              type="button"
              disabled={verifyingUsers}
              onClick={() => void handleVerifyPendingUsers()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              <UserCheck className="w-3.5 h-3.5" />
              {verifyingUsers ? 'Verifying...' : `Verify Pending (${pendingUsersCount})`}
            </button>
            <button
              type="button"
              disabled={sweepingSms}
              onClick={() => void handleSweepExpiredSms()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sweepingSms ? 'animate-spin' : ''}`} />
              Sweep SMS
            </button>
          </div>
        </div>

        {/* Flex Search Bar (Cross-Browser Aligned) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/30">
            <Search className="w-4 h-4 text-slate-300 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search all ${allControls.length}+ Overwatch features (e.g. price, cashback, sms, christmas, block, backup)...`}
              className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-300/80 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
                aria-label="Clear feature search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/10 border border-white/15 text-xs font-mono font-bold text-amber-300 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            {filteredControls.length} / {allControls.length} matched
          </span>
        </div>

        {/* 8 Domain Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DOMAIN_META.map((dm) => {
            const Icon = dm.icon;
            const active = domain === dm.id;
            const count =
              dm.id === 'all'
                ? allControls.length
                : allControls.filter((c) => c.domain === dm.id).length;
            return (
              <button
                key={dm.id}
                type="button"
                onClick={() => setDomain(dm.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{dm.label}</span>
                <span className="opacity-75 font-mono text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Automation Studios Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1. Bulk Price Adjuster */}
        <form
          onSubmit={handleBulkPriceAdjust}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5"
        >
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Percent className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Bulk Catalog Price Studio
              </h2>
              <p className="text-[11px] text-slate-500">
                Raise or discount every rate across an entire catalog by %
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Catalog Target
              </label>
              <select
                value={priceTarget}
                onChange={(e) =>
                  setPriceTarget(e.target.value as 'marketplace' | 'sms' | 'boosting')
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold"
              >
                <option value="marketplace">Marketplace ({data.marketplaceListings.length})</option>
                <option value="sms">SMS Services ({data.smsServices.length})</option>
                <option value="boosting">Boosting ({data.boostingServices.length})</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                % Change (-50 to +200)
              </label>
              <input
                type="number"
                min={-50}
                max={200}
                step={1}
                required
                value={pricePct}
                onChange={(e) => setPricePct(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={priceBusy || pricePct === 0}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {priceBusy
              ? 'Applying Prices...'
              : `Apply ${pricePct >= 0 ? '+' : ''}${pricePct}% Across ${priceTarget.toUpperCase()}`}
          </button>
        </form>

        {/* 2. Bulk Inventory Replenisher */}
        <form
          onSubmit={handleBulkRestock}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5"
        >
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Bulk Inventory Replenisher
              </h2>
              <p className="text-[11px] text-slate-500">
                Top up stock quantities or set a minimum floor across items
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Target</label>
              <select
                value={restockTarget}
                onChange={(e) => setRestockTarget(e.target.value as 'marketplace' | 'sms')}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold"
              >
                <option value="marketplace">Marketplace</option>
                <option value="sms">SMS Apps</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Mode</label>
              <select
                value={restockMode}
                onChange={(e) => setRestockMode(e.target.value as 'add' | 'floor')}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold"
              >
                <option value="add">Add (+)</option>
                <option value="floor">Min Floor</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Qty</label>
              <input
                type="number"
                min={1}
                max={100000}
                required
                value={restockAmount}
                onChange={(e) => setRestockAmount(Number(e.target.value))}
                className="w-full px-2.5 py-2 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={restockBusy}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {restockBusy
              ? 'Updating Stock...'
              : restockMode === 'add'
                ? `Add +${restockAmount} Stock to All ${restockTarget}`
                : `Ensure Min ${restockAmount} Stock on All ${restockTarget}`}
          </button>
        </form>

        {/* 3. Popularity Tag Batch Manager */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Popular Badges Batch Studio
              </h2>
              <p className="text-[11px] text-slate-500">
                Tag top products with &ldquo;Popular&rdquo; or toggle card badges live
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <label className="block text-[11px] font-semibold text-slate-500">
              Batch Popular Badge Label
            </label>
            <input
              type="text"
              value={popularTagInput}
              onChange={(e) => setPopularTagInput(e.target.value)}
              placeholder="Popular"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={popularBusy}
              onClick={() => void handleBatchPopularTag('apply')}
              className="py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer disabled:opacity-60"
            >
              Tag All Popular
            </button>
            <button
              type="button"
              disabled={popularBusy}
              onClick={() => void handleBatchPopularTag('clear')}
              className="py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              Clear All Tags
            </button>
          </div>
        </div>
      </div>

      {/* NEW ADVANCED ADMIN POWER ENGINES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* NEW 1: Flash Sale Auto-Discount Engine */}
        <form
          onSubmit={handleSaveFlashSale}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Flash Sale Auto-Discount Engine
                </h2>
                <p className="text-[11px] text-slate-500">
                  Real server-enforced % checkout discount across Storefront, SMS &amp; Boosting
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFlashEnabled((v) => !v)}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                flashEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {flashEnabled ? 'LIVE ON' : 'PAUSED'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Promo Label
              </label>
              <input
                type="text"
                value={flashLabel}
                onChange={(e) => setFlashLabel(e.target.value)}
                placeholder="Flash Deal"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Discount %
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={flashPercent}
                onChange={(e) => setFlashPercent(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Target Scope
              </label>
              <select
                value={flashTarget}
                onChange={(e) =>
                  setFlashTarget(
                    e.target.value as 'all' | 'marketplace' | 'sms' | 'boosting',
                  )
                }
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold"
              >
                <option value="all">All Storefront</option>
                <option value="marketplace">Marketplace</option>
                <option value="sms">SMS Numbers</option>
                <option value="boosting">Boosting</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Auto-Expiry (Optional Date &amp; Time)
              </label>
              <input
                type="datetime-local"
                value={flashEndsAt}
                onChange={(e) => setFlashEndsAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <button
              type="submit"
              disabled={savingFlashSale}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {savingFlashSale ? 'Saving Flash Sale...' : 'Save Flash Sale Rules'}
            </button>
          </div>
        </form>

        {/* NEW 2: Bulk User Wallet Credit / Debit by Segment */}
        <form
          onSubmit={handleSegmentWalletBulk}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5"
        >
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Bulk Segment Wallet Credit / Debit
              </h2>
              <p className="text-[11px] text-slate-500">
                Credit bonuses or adjust balances by member segment with ledger &amp; notifications
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Segment
              </label>
              <select
                value={walletSegment}
                onChange={(e) =>
                  setWalletSegment(
                    e.target.value as 'all' | 'verified' | 'zero_balance' | 'active_only',
                  )
                }
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold"
              >
                <option value="verified">Email Verified</option>
                <option value="all">All Non-Admin</option>
                <option value="zero_balance">Zero Balance (0)</option>
                <option value="active_only">Active Accounts</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Action</label>
              <select
                value={walletMode}
                onChange={(e) => setWalletMode(e.target.value as 'credit' | 'debit')}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold"
              >
                <option value="credit">+ Credit</option>
                <option value="debit">- Debit</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Amount ({symbol})
              </label>
              <input
                type="number"
                min={1}
                required
                value={walletAmount}
                onChange={(e) => setWalletAmount(Number(e.target.value))}
                className="w-full px-2.5 py-2 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Ledger Note / Reason
              </label>
              <input
                type="text"
                value={walletNote}
                onChange={(e) => setWalletNote(e.target.value)}
                placeholder="Loyalty reward"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <button
              type="submit"
              disabled={walletBulkBusy}
              className={`w-full py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer disabled:opacity-60 ${
                walletMode === 'credit'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {walletBulkBusy
                ? 'Processing Batch...'
                : `${walletMode === 'credit' ? '+ Credit' : '- Debit'} ${formatNaira(walletAmount || 0, symbol)} (${walletSegment})`}
            </button>
          </div>
        </form>

        {/* NEW 3: Targeted Segment Broadcast Campaign */}
        <form
          onSubmit={handleTargetedBroadcast}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5"
        >
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Targeted Segment Broadcast Campaign
              </h2>
              <p className="text-[11px] text-slate-500">
                Notify &amp; optionally email specific customer cohorts without spamming everyone
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Cohort
              </label>
              <select
                value={broadcastSegment}
                onChange={(e) =>
                  setBroadcastSegment(
                    e.target.value as 'all' | 'verified' | 'unfunded' | 'spenders',
                  )
                }
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold"
              >
                <option value="all">All Active Users</option>
                <option value="verified">Email Verified</option>
                <option value="unfunded">Unfunded (₦0 Bal)</option>
                <option value="spenders">Past Buyers</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tone</label>
              <select
                value={broadcastType}
                onChange={(e) =>
                  setBroadcastType(e.target.value as 'info' | 'success' | 'warning')
                }
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold"
              >
                <option value="info">Blue Info</option>
                <option value="success">Green Promo</option>
                <option value="warning">Amber Alert</option>
              </select>
            </div>
            <label className="col-span-2 sm:col-span-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer">
              <input
                type="checkbox"
                checked={broadcastEmail}
                onChange={(e) => setBroadcastEmail(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600"
              />
              <span className="font-semibold text-[11px]">Also Email</span>
            </label>
          </div>

          <input
            type="text"
            required
            value={broadcastTitle}
            onChange={(e) => setBroadcastTitle(e.target.value)}
            placeholder="Campaign headline (e.g. Weekend SMS Restock Live)"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <textarea
            rows={2}
            required
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            placeholder="Write campaign message..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <button
            type="submit"
            disabled={broadcastBusy}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            {broadcastBusy ? 'Dispatching Campaign...' : `Send Targeted Campaign (${broadcastSegment})`}
          </button>
        </form>

        {/* NEW 4 & 5: Bulk Boosting Batch Processor + Emergency Kill Switch */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Bulk Boosting Order Batch Processor
                </h2>
                <p className="text-[11px] text-slate-500">
                  {data.metrics.pendingBoostingCount} pending boosting order(s) in queue
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={boostBatchBusy}
                onClick={() => void handleBoostBatchAction('complete_boosting')}
                className="flex-1 min-w-[160px] py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {boostBatchBusy ? 'Working...' : 'Complete All Active Boosts'}
              </button>
              {confirmCancelBoostBatch ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={boostBatchBusy}
                    onClick={() => void handleBoostBatchAction('cancel_refund_boosting')}
                    className="px-3 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    Confirm Refund All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancelBoostBatch(false)}
                    className="px-2.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmCancelBoostBatch(true)}
                  className="px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold cursor-pointer"
                >
                  Cancel &amp; Refund All Active
                </button>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Power className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-display text-xs font-extrabold text-slate-900 dark:text-white">
                    Emergency Session Kill Switch
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Force-logout all non-main-admin sessions (Epoch v{s.authSessionEpoch ?? 1})
                  </p>
                </div>
              </div>
              {confirmKillSwitch ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={killSwitchBusy}
                    onClick={() => void handleForceLogoutAll()}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-60"
                  >
                    {killSwitchBusy ? 'Revoking...' : 'Confirm Kill'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmKillSwitch(false)}
                    className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmKillSwitch(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer shrink-0"
                >
                  Force Logout All
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NEW 6: Main Admin Full JSON Store Backup Import / Restore */}
      {user?.isMainAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Database className="w-4 h-4" />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Full JSON Store Backup Import / Restore (Main Admin Only)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Restore settings, marketplace catalog, SMS pricing, boosting services, sections, promos &amp; tutorials while preserving user accounts &amp; balances.
                </p>
              </div>
            </div>
            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              Load .json File
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleBackupFilePick(e)}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            rows={3}
            value={backupJsonText}
            onChange={(e) => setBackupJsonText(e.target.value)}
            placeholder='Paste exported SureDeal backup JSON here ({"settings": {...}, "marketplaceListings": [...]})...'
            className="w-full px-3 py-2 font-mono text-[11px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {backupJsonText && (
              <button
                type="button"
                onClick={() => {
                  setBackupJsonText('');
                  setConfirmRestoreBackup(false);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
            {confirmRestoreBackup ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={restoringBackup}
                  onClick={() => void handleImportBackupRestore()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer disabled:opacity-60"
                >
                  {restoringBackup ? 'Restoring...' : 'Confirm Restore Store Catalog'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRestoreBackup(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!backupJsonText.trim()}
                onClick={() => setConfirmRestoreBackup(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore From Backup JSON
              </button>
            )}
          </div>
        </div>
      )}

      {/* Financial, SMS Expiry, Security & Canned Replies Guardrails */}
      <form
        onSubmit={handleSaveGuardrails}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Financial Rules, SMS Countdown, Signup Guards &amp; Support Templates
              </h2>
              <p className="text-xs text-slate-500">
                Real server-enforced deposit caps, cashback %, OTP expiry timer, blocked email domains, blocked name keywords &amp; ticket canned replies.
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={savingGuardrails}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-60"
          >
            {savingGuardrails ? 'Saving Guardrails...' : 'Save All Guardrails'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Min Deposit ({symbol})
            </label>
            <input
              type="number"
              min={0}
              value={minimumDeposit}
              onChange={(e) => setMinimumDeposit(Number(e.target.value))}
              className="w-full px-3 py-2 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Max Deposit ({symbol})
            </label>
            <input
              type="number"
              min={100}
              value={maxDepositAmount}
              onChange={(e) => setMaxDepositAmount(Number(e.target.value))}
              className="w-full px-3 py-2 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Deposit Cashback (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={depositBonusPercent}
              onChange={(e) => setDepositBonusPercent(Number(e.target.value))}
              className="w-full px-3 py-2 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              SMS Expiry (mins)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={smsOrderExpiryMinutes}
              onChange={(e) => setSmsOrderExpiryMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Referral Bonus ({symbol})
            </label>
            <input
              type="number"
              min={0}
              value={referralBonusAmount}
              onChange={(e) => setReferralBonusAmount(Number(e.target.value))}
              className="w-full px-3 py-2 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Welcome Bonus ({symbol})
            </label>
            <input
              type="number"
              min={0}
              value={welcomePromoAmount}
              onChange={(e) => setWelcomePromoAmount(Number(e.target.value))}
              className="w-full px-3 py-2 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Blocked Signup Email Domains (comma or newline separated)
            </label>
            <textarea
              rows={2}
              value={blockedDomainsText}
              onChange={(e) => setBlockedDomainsText(e.target.value)}
              placeholder="tempmail.com, mailinator.com, 10minutemail.com"
              className="w-full px-3 py-2 font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Blocked Signup Name Keywords (comma or newline separated)
            </label>
            <textarea
              rows={2}
              value={blockedNamesText}
              onChange={(e) => setBlockedNamesText(e.target.value)}
              placeholder="official support, admin team, scammer"
              className="w-full px-3 py-2 font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Support Desk Canned Reply Templates (one per line)
            </label>
            <textarea
              rows={2}
              value={cannedRepliesText}
              onChange={(e) => setCannedRepliesText(e.target.value)}
              placeholder="Your deposit has been verified and credited."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>
      </form>

      {/* Complete Searchable Feature Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Complete Overwatch Capabilities Directory ({filteredControls.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              Toggle platform switches live, trigger batch actions, or launch any dedicated tool directly.
            </p>
          </div>
        </div>

        {filteredControls.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-sm text-slate-500">No features matched &ldquo;{query}&rdquo;.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setDomain('all');
              }}
              className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
            >
              Show All {allControls.length} Controls
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredControls.map((ctrl) => {
              const toggleVal =
                ctrl.kind === 'toggle' && ctrl.toggleKey
                  ? Boolean(s[ctrl.toggleKey])
                  : undefined;

              return (
                <div
                  key={ctrl.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 hover:border-blue-300 dark:hover:border-blue-800 transition-colors flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {DOMAIN_META.find((d) => d.id === ctrl.domain)?.label || ctrl.domain}
                      </span>
                      {ctrl.badge && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                          {ctrl.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-extrabold text-slate-900 dark:text-white pt-1">
                      {ctrl.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {ctrl.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                    {ctrl.kind === 'toggle' && ctrl.toggleKey ? (
                      <>
                        <span
                          className={`text-[11px] font-bold ${
                            toggleVal ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {toggleVal ? 'Enabled' : 'Disabled'}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleToggleQuickSetting(ctrl.toggleKey!, !toggleVal)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                            toggleVal
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          {toggleVal ? 'Turn OFF' : 'Turn ON'}
                        </button>
                      </>
                    ) : ctrl.kind === 'action' && ctrl.actionId ? (
                      <button
                        type="button"
                        onClick={() => void runAction(ctrl.actionId!)}
                        className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Run Action Now
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => selectTab(ctrl.targetTab || 'overview')}
                        className="w-full py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold cursor-pointer"
                      >
                        Open Tool Console →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
