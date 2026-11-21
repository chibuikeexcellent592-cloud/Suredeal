import type { PlatformSettings } from '../types';

export interface ColorPreset {
  id: string;
  name: string;
  brandColor: string;
  accentColor: string;
  surfaceBgLight: string;
  surfaceBgDark: string;
}

export const DEFAULT_PALETTE = {
  colorPreset: 'royal-blue',
  brandColor: '#2563EB',
  accentColor: '#0EA5E9',
  surfaceBgLight: '#F8FAFC',
  surfaceBgDark: '#0B0F17',
};

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'royal-blue',
    name: 'Royal Blue (Default)',
    brandColor: '#2563EB',
    accentColor: '#0EA5E9',
    surfaceBgLight: '#F8FAFC',
    surfaceBgDark: '#0B0F17',
  },
  {
    id: 'emerald',
    name: 'Emerald Mint',
    brandColor: '#059669',
    accentColor: '#10B981',
    surfaceBgLight: '#F4FBF8',
    surfaceBgDark: '#07130F',
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    brandColor: '#6D28D9',
    accentColor: '#8B5CF6',
    surfaceBgLight: '#F8F7FF',
    surfaceBgDark: '#0D0A1A',
  },
  {
    id: 'indigo',
    name: 'Indigo Violet',
    brandColor: '#4F46E5',
    accentColor: '#8B5CF6',
    surfaceBgLight: '#F6F7FF',
    surfaceBgDark: '#0B0B19',
  },
  {
    id: 'crimson',
    name: 'Crimson Flame',
    brandColor: '#DC2626',
    accentColor: '#F97316',
    surfaceBgLight: '#FFF8F7',
    surfaceBgDark: '#14090A',
  },
  {
    id: 'amber',
    name: 'Amber Gold',
    brandColor: '#D97706',
    accentColor: '#F59E0B',
    surfaceBgLight: '#FFFDF5',
    surfaceBgDark: '#141007',
  },
  {
    id: 'teal',
    name: 'Ocean Teal',
    brandColor: '#0D9488',
    accentColor: '#06B6D4',
    surfaceBgLight: '#F3FCFB',
    surfaceBgDark: '#071314',
  },
  {
    id: 'rose',
    name: 'Velvet Rose',
    brandColor: '#E11D48',
    accentColor: '#EC4899',
    surfaceBgLight: '#FFF7FA',
    surfaceBgDark: '#160910',
  },
  {
    id: 'midnight',
    name: 'Obsidian Slate',
    brandColor: '#1E293B',
    accentColor: '#475569',
    surfaceBgLight: '#F8FAFC',
    surfaceBgDark: '#090D16',
  },
];

const PALETTE_CACHE_KEY = 'suredeal_brand_palette';

export function normalizeHex(input: string | undefined, fallback: string): string {
  const raw = (input || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function mixHex(hexA: string, hexB: string, weightB: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  return rgbToHex(r1 * (1 - w) + r2 * w, g1 * (1 - w) + g2 * w, b1 * (1 - w) + b2 * w);
}

function buildScale(baseHex: string, anchor: '600' | '500'): Record<string, string> {
  const light = '#FFFFFF';
  const dark = '#070B14';
  if (anchor === '600') {
    return {
      50: mixHex(baseHex, light, 0.92),
      100: mixHex(baseHex, light, 0.83),
      200: mixHex(baseHex, light, 0.68),
      300: mixHex(baseHex, light, 0.48),
      400: mixHex(baseHex, light, 0.24),
      500: mixHex(baseHex, light, 0.08),
      600: baseHex,
      700: mixHex(baseHex, dark, 0.16),
      800: mixHex(baseHex, dark, 0.34),
      900: mixHex(baseHex, dark, 0.52),
      950: mixHex(baseHex, dark, 0.7),
    };
  }
  return {
    50: mixHex(baseHex, light, 0.92),
    100: mixHex(baseHex, light, 0.82),
    200: mixHex(baseHex, light, 0.66),
    300: mixHex(baseHex, light, 0.44),
    400: mixHex(baseHex, light, 0.2),
    500: baseHex,
    600: mixHex(baseHex, dark, 0.14),
    700: mixHex(baseHex, dark, 0.3),
    800: mixHex(baseHex, dark, 0.46),
    900: mixHex(baseHex, dark, 0.62),
    950: mixHex(baseHex, dark, 0.76),
  };
}

export function applyWebsitePalette(settings?: Partial<PlatformSettings> | null): void {
  if (typeof document === 'undefined') return;
  const brandColor = normalizeHex(settings?.brandColor, DEFAULT_PALETTE.brandColor);
  const accentColor = normalizeHex(settings?.accentColor, DEFAULT_PALETTE.accentColor);
  const surfaceBgLight = normalizeHex(settings?.surfaceBgLight, DEFAULT_PALETTE.surfaceBgLight);
  const surfaceBgDark = normalizeHex(settings?.surfaceBgDark, DEFAULT_PALETTE.surfaceBgDark);

  const root = document.documentElement;
  const blueScale = buildScale(brandColor, '600');
  const skyScale = buildScale(accentColor, '500');

  if (brandColor === DEFAULT_PALETTE.brandColor) {
    Object.keys(blueScale).forEach((shade) => root.style.removeProperty(`--color-blue-${shade}`));
  } else {
    Object.entries(blueScale).forEach(([shade, val]) =>
      root.style.setProperty(`--color-blue-${shade}`, val),
    );
  }

  if (accentColor === DEFAULT_PALETTE.accentColor) {
    Object.keys(skyScale).forEach((shade) => root.style.removeProperty(`--color-sky-${shade}`));
  } else {
    Object.entries(skyScale).forEach(([shade, val]) =>
      root.style.setProperty(`--color-sky-${shade}`, val),
    );
  }

  root.style.setProperty('--site-bg-light', surfaceBgLight);
  root.style.setProperty('--site-bg-dark', surfaceBgDark);

  try {
    localStorage.setItem(
      PALETTE_CACHE_KEY,
      JSON.stringify({
        brandColor,
        accentColor,
        surfaceBgLight,
        surfaceBgDark,
      }),
    );
  } catch {
    // ignore storage errors
  }
}

export function applyCachedPalette(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PALETTE_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<PlatformSettings>;
    applyWebsitePalette(parsed);
  } catch {
    // ignore cache errors
  }
}

const SITE_LOGO_CACHE_KEY = 'suredeal_site_logo_cache';

export function getCachedSiteLogo(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(SITE_LOGO_CACHE_KEY) || '';
  } catch {
    return '';
  }
}

export function setCachedSiteLogo(logoUrl: string | undefined | null): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = (logoUrl || '').trim();
    if (clean) {
      window.localStorage.setItem(SITE_LOGO_CACHE_KEY, clean);
    } else {
      window.localStorage.removeItem(SITE_LOGO_CACHE_KEY);
    }
  } catch {
    // ignore storage quota errors safely
  }
}

