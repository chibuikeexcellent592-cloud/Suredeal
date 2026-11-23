import { useApp } from '../context/AppContext';
import type { PlatformSettings } from '../types';

export type SeasonalThemeId = NonNullable<PlatformSettings['seasonalTheme']>;

export interface SeasonalPresetMeta {
  id: SeasonalThemeId;
  label: string;
  emoji: string;
  defaultHeadline: string;
  ribbonClass: string;
  badgeClass: string;
  particles: string[];
  accentHex: string;
}

export const SEASONAL_PRESETS: Record<SeasonalThemeId, SeasonalPresetMeta> = {
  none: {
    id: 'none',
    label: 'Standard / Off',
    emoji: '✨',
    defaultHeadline: '',
    ribbonClass: 'bg-slate-900 text-white border-slate-800',
    badgeClass: 'bg-slate-100 text-slate-700',
    particles: [],
    accentHex: '#2563EB',
  },
  christmas: {
    id: 'christmas',
    label: 'Christmas Season',
    emoji: '🎄',
    defaultHeadline: 'Season’s Greetings — Holiday Specials & Instant Digital Delivery Live!',
    ribbonClass:
      'bg-gradient-to-r from-emerald-800 via-red-700 to-emerald-800 text-white border-emerald-900/40',
    badgeClass: 'bg-emerald-600 text-white',
    particles: ['❄️', '❅', '🎄', '✨', '❄️', '🎁'],
    accentHex: '#DC2626',
  },
  new_year: {
    id: 'new_year',
    label: 'New Year Celebration',
    emoji: '🎆',
    defaultHeadline: 'Happy New Year — Fresh Growth Tools & VIP Wallet Perks All Year!',
    ribbonClass:
      'bg-gradient-to-r from-slate-900 via-indigo-900 to-amber-700 text-white border-amber-500/30',
    badgeClass: 'bg-amber-500 text-slate-950',
    particles: ['✨', '🎆', '⭐', '🥂', '🎊', '✨'],
    accentHex: '#F59E0B',
  },
  valentine: {
    id: 'valentine',
    label: 'Valentine’s Week',
    emoji: '💖',
    defaultHeadline: 'Spread the Love — Special Creator Deals & Referral Bonuses Active!',
    ribbonClass:
      'bg-gradient-to-r from-rose-700 via-pink-600 to-rose-700 text-white border-rose-800/40',
    badgeClass: 'bg-rose-600 text-white',
    particles: ['💖', '🌹', '✨', '💕', '💝'],
    accentHex: '#E11D48',
  },
  ramadan_eid: {
    id: 'ramadan_eid',
    label: 'Ramadan & Eid Mubarak',
    emoji: '🌙',
    defaultHeadline: 'Ramadan & Eid Mubarak — Blessed Season Rewards & Fast 24/7 Fulfillment!',
    ribbonClass:
      'bg-gradient-to-r from-emerald-950 via-teal-800 to-amber-800 text-amber-50 border-amber-500/30',
    badgeClass: 'bg-amber-500 text-slate-950',
    particles: ['🌙', '⭐', '✨', '🕌', '🌟'],
    accentHex: '#D97706',
  },
  black_friday: {
    id: 'black_friday',
    label: 'Black Friday Flash',
    emoji: '⚡',
    defaultHeadline: 'Black Friday Flash Event — Massive Price Drops Across Store & SMS!',
    ribbonClass:
      'bg-gradient-to-r from-zinc-950 via-slate-900 to-amber-600 text-amber-100 border-amber-500/40',
    badgeClass: 'bg-amber-400 text-slate-950',
    particles: ['⚡', '🔥', '🏷️', '✨', '💎'],
    accentHex: '#F59E0B',
  },
  easter: {
    id: 'easter',
    label: 'Easter & Spring',
    emoji: '🌸',
    defaultHeadline: 'Happy Easter — Spring Restocks & Fresh Accounts Ready in the Vault!',
    ribbonClass:
      'bg-gradient-to-r from-sky-700 via-violet-700 to-emerald-700 text-white border-violet-800/40',
    badgeClass: 'bg-violet-600 text-white',
    particles: ['🌸', '🌷', '✨', '🌼', '🦋'],
    accentHex: '#8B5CF6',
  },
  custom: {
    id: 'custom',
    label: 'Custom Celebration',
    emoji: '🎉',
    defaultHeadline: 'Special Store Celebration — Exclusive Deals Live Now!',
    ribbonClass:
      'bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white border-blue-700/40',
    badgeClass: 'bg-blue-600 text-white',
    particles: ['🎉', '✨', '⭐', '🎊'],
    accentHex: '#2563EB',
  },
};

const PARTICLE_SLOTS = [
  { left: '5%', duration: '15s', delay: '0s', size: '14px' },
  { left: '14%', duration: '18s', delay: '2.5s', size: '12px' },
  { left: '23%', duration: '13s', delay: '5s', size: '16px' },
  { left: '34%', duration: '19s', delay: '1.2s', size: '13px' },
  { left: '45%', duration: '14s', delay: '6.5s', size: '15px' },
  { left: '56%', duration: '17s', delay: '3.2s', size: '12px' },
  { left: '67%', duration: '15s', delay: '7.8s', size: '16px' },
  { left: '76%', duration: '20s', delay: '0.8s', size: '13px' },
  { left: '86%', duration: '14s', delay: '4.4s', size: '15px' },
  { left: '94%', duration: '16s', delay: '2.1s', size: '12px' },
];

export function SeasonalOverlay() {
  const { catalog } = useApp();
  const settings = catalog?.settings;
  const seasonId = (settings?.seasonalTheme || 'none') as SeasonalThemeId;
  const effectsEnabled = settings?.seasonalEffectsEnabled !== false;

  if (seasonId === 'none' || !effectsEnabled) return null;

  const preset = SEASONAL_PRESETS[seasonId] || SEASONAL_PRESETS.custom;
  const customEmoji = settings?.seasonalCustomEmoji?.trim();
  const glyphs =
    seasonId === 'custom' && customEmoji
      ? [customEmoji, '✨', customEmoji, '⭐']
      : preset.particles;

  if (!glyphs.length) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden select-none"
    >
      {PARTICLE_SLOTS.map((slot, idx) => (
        <span
          key={idx}
          className="animate-seasonal-fall absolute -top-6 opacity-60"
          style={{
            left: slot.left,
            fontSize: slot.size,
            animationDuration: slot.duration,
            animationDelay: slot.delay,
            WebkitAnimationDuration: slot.duration,
            WebkitAnimationDelay: slot.delay,
          }}
        >
          {glyphs[idx % glyphs.length]}
        </span>
      ))}
    </div>
  );
}

export function SeasonalRibbon({ compact = false }: { compact?: boolean }) {
  const { catalog } = useApp();
  const settings = catalog?.settings;
  const seasonId = (settings?.seasonalTheme || 'none') as SeasonalThemeId;
  const bannerEnabled = settings?.seasonalBannerEnabled !== false;

  if (seasonId === 'none' || !bannerEnabled) return null;

  const preset = SEASONAL_PRESETS[seasonId] || SEASONAL_PRESETS.custom;
  const emoji =
    seasonId === 'custom' && settings?.seasonalCustomEmoji?.trim()
      ? settings.seasonalCustomEmoji.trim()
      : preset.emoji;
  const headline = settings?.seasonalHeadline?.trim() || preset.defaultHeadline;
  const customColor =
    seasonId === 'custom' && settings?.seasonalCustomColor?.trim()
      ? settings.seasonalCustomColor.trim()
      : '';

  if (!headline) return null;

  return (
    <div
      className={`border-b px-4 ${compact ? 'py-1.5 text-[11px]' : 'py-2 text-xs'} font-semibold text-center flex items-center justify-center gap-2 ${
        customColor ? 'text-white border-white/15' : preset.ribbonClass
      }`}
      style={customColor ? { backgroundColor: customColor } : undefined}
    >
      <span aria-hidden="true" className="shrink-0">
        {emoji}
      </span>
      <span className="truncate">{headline}</span>
      <span aria-hidden="true" className="hidden sm:inline shrink-0 opacity-85">
        {emoji}
      </span>
    </div>
  );
}
