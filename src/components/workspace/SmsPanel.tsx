import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Copy, RefreshCw, RotateCcw, Search, Smartphone, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, copyText, formatCountdown, formatNaira } from '../../lib/api';
import type { SmsCountry, SmsOrder, SmsService } from '../../types';

export function SmsPanel() {
  const { catalog, updateLocalBalance, notify } = useApp();
  const symbol = catalog?.settings?.currencySymbol || '₦';

  const [services, setServices] = useState<SmsService[]>([]);
  const [countries, setCountries] = useState<SmsCountry[]>([]);
  const [orders, setOrders] = useState<SmsOrder[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [renting, setRenting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastExpirySyncRef = useRef(0);

  const loadAll = useCallback(async () => {
    try {
      const [catRes, ordRes] = await Promise.all([
        apiFetch<{ countries: SmsCountry[]; services: SmsService[] }>('/api/sms/catalog'),
        apiFetch<{ orders: SmsOrder[]; balance?: number }>('/api/sms/orders'),
      ]);
      setCountries(catRes.countries);
      setServices(catRes.services);
      setOrders(ordRes.orders);
      if (typeof ordRes.balance === 'number') {
        updateLocalBalance(ordRes.balance);
      }
      setSelectedServiceId((prev) => prev || catRes.services[0]?.id || '');
      setSelectedCountryId((prev) => prev || catRes.countries[0]?.id || '');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load SMS catalog', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, updateLocalBalance]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const hasWaitingOrder = orders.some((o) => o.status === 'waiting');

  useEffect(() => {
    if (!hasWaitingOrder) return;
    setNowMs(Date.now());
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    const poll = window.setInterval(() => {
      apiFetch<{ orders: SmsOrder[]; balance?: number }>('/api/sms/orders')
        .then((res) => {
          setOrders(res.orders);
          if (typeof res.balance === 'number') {
            updateLocalBalance(res.balance);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [hasWaitingOrder, updateLocalBalance]);

  useEffect(() => {
    if (!hasWaitingOrder) return;
    const hasExpiredWaiting = orders.some((o) => {
      if (o.status !== 'waiting') return false;
      const exp = new Date(o.expiresAt).getTime();
      return Number.isFinite(exp) && nowMs >= exp;
    });
    if (hasExpiredWaiting && nowMs - lastExpirySyncRef.current > 2500) {
      lastExpirySyncRef.current = nowMs;
      apiFetch<{ orders: SmsOrder[]; balance?: number }>('/api/sms/orders')
        .then((res) => {
          setOrders(res.orders);
          if (typeof res.balance === 'number') {
            updateLocalBalance(res.balance);
          }
        })
        .catch(() => {});
    }
  }, [hasWaitingOrder, nowMs, orders, updateLocalBalance]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
    );
  }, [services, serviceSearch]);

  const activeService = services.find((s) => s.id === selectedServiceId);
  const activeCountry = countries.find((c) => c.id === selectedCountryId);
  const computedPrice =
    activeService && activeCountry
      ? Math.round(activeService.basePrice * activeCountry.multiplier)
      : 0;

  const handleRent = async () => {
    if (!selectedServiceId || !selectedCountryId) return;
    setRenting(true);
    try {
      const res = await apiFetch<{ order: SmsOrder; balance: number }>('/api/sms/rent', {
        method: 'POST',
        body: JSON.stringify({ serviceId: selectedServiceId, countryId: selectedCountryId }),
      });
      setOrders((prev) => [res.order, ...prev]);
      updateLocalBalance(res.balance);
      const isAwaitingNumber = !res.order.phoneNumber || res.order.phoneNumber === 'Awaiting number';
      notify(
        res.order.status === 'received' && res.order.otpCode
          ? `Rented ${res.order.phoneNumber} — OTP delivered to your inbox!`
          : isAwaitingNumber
            ? 'Order placed — awaiting number & OTP delivery.'
            : `Rented ${res.order.phoneNumber} — waiting for OTP delivery.`,
        'success',
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to rent number', 'error');
    } finally {
      setRenting(false);
    }
  };

  const handleCheckOtp = async (orderId: string) => {
    try {
      const res = await apiFetch<{ order: SmsOrder; balance?: number }>(
        `/api/sms/orders/${orderId}/check-otp`,
        {
          method: 'POST',
        },
      );
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      if (typeof res.balance === 'number') {
        updateLocalBalance(res.balance);
      }
      if (res.order.status === 'received' && res.order.otpCode) {
        notify(`OTP received: ${res.order.otpCode}`, 'success');
      } else if (res.order.status === 'expired') {
        notify('15-minute timer expired — full amount automatically refunded.', 'info');
      } else {
        notify('Still waiting for OTP code — check again shortly.', 'info');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to check OTP', 'error');
    }
  };

  const handleRequestAnother = async (orderId: string) => {
    try {
      const res = await apiFetch<{ order: SmsOrder }>(
        `/api/sms/orders/${orderId}/request-another`,
        { method: 'POST' },
      );
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      notify('Request sent! Waiting for the new OTP code.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to request new code', 'error');
    }
  };

  const handleCancelRefund = async (orderId: string) => {
    try {
      const res = await apiFetch<{ order: SmsOrder; balance: number }>(
        `/api/sms/orders/${orderId}/cancel`,
        { method: 'POST' },
      );
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      updateLocalBalance(res.balance);
      notify('Number cancelled and full amount refunded to your wallet.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Cancel failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Virtual SMS Verification
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Rent dedicated 15-minute numbers for OTP verification with automatic instant refund if
          cancelled before delivery.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Order Configurator: Country First, then Service */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div>
            <label
              htmlFor="sms-country-select"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2"
            >
              1. Select Carrier Country
            </label>
            <select
              id="sms-country-select"
              value={selectedCountryId}
              onChange={(e) => setSelectedCountryId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.dialCode}) — {c.multiplier}x rate
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              2. Search &amp; Choose Service
              {activeCountry ? ` (${activeCountry.name})` : ''}
            </label>
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Search WhatsApp, Telegram, Google, OpenAI..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {loading ? (
                <p className="text-xs text-slate-500 col-span-2 py-4 text-center">
                  Loading services...
                </p>
              ) : (
                filteredServices.map((svc) => {
                  const unitPrice = Math.round(
                    svc.basePrice * (activeCountry?.multiplier || 1),
                  );
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => setSelectedServiceId(svc.id)}
                      className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        selectedServiceId === svc.id
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {svc.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {formatNaira(unitPrice, symbol)} · {svc.successRate}%
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Session Price</p>
              <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {formatNaira(computedPrice, symbol)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRent}
              disabled={renting || !activeService || !activeCountry}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {renting ? 'Placing Order...' : 'Rent Virtual Number'}
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            15-minute active session · Automatic instant refund if cancelled before OTP arrival
          </p>
        </div>

        {/* Active SMS Inbox */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Active Numbers &amp; OTP Inbox
              </h2>
            </div>
            <button
              type="button"
              onClick={loadAll}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No virtual numbers rented yet. Pick a country and service on the left to start.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.map((order) => {
                const isAwaitingNumber =
                  !order.phoneNumber || order.phoneNumber === 'Awaiting number';
                const timer = formatCountdown(order.expiresAt, nowMs);
                return (
                <div key={order.id} className="py-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {order.serviceName} · {order.countryName} ·{' '}
                        <span className="font-mono">{formatNaira(order.price, symbol)}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {isAwaitingNumber ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/60">
                            Awaiting number
                          </span>
                        ) : (
                          <>
                            <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                              {order.phoneNumber}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                await copyText(order.phoneNumber);
                                notify('Phone number copied', 'info');
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                              aria-label="Copy phone number"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {order.status === 'waiting' && (
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded-md border tabular-nums ${
                            timer.isUrgent
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900'
                              : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900'
                          }`}
                          title="15-minute session timer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {timer.remainingMs > 0 ? timer.label : '00:00'}
                        </span>
                      )}
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                          order.status === 'received'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : order.status === 'waiting'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {order.status === 'received'
                          ? 'OTP Received'
                          : order.status === 'waiting'
                            ? isAwaitingNumber
                              ? 'Awaiting Number'
                              : 'Waiting for SMS'
                            : order.status === 'expired'
                              ? 'Expired & Refunded'
                              : 'Cancelled & Refunded'}
                      </span>
                    </div>
                  </div>

                  {order.status === 'waiting' && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {isAwaitingNumber
                            ? 'Awaiting number & OTP — our team will drop your number and code shortly.'
                            : 'Number assigned! Waiting for OTP code — inbox checks automatically once delivered.'}
                        </span>
                        <span className="font-mono font-bold tabular-nums">
                          {timer.remainingMs > 0
                            ? `${timer.label} left (auto-refunds on expiry)`
                            : 'Expiring & refunding...'}
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => handleCheckOtp(order.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Check for OTP
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelRefund(order.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline shrink-0 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel &amp; Refund
                        </button>
                      </div>
                    </div>
                  )}

                  {order.status === 'received' && order.otpCode && (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Code:</span>
                          <span className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
                            {order.otpCode}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await copyText(order.otpCode || '');
                              notify('OTP code copied', 'info');
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                            aria-label="Copy OTP"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRequestAnother(order.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Request Another
                        </button>
                      </div>
                      {order.smsText && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">{order.smsText}</p>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
