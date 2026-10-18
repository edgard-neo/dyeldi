import React from 'react';
import { InvestmentInputs, StockQuote, YearData, ConsolidatedPortfolio } from '../../types';
import InvestmentForm from '../InvestmentForm';
import SummaryCards from '../SummaryCards';
import ResultsChart from '../ResultsChart';
import YearlyTable from '../YearlyTable';
import { Calculator, Wallet } from 'lucide-react';
import { formatBRL } from '../../utils/calculator';
import { InvestorProfileType } from '../../hooks/useUserProfile';

interface SimulatorViewProps {
  inputs: InvestmentInputs;
  setInputs: React.Dispatch<React.SetStateAction<InvestmentInputs>>;
  stockQuote: StockQuote | null;
  loadingStock: boolean;
  onFetchStock: (ticker: string) => Promise<void>;
  onCalculate: () => void;
  results: YearData[];
  bannerMessage: string | null;
  consolidatedData?: ConsolidatedPortfolio;
  onApplyPortfolioToProjection?: (consolidated: ConsolidatedPortfolio) => void;
  investorProfile?: InvestorProfileType;
  bazinHurdleRate?: number;
}

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  inputs,
  setInputs,
  stockQuote,
  loadingStock,
  onFetchStock,
  onCalculate,
  results,
  bannerMessage,
  consolidatedData,
  onApplyPortfolioToProjection,
  investorProfile = 'ALL',
  bazinHurdleRate = 0.06,
}) => {
  const [activeTab, setActiveTab] = React.useState<'chart' | 'table'>('chart');

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
            <span>Simulador de Investimentos</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Simule a evolução do seu patrimônio e renda passiva por ação individual ou pela sua carteira inteira.
          </p>
        </div>

        {consolidatedData && consolidatedData.totalCurrentValue > 0 && onApplyPortfolioToProjection && (
          <button
            type="button"
            onClick={() => onApplyPortfolioToProjection(consolidatedData)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-xs transition flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
          >
            <Wallet className="w-4 h-4" />
            <div className="text-left">
              <span className="block font-semibold leading-tight">Simular Minha Carteira</span>
              <span className="block text-[10px] text-emerald-100 font-mono">
                {formatBRL(consolidatedData.totalCurrentValue)} • {consolidatedData.weightedDy.toFixed(1)}% DY
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Main Stack: Formulário em cima, Cards de Resumo e Gráficos embaixo em largura total */}
      <div className="space-y-5">
        <div>
          <InvestmentForm
            inputs={inputs}
            setInputs={setInputs}
            stockQuote={stockQuote}
            loadingStock={loadingStock}
            onSearchTicker={onFetchStock}
            onCalculate={onCalculate}
            consolidatedData={consolidatedData}
            onApplyPortfolioToProjection={onApplyPortfolioToProjection}
            investorProfile={investorProfile}
            bazinHurdleRate={bazinHurdleRate}
          />
        </div>

        {bannerMessage && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-600 dark:text-amber-400">
            {bannerMessage}
          </div>
        )}

        {/* Cards de Resumo da Projeção */}
        <SummaryCards results={results} ticker={inputs.ticker} />

        {/* Seletor de Exibição dos Resultados (Abas) */}
        <div className="flex items-center justify-between p-1 bg-zinc-100/80 dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'chart'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4 text-indigo-500" />
            <span>Análise Visual (Gráficos)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'table'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-500" />
            <span>Planilha Detalhada (Ano a Ano)</span>
          </button>
        </div>

        {/* Renderização Condicional da Aba Ativa */}
        <div className="transition-all duration-300">
          {activeTab === 'chart' ? (
            /* Gráfico Visual Comparativo */
            <ResultsChart data={results} ticker={inputs.ticker} />
          ) : (
            /* Tabela Ano a Ano */
            <YearlyTable data={results} />
          )}
        </div>
      </div>
    </div>
  );
};

export default SimulatorView;
