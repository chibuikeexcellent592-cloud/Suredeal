import type { PlatformSettings } from '../types';

interface BrandNameTextProps {
  settings?: Partial<PlatformSettings> | null;
  className?: string;
}

function splitSiteName(siteName: string): [string, string] {
  const trimmed = siteName.trim() || 'SureDeal Store';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    // Special polish for "SureDeal Store" -> "Sure" + "Deal Store" if first word is SureDeal
    if (words[0].toLowerCase() === 'suredeal') {
      return ['Sure', `Deal ${words.slice(1).join(' ')}`];
    }
    return [words[0], ` ${words.slice(1).join(' ')}`];
  }
  const mid = Math.ceil(trimmed.length / 2);
  return [trimmed.slice(0, mid), trimmed.slice(mid)];
}

export function BrandNameText({ settings, className = '' }: BrandNameTextProps) {
  const siteName = settings?.siteName?.trim() || 'SureDeal Store';
  const mode = settings?.siteNameColorMode || 'split';
  const c1 = settings?.siteNameColor1?.trim() || '';
  const c2 = settings?.siteNameColor2?.trim() || '';

  if (mode === 'gradient' && c1 && c2) {
    return (
      <span
        className={className}
        style={{
          backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})`,
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

  if (mode === 'split' && (c1 || c2)) {
    const [firstPart, secondPart] = splitSiteName(siteName);
    const hasSpace = secondPart.startsWith(' ');
    return (
      <span className={className}>
        <span style={c1 ? { color: c1 } : undefined}>{firstPart}</span>
        {hasSpace ? ' ' : ''}
        <span style={c2 ? { color: c2 } : undefined}>
          {hasSpace ? secondPart.slice(1) : secondPart}
        </span>
      </span>
    );
  }

  if (mode === 'solid' && c1) {
    return (
      <span className={className} style={{ color: c1 }}>
        {siteName}
      </span>
    );
  }

  return <span className={className}>{siteName}</span>;
}
