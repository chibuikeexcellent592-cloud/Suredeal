import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  RefreshCw,
  Search,
  Smartphone,
  Tag,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, copyText, formatCountdown, formatNaira } from '../../lib/api';
import { getSectionCopy } from '../../lib/sectionCopy';
import { applyFlashSaleDiscount, isFlashSaleActive } from '../../../shared/pricing';
import type { SmsCountry, SmsOrder, SmsService } from '../../types';

function countryCodeToFlag(code?: string): string {
  const cc = (code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🌍';
  return String.fromCodePoint(
    0x1f1e6 + cc.charCodeAt(0) - 65,
    0x1f1e6 + cc.charCodeAt(1) - 65,
  );
}

interface SmsPanelProps {
  onFundWallet?: () => void;
}

export function SmsPanel({ onFundWallet }: SmsPanelProps) {
  const { user, catalog, updateLocalBalance, notify } = useApp();
  const settings = catalog?.settings;
  const symbol = settings?.currencySymbol || '₦';
  const currencyCode = settings?.currencyCode || 'NGN';
  const walletBalance = user?.balance || 0;

  const primeLabel = settings?.smsPrimeLabel?.trim() || 'Prime';
  const alternateLabel = settings?.smsAlternateLabel?.trim() || 'Alternate';
  const alternateMode = settings?.smsAlternateMode === 'markup' ? 'markup' : 'discount';
  const alternatePct = Math.min(
    alternateMode === 'markup' ? 500 : 90,
    Math.max(0, Number(settings?.smsAlternateDiscountPct ?? 15)),
  );
  const allowPromoCodes = settings?.allowPromoCodes !== false;

  const [services, setServices] = useState<SmsService[]>([]);
  const [countries, setCountries] = useState<SmsCountry[]>([]);
  const [orders, setOrders] = useState<SmsOrder[]>([]);
  const [tier, setTier] = useState<'prime' | 'alternate'>('prime');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
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

  useEffect(() => {
    if (
      filteredServices.length > 0 &&
      !filteredServices.some((s) => s.id === selectedServiceId)
    ) {
      setSelectedServiceId(filteredServices[0].id);
    }
  }, [filteredServices, selectedServiceId]);

  const activeService = services.find((s) => s.id === selectedServiceId);
  const activeCountry = countries.find((c) => c.id === selectedCountryId);

  const calcTierPrice = (base: number) =>
    tier === 'alternate'
      ? alternateMode === 'markup'
        ? Math.max(50, Math.round(base * (1 + alternatePct / 100)))
        : Math.max(50, Math.round(base * (1 - alternatePct / 100)))
      : base;

  const primePrice =
    activeService && activeCountry
      ? Math.round(activeService.basePrice * activeCountry.multiplier)
      : 0;
  const tierPrice = primePrice > 0 ? calcTierPrice(primePrice) : 0;
  const smsFlashActive = isFlashSaleActive(settings, 'sms');
  const flashResult = applyFlashSaleDiscount(tierPrice, settings, 'sms');
  const computedPrice = flashResult.finalAmount;
  const availableStock = activeService?.stock ?? 0;
  const shortfall = Math.max(0, computedPrice - walletBalance);
  const hasInsufficientBalance = computedPrice > 0 && walletBalance < computedPrice;

  const handleRent = async () => {
    if (!selectedServiceId || !selectedCountryId) return;
    if (hasInsufficientBalance) {
      notify(`Insufficient balance. Need ${formatNaira(shortfall, symbol)} more.`, 'error');
      return;
    }
    setRenting(true);
    try {
      const res = await apiFetch<{ order: SmsOrder; balance: number }>('/api/sms/rent', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: selectedServiceId,
          countryId: selectedCountryId,
          tier,
          promoCode: promoCode.trim() || undefined,
        }),
      });
      setOrders((prev) => [res.order, ...prev]);
      updateLocalBalance(res.balance);
      setPromoCode('');
      const isAwaitingNumber =
        !res.order.phoneNumber || res.order.phoneNumber === 'Awaiting number';
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
        { method: 'POST' },
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

  const smsPaused = settings?.enableSmsService === false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          {getSectionCopy(settings, 'smsTitle', { symbol })}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {getSectionCopy(settings, 'smsSubtitle', { symbol })}
        </p>
      </div>

      {smsPaused && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300">
          {getSectionCopy(settings, 'smsPausedText', { symbol })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Clean Place-an-Order Configurator modeled on IMG_6144 */}
        <div className="lg:col-span-5 bg-white dark:bg-[#11121B] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
          <div>
            <h2 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
              Place an order
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pick a country and service, then confirm stock and price.
            </p>
          </div>

          {/* Prime | Alternate Segmented Switcher */}
          <div className="p-1 rounded-2xl bg-slate-100 dark:bg-[#191B26] border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setTier('prime')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tier === 'prime'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {primeLabel}
            </button>
            <button
              type="button"
              onClick={() => setTier('alternate')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                tier === 'alternate'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{alternateLabel}</span>
            </button>
          </div>

          {/* Country Selector */}
          <div>
            <label
              htmlFor="sms-country-select"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2"
            >
              Country
            </label>
            <div className="relative">
              <select
                id="sms-country-select"
                value={selectedCountryId}
                onChange={(e) => setSelectedCountryId(e.target.value)}
                disabled={loading || countries.length === 0}
                className="w-full appearance-none px-3.5 py-3 pr-9 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#191B26] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                {countries.length === 0 ? (
                  <option value="">Loading countries...</option>
                ) : (
                  countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {countryCodeToFlag(c.code)} {c.name} ({c.dialCode})
                    </option>
                  ))
                )}
              </select>
              <span className="inset-y-0 right-3.5 flex items-center pointer-events-none absolute">
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </span>
            </div>
          </div>

          {/* Service Selector + Quick Search */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="sms-service-select"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Service
              </label>
              {services.length > 6 && (
                <div className="w-44 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#191B26] text-slate-900 dark:text-white focus-within:ring-2 focus-within:ring-blue-600">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Filter app..."
                    className="flex-1 min-w-0 bg-transparent text-[11px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                  />
                  {serviceSearch && (
                    <button
                      type="button"
                      onClick={() => setServiceSearch('')}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer shrink-0"
                      aria-label="Clear service filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <select
                id="sms-service-select"
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                disabled={loading || filteredServices.length === 0}
                className="w-full appearance-none px-3.5 py-3 pr-9 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#191B26] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                {filteredServices.length === 0 ? (
                  <option value="">
                    {loading ? 'Loading services...' : 'No matching SMS services'}
                  </option>
                ) : (
                  filteredServices.map((svc) => {
                    const base = Math.round(svc.basePrice * (activeCountry?.multiplier || 1));
                    const shown = applyFlashSaleDiscount(calcTierPrice(base), settings, 'sms').finalAmount;
                    return (
                      <option key={svc.id} value={svc.id}>
                        {svc.name} · {formatNaira(shown, symbol)} ({svc.stock.toLocaleString()} ready)
                      </option>
                    );
                  })
                )}
              </select>
              <span className="inset-y-0 right-3.5 flex items-center pointer-events-none absolute">
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </span>
            </div>
          </div>

          {/* Bordered Summary Box: Payable Amount, Available Stock, Coupon + Wallet Balance Pill */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#161722] divide-y divide-slate-200/80 dark:divide-slate-800">
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Payable Amount
                </span>
                {smsFlashActive && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold">
                    {settings?.flashSaleLabel?.trim() || 'Flash Sale'} -{flashResult.discountPercent}%
                  </span>
                )}
              </div>
              <div className="text-right">
                {((tier === 'alternate' && primePrice !== computedPrice) ||
                  (flashResult.active && computedPrice < tierPrice)) && (
                  <span className="font-mono text-xs line-through text-slate-400 mr-2 tabular-nums">
                    {formatNaira(flashResult.active ? tierPrice : primePrice, symbol)}
                  </span>
                )}
                <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {formatNaira(computedPrice, symbol)}
                </span>
              </div>
            </div>

            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Available Stock
              </span>
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                {availableStock.toLocaleString()}
              </span>
            </div>

            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                {allowPromoCodes ? (
                  <button
                    type="button"
                    onClick={() => setCouponOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    {couponOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    <span>Have a coupon?</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Wallet Balance</span>
                )}

                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E202E] text-xs font-mono font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                  <Wallet className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatNaira(walletBalance, symbol)}</span>
                </span>
              </div>

              {allowPromoCodes && couponOpen && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11121B] focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600">
                    <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="Enter promo code (e.g. SURE10)"
                      className="flex-1 min-w-0 bg-transparent text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  {promoCode.trim() && (
                    <button
                      type="button"
                      onClick={() => setPromoCode('')}
                      className="px-2.5 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Insufficient Balance Alert with Fund Wallet Button */}
          {hasInsufficientBalance && (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-[#2A200D] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Insufficient balance
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-0.5 tabular-nums">
                    Need {formatNaira(shortfall, symbol)} more in {currencyCode}.
                  </p>
                </div>
              </div>
              {onFundWallet && (
                <button
                  type="button"
                  onClick={onFundWallet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold shadow-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Fund wallet</span>
                </button>
              )}
            </div>
          )}

          {/* Primary Place Order CTA */}
          <button
            type="button"
            onClick={handleRent}
            disabled={
              renting ||
              smsPaused ||
              !activeService ||
              !activeCountry ||
              availableStock <= 0 ||
              hasInsufficientBalance
            }
            className="w-full py-3.5 px-5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl shadow-sm transition-colors cursor-pointer"
          >
            {smsPaused
              ? 'Service Paused'
              : availableStock <= 0 && activeService
                ? 'Out of Stock'
                : renting
                  ? 'Placing order...'
                  : settings?.smsRentButtonLabel?.trim() || 'Place order'}
          </button>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
            {getSectionCopy(settings, 'smsSessionNote', { symbol })}
          </p>
        </div>

        {/* Active SMS Inbox */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {getSectionCopy(settings, 'smsInboxTitle', { symbol })}
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
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Code:
                            </span>
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
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            One-time code delivered
                          </span>
                        </div>
                        {order.smsText && (
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {order.smsText}
                          </p>
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
