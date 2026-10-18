import React, { useState, useMemo, useEffect } from 'react';
import { MonthlyDividendData, PortfolioSummaryItem, UserTransaction } from '../../types';
import { formatBRL, formatBRLDecimal } from '../../utils/calculator';
import { isCryptoTicker, isFiiTicker, isStockTicker } from '../../utils/assetType';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Target,
  DollarSign,
  Award,
  Plus,
  Search,
  ArrowUpDown,
  Calendar,
  Sparkles,
  Building2,
  Briefcase,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Zap,
  CheckCircle2,
  ArrowUpRight,
  Clock,
  HelpCircle,
  Coins,
  ReceiptText,
  X,
  PieChart as PieChartIcon,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import InfoTooltip from '../InfoTooltip';

interface DividendsTabProps {
  monthlyDividends: MonthlyDividendData[];
  items: PortfolioSummaryItem[];
  transactions?: UserTransaction[];
  preferredLayout?: 'CARDS' | 'TABLE';
  onUpdatePreferredLayout?: (layout: 'CARDS' | 'TABLE') => void;
  onOpenDividendModal?: () => void;
  onOpenSpecificDividendModal?: (ticker: string) => void;
}

export default function DividendsTab({
  monthlyDividends,
  items,
  transactions = [],
  preferredLayout,
  onUpdatePreferredLayout,
  onOpenDividendModal,
  onOpenSpecificDividendModal,
}: DividendsTabProps) {
  const [incomeGoal, setIncomeGoal] = useState<string>('2000');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'STOCK' | 'FII'>('ALL');
  const [sortBy, setSortBy] = useState<'RECEIVED_DESC' | 'ESTIMATED_DESC' | 'DY_DESC' | 'TICKER_ASC'>('RECEIVED_DESC');
  
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>(() => preferredLayout || 'CARDS');

  // Sync viewMode state when the database loads or user preference changes globally
  useEffect(() => {
    if (preferredLayout) {
      setViewMode(preferredLayout);
    }
  }, [preferredLayout]);

  const handleViewModeChange = (mode: 'CARDS' | 'TABLE') => {
    setViewMode(mode);
    if (onUpdatePreferredLayout) {
      onUpdatePreferredLayout(mode);
    }
  };
  const [historySearch, setHistorySearch] = useState<string>('');
  const [isGoalMinimized, setIsGoalMinimized] = useState<boolean>(true);
  const [isFilterMinimized, setIsFilterMinimized] = useState<boolean>(true);

  const totalDividendsAllTime = items.reduce((sum, item) => sum + item.totalDividendsReceived, 0);
  const totalAnnualEst = items.reduce((sum, item) => sum + item.annualDividendIncome, 0);
  const monthlyAvgEst = totalAnnualEst / 12;
  const totalPortfolioValue = items.reduce((sum, item) => sum + item.currentTotalValue, 0);

  // Overall Portfolio Dividend Yield
  const portfolioAvgDy = totalPortfolioValue > 0 ? (totalAnnualEst / totalPortfolioValue) * 100 : 0;

  // Monthly Income Goal metrics
  const targetGoalVal = Math.max(1, parseFloat(incomeGoal) || 2000);
  const progressPct = Math.min(100, (monthlyAvgEst / targetGoalVal) * 100);
  const remainingMonthly = Math.max(0, targetGoalVal - monthlyAvgEst);

  const isCrypto = (ticker: string) => isCryptoTicker(ticker);
  const isFii = (ticker: string) => isFiiTicker(ticker);
  const isStock = (ticker: string) => isStockTicker(ticker);

  // Stock vs FII Income Breakdown
  const fiiItems = items.filter((i) => isFii(i.ticker));
  const stockItems = items.filter((i) => isStock(i.ticker));

  const fiiReceivedAllTime = fiiItems.reduce((sum, i) => sum + i.totalDividendsReceived, 0);
  const stockReceivedAllTime = stockItems.reduce((sum, i) => sum + i.totalDividendsReceived, 0);

  // Filtered & Sorted items for dividend breakdown
  const processedItems = useMemo(() => {
    return items
      .filter((item) => {
        if (isCrypto(item.ticker)) return false; // Criptoativos não entram na análise de proventos societários
        const matchesSearch = item.ticker.toLowerCase().includes(searchTerm.toLowerCase().trim());
        const thisIsFii = isFii(item.ticker);
        if (assetFilter === 'FII' && !thisIsFii) return false;
        if (assetFilter === 'STOCK' && thisIsFii) return false;
        return matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'RECEIVED_DESC') return b.totalDividendsReceived - a.totalDividendsReceived;
        if (sortBy === 'ESTIMATED_DESC') return b.annualDividendIncome - a.annualDividendIncome;
        if (sortBy === 'DY_DESC') return (b.dy || 0) - (a.dy || 0);
        if (sortBy === 'TICKER_ASC') return a.ticker.localeCompare(b.ticker);
        return 0;
      });
  }, [items, searchTerm, assetFilter, sortBy]);

  // Dividend transactions history
  const dividendTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'PROVENTO')
      .filter((t) => {
        if (!historySearch.trim()) return true;
        const q = historySearch.toLowerCase().trim();
        return t.ticker.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, historySearch]);

  // Best paying asset all-time
  const topPayerAllTime = useMemo(() => {
    if (items.length === 0) return null;
    const sorted = [...items].sort((a, b) => b.totalDividendsReceived - a.totalDividendsReceived);
    return sorted[0]?.totalDividendsReceived > 0 ? sorted[0] : null;
  }, [items]);

  // Format data for Recharts
  const chartData = useMemo(() => {
    return monthlyDividends.map((d) => {
      const [year, month] = d.monthYear.split('-');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthName = monthNames[parseInt(month, 10) - 1] || month;
      const formattedLabel = `${monthName}/${year ? year.substring(2) : ''}`;

      return {
        name: formattedLabel,
        val: d.amount,
        rawMonth: d.monthYear,
      };
    });
  }, [monthlyDividends]);

  // Last 3 months average
  const last3MonthsAvg = useMemo(() => {
    if (monthlyDividends.length === 0) return 0;
    const slice = monthlyDividends.slice(-3);
    const sum = slice.reduce((acc, m) => acc + m.amount, 0);
    return sum / slice.length;
  }, [monthlyDividends]);

  return (
    <div className="space-y-5">
      {/* 1. THREE KEY PROVENTOS METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Proventos Recebidos no Histórico */}
        <div className="p-4 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block">
              Total recebido
            </span>
            <span className="text-lg font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatBRLDecimal(totalDividendsAllTime)}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5 font-medium tabular-nums">
              {fiiReceivedAllTime > 0 ? `FIIs: ${formatBRL(fiiReceivedAllTime)} • ` : ''}
              Ações: {formatBRL(stockReceivedAllTime)}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        {/* Renda Mensal Estimada */}
        <div className="p-4 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block">
              Média mensal estimada
            </span>
            <span className="text-lg font-mono font-semibold text-zinc-900 dark:text-white tabular-nums">
              ~{formatBRLDecimal(monthlyAvgEst)}
              <span className="text-xs text-zinc-400 font-normal">/mês</span>
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5 font-mono tabular-nums font-medium">
              Anual projetado: {formatBRL(totalAnnualEst)}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        {/* Dividend Yield Médio da Carteira */}
        <div className="p-4 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block">
              Dividend Yield Médio
            </span>
            <span className="text-lg font-mono font-semibold text-zinc-900 dark:text-white tabular-nums">
              {portfolioAvgDy.toFixed(2)}%
              <span className="text-xs text-zinc-400 font-normal"> a.a.</span>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-medium">
              {topPayerAllTime ? `Maior pagador: ${topPayerAllTime.ticker}` : 'Foco em dividendos'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
            <Coins className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 2. META DE RENDA PASSIVA & SIMULADOR DE PROGRESSO */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
              <Target className="w-4 h-4 text-indigo-500" />
              Meta de Renda Mensal Passiva
              <InfoTooltip
                title="Meta de Renda em Proventos"
                description="Defina quanto deseja receber por mês em dividendos limpos na conta para cobrir seu custo de vida ou alcançar sua aposentadoria antecipada."
              />
              {isGoalMinimized && (
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {formatBRL(targetGoalVal)}/mês ({progressPct.toFixed(1)}%)
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Acompanhe seu avanço em direção ao salário mensal pago pelos seus investimentos.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {!isGoalMinimized && (
              /* Income Goal Quick Input */
              <div className="flex items-center gap-2 bg-zinc-50 dark:bg-white/[0.04] px-3 py-1.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] w-full sm:w-auto justify-between sm:justify-start">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Meta:</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400">R$</span>
                  <input
                    type="number"
                    value={incomeGoal}
                    onChange={(e) => setIncomeGoal(e.target.value)}
                    className="w-24 pl-8 pr-2 py-1 bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.12] rounded-lg text-xs font-mono font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 tabular-nums"
                    placeholder="2000"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsGoalMinimized((prev) => !prev)}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer shrink-0"
              title={isGoalMinimized ? 'Expandir meta de renda' : 'Minimizar meta de renda'}
              aria-label={isGoalMinimized ? 'Expandir meta de renda' : 'Minimizar meta de renda'}
            >
              {isGoalMinimized ? (
                <ChevronDown className="w-4 h-4 text-indigo-500" />
              ) : (
                <ChevronUp className="w-4 h-4 text-indigo-500" />
              )}
            </button>
          </div>
        </div>

        {!isGoalMinimized && (
          /* Progress Bar & Details */
          <div className="bg-zinc-50 dark:bg-white/[0.03] p-4 rounded-xl border border-black/[0.04] dark:border-white/[0.06] space-y-3 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg font-medium tabular-nums">
                  {progressPct.toFixed(1)}% Concluído
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  Você já gera <strong className="text-zinc-900 dark:text-white font-mono font-medium tabular-nums">{formatBRLDecimal(monthlyAvgEst)}/mês</strong> de{' '}
                  <strong className="text-zinc-900 dark:text-white font-mono font-medium tabular-nums">{formatBRL(targetGoalVal)}/mês</strong>
                </span>
              </div>
              <span className="text-zinc-500 font-mono text-[11px] tabular-nums">
                Faltam ~{formatBRL(remainingMonthly)}/mês para a meta
              </span>
            </div>

            {/* Progress Visual Bar */}
            <div className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Quick Shortcuts */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-[11px] text-zinc-500">
              <span className="font-medium">Metas rápidas:</span>
              <div className="flex items-center gap-1.5">
                {['500', '1000', '2000', '5000', '10000'].map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setIncomeGoal(goal)}
                    className={`px-2 py-0.5 rounded-md font-medium text-xs transition cursor-pointer tabular-nums ${
                      incomeGoal === goal
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-xs font-semibold'
                        : 'bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    R$ {Number(goal).toLocaleString('pt-BR')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. EVOLUÇÃO MENSAL (GRÁFICO DE BARRAS) */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Evolução dos Dividendos por Mês
              <InfoTooltip
                title="Evolução Mensal dos Dividendos"
                description="Gráfico do crescimento mês a mês dos dividendos recebidos na conta. À medida que reinveste e faz novos aportes, as colunas sobem no efeito bola de neve."
              />
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Histórico consolidado dos dividendos e rendimentos depositados em conta.
            </p>
          </div>

          {last3MonthsAvg > 0 && (
            <div className="text-right">
              <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 block">
                Média Últimos 3 Meses
              </span>
              <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatBRLDecimal(last3MonthsAvg)}/mês
              </span>
            </div>
          )}
        </div>

        {chartData.length > 0 ? (
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
                <XAxis dataKey="name" stroke="currentColor" className="text-zinc-400 text-[11px]" tickLine={false} axisLine={false} />
                <YAxis
                  stroke="currentColor"
                  className="text-zinc-400 text-[11px]"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => {
                    if (val >= 1_000_000) return `R$${(val / 1_000_000).toFixed(1)}M`;
                    if (val >= 1_000) return `R$${(val / 1_000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
                    return `R$${val}`;
                  }}
                />
                <Tooltip
                  formatter={(value: any) => [
                    formatBRLDecimal(Number(value)),
                    'Dividendos Recebidos',
                  ]}
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderRadius: '12px',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="val" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-dashed border-black/[0.06] dark:border-white/[0.08] text-zinc-500 text-xs font-medium space-y-2">
            <Coins className="w-7 h-7 mx-auto text-zinc-300 dark:text-zinc-600" />
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">Nenhum dividendo registrado no histórico até o momento.</p>
            <p className="text-[11px] text-zinc-400">
              Utilize o botão "+ Lançar Dividendo" no topo para adicionar seu primeiro rendimento ou dividendo recebido.
            </p>
          </div>
        )}
      </div>

      {/* 4. PROVENTOS POR ATIVO (CARDS VS TABELA) */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
              <Layers className="w-4 h-4 text-indigo-500" />
              Detalhamento de Dividendos por Ativo ({items.length})
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Valores já recebidos no passado e estimativa futura de rendimento anual por papel.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setIsFilterMinimized((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-xl border font-medium text-xs transition flex items-center gap-1.5 cursor-pointer ${
                  isFilterMinimized
                    ? 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-300 border-black/[0.06] dark:border-white/[0.08]'
                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold'
                }`}
                title={isFilterMinimized ? 'Expandir filtros' : 'Minimizar filtros'}
              >
                <Filter className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Filtros</span>
                {isFilterMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* View Switcher */}
            <div className="flex items-center bg-zinc-100 dark:bg-white/[0.06] p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium">
              <button
                type="button"
                onClick={() => handleViewModeChange('CARDS')}
                className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  viewMode === 'CARDS'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
                title="Visualização em Cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('TABLE')}
                className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  viewMode === 'TABLE'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
                title="Visualização em Tabela Completa"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tabela</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Search Toolbar */}
        {items.length > 0 && !isFilterMinimized && (
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-zinc-50 dark:bg-white/[0.03] p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06] animate-in fade-in duration-150">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por ativo (ex: PETR4, MXRF11)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.1] rounded-lg text-xs font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Class Filter & Sort Options */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Asset Class Filter */}
              <div className="flex items-center bg-white dark:bg-zinc-900 p-0.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setAssetFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    assetFilter === 'ALL'
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Todos ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAssetFilter('STOCK')}
                  className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                    assetFilter === 'STOCK'
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Briefcase className="w-3 h-3" /> Ações ({stockItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAssetFilter('FII')}
                  className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                    assetFilter === 'FII'
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Building2 className="w-3 h-3" /> FIIs ({fiiItems.length})
                </button>
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-1 text-xs text-zinc-500 font-medium bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
                <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  aria-label="Ordenar proventos"
                  className="bg-transparent text-zinc-700 dark:text-zinc-300 font-medium text-xs focus:outline-none cursor-pointer"
                >
                  <option value="RECEIVED_DESC">Maior Total Recebido</option>
                  <option value="ESTIMATED_DESC">Maior Estimativa Anual</option>
                  <option value="DY_DESC">Maior Dividend Yield</option>
                  <option value="TICKER_ASC">Ticker (A-Z)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* CARDS MODE */}
        {processedItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 font-medium">
            Nenhum ativo encontrado para os filtros selecionados.
          </div>
        ) : viewMode === 'CARDS' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {processedItems.map((item) => {
              const thisIsFII = isFii(item.ticker);
              const monthlyEst = item.annualDividendIncome / 12;

              return (
                <div
                  key={item.ticker}
                  className="p-3.5 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] hover:border-indigo-500/30 shadow-xs transition-all space-y-3 flex flex-col justify-between"
                >
                  {/* Card Top */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-xs px-2 py-0.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-lg">
                        {item.ticker}
                      </span>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 rounded-md uppercase tracking-wider">
                        {thisIsFII ? 'FII' : 'Ação'}
                      </span>
                    </div>

                    <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 tabular-nums">
                      DY {item.dy ? `${item.dy.toFixed(1)}%` : '0.0%'}
                    </span>
                  </div>

                  {/* Numbers Grid */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-black/[0.04] dark:border-white/[0.06] text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-widest block font-medium">
                        Total Recebido
                      </span>
                      <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5 tabular-nums">
                        {formatBRLDecimal(item.totalDividendsReceived)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-widest block font-medium">
                        Est. Anual
                      </span>
                      <span className="text-xs font-mono font-semibold text-zinc-900 dark:text-white block mt-0.5 tabular-nums">
                        {formatBRLDecimal(item.annualDividendIncome)}
                      </span>
                      <span className="text-[10px] text-zinc-400 block font-mono tabular-nums">
                        ~{formatBRL(monthlyEst)}/mês
                      </span>
                    </div>
                  </div>

                  {/* Quantity & Actions */}
                  <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-xs">
                    <span className="text-zinc-500 text-[11px] font-medium">
                      Posição: <strong className="text-zinc-900 dark:text-white font-mono tabular-nums font-semibold">{item.quantity} cotas</strong>
                    </span>

                    {onOpenSpecificDividendModal && (
                      <button
                        type="button"
                        onClick={() => onOpenSpecificDividendModal(item.ticker)}
                        className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                        title={`Lançar provento para ${item.ticker}`}
                      >
                        <Plus className="w-3 h-3" /> Lançar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE MODE */
          <div className="overflow-x-auto rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#0f0f11]">
            <table className="w-full min-w-[700px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-black/[0.06] dark:border-white/[0.06] text-zinc-500 font-medium text-[10px] uppercase tracking-widest">
                  <th className="py-2.5 px-3.5">Ativo</th>
                  <th className="py-2.5 px-3.5 text-center">Tipo</th>
                  <th className="py-2.5 px-3.5 text-center">Cotas</th>
                  <th className="py-2.5 px-3.5 text-right">Dividend Yield</th>
                  <th className="py-2.5 px-3.5 text-right">Total Já Recebido</th>
                  <th className="py-2.5 px-3.5 text-right">Estimativa Anual</th>
                  <th className="py-2.5 px-3.5 text-right">Média Mensal</th>
                  <th className="py-2.5 px-3.5 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04] font-medium">
                {processedItems.map((item) => {
                  const thisIsFII = isFii(item.ticker);
                  const monthlyEst = item.annualDividendIncome / 12;

                  return (
                    <tr key={item.ticker} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition">
                      <td className="py-2.5 px-3.5 font-mono font-semibold text-zinc-900 dark:text-white text-xs">
                        {item.ticker}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span className="text-[9px] font-medium px-1.5 py-0.5 bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 rounded-md uppercase tracking-wider">
                          {thisIsFII ? 'FII' : 'Ação'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-mono text-zinc-700 dark:text-zinc-300 font-medium tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {item.dy ? `${item.dy.toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-zinc-900 dark:text-white tabular-nums">
                        {formatBRLDecimal(item.totalDividendsReceived)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-zinc-900 dark:text-white tabular-nums">
                        {formatBRLDecimal(item.annualDividendIncome)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-zinc-500 tabular-nums">
                        {formatBRL(monthlyEst)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        {onOpenSpecificDividendModal && (
                          <button
                            type="button"
                            onClick={() => onOpenSpecificDividendModal(item.ticker)}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium transition flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Lançar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. EXTRATO HISTÓRICO DE PROVENTOS RECEBIDOS */}
      {dividendTransactions.length > 0 && (
        <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
                <ReceiptText className="w-4 h-4 text-indigo-500" />
                Histórico Recente de Lançamentos ({dividendTransactions.length})
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Últimos créditos de dividendos, JCP e rendimentos cadastrados.
              </p>
            </div>

            {/* Search Filter for History */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar histórico..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.1] rounded-lg text-xs font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#0f0f11]">
            <table className="w-full min-w-[600px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-black/[0.06] dark:border-white/[0.06] text-zinc-500 font-medium text-[10px] uppercase tracking-widest">
                  <th className="py-2.5 px-3.5">Data do Crédito</th>
                  <th className="py-2.5 px-3.5">Ativo</th>
                  <th className="py-2.5 px-3.5 text-center">Tipo</th>
                  <th className="py-2.5 px-3.5 text-right">Valor Total</th>
                  <th className="py-2.5 px-3.5">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04] font-medium">
                {dividendTransactions.slice(0, 8).map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition">
                    <td className="py-2.5 px-3.5 text-zinc-500 font-mono text-xs tabular-nums">
                      {new Date(tx.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono font-semibold text-zinc-900 dark:text-white text-xs">
                      {tx.ticker}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-medium">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-xs tabular-nums">
                      +{formatBRLDecimal(tx.total)}
                    </td>
                    <td className="py-2.5 px-3.5 text-zinc-400 text-[11px]">
                      {tx.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
