import {
  UserTransaction,
  StockQuote,
  ConsolidatedPortfolio,
  PortfolioSummaryItem,
} from '../types';
import {
  processTransactions,
  calculateBazinCeiling,
  calculateMagicNumber,
  calculateGrahamPrice,
} from './calculator';
import { isCryptoTicker } from './assetType';

export interface PortfolioMetricsResult {
  calculatedPositionsMap: Record<string, any>;
  monthlyDividends: any[];
  activeTickers: string[];
  allPortfolioTickers: string[];
  totalCurrentPortfolioValue: number;
  summaryItems: PortfolioSummaryItem[];
  totalCostBasis: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalDividendsAllTime: number;
  totalAnnualDividendsEst: number;
  weightedDy: number;
  weightedAppreciation: number;
  consolidatedData: ConsolidatedPortfolio;
  pieData: { name: string; value: number }[];
}

/**
 * Pure calculation function to compute all portfolio metrics.
 * 100% deterministic and free of state effects.
 */
export function calculatePortfolioMetrics(
  transactions: UserTransaction[],
  quotes: Record<string, StockQuote>,
  targetPercents: Record<string, number>,
  watchlist: string[],
  bazinHurdleRate = 0.06
): PortfolioMetricsResult {
  // 1. Process transactions into active positions
  const { positions: calculatedPositionsMap, monthlyDividends } = processTransactions(transactions);

  const cashTickers = ["CAIXA", "DEPOSITO", "RETIRADA", "SALDO", "DINHEIRO"];
  const activeTickers = Object.keys(calculatedPositionsMap).filter(
    (t) => !cashTickers.includes(t) && (calculatedPositionsMap[t].quantity > 0 || calculatedPositionsMap[t].totalDividendsReceived > 0)
  );

  const allPortfolioTickers = Array.from(new Set([...activeTickers, ...watchlist])).filter(
    (t) => !cashTickers.includes(t)
  );

  // 2. Calculate Total Current Portfolio Value
  const totalCurrentPortfolioValue = activeTickers.reduce((sum, t) => {
    const pos = calculatedPositionsMap[t];
    if (pos.quantity <= 0) return sum;
    const q = quotes[t];
    const price = q && q.price > 0 ? q.price : pos.averagePrice;
    return sum + price * pos.quantity;
  }, 0);

  // 3. Build Summary Items for each active + watchlist ticker
  const summaryItems: PortfolioSummaryItem[] = allPortfolioTickers
    .map((ticker) => {
      const pos = calculatedPositionsMap[ticker] || {
        id: ticker,
        ticker,
        quantity: 0,
        averagePrice: 0,
        totalCost: 0,
        realizedPnl: 0,
        totalDividendsReceived: 0,
      };

      const q = quotes[ticker];
      const currentPrice = q && q.price > 0 ? q.price : pos.averagePrice;
      const dy = q ? q.dy : 0;
      const avgAppreciation = q ? q.avgAppreciation : 0;
      const updatedAt = q?.updatedAt || q?.fetchedAt;
      const fetchedAt = q?.fetchedAt;
      const dyUpdatedAt = q?.dyUpdatedAt;
      const dyIsPending = q?.dyIsPending;
      const isFallbackQuote = !!q?.isFallback;

      const isCrypto = q?.type === 'Cripto' || isCryptoTicker(ticker);

      const currentTotalValue = currentPrice * pos.quantity;
      const costBasis = pos.totalCost;
      const annualDividendIncome = isCrypto ? 0 : currentTotalValue * (dy / 100);

      const bazinCeiling = isCrypto ? 0 : calculateBazinCeiling(currentPrice, dy, bazinHurdleRate);
      const magicNumber = isCrypto ? 0 : calculateMagicNumber(dy);
      const safetyMarginPercent =
        !isCrypto && bazinCeiling > 0 && currentPrice > 0 ? ((bazinCeiling - currentPrice) / bazinCeiling) * 100 : 0;

      const grahamResult = isCrypto 
        ? { grahamPrice: 0, isApplicable: false, reason: 'Não aplicável a criptoativos' }
        : calculateGrahamPrice(currentPrice, q?.lpa, q?.vpa, ticker);

      const currentPercent =
        totalCurrentPortfolioValue > 0
          ? (currentTotalValue / totalCurrentPortfolioValue) * 100
          : 0;

      const targetPercent = targetPercents[ticker] || 0;

      const pnl = currentTotalValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      const isFavorite = watchlist.includes(ticker);

      return {
        id: ticker,
        ticker,
        quantity: pos.quantity,
        averagePrice: pos.averagePrice,
        currentPrice,
        currentTotalValue,
        dy,
        avgAppreciation,
        annualDividendIncome,
        costBasis,
        pnl,
        pnlPercent,
        realizedPnl: pos.realizedPnl,
        totalDividendsReceived: pos.totalDividendsReceived,
        bazinCeiling,
        safetyMarginPercent,
        grahamPrice: grahamResult.grahamPrice,
        grahamSafetyMargin: grahamResult.safetyMarginPercent,
        isGrahamApplicable: grahamResult.isApplicable,
        grahamReason: grahamResult.reason,
        lpa: q?.lpa,
        vpa: q?.vpa,
        magicNumber,
        currentPercent,
        targetPercent,
        isFavorite,
        updatedAt,
        fetchedAt,
        dyUpdatedAt,
        dyIsPending,
        isFallbackQuote,
        rebalanceAmount: 0,
        rebalanceQuantity: 0,
        rebalanceAction: 'MANTER' as const,
      };
    })
    .filter((item) => item.quantity > 0 || item.totalDividendsReceived > 0 || item.isFavorite);

  // 4. Calculate Aggregate Metrics
  const totalCostBasis = summaryItems.reduce((acc, item) => acc + item.costBasis, 0);
  const totalUnrealizedPnl = summaryItems.reduce((acc, item) => acc + item.pnl, 0);
  const totalRealizedPnl = Object.values(calculatedPositionsMap).reduce(
    (acc, item) => acc + item.realizedPnl,
    0
  );
  const totalDividendsAllTime = Object.values(calculatedPositionsMap).reduce(
    (acc, item) => acc + item.totalDividendsReceived,
    0
  );
  const totalAnnualDividendsEst = summaryItems.reduce(
    (acc, item) => acc + item.annualDividendIncome,
    0
  );

  const weightedDy =
    totalCurrentPortfolioValue > 0
      ? summaryItems.reduce(
          (acc, item) => acc + item.dy * (item.currentTotalValue / totalCurrentPortfolioValue),
          0
        )
      : 0;

  const weightedAppreciation =
    totalCurrentPortfolioValue > 0
      ? summaryItems.reduce(
          (acc, item) =>
            acc + item.avgAppreciation * (item.currentTotalValue / totalCurrentPortfolioValue),
          0
        )
      : 10.0;

  // 5. Structure Consolidated Portfolio
  const consolidatedData: ConsolidatedPortfolio = {
    items: summaryItems,
    totalCurrentValue: totalCurrentPortfolioValue,
    totalCostBasis,
    totalUnrealizedPnl,
    totalRealizedPnl,
    totalDividendsReceived: totalDividendsAllTime,
    weightedDy: Number(weightedDy.toFixed(2)),
    weightedAppreciation: Number(weightedAppreciation.toFixed(2)),
    monthlyDividendIncomeEst: totalAnnualDividendsEst / 12,
  };

  // 6. Format Pie Data for Recharts Donut Chart (filtering zero balances to avoid distorted slices)
  const pieData = summaryItems
    .filter((item) => item.currentTotalValue > 0)
    .sort((a, b) => b.currentTotalValue - a.currentTotalValue)
    .map((item) => ({
      name: item.ticker,
      value: item.currentTotalValue,
    }));

  return {
    calculatedPositionsMap,
    monthlyDividends,
    activeTickers,
    allPortfolioTickers,
    totalCurrentPortfolioValue,
    summaryItems,
    totalCostBasis,
    totalUnrealizedPnl,
    totalRealizedPnl,
    totalDividendsAllTime,
    totalAnnualDividendsEst,
    weightedDy,
    weightedAppreciation,
    consolidatedData,
    pieData,
  };
}
