import React from 'react';
import {
  PortfolioSummaryItem,
  StockQuote,
  UserTransaction,
  TransactionType,
} from '../../types';
import PositionsTab from '../portfolio/PositionsTab';
import { Plus, RefreshCw, TrendingUp } from 'lucide-react';
import { formatBRL } from '../../utils/calculator';
import { InvestorProfileType } from '../../hooks/useUserProfile';

interface PositionsViewProps {
  summaryItems: PortfolioSummaryItem[];
  quotes: Record<string, StockQuote>;
  loadingData: boolean;
  loadingQuotes: boolean;
  isRefreshingAllQuotes: boolean;
  isSeedingSample: boolean;
  refreshingTickers: Record<string, boolean>;
  pieData: { name: string; value: number }[];
  COLORS: string[];
  totalCurrentPortfolioValue: number;
  investorProfile?: InvestorProfileType;
  preferredLayout?: 'CARDS' | 'TABLE';
  onUpdatePreferredLayout?: (layout: 'CARDS' | 'TABLE') => void;
  handleRefreshAllQuotes: () => Promise<void>;
  handleRefreshSingleQuote: (ticker: string) => Promise<void>;
  handleSeedSamplePortfolio: () => Promise<void>;
  onToggleFavorite?: (ticker: string) => Promise<void>;
  setDefaultTickerForModal: (ticker: string) => void;
  setDefaultModalType?: (type: TransactionType) => void;
  setEditingTx: (tx: UserTransaction | Partial<UserTransaction> | null) => void;
  setIsModalOpen: (isOpen: boolean) => void;
  isQuoteOutdated: (dateString?: string) => boolean;
  getOutdatedReason: (dateString?: string, isFallback?: boolean) => string;
  formatTimeAgo: (dateString?: string) => string;
}

export const PositionsView: React.FC<PositionsViewProps> = ({
  summaryItems,
  quotes,
  loadingData,
  loadingQuotes,
  isRefreshingAllQuotes,
  isSeedingSample,
  refreshingTickers,
  pieData,
  COLORS,
  totalCurrentPortfolioValue,
  investorProfile = 'ALL',
  preferredLayout,
  onUpdatePreferredLayout,
  handleRefreshAllQuotes,
  handleRefreshSingleQuote,
  handleSeedSamplePortfolio,
  onToggleFavorite,
  setDefaultTickerForModal,
  setDefaultModalType,
  setEditingTx,
  setIsModalOpen,
  isQuoteOutdated,
  getOutdatedReason,
  formatTimeAgo,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header Controls */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
            <span>Carteira</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {summaryItems.length} ativos em custódia • Patrimônio total de{' '}
            <strong className="text-zinc-800 dark:text-zinc-200 font-mono font-bold">
              {formatBRL(totalCurrentPortfolioValue)}
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRefreshAllQuotes}
            disabled={isRefreshingAllQuotes}
            className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-black/[0.06] dark:border-white/[0.08] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isRefreshingAllQuotes ? 'animate-spin text-emerald-500' : ''
              }`}
            />
            <span>{isRefreshingAllQuotes ? 'Atualizando...' : 'Cotações B3'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingTx(null);
              setDefaultTickerForModal('');
              setDefaultModalType?.('COMPRA');
              setIsModalOpen(true);
            }}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
            <span>Novo Ativo</span>
          </button>
        </div>
      </div>

      {/* Main Content: PositionsTab */}
      <PositionsTab
        summaryItems={summaryItems}
        quotes={quotes}
        loadingData={loadingData}
        loadingQuotes={loadingQuotes}
        isRefreshingAllQuotes={isRefreshingAllQuotes}
        isSeedingSample={isSeedingSample}
        refreshingTickers={refreshingTickers}
        pieData={pieData}
        COLORS={COLORS}
        totalCurrentPortfolioValue={totalCurrentPortfolioValue}
        investorProfile={investorProfile}
        preferredLayout={preferredLayout}
        onUpdatePreferredLayout={onUpdatePreferredLayout}
        handleRefreshAllQuotes={handleRefreshAllQuotes}
        handleRefreshSingleQuote={handleRefreshSingleQuote}
        handleSeedSamplePortfolio={handleSeedSamplePortfolio}
        onToggleFavorite={onToggleFavorite}
        setDefaultTickerForModal={setDefaultTickerForModal}
        setDefaultModalType={setDefaultModalType}
        setEditingTx={setEditingTx}
        setIsModalOpen={setIsModalOpen}
        isQuoteOutdated={isQuoteOutdated}
        getOutdatedReason={getOutdatedReason}
        formatTimeAgo={formatTimeAgo}
      />
    </div>
  );
};

export default PositionsView;
