import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Scale,
  PiggyBank,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { NavigationTab } from '../../types';

interface MobileBottomNavProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenMoreDrawer: () => void;
  isMoreOpen?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenMoreDrawer,
  isMoreOpen = false,
}) => {
  // Active if selected tab is part of Análise (dividends, diagnosis, simulator) or Account
  const isAnalysisActive = [
    'dividends',
    'diagnosis',
    'simulator',
    'profile',
    'settings',
  ].includes(currentTab);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl border-t border-black/[0.06] dark:border-white/[0.08] px-1 py-1 flex items-center justify-around shadow-2xl transition-colors">
      {/* 1. Visão Geral */}
      <button
        type="button"
        onClick={() => onSelectTab('overview')}
        className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-xl transition cursor-pointer min-h-[48px] ${
          currentTab === 'overview'
            ? 'text-zinc-950 dark:text-white font-extrabold bg-zinc-100 dark:bg-[#18181b] border border-black/[0.06] dark:border-white/[0.08] shadow-xs'
            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium'
        }`}
      >
        <LayoutDashboard
          className={`w-4 h-4 ${
            currentTab === 'overview'
              ? 'text-emerald-500'
              : 'text-zinc-400 dark:text-zinc-500'
          }`}
        />
        <span className="text-xs tracking-tight truncate max-w-[68px]">Visão geral</span>
      </button>

      {/* 2. Lançamentos */}
      <button
        type="button"
        onClick={() => onSelectTab('transactions')}
        className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-xl transition cursor-pointer min-h-[48px] ${
          currentTab === 'transactions'
            ? 'text-zinc-950 dark:text-white font-extrabold bg-zinc-100 dark:bg-[#18181b] border border-black/[0.06] dark:border-white/[0.08] shadow-xs'
            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium'
        }`}
      >
        <FileText
          className={`w-4 h-4 ${
            currentTab === 'transactions'
              ? 'text-emerald-500'
              : 'text-zinc-400 dark:text-zinc-500'
          }`}
        />
        <span className="text-xs tracking-tight truncate max-w-[68px]">Lançamentos</span>
      </button>

      {/* 3. Carteira */}
      <button
        type="button"
        onClick={() => onSelectTab('positions')}
        className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-xl transition cursor-pointer min-h-[48px] ${
          currentTab === 'positions'
            ? 'text-zinc-950 dark:text-white font-extrabold bg-zinc-100 dark:bg-[#18181b] border border-black/[0.06] dark:border-white/[0.08] shadow-xs'
            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium'
        }`}
      >
        <TrendingUp
          className={`w-4 h-4 ${
            currentTab === 'positions'
              ? 'text-emerald-500'
              : 'text-zinc-400 dark:text-zinc-500'
          }`}
        />
        <span className="text-xs tracking-tight truncate max-w-[68px]">Carteira</span>
      </button>

      {/* 4. Rebalancear */}
      <button
        type="button"
        onClick={() => onSelectTab('rebalance')}
        className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-xl transition cursor-pointer min-h-[48px] ${
          currentTab === 'rebalance'
            ? 'text-zinc-950 dark:text-white font-extrabold bg-zinc-100 dark:bg-[#18181b] border border-black/[0.06] dark:border-white/[0.08] shadow-xs'
            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium'
        }`}
      >
        <Scale
          className={`w-4 h-4 ${
            currentTab === 'rebalance'
              ? 'text-emerald-500'
              : 'text-zinc-400 dark:text-zinc-500'
          }`}
        />
        <span className="text-xs tracking-tight truncate max-w-[68px]">Rebalancear</span>
      </button>

      {/* 5. Análise (Submenu Drawer) */}
      <button
        type="button"
        onClick={onOpenMoreDrawer}
        className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-xl transition cursor-pointer min-h-[48px] relative ${
          isAnalysisActive || isMoreOpen
            ? 'text-zinc-950 dark:text-white font-extrabold bg-zinc-100 dark:bg-[#18181b] border border-black/[0.06] dark:border-white/[0.08] shadow-xs'
            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium'
        }`}
      >
        <div className="relative">
          <BarChart3
            className={`w-4 h-4 ${
              isAnalysisActive || isMoreOpen
                ? 'text-emerald-500'
                : 'text-zinc-400 dark:text-zinc-500'
            }`}
          />
          {isAnalysisActive && (
            <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </div>
        <span className="text-xs tracking-tight truncate max-w-[68px]">Análise</span>
      </button>
    </div>
  );
};

export default MobileBottomNav;
