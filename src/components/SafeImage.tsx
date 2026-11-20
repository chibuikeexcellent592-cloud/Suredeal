import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { resolveApiUrl } from '../lib/api';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  smartFit?: boolean;
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackTitle,
  smartFit = false,
}: SafeImageProps) {
  const resolvedSrc = resolveApiUrl(src);
  const [failed, setFailed] = useState(false);
  const [isSquareLike, setIsSquareLike] = useState(false);

  useEffect(() => {
    setFailed(false);
    setIsSquareLike(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 text-slate-500 dark:text-slate-400 p-6 ${className}`}
        role="img"
        aria-label={alt}
      >
        <ShieldCheck className="w-8 h-8 mb-2 text-blue-600/70 dark:text-blue-400/70" />
        <span className="text-xs font-medium text-center line-clamp-2">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  const resolvedClassName =
    smartFit && isSquareLike
      ? 'w-full h-full object-contain p-3 bg-slate-50 dark:bg-slate-800/80'
      : className;

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onLoad={(e) => {
        if (!smartFit) return;
        const { naturalWidth, naturalHeight } = e.currentTarget;
        if (naturalWidth > 0 && naturalHeight > 0) {
          const ratio = naturalWidth / naturalHeight;
          setIsSquareLike(Math.abs(ratio - 1) <= 0.25);
        }
      }}
      onError={() => setFailed(true)}
      className={resolvedClassName}
    />
  );
}
