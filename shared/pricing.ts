import type { PlatformSettings } from '../src/types.ts';

export type FlashSaleScope = 'marketplace' | 'sms' | 'boosting';

export function isFlashSaleActive(
  settings: Partial<PlatformSettings> | undefined | null,
  scope?: FlashSaleScope,
  nowMs = Date.now(),
): boolean {
  if (!settings?.flashSaleEnabled) return false;
  const pct = Number(settings.flashSalePercent || 0);
  if (!Number.isFinite(pct) || pct <= 0) return false;
  const target = settings.flashSaleTarget || 'all';
  if (scope && target !== 'all' && target !== scope) return false;
  if (settings.flashSaleEndsAt) {
    const endMs = Date.parse(settings.flashSaleEndsAt);
    if (Number.isFinite(endMs) && endMs <= nowMs) return false;
  }
  return true;
}

export function getFlashSalePercent(
  settings: Partial<PlatformSettings> | undefined | null,
  scope?: FlashSaleScope,
  nowMs = Date.now(),
): number {
  if (!isFlashSaleActive(settings, scope, nowMs)) return 0;
  const pct = Math.round(Number(settings?.flashSalePercent || 0));
  return Math.max(1, Math.min(80, pct));
}

export function applyFlashSaleDiscount(
  baseAmount: number,
  settings: Partial<PlatformSettings> | undefined | null,
  scope?: FlashSaleScope,
  nowMs = Date.now(),
): {
  originalAmount: number;
  finalAmount: number;
  discountPercent: number;
  active: boolean;
} {
  const safeBase = Math.max(0, Math.round(Number(baseAmount) || 0));
  const pct = getFlashSalePercent(settings, scope, nowMs);
  if (pct <= 0 || safeBase <= 0) {
    return {
      originalAmount: safeBase,
      finalAmount: safeBase,
      discountPercent: 0,
      active: false,
    };
  }
  const finalAmount = Math.max(1, Math.round(safeBase * (1 - pct / 100)));
  return {
    originalAmount: safeBase,
    finalAmount,
    discountPercent: pct,
    active: true,
  };
}
