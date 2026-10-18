import React from 'react';
import { PortfolioSummaryItem, StockQuote, UserTransaction } from '../../types';
import { InvestorProfileType, ClassAllocations } from '../../hooks/useUserProfile';
import RebalanceTab from '../portfolio/RebalanceTab';
import { Scale } from 'lucide-react';

interface RebalanceViewProps {
  items: PortfolioSummaryItem[];
  quotes: Record<string, StockQuote>;
  transactions?: UserTransaction[];
  investorProfile?: InvestorProfileType;
  classAllocations?: ClassAllocations;
  onUpdateClassAllocations?: (allocations: ClassAllocations) => void;
  preferredLayout?: 'CARDS' | 'TABLE';
  onUpdatePreferredLayout?: (layout: 'CARDS' | 'TABLE') => void;
  onUpdateTargetPercent: (ticker: string, percent: number) => Promise<void>;
  onOpenNotificationModal?: () => void;
  onToggleFavorite?: (ticker: string) => Promise<void>;
  onRefreshQuote?: (ticker: string) => Promise<void>;
  refreshingTickers?: Record<string, boolean>;
  setDefaultTickerForModal: (ticker: string) => void;
  setDefaultModalType?: (type: 'COMPRA' | 'VENDA' | 'PROVENTO' | 'DEPOSITO' | 'RETIRADA') => void;
  setEditingTx: (tx: UserTransaction | Partial<UserTransaction> | null) => void;
  setIsModalOpen: (isOpen: boolean) => void;
}

export const RebalanceView: React.FC<RebalanceViewProps> = ({
  items,
  quotes,
  transactions = [],
  investorProfile = 'ALL',
  classAllocations,
  onUpdateClassAllocations,
  preferredLayout,
  onUpdatePreferredLayout,
  onUpdateTargetPercent,
  onOpenNotificationModal,
  onToggleFavorite,
  onRefreshQuote,
  refreshingTickers,
  setDefaultTickerForModal,
  setDefaultModalType,
  setEditingTx,
  setIsModalOpen,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
            <span>Rebalancear</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Defina as metas da sua carteira para descobrir onde fazer os próximos aportes com base no seu saldo em caixa.
          </p>
        </div>
      </div>

      {/* Main Rebalance Engine */}
      <RebalanceTab
        items={items}
        quotes={quotes}
        transactions={transactions}
        investorProfile={investorProfile}
        classAllocations={classAllocations}
        onUpdateClassAllocations={onUpdateClassAllocations}
        preferredLayout={preferredLayout}
        onUpdatePreferredLayout={onUpdatePreferredLayout}
        onUpdateTargetPercent={onUpdateTargetPercent}
        onOpenNotificationModal={onOpenNotificationModal}
        onToggleFavorite={onToggleFavorite}
        onRefreshQuote={onRefreshQuote}
        refreshingTickers={refreshingTickers}
        setDefaultTickerForModal={setDefaultTickerForModal}
        setDefaultModalType={setDefaultModalType}
        setEditingTx={setEditingTx}
        setIsModalOpen={setIsModalOpen}
      />
    </div>
  );
};

export default RebalanceView;
