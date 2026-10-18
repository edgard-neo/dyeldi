import React from 'react';

export interface DyeldiLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark' | 'compact';
  badge?: 'crypto+stocks' | 'b3' | 'none';
  showGlow?: boolean;
  className?: string;
  onClick?: () => void;
}

export type YieldixLogoProps = DyeldiLogoProps;

export const DyeldiLogo: React.FC<DyeldiLogoProps> = ({
  size = 'md',
  variant = 'full',
  badge = 'none',
  showGlow = true,
  className = '',
  onClick,
}) => {
  // Dimensions based on size prop
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-sm tracking-[0.14em]',
    md: 'text-base tracking-[0.16em]',
    lg: 'text-xl tracking-[0.18em]',
    xl: 'text-2xl tracking-[0.2em]',
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 select-none group ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Geometric Mark Container */}
      <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center`}>
        {/* Subtle Ambient Glow */}
        {showGlow && (
          <div
            className="absolute -inset-1 bg-gradient-to-tr from-emerald-500/25 via-teal-500/20 to-indigo-500/20 rounded-xl blur-sm opacity-70 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Monolithic Geometric SVG - Dyeldi D-Yield Mark (Solid geometric shapes, high legibility) */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
        >
          <defs>
            <linearGradient id="dyeldi_emerald_grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="60%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="dyeldi_indigo_grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3730a3" />
              <stop offset="50%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>

          {/* Base Background Plate */}
          <rect
            width="32"
            height="32"
            rx="8"
            className="fill-[#0f0f11] dark:fill-[#09090b] stroke-white/[0.12] dark:stroke-white/[0.08]"
            strokeWidth="1"
          />

          {/* Pilar Esquerdo da Letra D (Estrutura & Solidez) */}
          <rect x="6.5" y="6" width="4.5" height="20" rx="2.25" fill="url(#dyeldi_indigo_grad)" />

          {/* Topo da Letra D */}
          <path
            d="M9 6H17C21.42 6 25 9.58 25 14C25 15.3 24.69 16.53 24.13 17.62L20.45 15.35C20.8 14.94 21 14.49 21 14C21 11.79 19.21 10 17 10H9V6Z"
            fill="url(#dyeldi_indigo_grad)"
          />

          {/* Base da Letra D */}
          <path
            d="M9 22H16.5C18.99 22 21 20 21 17.5C21 16.9 20.88 16.33 20.66 15.81L24.36 13.54C24.77 14.74 25 16.05 25 17.5C25 22.19 21.19 26 16.5 26H9V22Z"
            fill="url(#dyeldi_emerald_grad)"
          />

          {/* Vetor Dinâmico de Yield & Proventos */}
          <path
            d="M13.5 17.5L19.2 9.2C19.5 8.7 20.1 8.5 20.6 8.5H23.8C24.6 8.5 25.1 9.3 24.8 10.1L23.2 13.8C22.9 14.5 22.2 15 21.4 15H17.8L13.5 17.5Z"
            fill="url(#dyeldi_emerald_grad)"
          />

          {/* Ápice Sólido da Seta de Crescimento */}
          <polygon points="19.5,5.5 25.5,5.5 25.5,11.5" fill="#34d399" />
        </svg>
      </div>

      {/* Typography Lockup */}
      {variant !== 'mark' && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-2">
            <span
              className={`font-black text-slate-900 dark:text-white ${textSizes[size]} transition-colors`}
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                textShadow: '0 1px 2px rgba(0,0,0,0.2)',
              }}
            >
              DYELDI
            </span>

            {/* Optional Badges */}
            {badge === 'crypto+stocks' && (
              <span className="px-1.5 py-0.5 rounded text-xs font-mono font-semibold tracking-normal bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                AÇÕES & CRYPTO
              </span>
            )}
            {badge === 'b3' && (
              <span className="px-1.5 py-0.5 rounded text-xs font-mono font-semibold tracking-normal bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                B3 + CRYPTO
              </span>
            )}
          </div>

          {variant === 'full' && (
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium tracking-tight">
              Ações, FIIs & Criptoativos
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Aliases for seamless component exports
export const YieldixLogo = DyeldiLogo;
export const RiseLogo = DyeldiLogo;
export default DyeldiLogo;
