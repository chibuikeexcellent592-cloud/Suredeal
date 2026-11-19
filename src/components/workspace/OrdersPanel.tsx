import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, copyText, formatCountdown, formatNaira, parseAccountCredential } from '../../lib/api';
import type { BoostingOrder, SmsOrder, VaultItem } from '../../types';

interface OrdersPanelProps {
  onNavigate?: (tab: string) => void;
}

type OrderFilter = 'all' | 'vault' | 'sms' | 'boosting';

export function OrdersPanel({ onNavigate }: OrdersPanelProps) {
  const { catalog, notify, updateLocalBalance } = useApp();
  const symbol = catalog?.settings?.currencySymbol || '₦';

  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [smsOrders, setSmsOrders] = useState<SmsOrder[]>([]);
  const [boostingOrders, setBoostingOrders] = useState<BoostingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastExpirySyncRef = useRef(0);

  const loadOrders = useCallback(async () => {
    try {
      const res = await apiFetch<{
        vaultItems: VaultItem[];
        smsOrders: SmsOrder[];
        boostingOrders: BoostingOrder[];
        balance?: number;
      }>('/api/orders/all');
      setVaultItems(res.vaultItems);
      setSmsOrders(res.smsOrders);
      setBoostingOrders(res.boostingOrders);
      if (typeof res.balance === 'number') {
        updateLocalBalance(res.balance);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, updateLocalBalance]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const hasWaitingSms = smsOrders.some((o) => o.status === 'waiting');

  useEffect(() => {
    if (!hasWaitingSms) return;
    setNowMs(Date.now());
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [hasWaitingSms]);

  useEffect(() => {
    if (!hasWaitingSms) return;
    const hasExpired = smsOrders.some((o) => {
      if (o.status !== 'waiting') return false;
      const exp = new Date(o.expiresAt).getTime();
      return Number.isFinite(exp) && nowMs >= exp;
    });
    if (hasExpired && nowMs - lastExpirySyncRef.current > 2500) {
      lastExpirySyncRef.current = nowMs;
      void loadOrders();
    }
  }, [hasWaitingSms, nowMs, smsOrders, loadOrders]);

  const query = search.trim().toLowerCase();

  const filteredVault = useMemo(
    () =>
      vaultItems.filter(
        (v) =>
          !query ||
          v.title.toLowerCase().includes(query) ||
          v.category.toLowerCase().includes(query) ||
          v.deliveredCredential.toLowerCase().includes(query),
      ),
    [vaultItems, query],
  );

  const filteredSms = useMemo(
    () =>
      smsOrders.filter(
        (s) =>
          !query ||
          s.serviceName.toLowerCase().includes(query) ||
          s.countryName.toLowerCase().includes(query) ||
          s.phoneNumber.toLowerCase().includes(query),
      ),
    [smsOrders, query],
  );

  const filteredBoosting = useMemo(
    () =>
      boostingOrders.filter(
        (b) =>
          !query ||
          b.serviceName.toLowerCase().includes(query) ||
          b.platform.toLowerCase().includes(query) ||
          b.targetUrl.toLowerCase().includes(query),
      ),
    [boostingOrders, query],
  );

  const totalOrdersCount = vaultItems.length + smsOrders.length + boostingOrders.length;

  const handleCheckOtp = async (orderId: string) => {
    setBusyId(orderId);
    try {
      const res = await apiFetch<{ order: SmsOrder; balance?: number }>(
        `/api/sms/orders/${orderId}/check-otp`,
        {
          method: 'POST',
        },
      );
      setSmsOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      if (typeof res.balance === 'number') {
        updateLocalBalance(res.balance);
      }
      notify(
        res.order.otpCode
          ? `OTP received: ${res.order.otpCode}`
          : res.order.status === 'expired'
            ? '15-minute timer expired and wallet refunded'
            : 'SMS inbox refreshed',
        res.order.otpCode ? 'success' : 'info',
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to check OTP', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelSms = async (orderId: string) => {
    setBusyId(orderId);
    try {
      const res = await apiFetch<{ order: SmsOrder; balance: number }>(
        `/api/sms/orders/${orderId}/cancel`,
        { method: 'POST' },
      );
      setSmsOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      updateLocalBalance(res.balance);
      notify('Number cancelled and wallet refunded', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Cancellation failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestRefill = async (orderId: string) => {
    setBusyId(orderId);
    try {
      const res = await apiFetch<{ order: BoostingOrder }>(`/api/boosting/orders/${orderId}/refill`, {
        method: 'POST',
      });
      setBoostingOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      notify('Refill request submitted to our Team', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Refill failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <PackageCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            My Orders &amp; Delivery History
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            All marketplace credentials, virtual SMS rentals, and social boosting campaigns in one
            place.
          </p>
        </div>

        <button
          type="button"
          onClick={loadOrders}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Orders
        </button>
      </div>

      {/* Filter Tabs + Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: `All Orders (${totalOrdersCount})` },
              { id: 'vault', label: `Marketplace & Vault (${vaultItems.length})` },
              { id: 'sms', label: `SMS Numbers (${smsOrders.length})` },
              { id: 'boosting', label: `Social Boosting (${boostingOrders.length})` },
            ] as { id: OrderFilter; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === t.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, key, number, or link..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-sm text-slate-500">
          Loading your purchase history...
        </div>
      ) : totalOrdersCount === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              No purchases yet
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Once you buy proxies, VPNs, creator accounts, SMS numbers, or social boosting, every
              delivery appears here.
            </p>
          </div>
          {onNavigate && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('marketplace')}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                Browse Marketplace
              </button>
              <button
                type="button"
                onClick={() => onNavigate('sms')}
                className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer"
              >
                Rent SMS Number
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Marketplace & Vault Purchases */}
          {(filter === 'all' || filter === 'vault') && filteredVault.length > 0 && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Marketplace &amp; Vault Deliveries ({filteredVault.length})
                  </h2>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredVault.map((item) => {
                  const parsedCred = parseAccountCredential(item.deliveredCredential);
                  return (
                    <div key={item.id} className="p-5 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Delivered
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {item.category} · {item.deliveryType}
                            </span>
                          </div>
                          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mt-1">
                            {item.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Order ID: <span className="font-mono">{item.id}</span> ·{' '}
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                            {formatNaira(item.price, symbol)}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await copyText(item.deliveredCredential);
                              notify('Credential copied to clipboard', 'success');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {parsedCred ? 'Copy All' : 'Copy Key'}
                          </button>
                        </div>
                      </div>

                      {parsedCred ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {[
                            { label: 'Login', value: parsedCred.login },
                            { label: 'Password', value: parsedCred.password },
                            { label: '2FA', value: parsedCred.twoFactor },
                          ].map((field) => (
                            <div
                              key={field.label}
                              className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                            >
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase text-slate-400">
                                  {field.label}
                                </p>
                                <p className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate">
                                  {field.value}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  await copyText(field.value);
                                  notify(`${field.label} copied`, 'success');
                                }}
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 shrink-0 cursor-pointer"
                                aria-label={`Copy ${field.label}`}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 break-all">
                          {item.deliveredCredential}
                        </div>
                      )}

                      {item.buyWarningShown && (
                        <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <span>{item.buyWarningShown}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* SMS Verification Numbers */}
          {(filter === 'all' || filter === 'sms') && filteredSms.length > 0 && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  SMS Verification Orders ({filteredSms.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSms.map((ord) => (
                  <div key={ord.id} className="p-5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {ord.serviceName} ({ord.countryName}) ·{' '}
                          {!ord.phoneNumber || ord.phoneNumber === 'Awaiting number' ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 text-xs font-bold">
                              Awaiting number
                            </span>
                          ) : (
                            <span className="font-mono text-blue-600 dark:text-blue-400">
                              {ord.phoneNumber}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Status: <strong className="uppercase">{ord.status}</strong> ·{' '}
                          {new Date(ord.createdAt).toLocaleString()} ·{' '}
                          <span className="font-mono">{formatNaira(ord.price, symbol)}</span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {ord.status === 'waiting' && (() => {
                          const timer = formatCountdown(ord.expiresAt, nowMs);
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-bold border tabular-nums ${
                                timer.isUrgent
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900'
                                  : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              {timer.remainingMs > 0 ? timer.label : '00:00'}
                            </span>
                          );
                        })()}
                        {ord.otpCode && (
                          <button
                            type="button"
                            onClick={async () => {
                              await copyText(ord.otpCode || '');
                              notify('OTP copied', 'success');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            OTP: {ord.otpCode}
                          </button>
                        )}
                        {ord.status === 'waiting' && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === ord.id}
                              onClick={() => handleCheckOtp(ord.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                            >
                              Check SMS
                            </button>
                            <button
                              type="button"
                              disabled={busyId === ord.id}
                              onClick={() => handleCancelSms(ord.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-lg cursor-pointer"
                            >
                              Cancel &amp; Refund
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {ord.smsText && (
                      <p className="text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                        {ord.smsText}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Social Boosting Campaigns */}
          {(filter === 'all' || filter === 'boosting') && filteredBoosting.length > 0 && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Social Boosting Campaigns ({filteredBoosting.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBoosting.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-5 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          {ord.platform}
                        </span>
                        <span className="text-[11px] font-semibold uppercase text-slate-500">
                          {ord.status}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {ord.serviceName} · {ord.quantity.toLocaleString()} qty
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xl">
                        Target: {ord.targetUrl} · Remains: {ord.remains.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatNaira(ord.amount, symbol)}
                      </span>
                      {ord.status === 'completed' && (
                        <button
                          type="button"
                          disabled={busyId === ord.id}
                          onClick={() => handleRequestRefill(ord.id)}
                          className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Request Refill
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {((filter === 'all' &&
            filteredVault.length === 0 &&
            filteredSms.length === 0 &&
            filteredBoosting.length === 0) ||
            (filter === 'vault' && filteredVault.length === 0) ||
            (filter === 'sms' && filteredSms.length === 0) ||
            (filter === 'boosting' && filteredBoosting.length === 0)) && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No orders matched your current filter or search.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFilter('all');
                  setSearch('');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
