import { useEffect, useState } from 'react';

interface UserAvatarProps {
  name?: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showOrdersBadge?: boolean;
  ordersCount?: number;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-14 h-14',
  '2xl': 'w-20 h-20',
};

const BADGE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  sm: 'min-w-[16px] h-[16px] text-[9px] -bottom-0.5 -right-0.5',
  md: 'min-w-[20px] h-[20px] text-[10px] -bottom-0.5 -right-0.5',
  lg: 'min-w-[22px] h-[22px] text-[11px] -bottom-1 -right-1',
  xl: 'min-w-[24px] h-[24px] text-xs -bottom-1 -right-1',
  '2xl': 'min-w-[26px] h-[26px] text-xs -bottom-1 -right-1',
};

export function UserAvatar({
  name = 'User',
  avatarUrl,
  size = 'md',
  showOrdersBadge = false,
  ordersCount = 0,
  className = '',
}: UserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  const badgeText = ordersCount > 99 ? '99+' : String(Math.max(0, ordersCount));

  return (
    <div className={`relative inline-flex shrink-0 ${SIZE_CLASSES[size]} ${className}`}>
      <div className="w-full h-full rounded-full ring-2 ring-blue-600 dark:ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 bg-[#DCE4F0] dark:bg-slate-800 overflow-hidden flex items-center justify-center shadow-xs">
        {avatarUrl && !imgFailed ? (
          <img
            src={avatarUrl}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover object-center block"
          />
        ) : (
          <svg
            viewBox="0 0 80 80"
            className="w-full h-full block"
            xmlns="http://www.w3.org/2000/svg"
            aria-label={name}
          >
            <defs>
              <radialGradient id="avatarStudioBg" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#EBF0F7" />
                <stop offset="100%" stopColor="#CFD8E8" />
              </radialGradient>
              <linearGradient id="avatarSkin" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#E2B296" />
                <stop offset="100%" stopColor="#CC9577" />
              </linearGradient>
              <linearGradient id="avatarJacket" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F4B740" />
                <stop offset="100%" stopColor="#D48B14" />
              </linearGradient>
              <linearGradient id="avatarHair" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3B3A39" />
                <stop offset="100%" stopColor="#1F1F21" />
              </linearGradient>
            </defs>

            {/* Studio circular backdrop */}
            <rect width="80" height="80" fill="url(#avatarStudioBg)" />

            {/* Shoulders & Jacket */}
            <path
              d="M14 82C15.5 64 26 57 40 57C54 57 64.5 64 66 82H14Z"
              fill="url(#avatarJacket)"
            />
            {/* Crisp White Tee / Underlayer */}
            <path d="M31 58L40 67L49 58H31Z" fill="#FFFFFF" />
            {/* Blue Collared Shirt Accent */}
            <path d="M35 59L40 74L45 59H35Z" fill="#2563EB" />
            <path d="M29 58L34 64L37 58H29Z" fill="#EFF6FF" />
            <path d="M51 58L46 64L43 58H51Z" fill="#EFF6FF" />

            {/* Neck */}
            <rect x="35.5" y="48" width="9" height="12" rx="4.5" fill="#C4896B" />

            {/* Ears */}
            <circle cx="24" cy="36" r="4.2" fill="#CE977A" />
            <circle cx="56" cy="36" r="4.2" fill="#CE977A" />

            {/* Face */}
            <rect x="25" y="18" width="30" height="34" rx="14" fill="url(#avatarSkin)" />

            {/* Hair */}
            <path
              d="M24 31C23.5 21 30 13 40.5 13C50.5 13 56.5 20 56 30.5C54.5 24 50 21.5 44 22C37 22.5 31.5 22 28.5 24.5C26 26.5 24.8 29 24 31Z"
              fill="url(#avatarHair)"
            />
            <path
              d="M30 16.5C34 13.5 41 13 46.5 15.5C43 17.5 36.5 18 30 16.5Z"
              fill="#52525B"
              opacity="0.45"
            />

            {/* Eyebrows */}
            <path
              d="M30.5 29.5C32 28.5 34.5 28.5 36 29.2"
              stroke="#27272A"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <path
              d="M44 29.2C45.5 28.5 48 28.5 49.5 29.5"
              stroke="#27272A"
              strokeWidth="1.9"
              strokeLinecap="round"
            />

            {/* Eyes */}
            <ellipse cx="33.5" cy="34" rx="2.1" ry="2.4" fill="#18181B" />
            <ellipse cx="46.5" cy="34" rx="2.1" ry="2.4" fill="#18181B" />
            <circle cx="34.2" cy="33.2" r="0.7" fill="#FFFFFF" />
            <circle cx="47.2" cy="33.2" r="0.7" fill="#FFFFFF" />

            {/* Soft 3D nose */}
            <path
              d="M39.5 34.5V39.5C39.5 40.5 41 40.8 41.5 39.8"
              stroke="#B4785B"
              strokeWidth="1.6"
              strokeLinecap="round"
            />

            {/* Warm Smile */}
            <path
              d="M35.5 44C37.8 46.2 42.2 46.2 44.5 44"
              stroke="#8C4A3B"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {showOrdersBadge && (
        <span
          className={`absolute ${BADGE_CLASSES[size]} px-1 rounded-full bg-[#FEF3C7] text-[#78350F] font-extrabold flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs tabular-nums`}
          title={`${ordersCount} total orders`}
        >
          {badgeText}
        </span>
      )}
    </div>
  );
}
