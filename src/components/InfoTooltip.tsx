import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface InfoTooltipProps {
  title: string;
  description: string;
  example?: string;
  className?: string;
}

export default function InfoTooltip({
  title,
  description,
  example,
  className = '',
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placement: 'top' | 'bottom';
    arrowLeft: number;
  }>({ top: 0, left: 0, placement: 'top', arrowLeft: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const placement = rect.top < 180 ? 'bottom' : 'top';
      const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;
      
      const tooltipWidth = 288; // max w-72 (18rem = 288px)
      const padding = 16;
      const windowWidth = window.innerWidth;

      // Default: center on button
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;

      // Clamp to viewport
      if (left < padding) {
        left = padding;
      } else if (left + tooltipWidth > windowWidth - padding) {
        left = windowWidth - padding - tooltipWidth;
      }

      const buttonCenter = rect.left + rect.width / 2;
      const arrowLeft = buttonCenter - left;

      setCoords({ top, left, placement, arrowLeft });
    }
  };

  useEffect(() => {
    const handleUpdate = () => updatePosition();
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', handleUpdate);
      window.addEventListener('scroll', handleUpdate, true);
    }
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isOpen]);

  return (
    <div
      className={`relative inline-flex items-center shrink-0 ${className}`}
      ref={containerRef}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const nextState = !isOpen;
          setIsOpen(nextState);
          if (nextState) updatePosition();
        }}
        onMouseEnter={() => {
          setIsOpen(true);
          updatePosition();
        }}
        className="w-4 h-4 rounded-full bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 font-bold text-[10px] flex items-center justify-center transition cursor-pointer border border-slate-200/80 shrink-0 ml-1 shadow-2xs"
        aria-label={`Explicação sobre ${title}`}
        title={title}
      >
        ?
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: '288px',
            transform: coords.placement === 'top' ? 'translateY(-100%)' : 'none',
            zIndex: 99999,
          }}
          className="p-3 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 text-xs leading-relaxed pointer-events-auto"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Arrow */}
          <div
            style={{ left: `${Math.max(16, Math.min(272, coords.arrowLeft))}px` }}
            className={`absolute -translate-x-1/2 border-4 border-transparent ${
              coords.placement === 'top'
                ? 'top-full border-t-slate-900 -mt-[1px]'
                : 'bottom-full border-b-slate-900 -mb-[1px]'
            }`}
          />

          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
            <span className="font-extrabold text-indigo-300 text-[11px] uppercase tracking-wider flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
              {title}
            </span>
          </div>

          <p className="text-slate-200 text-[11px] font-normal leading-normal">{description}</p>

          {example && (
            <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-indigo-200/90 font-medium bg-slate-950/60 p-1.5 rounded-lg">
              <strong className="text-indigo-400">💡 Na prática: </strong>
              {example}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
