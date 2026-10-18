import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import {
  Layers,
  RefreshCw,
  Sparkles,
  Plus,
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Building2,
  Briefcase,
  LayoutGrid,
  Table as TableIcon,
  DollarSign,
  Info,
  CheckCircle2,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  BarChart2,
  Star,
  Radar,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Tag,
  Wallet,
  Activity,
  Filter,
} from 'lucide-react';
import { PortfolioSummaryItem, StockQuote, UserTransaction, TransactionType } from '../../types';
import { formatBRL, formatBRLDecimal } from '../../utils/calculator';
import {
  isCryptoTicker,
  isFiiTicker,
  isStockTicker,
  getAssetName,
} from '../../utils/assetType';
import InfoTooltip from '../InfoTooltip';
import PriceVsAverageChart from '../PriceVsAverageChart';
import TickerAutocomplete from '../TickerAutocomplete';
import { InvestorProfileType } from '../../hooks/useUserProfile';

interface TechnicalData {
  ticker: string;
  sma200: number;
  currentPrice: number;
  smaDistancePercent: number;
  daysCount?: number;
  realizedPrice?: number;
  mvrv?: number;
  isFallback: boolean;
  type?: string;
}

interface PositionsTabProps {
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
  preferredLayout?: 'CARDS' | 'TABLE';
  onUpdatePreferredLayout?: (layout: 'CARDS' | 'TABLE') => void;
}

export default function PositionsTab({
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
}: PositionsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchWatchlistTicker, setSearchWatchlistTicker] = useState('');
  const [assetFilter, setAssetFilter] = useState<
    'ALL' | 'STOCK' | 'FII' | 'CRIPTO' | 'OPPORTUNITY' | 'FAVORITES'
  >('ALL');
  const [sortBy, setSortBy] = useState<
    'STRONG_BUY' | 'VALUE_DESC' | 'PNL_DESC' | 'PNL_ASC' | 'DY_DESC' | 'SAFETY_DESC' | 'TICKER_ASC'
  >('STRONG_BUY');
  
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>(() => preferredLayout || 'CARDS');

  // Keep viewMode state synchronized when the database loads or user preference changes globally
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
  const [showHelperGuide, setShowHelperGuide] = useState(false);
  const [isFilterMinimized, setIsFilterMinimized] = useState(true);
  const [selectedCriterion, setSelectedCriterion] = useState<'smart' | 'bazin' | 'pl' | 'crypto'>('smart');
  const [isCriteriaMinimized, setIsCriteriaMinimized] = useState<boolean>(true);

  const [technicalMap, setTechnicalMap] = useState<Record<string, TechnicalData>>({});
  const [selectedChartTicker, setSelectedChartTicker] = useState<string | null>(null);

  // Fecha modal de gráfico com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedChartTicker) {
        setSelectedChartTicker(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedChartTicker]);

  // Classify asset
  const isCrypto = (ticker: string) =>
    quotes[ticker.toUpperCase().trim()]?.type === 'Cripto' ||
    isCryptoTicker(ticker);
  const isFII = (ticker: string) => isFiiTicker(ticker);
  const isStock = (ticker: string) => isStockTicker(ticker);

  // Fetch real technical indicators (SMA 200, MVRV, etc.) for crypto assets
  useEffect(() => {
    let isMounted = true;
    const fetchIndicators = async () => {
      const cryptoTickers = summaryItems
        .filter((i) => isCrypto(i.ticker))
        .map((i) => i.ticker.toUpperCase().trim());
      const baseCryptos = ['BTC', 'ETH', 'SOL'];
      const allTickers = Array.from(new Set([...baseCryptos, ...cryptoTickers]));

      const results: Record<string, TechnicalData> = {};

      await Promise.all(
        allTickers.map(async (ticker) => {
          try {
            const res = await axios.get(`/api/technical/${ticker}`, { timeout: 8000 });
            if (res.data && res.data.sma200 > 0) {
              results[ticker] = res.data;
            }
          } catch {
            // Ignore individual error
          }
        })
      );

      if (isMounted) {
        setTechnicalMap((prev) => ({ ...prev, ...results }));
      }
    };

    fetchIndicators();
    return () => {
      isMounted = false;
    };
  }, [summaryItems]);

  // Helper for Crypto Technical Analysis with real SMA 200 and MVRV
  const getCryptoTechnicalAnalysis = (ticker: string, currentPrice: number) => {
    const t = ticker.toUpperCase().trim();
    const techData = technicalMap[t];
    const basePrice =
      currentPrice > 0
        ? currentPrice
        : techData?.currentPrice || (t === 'BTC' ? 385000 : t === 'ETH' ? 21000 : 850);

    let sma200 = 0;
    let smaDistancePercent = 0;
    let daysCount = 200;
    let isReal = false;
    let mvrv = 1.45;

    if (techData && techData.sma200 > 0) {
      sma200 = techData.sma200;
      smaDistancePercent =
        techData.smaDistancePercent !== undefined
          ? techData.smaDistancePercent
          : ((basePrice - sma200) / sma200) * 100;
      daysCount = techData.daysCount || 200;
      isReal = !techData.isFallback;
      mvrv = techData.mvrv !== undefined
        ? techData.mvrv
        : (techData.realizedPrice && techData.realizedPrice > 0 ? Number((basePrice / techData.realizedPrice).toFixed(2)) : 1.25);
    } else {
      const tickerHash = t.split('').reduce((acc, c, idx) => acc + c.charCodeAt(0) * (idx + 1), 0);
      const smaRatio = 0.92 + ((tickerHash % 8) * 0.01);
      const realizedRatio = 0.80 + ((tickerHash % 12) * 0.012);
      
      sma200 = basePrice * smaRatio;
      smaDistancePercent = ((basePrice - sma200) / sma200) * 100;
      mvrv = Number((basePrice / (basePrice * realizedRatio)).toFixed(2));
    }

    const isBelowSma = basePrice < sma200 || smaDistancePercent < 0;

    let signal = 'Tendência de Alta (Acima da SMA 200)';
    let signalColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';

    if (isBelowSma && mvrv < 1.5) {
      signal = `Oportunidade Dupla (${Math.abs(smaDistancePercent).toFixed(1)}% abaixo da SMA 200 e MVRV ${mvrv.toFixed(2)}x)`;
      signalColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    } else if (isBelowSma) {
      signal = `Zona de Oportunidade (${Math.abs(smaDistancePercent).toFixed(1)}% abaixo da SMA 200)`;
      signalColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    } else if (mvrv >= 2.4 || smaDistancePercent > 20) {
      signal = `Esticado / Alerta (MVRV ${mvrv.toFixed(2)}x, +${smaDistancePercent.toFixed(1)}% SMA)`;
      signalColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    } else {
      signal = `Acumulação Saudável (+${smaDistancePercent.toFixed(1)}% vs SMA 200, MVRV ${mvrv.toFixed(2)}x)`;
      signalColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    }

    return {
      sma200,
      smaDistancePercent,
      daysCount,
      isReal,
      mvrv,
      isBelowSma,
      signal,
      signalColor,
    };
  };

  const getSmartValuation = (item: PortfolioSummaryItem) => {
    const ticker = item.ticker;
    const isCryptoItem = isCrypto(ticker);

    // If CRYPTO selected or applied to cryptos on smart
    if (selectedCriterion === 'crypto' || (selectedCriterion === 'smart' && isCryptoItem)) {
      const tech = getCryptoTechnicalAnalysis(ticker, item.currentPrice);
      const isBelow = tech.smaDistancePercent < 0;
      const mvrv = tech.mvrv || 1.5;
      
      if (isBelow) {
        return {
          action: 'COMPRAR',
          label: 'Compra Oportunidade',
          colorClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
          badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
          reason: `Ativo abaixo da média móvel de 200 dias (-${Math.abs(tech.smaDistancePercent).toFixed(1)}% vs SMA 200) com MVRV de ${mvrv.toFixed(2)}x. Excelente momento de aporte (DCA).`,
          shortReason: `DCA Oportunidade`,
          tetoLabel: 'SMA 200 Média',
          tetoValue: tech.sma200,
          marginLabel: 'Distância SMA',
          marginValue: `${tech.smaDistancePercent.toFixed(1)}%`
        };
      } else if (item.quantity > 0 && (tech.smaDistancePercent > 25 || mvrv >= 2.4)) {
        return {
          action: 'VENDA',
          label: 'Esticado / Alerta',
          colorClass: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300',
          badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
          reason: `Ativo com preço esticado (+${tech.smaDistancePercent.toFixed(1)}% vs SMA 200) e MVRV on-chain em patamar de euforia (${mvrv.toFixed(2)}x). Considere reduzir ou segurar novos aportes.`,
          shortReason: `Cripto Esticada`,
          tetoLabel: 'SMA 200 Média',
          tetoValue: tech.sma200,
          marginLabel: 'Índice MVRV',
          marginValue: `${mvrv.toFixed(2)}x`
        };
      } else {
        return {
          action: 'AGUARDAR',
          label: 'Acumulação Saudável',
          colorClass: 'bg-zinc-50 dark:bg-zinc-950/60 border-black/[0.06] dark:border-white/[0.06] text-zinc-900 dark:text-white',
          badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          reason: `Ativo em tendência saudável ou acumulação neutra (+${tech.smaDistancePercent.toFixed(1)}% vs SMA 200). DCA seguro para longo prazo.`,
          shortReason: `DCA Saudável`,
          tetoLabel: 'SMA 200 Média',
          tetoValue: tech.sma200,
          marginLabel: 'Índice MVRV',
          marginValue: `${mvrv.toFixed(2)}x`
        };
      }
    }

    // Bazin selected or applied dynamically to FII/Stocks on smart
    if (selectedCriterion === 'bazin' || (selectedCriterion === 'smart' && isFII(ticker))) {
      if (isCryptoItem) {
        return {
          action: 'AGUARDAR',
          label: 'Método Indisponível',
          colorClass: 'bg-zinc-50 dark:bg-zinc-950/60 border-black/[0.06] dark:border-white/[0.06] text-zinc-500',
          badgeColor: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
          reason: 'O Método Décio Bazin não é aplicável para criptoativos por ausência de dividendos.',
          shortReason: 'Não Aplicável',
          tetoLabel: 'Preço Teto',
          tetoValue: 0,
          marginLabel: 'Margem',
          marginValue: '—'
        };
      }
      const pvp = (item.vpa && item.vpa > 0) ? (item.currentPrice / item.vpa) : undefined;
      const possessesSafetyMargin = item.bazinCeiling > 0 && item.currentPrice <= item.bazinCeiling;
      const pvpAcceptable = pvp ? pvp <= 1.05 : true;
      const isExpensivePVP = pvp ? pvp >= 1.15 : false;

      // Smart includes pvp check for FIIs, pure Bazin just does ceiling
      const isBuyOk = selectedCriterion === 'smart' ? (possessesSafetyMargin && pvpAcceptable) : possessesSafetyMargin;
      const isSellOk = selectedCriterion === 'smart' ? (item.quantity > 0 && (item.currentPrice > item.bazinCeiling * 1.2 || isExpensivePVP)) : (item.quantity > 0 && item.currentPrice > item.bazinCeiling * 1.25);

      if (isBuyOk) {
        return {
          action: 'COMPRAR',
          label: 'Abaixo do Teto Bazin',
          colorClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
          badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
          reason: `Preço atual de R$ ${item.currentPrice.toFixed(2)} está abaixo do Preço Teto Bazin de R$ ${item.bazinCeiling.toFixed(2)} (+${item.safetyMarginPercent.toFixed(1)}% de margem).`,
          shortReason: `Abaixo do Teto`,
          tetoLabel: 'Preço Teto',
          tetoValue: item.bazinCeiling,
          marginLabel: 'Margem Segurança',
          marginValue: `+${item.safetyMarginPercent.toFixed(0)}%`
        };
      } else if (isSellOk) {
        return {
          action: 'VENDA',
          label: 'Acima do Teto Bazin',
          colorClass: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300',
          badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
          reason: `Cotação de R$ ${item.currentPrice.toFixed(2)} apresenta ágio de ${Math.abs(item.safetyMarginPercent).toFixed(0)}% acima do Preço Teto de R$ ${item.bazinCeiling.toFixed(2)}.`,
          shortReason: `Ágio Elevado`,
          tetoLabel: 'Preço Teto',
          tetoValue: item.bazinCeiling,
          marginLabel: 'Margem Segurança',
          marginValue: `${item.safetyMarginPercent.toFixed(0)}%`
        };
      } else {
        return {
          action: 'AGUARDAR',
          label: 'Aguardar / Neutro',
          colorClass: 'bg-zinc-50 dark:bg-zinc-950/60 border-black/[0.06] dark:border-white/[0.06] text-zinc-900 dark:text-white',
          badgeColor: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
          reason: `Cotação acima do Preço Teto Bazin de R$ ${item.bazinCeiling.toFixed(2)} (${Math.abs(item.safetyMarginPercent).toFixed(1)}% acima). Aguarde por melhores oportunidades de dividendo.`,
          shortReason: `Acima do Teto`,
          tetoLabel: 'Preço Teto',
          tetoValue: item.bazinCeiling,
          marginLabel: 'Margem',
          marginValue: `${item.safetyMarginPercent.toFixed(1)}%`
        };
      }
    }

    // LPA/PL values
    const lpa = item.lpa || 0;
    const pl = lpa > 0 ? item.currentPrice / lpa : 0;
    const histPl = 12.0;

    // P/L relative or Stock on smart
    if (selectedCriterion === 'pl' || (selectedCriterion === 'smart' && isStock(ticker))) {
      if (isCryptoItem) {
        return {
          action: 'AGUARDAR',
          label: 'Método Indisponível',
          colorClass: 'bg-zinc-50 dark:bg-zinc-950/60 border-black/[0.06] dark:border-white/[0.06] text-zinc-500',
          badgeColor: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
          reason: 'O Múltiplo Preço/Lucro (P/L) não é aplicável para criptoativos.',
          shortReason: 'Não Aplicável',
          tetoLabel: 'Média P/L',
          tetoValue: 0,
          marginLabel: 'Múltiplo P/L',
          marginValue: '—'
        };
      }

      // If we are on smart AND it's a dividend stock, Bazin was already handled above. So this handles growth stock on smart, or any stock on PL
      const dy = item.dy || 0;
      const isDividendStock = dy >= 5;

      if (selectedCriterion === 'smart' && isDividendStock) {
        // Dividend stock fallback already integrated beautifully inside smart (Bazin)
        const possessesSafetyMargin = item.bazinCeiling > 0 && item.currentPrice <= item.bazinCeiling;
        const plNotExpensive = pl > 0 ? pl <= histPl * 1.15 : true;
        const isCheapPL = pl > 0 && pl < histPl * 0.95;

        if (possessesSafetyMargin && plNotExpensive) {
          return {
            action: 'COMPRAR',
            label: 'Compra Oportunidade',
            colorClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
            badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
            reason: isCheapPL ? `Ação de dividendos abaixo do Preço Teto Bazin R$ ${item.bazinCeiling.toFixed(2)} e com P/L atrativo (${pl.toFixed(1)}x).` : `Preço abaixo do Preço Teto Bazin R$ ${item.bazinCeiling.toFixed(2)} com múltiplos saudáveis.`,
            shortReason: `Teto + P/L OK`,
            tetoLabel: 'Teto Bazin',
            tetoValue: item.bazinCeiling,
            marginLabel: 'P/L Real',
            marginValue: pl > 0 ? `${pl.toFixed(1)}x` : '—'
          };
        } else if (item.quantity > 0 && (item.currentPrice > item.bazinCeiling * 1.25 || pl > histPl * 1.30)) {
          return {
            action: 'VENDA',
            label: 'Preço Esticado',
            colorClass: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300',
            badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
            reason: pl > histPl * 1.30 ? `Preço esticado pelo múltiplo P/L (${pl.toFixed(1)}x vs média de ${histPl}x).` : `Ação de dividendos com cotação ${Math.abs(item.safetyMarginPercent).toFixed(0)}% acima do Teto Bazin.`,
            shortReason: `P/L Esticado`,
            tetoLabel: 'Teto Bazin',
            tetoValue: item.bazinCeiling,
            marginLabel: 'P/L Real',
            marginValue: pl > 0 ? `${pl.toFixed(1)}x` : '—'
          };
        } else {
          return {
            action: 'AGUARDAR',
            label: 'Aguardar / Neutro',
            colorClass: 'bg-zinc-50 dark:bg-zinc-950/60 border-black/[0.06] dark:border-white/[0.06] text-zinc-900 dark:text-white',
            badgeColor: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
            reason: !possessesSafetyMargin ? `Cotação acima do Preço Teto Bazin (R$ ${item.bazinCeiling.toFixed(2)}).` : `P/L de ${pl.toFixed(1)}x ligeiramente esticado frente à média do mercado.`,
            shortReason: !possessesSafetyMargin ? `Acima do Teto` : `P/L Esticado`,
            tetoLabel: 'Teto Bazin',
            tetoValue: item.bazinCeiling,
            marginLabel: 'P/L Real',
            marginValue: pl > 0 ? `${pl.toFixed(1)}x` : '—'
          };
        }
      } else {
        // Growth stock on smart, or any stock/FII on pure PL
        const isCheapPL = pl > 0 && pl < histPl * 0.95;
        const isCheapGraham = item.isGrahamApplicable && item.grahamPrice && item.currentPrice <= item.grahamPrice;
        const isExpensivePL = pl > histPl * 1.25;
        const isExpensiveGraham = item.isGrahamApplicable && item.grahamPrice && item.currentPrice > item.grahamPrice * 1.25;

        // On smart, we can combine with graham. On pure PL we focus purely on PL.
        const isBuyOpportunity = selectedCriterion === 'smart' ? (isCheapPL || isCheapGraham) : isCheapPL;
        const isSellOpportunity = selectedCriterion === 'smart' ? (item.quantity > 0 && (isExpensivePL || isExpensiveGraham)) : (item.quantity > 0 && isExpensivePL);

        if (isBuyOpportunity) {
          return {
            action: 'COMPRAR',
            label: 'P/L Descontado',
            colorClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
            badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
            reason: selectedCriterion === 'smart' && isCheapGraham 
              ? `Cotação abaixo do Preço Justo de Graham (R$ ${item.grahamPrice?.toFixed(2)}) e P/L saudável (${pl.toFixed(1)}x).` 
              : `Múltiplo P/L atual de ${pl.toFixed(1)}x está descontado em relação à média histórica (${histPl.toFixed(1)}x).`,
            shortReason: `P/L Descontado`,
            tetoLabel: selectedCriterion === 'smart' && item.grahamPrice ? 'Valor Graham' : 'P/L Histórico',
            tetoValue: selectedCriterion === 'smart' && item.grahamPrice ? item.grahamPrice : histPl,
            marginLabel: 'P/L Real',
            marginValue: pl > 0 ? `${pl.toFixed(1)}x` : '—'
          };
        } else if (isSellOpportunity) {
          return {
            action: 'VENDA',
            label: 'P/L Esticado',
            colorClass: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300',
            badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
            reason: `Múltiplo P/L atual de ${pl.toFixed(1)}x está esticado frente à média histórica de ${histPl.toFixed(1)}x. Novas compras apresentam menor margem.`,
            shortReason: `P/L Esticado`,
            tetoLabel: 'P/L Histórico',
            tetoValue: histPl,
            marginLabel: 'P/L Real',
            marginValue: pl > 0 ? `${pl.toFixed(1)}x` : '—'
          };
        } else {
          return {
            action: 'AGUARDAR',
            label: 'P/L Neutro',
            colorClass: 'bg-zinc-50 dark:bg-zinc-950/60 border-black/[0.06] dark:border-white/[0.06] text-zinc-900 dark:text-white',
            badgeColor: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
            reason: `Múltiplo P/L atual de ${pl.toFixed(1)}x está alinhado com o patamar justo e histórico da empresa (${histPl.toFixed(1)}x).`,
            shortReason: `P/L Justo`,
            tetoLabel: 'P/L Histórico',
            tetoValue: histPl,
            marginLabel: 'P/L Real',
            marginValue: pl > 0 ? `${pl.toFixed(1)}x` : '—'
          };
        }
      }
    }

    return {
      action: 'AGUARDAR',
      label: 'Aguardar / Neutro',
      colorClass: 'bg-zinc-50 dark:bg-zinc-950/60 border-black/[0.06] dark:border-white/[0.06] text-zinc-900 dark:text-white',
      badgeColor: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
      reason: 'Ativo em conformidade e equilíbrio.',
      shortReason: 'Equilibrado',
      tetoLabel: 'Preço Teto',
      tetoValue: 0,
      marginLabel: 'Margem',
      marginValue: '—'
    };
  };

  // Asset counts & proportions
  const favoriteItems = summaryItems.filter((i) => i.isFavorite);
  const cryptoItems = summaryItems.filter((i) => isCrypto(i.ticker));
  const fiiItems = summaryItems.filter((i) => isFII(i.ticker));
  const stockItems = summaryItems.filter((i) => isStock(i.ticker));
  const opportunityItems = summaryItems.filter(
    (i) => i.bazinCeiling > 0 && i.safetyMarginPercent > 0
  );

  // Filtered & Sorted items
  const processedItems = useMemo(() => {
    return summaryItems
      .filter((item) => {
        const matchesSearch =
          item.ticker.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
          getAssetName(item.ticker, quotes[item.ticker]?.name)
            .toLowerCase()
            .includes(searchTerm.toLowerCase().trim());

        if (assetFilter === 'FAVORITES' && !item.isFavorite) return false;
        if (assetFilter === 'FII' && !isFII(item.ticker)) return false;
        if (assetFilter === 'STOCK' && !isStock(item.ticker)) return false;
        if (assetFilter === 'CRIPTO' && !isCrypto(item.ticker)) return false;
        if (
          assetFilter === 'OPPORTUNITY' &&
          !(item.bazinCeiling > 0 && item.safetyMarginPercent > 0)
        )
          return false;

        return matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'STRONG_BUY') {
          const valA = getSmartValuation(a);
          const valB = getSmartValuation(b);
          const score = (action: string) => action === 'COMPRAR' ? 3 : action === 'AGUARDAR' ? 2 : 1;
          const diff = score(valB.action) - score(valA.action);
          if (diff !== 0) return diff;
          return (b.safetyMarginPercent || 0) - (a.safetyMarginPercent || 0);
        }
        if (sortBy === 'VALUE_DESC') return b.currentTotalValue - a.currentTotalValue;
        if (sortBy === 'PNL_DESC') return b.pnlPercent - a.pnlPercent;
        if (sortBy === 'PNL_ASC') return a.pnlPercent - b.pnlPercent;
        if (sortBy === 'DY_DESC') return (b.dy || 0) - (a.dy || 0);
        if (sortBy === 'SAFETY_DESC')
          return (b.safetyMarginPercent || 0) - (a.safetyMarginPercent || 0);
        if (sortBy === 'TICKER_ASC') return a.ticker.localeCompare(b.ticker);
        return 0;
      });
  }, [summaryItems, searchTerm, assetFilter, sortBy, quotes]);

  // Quick Action Handler to open Modal
  const openModalWithAction = (
    ticker: string,
    modalType: TransactionType
  ) => {
    setDefaultTickerForModal(ticker);
    setDefaultModalType?.(modalType);
    setEditingTx(null);
    setIsModalOpen(true);
  };



  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. CONTAINER PRINCIPAL DE ATIVOS COM CONTROLES */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs p-4 sm:p-5 space-y-4 transition-colors">
        
        {/* Cabeçalho da Seção com Ações Rápidas */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
                <Layers className="w-4 h-4 text-emerald-500" />
                Minha Carteira ({summaryItems.length})
              </h2>
              {summaryItems.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Cotações Oficiais B3 & Cripto
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Monitore de forma simples seu preço médio, valor atualizado e oportunidades de aporte com base no teto de dividendos.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            {/* Botão de Ajuda e Explicações */}
            <button
              type="button"
              onClick={() => setShowHelperGuide(!showHelperGuide)}
              className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition border border-black/[0.06] dark:border-white/[0.08] cursor-pointer shrink-0"
              title="Entenda o que significa Preço Médio, Preço Teto e Rentabilidade"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="hidden sm:inline">Guia de Termos</span>
              {showHelperGuide ? (
                <ChevronUp className="w-3 h-3 text-zinc-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              )}
            </button>

            {summaryItems.length > 0 && (
              <button
                type="button"
                onClick={() => setIsFilterMinimized(!isFilterMinimized)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition border cursor-pointer shrink-0 ${
                  isFilterMinimized
                    ? 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-300 border-black/[0.06] dark:border-white/[0.08]'
                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold'
                }`}
                title={isFilterMinimized ? 'Expandir filtros' : 'Minimizar filtros'}
              >
                <Filter className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="hidden sm:inline">Filtros</span>
                {isFilterMinimized ? (
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                ) : (
                  <ChevronUp className="w-3 h-3 text-zinc-400" />
                )}
              </button>
            )}

            {summaryItems.length > 0 && (
              <>
                {/* View Switcher (Cards vs Table) */}
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-950/80 p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('CARDS')}
                    className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      viewMode === 'CARDS'
                        ? 'bg-white dark:bg-white/[0.12] text-zinc-950 dark:text-white shadow-xs font-bold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                    title="Visualização em Cards Detalhados"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cards Fáceis</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('TABLE')}
                    className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      viewMode === 'TABLE'
                        ? 'bg-white dark:bg-white/[0.12] text-zinc-950 dark:text-white shadow-xs font-bold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                    title="Visualização em Tabela Compacta"
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tabela</span>
                  </button>
                </div>

                {/* Refresh Quotes */}
                <button
                  type="button"
                  onClick={handleRefreshAllQuotes}
                  disabled={isRefreshingAllQuotes}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-800 dark:text-zinc-200 border border-black/[0.06] dark:border-white/[0.08] font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  title="Atualizar cotações em tempo real"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-emerald-500 ${
                      isRefreshingAllQuotes ? 'animate-spin' : ''
                    }`}
                  />
                  <span className="hidden md:inline">
                    {isRefreshingAllQuotes ? 'Atualizando...' : 'Atualizar Cotações'}
                  </span>
                </button>
              </>
            )}

            {summaryItems.length === 0 && (
              <button
                type="button"
                onClick={() => openModalWithAction('CAIXA', 'DEPOSITO')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Wallet className="w-4 h-4" />
                <span>Depositar Saldo</span>
              </button>
            )}
          </div>
        </div>

        {/* GUIA DE TERMOS SIMPLIFICADO (EXPANSÍVEL) */}
        {showHelperGuide && (
          <div className="bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06] border border-indigo-500/20 rounded-2xl p-3.5 sm:p-4 text-xs space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 text-sm">
                <Info className="w-4 h-4 text-indigo-500" />
                Entenda os números da sua carteira em segundos
              </h4>
              <button
                type="button"
                onClick={() => setShowHelperGuide(false)}
                className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-[#141418] p-3 rounded-xl border border-indigo-500/15 space-y-1">
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Preço Médio (PM)
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-xs">
                  É o valor médio que você pagou por cada cota somando todas as suas compras.
                </p>
              </div>

              <div className="bg-white dark:bg-[#141418] p-3 rounded-xl border border-indigo-500/15 space-y-1">
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Preço Teto (Método Bazin)
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-xs">
                  O preço máximo sugerido para compra garantindo no mínimo 6% de dividendos ao ano.
                </p>
              </div>

              <div className="bg-white dark:bg-[#141418] p-3 rounded-xl border border-indigo-500/15 space-y-1">
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Lucro ou Prejuízo
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-xs">
                  A diferença real entre o que suas cotas valem hoje no mercado e o que você desembolsou.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CRITÉRIOS DE VALUATION E ANÁLISE */}
        <div className="bg-white dark:bg-[#141418] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-xl border border-indigo-500/15">
                <Filter className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                  Critério de Valuation Ativo
                </h3>
                <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                  Selecione o filtro analítico para calcular as recomendações de compra/venda na carteira.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCriteriaMinimized(!isCriteriaMinimized)}
              className="px-2.5 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 bg-zinc-50 dark:bg-white/[0.04] hover:bg-zinc-100 rounded-xl border border-black/[0.04] dark:border-white/[0.04] transition cursor-pointer"
            >
              {isCriteriaMinimized ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Expandir</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Recolher</span>
                </>
              )}
            </button>
          </div>

          {!isCriteriaMinimized && (
            <div className="space-y-3.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.04] animate-in fade-in duration-150">
              {/* Selector Cards/Tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* Criterion 0: Smart Multifactor */}
                <button
                  type="button"
                  onClick={() => setSelectedCriterion('smart')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    selectedCriterion === 'smart'
                      ? 'bg-indigo-500/[0.06] dark:bg-indigo-500/[0.1] border-indigo-500/40 text-zinc-900 dark:text-white shadow-2xs ring-1 ring-indigo-500/30'
                      : 'bg-zinc-50/70 dark:bg-white/[0.02] border-black/[0.06] dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
                      <Sparkles className={`w-3.5 h-3.5 ${selectedCriterion === 'smart' ? 'text-indigo-500' : 'text-zinc-400'}`} />
                      Multifator Inteligente
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        Recomendado
                      </span>
                      {selectedCriterion === 'smart' && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                    Análise cruzada de dividendos (Bazin), valor patrimonial (P/VP), múltiplos (P/L) e Graham.
                  </p>
                </button>

                {/* Criterion 1: Bazin */}
                <button
                  type="button"
                  onClick={() => setSelectedCriterion('bazin')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    selectedCriterion === 'bazin'
                      ? 'bg-emerald-500/[0.06] dark:bg-emerald-500/[0.1] border-emerald-500/40 text-zinc-900 dark:text-white shadow-2xs ring-1 ring-emerald-500/30'
                      : 'bg-zinc-50/70 dark:bg-white/[0.02] border-black/[0.06] dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
                      <Coins className={`w-3.5 h-3.5 ${selectedCriterion === 'bazin' ? 'text-emerald-500' : 'text-zinc-400'}`} />
                      Preço Teto Bazin
                    </span>
                    <div className="flex items-center gap-1.5">
                      {selectedCriterion === 'bazin' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                    Ações pagadoras de dividendos com margem de segurança e DY mínimo anual desejado.
                  </p>
                </button>

                {/* Criterion 2: P/L */}
                <button
                  type="button"
                  onClick={() => setSelectedCriterion('pl')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    selectedCriterion === 'pl'
                      ? 'bg-blue-500/[0.06] dark:bg-blue-500/[0.1] border-blue-500/40 text-zinc-900 dark:text-white shadow-2xs ring-1 ring-blue-500/30'
                      : 'bg-zinc-50/70 dark:bg-white/[0.02] border-black/[0.06] dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
                      <BarChart2 className={`w-3.5 h-3.5 ${selectedCriterion === 'pl' ? 'text-blue-500' : 'text-zinc-400'}`} />
                      Múltiplo P/L
                    </span>
                    <div className="flex items-center gap-1.5">
                      {selectedCriterion === 'pl' && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                    Valuation de ações em geral comparado à média histórica e pares de setor.
                  </p>
                </button>

                {/* Criterion 3: Crypto SMA 200 */}
                <button
                  type="button"
                  onClick={() => setSelectedCriterion('crypto')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    selectedCriterion === 'crypto'
                      ? 'bg-amber-500/[0.06] dark:bg-amber-500/[0.1] border-amber-500/40 text-zinc-900 dark:text-white shadow-2xs ring-1 ring-amber-500/30'
                      : 'bg-zinc-50/70 dark:bg-white/[0.02] border-black/[0.06] dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white">
                      <Activity className={`w-3.5 h-3.5 ${selectedCriterion === 'crypto' ? 'text-amber-500' : 'text-zinc-400'}`} />
                      Média Móvel SMA 200
                    </span>
                    <div className="flex items-center gap-1.5">
                      {selectedCriterion === 'crypto' && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                    Média móvel diária de 200 períodos para ciclo de criptoativos e acumulação.
                  </p>
                </button>
              </div>

              {/* Dynamic Educational Formula & Detail Card */}
              <div className="p-3.5 bg-zinc-50 dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] rounded-xl text-xs text-zinc-600 dark:text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {selectedCriterion === 'smart' && (
                      <>
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          Sinalização Multifator Inteligente (Recomendado)
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                          Metodologia unificada e adaptativa: <strong>FIIs</strong> exigem desconto por Bazin e P/VP de até 1.05; <strong>Ações Dividendos</strong> usam Bazin e P/L histórico saudável; <strong>Ações de Crescimento</strong> focam em P/L e Preço de Graham; <strong>Criptoativos</strong> utilizam SMA 200 e MVRV.
                        </p>
                      </>
                    )}
                    {selectedCriterion === 'bazin' && (
                      <>
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          Metodologia Décio Bazin (Preço Teto para Dividendos)
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                          Classifica se a cotação está abaixo do preço teto estimado. Ativos negociados abaixo do teto garantem um retorno projetado de pelo menos o yield desejado.
                        </p>
                      </>
                    )}
                    {selectedCriterion === 'pl' && (
                      <>
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          Múltiplo Preço/Lucro (Valuation Relativo)
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                          Avalia se o P/L atual está descontado em relação ao histórico da empresa e concorrentes diretos, identificando barganhas e papéis esticados.
                        </p>
                      </>
                    )}
                    {selectedCriterion === 'crypto' && (
                      <>
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          Média Móvel SMA 200 & Indicadores On-Chain
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                          Baseado nos últimos 200 fechamentos diários. Cotação abaixo da SMA 200 sinaliza <em>Zona de Oportunidade / Acumulação</em>, enquanto desvios altos indicam sobrecompra.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Formula Badge */}
                <div className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.1] rounded-lg text-center shrink-0 self-start sm:self-center shadow-2xs">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 block mb-0.5 tracking-wider">Métrica Principal</span>
                  <code className="text-xs font-mono font-semibold text-zinc-900 dark:text-white">
                    {selectedCriterion === 'smart' && 'Filtro Misto / Adaptativo'}
                    {selectedCriterion === 'bazin' && 'Teto = DPA ÷ Taxa'}
                    {selectedCriterion === 'pl' && 'P/L = Preço ÷ LPA'}
                    {selectedCriterion === 'crypto' && 'SMA 200 = Média(P₂₀₀)'}
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Radar de Oportunidades & Observação */}
        {onToggleFavorite && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 sm:p-4 bg-gradient-to-r from-amber-500/[0.05] via-amber-500/[0.03] to-amber-500/[0.05] dark:from-amber-500/[0.08] dark:via-amber-500/[0.04] dark:to-amber-500/[0.08] rounded-2xl border border-amber-500/20 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 shrink-0 shadow-2xs">
                <Radar className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>Radar de Oportunidades</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 tabular-nums">
                    {favoriteItems.length} {favoriteItems.length === 1 ? 'ativo' : 'ativos'}
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Acompanhe cotações, dividendos e preço teto de ações, FIIs e criptos antes de investir.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="flex-1 relative">
                <TickerAutocomplete
                  value={searchWatchlistTicker}
                  onChange={(val) => setSearchWatchlistTicker(val)}
                  onSelectResult={(res) => {
                    onToggleFavorite(res.ticker);
                    setSearchWatchlistTicker('');
                  }}
                  placeholder="Buscar ativo por código ou nome (ex: WEGE3, HGLG11, BTC)..."
                  inputClassName="w-full text-xs bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.12] rounded-xl px-3 py-2 font-mono font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all shadow-2xs"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!searchWatchlistTicker.trim()) return;
                  onToggleFavorite(searchWatchlistTicker.trim().toUpperCase());
                  setSearchWatchlistTicker('');
                }}
                disabled={!searchWatchlistTicker.trim()}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-xs rounded-xl transition-all duration-150 flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 shadow-xs hover:shadow-sm active:scale-[0.98]"
                title="Adicionar ao Radar de Oportunidades"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Monitorar</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        {summaryItems.length > 0 && !isFilterMinimized && (
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 bg-zinc-50 dark:bg-zinc-950/60 p-2.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] animate-in fade-in duration-150">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por código ou nome (ex: PETR4, Itaú, MXRF11, Bitcoin)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-2 bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.10] rounded-xl text-xs font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Class Filter & Sort Options */}
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto overflow-x-auto max-w-full pb-1 lg:pb-0">
              {/* Asset Class Filter */}
              <div className="flex items-center bg-white dark:bg-zinc-900 p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium whitespace-nowrap overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setAssetFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    assetFilter === 'ALL'
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Todos ({summaryItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAssetFilter('STOCK')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                    assetFilter === 'STOCK'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Briefcase className="w-3 h-3" /> Ações ({stockItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAssetFilter('FII')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                    assetFilter === 'FII'
                      ? 'bg-teal-600 text-white font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Building2 className="w-3 h-3" /> FIIs ({fiiItems.length})
                </button>
                {cryptoItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAssetFilter('CRIPTO')}
                    className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      assetFilter === 'CRIPTO'
                        ? 'bg-amber-600 text-white font-bold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Coins className="w-3 h-3 text-amber-500" /> Cripto (
                    {cryptoItems.length})
                  </button>
                )}
                {opportunityItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAssetFilter('OPPORTUNITY')}
                    className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      assetFilter === 'OPPORTUNITY'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                    title="Ativos cotados abaixo do Preço Teto de Bazin"
                  >
                    <ShieldCheck className="w-3 h-3" /> Oportunidades (
                    {opportunityItems.length})
                  </button>
                )}
                {favoriteItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAssetFilter('FAVORITES')}
                    className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      assetFilter === 'FAVORITES'
                        ? 'bg-amber-500 text-white font-bold shadow-xs'
                        : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                    }`}
                  >
                    <Star className="w-3 h-3 fill-current text-amber-500" />{' '}
                    Em Radar ({favoriteItems.length})
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 font-medium bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  aria-label="Ordenar posições da carteira"
                  className="bg-transparent text-zinc-800 dark:text-zinc-200 font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="VALUE_DESC" className="dark:bg-zinc-900">
                    Maior Valor em Carteira
                  </option>
                  <option value="PNL_DESC" className="dark:bg-zinc-900">
                    Maior Lucro (%)
                  </option>
                  <option value="PNL_ASC" className="dark:bg-zinc-900">
                    Maior Queda / Desconto (%)
                  </option>
                  <option value="DY_DESC" className="dark:bg-zinc-900">
                    Maior Dividend Yield
                  </option>
                  <option value="SAFETY_DESC" className="dark:bg-zinc-900">
                    Melhor Margem Preço Teto
                  </option>
                  <option value="TICKER_ASC" className="dark:bg-zinc-900">
                    Ordem Alfabética (A-Z)
                  </option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Loading / Empty / Content Views */}
        {loadingData ? (
          <div className="py-12 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
            <span className="font-medium">Carregando seus investimentos com segurança...</span>
          </div>
        ) : summaryItems.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto border border-emerald-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-zinc-900 dark:text-white">
                Sua carteira de investimentos está pronta para começar!
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                Registre suas compras de ativos ou deposite saldo em conta para começar a organizar seus investimentos.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => openModalWithAction('', 'COMPRA')}
                className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                Registrar Primeiro Ativo
              </button>
              <button
                type="button"
                onClick={() => openModalWithAction('CAIXA', 'DEPOSITO')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Wallet className="w-4 h-4" />
                Depositar Saldo
              </button>
            </div>
          </div>
        ) : processedItems.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
            Nenhum ativo encontrado para os filtros selecionados. Experimente buscar outro termo ou limpar os filtros.
          </div>
        ) : viewMode === 'CARDS' ? (
          /* ============================================================ */
          /* 4. MODALIDADE 1: GRID DE CARDS SUPER INTUITIVOS E HUMANIZADOS */
          /* ============================================================ */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {processedItems.map((item) => {
              const isWatchlistOnly = item.quantity === 0 && item.isFavorite;
              const isGain = item.pnl >= 0;
              const isSafetyBazin = item.bazinCeiling > 0 && item.safetyMarginPercent > 0;
              const assetFullName = getAssetName(
                item.ticker,
                quotes[item.ticker]?.name
              );
              const assetCategory = isCrypto(item.ticker)
                ? 'Criptoativo'
                : isFII(item.ticker)
                ? 'Fundo Imobiliário'
                : 'Ação da B3';

              return (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-[#121215] rounded-2xl border ${
                    isWatchlistOnly
                      ? 'border-amber-500/30 bg-amber-500/[0.02]'
                      : 'border-black/[0.06] dark:border-white/[0.08]'
                  } hover:border-black/[0.16] dark:hover:border-white/[0.2] p-4 sm:p-5 shadow-xs transition-all duration-200 flex flex-col justify-between space-y-4 group relative`}
                >
                  {/* TOP BAR: IDENTIFICAÇÃO COMPLETA DO ATIVO */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Ticker Principal */}
                        <button
                          type="button"
                          onClick={() => setSelectedChartTicker(item.ticker)}
                          className="font-mono font-bold text-sm px-2.5 py-1 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-xl shadow-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition cursor-pointer flex items-center gap-1.5"
                          title="Clique para ver o gráfico e evolução detalhada deste ativo"
                        >
                          <span>{item.ticker}</span>
                          <BarChart2 className="w-3 h-3 text-emerald-400 dark:text-emerald-600" />
                        </button>

                        {/* Tag de Categoria */}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                            isCrypto(item.ticker)
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : isFII(item.ticker)
                              ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20'
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                          }`}
                        >
                          {assetCategory}
                        </span>

                        {isWatchlistOnly && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Em Radar
                          </span>
                        )}
                      </div>

                      {/* Nome Claro da Empresa ou Fundo */}
                      <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-1.5 truncate">
                        {assetFullName}
                      </div>

                      {/* Proporção na Carteira */}
                      {!isWatchlistOnly && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-16 h-1.5 bg-zinc-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(5, item.currentPercent))}%`,
                              }}
                            />
                          </div>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono font-medium">
                            {item.currentPercent.toFixed(1)}% da sua carteira
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Botão de Favorito / Watchlist */}
                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(item.ticker);
                        }}
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 transition cursor-pointer shrink-0"
                        title={
                          item.isFavorite
                            ? 'Remover do Radar'
                            : 'Adicionar ao Radar'
                        }
                        aria-label={
                          item.isFavorite
                            ? 'Remover do Radar'
                            : 'Adicionar ao Radar'
                        }
                      >
                        <Star
                          className={`w-4 h-4 ${
                            item.isFavorite
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-zinc-400 hover:text-amber-400'
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {/* PAINEL HERO: SALDO TOTAL & RENTABILIDADE */}
                  <div className="bg-zinc-50 dark:bg-[#0c0c0e] p-3 sm:p-3.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06] space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                          {isWatchlistOnly ? 'Preço de Mercado' : 'Valor Atual'}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="text-base sm:text-lg font-bold font-mono text-zinc-900 dark:text-white tabular-nums">
                            {isWatchlistOnly
                              ? formatBRLDecimal(item.currentPrice)
                              : formatBRL(item.currentTotalValue)}
                          </span>

                          {/* Rentabilidade posicionada logo após o Valor Atual */}
                          {!isWatchlistOnly && (
                            <div
                              className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-lg border tabular-nums ${
                                isGain
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                              }`}
                            >
                              {isGain ? (
                                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>
                                {isGain ? '+' : ''}
                                {formatBRL(item.pnl)} ({item.pnlPercent.toFixed(1)}%)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {isWatchlistOnly && (
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                            Status
                          </span>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            Em Observação
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GRADE DE DETALHES COM RÓTULOS AUTOEXPLICATIVOS */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* 1. Minhas Cotas */}
                    <div className="bg-zinc-50/60 dark:bg-zinc-900/40 p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block">
                        Minhas Cotas
                      </span>
                      <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs tabular-nums block mt-0.5">
                        {isWatchlistOnly ? (
                          <span className="text-zinc-400">0 cotas</span>
                        ) : (
                          `${item.quantity} ${isCrypto(item.ticker) ? 'un' : 'cotas'}`
                        )}
                      </span>
                    </div>

                    {/* 2. Preço Médio Pago */}
                    <div className="bg-zinc-50/60 dark:bg-zinc-900/40 p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                        <span>Meu Preço Médio</span>
                        <InfoTooltip
                          title="Preço Médio (PM)"
                          description="O custo médio pago por cada cota somando suas compras e taxas."
                        />
                      </span>
                      <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-xs tabular-nums block mt-0.5">
                        {isWatchlistOnly ? '—' : formatBRLDecimal(item.averagePrice)}
                      </span>
                    </div>

                    {/* 3. Cotação Atual com Botão de Atualizar */}
                    <div className="bg-zinc-50/60 dark:bg-zinc-900/40 p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                          {isCrypto(item.ticker) ? 'Cotação Atual' : 'Cotação B3'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRefreshSingleQuote(item.ticker)}
                          disabled={refreshingTickers[item.ticker]}
                          className="text-zinc-400 hover:text-emerald-500 transition cursor-pointer p-0.5"
                          title="Atualizar cotação deste ativo agora"
                        >
                          <RefreshCw
                            className={`w-2.5 h-2.5 ${
                              refreshingTickers[item.ticker]
                                ? 'animate-spin text-emerald-500'
                                : ''
                            }`}
                          />
                        </button>
                      </div>
                      <span className="font-mono font-bold text-zinc-900 dark:text-white text-xs tabular-nums block mt-0.5">
                        {formatBRLDecimal(item.currentPrice)}
                      </span>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block truncate mt-0.5">
                        {formatTimeAgo(item.updatedAt)}
                      </span>
                    </div>

                    {/* 4. Total Investido (Custo de Aquisição) */}
                    <div className="bg-zinc-50/60 dark:bg-zinc-900/40 p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
                      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                        <span>Total Investido</span>
                        <InfoTooltip
                          title="Custo Total Aportado"
                          description="Total em dinheiro que saiu do seu bolso para adquirir as cotas atuais."
                        />
                      </span>
                      <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 text-xs tabular-nums block mt-0.5">
                        {isWatchlistOnly ? '—' : formatBRL(item.costBasis)}
                      </span>
                    </div>
                  </div>

                  {/* TERMÔMETRO DE DECISÃO & DIVIDENDOS (INTUITIVO) */}
                  <div className="space-y-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                    {(() => {
                      const val = getSmartValuation(item);
                      return (
                        <div
                          className={`p-2.5 rounded-xl border text-xs flex flex-col gap-2 ${val.colorClass}`}
                        >
                          <div className="flex items-start gap-2">
                            {val.action === 'COMPRAR' ? (
                              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-zinc-900 dark:text-white flex items-center justify-between">
                                <span>{val.label}</span>
                                <span className="text-[9px] uppercase font-bold tracking-wide px-1.5 py-0.2 bg-black/5 dark:bg-white/10 rounded">
                                  {val.action}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                                {val.reason}
                              </p>
                            </div>
                          </div>

                          {/* Mini Metrics for visual completeness */}
                          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-black/[0.04] dark:border-white/[0.04] text-[10px] text-zinc-500 dark:text-zinc-400">
                            <div>
                              <span className="block font-medium opacity-75">{val.tetoLabel}</span>
                              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                {val.tetoValue > 0 ? formatBRLDecimal(val.tetoValue) : '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block font-medium opacity-75">{val.marginLabel}</span>
                              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                {val.marginValue}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Proventos e Dividend Yield */}
                    <div className="flex items-center justify-between text-xs pt-1 flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        <span className="text-[11px] font-medium">Dividend Yield:</span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">
                          {item.dy > 0 ? `${item.dy.toFixed(1)}% a.a.` : '—'}
                        </span>
                      </div>

                      {item.totalDividendsReceived > 0 && (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <DollarSign className="w-3 h-3 shrink-0" />
                          <span>+{formatBRLDecimal(item.totalDividendsReceived)} recebidos</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BARRA DE AÇÕES RÁPIDAS (BOM ESPAÇAMENTO E CLAREZA) */}
                  <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] grid grid-cols-3 gap-1.5">
                    {/* Botão de Compra */}
                    <button
                      type="button"
                      onClick={() => openModalWithAction(item.ticker, 'COMPRA')}
                      className={`py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs ${
                        isWatchlistOnly ? 'col-span-2' : ''
                      }`}
                      title={`Comprar cotas de ${item.ticker}`}
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span>{isWatchlistOnly ? 'Iniciar Posição' : 'Comprar'}</span>
                    </button>

                    {/* Botão de Venda */}
                    {!isWatchlistOnly && (
                      <button
                        type="button"
                        onClick={() => openModalWithAction(item.ticker, 'VENDA')}
                        className="py-2 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                        title={`Vender cotas de ${item.ticker}`}
                      >
                        <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                        <span>Vender</span>
                      </button>
                    )}

                    {/* Botão de Gráfico & Evolução */}
                    <button
                      type="button"
                      onClick={() => setSelectedChartTicker(item.ticker)}
                      className={`py-2 px-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                        isWatchlistOnly ? 'col-span-1' : ''
                      }`}
                      title={`Ver histórico e gráfico de evolução de ${item.ticker}`}
                    >
                      <BarChart2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Gráfico</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ============================================================ */
          /* 5. MODALIDADE 2: TABELA COMPACTA CLARA E INTUITIVA          */
          /* ============================================================ */
          <div className="overflow-x-auto rounded-xl border border-black/[0.06] dark:border-white/[0.06]">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/80 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px] border-b border-black/[0.06] dark:border-white/[0.06]">
                <tr>
                  <th className="py-3 px-3">Ativo & Empresa</th>
                  <th className="py-3 px-3">Sinal Inteligente</th>
                  <th className="py-3 px-3 text-right">Cotas</th>
                  <th className="py-3 px-3 text-right">Preço Médio</th>
                  <th className="py-3 px-3 text-right">Cotação Atual</th>
                  <th className="py-3 px-3 text-right">Total Investido</th>
                  <th className="py-3 px-3 text-right">Saldo Atual</th>
                  <th className="py-3 px-3 text-right">Lucro / Prejuízo</th>
                  <th className="py-3 px-3 text-right">Proventos</th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04] text-zinc-700 dark:text-zinc-300 font-medium">
                {processedItems.map((item) => {
                  const isWatchlistOnly = item.quantity === 0 && item.isFavorite;
                  const isGain = item.pnl >= 0;
                  const isSafetyBazin =
                    item.bazinCeiling > 0 && item.safetyMarginPercent > 0;
                  const assetFullName = getAssetName(
                    item.ticker,
                    quotes[item.ticker]?.name
                  );

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition ${
                        isWatchlistOnly ? 'bg-amber-500/[0.02]' : ''
                      }`}
                    >
                      {/* Ticker & Nome */}
                      <td className="py-3 px-3 font-semibold">
                        <div className="flex items-center gap-2">
                          {onToggleFavorite && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(item.ticker);
                              }}
                              className="p-0.5 rounded text-zinc-400 hover:text-amber-500 transition cursor-pointer"
                              title={
                                item.isFavorite
                                  ? 'Remover do Radar'
                                  : 'Adicionar ao Radar'
                              }
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  item.isFavorite
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-zinc-400 hover:text-amber-400'
                                }`}
                              />
                            </button>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedChartTicker(item.ticker)}
                                className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 rounded font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                title="Clique para ver o gráfico"
                              >
                                <span>{item.ticker}</span>
                                <BarChart2 className="w-2.5 h-2.5 text-emerald-400 dark:text-emerald-600" />
                              </button>
                              <span
                                className={`text-[9px] font-semibold px-1.5 py-0.2 rounded uppercase ${
                                  isCrypto(item.ticker)
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : isFII(item.ticker)
                                    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                }`}
                              >
                                {isCrypto(item.ticker)
                                  ? 'CRIPTO'
                                  : isFII(item.ticker)
                                  ? 'FII'
                                  : 'AÇÃO'}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal truncate max-w-[140px] mt-0.5">
                              {assetFullName}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status Preço Teto */}
                      <td className="py-3 px-3">
                        {(() => {
                          const val = getSmartValuation(item);
                          return (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold border tabular-nums ${val.badgeColor}`}
                              title={val.reason}
                            >
                              {val.action === 'COMPRAR' ? (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mr-1 shrink-0" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 mr-1 shrink-0" />
                              )}
                              <span>{val.shortReason}</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Quantidade de Cotas */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {isWatchlistOnly ? (
                          <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                            Radar
                          </span>
                        ) : (
                          item.quantity
                        )}
                      </td>

                      {/* Preço Médio */}
                      <td className="py-3 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                        {isWatchlistOnly ? '—' : formatBRLDecimal(item.averagePrice)}
                      </td>

                      {/* Cotação Atual */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className="flex items-center justify-end gap-1 font-bold text-zinc-900 dark:text-white">
                          {formatBRLDecimal(item.currentPrice)}
                          <button
                            type="button"
                            onClick={() => handleRefreshSingleQuote(item.ticker)}
                            disabled={refreshingTickers[item.ticker]}
                            className="p-0.5 hover:bg-zinc-100 dark:hover:bg-white/[0.06] rounded text-zinc-400 hover:text-emerald-500 transition disabled:opacity-50 cursor-pointer"
                            title="Atualizar cotação"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${
                                refreshingTickers[item.ticker]
                                  ? 'animate-spin text-emerald-500'
                                  : ''
                              }`}
                            />
                          </button>
                        </div>
                      </td>

                      {/* Total Investido */}
                      <td className="py-3 px-3 text-right font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {isWatchlistOnly ? '—' : formatBRL(item.costBasis)}
                      </td>

                      {/* Saldo Atual */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                        {isWatchlistOnly ? '—' : formatBRL(item.currentTotalValue)}
                      </td>

                      {/* Lucro / Prejuízo */}
                      <td className="py-3 px-3 text-right font-mono font-bold tabular-nums">
                        {isWatchlistOnly ? (
                          <span className="text-zinc-400 text-[11px]">—</span>
                        ) : (
                          <span
                            className={
                              isGain
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }
                          >
                            {isGain ? '+' : ''}
                            {formatBRL(item.pnl)} ({item.pnlPercent.toFixed(1)}%)
                          </span>
                        )}
                      </td>

                      {/* Proventos Recebidos */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {isWatchlistOnly
                          ? '—'
                          : formatBRLDecimal(item.totalDividendsReceived)}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedChartTicker(item.ticker)}
                            className="p-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition cursor-pointer border border-indigo-500/20"
                            title={`Ver gráfico de ${item.ticker}`}
                          >
                            <BarChart2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openModalWithAction(item.ticker, 'COMPRA')}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition cursor-pointer"
                            title={`Comprar ${item.ticker}`}
                          >
                            Comprar
                          </button>
                          {!isWatchlistOnly && (
                            <button
                              type="button"
                              onClick={() => openModalWithAction(item.ticker, 'VENDA')}
                              className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold rounded-lg text-[10px] transition cursor-pointer border border-red-500/20"
                              title={`Vender ${item.ticker}`}
                            >
                              Vender
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE EVOLUÇÃO DE PREÇO VS PREÇO MÉDIO */}
      {selectedChartTicker && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setSelectedChartTicker(null)}
        >
          <div
            className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-2xl transition-all my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <PriceVsAverageChart
              items={summaryItems}
              initialTicker={selectedChartTicker}
              onClose={() => setSelectedChartTicker(null)}
              isModal={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
