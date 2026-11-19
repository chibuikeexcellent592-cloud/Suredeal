import { useEffect, useState } from 'react';

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
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-14 h-14',
};

const TEXT_SIZE_MAP: Record<NonNullable<BrandLogoProps['size']>, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
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

  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  const animClass = bounce ? 'animate-logo-bounce' : '';
  const initial = (siteName || 'S').trim().charAt(0).toUpperCase() || 'S';

  if (logoUrl && !failed) {
    return (
      <span
        className={`${SIZE_MAP[size]} ${shapeClass} bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden shrink-0 ${animClass} ${className}`}
      >
        <img
          src={logoUrl}
          alt={siteName}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover object-center block"
        />
      </span>
    );
  }

  return (
    <span
      className={`${SIZE_MAP[size]} ${shapeClass} bg-gradient-to-br from-blue-600 to-sky-500 text-white font-display font-extrabold ${TEXT_SIZE_MAP[size]} flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/20 ${animClass} ${className}`}
    >
      {initial}
    </span>
  );
}
