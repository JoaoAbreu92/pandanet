import React from 'react';

interface UserAvatarProps {
  src?: string;
  name?: string;
  level?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name = 'Usuário',
  level = 1,
  size = 'md',
  className = '',
}) => {
  // Configurações de tamanho do avatar
  const sizeClasses = {
    xs: 'w-8 h-8 text-xs',
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  };

  // Espessura do anel dependendo do tamanho
  const ringPadding = {
    xs: 'p-[1.5px]',
    sm: 'p-[2px]',
    md: 'p-[2.5px]',
    lg: 'p-[3px]',
    xl: 'p-[4px]',
  };

  // Badge de nível posicionamento e tamanho
  const badgeClasses = {
    xs: 'w-3.5 h-3.5 text-[8px] -bottom-0.5 -right-0.5 border',
    sm: 'w-4 h-4 text-[9px] -bottom-0.5 -right-0.5 border',
    md: 'w-5 h-5 text-[10px] -bottom-0.5 -right-0.5 border-2',
    lg: 'w-6 h-6 text-[11px] -bottom-1 -right-1 border-2',
    xl: 'w-7 h-7 text-[13px] -bottom-1 -right-1 border-2',
  };

  // Gradientes CSS de acordo com o nível (1 a 5+)
  let ringBg = '';
  let ringAnim = '';
  let badgeBg = 'bg-slate-500';

  if (level >= 5) {
    // Lendário: Gradiente roxo-rosa-neon com pulso
    ringBg = 'bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-400';
    ringAnim = 'animate-pulse shadow-[0_0_10px_rgba(236,72,153,0.6)]';
    badgeBg = 'bg-gradient-to-r from-pink-500 to-purple-600';
  } else if (level === 4) {
    // Ouro
    ringBg = 'bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-300';
    badgeBg = 'bg-amber-500';
  } else if (level === 3) {
    // Prata
    ringBg = 'bg-gradient-to-tr from-slate-400 via-zinc-200 to-slate-300';
    badgeBg = 'bg-zinc-400';
  } else if (level === 2) {
    // Bronze
    ringBg = 'bg-gradient-to-tr from-amber-800 via-orange-500 to-amber-700';
    badgeBg = 'bg-orange-700';
  }

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name
  )}&background=random&color=fff`;

  const avatarSrc = src || defaultAvatar;

  const renderInnerAvatar = () => (
    <div className={`w-full h-full rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200`}>
      {src ? (
        <img
          src={avatarSrc}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = defaultAvatar;
          }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );

  // Se nível for 1, renderiza sem anel
  if (level <= 1) {
    return (
      <div className={`relative inline-block select-none ${sizeClasses[size]} ${className}`}>
        {renderInnerAvatar()}
      </div>
    );
  }

  return (
    <div className={`relative inline-block select-none ${className}`}>
      {/* Anel Externo Colorido */}
      <div className={`rounded-full ${sizeClasses[size]} ${ringBg} ${ringAnim} ${ringPadding[size]} flex items-center justify-center`}>
        <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 p-[1px] flex items-center justify-center">
          {renderInnerAvatar()}
        </div>
      </div>

      {/* Badge de Nível */}
      <div
        className={`absolute rounded-full flex items-center justify-center font-extrabold text-white border-white dark:border-slate-950 ${badgeClasses[size]} ${badgeBg} shadow-md`}
        title={`Nível ${level}`}
      >
        {level}
      </div>
    </div>
  );
};
