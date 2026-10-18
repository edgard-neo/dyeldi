import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { PortfolioSummaryItem, StockQuote, UserTransaction } from '../../types';
import { InvestorProfileType, ClassAllocations } from '../../hooks/useUserProfile';
import { getProfileTheme } from '../../utils/profileTheme';
import { formatBRL, formatBRLDecimal, formatQuantity } from '../../utils/calculator';
import { formatTimeAgo } from '../../utils/timeAgo';
import { isCryptoTicker, isFiiTicker, isStockTicker } from '../../utils/assetType';
import {
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Info,
  Star,
  Plus,
  RefreshCw,
  Search,
  ArrowUpDown,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  Zap,
  Check,
  X,
  Layers,
  Wallet,
  PiggyBank,
  Activity,
  ChevronDown,
  ChevronUp,
  Filter,
  Target,
  BarChart2,
  Coins,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

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

interface RebalanceTabProps {
  items: PortfolioSummaryItem[];
  quotes?: Record<string, StockQuote>;
  transactions?: UserTransaction[];
  investorProfile?: InvestorProfileType;
  classAllocations?: ClassAllocations;
  onUpdateClassAllocations?: (allocations: ClassAllocations) => void;
  preferredLayout?: 'CARDS' | 'TABLE';
  onUpdatePreferredLayout?: (layout: 'CARDS' | 'TABLE') => void;
  onUpdateTargetPercent?: (ticker: string, newTarget: number) => void;
  onOpenNotificationModal?: () => void;
  onToggleFavorite?: (ticker: string) => void;
  onRefreshQuote?: (ticker: string) => void;
  refreshingTickers?: Record<string, boolean>;
  setDefaultTickerForModal?: (ticker: string) => void;
  setDefaultModalType?: (type: 'COMPRA' | 'VENDA' | 'PROVENTO' | 'DEPOSITO' | 'RETIRADA') => void;
  setEditingTx?: (tx: UserTransaction | Partial<UserTransaction> | null) => void;
  setIsModalOpen?: (isOpen: boolean) => void;
}

export default function RebalanceTab({
  items,
  quotes,
  transactions = [],
  investorProfile = 'ALL',
  classAllocations: propsClassAllocations,
  onUpdateClassAllocations,
  preferredLayout,
  onUpdatePreferredLayout,
  onUpdateTargetPercent,
  onOpenNotificationModal,
  onToggleFavorite,
  onRefreshQuote,
  refreshingTickers,
  setDefaultTickerForModal,
  setDefaultModalType,
  setEditingTx,
  setIsModalOpen,
}: RebalanceTabProps) {
  const [tableSearch, setTableSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<'ALL' | 'COMPRAR' | 'VENDA' | 'AGUARDAR'>('ALL');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<'ALL' | 'STOCKS' | 'FIIS' | 'CRYPTO'>('ALL');
  const [sortBy, setSortBy] = useState<'PRIORITY' | 'AMOUNT_DESC' | 'DY_DESC' | 'TICKER_ASC'>('PRIORITY');
  
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>(() => preferredLayout || 'CARDS');

  // Cash Balance Calculation
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

  // Sync viewMode state when database loads or user updates preference elsewhere
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
  const [isSimulatorMinimized, setIsSimulatorMinimized] = useState<boolean>(true);
  const [isFilterMinimized, setIsFilterMinimized] = useState<boolean>(true);

  // Class Allocation State (Ações, FIIs, Cripto)
  const [classAllocations, setClassAllocationsState] = useState<ClassAllocations>(
    propsClassAllocations || { stocks: 50, fiis: 20, crypto: 30 }
  );

  useEffect(() => {
    if (propsClassAllocations) {
      setClassAllocationsState(propsClassAllocations);
    }
  }, [propsClassAllocations?.stocks, propsClassAllocations?.fiis, propsClassAllocations?.crypto]);

  const setClassAllocations = (
    newAlloc: ClassAllocations | ((prev: ClassAllocations) => ClassAllocations)
  ) => {
    setClassAllocationsState((prev) => {
      const updated = typeof newAlloc === 'function' ? newAlloc(prev) : newAlloc;
      if (onUpdateClassAllocations) {
        onUpdateClassAllocations(updated);
      }
      return updated;
    });
  };
  const [isClassAllocationMinimized, setIsClassAllocationMinimized] = useState<boolean>(true);

  // Rebalance Deadband & Anti-Loop Settings
  const [tolerancePercent, setTolerancePercent] = useState<number>(2.0);
  const [onlyAportes, setOnlyAportes] = useState<boolean>(true);

  const handleApplyClassAllocation = () => {
    const activeItems = items.filter((i) => i.quantity > 0);
    const stockItems = activeItems.filter((i) => isStock(i.ticker));
    const fiiItems = activeItems.filter((i) => isFii(i.ticker));
    const cryptoItems = activeItems.filter((i) => isCrypto(i.ticker));

    const totalStocksTarget = classAllocations.stocks;
    const totalFiisTarget = classAllocations.fiis;
    const totalCryptoTarget = classAllocations.crypto;

    const perStockTarget = stockItems.length > 0 ? totalStocksTarget / stockItems.length : 0;
    const perFiiTarget = fiiItems.length > 0 ? totalFiisTarget / fiiItems.length : 0;
    const perCryptoTarget = cryptoItems.length > 0 ? totalCryptoTarget / cryptoItems.length : 0;

    if (onUpdateTargetPercent) {
      stockItems.forEach((item) => {
        onUpdateTargetPercent(item.ticker, Number(perStockTarget.toFixed(2)));
      });
      fiiItems.forEach((item) => {
        onUpdateTargetPercent(item.ticker, Number(perFiiTarget.toFixed(2)));
      });
      cryptoItems.forEach((item) => {
        onUpdateTargetPercent(item.ticker, Number(perCryptoTarget.toFixed(2)));
      });
    }
    setIsClassAllocationMinimized(true);
  };

  // New Monthly Contribution Simulation
  const [monthlyContributionInput, setMonthlyContributionInput] = useState<string>('');
  const [simulationSelectedTickers, setSimulationSelectedTickers] = useState<string[]>([]);
  const [hasInitializedTickers, setHasInitializedTickers] = useState<boolean>(false);

  const [technicalMap, setTechnicalMap] = useState<Record<string, TechnicalData>>({});
  const [loadingTechnical, setLoadingTechnical] = useState<boolean>(false);

  // Fetch real technical indicators (SMA 200, MVRV, etc.) for crypto & assets
  useEffect(() => {
    let isMounted = true;
    const fetchIndicators = async () => {
      const cryptoTickers = ['BTC', 'ETH', 'SOL'];
      const portfolioTickers = items.map((i) => i.ticker.toUpperCase().trim());
      const allTickers = Array.from(new Set([...cryptoTickers, ...portfolioTickers]));

      setLoadingTechnical(true);
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
        setLoadingTechnical(false);
      }
    };

    fetchIndicators();
    return () => {
      isMounted = false;
    };
  }, [items]);

  const totalCurrentPortfolioValue = items.reduce((sum, item) => sum + item.currentTotalValue, 0);

  const monthlyContribution = useMemo(() => {
    const clean = monthlyContributionInput.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [monthlyContributionInput]);

  // Helpers to classify assets
  const isCrypto = (ticker: string) => isCryptoTicker(ticker);
  const isFii = (ticker: string) => isFiiTicker(ticker);
  const isStock = (ticker: string) => isStockTicker(ticker);

  // Helper for P/L Analysis (Criterion 2)
  const getStockPLAnalysis = (ticker: string, currentPrice: number, lpa?: number) => {
    const t = ticker.toUpperCase().trim();
    const defaults: Record<string, { pl: number; histPl: number; sectorPl: number }> = {
      'PETR4': { pl: 5.8, histPl: 6.5, sectorPl: 7.2 },
      'VALE3': { pl: 7.5, histPl: 8.5, sectorPl: 9.0 },
      'ITUB4': { pl: 9.2, histPl: 9.8, sectorPl: 10.5 },
      'BBDC4': { pl: 8.5, histPl: 9.5, sectorPl: 10.5 },
      'BBAS3': { pl: 4.8, histPl: 5.5, sectorPl: 10.5 },
      'WEGE3': { pl: 28.5, histPl: 32.0, sectorPl: 22.0 },
      'RENT3': { pl: 16.5, histPl: 18.0, sectorPl: 15.0 },
    };

    const est = defaults[t] || { 
      pl: lpa && lpa > 0 && currentPrice > 0 ? Number((currentPrice / lpa).toFixed(1)) : 10.5, 
      histPl: 11.0, 
      sectorPl: 11.5 
    };

    const isCheap = est.pl > 0 && est.pl < est.histPl * 0.9 && est.pl < est.sectorPl * 0.9;
    const isExpensive = est.pl <= 0 || est.pl > est.histPl * 1.15;

    let status = 'Preço Justo (Alinhado)';
    let badgeColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (isCheap) {
      status = 'Barata (Desconto vs Média/Setor)';
      badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    } else if (isExpensive) {
      status = 'Cara / Esticada vs Média';
      badgeColor = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
    }

    return {
      pl: est.pl,
      histPl: est.histPl,
      sectorPl: est.sectorPl,
      status,
      badgeColor,
    };
  };

  // Helper for Crypto Technical Analysis with real SMA 200 and On-Chain indicators (Criterion 3)
  const getCryptoTechnicalAnalysis = (ticker: string, currentPrice: number) => {
    const t = ticker.toUpperCase().trim();
    const techData = technicalMap[t];
    const basePrice = currentPrice > 0 ? currentPrice : (techData?.currentPrice || (t === 'BTC' ? 385000 : t === 'ETH' ? 21000 : 850));
    
    let sma200 = 0;
    let smaDistancePercent = 0;
    let daysCount = 200;
    let isReal = false;
    let mvrv = 1.45;

    if (techData && techData.sma200 > 0) {
      sma200 = techData.sma200;
      smaDistancePercent = techData.smaDistancePercent !== undefined
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

  // Process rebalance items purely by target-allocation goals and current values
  const rebalanceItems = useMemo(() => {
    // Filter to only include active assets that the user actually owns (quantity > 0)
    const activeItems = items.filter((item) => item.quantity > 0);

    // Check if user has explicit target percents defined for their portfolio
    const hasConfiguredTargets = activeItems.some((item) => (item.targetPercent || 0) > 0);

    return activeItems.map((item) => {
      const stock = isStock(item.ticker);
      const fii = isFii(item.ticker);
      const cryptoAsset = isCrypto(item.ticker);
      const hasPosition = item.quantity > 0;

      // Target percent: user-defined target if set, or equal distribution across portfolio
      const targetPercent = hasConfiguredTargets
        ? (item.targetPercent || 0)
        : (items.length > 0 ? 100 / items.length : 0);

      // Calculate ideal value based on current portfolio
      const idealValue =
        totalCurrentPortfolioValue > 0
          ? totalCurrentPortfolioValue * (targetPercent / 100)
          : item.currentPrice > 0
          ? item.currentPrice * 10
          : 0;

      const idealQuantityRaw =
        item.currentPrice > 0
          ? idealValue / item.currentPrice
          : 0;

      const idealQuantity = (stock || fii)
        ? Math.round(idealQuantityRaw)
        : cryptoAsset
        ? Math.round(idealQuantityRaw * 10000) / 10000
        : Math.round(idealQuantityRaw * 100) / 100;

      const lowerBound = targetPercent - tolerancePercent;
      const upperBound = targetPercent + tolerancePercent;

      const isUnderweight = targetPercent > 0 && item.currentPercent < lowerBound && item.quantity < idealQuantity;
      const isOverweight = targetPercent > 0 && !onlyAportes && item.currentPercent > upperBound && item.quantity > idealQuantity;

      let action: 'COMPRAR' | 'VENDA' | 'AGUARDAR' = 'AGUARDAR';
      let reason = '';
      let quantityDiff = 0;
      let amountDiff = 0;

      if (targetPercent > 0) {
        if (isUnderweight) {
          action = 'COMPRAR';
          const diff = idealQuantity > item.quantity ? idealQuantity - item.quantity : 0;
          quantityDiff = cryptoAsset ? Math.round(diff * 10000) / 10000 : Math.max(1, Math.round(diff));
          amountDiff = quantityDiff * item.currentPrice;
          reason = `Abaixo da meta de alocação de ${targetPercent.toFixed(1)}% (atualmente ${item.currentPercent.toFixed(1)}%)`;
        } else if (hasPosition && isOverweight) {
          action = 'VENDA';
          const diff = item.quantity > idealQuantity ? item.quantity - idealQuantity : 0;
          quantityDiff = cryptoAsset ? Math.round(diff * 10000) / 10000 : Math.max(1, Math.round(diff));
          amountDiff = quantityDiff * item.currentPrice;
          reason = `Acima da meta de alocação de ${targetPercent.toFixed(1)}% (atualmente ${item.currentPercent.toFixed(1)}%)`;
        } else {
          action = 'AGUARDAR';
          quantityDiff = 0;
          amountDiff = 0;
          reason = `Dentro da margem ideal da meta de ${targetPercent.toFixed(1)}%`;
        }
      } else {
        action = 'AGUARDAR';
        quantityDiff = 0;
        amountDiff = 0;
        reason = 'Sem meta de alocação definida';
      }

      if (stock || fii) {
        quantityDiff = Math.round(quantityDiff);
      } else if (cryptoAsset) {
        quantityDiff = Math.round(quantityDiff * 10000) / 10000;
      } else {
        quantityDiff = Math.round(quantityDiff * 100) / 100;
      }

      return {
        ...item,
        targetPercent,
        idealValue,
        idealQuantity,
        action,
        reason,
        quantityDiff,
        amountDiff,
      };
    });
  }, [items, totalCurrentPortfolioValue, tolerancePercent, onlyAportes]);

  // Sync default selected tickers for monthly contribution simulation only once initially
  useEffect(() => {
    if (rebalanceItems && rebalanceItems.length > 0 && !hasInitializedTickers) {
      const defaultSelected = rebalanceItems
        .filter((item) => item.action === 'COMPRAR' && item.currentPrice > 0)
        .map((item) => item.ticker);
      if (defaultSelected.length > 0) {
        setSimulationSelectedTickers(defaultSelected);
      } else {
        setSimulationSelectedTickers(rebalanceItems.slice(0, 5).map((item) => item.ticker));
      }
      setHasInitializedTickers(true);
    }
  }, [rebalanceItems, hasInitializedTickers]);

  // Monthly Contribution Simulation Distribution
  const contributionSimulation = useMemo(() => {
    if (monthlyContribution <= 0 || simulationSelectedTickers.length === 0) {
      return {
        allocatedSharesByTicker: {} as Record<string, number>,
        allocatedAmountByTicker: {} as Record<string, number>,
        totalAllocatedAmount: 0,
        unallocatedAmount: monthlyContribution,
        allocatedCount: 0,
      };
    }

    const buyCandidates = rebalanceItems
      .filter((i) => simulationSelectedTickers.includes(i.ticker) && i.currentPrice > 0)
      .sort((a, b) => {
        const diffA = a.amountDiff > 0 ? a.amountDiff : 0;
        const diffB = b.amountDiff > 0 ? b.amountDiff : 0;
        if (diffB !== diffA) return diffB - diffA;
        return (b.safetyMarginPercent || 0) - (a.safetyMarginPercent || 0);
      });

    if (buyCandidates.length === 0) {
      return {
        allocatedSharesByTicker: {},
        allocatedAmountByTicker: {},
        totalAllocatedAmount: 0,
        unallocatedAmount: monthlyContribution,
        allocatedCount: 0,
      };
    }

    const allocatedSharesByTicker: Record<string, number> = {};
    const allocatedAmountByTicker: Record<string, number> = {};
    let remainingBudget = monthlyContribution;

    // First pass: Proportional allocation
    const totalDeficit = buyCandidates.reduce((acc, c) => acc + Math.max(0, c.amountDiff), 0);

    buyCandidates.forEach((candidate) => {
      allocatedSharesByTicker[candidate.ticker] = 0;
      allocatedAmountByTicker[candidate.ticker] = 0;

      let targetBudget = 0;
      if (totalDeficit > 0) {
        const deficit = Math.max(0, candidate.amountDiff);
        targetBudget = (deficit / totalDeficit) * monthlyContribution;
      } else {
        // If no assets have positive deficit, distribute proportionally to their target percents
        const totalTargets = buyCandidates.reduce((acc, c) => acc + (c.targetPercent || 1), 0);
        const targetPct = candidate.targetPercent || 1;
        targetBudget = (targetPct / (totalTargets || 1)) * monthlyContribution;
      }

      const shares = Math.floor(targetBudget / candidate.currentPrice);
      if (shares > 0 && shares * candidate.currentPrice <= remainingBudget) {
        allocatedSharesByTicker[candidate.ticker] = shares;
        const cost = shares * candidate.currentPrice;
        allocatedAmountByTicker[candidate.ticker] = cost;
        remainingBudget -= cost;
      }
    });

    // Second pass: Greedy allocation of remaining balance to highest priority candidates
    let madeProgress = true;
    while (remainingBudget > 0 && madeProgress) {
      madeProgress = false;
      for (const candidate of buyCandidates) {
        if (candidate.currentPrice <= remainingBudget) {
          allocatedSharesByTicker[candidate.ticker] = (allocatedSharesByTicker[candidate.ticker] || 0) + 1;
          allocatedAmountByTicker[candidate.ticker] = (allocatedAmountByTicker[candidate.ticker] || 0) + candidate.currentPrice;
          remainingBudget -= candidate.currentPrice;
          madeProgress = true;
          break; // restart from top priority candidate
        }
      }
    }

    const totalAllocatedAmount = monthlyContribution - remainingBudget;
    const allocatedCount = Object.values(allocatedSharesByTicker).reduce((a, b) => a + b, 0);

    return {
      allocatedSharesByTicker,
      allocatedAmountByTicker,
      totalAllocatedAmount,
      unallocatedAmount: remainingBudget,
      allocatedCount,
    };
  }, [monthlyContribution, rebalanceItems, simulationSelectedTickers]);

  // Summary Metrics
  const buyItems = rebalanceItems.filter((i) => i.action === 'COMPRAR');
  const sellItems = rebalanceItems.filter((i) => i.action === 'VENDA');
  const waitItems = rebalanceItems.filter((i) => i.action === 'AGUARDAR');

  // Effective items with actual rebalance list
  const effectiveRebalanceItems = useMemo(() => {
    return [...rebalanceItems];
  }, [rebalanceItems]);

  // Processed Items (Filtered and Sorted)
  const processedItems = useMemo(() => {
    return effectiveRebalanceItems
      .filter((item) => {
        const matchesSearch = item.ticker.toLowerCase().includes(tableSearch.toLowerCase().trim());
        if (!matchesSearch) return false;

        // Category Filter
        if (assetCategoryFilter === 'STOCKS' && !isStock(item.ticker)) return false;
        if (assetCategoryFilter === 'FIIS' && !isFii(item.ticker)) return false;
        if (assetCategoryFilter === 'CRYPTO' && !isCrypto(item.ticker)) return false;

        if (actionFilter === 'COMPRAR') return item.action === 'COMPRAR';
        if (actionFilter === 'VENDA') return item.action === 'VENDA';
        if (actionFilter === 'AGUARDAR') return item.action === 'AGUARDAR';
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'PRIORITY') {
          const priority = { COMPRAR: 1, VENDA: 2, AGUARDAR: 3 };
          const pDiff = priority[a.action] - priority[b.action];
          if (pDiff !== 0) return pDiff;
          return b.amountDiff - a.amountDiff;
        }
        if (sortBy === 'AMOUNT_DESC') return b.amountDiff - a.amountDiff;
        if (sortBy === 'DY_DESC') return (b.dy || 0) - (a.dy || 0);
        if (sortBy === 'TICKER_ASC') return a.ticker.localeCompare(b.ticker);
        return 0;
      });
  }, [effectiveRebalanceItems, tableSearch, actionFilter, sortBy, assetCategoryFilter]);

  // Open operation modal directly with suggested quantity
  const handleOpenBuyModal = (ticker: string, suggestedQuantity?: number) => {
    if (setDefaultTickerForModal && setDefaultModalType && setIsModalOpen) {
      setDefaultTickerForModal(ticker);
      setDefaultModalType('COMPRA');
      if (setEditingTx) {
        if (suggestedQuantity && suggestedQuantity > 0) {
          setEditingTx({
            ticker,
            type: 'COMPRA',
            quantity: suggestedQuantity,
            price: quotes?.[ticker]?.price || 0,
            date: new Date().toISOString().split('T')[0],
          });
        } else {
          setEditingTx(null);
        }
      }
      setIsModalOpen(true);
    }
  };

  const handleOpenSellModal = (ticker: string, suggestedQuantity?: number) => {
    if (setDefaultTickerForModal && setDefaultModalType && setIsModalOpen) {
      setDefaultTickerForModal(ticker);
      setDefaultModalType('VENDA');
      if (setEditingTx) {
        if (suggestedQuantity && suggestedQuantity > 0) {
          setEditingTx({
            ticker,
            type: 'VENDA',
            quantity: suggestedQuantity,
            price: quotes?.[ticker]?.price || 0,
            date: new Date().toISOString().split('T')[0],
          });
        } else {
          setEditingTx(null);
        }
      }
      setIsModalOpen(true);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1.5. DEFINIÇÃO DE ALOCAÇÃO POR CLASSE DE ATIVOS */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                Definição de Alocação por Classe de Ativos
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {classAllocations.stocks}% Ações · {classAllocations.fiis}% FIIs · {classAllocations.crypto}% Cripto
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Escolha a porcentagem ideal para cada classe da sua carteira (ex: 50% Ações, 20% FIIs, 30% Cripto).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isClassAllocationMinimized && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-zinc-400 font-medium hidden md:inline">Presets:</span>
                <button
                  type="button"
                  onClick={() => setClassAllocations({ stocks: 50, fiis: 20, crypto: 30 })}
                  className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  50 / 20 / 30
                </button>
                <button
                  type="button"
                  onClick={() => setClassAllocations({ stocks: 70, fiis: 30, crypto: 0 })}
                  className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  70 / 30 / 0
                </button>
                <button
                  type="button"
                  onClick={() => setClassAllocations({ stocks: 100, fiis: 0, crypto: 0 })}
                  className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  100% Ações
                </button>
                <button
                  type="button"
                  onClick={() => setClassAllocations({ stocks: 0, fiis: 100, crypto: 0 })}
                  className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  100% FIIs
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsClassAllocationMinimized((prev) => !prev)}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer shrink-0"
              title={isClassAllocationMinimized ? 'Expandir alocação por classe' : 'Minimizar alocação por classe'}
              aria-label={isClassAllocationMinimized ? 'Expandir alocação por classe' : 'Minimizar alocação por classe'}
            >
              {isClassAllocationMinimized ? (
                <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
            </button>
          </div>
        </div>

        {!isClassAllocationMinimized && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Stocks input */}
              <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Ações (%)</span>
                  <span className="font-mono text-zinc-500">{classAllocations.stocks}%</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={classAllocations.stocks}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setClassAllocations((prev) => ({ ...prev, stocks: val }));
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.10] rounded-lg text-sm font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* FIIs input */}
              <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>FIIs (%)</span>
                  <span className="font-mono text-zinc-500">{classAllocations.fiis}%</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={classAllocations.fiis}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setClassAllocations((prev) => ({ ...prev, fiis: val }));
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.10] rounded-lg text-sm font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Crypto input */}
              <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Cripto (%)</span>
                  <span className="font-mono text-zinc-500">{classAllocations.crypto}%</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={classAllocations.crypto}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setClassAllocations((prev) => ({ ...prev, crypto: val }));
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.10] rounded-lg text-sm font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Rebalance Deadband & Anti-Loop Settings */}
            <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                    Faixa de Tolerância (Deadband) para Rebalanceamento
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Evita micro-ajustes e ciclos de compra/venda infinitos quando a alocação está próxima da meta.
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1.0, 2.0, 3.0, 5.0].map((tol) => (
                    <button
                      key={tol}
                      type="button"
                      onClick={() => setTolerancePercent(tol)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                        tolerancePercent === tol
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 border border-black/[0.04] dark:border-white/[0.06]'
                      }`}
                    >
                      ±{tol.toFixed(1)}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                    Apenas Aportes (Sem Vendas)
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Recomenda apenas compras com novos aportes/caixa, ignorando excessos (evita o loop de vender ativos para comprar outros).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOnlyAportes((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    onlyAportes ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      onlyAportes ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
              <div className="text-xs flex items-center gap-2">
                <span className="text-zinc-500">Soma Total:</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
                  classAllocations.stocks + classAllocations.fiis + classAllocations.crypto === 100
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}>
                  {classAllocations.stocks + classAllocations.fiis + classAllocations.crypto}%
                </span>
                {classAllocations.stocks + classAllocations.fiis + classAllocations.crypto !== 100 && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400">
                    (O ideal é somar exatamente 100%)
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleApplyClassAllocation}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Aplicar Alocação e Distribuir aos Ativos
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. NOVO: SIMULADOR DE VALOR DO APORTE DO MÊS */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                Simulador de Aporte do Mês
                {monthlyContribution > 0 && (
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Ativo ({formatBRL(monthlyContribution)})
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Informe quanto pretende investir agora para calcular a distribuição exata em cotas inteiras.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Preset Buttons */}
            {!isSimulatorMinimized && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setMonthlyContributionInput(cashBalance > 0 ? cashBalance.toString() : '0')}
                  className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold font-mono transition cursor-pointer flex items-center gap-1"
                >
                  <Wallet className="w-3 h-3" /> Usar Saldo ({formatBRL(cashBalance)})
                </button>
                <span className="text-[10px] text-zinc-400 font-medium hidden md:inline">Atalhos:</span>
                {[500, 1000, 2000, 5000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMonthlyContributionInput(val.toString())}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-mono font-medium transition cursor-pointer"
                  >
                    +R$ {val >= 1000 ? `${val / 1000}k` : val}
                  </button>
                ))}
                {monthlyContribution > 0 && (
                  <button
                    type="button"
                    onClick={() => setMonthlyContributionInput('')}
                    className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsSimulatorMinimized((prev) => !prev)}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer shrink-0"
              title={isSimulatorMinimized ? 'Expandir simulador' : 'Minimizar simulador'}
              aria-label={isSimulatorMinimized ? 'Expandir simulador' : 'Minimizar simulador'}
            >
              {isSimulatorMinimized ? (
                <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
            </button>
          </div>
        </div>

        {/* Input & Simulation Summary */}
        {!isSimulatorMinimized && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center animate-in fade-in duration-150">
            <div className="md:col-span-4">
              <label className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 block mb-1.5">
                Valor do Aporte (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-zinc-400">
                  R$
                </span>
                <input
                  type="text"
                  value={monthlyContributionInput}
                  onChange={(e) => setMonthlyContributionInput(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/60 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-mono font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Simulation Outcome Card */}
            <div className="md:col-span-8">
              {monthlyContribution > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-emerald-500/5 dark:bg-emerald-500/[0.04] border border-emerald-500/20 rounded-xl">
                  <div>
                    <span className="text-[10px] uppercase font-medium tracking-widest text-zinc-500 dark:text-zinc-400 block">
                      Aporte Planejado
                    </span>
                    <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                      {formatBRL(monthlyContribution)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-medium tracking-widest text-emerald-600 dark:text-emerald-400 block">
                      Total Alocado em Cotas
                    </span>
                    <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatBRL(contributionSimulation.totalAllocatedAmount)}
                      <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 ml-1">
                        ({contributionSimulation.allocatedCount} cotas)
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-medium tracking-widest text-zinc-500 dark:text-zinc-400 block">
                      Sobra de Caixa (Troco)
                    </span>
                    <span className="text-sm font-mono font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {formatBRL(contributionSimulation.unallocatedAmount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] rounded-xl text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>
                    Digite um valor acima para ver a sugestão personalizada de compra para o seu aporte de hoje.
                  </span>
                </div>
              )}
            </div>

            {/* Warning if contribution exceeds available cash balance */}
            {monthlyContribution > cashBalance && cashBalance >= 0 && (
              <div className="md:col-span-12 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3 text-amber-800 dark:text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    <strong>Atenção ao Saldo em Caixa:</strong> O aporte simulado ({formatBRL(monthlyContribution)}) excede o seu saldo em caixa disponível ({formatBRL(cashBalance)}). Para evitar comprar sem saldo, clique em "Usar Saldo" ou faça um depósito na aba Lançamentos.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMonthlyContributionInput(cashBalance > 0 ? cashBalance.toString() : '0')}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold whitespace-nowrap transition cursor-pointer"
                >
                  Usar Saldo ({formatBRL(cashBalance)})
                </button>
              </div>
            )}

            {/* Seletor Minimalista e Clean para Diluição do Aporte */}
            <div className="md:col-span-12 pt-3.5 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  Diluir aporte em papéis específicos (Apenas sugeridos para comprar):
                </span>
                
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const recommended = rebalanceItems
                        .filter((i) => i.action === 'COMPRAR' && i.currentPrice > 0)
                        .map((i) => i.ticker);
                      setSimulationSelectedTickers(recommended);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer"
                  >
                    Selecionar Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulationSelectedTickers([])}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition cursor-pointer"
                  >
                    Limpar Seleção
                  </button>
                </div>
              </div>

              {/* Chips de Ativos */}
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 pb-1 scrollbar-thin">
                {rebalanceItems
                  .filter((item) => item.action === 'COMPRAR')
                  .map((item) => {
                    const isSelected = simulationSelectedTickers.includes(item.ticker);
                    
                    return (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() => {
                          setSimulationSelectedTickers((prev) =>
                            prev.includes(item.ticker)
                              ? prev.filter((t) => t !== item.ticker)
                              : [...prev, item.ticker]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold shadow-xs'
                            : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-[#131316] dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-black/[0.06] dark:border-white/[0.06]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {item.ticker}
                      </button>
                    );
                  })}
                {rebalanceItems.filter((item) => item.action === 'COMPRAR').length === 0 && (
                  <div className="text-xs text-zinc-400 dark:text-zinc-500 italic py-1">
                    Nenhum ativo sugerido para compra no momento (carteira balanceada).
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. MAIN CONTAINER: CARDS VS TABELA COM BUSCA E FILTROS */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs p-4 sm:p-5 space-y-4">
        {/* Header & View Switcher */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
              <Layers className="w-4 h-4 text-emerald-500" />
              Tabela de Rebalanceamento ({rebalanceItems.length})
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Visualize a meta de cotas de cada papel e os sinais de aporte calculados.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFilterMinimized((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl border font-medium text-xs transition flex items-center gap-1.5 cursor-pointer ${
                isFilterMinimized
                  ? 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-300 border-black/[0.06] dark:border-white/[0.08]'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold'
              }`}
              title={isFilterMinimized ? 'Expandir filtros' : 'Minimizar filtros'}
            >
              <Filter className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Filtros</span>
              {isFilterMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>

            {/* View Switcher (Cards vs Table) */}
            <div className="flex items-center bg-zinc-100 dark:bg-white/[0.06] p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium">
              <button
                type="button"
                onClick={() => handleViewModeChange('CARDS')}
                className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  viewMode === 'CARDS'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
                title="Visualização em Cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('TABLE')}
                className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  viewMode === 'TABLE'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
                title="Visualização em Tabela Completa"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabela</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Quick Tabs Bar */}
        {!isFilterMinimized && (
          <div className="space-y-3 bg-zinc-50 dark:bg-white/[0.03] p-3 rounded-xl border border-black/[0.04] dark:border-white/[0.04] animate-in fade-in duration-150">
            {/* Category Filter Pills Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-black/[0.04] dark:border-white/[0.04] pb-2.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Filtrar Categoria:</span>
              <div className="flex items-center bg-white dark:bg-zinc-900 p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-[11px] font-medium self-start sm:self-auto overflow-x-auto max-w-full">
                <button
                  key="ALL"
                  type="button"
                  onClick={() => setAssetCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                    assetCategoryFilter === 'ALL'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-2xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Todos os Ativos ({rebalanceItems.length})
                </button>
                <button
                  key="STOCKS"
                  type="button"
                  onClick={() => setAssetCategoryFilter('STOCKS')}
                  className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                    assetCategoryFilter === 'STOCKS'
                      ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  Ações B3
                </button>
                <button
                  key="FIIS"
                  type="button"
                  onClick={() => setAssetCategoryFilter('FIIS')}
                  className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                    assetCategoryFilter === 'FIIS'
                      ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  FIIs B3
                </button>
                <button
                  key="CRYPTO"
                  type="button"
                  onClick={() => setAssetCategoryFilter('CRYPTO')}
                  className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                    assetCategoryFilter === 'CRYPTO'
                      ? 'bg-amber-600 text-white font-semibold shadow-2xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                >
                  Criptoativos
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Quick Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar ativo (ex: PETR4, BBAS3)..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.10] rounded-xl text-xs font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {tableSearch && (
                  <button
                    type="button"
                    onClick={() => setTableSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center bg-white dark:bg-zinc-900 p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setActionFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      actionFilter === 'ALL'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Todos ({rebalanceItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionFilter('COMPRAR')}
                    className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      actionFilter === 'COMPRAR'
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    <ArrowUpRight className="w-3 h-3" /> Comprar ({buyItems.length})
                  </button>
                  {sellItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActionFilter('VENDA')}
                      className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                        actionFilter === 'VENDA'
                          ? 'bg-red-600 text-white font-semibold'
                          : 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
                      }`}
                    >
                      <ArrowDownRight className="w-3 h-3" /> Vender ({sellItems.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActionFilter('AGUARDAR')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      actionFilter === 'AGUARDAR'
                        ? 'bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-950 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Aguardar ({waitItems.length})
                  </button>
                </div>

                {/* Sort Selector */}
                <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 font-medium bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    aria-label="Ordenar itens do rebalanceamento"
                    className="bg-transparent text-zinc-800 dark:text-zinc-200 font-medium text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="PRIORITY" className="dark:bg-zinc-900">Prioridade (Sinal)</option>
                    <option value="AMOUNT_DESC" className="dark:bg-zinc-900">Maior Demanda (R$)</option>
                    <option value="DY_DESC" className="dark:bg-zinc-900">Maior Dividend Yield</option>
                    <option value="TICKER_ASC" className="dark:bg-zinc-900">Ticker (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {processedItems.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
            <Scale className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700" />
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              Nenhum ativo encontrado para os filtros selecionados.
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Experimente ajustar o termo de busca ou o filtro de sinal.
            </p>
          </div>
        ) : viewMode === 'CARDS' ? (
          /* ============================================================ */
          /* 5. MODALIDADE 1: GRID DE CARDS AMIGÁVEIS (VISUAL MODERNO)    */
          /* ============================================================ */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {processedItems.map((item) => {
              const isStockAsset = isStock(item.ticker);
              const isWatchlistOnly = item.quantity === 0 && item.isFavorite;
              const isBuy = item.action === 'COMPRAR';
              const isSell = item.action === 'VENDA';
              const progressPercent =
                item.idealQuantity > 0 ? Math.min(100, (item.quantity / item.idealQuantity) * 100) : 100;

              const isSimulationMode = !isSimulatorMinimized;
              const isTickerSelectedInSimulation = simulationSelectedTickers.includes(item.ticker);
              const monthlyShares = contributionSimulation.allocatedSharesByTicker[item.ticker] || 0;
              const monthlyAmount = contributionSimulation.allocatedAmountByTicker[item.ticker] || 0;
              const hasMonthlyAllocated = isSimulationMode && isTickerSelectedInSimulation && monthlyShares > 0;

              const buttonQuantity = isSimulationMode
                ? (isTickerSelectedInSimulation ? monthlyShares : 0)
                : item.quantityDiff;
              const buttonAmount = isSimulationMode
                ? (isTickerSelectedInSimulation ? monthlyAmount : 0)
                : item.amountDiff;

              return (
                <div
                  key={item.ticker}
                  className={`rounded-2xl border p-4 shadow-xs transition-all flex flex-col justify-between space-y-3 bg-white dark:bg-[#0f0f11] ${
                    isBuy
                      ? 'border-emerald-500/30'
                      : isSell
                      ? 'border-red-500/30'
                      : isWatchlistOnly
                      ? 'border-amber-500/30'
                      : 'border-black/[0.06] dark:border-white/[0.08]'
                  }`}
                >
                  {/* Top Bar of Card */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {onToggleFavorite && (
                          <button
                            type="button"
                            onClick={() => onToggleFavorite(item.ticker)}
                            className="text-amber-400 hover:text-amber-500 transition cursor-pointer p-0.5 rounded"
                            title={item.isFavorite ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
                          >
                            <Star
                              className={`w-4 h-4 ${
                                item.isFavorite
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-zinc-300 dark:text-zinc-600 hover:text-amber-400'
                              }`}
                            />
                          </button>
                        )}
                        <span className="font-mono font-semibold text-sm px-2.5 py-1 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-xl shadow-xs">
                          {item.ticker}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 rounded-md uppercase border border-black/[0.04] dark:border-white/[0.04]">
                          {isStockAsset ? 'Ação' : isCrypto(item.ticker) ? 'Cripto' : 'FII'}
                        </span>
                        {item.isFavorite && (
                          <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-md">
                            Em Radar
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium font-mono tabular-nums">
                        {isCrypto(item.ticker) ? 'Cotação CoinGecko' : 'Cotação'}: <span className="font-semibold text-zinc-900 dark:text-white">{formatBRLDecimal(item.currentPrice)}</span> •{' '}
                        {isCrypto(item.ticker) ? (
                          (() => {
                            const changePct = quotes?.[item.ticker]?.changePercent ?? 0;
                            return (
                              <span className={`font-medium ${changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                Var 24h: {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            DY {item.dy.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Pill Badge */}
                    <div>
                      {isSimulationMode ? (
                        isTickerSelectedInSimulation ? (
                          monthlyShares > 0 ? (
                            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl font-medium text-xs flex items-center gap-1 font-mono tabular-nums">
                              <ArrowUpRight className="w-3.5 h-3.5" /> +{formatQuantity(monthlyShares, isCrypto(item.ticker))} {isCrypto(item.ticker) ? 'un' : 'cotas'}
                            </span>
                          ) : monthlyContribution === 0 ? (
                            <span className="px-2.5 py-1 bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 border border-black/[0.06] dark:border-white/[0.08] rounded-xl font-medium text-xs flex items-center gap-1">
                              <Coins className="w-3.5 h-3.5 text-zinc-400" /> Digite o aporte
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl font-medium text-xs flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Sem saldo
                            </span>
                          )
                        ) : (
                          <span className="px-2.5 py-1 bg-zinc-100 dark:bg-white/[0.06] text-zinc-400 dark:text-zinc-500 border border-black/[0.06] dark:border-white/[0.08] rounded-xl font-medium text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" /> Fora do aporte
                          </span>
                        )
                      ) : isBuy ? (
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl font-medium text-xs flex items-center gap-1 font-mono tabular-nums">
                          <ArrowUpRight className="w-3.5 h-3.5" /> +{formatQuantity(item.quantityDiff, isCrypto(item.ticker))} {isCrypto(item.ticker) ? 'un' : 'cotas'}
                        </span>
                      ) : isSell ? (
                        <span className="px-2.5 py-1 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl font-medium text-xs flex items-center gap-1 font-mono tabular-nums">
                          <ArrowDownRight className="w-3.5 h-3.5" /> -{formatQuantity(item.quantityDiff, isCrypto(item.ticker))} {isCrypto(item.ticker) ? 'un' : 'cotas'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.08] rounded-xl font-medium text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" /> Aguardar
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Monthly Contribution Allocation Highlight */}
                  {hasMonthlyAllocated && (
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs flex items-center justify-between text-emerald-700 dark:text-emerald-300 font-medium">
                      <span className="flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                        Aporte deste mês:
                      </span>
                      <span className="font-mono font-bold tabular-nums">
                        +{formatQuantity(monthlyShares, isCrypto(item.ticker))} cotas (~{formatBRL(monthlyAmount)})
                      </span>
                    </div>
                  )}

                  {/* Progress Bar or Crypto Summary */}
                  {isCrypto(item.ticker) ? (
                    <div className="space-y-1 bg-zinc-50 dark:bg-zinc-950/60 p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
                      <div className="flex justify-between text-[11px] font-medium">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          Estratégia: Criptoativo
                        </span>
                        <span className="font-mono text-zinc-900 dark:text-white tabular-nums font-semibold">
                          {formatQuantity(item.quantity, true)} unidades
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-mono pt-1 border-t border-black/[0.04] dark:border-white/[0.04] tabular-nums">
                        <span>Valor Atual:</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">{formatBRL(item.currentTotalValue)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 bg-zinc-50 dark:bg-zinc-950/60 p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
                      <div className="flex justify-between text-[11px] font-medium">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          Meta: {item.targetPercent.toFixed(1)}% da carteira
                        </span>
                        <span className="font-mono text-zinc-900 dark:text-white tabular-nums">
                          {formatQuantity(item.quantity, isCrypto(item.ticker))} / {formatQuantity(item.idealQuantity, isCrypto(item.ticker))} cotas ({progressPercent.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            isBuy ? 'bg-emerald-500' : isSell ? 'bg-red-500' : 'bg-zinc-400 dark:bg-zinc-600'
                          }`}
                          style={{ width: `${Math.min(100, progressPercent)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-mono pt-0.5 tabular-nums">
                        <span>Atual: {formatBRL(item.currentTotalValue)}</span>
                        <span>Meta: {formatBRL(item.idealValue)}</span>
                      </div>
                    </div>
                  )}

                  {/* Reason Explanation */}
                  {item.reason && (
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-start gap-1.5 p-2 bg-zinc-50 dark:bg-white/[0.02] rounded-lg border border-black/[0.04] dark:border-white/[0.04]">
                      <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                      <span className="leading-tight">{item.reason}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center gap-2">
                    {isSimulationMode ? (
                      isTickerSelectedInSimulation ? (
                        monthlyShares > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenBuyModal(item.ticker, monthlyShares)}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            title={`Lançar compra de ${item.ticker}`}
                          >
                            <Plus className="w-4 h-4" />
                            Comprar +{formatQuantity(monthlyShares, isCrypto(item.ticker))} cotas (~{formatBRL(monthlyAmount)})
                          </button>
                        ) : monthlyContribution === 0 ? (
                          <button
                            type="button"
                            disabled
                            className="flex-1 py-2 bg-zinc-100 dark:bg-white/[0.04] text-zinc-400 dark:text-zinc-500 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed border border-black/[0.04] dark:border-white/[0.04]"
                          >
                            Digite o valor do aporte acima
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="flex-1 py-2 bg-zinc-100 dark:bg-white/[0.04] text-zinc-400 dark:text-zinc-500 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed border border-black/[0.04] dark:border-white/[0.04]"
                          >
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            Saldo insuficiente p/ aporte (~{formatBRL(item.currentPrice)})
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="flex-1 py-2 bg-zinc-100 dark:bg-white/[0.04] text-zinc-300 dark:text-zinc-600 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed border border-black/[0.04] dark:border-white/[0.04]"
                        >
                          Fora do plano de aporte
                        </button>
                      )
                    ) : isBuy ? (
                      <button
                        type="button"
                        onClick={() => handleOpenBuyModal(item.ticker, buttonQuantity)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        title={`Lançar compra de ${item.ticker}`}
                      >
                        <Plus className="w-4 h-4" />
                        Comprar +{formatQuantity(buttonQuantity, isCrypto(item.ticker))} cotas (~{formatBRL(buttonAmount)})
                      </button>
                    ) : isSell ? (
                      <button
                        type="button"
                        onClick={() => handleOpenSellModal(item.ticker, item.quantityDiff)}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        title={`Lançar venda de ${item.ticker}`}
                      >
                        <ArrowDownRight className="w-4 h-4" />
                        Vender -{formatQuantity(item.quantityDiff, isCrypto(item.ticker))} cotas
                      </button>
                    ) : (
                      <div className="flex-1 flex items-center justify-between text-xs text-zinc-500">
                        <span className="text-[11px] font-medium">Posição em equilíbrio</span>
                        <button
                          type="button"
                          onClick={() => handleOpenBuyModal(item.ticker)}
                          className="px-2.5 py-1 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer border border-black/[0.06] dark:border-white/[0.08]"
                        >
                          <Plus className="w-3 h-3" /> Aportar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ============================================================ */
          /* 6. MODALIDADE 2: TABELA DETALHADA TRADICIONAL                */
          /* ============================================================ */
          <div className="overflow-x-auto rounded-xl border border-black/[0.06] dark:border-white/[0.06]">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/80 text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-widest text-[10px] border-b border-black/[0.06] dark:border-white/[0.06]">
                <tr>
                  <th className="py-3 px-3">Ativo</th>
                  <th className="py-3 px-3 text-right">Cotação</th>
                  <th className="py-3 px-3 text-center">Peso Atual</th>
                  <th className="py-3 px-3 text-center">Peso Alvo</th>
                  <th className="py-3 px-3 text-right">Desvio Peso / Valor</th>
                  <th className="py-3 px-3 text-right">Cotas / Unidades</th>
                  <th className="py-3 px-3 text-center">Sinal & Justificativa</th>
                  <th className="py-3 px-3 text-center">Ação Direta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04] text-zinc-700 dark:text-zinc-300 font-medium">
                {processedItems.map((item) => {
                  const isStockAsset = isStock(item.ticker);

                  const isSimulationMode = !isSimulatorMinimized;
                  const isTickerSelectedInSimulation = simulationSelectedTickers.includes(item.ticker);
                  const monthlyShares = contributionSimulation.allocatedSharesByTicker[item.ticker] || 0;
                  const monthlyAmount = contributionSimulation.allocatedAmountByTicker[item.ticker] || 0;
                  const hasMonthlyAllocated = isSimulationMode && isTickerSelectedInSimulation && monthlyShares > 0;

                  const buttonQuantity = isSimulationMode
                    ? (isTickerSelectedInSimulation ? monthlyShares : 0)
                    : item.quantityDiff;
                  const buttonAmount = isSimulationMode
                    ? (isTickerSelectedInSimulation ? monthlyAmount : 0)
                    : item.amountDiff;

                  const pctDiff = item.currentPercent - item.targetPercent;
                  const valDiff = item.currentTotalValue - item.idealValue;

                  return (
                    <tr
                      key={item.ticker}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition"
                    >
                      {/* Ticker & Favorite Star */}
                      <td className="py-3 px-3 font-semibold">
                        <div className="flex items-center gap-2">
                          {onToggleFavorite && (
                            <button
                              type="button"
                              onClick={() => onToggleFavorite(item.ticker)}
                              className="text-amber-400 hover:text-amber-500 transition cursor-pointer p-0.5 rounded"
                              title={item.isFavorite ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  item.isFavorite
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-zinc-300 dark:text-zinc-600 hover:text-amber-400'
                                }`}
                              />
                            </button>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded font-mono text-xs font-semibold">
                              {item.ticker}
                            </span>
                            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded uppercase bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 border border-black/[0.04] dark:border-white/[0.04]">
                              {isStockAsset ? 'Ação' : isCrypto(item.ticker) ? 'Cripto' : 'FII'}
                            </span>
                            {item.isFavorite && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Em Radar
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Price & Quote Update Info */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {formatBRLDecimal(item.currentPrice)}
                          </span>
                          {onRefreshQuote && (
                            <button
                              type="button"
                              onClick={() => onRefreshQuote(item.ticker)}
                              disabled={refreshingTickers && refreshingTickers[item.ticker]}
                              className="p-0.5 hover:bg-zinc-100 dark:hover:bg-white/[0.06] rounded text-zinc-400 hover:text-emerald-500 transition disabled:opacity-50 cursor-pointer"
                              title="Atualizar cotação deste ativo"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${
                                  refreshingTickers && refreshingTickers[item.ticker]
                                    ? 'animate-spin text-emerald-500'
                                    : ''
                                }`}
                              />
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                          {formatTimeAgo(item.updatedAt)}
                        </div>
                      </td>

                      {/* Column 3: Peso Atual */}
                      <td className="py-3 px-3 text-center font-mono tabular-nums text-zinc-900 dark:text-white font-semibold">
                        {item.currentPercent.toFixed(1)}%
                      </td>

                      {/* Column 4: Peso Alvo */}
                      <td className="py-3 px-3 text-center font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                        {item.targetPercent.toFixed(1)}%
                      </td>

                      {/* Column 5: Desvio Peso / Valor */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className={`font-semibold ${pctDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {pctDiff >= 0 ? '+' : ''}{pctDiff.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {valDiff >= 0 ? '+' : ''}{formatBRL(valDiff)}
                        </div>
                      </td>

                      {/* Current vs Ideal Quantity */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {isCrypto(item.ticker) ? (
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-white">
                              {formatQuantity(item.quantity, true)} <span className="text-zinc-400 font-normal">unidades</span>
                            </div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                              {formatBRL(item.currentTotalValue)}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-white">
                              {formatQuantity(item.quantity, isCrypto(item.ticker))} <span className="text-zinc-400 font-normal">cotas</span>
                            </div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              Meta: {formatQuantity(item.idealQuantity, isCrypto(item.ticker))} cotas ({formatBRL(item.idealValue)})
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Dyeldi Trigger Action */}
                      <td className="py-3 px-3 text-center">
                        {isSimulationMode ? (
                          isTickerSelectedInSimulation ? (
                            monthlyShares > 0 ? (
                              <div className="inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 max-w-[240px]">
                                <span className="font-semibold flex items-center gap-1 text-xs font-mono tabular-nums">
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                  APORTE (+{formatQuantity(monthlyShares, isCrypto(item.ticker))})
                                </span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center leading-tight">
                                  Alocação planejada de {formatBRL(monthlyAmount)}
                                </span>
                              </div>
                            ) : monthlyContribution === 0 ? (
                              <div className="inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-white/[0.04] text-zinc-400 dark:text-zinc-500 border border-black/[0.04] dark:border-white/[0.04] text-xs max-w-[220px]">
                                <span className="flex items-center gap-1 font-semibold">
                                  <Coins className="w-3.5 h-3.5 text-zinc-400" />
                                  DIGITE O APORTE
                                </span>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-tight">
                                  Simulação zerada
                                </span>
                              </div>
                            ) : (
                              <div className="inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 max-w-[240px]">
                                <span className="font-semibold flex items-center gap-1 text-xs font-mono">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  SEM SALDO P/ COTA
                                </span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center leading-tight">
                                  Ativo custa {formatBRL(item.currentPrice)}
                                </span>
                              </div>
                            )
                          ) : (
                            <div className="inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-white/[0.04] text-zinc-400 dark:text-zinc-500 border border-black/[0.04] dark:border-white/[0.04] text-xs max-w-[220px]">
                              <span className="flex items-center gap-1 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                                FORA DO APORTE
                              </span>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-tight">
                                Desmarcado no filtro
                              </span>
                            </div>
                          )
                        ) : item.action === 'COMPRAR' ? (
                          <div className="inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 max-w-[240px]">
                            <span className="font-semibold flex items-center gap-1 text-xs font-mono tabular-nums">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              COMPRAR {buttonQuantity > 0 ? `(+${formatQuantity(buttonQuantity, isCrypto(item.ticker))})` : ''}
                            </span>
                            <span className="text-xs text-zinc-600 dark:text-zinc-300 text-center leading-snug">
                              {item.reason}
                            </span>
                          </div>
                        ) : item.action === 'VENDA' ? (
                          <div className="inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 max-w-[240px]">
                            <span className="font-semibold flex items-center gap-1 text-xs font-mono tabular-nums">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              VENDER (-{formatQuantity(item.quantityDiff, isCrypto(item.ticker))})
                            </span>
                            <span className="text-xs text-zinc-600 dark:text-zinc-300 text-center leading-snug">
                              {item.reason}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 border border-black/[0.04] dark:border-white/[0.04] text-xs max-w-[220px]">
                            <span className="flex items-center gap-1 font-semibold">
                              <CheckCircle2 className="w-3 h-3 text-zinc-400" />
                              Aguardar
                            </span>
                            {item.reason && (
                              <span className="text-xs text-zinc-600 dark:text-zinc-300 text-center leading-snug">
                                {item.reason}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Direct Operation Button */}
                      <td className="py-3 px-3 text-center">
                        {isSimulationMode ? (
                          isTickerSelectedInSimulation ? (
                            monthlyShares > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleOpenBuyModal(item.ticker, monthlyShares)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                                title={`Comprar ${item.ticker}`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Comprar +{formatQuantity(monthlyShares, isCrypto(item.ticker))}
                              </button>
                            ) : monthlyContribution === 0 ? (
                              <button
                                type="button"
                                disabled
                                className="px-2.5 py-1 bg-zinc-100 dark:bg-white/[0.04] text-zinc-300 dark:text-zinc-600 font-medium rounded-lg text-xs inline-flex items-center gap-1 cursor-not-allowed border border-black/[0.06] dark:border-white/[0.06]"
                                title="Digite um valor de aporte acima para simular"
                              >
                                Sem valor
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="px-2.5 py-1 bg-zinc-100 dark:bg-white/[0.04] text-zinc-400 dark:text-zinc-500 font-medium rounded-lg text-xs inline-flex items-center gap-1 cursor-not-allowed border border-black/[0.06] dark:border-white/[0.06]"
                                title="Aporte insuficiente para este ativo"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                Sem saldo
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="px-2.5 py-1 bg-zinc-100 dark:bg-white/[0.04] text-zinc-300 dark:text-zinc-600 font-medium rounded-lg text-xs inline-flex items-center gap-1 cursor-not-allowed border border-black/[0.06] dark:border-white/[0.06]"
                              title="Desmarcado do plano de diluição"
                            >
                              Fora do aporte
                            </button>
                          )
                        ) : item.action === 'COMPRAR' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenBuyModal(item.ticker, buttonQuantity)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                            title={`Comprar ${item.ticker}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Comprar +{formatQuantity(buttonQuantity, isCrypto(item.ticker))}
                          </button>
                        ) : item.action === 'VENDA' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenSellModal(item.ticker, item.quantityDiff)}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-xs transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                            title={`Vender ${item.ticker}`}
                          >
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            Vender
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenBuyModal(item.ticker)}
                            className="px-2 py-1 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06] rounded-lg text-xs font-medium transition inline-flex items-center gap-1 cursor-pointer border border-black/[0.06] dark:border-white/[0.08]"
                            title={`Lançar aporte em ${item.ticker}`}
                          >
                            <Plus className="w-3 h-3" />
                            Aporte
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
    </div>
  );
}
