import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  Eye,
  KeyRound,
  Landmark,
  LifeBuoy,
  Lock,
  Mail,
  MessageSquare,
  Monitor,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { apiFetch, formatNaira } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import type {
  AccountingRecord,
  AdminAlert,
  AdminFeatureTab,
  BoostingOrder,
  PlatformSettings,
  PublicUser,
  SmsOrder,
  SupportTicket,
  VisitorSessionLog,
  WalletTransaction,
} from '../../types';

const FEATURE_META: Record<
  AdminFeatureTab,
  { label: string; description: string }
> = {
  overview: {
    label: 'Overview Console',
    description: 'High-level platform snapshot & alerts',
  },
  power_suite: {
    label: 'Power Suite (100+ Tools)',
    description: 'Searchable control center, bulk price/stock & platform guardrails',
  },
  revenue: {
    label: 'Revenue & Profit',
    description: 'Sales, estimated COGS, net profit & margins',
  },
  live: {
    label: 'Live Monitor',
    description: 'Real-time visitors, queues, deposits & tickets',
  },
  users: {
    label: 'User Directory',
    description: 'Manage accounts, balances & status',
  },
  orders: {
    label: 'Orders & Receipts',
    description: 'Verify receipts, OTP numbers & boosting orders',
  },
  sms_numbers: {
    label: 'SMS Numbers & Pool',
    description: 'Manage virtual SMS number pool, bulk uploads & OTP delivery',
  },
  accounting: {
    label: 'Accounting Archive',
    description: 'Permanent ledger search & CSV export',
  },
  catalog: {
    label: 'Products & Catalog',
    description: 'Marketplace, SMS services, countries & boosting',
  },
  cms: {
    label: 'Landing Studio',
    description: 'Storefront visuals, showcase & dashboard banners',
  },
  copy: {
    label: 'Wallet & Sections Copy',
    description: 'Edit wallet & workspace section write-ups',
  },
  promos: {
    label: 'Promo Codes',
    description: 'Discount codes & usage caps',
  },
  notifications: {
    label: 'Broadcasts & Mail',
    description: 'Send user notifications & outbound email',
  },
  tutorials: {
    label: 'Tutorials',
    description: 'Create & manage user help guides',
  },
  support: {
    label: 'Support Desk',
    description: 'Respond to & resolve user support tickets',
  },
  audit: {
    label: 'Audit Trail',
    description: 'View admin action logs',
  },
  settings: {
    label: 'Master Controls',
    description: 'Branding, bank details, support links & switches',
  },
  team: {
    label: 'Sub-Admins',
    description: 'Main Admin exclusive delegation',
  },
};

function classifyAccountingCategory(category: string): 'sms' | 'boosting' | 'marketplace' {
  const c = (category || '').toLowerCase();
  if (c.includes('sms') || c.includes('otp')) return 'sms';
  if (c.includes('boost')) return 'boosting';
  return 'marketplace';
}

/* ============================================================================
 * 1. REVENUE & PROFIT CONSOLE
 * ============================================================================ */

interface RevenuePanelProps {
  settings: PlatformSettings;
  accountingRecords: AccountingRecord[];
  transactions: WalletTransaction[];
  users?: PublicUser[];
  onRefresh: () => Promise<void>;
}

export function AdminRevenueProfitPanel({
  settings,
  accountingRecords,
  transactions,
  users = [],
  onRefresh,
}: RevenuePanelProps) {
  const { notify, refreshCatalog } = useApp();
  const symbol = settings.currencySymbol || '₦';

  const [mktCostPct, setMktCostPct] = useState<number>(
    settings.profitCostPercentMarketplace ?? 65,
  );
  const [smsCostPct, setSmsCostPct] = useState<number>(settings.profitCostPercentSms ?? 60);
  const [boostCostPct, setBoostCostPct] = useState<number>(
    settings.profitCostPercentBoosting ?? 55,
  );
  const [savingRates, setSavingRates] = useState(false);

  const [timeframe, setTimeframe] = useState<'today' | '7d' | '30d' | 'all' | 'custom'>('30d');
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setMktCostPct(settings.profitCostPercentMarketplace ?? 65);
    setSmsCostPct(settings.profitCostPercentSms ?? 60);
    setBoostCostPct(settings.profitCostPercentBoosting ?? 55);
  }, [
    settings.profitCostPercentMarketplace,
    settings.profitCostPercentSms,
    settings.profitCostPercentBoosting,
  ]);

  const inSelectedRange = (iso: string): boolean => {
    if (timeframe === 'all') return true;
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) return false;
    const now = new Date();
    if (timeframe === 'today') {
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return ms >= startToday;
    }
    if (timeframe === '7d') {
      return ms >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    }
    if (timeframe === '30d') {
      return ms >= Date.now() - 30 * 24 * 60 * 60 * 1000;
    }
    if (timeframe === 'custom') {
      const fromMs = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : 0;
      const toMs = customTo ? new Date(`${customTo}T23:59:59.999`).getTime() : Infinity;
      return ms >= fromMs && ms <= toMs;
    }
    return true;
  };

  const validOrders = accountingRecords.filter(
    (r) =>
      r.kind === 'order' &&
      !['cancelled', 'expired', 'refunded'].includes(r.status) &&
      inSelectedRange(r.createdAt),
  );

  // Fallback to completed purchase transactions only when no accounting archive records exist yet
  const useArchive = accountingRecords.length > 0;
  const orderEntries = useArchive
    ? validOrders
    : transactions
        .filter((t) => t.type === 'purchase' && t.status === 'completed' && inSelectedRange(t.createdAt))
        .map((t) => ({
          id: t.id,
          kind: 'order' as const,
          sourceId: t.id,
          category: t.description.toLowerCase().includes('sms')
            ? 'sms'
            : t.description.toLowerCase().includes('boost')
              ? 'boosting'
              : 'marketplace',
          userId: t.userId,
          userName: t.userName,
          userEmail: t.userEmail,
          title: t.description,
          detail: t.description,
          amount: t.amount,
          status: t.status,
          createdAt: t.createdAt,
        }));

  const buckets = {
    marketplace: { label: 'Marketplace & Vault', sales: 0, count: 0, costPct: mktCostPct },
    sms: { label: 'Virtual SMS OTP', sales: 0, count: 0, costPct: smsCostPct },
    boosting: { label: 'Social Boosting', sales: 0, count: 0, costPct: boostCostPct },
  };

  for (const r of orderEntries) {
    const key = classifyAccountingCategory(r.category);
    buckets[key].sales += Number(r.amount) || 0;
    buckets[key].count += 1;
  }

  const categoryRows = (Object.keys(buckets) as Array<keyof typeof buckets>).map((k) => {
    const b = buckets[k];
    const clampedCost = Math.min(100, Math.max(0, Number(b.costPct) || 0));
    const estimatedCost = Math.round((b.sales * clampedCost) / 100);
    const estimatedProfit = b.sales - estimatedCost;
    const marginPct = b.sales > 0 ? ((estimatedProfit / b.sales) * 100).toFixed(1) : '0.0';
    return {
      key: k,
      ...b,
      costPct: clampedCost,
      estimatedCost,
      estimatedProfit,
      marginPct,
    };
  });

  const grossSales = categoryRows.reduce((s, r) => s + r.sales, 0);
  const totalEstimatedCost = categoryRows.reduce((s, r) => s + r.estimatedCost, 0);
  const totalGrossProfit = grossSales - totalEstimatedCost;
  const grossMarginPct =
    grossSales > 0 ? ((totalGrossProfit / grossSales) * 100).toFixed(1) : '0.0';

  const verifiedDeposits = useArchive
    ? accountingRecords
        .filter(
          (r) =>
            r.kind === 'transaction' &&
            r.category === 'deposit' &&
            r.status === 'verified' &&
            inSelectedRange(r.createdAt),
        )
        .reduce((s, r) => s + r.amount, 0)
    : transactions
        .filter((t) => t.type === 'deposit' && t.status === 'verified' && inSelectedRange(t.createdAt))
        .reduce((s, t) => s + t.amount, 0);

  const refundsAmount = useArchive
    ? accountingRecords
        .filter(
          (r) =>
            r.kind === 'transaction' &&
            r.category === 'refund' &&
            inSelectedRange(r.createdAt),
        )
        .reduce((s, r) => s + r.amount, 0)
    : transactions
        .filter((t) => t.type === 'refund' && inSelectedRange(t.createdAt))
        .reduce((s, t) => s + t.amount, 0);

  const bonusesIssued = useArchive
    ? accountingRecords
        .filter(
          (r) =>
            r.kind === 'transaction' &&
            ['admin_credit', 'referral_bonus', 'welcome_bonus'].includes(r.category) &&
            inSelectedRange(r.createdAt),
        )
        .reduce((s, r) => s + r.amount, 0)
    : transactions
        .filter(
          (t) =>
            ['admin_credit', 'referral_bonus', 'welcome_bonus'].includes(t.type) &&
            inSelectedRange(t.createdAt),
        )
        .reduce((s, t) => s + t.amount, 0);

  const refundsAndBonuses = refundsAmount + bonusesIssued;
  const netOperatingProfit = totalGrossProfit - bonusesIssued;
  const netOperatingMarginPct =
    grossSales > 0 ? ((netOperatingProfit / grossSales) * 100).toFixed(1) : '0.0';

  const averageOrderValue =
    orderEntries.length > 0 ? Math.round(grossSales / orderEntries.length) : 0;
  const payingCustomerCount = new Set(
    orderEntries.map((o) => o.userId || o.userEmail).filter(Boolean),
  ).size;

  const totalUserBalances = users
    .filter((u) => u.role !== 'admin')
    .reduce((s, u) => s + (Number(u.balance) || 0), 0);
  const allTimeDeposits = useArchive
    ? accountingRecords
        .filter((r) => r.kind === 'transaction' && r.category === 'deposit' && r.status === 'verified')
        .reduce((s, r) => s + r.amount, 0)
    : transactions
        .filter((t) => t.type === 'deposit' && t.status === 'verified')
        .reduce((s, t) => s + t.amount, 0);
  const netCashFlow = verifiedDeposits - refundsAndBonuses;

  // Daily breakdown (14 days for 30d/all/custom, 7 days for 7d, 1 day for today)
  const dayWindowCount = timeframe === 'today' ? 1 : timeframe === '7d' ? 7 : 10;
  const dailyRows = Array.from({ length: dayWindowCount }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (dayWindowCount - 1 - i));
    const dateKey = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const shortLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayOrders = orderEntries.filter((o) => o.createdAt.startsWith(dateKey));
    let sales = 0;
    let cost = 0;
    for (const ord of dayOrders) {
      const cat = classifyAccountingCategory(ord.category);
      const pct =
        cat === 'sms' ? smsCostPct : cat === 'boosting' ? boostCostPct : mktCostPct;
      sales += ord.amount;
      cost += (ord.amount * Math.min(100, Math.max(0, pct))) / 100;
    }
    const profit = Math.round(sales - cost);
    return {
      dateKey,
      label,
      shortLabel,
      orders: dayOrders.length,
      sales,
      cost: Math.round(cost),
      profit,
    };
  });

  const maxDailySale = Math.max(1, ...dailyRows.map((d) => d.sales));

  // Top Performing Services & Products
  const serviceMap = new Map<
    string,
    { title: string; module: 'marketplace' | 'sms' | 'boosting'; count: number; sales: number; profit: number }
  >();
  for (const ord of orderEntries) {
    const mod = classifyAccountingCategory(ord.category);
    const costPct = mod === 'sms' ? smsCostPct : mod === 'boosting' ? boostCostPct : mktCostPct;
    const key = `${mod}::${ord.title || 'Order'}`;
    const existing = serviceMap.get(key) || {
      title: ord.title || 'Order',
      module: mod,
      count: 0,
      sales: 0,
      profit: 0,
    };
    existing.count += 1;
    existing.sales += ord.amount;
    existing.profit += Math.round(ord.amount * (1 - Math.min(100, Math.max(0, costPct)) / 100));
    serviceMap.set(key, existing);
  }
  const topServices = Array.from(serviceMap.values())
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 6);

  // Top Customers
  const customerMap = new Map<
    string,
    { userId: string; userName: string; userEmail: string; orders: number; spent: number }
  >();
  for (const ord of orderEntries) {
    const key = ord.userId || ord.userEmail || 'guest';
    const cur = customerMap.get(key) || {
      userId: ord.userId,
      userName: ord.userName || 'Customer',
      userEmail: ord.userEmail || '',
      orders: 0,
      spent: 0,
    };
    cur.orders += 1;
    cur.spent += ord.amount;
    customerMap.set(key, cur);
  }
  const topCustomers = Array.from(customerMap.values())
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 6);

  const applyMarginPreset = (targetMarginPct: number) => {
    const cost = Math.max(0, Math.min(100, 100 - targetMarginPct));
    setMktCostPct(cost);
    setSmsCostPct(cost);
    setBoostCostPct(cost);
    notify(`Preset loaded (${targetMarginPct}% margin / ${cost}% cost). Click Save Cost Rates to persist.`, 'info');
  };

  const handleSaveCostRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRates(true);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          profitCostPercentMarketplace: Math.min(100, Math.max(0, Number(mktCostPct) || 0)),
          profitCostPercentSms: Math.min(100, Math.max(0, Number(smsCostPct) || 0)),
          profitCostPercentBoosting: Math.min(100, Math.max(0, Number(boostCostPct) || 0)),
        }),
      });
      notify('Cost percentages & profit estimator saved!', 'success');
      await onRefresh();
      await refreshCatalog();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save cost rates', 'error');
    } finally {
      setSavingRates(false);
    }
  };

  const handleExportCsv = () => {
    const header = 'Date,Orders,GrossSales,EstimatedCost,GrossProfit';
    const lines = dailyRows.map(
      (r) => `"${r.label}",${r.orders},${r.sales},${r.cost},${r.profit}`,
    );
    const summary = `"TOTAL (${timeframe.toUpperCase()})",${orderEntries.length},${grossSales},${totalEstimatedCost},${totalGrossProfit}`;
    const blob = new Blob([[header, ...lines, summary].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suredeal-revenue-profit-${timeframe}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Revenue & Profit CSV exported', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Executive Header + Timeframe Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Financial Intelligence &amp; Profit Desk
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gross turnover, provider COGS, net operating profit after promos, wallet liability &amp; top earners.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 gap-1">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'all', label: 'All Time' },
                { id: 'custom', label: 'Custom' },
              ] as const
            ).map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTimeframe(tf.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  timeframe === tf.id
                    ? 'bg-slate-900 text-white dark:bg-blue-600'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          {timeframe === 'custom' && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
              />
            </div>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Primary Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Gross Sales Revenue
          </p>
          <p className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatNaira(grossSales, symbol)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {orderEntries.length} orders · AOV {formatNaira(averageOrderValue, symbol)}
          </p>
        </div>

        <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Gross Product Profit
          </p>
          <p className="font-display text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
            {formatNaira(totalGrossProfit, symbol)}
          </p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-1 tabular-nums">
            {grossMarginPct}% margin after {formatNaira(totalEstimatedCost, symbol)} COGS
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Net Operating Profit
          </p>
          <p
            className={`font-display text-2xl font-extrabold mt-1 tabular-nums ${
              netOperatingProfit >= 0
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatNaira(netOperatingProfit, symbol)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {netOperatingMarginPct}% net after {formatNaira(bonusesIssued, symbol)} credits/bonuses
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Verified Deposits &amp; Customers
          </p>
          <p className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatNaira(verifiedDeposits, symbol)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {payingCustomerCount} paying buyers · Net inflow {formatNaira(netCashFlow, symbol)}
          </p>
        </div>
      </div>

      {/* Wallet Liability & Solvency Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Refunds Issued (Period)
            </p>
            <p className="font-mono text-base font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
              {formatNaira(refundsAmount, symbol)}
            </p>
          </div>
          <span className="text-[11px] text-slate-500">SMS/Boost reversals</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Outstanding Wallet Float
            </p>
            <p className="font-mono text-base font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {formatNaira(totalUserBalances, symbol)}
            </p>
          </div>
          <span className="text-[11px] text-slate-500">All user wallet balances</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Deposit Coverage Ratio
            </p>
            <p className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
              {totalUserBalances > 0
                ? `${Math.min(9999, Math.round((allTimeDeposits / totalUserBalances) * 100))}%`
                : '100%'}
            </p>
          </div>
          <span className="text-[11px] text-slate-500">All-time deposits vs float</span>
        </div>
      </div>

      {/* Comparative Visual Bar Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Daily Revenue vs Cost vs Profit Trend
            </h3>
            <p className="text-xs text-slate-500">
              Recent {dayWindowCount}-day visual breakdown across all modules
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
              Gross Sales
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              Est. Profit
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2.5 items-end pt-2">
          {dailyRows.map((d) => {
            const salesPct = Math.max(4, Math.round((d.sales / maxDailySale) * 100));
            const profitPct = Math.max(
              d.profit > 0 ? 4 : 0,
              Math.round((Math.max(0, d.profit) / maxDailySale) * 100),
            );
            return (
              <div
                key={d.dateKey}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2"
              >
                <div className="h-24 flex items-end justify-center gap-1.5">
                  <div
                    className="w-4 rounded-t-md bg-blue-600/85 transition-all"
                    style={{ height: `${d.sales > 0 ? salesPct : 3}%` }}
                    title={`Sales: ${formatNaira(d.sales, symbol)}`}
                  />
                  <div
                    className="w-4 rounded-t-md bg-emerald-500 transition-all"
                    style={{ height: `${d.profit > 0 ? profitPct : 3}%` }}
                    title={`Profit: ${formatNaira(d.profit, symbol)}`}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">
                    {d.shortLabel}
                  </p>
                  <p className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate tabular-nums">
                    {formatNaira(d.profit, symbol)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost Ratio Calibration Form with 1-Click Presets */}
      <form
        onSubmit={handleSaveCostRates}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Module Cost-of-Goods (%) Calibration
            </h3>
            <p className="text-xs text-slate-500">
              Set wholesale cost percentage (0–100%) per service or load a quick margin preset.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyMarginPreset(15)}
              className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              15% Margin
            </button>
            <button
              type="button"
              onClick={() => applyMarginPreset(35)}
              className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              35% Margin
            </button>
            <button
              type="button"
              onClick={() => applyMarginPreset(55)}
              className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              55% Margin
            </button>
            <button
              type="submit"
              disabled={savingRates}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer disabled:opacity-60"
            >
              {savingRates ? 'Saving...' : 'Save Cost Rates'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              Marketplace &amp; Vault Cost %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={mktCostPct}
              onChange={(e) => setMktCostPct(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            <p className="text-[11px] text-slate-500">
              Profit margin: {Math.max(0, 100 - mktCostPct)}%
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              Virtual SMS OTP Cost %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={smsCostPct}
              onChange={(e) => setSmsCostPct(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            <p className="text-[11px] text-slate-500">
              Profit margin: {Math.max(0, 100 - smsCostPct)}%
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              Social Boosting Cost %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={boostCostPct}
              onChange={(e) => setBoostCostPct(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            <p className="text-[11px] text-slate-500">
              Profit margin: {Math.max(0, 100 - boostCostPct)}%
            </p>
          </div>
        </div>
      </form>

      {/* Module Breakdown & Daily Ledger Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Profit Breakdown by Store Module
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-2 pr-2">Module</th>
                  <th className="py-2 px-2 text-right">Orders</th>
                  <th className="py-2 px-2 text-right">Sales</th>
                  <th className="py-2 px-2 text-right">Est. Cost</th>
                  <th className="py-2 pl-2 text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {categoryRows.map((row) => (
                  <tr key={row.key}>
                    <td className="py-3 pr-2 font-semibold text-slate-900 dark:text-white">
                      {row.label}
                      <span className="block text-[10px] font-normal text-slate-400">
                        {row.costPct}% cost · {row.marginPct}% margin
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right font-mono tabular-nums">{row.count}</td>
                    <td className="py-3 px-2 text-right font-mono font-semibold tabular-nums">
                      {formatNaira(row.sales, symbol)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-slate-500 tabular-nums">
                      {formatNaira(row.estimatedCost, symbol)}
                    </td>
                    <td className="py-3 pl-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatNaira(row.estimatedProfit, symbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Daily Sales vs Profit Ledger
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-2 pr-2">Day</th>
                  <th className="py-2 px-2 text-right">Orders</th>
                  <th className="py-2 px-2 text-right">Gross Sales</th>
                  <th className="py-2 pl-2 text-right">Est. Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dailyRows.map((d) => (
                  <tr key={d.dateKey}>
                    <td className="py-2.5 pr-2 font-medium text-slate-800 dark:text-slate-200">
                      {d.label}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums">{d.orders}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-semibold tabular-nums">
                      {formatNaira(d.sales, symbol)}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatNaira(d.profit, symbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Performing Products/Services & Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Top Performing Services &amp; Products
          </h3>
          {topServices.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No completed orders in this timeframe.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase text-slate-400">
                    <th className="py-2 pr-2">Item</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Revenue</th>
                    <th className="py-2 pl-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topServices.map((item, idx) => (
                    <tr key={`${item.title}-${idx}`}>
                      <td className="py-2.5 pr-2 font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                        {item.title}
                        <span className="block text-[10px] uppercase font-normal text-slate-400">
                          {item.module}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums">{item.count}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold tabular-nums">
                        {formatNaira(item.sales, symbol)}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatNaira(item.profit, symbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Top Spending Customers
          </h3>
          {topCustomers.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No customer spend recorded in this timeframe.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase text-slate-400">
                    <th className="py-2 pr-2">Customer</th>
                    <th className="py-2 px-2 text-right">Orders</th>
                    <th className="py-2 pl-2 text-right">Total Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topCustomers.map((c) => (
                    <tr key={c.userId || c.userEmail}>
                      <td className="py-2.5 pr-2">
                        <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                          {c.userName}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{c.userEmail}</p>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums">{c.orders}</td>
                      <td className="py-2.5 pl-2 text-right font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        {formatNaira(c.spent, symbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 2. LIVE WEBSITE MONITOR (AUTO-POLLING 5S)
 * ============================================================================ */

interface LiveFeedPayload {
  serverTime: string;
  totalVisits: number;
  activeVisitors5m: number;
  recentSessions: VisitorSessionLog[];
  waitingSms: SmsOrder[];
  activeBoosting: BoostingOrder[];
  pendingDeposits: WalletTransaction[];
  openTickets: SupportTicket[];
  recentUsers: PublicUser[];
  recentAlerts: AdminAlert[];
}

interface LiveMonitorProps {
  symbol: string;
  onNavigateTab?: (tab: AdminFeatureTab) => void;
}

type LiveStreamFilter = 'all' | 'visitors' | 'deposits' | 'sms' | 'boosting' | 'tickets' | 'users';

function playLiveChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(988, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  } catch {
    // ignore audio restrictions
  }
}

export function AdminLiveMonitorPanel({ symbol, onNavigateTab }: LiveMonitorProps) {
  const { notify } = useApp();
  const [live, setLive] = useState<LiveFeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [cadenceSec, setCadenceSec] = useState<0 | 5 | 10>(5);
  const [streamFilter, setStreamFilter] = useState<LiveStreamFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [soundAlert, setSoundAlert] = useState(false);
  const [actingTxId, setActingTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prevCountsRef = useRef<{ deposits: number; sms: number; tickets: number } | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      const res = await apiFetch<LiveFeedPayload>('/api/admin/live');
      setLive(res);
      setError(null);

      const nextCounts = {
        deposits: res.pendingDeposits.length,
        sms: res.waitingSms.length,
        tickets: res.openTickets.length,
      };
      if (
        soundAlert &&
        prevCountsRef.current &&
        (nextCounts.deposits > prevCountsRef.current.deposits ||
          nextCounts.sms > prevCountsRef.current.sms ||
          nextCounts.tickets > prevCountsRef.current.tickets)
      ) {
        playLiveChime();
      }
      prevCountsRef.current = nextCounts;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch live feed');
    } finally {
      setLoading(false);
    }
  }, [soundAlert]);

  useEffect(() => {
    void fetchLive();
  }, [fetchLive]);

  useEffect(() => {
    if (!cadenceSec) return;
    const timer = window.setInterval(() => {
      void fetchLive();
    }, cadenceSec * 1000);
    return () => window.clearInterval(timer);
  }, [cadenceSec, fetchLive]);

  const handleInlineDepositDecision = async (txId: string, decision: 'approve' | 'reject') => {
    setActingTxId(txId);
    try {
      await apiFetch(`/api/admin/transactions/${txId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      notify(
        decision === 'approve' ? 'Deposit approved & wallet credited!' : 'Deposit rejected.',
        decision === 'approve' ? 'success' : 'info',
      );
      await fetchLive();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setActingTxId(null);
    }
  };

  const visitorAnalytics = useMemo(() => {
    const sessions = live?.recentSessions || [];
    let mobileCount = 0;
    let desktopCount = 0;
    const pathCounts = new Map<string, number>();

    for (const s of sessions) {
      const dev = (s.device || '').toLowerCase();
      if (dev.includes('mobile') || dev.includes('phone') || dev.includes('android') || dev.includes('ios')) {
        mobileCount += 1;
      } else {
        desktopCount += 1;
      }
      const p = s.path || '/';
      pathCounts.set(p, (pathCounts.get(p) || 0) + 1);
    }

    const total = Math.max(1, mobileCount + desktopCount);
    const mobilePct = Math.round((mobileCount / total) * 100);
    const topPaths = Array.from(pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return { mobileCount, desktopCount, mobilePct, topPaths };
  }, [live?.recentSessions]);

  const unifiedFirehose = useMemo(() => {
    if (!live) return [];
    const items: Array<{
      id: string;
      kind: Exclude<LiveStreamFilter, 'all'>;
      title: string;
      subtitle: string;
      amount?: number;
      time: string;
      badge: string;
      badgeClass: string;
      txId?: string;
      targetTab?: AdminFeatureTab;
    }> = [];

    for (const d of live.pendingDeposits) {
      items.push({
        id: `dep-${d.id}`,
        kind: 'deposits',
        title: `Pending Deposit · ${d.userName}`,
        subtitle: `${d.userEmail}${d.aiAudit?.extractedReference ? ` · Ref: ${d.aiAudit.extractedReference}` : ''}`,
        amount: d.amount,
        time: d.createdAt,
        badge: 'DEPOSIT',
        badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300',
        txId: d.id,
        targetTab: 'orders',
      });
    }

    for (const s of live.waitingSms) {
      items.push({
        id: `sms-${s.id}`,
        kind: 'sms',
        title: `SMS Waiting · ${s.serviceName} (${s.countryName})`,
        subtitle: `${s.phoneNumber} · ${s.userEmail}`,
        amount: s.price,
        time: s.createdAt,
        badge: 'SMS OTP',
        badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300',
        targetTab: 'sms_numbers',
      });
    }

    for (const b of live.activeBoosting) {
      items.push({
        id: `boost-${b.id}`,
        kind: 'boosting',
        title: `Boosting (${b.status}) · ${b.serviceName}`,
        subtitle: `${b.quantity.toLocaleString()} qty · ${b.userEmail}`,
        amount: b.amount,
        time: b.createdAt,
        badge: 'BOOST',
        badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300',
        targetTab: 'orders',
      });
    }

    for (const tk of live.openTickets) {
      items.push({
        id: `tkt-${tk.id}`,
        kind: 'tickets',
        title: `Support Ticket (${tk.priority}) · ${tk.subject}`,
        subtitle: `${tk.userName} (${tk.userEmail})`,
        time: tk.updatedAt || tk.createdAt,
        badge: 'TICKET',
        badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300',
        targetTab: 'support',
      });
    }

    for (const u of live.recentUsers) {
      items.push({
        id: `usr-${u.id}`,
        kind: 'users',
        title: `Active Member · ${u.name}`,
        subtitle: `${u.email} · Last seen`,
        amount: u.balance,
        time: u.lastLoginAt || u.createdAt,
        badge: 'ACCOUNT',
        badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300',
        targetTab: 'users',
      });
    }

    for (let idx = 0; idx < live.recentSessions.length; idx++) {
      const v = live.recentSessions[idx];
      items.push({
        id: `vis-${v.visitorId}-${idx}`,
        kind: 'visitors',
        title: `Visitor on ${v.path || '/'}`,
        subtitle: `${v.device || 'Browser'} · ${v.visitorId}`,
        time: v.visitedAt,
        badge: 'VISIT',
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
      });
    }

    const q = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => (streamFilter === 'all' ? true : item.kind === streamFilter))
      .filter((item) =>
        !q
          ? true
          : item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q) ||
            item.badge.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [live, streamFilter, searchQuery]);

  const filterTabs: { id: LiveStreamFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All Events', count: unifiedFirehose.length },
    { id: 'deposits', label: 'Deposits', count: live?.pendingDeposits.length ?? 0 },
    { id: 'sms', label: 'SMS Queue', count: live?.waitingSms.length ?? 0 },
    { id: 'boosting', label: 'Boosting', count: live?.activeBoosting.length ?? 0 },
    { id: 'tickets', label: 'Tickets', count: live?.openTickets.length ?? 0 },
    { id: 'visitors', label: 'Visitors', count: live?.recentSessions.length ?? 0 },
    { id: 'users', label: 'Accounts', count: live?.recentUsers.length ?? 0 },
  ];

  return (
    <div className="space-y-5">
      {/* Pro Header & Telemetry Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Live Website Monitor Pro
            {cadenceSec > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                STREAM {cadenceSec}s
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time chronological activity firehose, inline receipt approval, SMS queue watch &amp; visitor device analytics.
            {live?.serverTime ? ` · Updated ${new Date(live.serverTime).toLocaleTimeString()}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 gap-1">
            {([5, 10, 0] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setCadenceSec(sec)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  cadenceSec === sec
                    ? sec === 0
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-900 dark:bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800'
                }`}
              >
                {sec === 0 ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {sec === 0 ? 'Paused' : `${sec}s`}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !soundAlert;
              setSoundAlert(next);
              if (next) playLiveChime();
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border cursor-pointer ${
              soundAlert
                ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
            title="Play a soft chime when new deposits, SMS orders, or tickets arrive"
          >
            {soundAlert ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            Chime {soundAlert ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => void fetchLive()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Live Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-slate-400">Active Visitors (5m)</p>
          <p className="font-display text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {live?.activeVisitors5m ?? 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-slate-400">Total Visits</p>
          <p className="font-display text-2xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
            {live?.totalVisits ?? 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-slate-400">Waiting SMS OTP</p>
          <p className="font-display text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
            {live?.waitingSms.length ?? 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-slate-400">Active Boosts</p>
          <p className="font-display text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
            {live?.activeBoosting.length ?? 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-slate-400">Pending Receipts</p>
          <p className="font-display text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            {live?.pendingDeposits.length ?? 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-slate-400">Open Tickets</p>
          <p className="font-display text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
            {live?.openTickets.length ?? 0}
          </p>
        </div>
      </div>

      {/* Visitor Device Split & Top Routes Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              Mobile {visitorAnalytics.mobilePct}% ({visitorAnalytics.mobileCount})
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              Desktop {100 - visitorAnalytics.mobilePct}% ({visitorAnalytics.desktopCount})
              <Monitor className="w-3.5 h-3.5 text-indigo-500" />
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-indigo-100 dark:bg-indigo-950/60 overflow-hidden flex">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${visitorAnalytics.mobilePct}%` }}
            />
          </div>
        </div>
        <div className="lg:col-span-7 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            Top Routes:
          </span>
          {visitorAnalytics.topPaths.length === 0 ? (
            <span className="text-slate-500">Waiting for traffic...</span>
          ) : (
            visitorAnalytics.topPaths.map(([p, count]) => (
              <span
                key={p}
                className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 tabular-nums"
              >
                {p} · {count}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Unified Chronological Live Activity Firehose */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            {filterTabs.map((ft) => (
              <button
                key={ft.id}
                type="button"
                onClick={() => setStreamFilter(ft.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  streamFilter === ft.id
                    ? 'bg-slate-900 dark:bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800'
                }`}
              >
                {ft.label} <span className="opacity-75 font-mono">({ft.count})</span>
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64 flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus-within:ring-2 focus-within:ring-blue-600">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search live events, email, phone..."
              className="flex-1 min-w-0 bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer shrink-0"
                aria-label="Clear live events search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {unifiedFirehose.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">
            No live events match the current filter.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] overflow-y-auto">
            {unifiedFirehose.slice(0, 45).map((ev) => (
              <div
                key={ev.id}
                className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${ev.badgeClass}`}>
                      {ev.badge}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {ev.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {ev.subtitle} · {new Date(ev.time).toLocaleTimeString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {typeof ev.amount === 'number' && (
                    <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums mr-1">
                      {formatNaira(ev.amount, symbol)}
                    </span>
                  )}
                  {ev.txId && (
                    <>
                      <button
                        type="button"
                        disabled={actingTxId === ev.txId}
                        onClick={() => void handleInlineDepositDecision(ev.txId!, 'approve')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-60"
                      >
                        <Check className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actingTxId === ev.txId}
                        onClick={() => void handleInlineDepositDecision(ev.txId!, 'reject')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-bold cursor-pointer disabled:opacity-60"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </button>
                    </>
                  )}
                  {ev.targetTab && onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab(ev.targetTab!)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Open →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Specialized Split Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Waiting SMS & Active Boosts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              Active SMS &amp; Boosting Queues
            </h3>
            {onNavigateTab && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateTab('sms_numbers')}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  SMS Numbers →
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('orders')}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Orders →
                </button>
              </div>
            )}
          </div>
          {!live || (live.waitingSms.length === 0 && live.activeBoosting.length === 0) ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              All SMS &amp; boosting queues are currently clear.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto text-xs">
              {live.waitingSms.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold mr-1.5">
                      SMS WAITING
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {s.serviceName} ({s.countryName})
                    </span>
                    <p className="text-[11px] text-slate-500 truncate">
                      {s.phoneNumber} · {s.userEmail}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 shrink-0 tabular-nums">
                    {formatNaira(s.price, symbol)}
                  </span>
                </div>
              ))}
              {live.activeBoosting.map((b) => (
                <div key={b.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-bold mr-1.5 uppercase">
                      {b.status}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {b.serviceName} ({b.quantity.toLocaleString()})
                    </span>
                    <p className="text-[11px] text-slate-500 truncate">{b.userEmail}</p>
                  </div>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 shrink-0 tabular-nums">
                    {formatNaira(b.amount, symbol)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Deposits & Open Tickets */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Landmark className="w-4 h-4 text-amber-500" />
              Urgent Receipts &amp; Open Tickets
            </h3>
            {onNavigateTab && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateTab('orders')}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Receipts
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('support')}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Tickets
                </button>
              </div>
            )}
          </div>
          {!live || (live.pendingDeposits.length === 0 && live.openTickets.length === 0) ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No pending receipts or open support tickets.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto text-xs">
              {live.pendingDeposits.map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold mr-1.5">
                      RECEIPT
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{tx.userName}</span>
                    <p className="text-[11px] text-slate-500 truncate">{tx.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums mr-1">
                      {formatNaira(tx.amount, symbol)}
                    </span>
                    <button
                      type="button"
                      disabled={actingTxId === tx.id}
                      onClick={() => void handleInlineDepositDecision(tx.id, 'approve')}
                      className="px-2 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
              {live.openTickets.map((tk) => (
                <div key={tk.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold mr-1.5 uppercase">
                      <LifeBuoy className="w-2.5 h-2.5 inline mr-0.5" />
                      {tk.priority}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{tk.subject}</span>
                    <p className="text-[11px] text-slate-500 truncate">{tk.userEmail}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                    {new Date(tk.updatedAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 3. MAIN ADMIN PROTECTION, EMAIL CHANGE & SINGLE-FEATURE SUB-ADMINS
 * ============================================================================ */

interface SubAdminsPanelProps {
  currentUser: PublicUser | null;
  mainAdminEmail: string;
  allUsers: PublicUser[];
  onRefresh: () => Promise<void>;
}

export function AdminSubAdminsPanel({
  currentUser,
  mainAdminEmail,
  allUsers,
  onRefresh,
}: SubAdminsPanelProps) {
  const { notify, refreshUser } = useApp();
  const [subAdmins, setSubAdmins] = useState<PublicUser[]>([]);
  const [delegatableTabs, setDelegatableTabs] = useState<AdminFeatureTab[]>([]);
  const [loading, setLoading] = useState(true);

  // Main admin email change form
  const [newMainEmail, setNewMainEmail] = useState(currentUser?.email || mainAdminEmail || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  // Sub-admin delegation form
  const [assignMode, setAssignMode] = useState<'existing' | 'new'>('new');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [subName, setSubName] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [subPassword, setSubPassword] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<AdminFeatureTab>('support');
  const [assigning, setAssigning] = useState(false);

  const loadSubAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        mainAdmin: PublicUser | null;
        subAdmins: PublicUser[];
        delegatableTabs: AdminFeatureTab[];
      }>('/api/admin/sub-admins');
      setSubAdmins(res.subAdmins || []);
      setDelegatableTabs(res.delegatableTabs || []);
      if (res.delegatableTabs?.length && !res.delegatableTabs.includes(selectedFeature)) {
        setSelectedFeature(res.delegatableTabs[0]);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load sub-admin roster', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, selectedFeature]);

  useEffect(() => {
    void loadSubAdmins();
  }, [loadSubAdmins]);

  useEffect(() => {
    if (currentUser?.email) {
      setNewMainEmail(currentUser.email);
    }
  }, [currentUser?.email]);

  const eligibleExistingUsers = allUsers.filter(
    (u) =>
      !u.isMainAdmin &&
      u.id !== 'usr_head_admin' &&
      u.email.toLowerCase() !== mainAdminEmail.toLowerCase(),
  );

  const handleChangeMainEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMainEmail.trim() || !currentPassword) {
      notify('Enter the new email address and your current password', 'error');
      return;
    }
    setChangingEmail(true);
    try {
      await apiFetch('/api/admin/main-admin/change-email', {
        method: 'POST',
        body: JSON.stringify({
          newEmail: newMainEmail.trim(),
          currentPassword,
        }),
      });
      setCurrentPassword('');
      notify(`Main Admin email updated to ${newMainEmail.trim()}!`, 'success');
      await refreshUser();
      await onRefresh();
      await loadSubAdmins();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update Main Admin email', 'error');
    } finally {
      setChangingEmail(false);
    }
  };

  const handleAssignSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigning(true);
    try {
      const payload =
        assignMode === 'existing'
          ? { userId: selectedUserId, allowedAdminTab: selectedFeature }
          : {
              name: subName.trim(),
              email: subEmail.trim(),
              password: subPassword,
              allowedAdminTab: selectedFeature,
            };
      await apiFetch('/api/admin/sub-admins', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSubName('');
      setSubEmail('');
      setSubPassword('');
      setSelectedUserId('');
      notify(
        `Sub-Admin assigned exclusively to "${FEATURE_META[selectedFeature]?.label || selectedFeature}"!`,
        'success',
      );
      await loadSubAdmins();
      await onRefresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to assign sub-admin', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleReassignFeature = async (subAdminId: string, nextTab: AdminFeatureTab) => {
    try {
      await apiFetch('/api/admin/sub-admins', {
        method: 'POST',
        body: JSON.stringify({ userId: subAdminId, allowedAdminTab: nextTab }),
      });
      notify(
        `Sub-Admin feature updated to "${FEATURE_META[nextTab]?.label || nextTab}"`,
        'success',
      );
      await loadSubAdmins();
      await onRefresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update sub-admin feature', 'error');
    }
  };

  const handleRevokeSubAdmin = async (subAdmin: PublicUser) => {
    try {
      await apiFetch(`/api/admin/sub-admins/${subAdmin.id}`, { method: 'DELETE' });
      notify(`${subAdmin.email} reverted to standard user`, 'info');
      await loadSubAdmins();
      await onRefresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to revoke sub-admin', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Main Admin Identity Shield & Email Update */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              <Crown className="w-4 h-4" />
              Protected Main Admin Shield
            </div>
            <h2 className="font-display text-lg font-extrabold">
              Permanent Owner Authority · {currentUser?.email || mainAdminEmail}
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              This Main Admin account cannot be deleted, suspended, demoted, or edited by any other admin. Only you can change your Main Admin login email below.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Untouchable Owner
          </span>
        </div>

        <form
          onSubmit={handleChangeMainEmail}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10"
        >
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Main Admin Email Address
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={newMainEmail}
                onChange={(e) => setNewMainEmail(e.target.value)}
                placeholder="new-owner@example.com"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Verify Current Password
            </label>
            <div className="relative">
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={changingEmail}
              className="w-full py-2 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl cursor-pointer disabled:opacity-60"
            >
              {changingEmail ? 'Updating...' : 'Update Main Admin Email'}
            </button>
          </div>
        </form>
      </div>

      {/* Delegate Single-Feature Sub-Admin */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleAssignSubAdmin}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-600" />
              Assign Single-Feature Sub-Admin
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              A sub-admin is locked strictly to the ONE feature you choose below — both in UI and server APIs.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setAssignMode('new')}
              className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                assignMode === 'new'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              Create New Account
            </button>
            <button
              type="button"
              onClick={() => setAssignMode('existing')}
              className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                assignMode === 'existing'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              Promote Existing User
            </button>
          </div>

          {assignMode === 'existing' ? (
            <div>
              <label className="block text-xs font-semibold mb-1">Select User Account</label>
              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="">-- Choose user --</option>
                {eligibleExistingUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}){u.role === 'admin' ? ' [Sub-Admin]' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Sub-Admin Name</label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Support Agent John"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Login Email</label>
                <input
                  type="email"
                  required
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="agent@suredeal.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Password (6+ chars)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={subPassword}
                  onChange={(e) => setSubPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1">
              Exclusive Admin Feature Allowed (Only 1)
            </label>
            <select
              value={selectedFeature}
              onChange={(e) => setSelectedFeature(e.target.value as AdminFeatureTab)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            >
              {(delegatableTabs.length
                ? delegatableTabs
                : (['orders', 'support', 'catalog', 'users', 'revenue', 'live'] as AdminFeatureTab[])
              ).map((tabId) => (
                <option key={tabId} value={tabId}>
                  {FEATURE_META[tabId]?.label || tabId}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              {FEATURE_META[selectedFeature]?.description || 'Single delegated admin permission'}
            </p>
          </div>

          <button
            type="submit"
            disabled={assigning}
            className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer disabled:opacity-60"
          >
            {assigning ? 'Assigning...' : 'Save Sub-Admin Permission'}
          </button>
        </form>

        {/* Active Sub-Admins List */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Active Sub-Admins ({subAdmins.length})
              </h3>
              <p className="text-xs text-slate-500">
                Each sub-admin can only open and operate their single assigned feature.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadSubAdmins()}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title="Refresh sub-admins"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {subAdmins.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1.5">
              <Sparkles className="w-5 h-5 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No single-feature sub-admins assigned yet
              </p>
              <p className="text-[11px] text-slate-500">
                Use the form on the left to delegate one specific module (e.g. Orders &amp; Receipts or Support Desk) to a helper admin.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {subAdmins.map((sa) => (
                <div key={sa.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {sa.name}
                      </p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                        <Lock className="w-2.5 h-2.5" />
                        {sa.allowedAdminTab
                          ? FEATURE_META[sa.allowedAdminTab]?.label || sa.allowedAdminTab
                          : 'Legacy Full'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{sa.email}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={sa.allowedAdminTab || ''}
                      onChange={(e) =>
                        handleReassignFeature(sa.id, e.target.value as AdminFeatureTab)
                      }
                      aria-label={`Assigned feature for ${sa.email}`}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    >
                      {delegatableTabs.map((tabId) => (
                        <option key={tabId} value={tabId}>
                          {FEATURE_META[tabId]?.label || tabId}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleRevokeSubAdmin(sa)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Sub-admins never see other Overwatch tabs, cannot modify the Main Admin, and cannot access Sub-Admin delegation or Master Controls unless explicitly delegated.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { CheckCircle2 };
