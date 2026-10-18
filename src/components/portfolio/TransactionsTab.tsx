import React, { useState, useMemo, useEffect } from 'react';
import {
  Briefcase,
  Download,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  ArrowUpDown,
  Calendar,
  LayoutGrid,
  Table as TableIcon,
  Filter,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  FileSpreadsheet,
  Wallet,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UserTransaction } from '../../types';
import { formatBRL, formatBRLDecimal } from '../../utils/calculator';
import InfoTooltip from '../InfoTooltip';

interface TransactionsTabProps {
  transactions: UserTransaction[];
  txSearch: string;
  setTxSearch: (search: string) => void;
  txTypeFilter: 'TODOS' | 'COMPRA' | 'VENDA' | 'PROVENTO' | 'DEPOSITO' | 'RETIRADA';
  setTxTypeFilter: (type: 'TODOS' | 'COMPRA' | 'VENDA' | 'PROVENTO' | 'DEPOSITO' | 'RETIRADA') => void;
  preferredLayout?: 'CARDS' | 'TABLE';
  onUpdatePreferredLayout?: (layout: 'CARDS' | 'TABLE') => void;
  setEditingTx: (tx: UserTransaction | null) => void;
  setDefaultTickerForModal: (ticker: string) => void;
  setDefaultModalType: (type: 'COMPRA' | 'VENDA' | 'PROVENTO' | 'DEPOSITO' | 'RETIRADA') => void;
  setIsModalOpen: (isOpen: boolean) => void;
  handleDeleteTransaction: (id: string) => Promise<void>;
}

export default function TransactionsTab({
  transactions,
  txSearch,
  setTxSearch,
  txTypeFilter,
  setTxTypeFilter,
  preferredLayout,
  onUpdatePreferredLayout,
  setEditingTx,
  setDefaultTickerForModal,
  setDefaultModalType,
  setIsModalOpen,
  handleDeleteTransaction,
}: TransactionsTabProps) {
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvContentState, setCsvContentState] = useState('');
  const [copied, setCopied] = useState(false);
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'VALUE_DESC' | 'VALUE_ASC' | 'TICKER_ASC'>('DATE_DESC');
  
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>(() => preferredLayout || 'TABLE');

  // Sync viewMode state when the database loads or user preference changes globally
  useEffect(() => {
    if (preferredLayout) {
      setViewMode(preferredLayout);
    }
  }, [preferredLayout]);

  const handleViewModeChange = (mode: 'TABLE' | 'CARDS') => {
    setViewMode(mode);
    if (onUpdatePreferredLayout) {
      onUpdatePreferredLayout(mode);
    }
  };
  const [isFilterMinimized, setIsFilterMinimized] = useState(true);
  
  // Confirmation state for deleting transaction
  const [txToDelete, setTxToDelete] = useState<UserTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Financial Metrics & Cash Balance
  const purchaseTxs = transactions.filter((t) => t.type === 'COMPRA');
  const sellTxs = transactions.filter((t) => t.type === 'VENDA');
  const dividendTxs = transactions.filter((t) => t.type === 'PROVENTO');
  const depositTxs = transactions.filter((t) => t.type === 'DEPOSITO');
  const withdrawalTxs = transactions.filter((t) => t.type === 'RETIRADA');

  const totalPurchases = purchaseTxs.reduce((sum, t) => sum + t.total, 0);
  const totalSales = sellTxs.reduce((sum, t) => sum + t.total, 0);
  const totalDividends = dividendTxs.reduce((sum, t) => sum + t.total, 0);
  const totalDeposits = depositTxs.reduce((sum, t) => sum + t.total, 0);
  const totalWithdrawals = withdrawalTxs.reduce((sum, t) => sum + t.total, 0);

  const cashBalance = totalDeposits - totalWithdrawals - totalPurchases + totalSales + totalDividends;
  const totalFees = transactions.reduce((sum, t) => sum + (t.fees || 0), 0);

  // Open modal with specific type pre-selected
  const handleOpenNewTransaction = (type: 'COMPRA' | 'VENDA' | 'PROVENTO' | 'DEPOSITO' | 'RETIRADA' = 'COMPRA') => {
    setEditingTx(null);
    setDefaultTickerForModal('');
    setDefaultModalType(type);
    setIsModalOpen(true);
  };

  // Export Transactions CSV
  const handleExportCSV = () => {
    if (transactions.length === 0) return;

    const headers = ['Data', 'Ticker', 'Tipo', 'Quantidade', 'Preco Unitario (R$)', 'Taxas (R$)', 'Total (R$)', 'Observacao'];
    const rows = transactions.map((t) => [
      t.date,
      t.ticker,
      t.type,
      t.quantity,
      t.price.toFixed(2),
      t.fees.toFixed(2),
      t.total.toFixed(2),
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    setCsvContentState(csvContent);
    setCopied(false);
    setShowCsvModal(true);

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dyeldi_lancamentos_operacoes_${new Date().toISOString().substring(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.warn('Silent download fail inside iframe (using copy fallback).', e);
    }
  };

  const handleCopyClipboard = () => {
    navigator.clipboard.writeText(csvContentState);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmDelete = async () => {
    if (!txToDelete) return;
    try {
      setIsDeleting(true);
      await handleDeleteTransaction(txToDelete.id);
      setTxToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir lançamento:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered & Sorted Transactions
  const processedTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        const matchesSearch =
          t.ticker.toLowerCase().includes(txSearch.toLowerCase().trim()) ||
          (t.notes && t.notes.toLowerCase().includes(txSearch.toLowerCase().trim()));
        const matchesType = txTypeFilter === 'TODOS' || t.type === txTypeFilter;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === 'DATE_DESC') {
          const timeA = new Date(a.date).getTime();
          const timeB = new Date(b.date).getTime();
          if (timeB !== timeA) return timeB - timeA;
          if (a.createdAt && b.createdAt) {
            const cA = new Date(a.createdAt).getTime();
            const cB = new Date(b.createdAt).getTime();
            if (cB !== cA) return cB - cA;
          }
          return String(b.id || '').localeCompare(String(a.id || ''));
        }
        if (sortBy === 'DATE_ASC') {
          const timeA = new Date(a.date).getTime();
          const timeB = new Date(b.date).getTime();
          if (timeA !== timeB) return timeA - timeB;
          if (a.createdAt && b.createdAt) {
            const cA = new Date(a.createdAt).getTime();
            const cB = new Date(b.createdAt).getTime();
            if (cA !== cB) return cA - cB;
          }
          return String(a.id || '').localeCompare(String(b.id || ''));
        }
        if (sortBy === 'VALUE_DESC') return b.total - a.total;
        if (sortBy === 'VALUE_ASC') return a.total - b.total;
        if (sortBy === 'TICKER_ASC') return a.ticker.localeCompare(b.ticker);
        return 0;
      });
  }, [transactions, txSearch, txTypeFilter, sortBy]);

  // Format date helper
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. SALDO EM CAIXA & FINANCIAL SUMMARY STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card de Saldo em Caixa */}
        <div className="p-4 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent dark:from-blue-500/20 dark:via-indigo-500/10 rounded-2xl border border-blue-500/20 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                Saldo em Caixa
              </span>
            </div>
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full font-semibold ${
              cashBalance >= 0 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}>
              {cashBalance >= 0 ? 'Disponível' : 'Negativo'}
            </span>
          </div>

          <div>
            <span className="text-xl sm:text-2xl font-mono font-bold text-zinc-900 dark:text-white block tabular-nums">
              {formatBRLDecimal(cashBalance)}
            </span>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Utilizado automaticamente ao comprar ações, FIIs ou cripto.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleOpenNewTransaction('DEPOSITO')}
              className="flex-1 py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Depositar
            </button>
            <button
              type="button"
              onClick={() => handleOpenNewTransaction('RETIRADA')}
              className="py-1.5 px-2.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center transition cursor-pointer"
            >
              Retirar
            </button>
          </div>
        </div>

        {/* Total Compras */}
        <div className="p-4 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block">
              Total de compras
            </span>
            <span className="text-base sm:text-lg font-mono font-medium text-emerald-600 dark:text-emerald-400 block mt-0.5 tabular-nums">
              {formatBRLDecimal(totalPurchases)}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5 font-medium">
              {purchaseTxs.length} {purchaseTxs.length === 1 ? 'operação' : 'operações'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        {/* Total Vendas */}
        <div className="p-4 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block">
              Total de vendas
            </span>
            <span className="text-base sm:text-lg font-mono font-medium text-zinc-900 dark:text-white block mt-0.5 tabular-nums">
              {formatBRLDecimal(totalSales)}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5 font-medium">
              {sellTxs.length} {sellTxs.length === 1 ? 'operação' : 'operações'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>

        {/* Dividendos Recebidos */}
        <div className="p-4 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block">
              Dividendos recebidos
            </span>
            <span className="text-base sm:text-lg font-mono font-medium text-indigo-600 dark:text-indigo-400 block mt-0.5 tabular-nums">
              {formatBRLDecimal(totalDividends)}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5 font-medium">
              {dividendTxs.length} {dividendTxs.length === 1 ? 'crédito' : 'créditos'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4" />
          </div>
        </div>

        {/* Custos Operacionais (Taxas) */}
        <div className="p-4 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block">
              Custos operacionais
            </span>
            <span className="text-base sm:text-lg font-mono font-medium text-amber-600 dark:text-amber-400 block mt-0.5 tabular-nums">
              {formatBRLDecimal(totalFees)}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5 font-medium">
              Taxas e corretagem
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 2. MAIN TABLE / CARDS CONTAINER */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs p-4 sm:p-5 space-y-4">
        {/* Header & View Switcher */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-500" />
              Histórico de lançamentos ({processedTransactions.length})
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Pesquise por ativo, filtre pelo tipo de operação ou ordene por data e valor.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFilterMinimized((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] font-medium text-xs transition flex items-center gap-1.5 cursor-pointer ${
                isFilterMinimized
                  ? 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-300'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold'
              }`}
              title={isFilterMinimized ? 'Expandir filtros' : 'Minimizar filtros'}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filtros</span>
              {isFilterMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>

            {transactions.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.08] font-medium rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                title="Exportar dados em planilha CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exportar</span> CSV
              </button>
            )}

            {/* View Switcher (Table vs Cards) */}
            <div className="flex items-center bg-zinc-100 dark:bg-white/[0.06] p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium">
              <button
                type="button"
                onClick={() => handleViewModeChange('TABLE')}
                className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  viewMode === 'TABLE'
                    ? 'bg-white dark:bg-white/[0.12] text-zinc-950 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
                title="Visualização em Tabela Completa"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabela</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('CARDS')}
                className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  viewMode === 'CARDS'
                    ? 'bg-white dark:bg-white/[0.12] text-zinc-950 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
                title="Visualização em Cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Search Toolbar */}
        {!isFilterMinimized && (
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-zinc-50 dark:bg-white/[0.03] p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06] animate-in fade-in duration-150">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por ativo ou observação (ex: PETR4, Subscrição)..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.1] rounded-lg text-xs font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {txSearch && (
                <button
                  type="button"
                  onClick={() => setTxSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Filter & Sort Options */}
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto overflow-x-auto max-w-full pb-1 sm:pb-0">
              <div className="flex items-center bg-white dark:bg-zinc-900 p-0.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('TODOS')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    txTypeFilter === 'TODOS'
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Todos ({transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('COMPRA')}
                  className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                    txTypeFilter === 'COMPRA'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  <ArrowUpRight className="w-3 h-3" /> Compras ({purchaseTxs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('VENDA')}
                  className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                    txTypeFilter === 'VENDA'
                      ? 'bg-rose-600 text-white font-semibold'
                      : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                  }`}
                >
                  <ArrowDownRight className="w-3 h-3" /> Vendas ({sellTxs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('PROVENTO')}
                  className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                    txTypeFilter === 'PROVENTO'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10'
                  }`}
                >
                  <Coins className="w-3 h-3" /> Dividendos ({dividendTxs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('DEPOSITO')}
                  className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                    txTypeFilter === 'DEPOSITO'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                  }`}
                >
                  <Plus className="w-3 h-3" /> Depósitos ({depositTxs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTxTypeFilter('RETIRADA')}
                  className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                    txTypeFilter === 'RETIRADA'
                      ? 'bg-orange-600 text-white font-semibold'
                      : 'text-orange-600 dark:text-orange-400 hover:bg-orange-500/10'
                  }`}
                >
                  <Wallet className="w-3 h-3" /> Retiradas ({withdrawalTxs.length})
                </button>
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-1 text-xs text-zinc-500 font-medium bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
                <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  aria-label="Ordenar lançamentos"
                  className="bg-transparent text-zinc-700 dark:text-zinc-300 font-medium text-xs focus:outline-none cursor-pointer"
                >
                  <option value="DATE_DESC">Mais Recente (Data)</option>
                  <option value="DATE_ASC">Mais Antigo (Data)</option>
                  <option value="VALUE_DESC">Maior Valor (R$)</option>
                  <option value="VALUE_ASC">Menor Valor (R$)</option>
                  <option value="TICKER_ASC">Ticker (A-Z)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {transactions.length === 0 ? (
          <div className="text-center py-12 px-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-dashed border-black/[0.06] dark:border-white/[0.08] space-y-3">
            <Receipt className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600" />
            <div className="space-y-1">
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">Nenhuma operação registrada ainda</p>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Registre suas primeiras compras, vendas ou dividendos para calcular sua rentabilidade e ver a evolução do seu patrimônio.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleOpenNewTransaction('COMPRA')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Cadastrar Primeira Compra
              </button>
            </div>
          </div>
        ) : processedTransactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
            <Search className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600" />
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">Nenhuma operação encontrada para os filtros selecionados.</p>
            <p className="text-[11px] text-zinc-400">Tente ajustar o termo de busca ou alterar o filtro de tipo.</p>
          </div>
        ) : viewMode === 'TABLE' ? (
          /* ============================================================ */
          /* 3. MODO TABELA: VISUALIZAÇÃO COMPLETA E TABULAR               */
          /* ============================================================ */
          <div className="overflow-x-auto rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#0f0f11]">
            <table className="w-full min-w-[700px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-black/[0.06] dark:border-white/[0.06] text-zinc-500 font-medium text-[10px] uppercase tracking-widest">
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Data</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Ativo</th>
                  <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Tipo</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Quantidade</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Preço Unitário</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Taxas B3</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Total da Operação</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Observações</th>
                  <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04] font-medium">
                {processedTransactions.map((tx) => {
                  const isBuy = tx.type === 'COMPRA';
                  const isSell = tx.type === 'VENDA';
                  const isDiv = tx.type === 'PROVENTO';
                  const isDeposit = tx.type === 'DEPOSITO';
                  const isWithdrawal = tx.type === 'RETIRADA';

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition"
                    >
                      {/* Data */}
                      <td className="py-2.5 px-3.5 font-mono text-zinc-500 whitespace-nowrap text-xs tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{formatDateBR(tx.date)}</span>
                        </div>
                      </td>

                      {/* Ativo */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-lg font-mono text-xs font-semibold">
                          {tx.ticker}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-[10px] uppercase border ${
                            isBuy
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : isSell
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              : isDiv
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                              : isDeposit
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                              : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                          }`}
                        >
                          {isBuy && <ArrowUpRight className="w-3 h-3" />}
                          {isSell && <ArrowDownRight className="w-3 h-3" />}
                          {isDiv && <Coins className="w-3 h-3" />}
                          {isDeposit && <Plus className="w-3 h-3" />}
                          {isWithdrawal && <Wallet className="w-3 h-3" />}
                          {tx.type}
                        </span>
                      </td>

                      {/* Quantidade */}
                      <td className="py-2.5 px-3.5 text-right font-mono font-medium text-zinc-900 dark:text-white whitespace-nowrap tabular-nums">
                        {tx.quantity > 0 ? tx.quantity : '—'}
                      </td>

                      {/* Preço Unitário */}
                      <td className="py-2.5 px-3.5 text-right font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                        {tx.price > 0 ? formatBRLDecimal(tx.price) : '—'}
                      </td>

                      {/* Taxas */}
                      <td className="py-2.5 px-3.5 text-right font-mono text-zinc-400 whitespace-nowrap tabular-nums">
                        {tx.fees > 0 ? formatBRLDecimal(tx.fees) : 'R$ 0,00'}
                      </td>

                      {/* Total da Operação */}
                      <td className="py-2.5 px-3.5 text-right font-mono whitespace-nowrap tabular-nums">
                        <span
                          className={`font-semibold text-xs ${
                            isBuy
                              ? 'text-zinc-900 dark:text-white'
                              : isSell
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isDiv ? '+' : ''}{formatBRLDecimal(tx.total)}
                        </span>
                      </td>

                      {/* Observações */}
                      <td className="py-2.5 px-3.5 text-zinc-500 text-xs max-w-[200px] truncate" title={tx.notes || ''}>
                        {tx.notes ? (
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium">{tx.notes}</span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTx(tx);
                              setIsModalOpen(true);
                            }}
                            title="Editar Lançamento"
                            className="p-1 hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTxToDelete(tx)}
                            title="Excluir Lançamento"
                            className="p-1 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ============================================================ */
          /* 4. MODO CARDS: VISUALIZAÇÃO EM CARDS MODERNOS                */
          /* ============================================================ */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {processedTransactions.map((tx) => {
              const isBuy = tx.type === 'COMPRA';
              const isSell = tx.type === 'VENDA';
              const isDiv = tx.type === 'PROVENTO';

              return (
                <div
                  key={tx.id}
                  className="p-3.5 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] hover:border-indigo-500/30 transition-all space-y-3 flex flex-col justify-between shadow-xs"
                >
                  {/* Top Bar of Card */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-xs px-2 py-0.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-lg">
                        {tx.ticker}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-[10px] uppercase border ${
                          isBuy
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : isSell
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                        }`}
                      >
                        {isBuy && <ArrowUpRight className="w-3 h-3" />}
                        {isSell && <ArrowDownRight className="w-3 h-3" />}
                        {isDiv && <Coins className="w-3 h-3" />}
                        {tx.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-zinc-400 font-mono text-xs tabular-nums">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDateBR(tx.date)}</span>
                    </div>
                  </div>

                  {/* Operational Details Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-black/[0.04] dark:border-white/[0.06] text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-widest block font-medium">Qtd</span>
                      <span className="font-mono font-medium text-zinc-900 dark:text-white block mt-0.5 tabular-nums">
                        {tx.quantity > 0 ? `${tx.quantity} cotas` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-widest block font-medium">Preço Unit.</span>
                      <span className="font-mono text-zinc-600 dark:text-zinc-400 block mt-0.5 tabular-nums">
                        {tx.price > 0 ? formatBRLDecimal(tx.price) : '—'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-widest block font-medium">Total</span>
                      <span
                        className={`font-mono font-medium text-xs block mt-0.5 tabular-nums ${
                          isBuy
                            ? 'text-zinc-900 dark:text-white'
                            : isSell
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isDiv ? '+' : ''}{formatBRLDecimal(tx.total)}
                      </span>
                    </div>
                  </div>

                  {/* Notes / Observações */}
                  {tx.notes && (
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/60 p-2 rounded-lg border border-black/[0.04] dark:border-white/[0.06] flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{tx.notes}</span>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-xs">
                    <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                      Taxas: {formatBRLDecimal(tx.fees || 0)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTx(tx);
                          setIsModalOpen(true);
                        }}
                        className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxToDelete(tx)}
                        className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Excluir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#18181b] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-black/[0.08] dark:border-white/[0.1] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-500/10 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white text-base">Excluir este lançamento?</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Seu preço médio e posições serão recalculados automaticamente.</p>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-xs space-y-1.5">
              <div className="flex justify-between font-mono">
                <span className="text-zinc-500 font-sans">Ativo:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{txToDelete.ticker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Tipo da Operação:</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{txToDelete.type}</span>
              </div>
              <div className="flex justify-between font-mono tabular-nums">
                <span className="text-zinc-500 font-sans">Data:</span>
                <span className="text-zinc-800 dark:text-zinc-200">{formatDateBR(txToDelete.date)}</span>
              </div>
              <div className="flex justify-between font-mono tabular-nums">
                <span className="text-zinc-500 font-sans">Valor Total:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{formatBRLDecimal(txToDelete.total)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-300 font-medium rounded-xl text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL DE EXPORTAÇÃO CSV / ÁREA DE TRANSFERÊNCIA */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#18181b] rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-black/[0.08] dark:border-white/[0.1] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
              <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 text-sm">
                <FileSpreadsheet className="w-4 h-4 text-indigo-500" /> Exportação de Transações
              </h3>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Caso o download direto não tenha iniciado automaticamente pelo navegador, você pode copiar os dados estruturados abaixo:
            </p>
            <textarea
              readOnly
              value={csvContentState}
              rows={6}
              className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.1] rounded-xl font-mono text-[11px] text-zinc-700 dark:text-zinc-300 focus:outline-none select-all"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCopyClipboard}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-medium rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar CSV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
