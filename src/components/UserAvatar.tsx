import { useState } from 'react';
import { User } from 'lucide-react';
import { getUserInitials, normalizeUserAvatar } from '../utils/nameFormatter';

interface UserAvatarProps {
  picture?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnlineDot?: boolean;
  hasDiamondBorder?: boolean;
}

const SIZE_MAP = {
  xs: {
    container: 'w-7 h-7 rounded-lg text-[10px]',
    icon: 'w-4 h-4',
    dot: 'w-2 h-2 -bottom-0.5 -right-0.5',
  },
  sm: {
    container: 'w-8 h-8 rounded-xl text-xs',
    icon: 'w-4 h-4',
    dot: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5',
  },
  md: {
    container: 'w-10 h-10 rounded-2xl text-sm',
    icon: 'w-5 h-5',
    dot: 'w-3 h-3 -bottom-1 -right-1',
  },
  lg: {
    container: 'w-12 h-12 rounded-2xl text-base',
    icon: 'w-6 h-6',
    dot: 'w-3.5 h-3.5 -bottom-1 -right-1 border-2',
  },
  xl: {
    container: 'w-16 h-16 rounded-3xl text-xl',
    icon: 'w-8 h-8',
    dot: 'w-4 h-4 -bottom-1 -right-1 border-2',
  },
};

export function UserAvatar({
  picture,
  name,
  size = 'md',
  className = '',
  showOnlineDot = false,
  hasDiamondBorder = false,
}: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  // Normalize any corrupted URLs that contain emoji paths
  const cleanPicture = normalizeUserAvatar(picture);
  const imgFailed = cleanPicture ? failedUrl === cleanPicture : false;

  const config = SIZE_MAP[size] || SIZE_MAP.md;
  const isUrl = cleanPicture && (cleanPicture.startsWith('http') || cleanPicture.startsWith('data:'));
  const initials = getUserInitials(name);

  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 select-none ${
        hasDiamondBorder
          ? 'p-0.5 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-sm shadow-indigo-500/40 ring-2 ring-indigo-400/50 animate-pulse-subtle'
          : ''
      } ${className}`}
    >
      <div
        className={`${config.container} overflow-hidden flex items-center justify-center transition-transform shadow-2xs font-bold ${
          isUrl && !imgFailed
            ? 'bg-slate-100 border border-slate-200/80'
            : cleanPicture && !isUrl
            ? 'bg-white border border-slate-200/80'
            : 'bg-gradient-to-tr from-brand-600 via-indigo-600 to-emerald-500 text-white border border-white/20'
        }`}
      >
        {isUrl && !imgFailed ? (
          <img
            src={cleanPicture}
            alt={name || 'Avatar'}
            onError={() => setFailedUrl(cleanPicture)}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : cleanPicture && !isUrl ? (
          <span className="leading-none">{cleanPicture}</span>
        ) : initials && initials !== 'U' ? (
          <span className="leading-none tracking-tight font-black">{initials}</span>
        ) : (
          <User className={`${config.icon} text-white/90`} />
        )}
      </div>

      {showOnlineDot && (
        <span
          className={`absolute ${config.dot} rounded-full bg-emerald-500 border border-white shadow-xs animate-pulse-subtle`}
          title="Online & Synced"
        />
      )}
    </div>
  );
}
