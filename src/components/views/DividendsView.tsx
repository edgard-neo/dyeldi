import React from 'react';
import {
  MonthlyDividendData,
  PortfolioSummaryItem,
  UserTransaction,
} from '../../types';
import DividendsTab from '../portfolio/DividendsTab';
import { PiggyBank, Plus, Sparkles, DollarSign } from 'lucide-react';

interface DividendsViewProps {
  monthlyDividends: MonthlyDividendData[];
  items: PortfolioSummaryItem[];
  transactions: UserTransaction[];
  preferredLayout?: 'CARDS' | 'TABLE';
  onUpdatePreferredLayout?: (layout: 'CARDS' | 'TABLE') => void;
  onOpenDividendModal: () => void;
  onOpenSpecificDividendModal: (ticker: string) => void;
}

export const DividendsView: React.FC<DividendsViewProps> = ({
  monthlyDividends,
  items,
  transactions,
  preferredLayout,
  onUpdatePreferredLayout,
  onOpenDividendModal,
  onOpenSpecificDividendModal,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <PiggyBank className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
            <span>Dividendos</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Acompanhamento e evolução dos dividendos e rendimentos recebidos da sua carteira.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenDividendModal}
          className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
          <span>Lançar Dividendo</span>
        </button>
      </div>

      {/* Main Dividends Engine */}
      <DividendsTab
        monthlyDividends={monthlyDividends}
        items={items}
        transactions={transactions}
        preferredLayout={preferredLayout}
        onUpdatePreferredLayout={onUpdatePreferredLayout}
        onOpenDividendModal={onOpenDividendModal}
        onOpenSpecificDividendModal={onOpenSpecificDividendModal}
      />
    </div>
  );
};

export default DividendsView;
