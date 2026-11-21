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

  // Signature 4-lobe purple clover/speech mark fallback matching SureDeal Store identity
  return (
    <span
      className={`${SIZE_MAP[size]} flex items-center justify-center shrink-0 ${animClass} ${className}`}
      aria-label={siteName}
    >
      <svg
        viewBox="0 0 64 64"
        className="w-full h-full drop-shadow-xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top-left clover bubble */}
        <path
          d="M8 15C8 10.5817 11.5817 7 16 7H25.5C29.6421 7 33 10.3579 33 14.5V26.5C33 27.8807 31.8807 29 30.5 29H19.5C13.1487 29 8 23.8513 8 17.5V15Z"
          fill="#7C3AED"
        />
        {/* Top-right clover bubble */}
        <path
          d="M35 16C35 11.0294 39.0294 7 44 7H48C52.4183 7 56 10.5817 56 15V23C56 29.0751 51.0751 34 45 34H37.5C36.1193 34 35 32.8807 35 31.5V16Z"
          fill="#7C3AED"
        />
        {/* Bottom-left clover bubble */}
        <path
          d="M8 38C8 33.5817 11.5817 30 16 30H26.5C27.8807 30 29 31.1193 29 32.5V48C29 52.4183 25.4183 56 21 56H15C11.134 56 8 52.866 8 49V38Z"
          fill="#6D28D9"
        />
        {/* Bottom-right clover bubble */}
        <path
          d="M31 37.5C31 36.1193 32.1193 35 33.5 35H47C51.9706 35 56 39.0294 56 44V49C56 52.866 52.866 56 49 56H39C34.5817 56 31 52.4183 31 48V37.5Z"
          fill="#7C3AED"
        />
        {/* Center rounded-square bridge holding bold brand letter */}
        <rect x="22" y="22" width="20" height="20" rx="6" fill="#6D28D9" />
        <text
          x="32"
          y="37"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="Plus Jakarta Sans, Inter, system-ui, sans-serif"
          fontWeight="900"
          fontSize="16"
        >
          {initial}
        </text>
      </svg>
    </span>
  );
}
