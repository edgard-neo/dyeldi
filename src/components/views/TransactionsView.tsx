import React, { useState, useMemo } from 'react';
import { UserTransaction, TransactionType, PortfolioSummaryItem, StockQuote } from '../../types';
import TransactionsTab from '../portfolio/TransactionsTab';
import { formatBRL, formatBRLDecimal, formatQuantity } from '../../utils/calculator';
import { isStockTicker, isCryptoTicker } from '../../utils/assetType';
import { FileText, Plus, Zap, ArrowUpRight, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

interface TransactionsViewProps {
  transactions: UserTransaction[];
  summaryItems?: PortfolioSummaryItem[];
  quotes?: Record<string, StockQuote>;
  preferredLayout?: 'CARDS' | 'TABLE';
  onUpdatePreferredLayout?: (layout: 'CARDS' | 'TABLE') => void;
  setEditingTx: (tx: UserTransaction | Partial<UserTransaction> | null) => void;
  setDefaultTickerForModal: (ticker: string) => void;
  setDefaultModalType?: (type: 'COMPRA' | 'VENDA' | 'PROVENTO') => void;
  setIsModalOpen: (isOpen: boolean) => void;
  handleDeleteTransaction: (id: string) => Promise<void>;
}

export function TransactionsView({
  transactions,
  summaryItems = [],
  quotes = {},
  preferredLayout,
  onUpdatePreferredLayout,
  setEditingTx,
  setDefaultTickerForModal,
  setDefaultModalType,
  setIsModalOpen,
  handleDeleteTransaction,
}: TransactionsViewProps) {
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'TODOS' | TransactionType>('TODOS');

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
            <span>Lançamentos</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Histórico completo de compras, vendas, depósitos e proventos lançados na sua carteira.
          </p>
        </div>
      </div>

      {/* Main Transactions List / Table */}
      <TransactionsTab
        transactions={transactions}
        txSearch={txSearch}
        setTxSearch={setTxSearch}
        txTypeFilter={txTypeFilter}
        setTxTypeFilter={setTxTypeFilter}
        preferredLayout={preferredLayout}
        onUpdatePreferredLayout={onUpdatePreferredLayout}
        setEditingTx={setEditingTx}
        setDefaultTickerForModal={setDefaultTickerForModal}
        setDefaultModalType={setDefaultModalType}
        setIsModalOpen={setIsModalOpen}
        handleDeleteTransaction={handleDeleteTransaction}
      />
    </div>
  );
};

export default TransactionsView;
