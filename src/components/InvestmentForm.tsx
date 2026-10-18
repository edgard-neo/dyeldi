import React, { useState, useMemo, useCallback } from 'react';
import { InvestmentInputs, StockQuote, ConsolidatedPortfolio } from '../types';
import {
  calculateBazinCeiling,
  calculateMagicNumber,
  calculateGrahamPrice,
} from '../utils/calculator';
import { formatBRL, formatBRLDecimal } from '../utils/calculator';
import {
  TrendingUp,
  RefreshCw,
  Sparkles,
  Target,
  Zap,
  Sliders,
  Wallet,
  Search,
  CheckCircle2,
  Calendar,
  DollarSign,
  Percent,
  Coins,
  ShieldCheck,
  Award,
  BarChart2,
  Bookmark,
  Sprout,
  Palmtree,
  Crown,
} from 'lucide-react';
import TickerAutocomplete from './TickerAutocomplete';
import InfoTooltip from './InfoTooltip';
import { InvestorProfileType } from '../hooks/useUserProfile';

interface Props {
  inputs: InvestmentInputs;
  setInputs: React.Dispatch<React.SetStateAction<InvestmentInputs>>;
  stockQuote: StockQuote | null;
  loadingStock: boolean;
  onSearchTicker: (ticker: string) => void;
  onCalculate: () => void;
  consolidatedData?: ConsolidatedPortfolio;
  onApplyPortfolioToProjection?: (consolidated: ConsolidatedPortfolio) => void;
  investorProfile?: InvestorProfileType;
  bazinHurdleRate?: number;
}

const POPULAR_TICKERS_BY_PROFILE: Record<InvestorProfileType, string[]> = {
  ALL: ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'MXRF11', 'WEGE3', 'HGLG11', 'BTC', 'ETH'],
  STOCKS: ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'ITSA4', 'WEGE3', 'TAEE11', 'SAPR11', 'B3SA3'],
  FIIS: ['MXRF11', 'HGLG11', 'XPML11', 'KNCR11', 'VISC11', 'BBRC11', 'TGAR11', 'HGBS11'],
  CRYPTO: ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'XRP', 'DOGE', 'LINK', 'AVAX'],
};

interface QuickGoalPreset {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  initial: number;
  monthly: number;
  years: number;
  dy: number;
  appreciation: number;
}

const QUICK_GOALS: QuickGoalPreset[] = [
  {
    id: 'starter',
    title: 'Iniciante',
    subtitle: 'R$ 500/mês a 10 anos',
    icon: Sprout,
    initial: 1000,
    monthly: 500,
    years: 10,
    dy: 8.5,
    appreciation: 4.5,
  },
  {
    id: 'first_100k',
    title: 'Primeiros R$ 100k',
    subtitle: 'Aporte de R$ 1.000/mês',
    icon: Target,
    initial: 5000,
    monthly: 1000,
    years: 6,
    dy: 9.0,
    appreciation: 5.0,
  },
  {
    id: 'income_3k',
    title: 'Renda R$ 3.000/mês',
    subtitle: 'Foco em dividendos',
    icon: Palmtree,
    initial: 10000,
    monthly: 1500,
    years: 12,
    dy: 10.0,
    appreciation: 4.0,
  },
  {
    id: 'million',
    title: 'R$ 1 Milhão',
    subtitle: 'Liberdade Financeira',
    icon: Crown,
    initial: 20000,
    monthly: 2500,
    years: 15,
    dy: 9.5,
    appreciation: 5.5,
  },
];

type ModeTab = 'PRESETS' | 'B3_STOCK' | 'PORTFOLIO';

export default function InvestmentForm({
  inputs,
  setInputs,
  stockQuote,
  loadingStock,
  onSearchTicker,
  onCalculate,
  consolidatedData,
  onApplyPortfolioToProjection,
  investorProfile = 'ALL',
  bazinHurdleRate = 0.06,
}: Props) {
  const [customTicker, setCustomTicker] = useState(inputs.ticker);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>('first_100k');
  const [activeMode, setActiveMode] = useState<ModeTab>('PRESETS');

  const popularTickersList = useMemo(() => {
    return POPULAR_TICKERS_BY_PROFILE[investorProfile] || POPULAR_TICKERS_BY_PROFILE.ALL;
  }, [investorProfile]);

  const handleApplyGoal = useCallback(
    (goal: QuickGoalPreset) => {
      setSelectedGoalId(goal.id);
      setInputs((prev) => ({
        ...prev,
        initialInvestment: goal.initial,
        monthlyContribution: goal.monthly,
        years: goal.years,
        dividendYield: goal.dy,
        expectedAppreciation: goal.appreciation,
        reinvestDividends: true,
      }));
    },
    [setInputs]
  );

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const ticker = customTicker.trim();
      if (ticker) {
        onSearchTicker(ticker);
      }
    },
    [customTicker, onSearchTicker]
  );

  const handleQuickTicker = useCallback(
    (ticker: string) => {
      setCustomTicker(ticker);
      onSearchTicker(ticker);
    },
    [onSearchTicker]
  );

  // Valuation metrics
  const bazinCeiling = useMemo(() => {
    if (!stockQuote) return 0;
    return calculateBazinCeiling(stockQuote.price, stockQuote.dy, bazinHurdleRate);
  }, [stockQuote, bazinHurdleRate]);

  const magicNumber = useMemo(() => {
    if (!stockQuote) return 0;
    return calculateMagicNumber(stockQuote.dy);
  }, [stockQuote]);

  const grahamResult = useMemo(() => {
    if (!stockQuote) return null;
    return calculateGrahamPrice(
      stockQuote.price,
      stockQuote.lpa,
      stockQuote.vpa,
      stockQuote.ticker
    );
  }, [stockQuote]);

  return (
    <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs overflow-hidden">
      {/* 1. SELETOR DE MODO DE SIMULAÇÃO (ABAS LIMPAS) */}
      <div className="p-3 bg-zinc-50/80 dark:bg-zinc-950/60 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-900 p-1 rounded-xl text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveMode('PRESETS')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'PRESETS'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Metas Prontas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('B3_STOCK')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'B3_STOCK'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-indigo-500" />
            <span>Ativo da B3</span>
          </button>

          {consolidatedData && consolidatedData.totalCurrentValue > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveMode('PORTFOLIO');
                if (onApplyPortfolioToProjection) {
                  onApplyPortfolioToProjection(consolidatedData);
                }
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeMode === 'PORTFOLIO'
                  ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Minha Carteira</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-6">
        {/* CONTEÚDO DA ABA SELECIONADA */}
        {activeMode === 'PRESETS' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Selecione um Objetivo Financeiro:
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_GOALS.map((goal) => {
                const isSelected = selectedGoalId === goal.id;
                const GoalIcon = goal.icon;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => handleApplyGoal(goal)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-950/40 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 border-black/[0.04] dark:border-white/[0.04] text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div
                        className={`p-1.5 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-400 dark:text-emerald-600'
                            : 'bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <GoalIcon className="w-4 h-4 shrink-0" />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold block truncate">{goal.title}</span>
                      <span
                        className={`text-xs block mt-0.5 font-mono truncate ${
                          isSelected ? 'text-zinc-300 dark:text-zinc-400' : 'text-zinc-500'
                        }`}
                      >
                        {goal.subtitle}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeMode === 'B3_STOCK' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Buscar Ação ou FII na B3:
              </span>
              {stockQuote && (
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {stockQuote.ticker}: {formatBRLDecimal(stockQuote.price)} ({stockQuote.dy.toFixed(1)}% DY)
                </span>
              )}
            </div>

            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="flex-1">
                <TickerAutocomplete
                  value={customTicker}
                  onChange={(val) => setCustomTicker(val.toUpperCase())}
                  onSelectResult={(item) => {
                    setCustomTicker(item.ticker.toUpperCase());
                    onSearchTicker(item.ticker.toUpperCase());
                  }}
                  placeholder={
                    investorProfile === 'FIIS'
                      ? 'Ex: MXRF11, HGLG11, XPML11...'
                      : investorProfile === 'STOCKS'
                      ? 'Ex: PETR4, VALE3, ITUB4, WEGE3...'
                      : investorProfile === 'CRYPTO'
                      ? 'Ex: BTC, ETH, SOL, BNB...'
                      : 'Ex: PETR4, MXRF11, ITUB4, BTC...'
                  }
                  className="w-full"
                />
              </div>
              <button
                type="submit"
                disabled={loadingStock || !customTicker.trim()}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-950 font-medium rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingStock ? 'animate-spin' : ''}`} />
                <span>{loadingStock ? 'Buscando...' : 'Carregar'}</span>
              </button>
            </form>

            {/* Quick Tickers */}
            <div className="flex flex-wrap gap-1">
              {popularTickersList.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleQuickTicker(t)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                    customTicker === t
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold'
                      : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Indicadores do Ativo Carregado */}
            {stockQuote && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-black/[0.04] dark:border-white/[0.04] grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 uppercase font-bold tracking-wider block">Teto Bazin</span>
                  <span className="text-xs font-bold font-mono text-zinc-900 dark:text-white">
                    {bazinCeiling > 0 ? formatBRLDecimal(bazinCeiling) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 uppercase font-bold tracking-wider block">Nº Mágico</span>
                  <span className="text-xs font-bold font-mono text-zinc-900 dark:text-white">
                    {magicNumber > 0 ? `${magicNumber} cotas` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 uppercase font-bold tracking-wider block">Graham</span>
                  <span className="text-xs font-bold font-mono text-zinc-900 dark:text-white">
                    {grahamResult?.isApplicable && grahamResult.grahamPrice > 0
                      ? formatBRLDecimal(grahamResult.grahamPrice)
                      : 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeMode === 'PORTFOLIO' && consolidatedData && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Simulação Baseada na Carteira Real</span>
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {formatBRL(consolidatedData.totalCurrentValue)}
              </span>
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
              Carregamos automaticamente o seu patrimônio atual e o Dividend Yield médio ponderado (<strong>{consolidatedData.weightedDy.toFixed(1)}% DY</strong>) para simular o futuro dos seus investimentos.
            </p>
          </div>
        )}

          {/* 2. CONFIGURAÇÃO DE PARÂMETROS FINANCEIROS */}
          <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-zinc-500" />
              <span>Ajuste os Parâmetros:</span>
            </h4>
            <button
              type="button"
              onClick={() => {
                setInputs((prev) => ({
                  ...prev,
                  reinvestDividends: !prev.reinvestDividends,
                }));
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border flex items-center gap-1.5 ${
                inputs.reinvestDividends
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold'
                  : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-500 border-transparent'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Reinvestir Dividendos: {inputs.reinvestDividends ? 'Sim' : 'Não'}</span>
            </button>
          </div>

          {/* Grid de Inputs de Valores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Aporte Inicial */}
            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-black/[0.04] dark:border-white/[0.04] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  Aporte Inicial
                  <InfoTooltip
                    title="Aporte Inicial"
                    description="Montante que você possui hoje para começar a simulação."
                  />
                </label>
                <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                  {formatBRL(inputs.initialInvestment)}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400">
                  R$
                </span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={inputs.initialInvestment}
                  onChange={(e) => {
                    setSelectedGoalId(null);
                    setInputs((prev) => ({
                      ...prev,
                      initialInvestment: Math.max(0, Number(e.target.value) || 0),
                    }));
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.08] rounded-xl text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition"
                />
              </div>
              <div className="flex gap-1 pt-0.5">
                {[0, 5000, 10000, 50000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setSelectedGoalId(null);
                      setInputs((prev) => ({ ...prev, initialInvestment: v }));
                    }}
                    className="flex-1 py-1 rounded-md bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-black/[0.06] dark:border-white/[0.06] text-xs font-mono text-zinc-600 dark:text-zinc-400 transition"
                  >
                    +{v === 0 ? 'Zerado' : v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>

            {/* Aporte Mensal */}
            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-black/[0.04] dark:border-white/[0.04] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  Aporte Mensal
                  <InfoTooltip
                    title="Aporte Mensal"
                    description="Valor que você pretende poupar e investir todo mês."
                  />
                </label>
                <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                  {formatBRL(inputs.monthlyContribution)}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400">
                  R$
                </span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={inputs.monthlyContribution}
                  onChange={(e) => {
                    setSelectedGoalId(null);
                    setInputs((prev) => ({
                      ...prev,
                      monthlyContribution: Math.max(0, Number(e.target.value) || 0),
                    }));
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.08] rounded-xl text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition"
                />
              </div>
              <div className="flex gap-1 pt-0.5">
                {[200, 500, 1000, 2500].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setSelectedGoalId(null);
                      setInputs((prev) => ({ ...prev, monthlyContribution: v }));
                    }}
                    className="flex-1 py-1 rounded-md bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-black/[0.06] dark:border-white/[0.06] text-xs font-mono text-zinc-600 dark:text-zinc-400 transition"
                  >
                    +{v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Slider de Prazo */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-black/[0.04] dark:border-white/[0.04] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>Prazo de Investimento</span>
              </label>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold font-mono text-zinc-900 dark:text-white">
                  {inputs.years}
                </span>
                <span className="text-xs text-zinc-500">
                  {inputs.years === 1 ? 'ano' : 'anos'} ({inputs.years * 12} meses)
                </span>
              </div>
            </div>

            <input
              type="range"
              min="1"
              max="35"
              step="1"
              value={inputs.years}
              onChange={(e) => {
                setSelectedGoalId(null);
                setInputs((prev) => ({ ...prev, years: Number(e.target.value) }));
              }}
              className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white"
            />

            <div className="flex items-center justify-between gap-1 pt-1">
              {[3, 5, 10, 15, 20, 30].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setSelectedGoalId(null);
                    setInputs((prev) => ({ ...prev, years: yr }));
                  }}
                  className={`flex-1 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                    inputs.years === yr
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-black/[0.06] dark:border-white/[0.06] hover:bg-zinc-100'
                  }`}
                >
                  {yr}a
                </button>
              ))}
            </div>
          </div>

          {/* Taxas de Retorno (% a.a.) */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
                <div className="flex items-center justify-between sm:block sm:w-28 shrink-0">
                  <label className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                    Dividend Yield (DY)
                  </label>
                  <span className="sm:hidden text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {inputs.dividendYield.toFixed(1)}% a.a.
                  </span>
                </div>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={inputs.dividendYield}
                    onChange={(e) => {
                      setSelectedGoalId(null);
                      setInputs((prev) => ({
                        ...prev,
                        dividendYield: Math.max(0, Number(e.target.value) || 0),
                      }));
                    }}
                    className="w-full pr-8 pl-3 py-2 bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.08] rounded-xl text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400">
                    %
                  </span>
                </div>
                <span className="hidden sm:inline w-16 shrink-0 text-right text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {inputs.dividendYield.toFixed(1)}% a.a.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
                <div className="flex items-center justify-between sm:block sm:w-28 shrink-0">
                  <label className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                    Valorização da Cota
                  </label>
                  <span className="sm:hidden text-xs font-mono font-bold text-zinc-900 dark:text-white">
                    {inputs.expectedAppreciation.toFixed(1)}% a.a.
                  </span>
                </div>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="-20"
                    max="50"
                    step="0.5"
                    value={inputs.expectedAppreciation}
                    onChange={(e) => {
                      setSelectedGoalId(null);
                      setInputs((prev) => ({
                        ...prev,
                        expectedAppreciation: Number(e.target.value) || 0,
                      }));
                    }}
                    className="w-full pr-8 pl-3 py-2 bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.08] rounded-xl text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400">
                    %
                  </span>
                </div>
                <span className="hidden sm:inline w-16 shrink-0 text-right text-xs font-mono font-bold text-zinc-900 dark:text-white">
                  {inputs.expectedAppreciation.toFixed(1)}% a.a.
                </span>
              </div>
            </div>

            {/* Estratégias Rápidas */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedGoalId(null);
                  setInputs((prev) => ({
                    ...prev,
                    dividendYield: 11.0,
                    expectedAppreciation: 3.0,
                  }));
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
              >
                🏢 FIIs (11% DY + 3% Val.)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedGoalId(null);
                  setInputs((prev) => ({
                    ...prev,
                    dividendYield: 8.0,
                    expectedAppreciation: 6.0,
                  }));
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
              >
                📈 Ações Dividendos (8% DY + 6% Val.)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedGoalId(null);
                  setInputs((prev) => ({
                    ...prev,
                    dividendYield: 9.0,
                    expectedAppreciation: 5.0,
                  }));
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
              >
                ⚖️ Balanceada (9% DY + 5% Val.)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedGoalId(null);
                  setInputs((prev) => ({
                    ...prev,
                    dividendYield: 0.0,
                    expectedAppreciation: 25.0,
                  }));
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
              >
                🪙 Cripto / Ciclo (0% DY + 25% Val.)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}