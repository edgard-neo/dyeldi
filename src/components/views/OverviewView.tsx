import React, { useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  ConsolidatedPortfolio,
  PortfolioSummaryItem,
  StockQuote,
  NavigationTab,
  MonthlyDividendData,
  UserTransaction,
  TransactionType,
} from '../../types';
import MarketStatusBar from '../portfolio/MarketStatusBar';
import PortfolioSummaryCards from '../portfolio/PortfolioSummaryCards';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Scale,
  Sparkles,
  PiggyBank,
  Plus,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Layers,
  Wallet,
  LayoutDashboard,
} from 'lucide-react';
import { formatBRL, formatBRLDecimal } from '../../utils/calculator';
import { getAssetName } from '../../utils/assetType';

interface OverviewViewProps {
  user: User | null;
  summaryItems: PortfolioSummaryItem[];
  quotes: Record<string, StockQuote>;
  consolidatedData: ConsolidatedPortfolio;
  pieData: { name: string; value: number }[];
  COLORS: string[];
  monthlyDividends: MonthlyDividendData[];
  totalCurrentPortfolioValue: number;
  totalCostBasis: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalDividendsAllTime: number;
  totalAnnualDividendsEst: number;
  weightedDy: number;
  isRefreshingAllQuotes: boolean;
  onRefreshAllQuotes: () => Promise<void>;
  onApplyPortfolioToProjection: (consolidated: ConsolidatedPortfolio) => void;
  onNavigate: (tab: NavigationTab) => void;
  setIsModalOpen: (isOpen: boolean) => void;
  setEditingTx: (tx: UserTransaction | Partial<UserTransaction> | null) => void;
  setDefaultTickerForModal: (ticker: string) => void;
  setDefaultModalType?: (type: TransactionType) => void;
  onExitDemo?: () => void;
  onOpenAuthModal?: () => void;
  onSeedSample?: () => Promise<void>;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  user,
  summaryItems,
  quotes,
  consolidatedData,
  pieData,
  COLORS,
  monthlyDividends,
  totalCurrentPortfolioValue,
  totalCostBasis,
  totalUnrealizedPnl,
  totalRealizedPnl,
  totalDividendsAllTime,
  totalAnnualDividendsEst,
  weightedDy,
  isRefreshingAllQuotes,
  onRefreshAllQuotes,
  onApplyPortfolioToProjection,
  onNavigate,
  setIsModalOpen,
  setEditingTx,
  setDefaultTickerForModal,
  setDefaultModalType,
  onExitDemo,
  onOpenAuthModal,
  onSeedSample,
}) => {
  const activeTickers = summaryItems.map((i) => i.ticker);

  // Top holdings by current position value (filtered for active balance)
  const topHoldings = useMemo(() => {
    return [...summaryItems]
      .filter((i) => i.currentTotalValue > 0)
      .sort((a, b) => b.currentTotalValue - a.currentTotalValue);
  }, [summaryItems]);

  // Top gainers and losers
  const sortedByPnl = useMemo(() => {
    return [...summaryItems].filter((i) => i.quantity > 0).sort((a, b) => b.pnlPercent - a.pnlPercent);
  }, [summaryItems]);

  const topGainer = sortedByPnl[0];
  const topLoser = sortedByPnl[sortedByPnl.length - 1];

  // Quick Decision & Health Metrics (< 3 seconds check)
  const quickDecision = useMemo(() => {
    if (summaryItems.length === 0) {
      return {
        verdict: 'Sua carteira está pronta para começar',
        badge: 'Início',
        badgeColor: 'bg-zinc-100 text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300',
        description: 'Cadastre suas primeiras ações ou fundos imobiliários para acompanhar proventos, rentabilidade e cotações.',
        actionLabel: 'Adicionar Ativo',
        actionTab: null,
        opportunityCount: 0,
        opportunityTickers: [] as string[],
      };
    }

    // Identify assets with buying opportunities (discount to Bazin or PM)
    const opportunities = summaryItems.filter(
      (item) =>
        (item.bazinCeiling > 0 && item.currentPrice <= item.bazinCeiling) ||
        (item.currentPrice > 0 && item.currentPrice < item.averagePrice && item.dy > 5)
    );

    const highestWeightAsset = [...summaryItems].sort((a, b) => b.currentPercent - a.currentPercent)[0];
    const isConcentrated = highestWeightAsset && highestWeightAsset.currentPercent > 35;

    if (opportunities.length > 0) {
      return {
        verdict: `${opportunities.length} ${opportunities.length === 1 ? 'ativo cotado abaixo do preço teto' : 'ativos cotados abaixo do preço teto'}`,
        badge: 'Oportunidade',
        badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        description: `${opportunities.map((o) => o.ticker).slice(0, 3).join(', ')} ${opportunities.length > 3 ? `e mais ${opportunities.length - 3}` : ''} estão com preço abaixo do teto de dividendos.`,
        actionLabel: 'Ver Aportes Recomendados',
        actionTab: 'rebalance' as NavigationTab,
        opportunityCount: opportunities.length,
        opportunityTickers: opportunities.map((o) => o.ticker),
      };
    }

    if (isConcentrated) {
      return {
        verdict: `Atenção: Concentração elevada em ${highestWeightAsset.ticker} (${highestWeightAsset.currentPercent.toFixed(1)}%)`,
        badge: 'Atenção',
        badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
        description: 'Direcione os próximos aportes para outros papéis para equilibrar o risco.',
        actionLabel: 'Rebalancear Carteira',
        actionTab: 'rebalance' as NavigationTab,
        opportunityCount: 0,
        opportunityTickers: [],
      };
    }

    return {
      verdict: 'Carteira 100% Equilibrada e Saudável',
      badge: 'Saudável',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      description: 'Seus ativos estão distribuídos de forma segura e gerando proventos regulares.',
      actionLabel: 'Ver Diagnóstico',
      actionTab: 'diagnosis' as NavigationTab,
      opportunityCount: 0,
      opportunityTickers: [],
    };
  }, [summaryItems]);

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
      {/* 0. TÍTULO DA SEÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
            <span>Visão geral</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
            Acompanhamento consolidado da sua carteira, cotações e rendimentos.
          </p>
        </div>
      </div>

      {/* 1. BARRA DE STATUS DA B3 (Mercado e Atualização) */}
      <MarketStatusBar
        quotes={quotes}
        activeTickers={activeTickers}
        isRefreshingAllQuotes={isRefreshingAllQuotes}
        onRefreshAllQuotes={onRefreshAllQuotes}
      />

      {/* 2. CARD DE DECISÃO RÁPIDA */}
      {summaryItems.length > 0 && (
        <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`p-2.5 rounded-xl shrink-0 ${quickDecision.badgeColor}`}>
              {quickDecision.opportunityCount > 0 ? (
                <Zap className="w-5 h-5" />
              ) : quickDecision.badge === 'Atenção' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  Status da Carteira
                </span>
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  • {quickDecision.badge}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white mt-0.5 tracking-tight">
                {quickDecision.verdict}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-medium">
                {quickDecision.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            {quickDecision.actionTab ? (
              <button
                type="button"
                onClick={() => onNavigate(quickDecision.actionTab!)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-medium rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>{quickDecision.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingTx(null);
                  setDefaultTickerForModal('');
                  setDefaultModalType?.('COMPRA');
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-medium rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{quickDecision.actionLabel}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. CARDS DE RESUMO CONSOLIDADO (Patrimônio, Valorização, Renda, Retorno) */}
      {summaryItems.length > 0 ? (
        <PortfolioSummaryCards
          totalCurrentPortfolioValue={totalCurrentPortfolioValue}
          totalCostBasis={totalCostBasis}
          totalUnrealizedPnl={totalUnrealizedPnl}
          totalRealizedPnl={totalRealizedPnl}
          totalDividendsAllTime={totalDividendsAllTime}
          totalAnnualDividendsEst={totalAnnualDividendsEst}
          weightedDy={weightedDy}
        />
      ) : (
        /* Estado Vazio Limpo e Amigável */
        <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-8 sm:p-12 border border-black/[0.06] dark:border-white/[0.08] text-center max-w-xl mx-auto shadow-xs">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <Landmark className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">
            Sua carteira está pronta para começar
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed font-medium">
            Registre suas compras de ações e FIIs da B3 para ver seu patrimônio e dividendos crescerem.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingTx(null);
                setDefaultTickerForModal('');
                setDefaultModalType?.('COMPRA');
                setIsModalOpen(true);
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-xl text-xs font-medium flex items-center justify-center gap-2 shadow-xs hover:bg-zinc-800 dark:hover:bg-zinc-200 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Adicionar ativo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingTx(null);
                setDefaultTickerForModal('CAIXA');
                setDefaultModalType?.('DEPOSITO');
                setIsModalOpen(true);
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Wallet className="w-4 h-4" />
              <span>Depositar saldo</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. COMPOSIÇÃO E DESTAQUES DA CARTEIRA */}
      {summaryItems.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* Distribuição de Ativos (7 colunas) */}
          <div className="lg:col-span-7 bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-emerald-500" />
                Distribuição da Carteira
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('positions')}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver todos ({summaryItems.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              {/* Gráfico Donut Limpo */}
              <div className="sm:col-span-5 h-40 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => {
                        const pct = totalCurrentPortfolioValue > 0
                          ? ((val / totalCurrentPortfolioValue) * 100).toFixed(1)
                          : '0.0';
                        return [`${formatBRL(val)} (${pct}%)`, 'Posição'];
                      }}
                      contentStyle={{
                        backgroundColor: '#18181b',
                        borderColor: '#27272a',
                        borderRadius: '10px',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Maiores Posições */}
              <div className="sm:col-span-7 space-y-1.5">
                {topHoldings.slice(0, 4).map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04] text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-zinc-900 dark:text-white font-mono">
                          {item.ticker}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-1.5 truncate hidden xs:inline">
                          {getAssetName(item.ticker, quotes[item.ticker]?.name)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono text-zinc-500 tabular-nums">
                        {item.currentPercent.toFixed(1)}%
                      </span>
                      <span className="font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                        {formatBRL(item.currentTotalValue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Destaques de Rentabilidade (Maior Ganho / Menor Ganho) */}
            <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] grid grid-cols-2 gap-2.5">
              {topGainer && (
                <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <TrendingUp className="w-3 h-3" /> Maior Ganho
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{topGainer.pnlPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white font-mono mt-0.5 truncate">
                    {topGainer.ticker}{' '}
                    <span className="font-normal text-zinc-500 text-[11px] tabular-nums">
                      (+{formatBRL(topGainer.pnl)})
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {getAssetName(topGainer.ticker, quotes[topGainer.ticker]?.name)}
                  </div>
                </div>
              )}

              {topLoser && topLoser.ticker !== topGainer?.ticker && (
                <div className="p-2.5 rounded-xl bg-red-500/5 border border-red-500/15">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold">
                      <TrendingDown className="w-3 h-3" /> Menor Ganho
                    </span>
                    <span className="font-mono font-bold text-red-600 dark:text-red-400 tabular-nums">
                      {topLoser.pnlPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white font-mono mt-0.5 truncate">
                    {topLoser.ticker}{' '}
                    <span className="font-normal text-zinc-500 text-[11px] tabular-nums">
                      ({formatBRL(topLoser.pnl)})
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {getAssetName(topLoser.ticker, quotes[topLoser.ticker]?.name)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Atalhos Diretos para Decisão (5 colunas) */}
          <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
            <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">
                Ações & Estratégia
              </div>

              <button
                type="button"
                onClick={() => onApplyPortfolioToProjection(consolidatedData)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/50 transition cursor-pointer border border-indigo-200/60 dark:border-indigo-800/40"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                      Simular Minha Carteira
                    </div>
                    <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
                      Projetar juros compostos com a posição atual
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('rebalance')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer border border-black/[0.04] dark:border-white/[0.04]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Scale className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                      Rebalancear Aportes
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium">
                      Calculadora de compra inteligente
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('dividends')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer border border-black/[0.04] dark:border-white/[0.04]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-500 flex items-center justify-center">
                    <PiggyBank className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                      Proventos & Bola de Neve
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium">
                      Histórico e projeção de dividendos
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('diagnosis')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer border border-black/[0.04] dark:border-white/[0.04]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      Diagnóstico de Risco
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium">
                      Score de diversificação e segurança
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewView;
