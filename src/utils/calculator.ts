import { InvestmentInputs, YearData, UserTransaction, MonthlyDividendData } from '../types';

/**
 * Preço Teto pelo Método Décio Bazin (Retorno Mínimo de x% em Dividendos)
 * Preço Teto = Dividendos Anuais por Ação / hurdleRate
 */
export function calculateBazinCeiling(price: number, dy: number, hurdleRate = 0.06): number {
  if (!price || !dy || price <= 0 || dy <= 0) return 0;
  const annualDividendPerShare = price * (dy / 100);
  return annualDividendPerShare / hurdleRate;
}

/**
 * Resultado do Cálculo de Preço Justo de Graham
 */
export interface GrahamCalculationResult {
  grahamPrice: number;
  isApplicable: boolean;
  reason?: string;
  safetyMarginPercent?: number; // % que a cotação está abaixo ou acima do Preço Justo
  isBelowFairPrice?: boolean;   // true se Preço Atual <= Preço Justo (desconto / margem de segurança positiva)
}

/**
 * Preço Justo pelo Método Benjamin Graham
 * Fórmula: Preço Justo = √(22,5 × LPA × VPA)
 *
 * Regras e Limitações:
 * 1. Aplicável a ações (empresas), não aplicável a Fundos Imobiliários (FIIs).
 * 2. Exige LPA > 0 e VPA > 0. Se houver prejuízo ou patrimônio líquido negativo, não calcula.
 * 3. Para bancos e financeiras, indica que Graham não se aplica bem pela estrutura de alavancagem bancária.
 */
export function calculateGrahamPrice(
  price: number,
  lpa?: number,
  vpa?: number,
  ticker?: string
): GrahamCalculationResult {
  const t = (ticker || '').toUpperCase().trim();
  const stockUnits = ['TAEE11', 'SANB11', 'KLBN11', 'SAPR11', 'ALUP11', 'BIDI11'];
  const isFii = t.endsWith('11') && !stockUnits.includes(t);

  if (isFii) {
    return {
      grahamPrice: 0,
      isApplicable: false,
      reason: 'Graham não se aplica a Fundos Imobiliários (FIIs)',
      safetyMarginPercent: 0,
      isBelowFairPrice: false,
    };
  }

  const financialTickers = [
    'ITUB4', 'ITUB3', 'BBDC4', 'BBDC3', 'BBAS3', 'SANB11', 'BPAC11',
    'ITSA4', 'ITSA3', 'BBSE3', 'CXSE3', 'PSSA3', 'ABCB4', 'BRSR6',
  ];
  const isFinancial = financialTickers.includes(t);

  if (lpa === undefined || vpa === undefined || lpa === null || vpa === null || isNaN(lpa) || isNaN(vpa)) {
    return {
      grahamPrice: 0,
      isApplicable: false,
      reason: isFinancial
        ? 'Graham não se aplica bem a instituições financeiras'
        : 'Dados fundamentalistas (LPA / VPA) indisponíveis',
      safetyMarginPercent: 0,
      isBelowFairPrice: false,
    };
  }

  if (lpa <= 0 || vpa <= 0) {
    return {
      grahamPrice: 0,
      isApplicable: false,
      reason: isFinancial
        ? 'Graham não se aplica bem a instituições financeiras'
        : 'Empresa com prejuízo contábil ou patrimônio negativo (LPA ou VPA ≤ 0)',
      safetyMarginPercent: 0,
      isBelowFairPrice: false,
    };
  }

  const grahamPrice = Math.sqrt(22.5 * lpa * vpa);
  const safetyMarginPercent = grahamPrice > 0 ? ((grahamPrice - price) / grahamPrice) * 100 : 0;
  const isBelowFairPrice = price > 0 && price <= grahamPrice;

  return {
    grahamPrice: Number(grahamPrice.toFixed(2)),
    isApplicable: true,
    reason: isFinancial ? 'Instituição financeira (estrutura patrimonial bancária)' : undefined,
    safetyMarginPercent: Number(safetyMarginPercent.toFixed(1)),
    isBelowFairPrice,
  };
}

/**
 * Número Mágico: Quantidade de ações necessária para que o dividendo mensal compre 1 nova ação
 * Número Mágico = 12 / (DY decimal)
 */
export function calculateMagicNumber(dy: number): number {
  if (!dy || dy <= 0) return 0;
  return Math.ceil(1200 / dy);
}

export function calculateProjection(inputs: InvestmentInputs): YearData[] {
  const {
    initialInvestment,
    monthlyContribution,
    expectedAppreciation,
    dividendYield,
    reinvestDividends,
    years,
    ipcaAnnual,
    cdiAnnual,
    adjustContributionForInflation = false,
  } = inputs;

  const results: YearData[] = [];

  let currentStockValue = initialInvestment;
  let currentCdiValue = initialInvestment;
  let totalInvested = initialInvestment;
  let accumulatedDividends = 0;

  // Monthly rates using exact compound math
  const monthlyAppreciation = Math.pow(1 + Math.max(0, expectedAppreciation) / 100, 1 / 12) - 1;
  const monthlyDy = Math.max(0, dividendYield) / 100 / 12;
  const monthlyCdi = Math.pow(1 + Math.max(0, cdiAnnual) / 100, 1 / 12) - 1;
  const monthlyIpca = Math.pow(1 + Math.max(0, ipcaAnnual) / 100, 1 / 12) - 1;

  let currentMonthlyContribution = monthlyContribution;

  for (let year = 1; year <= years; year++) {
    let yearAppreciationGain = 0;
    let yearDividendGain = 0;

    // Adjust contribution for inflation each year if enabled
    if (adjustContributionForInflation && year > 1) {
      currentMonthlyContribution *= 1 + Math.max(0, ipcaAnnual) / 100;
    }

    for (let month = 1; month <= 12; month++) {
      // 1. Stock price appreciation
      const appreciationGain = currentStockValue * monthlyAppreciation;
      yearAppreciationGain += appreciationGain;
      currentStockValue += appreciationGain;

      // 2. Dividend payout
      const dividendGain = currentStockValue * monthlyDy;
      yearDividendGain += dividendGain;
      accumulatedDividends += dividendGain;

      if (reinvestDividends) {
        currentStockValue += dividendGain;
      }

      // 3. Monthly contribution (aporte)
      currentStockValue += currentMonthlyContribution;
      totalInvested += currentMonthlyContribution;

      // 4. CDI comparison balance
      currentCdiValue = currentCdiValue * (1 + monthlyCdi) + currentMonthlyContribution;
    }

    // Nominal value includes reinvested dividends or accumulated cash dividends
    const nominalValue = reinvestDividends ? currentStockValue : currentStockValue + accumulatedDividends;

    // Real value discounting inflation (IPCA)
    const inflationFactor = Math.pow(1 + monthlyIpca, year * 12);
    const realValue = nominalValue / inflationFactor;

    // CDI Net Value (discounting 15% Brazilian Income Tax on earnings for long term investments)
    const cdiEarnings = Math.max(0, currentCdiValue - totalInvested);
    const cdiNetValue = currentCdiValue - cdiEarnings * 0.15;

    results.push({
      year,
      nominalValue: Math.round(nominalValue),
      realValue: Math.round(realValue),
      cdiValue: Math.round(currentCdiValue),
      cdiNetValue: Math.round(cdiNetValue),
      totalInvested: Math.round(totalInvested),
      appreciationGain: Math.round(yearAppreciationGain),
      dividendGain: Math.round(yearDividendGain),
      accumulatedDividends: Math.round(accumulatedDividends),
      totalGain: Math.round(nominalValue - totalInvested),
      monthlyContributionThisYear: Math.round(currentMonthlyContribution),
    });
  }

  return results;
}

export interface CalculatedPosition {
  ticker: string;
  quantity: number;
  averagePrice: number;
  totalCost: number;
  realizedPnl: number;
  totalDividendsReceived: number;
}

/**
 * Calculates current positions, average prices, realized PnL and total dividends from transaction history
 * following Brazilian Receita Federal standards for stock portfolio tax tracking.
 */
export function processTransactions(transactions: UserTransaction[]): {
  positions: Record<string, CalculatedPosition>;
  monthlyDividends: MonthlyDividendData[];
} {
  const typePriority: Record<string, number> = { COMPRA: 1, PROVENTO: 2, VENDA: 3 };

  const sortedTx = [...transactions].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeA - timeB;

    // Desempate 1: timestamp de criação (createdAt), se disponível
    if (a.createdAt && b.createdAt) {
      const createdA = new Date(a.createdAt).getTime();
      const createdB = new Date(b.createdAt).getTime();
      if (createdA !== createdB) return createdA - createdB;
    }

    // Desempate 2: Ordem cronológica de mercado (COMPRA -> PROVENTO -> VENDA no mesmo dia)
    return (typePriority[a.type] || 99) - (typePriority[b.type] || 99);
  });

  const positions: Record<string, CalculatedPosition> = {};
  const dividendsByMonth: Record<string, number> = {};

  for (const tx of sortedTx) {
    const ticker = tx.ticker.toUpperCase().trim();
    if (!ticker) continue;
    if (["CAIXA", "DEPOSITO", "RETIRADA", "SALDO", "DINHEIRO"].includes(ticker)) continue;

    if (!positions[ticker]) {
      positions[ticker] = {
        ticker,
        quantity: 0,
        averagePrice: 0,
        totalCost: 0,
        realizedPnl: 0,
        totalDividendsReceived: 0,
      };
    }

    const pos = positions[ticker];
    const fees = tx.fees || 0;

    if (tx.type === 'COMPRA') {
      const txCost = tx.quantity * tx.price + fees;
      const newQty = pos.quantity + tx.quantity;
      const newTotalCost = pos.totalCost + txCost;
      pos.quantity = newQty;
      pos.averagePrice = newQty > 0 ? newTotalCost / newQty : 0;
      pos.totalCost = newTotalCost;
    } else if (tx.type === 'VENDA') {
      const soldQty = Math.min(pos.quantity, tx.quantity);
      if (soldQty > 0) {
        // Realized PnL = (Sale Price - Average Cost) * Sold Qty - Fees (IN RFB 1.585/2015)
        const saleProceeds = soldQty * tx.price - fees;
        const costBasisSold = soldQty * pos.averagePrice;
        pos.realizedPnl += saleProceeds - costBasisSold;

        pos.quantity -= soldQty;
        pos.totalCost = pos.quantity * pos.averagePrice;
        if (Math.abs(pos.quantity) <= 0.00000001) {
          pos.quantity = 0;
          pos.averagePrice = 0;
          pos.totalCost = 0;
        }
      }
    } else if (tx.type === 'PROVENTO') {
      const divAmount = typeof tx.total === 'number' && tx.total > 0 ? tx.total : tx.quantity * tx.price;
      pos.totalDividendsReceived += divAmount;

      const monthKey = tx.date ? tx.date.substring(0, 7) : new Date().toISOString().substring(0, 7);
      dividendsByMonth[monthKey] = (dividendsByMonth[monthKey] || 0) + divAmount;
    }
  }

  const monthlyDividends: MonthlyDividendData[] = Object.keys(dividendsByMonth)
    .sort()
    .map((monthYear) => ({
      monthYear,
      amount: dividendsByMonth[monthYear],
    }));

  return { positions, monthlyDividends };
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactBRL(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `R$ ${(value / 1_000_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Bi`;
  }
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Mi`;
  }
  if (abs >= 100_000) {
    return `R$ ${(value / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mil`;
  }
  return formatBRL(value);
}

export function formatBRLDecimal(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

/**
 * Formata a quantidade de cotas/unidades de forma legível e sem dízimas extensas.
 * Para ações e FIIs, arredonda para inteiros ou 2 casas decimais.
 * Para criptoativos, limita a no máximo 4 casas decimais.
 */
export function formatQuantity(qty: number, isCryptoAsset: boolean = false): string {
  if (qty === undefined || qty === null || isNaN(qty)) return '0';
  const val = Math.abs(qty) < 0.000001 ? 0 : qty;

  if (!isCryptoAsset) {
    if (Number.isInteger(val)) {
      return val.toLocaleString('pt-BR');
    }
    const rounded = Math.round(val * 100) / 100;
    return rounded.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  } else {
    if (Number.isInteger(val)) {
      return val.toLocaleString('pt-BR');
    }
    const maxDigits = Math.abs(val) < 0.01 ? 6 : 4;
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: maxDigits });
  }
}

