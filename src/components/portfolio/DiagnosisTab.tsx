import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  TrendingDown,
  Layers,
  Target,
  Activity,
  FileText,
  Copy,
  Check,
  Coins,
  AlertTriangle,
  ArrowUpRight,
  Zap,
  TrendingUp,
  Scale,
  Info,
  Compass,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { PortfolioSummaryItem } from '../../types';
import { formatBRL, formatBRLDecimal } from '../../utils/calculator';
import { isCryptoTicker, isFiiTicker, isStockTicker } from '../../utils/assetType';
import InfoTooltip from '../InfoTooltip';

import { InvestorProfileType } from '../../hooks/useUserProfile';

interface DiagnosisTabProps {
  userId: string;
  summaryItems: PortfolioSummaryItem[];
  totalCurrentPortfolioValue: number;
  targetPercents: Record<string, number>;
  investorProfile?: InvestorProfileType;
}

export default function DiagnosisTab({
  userId,
  summaryItems,
  totalCurrentPortfolioValue,
  targetPercents,
  investorProfile = 'ALL',
}: DiagnosisTabProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<'ALL' | string>('ALL');

  const isCryptoAsset = useCallback((ticker: string) => isCryptoTicker(ticker), []);
  const isFiiAsset = useCallback((ticker: string) => isFiiTicker(ticker), []);
  const isStockAsset = useCallback((ticker: string) => isStockTicker(ticker), []);

  const fetchAnalysis = useCallback(
    async (forceRefresh = false) => {
      if (summaryItems.length === 0) return;

      setIsLoading(true);
      setError(null);

      const portfolioPayload = summaryItems.map((item) => ({
        ticker: item.ticker,
        quantity: item.quantity,
        averagePrice: item.averagePrice,
        currentPrice: item.currentPrice,
        currentWeight: item.currentPercent,
        dividendYield: item.dy,
        type: isCryptoAsset(item.ticker) ? 'Cripto' : isFiiAsset(item.ticker) ? 'FII' : 'Ação',
      }));

      try {
        const res = await fetch('/api/ai/analyze-portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId || 'anonymous',
            portfolio: portfolioPayload,
            totalValue: totalCurrentPortfolioValue,
            targetAllocation: targetPercents,
            investorProfile: investorProfile || 'ALL',
            forceRefresh,
          }),
        });

        const data = await res.json();

        if (res.ok && data.analysis) {
          setAnalysis(data.analysis);
          setUpdatedAt(data.updatedAt || new Date().toISOString());
          setIsCached(!!data.cached);
        } else {
          setError(
            data.error ||
              'Não foi possível carregar o diagnóstico neste momento.'
          );
        }
      } catch {
        setError(
          'Não foi possível conectar ao diagnóstico no momento. Tente novamente em instantes.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      summaryItems,
      userId,
      totalCurrentPortfolioValue,
      targetPercents,
      isCryptoAsset,
      isFiiAsset,
    ]
  );

  useEffect(() => {
    if (!analysis && summaryItems.length > 0) {
      fetchAnalysis(false);
    }
  }, [userId, summaryItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Diagnóstico quantitativo estruturado e instantâneo
  const diagnosticsData = useMemo(() => {
    if (summaryItems.length === 0) {
      return {
        score: 0,
        ratingLabel: 'Sem dados',
        ratingBg: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
        verdictHeadline: 'Cadastre seus ativos para ver o diagnóstico',
        verdictDescription: 'O sistema auditará risco, concentração e geração de dividendos.',
        stockWeight: 0,
        fiiWeight: 0,
        cryptoWeight: 0,
        stockItems: [],
        fiiItems: [],
        cryptoItems: [],
        topAsset: null as PortfolioSummaryItem | null,
        top3Weight: 0,
        weightedDy: 0,
        monthlyIncomeEst: 0,
        discountedAssets: [] as PortfolioSummaryItem[],
        overweightAssets: [] as PortfolioSummaryItem[],
        underweightAssets: [] as PortfolioSummaryItem[],
        recommendedActions: [] as string[],
      };
    }

    const sortedByWeight = [...summaryItems].sort(
      (a, b) => b.currentPercent - a.currentPercent
    );
    const topAsset = sortedByWeight[0];
    const top3Weight = sortedByWeight
      .slice(0, 3)
      .reduce((acc, i) => acc + i.currentPercent, 0);

    const cryptoItems = summaryItems.filter((i) => isCryptoAsset(i.ticker));
    const fiiItems = summaryItems.filter((i) => isFiiAsset(i.ticker));
    const stockItems = summaryItems.filter((i) => isStockAsset(i.ticker));

    const cryptoWeight = cryptoItems.reduce((acc, i) => acc + i.currentPercent, 0);
    const fiiWeight = fiiItems.reduce((acc, i) => acc + i.currentPercent, 0);
    const stockWeight = stockItems.reduce((acc, i) => acc + i.currentPercent, 0);

    let totalVal = 0;
    let incomeEligibleVal = 0;
    let weightedDySum = 0;
    let totalMonthlyIncome = 0;

    summaryItems.forEach((i) => {
      const val = i.currentTotalValue || i.quantity * i.currentPrice;
      totalVal += val;
      if (!isCryptoAsset(i.ticker)) {
        incomeEligibleVal += val;
        weightedDySum += (i.dy || 0) * val;
      }
      totalMonthlyIncome += (i.annualDividendIncome || 0) / 12;
    });

    const weightedDy = incomeEligibleVal > 0 ? weightedDySum / incomeEligibleVal : 0;

    // Ativos com desconto (abaixo do PM ou abaixo do teto de Bazin)
    const discountedAssets = summaryItems.filter(
      (i) =>
        (i.bazinCeiling > 0 && i.currentPrice <= i.bazinCeiling) ||
        (i.currentPrice > 0 && i.currentPrice < i.averagePrice)
    );

    const underweightAssets = summaryItems.filter((i) => {
      const target = targetPercents[i.ticker] || 0;
      return target > 0 && i.currentPercent < target - 2;
    });

    const overweightAssets = summaryItems.filter((i) => {
      const target = targetPercents[i.ticker] || 0;
      return target > 0 && i.currentPercent > target + 3;
    });

    // Score de Saúde Financeira (0-100)
    let score = 50;

    if (summaryItems.length >= 8) score += 20;
    else if (summaryItems.length >= 5) score += 15;
    else if (summaryItems.length >= 3) score += 8;

    if (topAsset && topAsset.currentPercent > 35) score -= 15;
    else if (topAsset && topAsset.currentPercent > 25) score -= 8;

    if (top3Weight > 65) score -= 10;
    else if (top3Weight < 50) score += 10;

    if (stockWeight >= 20 && fiiWeight >= 20) score += 15;
    else if (stockWeight > 0 && fiiWeight > 0) score += 8;

    if (weightedDy >= 8) score += 10;
    else if (weightedDy >= 6) score += 5;

    const finalScore = Math.min(Math.max(Math.round(score), 10), 98);

    let ratingLabel = 'Equilibrada';
    let ratingBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    let verdictHeadline = 'Carteira Saudável e Bem Estruturada';
    let verdictDescription = 'Boa diversificação, concentração de risco sob controle e fluxo de proventos ativo.';

    if (finalScore >= 85) {
      ratingLabel = 'Excelente Saúde';
      ratingBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      verdictHeadline = 'Excelente Estrutura de Investimentos';
      verdictDescription = 'Sua carteira está muito bem diversificada e perfeitamente posicionada para reinvestir dividendos.';
    } else if (finalScore >= 70) {
      ratingLabel = 'Boa Estrutura';
      ratingBg = 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
      verdictHeadline = 'Carteira Estável com Bons Fundamentos';
      verdictDescription = 'Estrutura sólida. Mantenha os aportes regulares nos ativos com boa margem de segurança.';
    } else if (finalScore >= 50) {
      ratingLabel = 'Atenção aos Aportes';
      ratingBg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      verdictHeadline = 'Oportunidades de Reequilíbrio Identificadas';
      verdictDescription = 'Recomendamos direcionar os próximos aportes para diluir a concentração dos maiores ativos.';
    } else {
      ratingLabel = 'Alta Concentração';
      ratingBg = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      verdictHeadline = 'Carteira Concentrada em Poucos Ativos';
      verdictDescription = 'O risco está concentrado. Evite novos aportes nas maiores posições até equilibrar os demais ativos.';
    }

    // Ações recomendadas de decisão rápida
    const recommendedActions: string[] = [];

    if (discountedAssets.length > 0) {
      recommendedActions.push(
        `Aportar prioritariamente em ${discountedAssets
          .map((d) => d.ticker)
          .slice(0, 3)
          .join(', ')} (cotados com desconto ou margem de segurança frente ao Preço Médio/Teto).`
      );
    }

    if (topAsset && topAsset.currentPercent > 30) {
      recommendedActions.push(
        `Pausar temporariamente novos aportes em ${topAsset.ticker} (${topAsset.currentPercent.toFixed(
          1
        )}% da carteira) para diluir a exposição ao risco individual.`
      );
    }

    if (summaryItems.length < 6) {
      recommendedActions.push(
        'Ampliar a diversificação incluindo novos setores perenes da economia brasileira (Energia, Bancos, Saneamento, Logística).'
      );
    }

    if (recommendedActions.length === 0) {
      recommendedActions.push(
        'Manter os aportes regulares mensais e reinvestir 100% dos dividendos recebidos para acelerar a bola de neve.'
      );
    }

    return {
      score: finalScore,
      ratingLabel,
      ratingBg,
      verdictHeadline,
      verdictDescription,
      stockWeight,
      fiiWeight,
      cryptoWeight,
      stockItems,
      fiiItems,
      cryptoItems,
      topAsset,
      top3Weight,
      weightedDy,
      monthlyIncomeEst: totalMonthlyIncome,
      discountedAssets,
      overweightAssets,
      underweightAssets,
      recommendedActions,
    };
  }, [summaryItems, targetPercents, isCryptoAsset, isFiiAsset, isStockAsset]);

  // Custom markdown components for crystal-clear readability
  const customMarkdownComponents = useMemo(() => ({
    p: ({ children }: any) => (
      <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed my-2 font-normal">
        {children}
      </p>
    ),
    ul: ({ children }: any) => (
      <ul className="space-y-2 my-2.5 list-none pl-0">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="space-y-2 my-2.5 list-none pl-0">
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-black/[0.04] dark:border-white/[0.04] text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal hover:border-black/[0.08] dark:hover:border-white/[0.08] transition-colors">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2 inline-block" />
        <div className="flex-1 space-y-0.5">{children}</div>
      </li>
    ),
    strong: ({ children }: any) => (
      <strong className="font-bold text-zinc-950 dark:text-white">
        {children}
      </strong>
    ),
    em: ({ children }: any) => (
      <em className="text-zinc-700 dark:text-zinc-300 italic font-medium">
        {children}
      </em>
    ),
    blockquote: ({ children }: any) => (
      <div className="p-3 my-2 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30 rounded-xl text-xs sm:text-sm text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <div className="flex-1 leading-relaxed">{children}</div>
      </div>
    ),
  }), []);

  // Parse structured report sections
  const parsedSections = useMemo(() => {
    if (!analysis) return [];

    const rawSections = analysis.split(/(?=^###\s+)/m).filter((s) => s.trim().length > 0);

    if (rawSections.length === 0) {
      return [
        {
          id: 'general',
          num: '01',
          title: 'Diagnóstico Consolidado da Carteira',
          body: analysis,
          iconType: 'health' as const,
          tag: 'Visão Geral',
          badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          iconBg: 'bg-emerald-500/10 text-emerald-500',
        },
      ];
    }

    return rawSections.map((sec, idx) => {
      const lines = sec.trim().split('\n');
      const firstLine = lines[0].replace(/^###\s+/, '').trim();
      const cleanTitle = firstLine.replace(/^\d+[\.\-\)]\s*/, '').trim();
      const body = lines.slice(1).join('\n').trim();

      let iconType: 'health' | 'risk' | 'income' | 'action' = 'health';
      let tag = `Pilar ${idx + 1}`;
      let badgeColor = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      let iconBg = 'bg-indigo-500/10 text-indigo-500';

      const lower = cleanTitle.toLowerCase();
      if (lower.includes('saúde') || lower.includes('diagnóstico') || lower.includes('geral')) {
        iconType = 'health';
        tag = 'Saúde & Equilíbrio';
        badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
        iconBg = 'bg-emerald-500/10 text-emerald-500';
      } else if (lower.includes('risco') || lower.includes('concentra')) {
        iconType = 'risk';
        tag = 'Gestão de Risco';
        badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
        iconBg = 'bg-amber-500/10 text-amber-500';
      } else if (
        lower.includes('renda') ||
        lower.includes('dividend') ||
        lower.includes('provento') ||
        lower.includes('eficiência')
      ) {
        iconType = 'income';
        tag = 'Dividendos & Renda';
        badgeColor = 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
        iconBg = 'bg-teal-500/10 text-teal-500';
      } else if (
        lower.includes('recomenda') ||
        lower.includes('estratég') ||
        lower.includes('aporte')
      ) {
        iconType = 'action';
        tag = 'Próximos Aportes';
        badgeColor = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
        iconBg = 'bg-indigo-500/10 text-indigo-500';
      }

      return {
        id: `sec-${idx}`,
        num: String(idx + 1).padStart(2, '0'),
        title: cleanTitle || firstLine,
        body,
        iconType,
        tag,
        badgeColor,
        iconBg,
      };
    });
  }, [analysis]);

  const visibleSections = useMemo(() => {
    if (selectedTopicFilter === 'ALL') return parsedSections;
    return parsedSections.filter((s) => s.iconType === selectedTopicFilter);
  }, [parsedSections, selectedTopicFilter]);

  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const handleCopyFullReport = useCallback(() => {
    if (!analysis) return;

    const textToCopy = `DIAGNÓSTICO ESTRATÉGICO DA CARTEIRA (DYELDI)\nData: ${
      formattedDate || new Date().toLocaleDateString('pt-BR')
    }\nPontuação de Saúde: ${diagnosticsData.score}/100 (${
      diagnosticsData.ratingLabel
    })\n\n${analysis}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  }, [analysis, formattedDate, diagnosticsData.score, diagnosticsData.ratingLabel]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. HERO CARD DE DIAGNÓSTICO (< 3s COMPREHENSION) */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            {/* Score Badge */}
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 flex flex-col items-center justify-center font-mono shrink-0 shadow-xs">
              <span className="text-2xl font-semibold leading-none tabular-nums">{diagnosticsData.score}</span>
              <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">
                Score
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  Diagnóstico da Carteira
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider border ${diagnosticsData.ratingBg}`}>
                  {diagnosticsData.ratingLabel}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white mt-0.5 tracking-tight">
                {diagnosticsData.verdictHeadline}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                {diagnosticsData.verdictDescription}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-center flex-wrap">
            {analysis && (
              <button
                type="button"
                onClick={handleCopyFullReport}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.08] font-medium rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                title="Copiar relatório completo"
              >
                {copiedReport ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span>{copiedReport ? 'Copiado!' : 'Copiar'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchAnalysis(true)}
              disabled={isLoading || summaryItems.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-950 font-medium rounded-xl text-xs transition shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Avaliando...' : 'Reavaliar'}</span>
            </button>
          </div>
        </div>

        {/* 4 Mini-Cards de Pilares Essenciais */}
        {summaryItems.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* 1. Diversificação */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block">
                  Diversificação
                </span>
                <span className="text-sm sm:text-base font-mono font-semibold text-zinc-900 dark:text-white block mt-0.5 tabular-nums">
                  {summaryItems.length} {summaryItems.length === 1 ? 'ativo' : 'ativos'}
                </span>
                <span
                  className={`text-[10px] font-medium block mt-0.5 ${
                    summaryItems.length >= 6
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {summaryItems.length >= 8
                    ? '🟢 Excelente'
                    : summaryItems.length >= 5
                    ? '🟢 Boa'
                    : '🟡 Concentrada'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300">
                <Layers className="w-4 h-4" />
              </div>
            </div>

            {/* 2. Concentração Top 3 */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block">
                  Top 3 Ativos
                </span>
                <span className="text-sm sm:text-base font-mono font-semibold text-zinc-900 dark:text-white block mt-0.5 tabular-nums">
                  {diagnosticsData.top3Weight.toFixed(1)}%
                </span>
                <span
                  className={`text-[10px] font-medium block mt-0.5 ${
                    diagnosticsData.top3Weight > 65
                      ? 'text-red-600 dark:text-red-400'
                      : diagnosticsData.top3Weight > 50
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {diagnosticsData.top3Weight > 65
                    ? '🔴 Alta'
                    : diagnosticsData.top3Weight > 50
                    ? '🟡 Moderada'
                    : '🟢 Segura'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300">
                <Target className="w-4 h-4" />
              </div>
            </div>

            {/* 3. Desconto para Aporte */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block">
                  Oportunidades
                </span>
                <span className="text-sm sm:text-base font-mono font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5 tabular-nums">
                  {diagnosticsData.discountedAssets.length} ativos
                </span>
                <span className="text-[10px] font-medium text-zinc-500 block mt-0.5">
                  {diagnosticsData.discountedAssets.length > 0
                    ? '🟢 Margem de Segurança'
                    : '⚪ Preços em Linha'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>

            {/* 4. Fluxo de Proventos */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block">
                  Renda Passiva
                </span>
                <span className="text-sm sm:text-base font-mono font-semibold text-zinc-900 dark:text-white block mt-0.5 tabular-nums">
                  ~{formatBRL(diagnosticsData.monthlyIncomeEst)}/mês
                </span>
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 block mt-0.5 tabular-nums">
                  DY {diagnosticsData.weightedDy.toFixed(1)}% a.a.
                </span>
              </div>
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500">
                <Coins className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. ALOCAÇÃO POR CLASSE DE ATIVOS & CONCENTRAÇÃO */}
      {summaryItems.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Distribuição por Classe */}
          <div className="lg:col-span-7 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white tracking-tight">
                  Distribuição por Classe de Ativos
                </h4>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">
                Total: {formatBRL(totalCurrentPortfolioValue)}
              </span>
            </div>

            {/* Barra Multi-Segmentada */}
            <div className="w-full h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex gap-0.5">
              {diagnosticsData.stockWeight > 0 && (
                <div
                  style={{ width: `${diagnosticsData.stockWeight}%` }}
                  className="bg-indigo-500 transition-all duration-500"
                  title={`Ações: ${diagnosticsData.stockWeight.toFixed(1)}%`}
                />
              )}
              {diagnosticsData.fiiWeight > 0 && (
                <div
                  style={{ width: `${diagnosticsData.fiiWeight}%` }}
                  className="bg-emerald-500 transition-all duration-500"
                  title={`FIIs: ${diagnosticsData.fiiWeight.toFixed(1)}%`}
                />
              )}
              {diagnosticsData.cryptoWeight > 0 && (
                <div
                  style={{ width: `${diagnosticsData.cryptoWeight}%` }}
                  className="bg-amber-500 transition-all duration-500"
                  title={`Cripto: ${diagnosticsData.cryptoWeight.toFixed(1)}%`}
                />
              )}
            </div>

            {/* Legenda e Detalhes de Classe */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-black/[0.04] dark:border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Ações</span>
                </div>
                <span className="text-xs sm:text-sm font-bold font-mono text-zinc-900 dark:text-white block tabular-nums">
                  {diagnosticsData.stockWeight.toFixed(1)}%
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  {diagnosticsData.stockItems.length} ativos
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-black/[0.04] dark:border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">FIIs</span>
                </div>
                <span className="text-xs sm:text-sm font-bold font-mono text-zinc-900 dark:text-white block tabular-nums">
                  {diagnosticsData.fiiWeight.toFixed(1)}%
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  {diagnosticsData.fiiItems.length} fundos
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-black/[0.04] dark:border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Cripto / Outros</span>
                </div>
                <span className="text-xs sm:text-sm font-bold font-mono text-zinc-900 dark:text-white block tabular-nums">
                  {diagnosticsData.cryptoWeight.toFixed(1)}%
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  {diagnosticsData.cryptoItems.length} ativos
                </span>
              </div>
            </div>
          </div>

          {/* Ativos com Margem de Segurança / Oportunidades */}
          <div className="lg:col-span-5 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white tracking-tight">
                  Margem de Segurança (Aportes)
                </h4>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {diagnosticsData.discountedAssets.length} com desconto
              </span>
            </div>

            <div className="space-y-1.5">
              {diagnosticsData.discountedAssets.length > 0 ? (
                diagnosticsData.discountedAssets.slice(0, 3).map((item) => {
                  const discountPercent =
                    item.averagePrice > 0
                      ? ((item.averagePrice - item.currentPrice) / item.averagePrice) * 100
                      : 0;

                  return (
                    <div
                      key={item.ticker}
                      className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold font-mono text-zinc-900 dark:text-white">
                            {item.ticker}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {formatBRLDecimal(item.currentPrice)}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 block">
                          Preço Médio: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{formatBRLDecimal(item.averagePrice)}</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        {discountPercent > 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono">
                            -{discountPercent.toFixed(1)}% abaixo do PM
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-bold font-mono">
                            Abaixo do Teto Bazin
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
                  Nenhum ativo com cotação abaixo do Preço Médio no momento.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. CARD DE AÇÕES RECOMENDADAS IMEDIATAS (O QUE FAZER AGORA?) */}
      {summaryItems.length > 0 && diagnosticsData.recommendedActions.length > 0 && (
        <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 shadow-xs space-y-2.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white tracking-tight">
              O que fazer agora? (Ações Recomendadas)
            </h4>
          </div>
          <div className="space-y-1.5">
            {diagnosticsData.recommendedActions.map((action, idx) => (
              <div
                key={`action-${idx}`}
                className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04]"
              >
                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-mono tabular-nums">
                  {idx + 1}
                </span>
                <span className="leading-relaxed font-medium">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. RELATÓRIO ANALÍTICO DETALHADO */}
      {summaryItems.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] space-y-3 shadow-xs">
          <Activity className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700" />
          <div className="space-y-1">
            <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
              Nenhum ativo com saldo na carteira
            </p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto font-medium">
              Cadastre suas operações de compra para que o sistema gere a auditoria de risco, diversificação e dividendos.
            </p>
          </div>
        </div>
      ) : isLoading && !analysis ? (
        <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-8 text-center space-y-3 shadow-xs">
          <div className="inline-flex p-3 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] animate-pulse">
            <Sparkles className="w-5 h-5 text-amber-500 animate-spin" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white">
              Analisando a saúde e a distribuição da sua carteira...
            </p>
            <p className="text-xs text-zinc-500 font-medium">
              Calculando equilíbrio setorial, histórico de rendimentos e margem de segurança.
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-amber-800 dark:text-amber-300 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1.5">
            <p className="font-semibold text-sm text-amber-950 dark:text-amber-200">
              Aviso sobre o Diagnóstico
            </p>
            <p className="text-amber-800 dark:text-amber-300 leading-relaxed font-medium">{error}</p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => fetchAnalysis(true)}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-xs transition cursor-pointer shadow-xs"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      ) : analysis ? (
        <div className="space-y-4">
          {/* Header do Relatório */}
          <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] text-zinc-900 dark:text-white shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white tracking-tight">
                  Relatório Estratégico Completo
                </h3>
                <p className="text-[11px] text-zinc-500 font-medium">
                  Auditoria detalhada com recomendações práticas para a sua carteira
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto overflow-x-auto max-w-full pb-1 sm:pb-0">
              {/* Filter Pills */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-black/[0.04] dark:border-white/[0.04] text-[11px] font-medium whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setSelectedTopicFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    selectedTopicFilter === 'ALL'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Todos ({parsedSections.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTopicFilter('health')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    selectedTopicFilter === 'health'
                      ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Activity className="w-3 h-3" />
                  <span>Saúde</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTopicFilter('risk')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    selectedTopicFilter === 'risk'
                      ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>Risco</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTopicFilter('income')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    selectedTopicFilter === 'income'
                      ? 'bg-white dark:bg-zinc-800 text-teal-600 dark:text-teal-400 shadow-xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Coins className="w-3 h-3" />
                  <span>Dividendos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTopicFilter('action')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    selectedTopicFilter === 'action'
                      ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>Aportes</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cards de Tópicos do Relatório */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleSections.map((section) => (
              <div
                key={section.id}
                className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-black/[0.12] dark:hover:border-white/[0.16] transition-all"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-black/[0.05] dark:border-white/[0.05]">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${section.iconBg} shrink-0`}>
                        {section.iconType === 'health' && <Activity className="w-4 h-4" />}
                        {section.iconType === 'risk' && <ShieldAlert className="w-4 h-4" />}
                        {section.iconType === 'income' && <Coins className="w-4 h-4" />}
                        {section.iconType === 'action' && <Zap className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500">
                            #{section.num}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider border ${section.badgeColor}`}>
                            {section.tag}
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white mt-0.5 tracking-tight">
                          {section.title}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Card Body with Custom Markdown Styling */}
                  <div className="pt-2 text-xs sm:text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    <Markdown components={customMarkdownComponents}>
                      {section.body}
                    </Markdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
