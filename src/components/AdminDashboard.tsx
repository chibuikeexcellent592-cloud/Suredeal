import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  Clock,
  Command,
  Copy,
  Crown,
  Download,
  Eye,
  FileClock,
  FileSpreadsheet,
  FileText,
  Gift,
  Globe,
  Home,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Package,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  KeyRound,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, copyText, formatCountdown, formatNaira, resolveApiUrl } from '../lib/api';
import { BrandLogo } from './BrandLogo';
import { UserAvatar } from './UserAvatar';
import type {
  AccountingRecord,
  AdminAlert,
  AuditLogEntry,
  BoostingOrder,
  PromoCode,
  PublicUser,
  SmsOrder,
  SmsPoolNumber,
  VaultItem,
  VisitorStats,
  WalletTransaction,
} from '../types';
import {
  AdminCatalogPanel,
  AdminCommsAndSettingsPanel,
  type AdminOverviewPayload,
} from './admin/AdminCatalogAndCms';
import { AdminSectionCopyPanel } from './admin/AdminSectionCopyPanel';

interface FullAdminOverview extends AdminOverviewPayload {
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
  vaultItems?: VaultItem[];
  adminAlerts: AdminAlert[];
  promoCodes: PromoCode[];
  auditLogs: AuditLogEntry[];
  accountingRecords?: AccountingRecord[];
  visitorStats?: VisitorStats;
}

const OVERWATCH_CACHE_KEY = 'sd_overwatch_cache_v1';

function stripHeavyMedia<T>(value: T, fieldKey?: string): T {
  if (typeof value === 'string') {
    if (fieldKey === 'siteLogoUrl') {
      return (value.length > 500_000 ? '' : value) as unknown as T;
    }
    if (value.startsWith('data:image/') || value.startsWith('data:video/') || value.length > 2000) {
      return '' as unknown as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripHeavyMedia(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      copy[k] = stripHeavyMedia(v, k);
    }
    return copy as T;
  }
  return value;
}

function readOverwatchCache(): FullAdminOverview | null {
  try {
    const raw = window.localStorage.getItem(OVERWATCH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FullAdminOverview;
    if (!parsed || !parsed.settings || !parsed.metrics) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeOverwatchCache(payload: FullAdminOverview): void {
  try {
    const slim = stripHeavyMedia(payload);
    window.localStorage.setItem(OVERWATCH_CACHE_KEY, JSON.stringify(slim));
  } catch {
    // Ignore storage quota errors safely
  }
}

type AdminTab =
  | 'overview'
  | 'users'
  | 'orders'
  | 'accounting'
  | 'catalog'
  | 'cms'
  | 'copy'
  | 'promos'
  | 'notifications'
  | 'tutorials'
  | 'support'
  | 'audit'
  | 'settings';

interface AdminDashboardProps {
  onBackHome?: () => void;
  onOpenWorkspace?: () => void;
  onPreviewMaintenance?: () => void;
}

export function AdminDashboard({
  onBackHome,
  onOpenWorkspace,
  onPreviewMaintenance,
}: AdminDashboardProps) {
  const { user, theme, toggleTheme, logout, notify, refreshCatalog } = useApp();
  const [cachedInitial] = useState<FullAdminOverview | null>(() => readOverwatchCache());
  const [data, setData] = useState<FullAdminOverview | null>(cachedInitial);
  const [loading, setLoading] = useState(!cachedInitial);
  const [syncingLive, setSyncingLive] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'active' | 'suspended' | 'admin'>(
    'all',
  );
  const [notifyTargetUserId, setNotifyTargetUserId] = useState<string | null>(null);
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [depositFilter, setDepositFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [smsSearch, setSmsSearch] = useState('');
  const [boostSearch, setBoostSearch] = useState('');
  const [boostStatusFilter, setBoostStatusFilter] = useState<string>('all');
  const [txFilter, setTxFilter] = useState<
    'all' | 'deposit' | 'purchase' | 'refund' | 'credits'
  >('all');
  const [txSearch, setTxSearch] = useState('');
  const [confirmClearOrders, setConfirmClearOrders] = useState<'completed' | 'all' | null>(null);
  const [confirmClearTx, setConfirmClearTx] = useState<string | null>(null);

  // Accounting Archive Console state
  const [accSearch, setAccSearch] = useState('');
  const [accKindFilter, setAccKindFilter] = useState<'all' | 'order' | 'transaction'>('all');
  const [accCatFilter, setAccCatFilter] = useState<string>('all');
  const [confirmClearAccounting, setConfirmClearAccounting] = useState(false);
  const [confirmRefreshOpsHeader, setConfirmRefreshOpsHeader] = useState(false);
  const [refreshingOpsHeader, setRefreshingOpsHeader] = useState(false);

  // User God-Mode Forms
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [newUserBal, setNewUserBal] = useState(0);
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});
  const [resetPassInputs, setResetPassInputs] = useState<Record<string, string>>({});

  // Promo Code Form
  const [promoCodeStr, setPromoCodeStr] = useState('');
  const [promoType, setPromoType] = useState<'percent' | 'fixed'>('percent');
  const [promoVal, setPromoVal] = useState(10);
  const [promoMax, setPromoMax] = useState(100);

  // SMS Pool & OTP Delivery Inputs
  const [poolNumber, setPoolNumber] = useState('');
  const [poolCountry, setPoolCountry] = useState('cnt_us');
  const [poolService, setPoolService] = useState('');
  const [poolOtp, setPoolOtp] = useState('');
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [phoneInputs, setPhoneInputs] = useState<Record<string, string>>({});

  // Overwatch Creator Tools state
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [airdropAmount, setAirdropAmount] = useState(500);
  const [airdropTitle, setAirdropTitle] = useState('Creator Loyalty Drop');
  const [airdropMessage, setAirdropMessage] = useState(
    'Enjoy this bonus wallet credit courtesy of the website creator!',
  );
  const [airdropping, setAirdropping] = useState(false);
  const [confirmClearAudit, setConfirmClearAudit] = useState(false);
  const [vaultSearch, setVaultSearch] = useState('');
  const [confirmClearVault, setConfirmClearVault] = useState(false);
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserRole, setEditUserRole] = useState<'user' | 'admin'>('user');
  const [editUserStatus, setEditUserStatus] = useState<'active' | 'suspended'>('active');
  const [editUserReferral, setEditUserReferral] = useState('');
  const [editUserAvatar, setEditUserAvatar] = useState('');
  const [editUserPass, setEditUserPass] = useState('');
  const [savingUserEdit, setSavingUserEdit] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadAdmin = useCallback(async () => {
    setSyncingLive(true);
    setLoadError(null);
    try {
      const res = await apiFetch<FullAdminOverview>('/api/admin/overview');
      setData(res);
      writeOverwatchCache(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load Overwatch console';
      setLoadError(msg);
      if (!readOverwatchCache()) {
        notify(msg, 'error');
      }
    } finally {
      setLoading(false);
      setSyncingLive(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  const hasWaitingSmsOrders = Boolean(data?.smsOrders.some((s) => s.status === 'waiting'));
  useEffect(() => {
    if (!hasWaitingSmsOrders) return;
    setNowMs(Date.now());
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [hasWaitingSmsOrders]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
        return;
      }
      if (e.key === 'Escape') {
        setCmdOpen(false);
        setReceiptPreview(null);
        setInspectUserId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!data && loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center bg-[var(--site-bg)] text-slate-500">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <p className="text-sm font-medium">Initializing Overwatch Creator Console...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-[var(--site-bg)]">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <div className="space-y-1 max-w-md">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Could not reach Overwatch backend
          </h2>
          <p className="text-xs text-slate-500">{loadError || 'Network timeout occurred.'}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadAdmin();
          }}
          className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const symbol = data.settings.currencySymbol || '₦';
  const pendingDeposits = data.transactions.filter(
    (t) => t.type === 'deposit' && t.status === 'pending',
  );
  const matchedPendingDepositsCount = pendingDeposits.filter(
    (t) => t.aiAudit?.verdict === 'match' && t.aiAudit?.checks?.uniqueReference !== false,
  ).length;
  const allDeposits = data.transactions.filter((t) => t.type === 'deposit');
  const visibleDeposits = allDeposits.filter((t) =>
    depositFilter === 'all' ? true : t.status === depositFilter,
  );
  const filteredSmsOrders = data.smsOrders.filter((ord) => {
    const q = smsSearch.trim().toLowerCase();
    return (
      !q ||
      ord.userEmail.toLowerCase().includes(q) ||
      ord.serviceName.toLowerCase().includes(q) ||
      ord.countryName.toLowerCase().includes(q) ||
      ord.phoneNumber.toLowerCase().includes(q)
    );
  });
  const filteredBoostingOrders = data.boostingOrders.filter((ord) => {
    const matchesStatus = boostStatusFilter === 'all' || ord.status === boostStatusFilter;
    const q = boostSearch.trim().toLowerCase();
    const matchesQ =
      !q ||
      ord.userEmail.toLowerCase().includes(q) ||
      ord.serviceName.toLowerCase().includes(q) ||
      ord.platform.toLowerCase().includes(q) ||
      ord.targetUrl.toLowerCase().includes(q) ||
      ord.id.toLowerCase().includes(q);
    return matchesStatus && matchesQ;
  });
  const pendingBoostCount = data.boostingOrders.filter((b) => b.status === 'pending').length;
  const processingBoostCount = data.boostingOrders.filter((b) => b.status === 'processing').length;
  const filteredTransactions = data.transactions.filter((t) => {
    const matchesType =
      txFilter === 'all'
        ? true
        : txFilter === 'credits'
          ? t.type === 'admin_credit' ||
            t.type === 'admin_debit' ||
            t.type === 'referral_bonus' ||
            t.type === 'welcome_bonus'
          : t.type === txFilter;
    const q = txSearch.trim().toLowerCase();
    const matchesQ =
      !q ||
      t.userEmail.toLowerCase().includes(q) ||
      t.userName.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q);
    return matchesType && matchesQ;
  });

  const filteredUsers = data.users.filter((u) => {
    const matchesFilter =
      userRoleFilter === 'all'
        ? true
        : userRoleFilter === 'admin'
          ? u.role === 'admin'
          : u.status === userRoleFilter;
    const q = userSearch.trim().toLowerCase();
    const matchesSearch =
      !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const openEditUser = (target: PublicUser) => {
    setEditingUser(target);
    setEditUserName(target.name);
    setEditUserEmail(target.email);
    setEditUserRole(target.role);
    setEditUserStatus(target.status);
    setEditUserReferral(target.referralCode || '');
    setEditUserAvatar(target.avatarUrl || '');
    setEditUserPass('');
  };

  const handleEditUserAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      notify('Avatar image must be under 1.5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditUserAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingUserEdit(true);
    try {
      await apiFetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editUserName.trim(),
          email: editUserEmail.trim(),
          role: editUserRole,
          status: editUserStatus,
          referralCode: editUserReferral.trim(),
          avatarUrl: editUserAvatar.trim(),
          ...(editUserPass.trim().length >= 6 ? { newPassword: editUserPass.trim() } : {}),
        }),
      });
      setEditingUser(null);
      notify(`Updated ${editUserEmail.trim()} permanently!`, 'success');
      await loadAdmin();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update user', 'error');
    } finally {
      setSavingUserEdit(false);
    }
  };

  const vaultItemsList = data.vaultItems || [];
  const filteredVaultItems = vaultItemsList.filter((v) => {
    const q = vaultSearch.trim().toLowerCase();
    return (
      !q ||
      v.title.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      (v.buyerEmail || '').toLowerCase().includes(q) ||
      (v.buyerName || '').toLowerCase().includes(q) ||
      v.deliveredCredential.toLowerCase().includes(q)
    );
  });

  const handleExportUsersCsv = () => {
    const header = 'Name,Email,Role,Status,Balance,ReferralCode,CreatedAt';
    const rows = data.users.map((u) =>
      [
        `"${u.name.replace(/"/g, '""')}"`,
        `"${u.email}"`,
        u.role,
        u.status,
        u.balance,
        u.referralCode,
        u.createdAt,
      ].join(','),
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suredeal-store-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Users CSV exported', 'success');
  };

  const accountingRecordsList = data.accountingRecords || [];
  const visitorStats = data.visitorStats || { totalVisits: 0, recentSessions: [] };
  const accountingCategories = Array.from(
    new Set(accountingRecordsList.map((r) => r.category).filter(Boolean)),
  ).sort();
  const filteredAccountingRecords = accountingRecordsList.filter((r) => {
    const matchesKind = accKindFilter === 'all' || r.kind === accKindFilter;
    const matchesCat = accCatFilter === 'all' || r.category === accCatFilter;
    const q = accSearch.trim().toLowerCase();
    const matchesQ =
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.sourceId.toLowerCase().includes(q) ||
      r.userName.toLowerCase().includes(q) ||
      r.userEmail.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.detail.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q);
    return matchesKind && matchesCat && matchesQ;
  });

  const accountingOrderSalesTotal = accountingRecordsList
    .filter((r) => r.kind === 'order' && !['cancelled', 'expired', 'refunded'].includes(r.status))
    .reduce((sum, r) => sum + r.amount, 0);
  const accountingDepositsTotal = accountingRecordsList
    .filter((r) => r.kind === 'transaction' && r.category === 'deposit' && r.status === 'verified')
    .reduce((sum, r) => sum + r.amount, 0);
  const accountingRefundsBonusesTotal = accountingRecordsList
    .filter(
      (r) =>
        r.kind === 'transaction' &&
        ['refund', 'admin_credit', 'referral_bonus', 'welcome_bonus'].includes(r.category),
    )
    .reduce((sum, r) => sum + r.amount, 0);

  const handleExportAccountingCsv = () => {
    const header = 'ArchiveID,Kind,SourceID,Category,UserName,UserEmail,Title,Detail,Amount,Status,Date';
    const rows = filteredAccountingRecords.map((r) =>
      [
        r.id,
        r.kind,
        r.sourceId,
        r.category,
        `"${(r.userName || '').replace(/"/g, '""')}"`,
        `"${(r.userEmail || '').replace(/"/g, '""')}"`,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        `"${(r.detail || '').replace(/"/g, '""')}"`,
        r.amount,
        r.status,
        r.createdAt,
      ].join(','),
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suredeal-accounting-archive-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Accounting Archive CSV exported', 'success');
  };

  const handleRefreshOpsSafe = async () => {
    setRefreshingOpsHeader(true);
    try {
      await apiFetch('/api/admin/system/refresh-ops', { method: 'POST' });
      setConfirmRefreshOpsHeader(false);
      notify(
        'Website queues refreshed! Users, balances, logo, products & Accounting Archive preserved.',
        'success',
      );
      await loadAdmin();
      await refreshCatalog();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Website refresh failed', 'error');
    } finally {
      setRefreshingOpsHeader(false);
    }
  };

  // Compute live Overview analytics & inventory alerts
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayDepositsTotal = data.transactions
    .filter((t) => t.type === 'deposit' && t.status === 'verified' && t.createdAt.startsWith(todayPrefix))
    .reduce((sum, t) => sum + t.amount, 0);
  const todaySalesTotal = data.transactions
    .filter((t) => t.type === 'purchase' && t.status === 'completed' && t.createdAt.startsWith(todayPrefix))
    .reduce((sum, t) => sum + t.amount, 0);
  const activeUsersCount = data.users.filter((u) => u.status === 'active').length;
  const suspendedUsersCount = data.users.filter((u) => u.status === 'suspended').length;

  // 7-Day real transaction volume chart (Sales vs Verified Deposits)
  const last7Days = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    const dateKey = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const sales = data.transactions
      .filter((t) => t.type === 'purchase' && t.status === 'completed' && t.createdAt.startsWith(dateKey))
      .reduce((s, t) => s + t.amount, 0);
    const deposits = data.transactions
      .filter((t) => t.type === 'deposit' && t.status === 'verified' && t.createdAt.startsWith(dateKey))
      .reduce((s, t) => s + t.amount, 0);
    return { dateKey, label, sales, deposits };
  });
  const maxChartVal = Math.max(1, ...last7Days.flatMap((d) => [d.sales, d.deposits]));

  // Top customers ranked by real wallet balance + total purchase spend
  const spendByUserId = new Map<string, number>();
  for (const t of data.transactions) {
    if (t.type === 'purchase' && t.status === 'completed') {
      spendByUserId.set(t.userId, (spendByUserId.get(t.userId) || 0) + t.amount);
    }
  }
  const topCustomers = [...data.users]
    .sort((a, b) => (spendByUserId.get(b.id) || 0) + b.balance - ((spendByUserId.get(a.id) || 0) + a.balance))
    .slice(0, 5);

  const inspectedUser = inspectUserId ? data.users.find((u) => u.id === inspectUserId) || null : null;

  const lowStockItems: { id: string; title: string; group: string; stock: number }[] = [
    ...data.marketplaceListings
      .filter((l) => l.stock <= 3)
      .map((l) => ({ id: l.id, title: l.title, group: `Marketplace · ${l.category}`, stock: l.stock })),
    ...data.customSections.flatMap((sec) =>
      sec.products
        .filter((p) => p.stock <= 3)
        .map((p) => ({ id: p.id, title: p.title, group: sec.name, stock: p.stock })),
    ),
    ...data.smsServices
      .filter((s) => s.stock <= 5)
      .map((s) => ({ id: s.id, title: s.name, group: 'SMS OTP Service', stock: s.stock })),
  ];

  const handleToggleQuickSetting = async (
    key:
      | 'maintenanceMode'
      | 'autoApproveDeposits'
      | 'welcomePromoEnabled'
      | 'pinnedTickerEnabled'
      | 'allowNewSignups'
      | 'enableSmsService'
      | 'enableBoostingService'
      | 'enableMarketplace'
      | 'allowPromoCodes'
      | 'showFloatingWhatsapp'
      | 'showLandingShowcase'
      | 'showLandingRates',
    val: boolean,
  ) => {
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: val }),
      });
      await loadAdmin();
      await refreshCatalog();
      notify('Overwatch control saved permanently', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  };

  const handleAirdropBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!airdropAmount || airdropAmount <= 0) {
      notify('Enter a valid bonus amount greater than 0', 'error');
      return;
    }
    setAirdropping(true);
    try {
      const res = await apiFetch<{
        creditedCount?: number;
        totalDistributed?: number;
        creditedUsers?: number;
        totalCredited?: number;
      }>('/api/admin/users/airdrop-bonus', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(airdropAmount),
          title: airdropTitle.trim() || 'Creator Loyalty Bonus',
          message: airdropMessage.trim(),
        }),
      });
      const count = res.creditedCount ?? res.creditedUsers ?? 0;
      const total = res.totalDistributed ?? res.totalCredited ?? count * Number(airdropAmount);
      notify(
        `Airdropped ${formatNaira(airdropAmount, symbol)} to ${count} active users (${formatNaira(total, symbol)} total)!`,
        'success',
      );
      await loadAdmin();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Airdrop failed', 'error');
    } finally {
      setAirdropping(false);
    }
  };

  const handleExportJsonBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overwatch-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Full Overwatch JSON backup exported', 'success');
  };

  const primaryMenu: {
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3, badge: data.metrics.unreadAlerts },
    {
      id: 'orders',
      label: 'Orders & Receipts',
      icon: Receipt,
      badge:
        data.metrics.pendingDepositsCount +
        data.metrics.pendingBoostingCount +
        data.metrics.activeSmsCount,
    },
    {
      id: 'accounting',
      label: `Accounting (${accountingRecordsList.length})`,
      icon: Archive,
      badge: accountingRecordsList.length,
    },
    { id: 'users', label: `Users (${data.users.length})`, icon: Users },
    { id: 'catalog', label: 'Products', icon: Package, badge: lowStockItems.length },
    { id: 'cms', label: 'Landing Studio', icon: Sparkles },
    { id: 'copy', label: 'Wallet & Sections Copy', icon: FileText },
    { id: 'promos', label: `Promo Codes (${data.promoCodes.length})`, icon: Tag },
  ];

  const operationsMenu: {
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'notifications', label: 'Broadcasts', icon: Bell },
    { id: 'tutorials', label: 'Tutorials', icon: BookOpen },
    { id: 'support', label: 'Support Desk', icon: LifeBuoy, badge: data.metrics.openTickets },
    { id: 'settings', label: 'Master Controls', icon: Sliders },
    { id: 'audit', label: 'Audit Trail', icon: FileClock },
  ];

  const allTabs = [...primaryMenu, ...operationsMenu];
  const activeTabLabel = allTabs.find((t) => t.id === tab)?.label || 'Overview';
  const siteName = data.settings.siteName || 'SureDeal Store';

  const selectTab = (next: AdminTab) => {
    setTab(next);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between bg-white dark:bg-slate-900 overflow-y-auto">
      <div>
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => selectTab('overview')}
            className="flex items-center gap-3 text-left min-w-0 cursor-pointer"
          >
            <BrandLogo
              logoUrl={data.settings.siteLogoUrl}
              siteName={siteName}
              size="md"
              shape="rounded"
            />
            <div className="min-w-0">
              <p className="font-display text-base font-extrabold text-slate-900 dark:text-white leading-tight truncate flex items-center gap-1.5">
                Overwatch
                <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {siteName} · Creator Desk
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Website Creator Profile Row */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <UserAvatar
            name={user?.name}
            avatarUrl={user?.avatarUrl}
            size="md"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {user?.name}
              </p>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 text-[9px] font-extrabold uppercase shrink-0">
                Creator
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>

        {/* Blue Gradient Summary Card matching User Balance Card */}
        <div className="px-4 pt-4 pb-2">
          <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-sky-500 p-5 text-white shadow-md shadow-blue-500/20">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-blue-100">
              Creator Revenue
            </p>
            <p className="font-display text-2xl sm:text-3xl font-bold mt-1 tabular-nums">
              {formatNaira(data.metrics.totalRevenue, symbol)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportJsonBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Backup
              </button>
              <button
                type="button"
                onClick={loadAdmin}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Sync
              </button>
            </div>
          </div>
        </div>

        {/* Management Menu */}
        <div className="px-4 pt-4">
          <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            Management
          </p>
          <nav className="space-y-1">
            {primaryMenu.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && item.badge > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Operations Menu */}
        <div className="px-4 pt-5 pb-4">
          <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            Operations
          </p>
          <nav className="space-y-1">
            {operationsMenu.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && item.badge > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
        {onOpenWorkspace && (
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenWorkspace();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>User Dashboard</span>
          </button>
        )}
        {onBackHome && (
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onBackHome();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Public Storefront</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            logout();
            onBackHome?.();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--site-bg)] text-slate-900 dark:text-slate-100">
      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen">
          {sidebarContent}
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full z-10 border-r border-slate-200 dark:border-slate-800 shadow-2xl">
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                aria-label="Open menu"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="font-display font-bold text-slate-900 dark:text-white">
                    Overwatch
                  </span>
                  <span>·</span>
                  <span className="truncate">{activeTabLabel}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
              {syncingLive && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Live Syncing...
                </span>
              )}
              {!syncingLive && loadError && (
                <button
                  type="button"
                  onClick={() => void loadAdmin()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold cursor-pointer"
                  title={loadError}
                >
                  Offline Cache · Retry
                </button>
              )}
              {data.settings.maintenanceMode && (
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                  Maintenance ON
                </span>
              )}

              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-blue-400 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                title="Open Overwatch Command Palette (Ctrl+K / ⌘K)"
              >
                <Command className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                <span className="hidden sm:inline">Quick Jump</span>
                <kbd className="hidden md:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400">
                  ⌘K
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => selectTab('cms')}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Landing Studio
              </button>

              {confirmRefreshOpsHeader ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={refreshingOpsHeader}
                    onClick={() => void handleRefreshOpsSafe()}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white cursor-pointer disabled:opacity-60"
                  >
                    {refreshingOpsHeader ? 'Resetting...' : 'Confirm Reset Queues'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRefreshOpsHeader(false)}
                    className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRefreshOpsHeader(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                  title="Clear dashboard orders & transactions while preserving users, balances, logo, products & Accounting Archive"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Refresh Website</span>
                </button>
              )}

              <button
                type="button"
                onClick={loadAdmin}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                title="Sync latest Overwatch state"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingLive ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync</span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </header>

          {/* Sticky Scrollable Overwatch Creator Tool Strip — full visibility on mobile Safari & desktop */}
          <div className="sticky top-16 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 min-w-max">
              {allTabs.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTab(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                      active
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                    {item.badge && item.badge > 0 ? (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                          active
                            ? 'bg-white/25 text-white'
                            : 'bg-purple-600 text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Store Sales
                  </p>
                  <p className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 tabular-nums">
                    {formatNaira(data.metrics.totalRevenue, symbol)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Verified {data.settings.bankName}
                  </p>
                  <p className="font-display text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1.5 tabular-nums">
                    {formatNaira(data.metrics.totalDeposits, symbol)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    User Wallet Liability
                  </p>
                  <p className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 tabular-nums">
                    {formatNaira(data.metrics.totalUserBalances, symbol)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Pending Receipts
                  </p>
                  <p className="font-display text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1.5 tabular-nums">
                    {data.metrics.pendingDepositsCount}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('orders')}
                    className="text-xs font-semibold text-blue-600 hover:underline mt-1 cursor-pointer"
                  >
                    Audit queue →
                  </button>
                </div>
              </div>

              {/* Creator Quick-Launch Tool Grid */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    Creator Console Quick-Launch Tools
                  </h2>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Full edit, reorder, duplicate &amp; delete access across every module
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
                  {[
                    { label: 'Products & Pricing', sub: `${data.marketplaceListings.length} items`, tab: 'catalog' as AdminTab, icon: Package, tint: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/60' },
                    { label: 'Orders & Vault', sub: `${vaultItemsList.length} deliveries`, tab: 'orders' as AdminTab, icon: Receipt, tint: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60' },
                    { label: 'Accounting', sub: `${accountingRecordsList.length} archived`, tab: 'accounting' as AdminTab, icon: Archive, tint: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60' },
                    { label: 'User Accounts', sub: `${data.users.length} members`, tab: 'users' as AdminTab, icon: Users, tint: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60' },
                    { label: 'Landing Studio', sub: 'Notice, wallet & hero', tab: 'cms' as AdminTab, icon: Sparkles, tint: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60' },
                    { label: 'Wallet & Copy', sub: 'Edit all write-ups', tab: 'copy' as AdminTab, icon: FileText, tint: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900/60' },
                    { label: 'Broadcasts & Mail', sub: `${data.notifications.length} notices`, tab: 'notifications' as AdminTab, icon: Bell, tint: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900/60' },
                    { label: 'Master Controls', sub: data.settings.maintenanceMode ? 'Maintenance ON' : 'Live & online', tab: 'settings' as AdminTab, icon: Sliders, tint: 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700' },
                  ].map((tool) => {
                    const ToolIcon = tool.icon;
                    return (
                      <button
                        key={tool.label}
                        type="button"
                        onClick={() => selectTab(tool.tab)}
                        className={`p-3 rounded-xl border text-left transition-all hover:shadow-xs cursor-pointer ${tool.tint}`}
                      >
                        <ToolIcon className="w-4 h-4 mb-1.5" />
                        <p className="text-xs font-bold leading-snug">{tool.label}</p>
                        <p className="text-[11px] opacity-80 mt-0.5 truncate">{tool.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Overwatch Instant Master Controls & Creator Airdrop Tool */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-600" />
                      Overwatch Master Switches
                    </h2>
                    <button
                      type="button"
                      onClick={() => setTab('settings')}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      All Controls →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        key: 'maintenanceMode' as const,
                        title: 'Maintenance Lockdown',
                        desc: 'Lock non-creator logins with notice',
                        val: data.settings.maintenanceMode,
                        onColor: 'bg-amber-600 text-white',
                      },
                      {
                        key: 'allowNewSignups' as const,
                        title: 'New Registrations',
                        desc: 'Allow visitors to create accounts',
                        val: data.settings.allowNewSignups ?? true,
                        onColor: 'bg-emerald-600 text-white',
                      },
                      {
                        key: 'enableSmsService' as const,
                        title: 'Virtual SMS Numbers',
                        desc: 'Enable renting OTP numbers',
                        val: data.settings.enableSmsService ?? true,
                        onColor: 'bg-blue-600 text-white',
                      },
                      {
                        key: 'enableBoostingService' as const,
                        title: 'Social Boosting Desk',
                        desc: 'Enable social campaign orders',
                        val: data.settings.enableBoostingService ?? true,
                        onColor: 'bg-blue-600 text-white',
                      },
                      {
                        key: 'enableMarketplace' as const,
                        title: 'Marketplace & Vault',
                        desc: 'Enable proxy, VPN & account sales',
                        val: data.settings.enableMarketplace ?? true,
                        onColor: 'bg-blue-600 text-white',
                      },
                      {
                        key: 'showFloatingWhatsapp' as const,
                        title: 'Floating WhatsApp Ball',
                        desc: 'Show floating green WhatsApp support',
                        val: data.settings.showFloatingWhatsapp ?? true,
                        onColor: 'bg-emerald-600 text-white',
                      },
                      {
                        key: 'autoApproveDeposits' as const,
                        title: 'AI Receipt Auto-Approve',
                        desc: 'Auto-credit matched receipts',
                        val: data.settings.autoApproveDeposits,
                        onColor: 'bg-emerald-600 text-white',
                      },
                      {
                        key: 'pinnedTickerEnabled' as const,
                        title: 'Pinned Scrolling Notice',
                        desc: 'Show scrolling top announcement bar',
                        val: data.settings.pinnedTickerEnabled,
                        onColor: 'bg-blue-600 text-white',
                      },
                    ].map((sw) => (
                      <div
                        key={sw.key}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {sw.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">{sw.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleQuickSetting(sw.key, !sw.val)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer ${
                            sw.val
                              ? sw.onColor
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {sw.val ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Creator Wallet Airdrop Tool */}
                <form
                  onSubmit={handleAirdropBonus}
                  className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Gift className="w-4 h-4 text-amber-500" />
                      Creator Wallet Airdrop
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Instantly credit a bonus reward to all {activeUsersCount} active user wallets and send them a live notification.
                    </p>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">
                        Bonus Amount per User ({symbol})
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={airdropAmount}
                        onChange={(e) => setAirdropAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Drop Title</label>
                      <input
                        type="text"
                        value={airdropTitle}
                        onChange={(e) => setAirdropTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Message</label>
                      <textarea
                        rows={2}
                        value={airdropMessage}
                        onChange={(e) => setAirdropMessage(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={airdropping}
                    className="w-full py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-sm disabled:opacity-60 cursor-pointer"
                  >
                    {airdropping ? 'Airdropping...' : `Airdrop ${formatNaira(airdropAmount || 0, symbol)} to Active Users`}
                  </button>
                </form>
              </div>

              {/* Action Needed Quick Queue */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setTab('orders')}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-400">
                      Pending Boosting
                    </span>
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="font-display text-xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                    {data.metrics.pendingBoostingCount}
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 font-semibold">
                    Open fulfillment →
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('orders')}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-400">
                      SMS Waiting OTP
                    </span>
                    <Smartphone className="w-4 h-4 text-sky-600" />
                  </div>
                  <p className="font-display text-xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                    {data.metrics.activeSmsCount}
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 font-semibold">
                    Deliver OTPs →
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('support')}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-400">
                      Open Tickets
                    </span>
                    <LifeBuoy className="w-4 h-4 text-indigo-600" />
                  </div>
                  <p className="font-display text-xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                    {data.metrics.openTickets}
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 font-semibold">
                    Reply to users →
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('catalog')}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-400">
                      Low Stock Alerts
                    </span>
                    <AlertTriangle
                      className={`w-4 h-4 ${
                        lowStockItems.length > 0 ? 'text-amber-500' : 'text-emerald-500'
                      }`}
                    />
                  </div>
                  <p className="font-display text-xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                    {lowStockItems.length}
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 font-semibold">
                    Manage stock →
                  </p>
                </button>
              </div>

              {/* Revenue Pulse & Low-Stock Inventory Watch */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      Today&apos;s Store Pulse &amp; Member Health
                    </h2>
                    <button
                      type="button"
                      onClick={() => setTab('users')}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Users ({data.metrics.totalUsers}) →
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[11px] font-semibold text-slate-500">Today&apos;s Deposits</p>
                      <p className="font-display text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                        {formatNaira(todayDepositsTotal, symbol)}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[11px] font-semibold text-slate-500">Today&apos;s Sales</p>
                      <p className="font-display text-lg font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
                        {formatNaira(todaySalesTotal, symbol)}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[11px] font-semibold text-slate-500">Account Status</p>
                      <p className="font-semibold text-slate-900 dark:text-white mt-1">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {activeUsersCount} Active
                        </span>{' '}
                        ·{' '}
                        <span className="text-rose-600 dark:text-rose-400">
                          {suspendedUsersCount} Suspended
                        </span>
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[11px] font-semibold text-slate-500">Order Volume</p>
                      <p className="font-semibold text-slate-900 dark:text-white mt-1">
                        {data.smsOrders.length} SMS · {data.boostingOrders.length} Boosts
                      </p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-500" />
                      Low-Stock &amp; Out-of-Stock Watch
                    </h2>
                    <button
                      type="button"
                      onClick={() => setTab('catalog')}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Restock Products →
                    </button>
                  </div>
                  {lowStockItems.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      All Marketplace products, Custom Sections, and SMS services have healthy
                      inventory.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                      {lowStockItems.map((item) => (
                        <div
                          key={item.id}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">{item.group}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                              item.stock === 0
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {item.stock === 0 ? 'Out of Stock' : `${item.stock} left`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 7-Day Financial Performance & Top Customers Leaderboard */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      7-Day Store Sales vs Verified Deposits
                    </h2>
                    <div className="flex items-center gap-3 text-[11px] font-semibold">
                      <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                        Sales
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                        Deposits
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-2 items-end h-36 pt-3">
                    {last7Days.map((day) => {
                      const salesH = Math.max(day.sales > 0 ? 12 : 4, Math.round((day.sales / maxChartVal) * 100));
                      const depH = Math.max(day.deposits > 0 ? 12 : 4, Math.round((day.deposits / maxChartVal) * 100));
                      return (
                        <div key={day.dateKey} className="flex flex-col items-center gap-1.5 h-full justify-end">
                          <div className="w-full flex items-end justify-center gap-1 h-24">
                            <div
                              style={{ height: `${salesH}%` }}
                              title={`${day.dateKey} Sales: ${formatNaira(day.sales, symbol)}`}
                              className="w-3 sm:w-3.5 rounded-t-md bg-blue-600/90 hover:bg-blue-500 transition-all"
                            />
                            <div
                              style={{ height: `${depH}%` }}
                              title={`${day.dateKey} Deposits: ${formatNaira(day.deposits, symbol)}`}
                              className="w-3 sm:w-3.5 rounded-t-md bg-emerald-500/90 hover:bg-emerald-400 transition-all"
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            {day.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      Top Accounts Leaderboard
                    </h2>
                    <button
                      type="button"
                      onClick={() => setTab('users')}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      All Users →
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {topCustomers.map((u, idx) => (
                      <div key={u.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">{u.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              Spent {formatNaira(spendByUserId.get(u.id) || 0, symbol)} · Bal {formatNaira(u.balance, symbol)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectUserId(u.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-lg shrink-0 cursor-pointer"
                        >
                          Inspect
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Storefront Visitor Monitor + Operational Alerts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-600" />
                      Live Storefront Visitors
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 tabular-nums">
                      {visitorStats.totalVisits} total visits
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Every visitor who opens the website (even without signing in) triggers an instant Overwatch notification.
                    {visitorStats.lastVisitAt && (
                      <span className="block mt-0.5 text-slate-400">
                        Last visit: {new Date(visitorStats.lastVisitAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                  {visitorStats.recentSessions.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">
                      No public visitor sessions logged yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                      {visitorStats.recentSessions.slice(0, 12).map((sess, sIdx) => (
                        <div
                          key={`${sess.visitorId}-${sess.visitedAt}-${sIdx}`}
                          className="py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {sess.device || 'Visitor'} · <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">{sess.path || '/'}</span>
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 truncate">
                              ID: {sess.visitorId}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(sess.visitedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      Live Operational Stream ({data.adminAlerts.length})
                    </h2>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiFetch('/api/admin/activity/refresh', { method: 'POST' });
                            notify('Overwatch activity stream & logs refreshed!', 'success');
                            await loadAdmin();
                          } catch (err) {
                            notify(err instanceof Error ? err.message : 'Refresh failed', 'error');
                          }
                        }}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Refresh Activity
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiFetch('/api/admin/alerts/read-all', { method: 'POST' });
                            notify('Alerts marked read', 'info');
                            await loadAdmin();
                          } catch (err) {
                            notify(err instanceof Error ? err.message : 'Failed to update alerts', 'error');
                          }
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                      >
                        Mark All Read
                      </button>
                      {data.adminAlerts.length > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch('/api/admin/alerts', { method: 'DELETE' });
                              notify('Operational stream cleared', 'info');
                              await loadAdmin();
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Failed to clear alerts', 'error');
                            }
                          }}
                          className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Clear Stream
                        </button>
                      )}
                    </div>
                  </div>
                  {data.adminAlerts.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">
                      All caught up — zero unread operational alerts.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                      {data.adminAlerts.slice(0, 15).map((a) => (
                        <div key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  a.category === 'visitor'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : a.category === 'deposit'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {a.category}
                              </span>
                              <p className="font-semibold text-slate-900 dark:text-white truncate">{a.title}</p>
                              {!a.read && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                            </div>
                            <p className="text-slate-500 mt-0.5 truncate">{a.detail}</p>
                          </div>
                          <span className="text-[11px] text-slate-400 shrink-0">
                            {new Date(a.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* USERS & BALANCES TAB */}
          {tab === 'users' && (
            <div className="space-y-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await apiFetch('/api/admin/users', {
                      method: 'POST',
                      body: JSON.stringify({
                        name: newUserName,
                        email: newUserEmail,
                        password: newUserPass,
                        role: newUserRole,
                        balance: Number(newUserBal),
                      }),
                    });
                    setNewUserName('');
                    setNewUserEmail('');
                    setNewUserPass('');
                    setNewUserBal(0);
                    notify('Account created permanently!', 'success');
                    await loadAdmin();
                  } catch (err) {
                    notify(err instanceof Error ? err.message : 'Failed to create user', 'error');
                  }
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  Create User or Co-Admin Account
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Full Name"
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="Email Address"
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  <input
                    type="password"
                    required
                    value={newUserPass}
                    onChange={(e) => setNewUserPass(e.target.value)}
                    placeholder="Password"
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin')}
                      className="px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                    <input
                      type="number"
                      value={newUserBal}
                      onChange={(e) => setNewUserBal(Number(e.target.value))}
                      placeholder="Bal (₦)"
                      className="px-2 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <button
                    type="submit"
                    className="py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
                  >
                    Create Account
                  </button>
                </div>
              </form>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      User Directory · Credit, Debit, Notify, Suspend &amp; Delete
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Showing {filteredUsers.length} of {data.users.length} accounts
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-56 sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleExportUsersCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: `All (${data.users.length})` },
                      { id: 'active', label: `Active (${activeUsersCount})` },
                      { id: 'suspended', label: `Suspended (${suspendedUsersCount})` },
                      {
                        id: 'admin',
                        label: `Admins (${data.users.filter((u) => u.role === 'admin').length})`,
                      },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setUserRoleFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        userRoleFilter === f.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="py-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="sm" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {u.name}
                              </p>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                  u.role === 'admin'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {u.role}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                  u.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                }`}
                              >
                                {u.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {u.email} · Ref: <span className="font-mono">{u.referralCode}</span>
                            </p>
                          </div>
                        </div>
                        <p className="font-display text-lg font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                          {formatNaira(u.balance, symbol)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          placeholder="Amount (₦)"
                          value={balanceInputs[u.id] || ''}
                          onChange={(e) =>
                            setBalanceInputs({ ...balanceInputs, [u.id]: e.target.value })
                          }
                          className="w-28 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const amt = Number(balanceInputs[u.id] || 0);
                            if (!amt || amt <= 0) return;
                            try {
                              await apiFetch(`/api/admin/users/${u.id}/balance`, {
                                method: 'POST',
                                body: JSON.stringify({
                                  mode: 'credit',
                                  amount: amt,
                                  note: 'Team Credit',
                                }),
                              });
                              setBalanceInputs({ ...balanceInputs, [u.id]: '' });
                              notify(`Credited ${formatNaira(amt, symbol)} to ${u.email}`, 'success');
                              await loadAdmin();
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Credit failed', 'error');
                            }
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                        >
                          + Credit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const amt = Number(balanceInputs[u.id] || 0);
                            if (!amt || amt <= 0) return;
                            try {
                              await apiFetch(`/api/admin/users/${u.id}/balance`, {
                                method: 'POST',
                                body: JSON.stringify({
                                  mode: 'debit',
                                  amount: amt,
                                  note: 'Team Debit',
                                }),
                              });
                              setBalanceInputs({ ...balanceInputs, [u.id]: '' });
                              notify(`Debited ${formatNaira(amt, symbol)} from ${u.email}`, 'info');
                              await loadAdmin();
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Debit failed', 'error');
                            }
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer"
                        >
                          - Debit
                        </button>

                        {(u.role !== 'admin' || u.status === 'suspended') && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const next = u.status === 'active' ? 'suspended' : 'active';
                                await apiFetch(`/api/admin/users/${u.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: next }),
                                });
                                notify(
                                  next === 'suspended'
                                    ? `${u.email} suspended`
                                    : `${u.email} restored to active`,
                                  'info',
                                );
                                await loadAdmin();
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Status update failed', 'error');
                              }
                            }}
                            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer ${
                              u.status === 'active'
                                ? 'border border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {u.status === 'active' ? 'Suspend' : 'Restore Account'}
                          </button>
                        )}

                        <input
                          type="password"
                          placeholder="New pass (6+)"
                          value={resetPassInputs[u.id] || ''}
                          onChange={(e) =>
                            setResetPassInputs({ ...resetPassInputs, [u.id]: e.target.value })
                          }
                          className="w-28 px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const pw = resetPassInputs[u.id] || '';
                            if (pw.length < 6) {
                              notify('Password must be 6+ chars', 'error');
                              return;
                            }
                            try {
                              await apiFetch(`/api/admin/users/${u.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ newPassword: pw }),
                              });
                              setResetPassInputs({ ...resetPassInputs, [u.id]: '' });
                              notify(`Password updated for ${u.email}`, 'success');
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Reset failed', 'error');
                            }
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                        >
                          Reset Pass
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit User
                        </button>

                        <button
                          type="button"
                          onClick={() => setInspectUserId(u.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          Inspect 360°
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setNotifyTargetUserId(u.id);
                            setTab('notifications');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          Message
                        </button>

                        {u.email !== 'chibuikeexcellent592@gmail.com' && (
                          confirmDeleteUserId === u.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
                                    setConfirmDeleteUserId(null);
                                    notify('User & all records permanently deleted', 'info');
                                    await loadAdmin();
                                  } catch (err) {
                                    notify(err instanceof Error ? err.message : 'Delete failed', 'error');
                                  }
                                }}
                                className="px-2.5 py-1.5 text-[11px] font-bold bg-rose-600 text-white rounded-lg cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserId(null)}
                                className="px-2 py-1.5 text-[11px] border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserId(u.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete Permanently
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* RECEIPTS & ORDERS TAB */}
          {tab === 'orders' && (
            <div className="space-y-6">
              {/* Moniepoint Receipt Verification Queue */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-blue-600" />
                      {data.settings.bankName} Forensic Receipt Audits ({pendingDeposits.length} Pending)
                    </h2>
                    <p className="text-xs text-slate-500">
                      AI inspects amount, destination bank/account/name, receipt date &amp; time vs
                      Nigeria WAT, transfer status, tampering, and duplicate references.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {confirmClearOrders ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch('/api/admin/orders/clear', {
                                method: 'POST',
                                body: JSON.stringify({ scope: confirmClearOrders }),
                              });
                              setConfirmClearOrders(null);
                              notify(
                                confirmClearOrders === 'all'
                                  ? 'Orders cleared from Overwatch (users keep their order history)'
                                  : 'Completed orders cleared from Overwatch (users keep their order history)',
                                'success',
                              );
                              await loadAdmin();
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Clear failed', 'error');
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer"
                        >
                          Confirm Clear {confirmClearOrders === 'all' ? 'ALL Orders' : 'Completed'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearOrders(null)}
                          className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmClearOrders('completed')}
                          className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Clear Completed Orders
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearOrders('all')}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          Clear All Orders
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'all', label: `All (${allDeposits.length})` },
                        { id: 'pending', label: `Pending (${pendingDeposits.length})` },
                        {
                          id: 'verified',
                          label: `Verified (${allDeposits.filter((d) => d.status === 'verified').length})`,
                        },
                        {
                          id: 'rejected',
                          label: `Rejected (${allDeposits.filter((d) => d.status === 'rejected').length})`,
                        },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setDepositFilter(f.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                          depositFilter === f.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {matchedPendingDepositsCount > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await apiFetch<{ approvedCount: number; totalCredited: number }>(
                            '/api/admin/transactions/bulk-approve-matched',
                            { method: 'POST' },
                          );
                          notify(
                            `Approved ${res.approvedCount} AI-matched deposits (${formatNaira(res.totalCredited, symbol)})`,
                            'success',
                          );
                          await loadAdmin();
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'Bulk approve failed', 'error');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Approve All AI-Matched ({matchedPendingDepositsCount})
                    </button>
                  )}
                </div>

                {visibleDeposits.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">
                    No {data.settings.bankName} deposit receipts matching this filter.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleDeposits.map((tx) => {
                      const audit = tx.aiAudit;
                      const checks = audit?.checks;
                      return (
                        <div
                          key={tx.id}
                          className="py-4 flex flex-wrap items-start justify-between gap-4"
                        >
                          <div className="space-y-2 flex-1 min-w-[260px] max-w-2xl">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {tx.userName} ({tx.userEmail}) —{' '}
                              <span className="font-mono text-blue-600 dark:text-blue-400">
                                {formatNaira(tx.amount, symbol)}
                              </span>
                            </p>
                            <p className="text-xs text-slate-500">
                              Status:{' '}
                              <strong
                                className={`uppercase ${
                                  tx.status === 'verified'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : tx.status === 'rejected'
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {tx.status}
                              </strong>{' '}
                              · Submitted: {new Date(tx.createdAt).toLocaleString()}
                              {tx.senderNote ? ` · Note: ${tx.senderNote}` : ''}
                            </p>

                            {audit && (
                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span
                                    className={`font-bold uppercase px-2 py-0.5 rounded text-[11px] ${
                                      audit.verdict === 'match'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : audit.verdict === 'mismatch'
                                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    }`}
                                  >
                                    AI Forensic: {audit.verdict} · {audit.confidence}%
                                  </span>
                                  {audit.extractedDateTime && (
                                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                      Receipt Time: {audit.extractedDateTime}
                                      {typeof audit.ageMinutes === 'number'
                                        ? ` (${
                                            audit.ageMinutes < 0
                                              ? `${Math.abs(audit.ageMinutes)}m in future!`
                                              : `${audit.ageMinutes}m ago`
                                          })`
                                        : ''}
                                    </span>
                                  )}
                                </div>

                                <p className="text-slate-700 dark:text-slate-300">{audit.summary}</p>

                                {(audit.extractedAmount !== undefined ||
                                  audit.extractedBank ||
                                  audit.extractedAccount ||
                                  audit.extractedAccountName ||
                                  audit.extractedSenderName ||
                                  audit.extractedReference ||
                                  audit.extractedStatus) && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                                    {audit.extractedAmount !== undefined && (
                                      <span>
                                        Receipt Amount:{' '}
                                        <strong className="font-mono text-slate-800 dark:text-slate-200">
                                          {formatNaira(audit.extractedAmount, symbol)}
                                        </strong>
                                      </span>
                                    )}
                                    {audit.extractedStatus && (
                                      <span>
                                        Transfer Status:{' '}
                                        <strong className="text-slate-800 dark:text-slate-200">
                                          {audit.extractedStatus}
                                        </strong>
                                      </span>
                                    )}
                                    {audit.extractedBank && (
                                      <span>
                                        Dest. Bank:{' '}
                                        <strong className="text-slate-800 dark:text-slate-200">
                                          {audit.extractedBank}
                                        </strong>
                                      </span>
                                    )}
                                    {audit.extractedAccount && (
                                      <span>
                                        Dest. Acct #:{' '}
                                        <strong className="font-mono text-slate-800 dark:text-slate-200">
                                          {audit.extractedAccount}
                                        </strong>
                                      </span>
                                    )}
                                    {audit.extractedAccountName && (
                                      <span>
                                        Dest. Name:{' '}
                                        <strong className="text-slate-800 dark:text-slate-200">
                                          {audit.extractedAccountName}
                                        </strong>
                                      </span>
                                    )}
                                    {audit.extractedSenderName && (
                                      <span>
                                        Sender:{' '}
                                        <strong className="text-slate-800 dark:text-slate-200">
                                          {audit.extractedSenderName}
                                          {audit.extractedSenderBank
                                            ? ` (${audit.extractedSenderBank})`
                                            : ''}
                                        </strong>
                                      </span>
                                    )}
                                    {audit.extractedReference && (
                                      <span className="sm:col-span-2 truncate">
                                        Bank Ref / Session ID:{' '}
                                        <strong className="font-mono text-slate-800 dark:text-slate-200">
                                          {audit.extractedReference}
                                        </strong>
                                      </span>
                                    )}
                                  </div>
                                )}

                                {checks && (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {(
                                      [
                                        ['Amount', checks.amountMatch],
                                        ['Bank', checks.bankMatch],
                                        ['Acct #', checks.accountNumberMatch],
                                        ['Acct Name', checks.accountNameMatch],
                                        ['Success', checks.statusSuccess],
                                        ['Date & Time', checks.dateTimeRecent],
                                        ['Authentic', checks.noTampering],
                                        ['Unique Ref', checks.uniqueReference],
                                      ] as [string, boolean][]
                                    ).map(([label, ok]) => (
                                      <span
                                        key={label}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                          ok
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                        }`}
                                      >
                                        {ok ? '✓' : '✗'} {label}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {tx.receiptImage && (
                              <button
                                type="button"
                                onClick={() => setReceiptPreview(tx.receiptImage || null)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Receipt
                              </button>
                            )}
                            {tx.status !== 'verified' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiFetch(`/api/admin/transactions/${tx.id}/decision`, {
                                      method: 'POST',
                                      body: JSON.stringify({ decision: 'approve' }),
                                    });
                                    notify('Deposit approved and credited!', 'success');
                                    await loadAdmin();
                                  } catch (err) {
                                    notify(err instanceof Error ? err.message : 'Approve failed', 'error');
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-xl cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Approve
                              </button>
                            )}
                            {tx.status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiFetch(`/api/admin/transactions/${tx.id}/decision`, {
                                      method: 'POST',
                                      body: JSON.stringify({
                                        decision: tx.status === 'verified' ? 'reverse' : 'reject',
                                      }),
                                    });
                                    notify('Transfer declined/reversed', 'info');
                                    await loadAdmin();
                                  } catch (err) {
                                    notify(err instanceof Error ? err.message : 'Action failed', 'error');
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-xl cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                {tx.status === 'verified' ? 'Reverse' : 'Reject'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await apiFetch(`/api/admin/transactions/${tx.id}`, {
                                    method: 'DELETE',
                                  });
                                  notify('Deposit record deleted', 'info');
                                  await loadAdmin();
                                } catch (err) {
                                  notify(err instanceof Error ? err.message : 'Delete failed', 'error');
                                }
                              }}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                              title="Delete deposit history record"
                              aria-label="Delete deposit record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SMS Orders & Pool */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      SMS Orders ({filteredSmsOrders.length} / {data.smsOrders.length})
                    </h2>
                    <div className="flex items-center gap-2">
                      <div className="relative w-44">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={smsSearch}
                          onChange={(e) => setSmsSearch(e.target.value)}
                          placeholder="Search SMS..."
                          className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                        />
                      </div>
                      {data.smsOrders.length > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch('/api/admin/orders/clear', {
                                method: 'POST',
                                body: JSON.stringify({ scope: 'sms' }),
                              });
                              notify('All SMS orders cleared', 'info');
                              await loadAdmin();
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Clear failed', 'error');
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-lg cursor-pointer"
                        >
                          Clear SMS
                        </button>
                      )}
                    </div>
                  </div>
                  {filteredSmsOrders.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No matching SMS orders.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                      {filteredSmsOrders.map((ord) => {
                        const isAwaitingNum =
                          !ord.phoneNumber || ord.phoneNumber === 'Awaiting number';
                        return (
                        <div key={ord.id} className="py-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5">
                              <span>
                                {ord.serviceName} ({ord.countryName}) ·
                              </span>
                              {isAwaitingNum ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 text-[10px] font-bold">
                                  Awaiting #
                                </span>
                              ) : (
                                <span className="font-mono">{ord.phoneNumber}</span>
                              )}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              {ord.status === 'waiting' && (() => {
                                const timer = formatCountdown(ord.expiresAt, nowMs);
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tabular-nums ${
                                      timer.isUrgent
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                                    }`}
                                    title="15-minute SMS timer remaining"
                                  >
                                    <Clock className="w-3 h-3" />
                                    {timer.remainingMs > 0 ? timer.label : '00:00'}
                                  </span>
                                );
                              })()}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  ord.status === 'waiting'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                    : ord.status === 'received'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                {ord.status === 'waiting'
                                  ? isAwaitingNum
                                    ? 'Awaiting #'
                                    : 'Waiting OTP'
                                  : ord.status}
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiFetch(`/api/admin/sms-orders/${ord.id}`, {
                                      method: 'DELETE',
                                    });
                                    notify('SMS order removed', 'info');
                                    await loadAdmin();
                                  } catch (err) {
                                    notify(err instanceof Error ? err.message : 'Remove failed', 'error');
                                  }
                                }}
                                className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                                title="Delete SMS order"
                                aria-label="Delete SMS order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {ord.userEmail}
                            {ord.otpCode ? ` · Delivered OTP: ${ord.otpCode}` : ''}
                          </p>
                          {ord.status !== 'cancelled' && (
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="text"
                                placeholder={isAwaitingNum ? 'Drop # (e.g. +1...)' : 'Override #'}
                                value={phoneInputs[ord.id] || ''}
                                onChange={(e) =>
                                  setPhoneInputs({ ...phoneInputs, [ord.id]: e.target.value })
                                }
                                className="w-36 px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const num = phoneInputs[ord.id]?.trim();
                                  if (!num) return;
                                  try {
                                    await apiFetch(`/api/admin/sms-orders/${ord.id}/assign-number`, {
                                      method: 'POST',
                                      body: JSON.stringify({ phoneNumber: num }),
                                    });
                                    setPhoneInputs((prev) => ({ ...prev, [ord.id]: '' }));
                                    notify('Phone number updated', 'success');
                                    await loadAdmin();
                                  } catch (err) {
                                    notify(err instanceof Error ? err.message : 'Assign failed', 'error');
                                  }
                                }}
                                className="px-2.5 py-1 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                              >
                                Assign #
                              </button>
                              <input
                                type="text"
                                placeholder={ord.status === 'received' ? 'New OTP code' : 'Enter OTP code'}
                                value={otpInputs[ord.id] || ''}
                                onChange={(e) =>
                                  setOtpInputs({ ...otpInputs, [ord.id]: e.target.value })
                                }
                                className="w-32 px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const code = otpInputs[ord.id]?.trim();
                                  if (!code) return;
                                  const droppedPhone = phoneInputs[ord.id]?.trim() || undefined;
                                  try {
                                    await apiFetch(`/api/admin/sms-orders/${ord.id}/deliver`, {
                                      method: 'POST',
                                      body: JSON.stringify({
                                        otpCode: code,
                                        phoneNumber: droppedPhone,
                                      }),
                                    });
                                    setOtpInputs((prev) => ({ ...prev, [ord.id]: '' }));
                                    if (droppedPhone) {
                                      setPhoneInputs((prev) => ({ ...prev, [ord.id]: '' }));
                                    }
                                    notify('OTP delivered to user inbox!', 'success');
                                    await loadAdmin();
                                  } catch (err) {
                                    notify(err instanceof Error ? err.message : 'Delivery failed', 'error');
                                  }
                                }}
                                className="px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                              >
                                {ord.status === 'received' ? 'Update OTP' : 'Deliver OTP'}
                              </button>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Overwatch SMS Number Pool ({data.smsPool.length})
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Add real numbers with an optional preset OTP, or leave OTP blank to send manually when bought.
                    </p>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const activePoolCountry =
                        data.smsCountries.find((c) => c.id === poolCountry)?.id ||
                        data.smsCountries[0]?.id ||
                        poolCountry;
                      try {
                        await apiFetch('/api/admin/sms-pool', {
                          method: 'POST',
                          body: JSON.stringify({
                            phoneNumber: poolNumber,
                            countryId: activePoolCountry,
                            serviceId: poolService,
                            presetOtp: poolOtp,
                          }),
                        });
                        setPoolNumber('');
                        setPoolOtp('');
                        notify('Added number to SMS pool', 'success');
                        await loadAdmin();
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Pool add failed', 'error');
                      }
                    }}
                    className="space-y-2.5"
                  >
                    <input
                      type="text"
                      required
                      value={poolNumber}
                      onChange={(e) => setPoolNumber(e.target.value)}
                      placeholder="Phone Number (e.g. +1 415 555 0199)"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={
                          data.smsCountries.find((c) => c.id === poolCountry)?.id ||
                          data.smsCountries[0]?.id ||
                          poolCountry
                        }
                        onChange={(e) => setPoolCountry(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      >
                        {data.smsCountries.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={poolService}
                        onChange={(e) => setPoolService(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      >
                        <option value="">Any Service</option>
                        {data.smsServices.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={poolOtp}
                      onChange={(e) => setPoolOtp(e.target.value)}
                      placeholder="Optional Preset OTP (leave blank to send manually)"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 text-xs font-bold text-white bg-blue-600 rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add to Pool
                    </button>
                  </form>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                    {data.smsPool.map((p) => (
                      <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-mono font-semibold">{p.phoneNumber}</p>
                          <p className="text-[11px] text-slate-500">
                            {p.used ? 'Assigned' : 'Ready'}{' '}
                            {p.presetOtp ? `· OTP: ${p.presetOtp}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/admin/sms-pool/${p.id}`, { method: 'DELETE' });
                              notify('Removed number from pool', 'info');
                              await loadAdmin();
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Remove failed', 'error');
                            }
                          }}
                          className="text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Boosting Fulfillment Desk */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Social Boosting Fulfillment Desk ({filteredBoostingOrders.length} /{' '}
                      {data.boostingOrders.length})
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Every user boosting purchase is sent directly here with full campaign details.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pendingBoostCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await apiFetch<{ updatedCount: number }>(
                              '/api/admin/boosting-orders/bulk-status',
                              {
                                method: 'POST',
                                body: JSON.stringify({ fromStatus: 'pending', toStatus: 'processing' }),
                              },
                            );
                            notify(`Moved ${res.updatedCount} pending orders to Processing`, 'success');
                            await loadAdmin();
                          } catch (err) {
                            notify(err instanceof Error ? err.message : 'Bulk update failed', 'error');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-lg cursor-pointer"
                      >
                        <Zap className="w-3 h-3" />
                        Start Pending ({pendingBoostCount})
                      </button>
                    )}
                    {processingBoostCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await apiFetch<{ updatedCount: number }>(
                              '/api/admin/boosting-orders/bulk-status',
                              {
                                method: 'POST',
                                body: JSON.stringify({ fromStatus: 'processing', toStatus: 'completed' }),
                              },
                            );
                            notify(`Completed ${res.updatedCount} processing orders`, 'success');
                            await loadAdmin();
                          } catch (err) {
                            notify(err instanceof Error ? err.message : 'Bulk complete failed', 'error');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded-lg cursor-pointer"
                      >
                        <CheckCheck className="w-3 h-3" />
                        Complete Processing ({processingBoostCount})
                      </button>
                    )}
                    {data.boostingOrders.length > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiFetch('/api/admin/orders/clear', {
                              method: 'POST',
                              body: JSON.stringify({ scope: 'boosting' }),
                            });
                            notify('All boosting orders cleared', 'info');
                            await loadAdmin();
                          } catch (err) {
                            notify(err instanceof Error ? err.message : 'Clear failed', 'error');
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-lg cursor-pointer"
                      >
                        Clear Boosting
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['all', 'pending', 'processing', 'completed', 'refilling'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setBoostStatusFilter(st)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize cursor-pointer ${
                          boostStatusFilter === st
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={boostSearch}
                      onChange={(e) => setBoostSearch(e.target.value)}
                      placeholder="Search email, link, order #..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                {filteredBoostingOrders.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No boosting orders matching your filter.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredBoostingOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="py-3.5 flex flex-wrap items-start justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              {ord.platform}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">#{ord.id}</span>
                            <span className="text-[11px] text-slate-400">
                              · {new Date(ord.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {ord.serviceName} · Qty: {ord.quantity.toLocaleString()} ·{' '}
                            <span className="text-blue-600 dark:text-blue-400 font-mono">
                              {formatNaira(ord.amount, symbol)}
                            </span>
                          </p>
                          <p className="text-slate-600 dark:text-slate-300">
                            Buyer: <span className="font-semibold">{ord.userEmail}</span>
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="font-mono text-[11px] px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 break-all">
                              {ord.targetUrl}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                await copyText(ord.targetUrl);
                                notify('Target link copied', 'success');
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-lg cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              Copy Link
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={ord.status}
                            onChange={async (e) => {
                              try {
                                await apiFetch(`/api/admin/boosting-orders/${ord.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: e.target.value }),
                                });
                                notify('Boosting order status updated', 'success');
                                await loadAdmin();
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Status update failed', 'error');
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold"
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="completed">Completed</option>
                            <option value="refilling">Refilling</option>
                            <option value="cancelled">Cancel &amp; Refund</option>
                          </select>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/admin/boosting-orders/${ord.id}`, {
                                  method: 'DELETE',
                                });
                                notify('Boosting order deleted', 'info');
                                await loadAdmin();
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Delete failed', 'error');
                              }
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                            title="Delete boosting order"
                            aria-label="Delete boosting order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Full Transaction History & Clear Controls */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-blue-600" />
                      All Transaction History ({filteredTransactions.length} /{' '}
                      {data.transactions.length})
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Clear entries from Overwatch without affecting users&apos; balances, orders, or
                      transaction history.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {confirmClearTx ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch('/api/admin/transactions/clear', {
                                method: 'POST',
                                body: JSON.stringify({ scope: confirmClearTx }),
                              });
                              setConfirmClearTx(null);
                              notify('Selected transaction history cleared!', 'success');
                              await loadAdmin();
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Clear failed', 'error');
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer"
                        >
                          Confirm Clear ({confirmClearTx === 'all' ? 'ALL' : confirmClearTx})
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearTx(null)}
                          className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {txFilter !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setConfirmClearTx(txFilter)}
                            className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            Clear {txFilter}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmClearTx('all')}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          Clear All History
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'deposit', label: 'Deposits' },
                        { id: 'purchase', label: 'Purchases' },
                        { id: 'refund', label: 'Refunds' },
                        { id: 'credits', label: 'Credits & Bonuses' },
                      ] as const
                    ).map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setTxFilter(chip.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          txFilter === chip.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      placeholder="Filter by email, ID, description..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>

                {filteredTransactions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No matching transaction history records.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                    {filteredTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {tx.type.replace('_', ' ')}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">#{tx.id}</span>
                            <span className="text-[11px] text-slate-400">
                              · {new Date(tx.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {tx.userEmail} — {tx.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            {formatNaira(tx.amount, symbol)}
                          </span>
                          <span className="uppercase text-[10px] font-bold text-slate-500">
                            {tx.status}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/admin/transactions/${tx.id}`, {
                                  method: 'DELETE',
                                });
                                notify('Transaction deleted', 'info');
                                await loadAdmin();
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Delete failed', 'error');
                              }
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                            title="Delete transaction"
                            aria-label="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Marketplace & Section Vault Deliveries */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-purple-600" />
                      Marketplace &amp; Section Vault Deliveries ({filteredVaultItems.length} / {vaultItemsList.length})
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Every delivered digital asset credential or key. Clearing here hides from Overwatch while buyers keep their Vault items.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {vaultItemsList.length > 0 && (
                      confirmClearVault ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch('/api/admin/orders/clear', {
                                  method: 'POST',
                                  body: JSON.stringify({ scope: 'vault' }),
                                });
                                setConfirmClearVault(false);
                                notify('Vault delivery log cleared from Overwatch', 'success');
                                await loadAdmin();
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Clear failed', 'error');
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-xl cursor-pointer"
                          >
                            Confirm Clear Vault Log
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmClearVault(false)}
                            className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmClearVault(true)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          Clear Vault Log
                        </button>
                      )
                    )}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={vaultSearch}
                        onChange={(e) => setVaultSearch(e.target.value)}
                        placeholder="Search buyer, product, key..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                  </div>
                </div>

                {filteredVaultItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No marketplace or section vault deliveries match your filter.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                    {filteredVaultItems.map((v) => (
                      <div key={v.id} className="py-3.5 flex flex-wrap items-start justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                              {v.sourceType} · {v.category}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">#{v.id}</span>
                            <span className="text-[11px] text-slate-400">
                              · {new Date(v.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {v.title} ·{' '}
                            <span className="font-mono text-blue-600 dark:text-blue-400">
                              {formatNaira(v.price, symbol)}
                            </span>
                          </p>
                          <p className="text-slate-600 dark:text-slate-300">
                            Buyer: <span className="font-semibold">{v.buyerName || 'User'}</span> ({v.buyerEmail || v.userId})
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 break-all">
                              {v.deliveredCredential}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                await copyText(v.deliveredCredential);
                                notify('Delivered credential copied', 'success');
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-lg cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setInspectUserId(v.userId)}
                            className="px-2.5 py-1.5 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            Buyer 360°
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/admin/vault-items/${v.id}`, { method: 'DELETE' });
                                notify('Vault record cleared from Overwatch', 'info');
                                await loadAdmin();
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Delete failed', 'error');
                              }
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                            aria-label="Delete vault delivery record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PROMO CODES TAB */}
          {tab === 'promos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await apiFetch('/api/admin/promo-codes', {
                      method: 'POST',
                      body: JSON.stringify({
                        code: promoCodeStr,
                        discountType: promoType,
                        value: Number(promoVal),
                        maxUses: Number(promoMax),
                      }),
                    });
                    setPromoCodeStr('');
                    notify('Promo code activated!', 'success');
                    await loadAdmin();
                  } catch (err) {
                    notify(err instanceof Error ? err.message : 'Failed to create promo', 'error');
                  }
                }}
                className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-600" />
                  Create Marketplace Promo Code
                </h2>
                <input
                  type="text"
                  required
                  value={promoCodeStr}
                  onChange={(e) => setPromoCodeStr(e.target.value.toUpperCase())}
                  placeholder="Code (e.g. SURE20)"
                  className="w-full px-3 py-2 text-xs font-mono uppercase rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={promoType}
                    onChange={(e) => setPromoType(e.target.value as 'percent' | 'fixed')}
                    className="px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="percent">% Off</option>
                    <option value="fixed">Fixed ({symbol})</option>
                  </select>
                  <input
                    type="number"
                    value={promoVal}
                    onChange={(e) => setPromoVal(Number(e.target.value))}
                    placeholder="Value"
                    className="px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  <input
                    type="number"
                    value={promoMax}
                    onChange={(e) => setPromoMax(Number(e.target.value))}
                    placeholder="Max Uses"
                    className="px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
                >
                  Activate Promo Code
                </button>
              </form>

              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 divide-y divide-slate-100 dark:divide-slate-800">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white pb-3">
                  Active Discount Codes
                </h2>
                {data.promoCodes.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">No promo codes yet.</p>
                ) : (
                  data.promoCodes.map((p) => (
                    <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                            {p.code}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              p.active
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {p.active ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <p className="text-slate-500 mt-0.5">
                          {p.discountType === 'percent'
                            ? `${p.value}% discount`
                            : `${formatNaira(p.value, symbol)} off`}{' '}
                          · Uses: {p.uses} / {p.maxUses}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/admin/promo-codes/${p.id}/toggle`, {
                                method: 'PATCH',
                              });
                              notify(
                                p.active ? `Promo ${p.code} paused` : `Promo ${p.code} resumed`,
                                'info',
                              );
                              await loadAdmin();
                            } catch (err) {
                              notify(
                                err instanceof Error ? err.message : 'Toggle failed',
                                'error',
                              );
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {p.active ? (
                            <>
                              <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
                              Pause
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-3.5 h-3.5 text-emerald-500" />
                              Resume
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/admin/promo-codes/${p.id}`, { method: 'DELETE' });
                              notify('Promo code removed', 'info');
                              await loadAdmin();
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Remove failed', 'error');
                            }
                          }}
                          className="text-rose-500 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ACCOUNTING ARCHIVE TAB (Independent from Dashboard Clear / Refresh) */}
          {tab === 'accounting' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 flex items-start gap-3">
                <Archive className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                  <p className="font-bold">Permanent Accounting Ledger Archive</p>
                  <p className="mt-0.5 opacity-90">
                    Every order (SMS, Boosting, Marketplace &amp; Custom Vault) and wallet transaction is accounted for independently here. Clearing Orders &amp; Transactions or running Refresh Website on your dashboard never removes entries here unless you delete or clear them manually inside Accounting.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Recorded Order Sales
                  </p>
                  <p className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 tabular-nums">
                    {formatNaira(accountingOrderSalesTotal, symbol)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Verified Deposits
                  </p>
                  <p className="font-display text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1.5 tabular-nums">
                    {formatNaira(accountingDepositsTotal, symbol)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Refunds &amp; Bonuses
                  </p>
                  <p className="font-display text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1.5 tabular-nums">
                    {formatNaira(accountingRefundsBonusesTotal, symbol)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Archived Records
                  </p>
                  <p className="font-display text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1.5 tabular-nums">
                    {accountingRecordsList.length}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={accSearch}
                        onChange={(e) => setAccSearch(e.target.value)}
                        placeholder="Search by ID, order/tx ref, customer name, email, or item..."
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                      {(['all', 'order', 'transaction'] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setAccKindFilter(k)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                            accKindFilter === k
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {k === 'all' ? 'All' : k === 'order' ? 'Orders' : 'Transactions'}
                        </button>
                      ))}
                    </div>
                    <select
                      value={accCatFilter}
                      onChange={(e) => setAccCatFilter(e.target.value)}
                      className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    >
                      <option value="all">All Categories</option>
                      {accountingCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleExportAccountingCsv}
                      disabled={filteredAccountingRecords.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      Export CSV
                    </button>
                    {accountingRecordsList.length > 0 && (
                      confirmClearAccounting ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch('/api/admin/accounting/clear', {
                                  method: 'POST',
                                  body: JSON.stringify({ kind: accKindFilter === 'all' ? 'all' : accKindFilter }),
                                });
                                setConfirmClearAccounting(false);
                                notify('Accounting entries cleared permanently', 'info');
                                await loadAdmin();
                              } catch (err) {
                                notify(err instanceof Error ? err.message : 'Failed to clear archive', 'error');
                              }
                            }}
                            className="px-3 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer"
                          >
                            Confirm Clear {accKindFilter === 'all' ? 'All' : accKindFilter}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmClearAccounting(false)}
                            className="px-2.5 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmClearAccounting(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Clear Archive
                        </button>
                      )
                    )}
                  </div>
                </div>

                {filteredAccountingRecords.length === 0 ? (
                  <p className="py-12 text-center text-xs text-slate-500">
                    No accounting entries match your search or filter.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
                    {filteredAccountingRecords.map((rec) => (
                      <div
                        key={rec.id}
                        className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                rec.kind === 'order'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              }`}
                            >
                              {rec.kind}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                              {rec.category}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                void copyText(rec.sourceId);
                                notify(`Copied ID ${rec.sourceId}`, 'info');
                              }}
                              className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-500 cursor-pointer"
                              title="Click to copy reference ID"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              {rec.sourceId}
                            </button>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                ['completed', 'verified', 'received'].includes(rec.status)
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : ['cancelled', 'rejected', 'expired'].includes(rec.status)
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {rec.status}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white break-words">
                            {rec.title}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400 break-words">
                            {rec.userName} ({rec.userEmail}) · {rec.detail}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="font-mono font-extrabold text-sm text-slate-900 dark:text-white tabular-nums">
                              {formatNaira(rec.amount, symbol)}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {new Date(rec.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/admin/accounting/${rec.id}`, {
                                  method: 'DELETE',
                                });
                                notify('Accounting entry deleted', 'info');
                                await loadAdmin();
                              } catch (err) {
                                notify(
                                  err instanceof Error ? err.message : 'Delete failed',
                                  'error',
                                );
                              }
                            }}
                            className="p-2 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 cursor-pointer"
                            aria-label="Delete accounting entry"
                            title="Delete this entry from Accounting"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AUDIT LOGS TAB */}
          {tab === 'audit' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Overwatch Creator Audit Log ({data.auditLogs.length})
                  </h2>
                </div>
                {data.auditLogs.length > 0 && (
                  confirmClearAudit ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiFetch('/api/admin/audit-logs/clear', { method: 'POST' });
                            setConfirmClearAudit(false);
                            notify('Audit history cleared', 'info');
                            await loadAdmin();
                          } catch (err) {
                            notify(err instanceof Error ? err.message : 'Clear failed', 'error');
                          }
                        }}
                        className="px-3 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                      >
                        Confirm Clear History
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAudit(false)}
                        className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAudit(true)}
                      className="px-3 py-1 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      Clear Audit History
                    </button>
                  )
                )}
              </div>
              {data.auditLogs.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">
                  Creator &amp; platform actions (product edits, balance updates, settings changes) are logged here.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[540px] overflow-y-auto">
                  {data.auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {log.action}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {log.target}
                          </span>
                        </div>
                        <p className="text-slate-500">
                          {log.detail} · by {log.actorEmail}
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CATALOG, SECTIONS & LOGOS */}
          {tab === 'catalog' && <AdminCatalogPanel data={data} onRefresh={loadAdmin} />}

          {/* WALLET & SECTIONS COPY */}
          {tab === 'copy' && (
            <AdminSectionCopyPanel settings={data.settings} onRefresh={loadAdmin} />
          )}

          {/* CMS, ALERTS, TUTORIALS, SUPPORT, SETTINGS */}
          {(tab === 'cms' ||
            tab === 'notifications' ||
            tab === 'tutorials' ||
            tab === 'support' ||
            tab === 'settings') && (
            <AdminCommsAndSettingsPanel
              tab={tab}
              data={data}
              onRefresh={loadAdmin}
              initialRecipientUserId={notifyTargetUserId}
              onPreviewMaintenance={onPreviewMaintenance}
            />
          )}
          </main>
        </div>
      </div>

      {/* User 360° Inspector Modal */}
      {inspectedUser && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setInspectUserId(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                    {inspectedUser.name}
                  </h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    {inspectedUser.role}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      inspectedUser.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {inspectedUser.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {inspectedUser.email} · ID: <span className="font-mono">{inspectedUser.id}</span> · Ref:{' '}
                  <span className="font-mono">{inspectedUser.referralCode}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectUserId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                aria-label="Close inspector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const userTx = data.transactions.filter((t) => t.userId === inspectedUser.id);
              const totalDeposits = userTx
                .filter((t) => t.type === 'deposit' && t.status === 'verified')
                .reduce((s, t) => s + t.amount, 0);
              const totalSpent = userTx
                .filter((t) => t.type === 'purchase' && t.status === 'completed')
                .reduce((s, t) => s + t.amount, 0);
              const userSms = data.smsOrders.filter((s) => s.userId === inspectedUser.id).length;
              const userBoost = data.boostingOrders.filter((b) => b.userId === inspectedUser.id).length;
              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500">Wallet Balance</p>
                      <p className="font-mono text-base font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
                        {formatNaira(inspectedUser.balance, symbol)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500">Verified Deposits</p>
                      <p className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                        {formatNaira(totalDeposits, symbol)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500">Total Spent</p>
                      <p className="font-mono text-base font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                        {formatNaira(totalSpent, symbol)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500">Orders Placed</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-1">
                        {userSms} SMS · {userBoost} Boosts
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Recent Activity ({userTx.length} transactions)
                    </h4>
                    {userTx.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        No transactions recorded yet for this account.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl px-3">
                        {userTx.slice(0, 8).map((tx) => (
                          <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {tx.description}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {new Date(tx.createdAt).toLocaleString()} · {tx.status}
                              </p>
                            </div>
                            <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0 tabular-nums">
                              {formatNaira(tx.amount, symbol)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const target = inspectedUser;
                          setInspectUserId(null);
                          openEditUser(target);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit User
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNotifyTargetUserId(inspectedUser.id);
                          setInspectUserId(null);
                          setTab('notifications');
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send Direct Alert
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUserSearch(inspectedUser.email);
                        setInspectUserId(null);
                        setTab('users');
                      }}
                      className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Manage in Directory
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Full Edit User Modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingUser(null)}
        >
          <form
            onSubmit={handleSaveUserEdit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar name={editUserName} avatarUrl={editUserAvatar} size="sm" />
                <div className="min-w-0">
                  <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white truncate">
                    Edit User Account
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">{editingUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                aria-label="Close user editor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-500">Full Name</label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500">Email Address</label>
                <input
                  type="email"
                  required
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500">Account Role</label>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value as 'user' | 'admin')}
                  disabled={editingUser.email.toLowerCase() === 'chibuikeexcellent592@gmail.com'}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 disabled:opacity-60"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500">Status</label>
                <select
                  value={editUserStatus}
                  onChange={(e) => setEditUserStatus(e.target.value as 'active' | 'suspended')}
                  disabled={editingUser.role === 'admin'}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 disabled:opacity-60"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500">Referral Code</label>
                <input
                  type="text"
                  value={editUserReferral}
                  onChange={(e) => setEditUserReferral(e.target.value.toUpperCase())}
                  className="mt-1 w-full px-3 py-2 font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500">
                  Set New Password (optional)
                </label>
                <input
                  type="password"
                  value={editUserPass}
                  onChange={(e) => setEditUserPass(e.target.value)}
                  placeholder="Leave blank to keep"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="text-[11px] font-semibold text-slate-500">
                Profile Avatar (Upload photo, paste URL, or clear for 3D default)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={editUserAvatar}
                  onChange={(e) => setEditUserAvatar(e.target.value)}
                  placeholder="https://... or leave blank for 3D portrait"
                  className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <label className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditUserAvatarUpload}
                    className="hidden"
                  />
                </label>
                {editUserAvatar && (
                  <button
                    type="button"
                    onClick={() => setEditUserAvatar('')}
                    className="px-3 py-2 font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-xl cursor-pointer"
                  >
                    Reset 3D
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingUserEdit}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60 rounded-xl cursor-pointer"
              >
                {savingUserEdit ? 'Saving...' : 'Save User Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Receipt Image Lightbox */}
      {receiptPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setReceiptPreview(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 max-w-xl w-full space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Moniepoint Transfer Receipt Inspection
              </span>
              <button
                type="button"
                onClick={() => setReceiptPreview(null)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={resolveApiUrl(receiptPreview)}
              alt="Moniepoint receipt"
              className="w-full max-h-[70vh] object-contain rounded-lg bg-slate-100 dark:bg-slate-950"
            />
          </div>
        </div>
      )}

      {/* Overwatch Creator Command Palette (Ctrl+K / ⌘K) */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-24"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <Command className="w-4 h-4 text-blue-600 shrink-0" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Jump to any Overwatch tool, tab, action, or search a user..."
                className="flex-1 text-sm bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Close command palette"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
              {(() => {
                const q = cmdQuery.trim().toLowerCase();
                const matchedTabs = allTabs.filter(
                  (t) => !q || t.label.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
                );
                const quickActions = [
                  {
                    id: 'act_backup',
                    label: 'Export Full Overwatch JSON Backup',
                    run: () => handleExportJsonBackup(),
                  },
                  {
                    id: 'act_csv',
                    label: 'Download All Users CSV',
                    run: () => handleExportUsersCsv(),
                  },
                  {
                    id: 'act_maint',
                    label: data.settings.maintenanceMode
                      ? 'Disable Maintenance Mode'
                      : 'Enable Maintenance Mode',
                    run: () =>
                      void handleToggleQuickSetting(
                        'maintenanceMode',
                        !data.settings.maintenanceMode,
                      ),
                  },
                  {
                    id: 'act_sync',
                    label: 'Force Refresh & Sync Store State',
                    run: () => void loadAdmin(),
                  },
                  {
                    id: 'act_refresh_ops',
                    label: 'Refresh Website Queues (Safe Preserve)',
                    run: () => void handleRefreshOpsSafe(),
                  },
                  ...(onBackHome
                    ? [
                        {
                          id: 'act_store',
                          label: 'Open Public Storefront',
                          run: () => onBackHome(),
                        },
                      ]
                    : []),
                ].filter((a) => !q || a.label.toLowerCase().includes(q));
                const matchedUsers = data.users
                  .filter(
                    (u) =>
                      !q ||
                      u.name.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q) ||
                      u.referralCode.toLowerCase().includes(q),
                  )
                  .slice(0, 6);

                return (
                  <>
                    {matchedTabs.length > 0 && (
                      <div>
                        <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Overwatch Consoles
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {matchedTabs.map((t) => {
                            const Icon = t.icon;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  selectTab(t.id);
                                  setCmdOpen(false);
                                  setCmdQuery('');
                                }}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-left cursor-pointer"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <Icon className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{t.label}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {quickActions.length > 0 && (
                      <div>
                        <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Instant Creator Actions
                        </p>
                        <div className="space-y-1">
                          {quickActions.map((act) => (
                            <button
                              key={act.id}
                              type="button"
                              onClick={() => {
                                act.run();
                                setCmdOpen(false);
                                setCmdQuery('');
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-left cursor-pointer"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{act.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {matchedUsers.length > 0 && (
                      <div>
                        <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Inspect User 360°
                        </p>
                        <div className="space-y-1">
                          {matchedUsers.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setInspectUserId(u.id);
                                setCmdOpen(false);
                                setCmdQuery('');
                              }}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white truncate">
                                  {u.name}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                              </div>
                              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 shrink-0">
                                {formatNaira(u.balance, symbol)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
