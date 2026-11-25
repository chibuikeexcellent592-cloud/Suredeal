import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, RotateCcw, TrendingUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, formatNaira } from '../../lib/api';
import { getSectionCopy } from '../../lib/sectionCopy';
import { applyFlashSaleDiscount } from '../../../shared/pricing';
import type { BoostingOrder, BoostingService } from '../../types';

export function BoostingPanel() {
  const { catalog, updateLocalBalance, notify } = useApp();
  const symbol = catalog?.settings?.currencySymbol || '₦';

  const [services, setServices] = useState<BoostingService[]>([]);
  const [orders, setOrders] = useState<BoostingOrder[]>([]);
  const [platformFilter, setPlatformFilter] = useState('All');
  const [selectedId, setSelectedId] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [quantity, setQuantity] = useState(1000);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState<BoostingOrder | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [catRes, ordRes] = await Promise.all([
        apiFetch<{ services: BoostingService[] }>('/api/boosting/catalog'),
        apiFetch<{ orders: BoostingOrder[] }>('/api/boosting/orders'),
      ]);
      setServices(catRes.services);
      setOrders(ordRes.orders);
      setSelectedId((prev) => prev || catRes.services[0]?.id || '');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load boosting catalog', 'error');
    }
  }, [notify]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const platforms = useMemo(
    () => ['All', ...Array.from(new Set(services.map((s) => s.platform)))],
    [services],
  );

  const visibleServices = useMemo(() => {
    if (platformFilter === 'All') return services;
    return services.filter((s) => s.platform === platformFilter);
  }, [services, platformFilter]);

  const activeService =
    services.find((s) => s.id === selectedId) || visibleServices[0] || services[0];

  const rawTotalCost = activeService
    ? Math.max(10, Math.round((activeService.ratePer1k * quantity) / 1000))
    : 0;
  const flashResult = applyFlashSaleDiscount(rawTotalCost, catalog?.settings, 'boosting');
  const totalCost = flashResult.finalAmount;

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeService) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ order: BoostingOrder; balance: number }>(
        '/api/boosting/order',
        {
          method: 'POST',
          body: JSON.stringify({
            serviceId: activeService.id,
            targetUrl: targetUrl.trim(),
            quantity,
          }),
        },
      );
      setOrders((prev) => [res.order, ...prev]);
      setLastSubmitted(res.order);
      updateLocalBalance(res.balance);
      setTargetUrl('');
      notify('Order purchased & details sent directly to our Team!', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to submit order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefill = async (id: string) => {
    try {
      const res = await apiFetch<{ order: BoostingOrder }>(`/api/boosting/orders/${id}/refill`, {
        method: 'POST',
      });
      setOrders((prev) => prev.map((o) => (o.id === id ? res.order : o)));
      notify('Refill request dispatched to our Team desk.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Refill failed', 'error');
    }
  };

  const boostingPaused = catalog?.settings?.enableBoostingService === false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          {getSectionCopy(catalog?.settings, 'boostingTitle', { symbol })}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {getSectionCopy(catalog?.settings, 'boostingSubtitle', { symbol })}
        </p>
      </div>

      {boostingPaused && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300">
          {getSectionCopy(catalog?.settings, 'boostingPausedText', { symbol })}
        </div>
      )}

      {/* Platform Segmented Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {platforms.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setPlatformFilter(p);
              const first = services.find((s) => p === 'All' || s.platform === p);
              if (first) {
                setSelectedId(first.id);
                setQuantity(Math.max(first.minQty, 1000));
              }
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              platformFilter === p
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleOrder}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div>
            <label
              htmlFor="boost-service"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Select Package
            </label>
            <select
              id="boost-service"
              value={activeService?.id || ''}
              onChange={(e) => {
                const next = services.find((s) => s.id === e.target.value);
                setSelectedId(e.target.value);
                if (next && quantity < next.minQty) setQuantity(next.minQty);
              }}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {visibleServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {formatNaira(s.ratePer1k, symbol)}/1K
                </option>
              ))}
            </select>
          </div>

          {activeService && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p>
                Speed: <strong className="text-slate-900 dark:text-white">{activeService.speedLabel}</strong> ·{' '}
                Guarantee: <strong className="text-slate-900 dark:text-white">{activeService.refillPolicy}</strong>
              </p>
              <p className="tabular-nums">
                Limits: {activeService.minQty.toLocaleString()} – {activeService.maxQty.toLocaleString()}
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="boost-url"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Target Profile / Post Link
            </label>
            <input
              id="boost-url"
              type="text"
              required
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://instagram.com/username or post link"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="boost-qty"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Quantity
            </label>
            <input
              id="boost-qty"
              type="number"
              required
              min={activeService?.minQty || 50}
              max={activeService?.maxQty || 1000000}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
            />
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">Campaign Total</p>
                {flashResult.active && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">
                    {catalog?.settings?.flashSaleLabel?.trim() || 'Flash Sale'} -{flashResult.discountPercent}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                {flashResult.active && totalCost < rawTotalCost && (
                  <span className="font-mono text-xs line-through text-slate-400 tabular-nums">
                    {formatNaira(rawTotalCost, symbol)}
                  </span>
                )}
                <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatNaira(totalCost, symbol)}
                </p>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || boostingPaused || !activeService}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {boostingPaused ? 'Paused' : submitting ? 'Sending to Our Team...' : 'Purchase'}
            </button>
          </div>

          {lastSubmitted && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <p className="font-bold">
                  Order #{lastSubmitted.id} sent directly to our Team!
                </p>
                <p className="text-[11px] opacity-90 truncate">
                  {lastSubmitted.serviceName} · Qty: {lastSubmitted.quantity.toLocaleString()} ·{' '}
                  {lastSubmitted.targetUrl}
                </p>
              </div>
            </div>
          )}
        </form>

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {getSectionCopy(catalog?.settings, 'boostingHistoryTitle', { symbol })}
              </h2>
            </div>
            <button
              type="button"
              onClick={loadAll}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              {getSectionCopy(catalog?.settings, 'boostingEmptyText', { symbol })}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.map((ord) => (
                <div key={ord.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {ord.serviceName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-md">
                      {ord.targetUrl}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                      Qty: {ord.quantity.toLocaleString()} · Remains: {ord.remains.toLocaleString()} ·{' '}
                      {formatNaira(ord.amount, symbol)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md capitalize ${
                        ord.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : ord.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {ord.status}
                    </span>
                    {ord.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleRefill(ord.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Refill
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
