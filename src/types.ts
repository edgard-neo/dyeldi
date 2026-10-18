export interface InvestmentInputs {
  ticker: string;
  initialInvestment: number;
  monthlyContribution: number;
  expectedAppreciation: number; // Anual (%)
  dividendYield: number;        // Anual (%)
  reinvestDividends: boolean;
  years: number;
  ipcaAnnual: number;           // Inflation rate % p.a.
  cdiAnnual: number;            // CDI rate % p.a.
  adjustContributionForInflation?: boolean; // Reajustar aportes anualmente pelo IPCA
}

export interface YearData {
  year: number;
  nominalValue: number;
  realValue: number;
  cdiValue: number;
  cdiNetValue?: number; // CDI Líquido após Imposto de Renda (15% para longo prazo)
  totalInvested: number;
  appreciationGain: number;
  dividendGain: number;
  accumulatedDividends: number;
  totalGain: number;
  monthlyContributionThisYear?: number;
}

export interface StockQuote {
  ticker: string;
  name: string;
  price: number;
  dy: number;
  avgAppreciation: number;
  pVP?: number;
  cnpj?: string;
  lpa?: number;
  vpa?: number;
  grahamPrice?: number;
  isGrahamApplicable?: boolean;
  grahamReason?: string;
  grahamSafetyMargin?: number;
  isFallback?: boolean;
  updatedAt?: string;
  fetchedAt?: string;
  dyUpdatedAt?: string;
  dyIsPending?: boolean;
  changePercent?: number;
  type?: 'Ação' | 'FII' | 'BDR' | 'Cripto';
}

export interface PortfolioMeta {
  ticker: string;
  brokerage: string;
  updatedAt?: string;
}

export interface MacroIndicators {
  ipcaAnnual: number;
  cdiAnnual: number;
  isFallback?: boolean;
}

export type TransactionType = 'COMPRA' | 'VENDA' | 'PROVENTO' | 'DEPOSITO' | 'RETIRADA';

export type NavigationTab =
  | 'overview'     // 1. Visão geral (Dashboard)
  | 'positions'    // 2. Posição e Valuation
  | 'rebalance'    // 3. Rebalancear
  | 'dividends'    // 4. Proventos
  | 'transactions' // 5. Lançamentos
  | 'diagnosis'    // 6. Diagnóstico
  | 'simulator'    // 7. Simulador
  | 'profile'      // 8. Perfil
  | 'settings';    // 9. Configurações

export const VALID_TABS: NavigationTab[] = [
  'overview',
  'positions',
  'rebalance',
  'dividends',
  'transactions',
  'diagnosis',
  'simulator',
  'profile',
  'settings',
];

export interface UserTransaction {
  id: string;
  ticker: string;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  quantity: number;
  price: number;
  fees: number;
  total: number;
  notes?: string;
  createdAt?: string;
}

export interface PortfolioPosition {
  id: string;
  ticker: string;
  quantity: number;
  averagePrice: number;
  targetPercent?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortfolioSummaryItem {
  id: string;
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentTotalValue: number;
  dy: number;
  avgAppreciation: number;
  annualDividendIncome: number;
  costBasis: number;
  pnl: number; // Lucro Não Realizado (R$)
  pnlPercent: number;
  realizedPnl: number; // Lucro Realizado em Vendas (R$)
  totalDividendsReceived: number; // Total de proventos recebidos
  bazinCeiling: number;
  safetyMarginPercent: number;
  grahamPrice?: number;
  grahamSafetyMargin?: number;
  isGrahamApplicable?: boolean;
  grahamReason?: string;
  lpa?: number;
  vpa?: number;
  magicNumber: number;
  currentPercent: number;
  targetPercent: number;
  isFavorite?: boolean;
  updatedAt?: string;
  fetchedAt?: string;
  dyUpdatedAt?: string;
  dyIsPending?: boolean;
  isFallbackQuote?: boolean;
  rebalanceAmount: number; // R$ a comprar
  rebalanceQuantity: number; // Qtd a comprar
  rebalanceAction: 'COMPRAR' | 'MANTER' | 'AGUARDAR';
}

export interface ConsolidatedPortfolio {
  items: PortfolioSummaryItem[];
  totalCurrentValue: number;
  totalCostBasis: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalDividendsReceived: number;
  weightedDy: number;
  weightedAppreciation: number;
  monthlyDividendIncomeEst: number;
}

export interface MonthlyDividendData {
  monthYear: string; // ex: "2026-03" or "Mar/26"
  amount: number;
}
