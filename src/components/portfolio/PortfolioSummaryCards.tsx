import React, { useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  PiggyBank,
  CheckCircle2,
  Sparkles,
  Zap,
} from 'lucide-react';
import InfoTooltip from '../InfoTooltip';
import { formatBRL, formatBRLDecimal } from '../../utils/calculator';

interface PortfolioSummaryCardsProps {
  totalCurrentPortfolioValue: number;
  totalCostBasis: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalDividendsAllTime: number;
  totalAnnualDividendsEst: number;
  weightedDy: number;
}

export default function PortfolioSummaryCards({
  totalCurrentPortfolioValue,
  totalCostBasis,
  totalUnrealizedPnl,
  totalRealizedPnl,
  totalDividendsAllTime,
  totalAnnualDividendsEst,
  weightedDy,
}: PortfolioSummaryCardsProps) {
  const {
    totalCombinedProfit,
    totalReturnPercent,
    unrealizedPercent,
    monthlyEstimatedDividends,
  } = useMemo(() => {
    const combined =
      totalUnrealizedPnl + totalRealizedPnl + totalDividendsAllTime;
    const returnPct =
      totalCostBasis > 0 ? (combined / totalCostBasis) * 100 : 0;
    const unrealizedPct =
      totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0;
    const monthly = totalAnnualDividendsEst / 12;

    return {
      totalCombinedProfit: combined,
      totalReturnPercent: returnPct,
      unrealizedPercent: unrealizedPct,
      monthlyEstimatedDividends: monthly,
    };
  }, [
    totalUnrealizedPnl,
    totalRealizedPnl,
    totalDividendsAllTime,
    totalCostBasis,
    totalAnnualDividendsEst,
  ]);

  const isProfitable = totalUnrealizedPnl >= 0;
  const isCombinedProfitable = totalCombinedProfit >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. PATRIMÔNIO TOTAL (Destaque Principal) */}
      <div className="bg-white dark:bg-[#0f0f11] text-zinc-900 dark:text-white rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col justify-between border border-black/[0.06] dark:border-white/[0.08] transition-all hover:border-black/[0.12] dark:hover:border-white/[0.15]">
        <div>
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
              <Wallet className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Patrimônio Total</span>
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium shrink-0">
              AO VIVO
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white font-mono mt-1 tabular-nums">
            {formatBRL(totalCurrentPortfolioValue)}
          </div>
        </div>

        <div className="mt-3.5 text-xs text-zinc-500 dark:text-zinc-400 border-t border-black/[0.06] dark:border-white/[0.06] pt-2.5 flex items-center justify-between gap-2">
          <span className="shrink-0 font-medium">Total aportado:</span>
          <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
            {formatBRL(totalCostBasis)}
          </span>
        </div>
      </div>

      {/* 2. VALORIZAÇÃO ATUAL (Lucro / Prejuízo da Carteira) */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col justify-between transition-all hover:border-black/[0.12] dark:hover:border-white/[0.15]">
        <div>
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
              {isProfitable ? (
                <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <span>Valorização da Carteira</span>
            </span>

            <span
              className={`text-[11px] px-2 py-0.5 rounded-lg font-medium shrink-0 flex items-center gap-0.5 tabular-nums ${
                isProfitable
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
              }`}
            >
              {isProfitable ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {isProfitable ? '+' : ''}
              {unrealizedPercent.toFixed(1)}%
            </span>
          </div>

          <div
            className={`text-2xl sm:text-3xl font-semibold tracking-tight font-mono mt-1 tabular-nums ${
              isProfitable
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {isProfitable ? '+' : ''}
            {formatBRL(totalUnrealizedPnl)}
          </div>
        </div>

        <div className="mt-3.5 text-xs text-zinc-500 dark:text-zinc-400 border-t border-black/[0.06] dark:border-white/[0.06] pt-2.5 flex items-center justify-between gap-2">
          <span className="shrink-0 font-medium">Status de Preço:</span>
          <span
            className={`font-medium ${
              isProfitable
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {isProfitable ? 'Acima do Preço Médio' : 'Abaixo do Preço Médio'}
          </span>
        </div>
      </div>

      {/* 3. RENDA PASSIVA ESTIMADA (Foco em Dividendos) */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col justify-between transition-all hover:border-black/[0.12] dark:hover:border-white/[0.15]">
        <div>
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
              <PiggyBank className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Renda Passiva Anual</span>
            </span>
            <span className="text-[10px] bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-lg font-medium border border-black/[0.06] dark:border-white/[0.08] shrink-0 tabular-nums">
              DY {weightedDy.toFixed(1)}% a.a.
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-semibold text-emerald-600 dark:text-emerald-400 tracking-tight font-mono mt-1 tabular-nums">
            {formatBRL(totalAnnualDividendsEst)}
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 ml-1 font-sans">
              /ano
            </span>
          </div>
        </div>

        <div className="mt-3.5 text-xs text-zinc-500 dark:text-zinc-400 border-t border-black/[0.06] dark:border-white/[0.06] pt-2.5 flex items-center justify-between gap-2">
          <span className="shrink-0 font-medium">Média mensal:</span>
          <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 tabular-nums">
            ~{formatBRL(monthlyEstimatedDividends)}/mês
          </span>
        </div>
      </div>

      {/* 4. RETORNO TOTAL COMBINADO (Ganho Real Completo) */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col justify-between transition-all hover:border-black/[0.12] dark:hover:border-white/[0.15]">
        <div>
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
              <DollarSign className="w-4 h-4 text-teal-500 shrink-0" />
              <span>Retorno Total Acumulado</span>
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-lg font-medium shrink-0 tabular-nums ${
                isCombinedProfitable
                  ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
              }`}
            >
              {isCombinedProfitable ? '+' : ''}
              {totalReturnPercent.toFixed(1)}%
            </span>
          </div>

          <div
            className={`text-2xl sm:text-3xl font-semibold tracking-tight font-mono mt-1 tabular-nums ${
              isCombinedProfitable
                ? 'text-zinc-900 dark:text-white'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {isCombinedProfitable ? '+' : ''}
            {formatBRL(totalCombinedProfit)}
          </div>
        </div>

        <div className="mt-3.5 text-xs text-zinc-500 dark:text-zinc-400 border-t border-black/[0.06] dark:border-white/[0.06] pt-2.5 flex items-center justify-between gap-2">
          <span className="shrink-0 font-medium">Proventos já recebidos:</span>
          <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
            +{formatBRLDecimal(totalDividendsAllTime)}
          </span>
        </div>
      </div>
    </div>
  );
}
