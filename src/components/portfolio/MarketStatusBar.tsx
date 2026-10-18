import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock,
  RefreshCw,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { StockQuote } from '../../types';
import {
  getB3MarketStatus,
  getQuotesSyncSummary,
  MarketStatusInfo,
} from '../../utils/marketStatus';
import { formatTimeAgo } from '../../utils/timeAgo';

interface MarketStatusBarProps {
  quotes: Record<string, StockQuote>;
  activeTickers: string[];
  isRefreshingAllQuotes: boolean;
  onRefreshAllQuotes: () => Promise<void>;
  className?: string;
}

export default function MarketStatusBar({
  quotes,
  activeTickers,
  isRefreshingAllQuotes,
  onRefreshAllQuotes,
  className = '',
}: MarketStatusBarProps) {
  const [marketStatus, setMarketStatus] =
    useState<MarketStatusInfo>(getB3MarketStatus());
  const [showDetails, setShowDetails] = useState(false);

  // Atualiza o relógio da B3 a cada 30s
  useEffect(() => {
    const update = () => setMarketStatus(getB3MarketStatus());
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, []);

  const syncSummary = useMemo(
    () => getQuotesSyncSummary(quotes, activeTickers),
    [quotes, activeTickers]
  );

  const toggleDetails = useCallback(
    () => setShowDetails((prev) => !prev),
    []
  );

  return (
    <div
      className={`bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs overflow-hidden transition-all ${className}`}
    >
      {/* Barra principal */}
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Status + horário */}
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-xs border ${
              marketStatus.isOpen
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 border-black/[0.06] dark:border-white/[0.08]'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {marketStatus.isOpen && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  marketStatus.isOpen ? 'bg-emerald-500' : 'bg-zinc-400'
                }`}
              />
            </span>
            <span>{marketStatus.stateLabel}</span>
          </div>

          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              <strong className="text-zinc-800 dark:text-zinc-200 font-medium font-mono tabular-nums">
                {marketStatus.brasiliaTime}
              </strong>
            </span>
            <span>•</span>
            <span className="text-zinc-600 dark:text-zinc-400 hidden md:inline">
              {marketStatus.nextEventDescription}
            </span>
          </div>
        </div>

        {/* Sync + ações */}
        <div className="flex items-center gap-2.5 justify-between sm:justify-end flex-wrap">
          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium hidden sm:inline">
              Última atualização da B3:
            </span>
            <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] tabular-nums">
              {syncSummary.latestUpdateIso
                ? formatTimeAgo(syncSummary.latestUpdateIso)
                : 'Pendente'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onRefreshAllQuotes}
              disabled={isRefreshingAllQuotes}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-800 dark:text-zinc-200 border border-black/[0.06] dark:border-white/[0.08] font-medium rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Buscar cotações oficiais mais recentes na B3"
              aria-label="Buscar cotações oficiais mais recentes na B3"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${
                  isRefreshingAllQuotes ? 'animate-spin' : ''
                }`}
              />
              <span className="text-[11px]">
                {isRefreshingAllQuotes ? 'Sincronizando...' : 'Sincronizar'}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleDetails}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
              title={
                showDetails
                  ? 'Ocultar detalhes de atualização'
                  : 'Ver detalhes de atualização'
              }
              aria-label={
                showDetails
                  ? 'Ocultar detalhes de atualização'
                  : 'Ver detalhes de atualização'
              }
            >
              {showDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Drawer de detalhes */}
      {showDetails && (
        <div className="p-3.5 sm:p-4 bg-zinc-50 dark:bg-zinc-950/60 border-t border-black/[0.06] dark:border-white/[0.06] text-xs text-zinc-600 dark:text-zinc-400 space-y-2.5 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-[#0f0f11] p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                <span>Horário Oficial da B3</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                O pregão regular opera de{' '}
                <strong className="text-zinc-700 dark:text-zinc-200">
                  segunda a sexta-feira, das 10h00 às 18h00 (Horário de
                  Brasília)
                </strong>
                . Fora desse período, as cotações refletem o{' '}
                <strong className="text-zinc-700 dark:text-zinc-200">preço oficial de fechamento</strong> registrado no
                encerramento das negociações.
              </p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Cotações de Criptoativos</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                As cotações, preços e variações de 24h dos criptoativos (Bitcoin, Ethereum, etc.) são obtidos em tempo real diretamente da <strong className="text-zinc-700 dark:text-zinc-200">CoinGecko API</strong>.
              </p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Atualização & Dados</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {syncSummary.syncMessage}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}