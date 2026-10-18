import React, { useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { YearData } from '../types';
import { formatBRL, formatCompactBRL } from '../utils/calculator';
import AnimatedNumber from './AnimatedNumber';
import InfoTooltip from './InfoTooltip';
import {
  Wallet,
  ArrowUpRight,
  TrendingUp,
  Coins,
  ShieldCheck,
  Zap,
  Sparkles,
  Layers,
  Award,
} from 'lucide-react';

interface Props {
  results: YearData[];
  ticker: string;
}

export default function SummaryCards({ results, ticker }: Props) {
  const { t } = useTranslation();
  const metrics = useMemo(() => {
    if (!results.length) return null;

    const finalYear = results[results.length - 1];
    const totalInvested = finalYear.totalInvested;
    const nominalValue = finalYear.nominalValue;
    const realValue = finalYear.realValue;
    const cdiNetValue = finalYear.cdiNetValue || finalYear.cdiValue;
    const totalGains = finalYear.totalGain;
    const accumulatedDividends = finalYear.accumulatedDividends;
    const finalYearDividends = finalYear.dividendGain;
    const approxMonthlyIncome = finalYearDividends / 12;

    const returnMultiplier =
      totalInvested > 0 ? (nominalValue / totalInvested).toFixed(1) : '1.0';
    const diffCdi = nominalValue - cdiNetValue;
    const years = results.length;

    // Percentual do patrimônio que veio do bolso vs juros
    const investedPercent =
      nominalValue > 0 ? (totalInvested / nominalValue) * 100 : 100;
    const gainsPercent = nominalValue > 0 ? (totalGains / nominalValue) * 100 : 0;

    // Ponto de Inflexão (Ano onde a renda mensal de dividendos supera o aporte mensal)
    let inflectionYear: number | null = null;
    for (let i = 0; i < results.length; i++) {
      const yr = results[i];
      const monthlyDiv = yr.dividendGain / 12;
      const annualContrib =
        i === 0
          ? yr.totalInvested
          : yr.totalInvested - results[i - 1].totalInvested;
      const monthlyContrib = annualContrib / 12;

      if (monthlyContrib > 0 && monthlyDiv >= monthlyContrib) {
        inflectionYear = yr.year;
        break;
      }
    }

    return {
      totalInvested,
      nominalValue,
      realValue,
      cdiNetValue,
      totalGains,
      accumulatedDividends,
      finalYearDividends,
      approxMonthlyIncome,
      returnMultiplier,
      diffCdi,
      years,
      investedPercent,
      gainsPercent,
      inflectionYear,
    };
  }, [results]);

  if (!metrics) return null;

  const {
    totalInvested,
    nominalValue,
    realValue,
    cdiNetValue,
    totalGains,
    accumulatedDividends,
    finalYearDividends,
    approxMonthlyIncome,
    returnMultiplier,
    diffCdi,
    years,
    investedPercent,
    gainsPercent,
    inflectionYear,
  } = metrics;

  return (
    <div className="space-y-4">
      {/* 1. RESUMO EXECUTIVO PRINCIPAL (DIRETO AO PONTO) */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                {t('summary.projected_result', {
                  years,
                  unit: years === 1 ? t('summary.year_single', 'Ano') : t('summary.year_plural', 'Anos'),
                  defaultValue: `Resultado Projetado (${years} ${years === 1 ? 'Ano' : 'Anos'})`,
                })}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                <Trans
                  i18nKey="summary.multiplier_title"
                  values={{ multiplier: returnMultiplier }}
                  defaults="Multiplicação de <1>{{multiplier}}x</1> sobre o capital investido"
                  components={{
                    1: <span className="text-emerald-600 dark:text-emerald-400 font-mono" />,
                  }}
                />
              </h2>
            </div>
          </div>

          {diffCdi > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold self-start sm:self-auto max-w-full leading-tight shrink-0 sm:shrink">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span className="break-words">
                {t('summary.above_cdi', { amount: formatBRL(diffCdi), defaultValue: `+${formatBRL(diffCdi)} acima do CDI Líquido` })}
              </span>
            </div>
          )}
        </div>

        {/* 2. OS 4 CARDS FUNDAMENTAIS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {/* Card 1: Patrimônio Acumulado */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                {t('summary.final_wealth', 'Patrimônio Final')}
                <InfoTooltip
                  title={t('summary.final_wealth_tooltip_title', 'Patrimônio Acumulado')}
                  description={t('summary.final_wealth_tooltip_desc', 'Montante total acumulado somando todo o saldo investido, valorização e dividendos reinvestidos.')}
                />
              </span>
              <Wallet className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white tabular-nums">
              <AnimatedNumber value={nominalValue} />
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {t('summary.purchasing_power', 'Poder de compra real:')}{' '}
              <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{formatBRL(realValue)}</strong>
            </div>
          </div>

          {/* Card 2: Renda Passiva Mensal */}
          <div className="p-3.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                {t('summary.monthly_income', 'Renda Passiva Mensal')}
                <InfoTooltip
                  title={t('summary.monthly_income_tooltip_title', 'Renda Mensal de Dividendos')}
                  description={t('summary.monthly_income_tooltip_desc', 'Média mensal de dividendos e rendimentos no último ano da projeção.')}
                />
              </span>
              <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              <AnimatedNumber value={approxMonthlyIncome} />
              <span className="text-xs font-normal text-emerald-600/80">{t('summary.per_month', '/mês')}</span>
            </div>
            <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
              {t('summary.annual_label', 'Anual:')}{' '}
              <strong className="font-mono">{formatBRL(finalYearDividends)}{t('summary.per_year', '/ano')}</strong>
            </div>
          </div>

          {/* Card 3: Total do seu Bolso */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                {t('summary.total_invested', 'Total do seu Bolso')}
                <InfoTooltip
                  title={t('summary.total_invested_tooltip_title', 'Total Investido')}
                  description={t('summary.total_invested_tooltip_desc', 'A soma de todo o dinheiro que saiu do seu bolso (aporte inicial + aportes mensais).')}
                />
              </span>
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white tabular-nums">
              <AnimatedNumber value={totalInvested} />
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {t('summary.invested_percent', { percent: investedPercent.toFixed(0), defaultValue: `Representa ${investedPercent.toFixed(0)}% do patrimônio` })}
            </div>
          </div>

          {/* Card 4: Ganhos com Juros & Dividendos */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                {t('summary.gains_title', 'Lucro & Dividendos')}
                <InfoTooltip
                  title={t('summary.gains_tooltip_title', 'Ganhos dos Juros Compostos')}
                  description={t('summary.gains_tooltip_desc', 'Montante gerado puramente pelo retorno dos ativos e reinvestimento dos dividendos.')}
                />
              </span>
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 tabular-nums">
              <AnimatedNumber value={totalGains} />
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {t('summary.accumulated_dividends', 'Dividendos acumulados:')}{' '}
              <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{formatBRL(accumulatedDividends)}</strong>
            </div>
          </div>
        </div>

        {/* 3. BARRA VISUAL DE DIVISÃO DE ESFORÇO */}
        <div className="mt-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
            <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-zinc-400 dark:bg-zinc-600 inline-block shrink-0" />
              <span>{t('summary.effort_label', 'Seu Esforço (Aportes):')} <strong className="font-mono">{investedPercent.toFixed(0)}%</strong></span>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block shrink-0" />
              <span>{t('summary.working_money_label', 'Dinheiro Trabalhando (Juros/Dividendos):')} <strong className="font-mono">{gainsPercent.toFixed(0)}%</strong></span>
            </span>
          </div>

          <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${Math.max(5, Math.min(95, investedPercent))}%` }}
              className="bg-zinc-400 dark:bg-zinc-600 transition-all duration-500"
              title={`Aportes do Bolso: ${formatBRL(totalInvested)}`}
            />
            <div
              style={{ width: `${Math.max(5, Math.min(95, gainsPercent))}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`Lucro dos Juros Compostos: ${formatBRL(totalGains)}`}
            />
          </div>

          {inflectionYear && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl mt-2">
              <Zap className="w-4 h-4 shrink-0 text-amber-500" />
              <span>
                <strong>{t('summary.snowball_tag', 'Efeito Bola de Neve:')}</strong>{' '}
                <Trans
                  i18nKey="summary.snowball_desc"
                  values={{ year: inflectionYear }}
                  defaults="No <1>Ano {{year}}</1>, seus dividendos mensais já pagam o valor do seu aporte mensal sozinho!"
                  components={{
                    1: <strong />,
                  }}
                />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
