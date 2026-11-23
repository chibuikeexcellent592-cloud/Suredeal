import { useApp } from '../context/AppContext';
import type { PlatformSettings } from '../types';

interface BrandNameTextProps {
  settings?: Partial<PlatformSettings> | null;
  className?: string;
  forceTheme?: 'light' | 'dark';
}

function splitSiteName(
  siteName: string,
  splitRule: 'words' | 'sure_prefix' = 'words',
): [string, string] {
  const trimmed = siteName.trim() || 'SureDeal Store';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    if (splitRule === 'sure_prefix' && words[0].toLowerCase() === 'suredeal') {
      return ['Sure', `Deal ${words.slice(1).join(' ')}`];
    }
    return [words[0], ` ${words.slice(1).join(' ')}`];
  }
  if (splitRule === 'sure_prefix' && trimmed.toLowerCase().startsWith('suredeal')) {
    return ['Sure', trimmed.slice(4)];
  }
  const mid = Math.ceil(trimmed.length / 2);
  return [trimmed.slice(0, mid), trimmed.slice(mid)];
}

function isNearNeutralDark(hex: string): boolean {
  const clean = hex.trim().toLowerCase();
  return !clean || clean === '#0f172a' || clean === '#000000' || clean === '#111827' || clean === '#1e293b';
}

export function BrandNameText({
  settings,
  className = '',
  forceTheme,
}: BrandNameTextProps) {
  const { theme: appTheme } = useApp();
  const activeTheme = forceTheme ?? appTheme;
  const isDark = activeTheme === 'dark';

  const siteName = settings?.siteName?.trim() || 'SureDeal Store';
  const mode = settings?.siteNameColorMode || 'split';
  const splitRule = settings?.siteNameSplitRule || 'words';
  const target = settings?.siteNameThemeTarget || 'first';
  const autoTheme = settings?.siteNameAutoTheme !== false;

  const rawC1 = settings?.siteNameColor1?.trim() || '';
  const rawC2 = settings?.siteNameColor2?.trim() || '';

  const neutralHex = isDark ? '#FFFFFF' : '#0F172A';
  const blueHex =
    (rawC2 && !isNearNeutralDark(rawC2) && rawC2.toLowerCase() !== '#ffffff'
      ? rawC2
      : rawC1 && !isNearNeutralDark(rawC1) && rawC1.toLowerCase() !== '#ffffff'
        ? rawC1
        : '') || (isDark ? '#3B82F6' : '#2563EB');

  if (mode === 'gradient') {
    const g1 = autoTheme && target === 'first' ? neutralHex : rawC1 || neutralHex;
    const g2 = autoTheme && target === 'second' ? neutralHex : rawC2 || blueHex;
    return (
      <span
        className={className}
        style={{
          backgroundImage: `linear-gradient(90deg, ${g1}, ${g2})`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {siteName}
      </span>
    );
  }

  if (mode === 'split') {
    const [firstPart, secondPart] = splitSiteName(siteName, splitRule);
    const hasSpace = secondPart.startsWith(' ');

    let color1 = rawC1 || neutralHex;
    let color2 = rawC2 || blueHex;

    if (autoTheme && target !== 'custom') {
      if (target === 'first') {
        color1 = neutralHex;
        color2 = blueHex;
      } else if (target === 'second') {
        color1 = blueHex;
        color2 = neutralHex;
      } else if (target === 'both') {
        color1 = neutralHex;
        color2 = neutralHex;
      }
    }

    return (
      <span className={className}>
        <span style={{ color: color1 }}>{firstPart}</span>
        {hasSpace ? ' ' : ''}
        <span style={{ color: color2 }}>
          {hasSpace ? secondPart.slice(1) : secondPart}
        </span>
      </span>
    );
  }

  if (mode === 'solid') {
    const solidColor =
      autoTheme && target !== 'custom' ? neutralHex : rawC1 || neutralHex;
    return (
      <span className={className} style={{ color: solidColor }}>
        {siteName}
      </span>
    );
  }

  return <span className={className}>{siteName}</span>;
}
