import { useEffect, useState } from 'react';
import { resolveApiUrl } from '../lib/api';
import { getCachedSiteLogo } from '../lib/themeColor';

interface BrandLogoProps {
  logoUrl?: string;
  siteName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'rounded';
  bounce?: boolean;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<BrandLogoProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-12 h-12',
  xl: 'w-14 h-14',
};

export function BrandLogo({
  logoUrl,
  siteName = 'SureDeal Store',
  size = 'md',
  shape = 'circle',
  bounce = false,
  className = '',
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  const effectiveLogoUrl =
    logoUrl !== undefined ? logoUrl.trim() : getCachedSiteLogo().trim();

  useEffect(() => {
    setFailed(false);
  }, [effectiveLogoUrl]);

  if (!effectiveLogoUrl || failed) {
    return null;
  }

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  const animClass = bounce ? 'animate-logo-bounce' : '';

  return (
    <span
      className={`${SIZE_MAP[size]} ${shapeClass} bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden shrink-0 ${animClass} ${className}`}
    >
      <img
        src={resolveApiUrl(effectiveLogoUrl)}
        alt={siteName}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover object-center block"
      />
    </span>
  );
}

