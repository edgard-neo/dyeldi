import { useState, useEffect } from 'react';
import axios from 'axios';
import { StockQuote } from '../types';

async function fetchBatchQuotes(tickers: string[], refresh = false): Promise<Record<string, StockQuote>> {
  if (tickers.length === 0) return {};
  const chunkSize = 50;
  const result: Record<string, StockQuote> = {};
  const chunks: string[][] = [];

  for (let i = 0; i < tickers.length; i += chunkSize) {
    chunks.push(tickers.slice(i, i + chunkSize));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const tickersParam = encodeURIComponent(chunk.map((t) => t.trim().toUpperCase()).join(','));
      const refreshParam = refresh ? `&refresh=true&t=${Date.now()}` : '';
      const url = `/api/stocks/quotes?tickers=${tickersParam}${refreshParam}`;
      const res = await axios.get<Record<string, StockQuote>>(url, { timeout: 10000 });
      if (res.data) {
        Object.assign(result, res.data);
      }
    })
  );

  return result;
}

export function useStockQuotes(allPortfolioTickers: string[]) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loadingQuotes, setLoadingQuotes] = useState<boolean>(false);
  const [refreshingTickers, setRefreshingTickers] = useState<Record<string, boolean>>({});
  const [isRefreshingAllQuotes, setIsRefreshingAllQuotes] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Single Quote Refresh Handler
  const handleRefreshSingleQuote = async (ticker: string) => {
    const upper = ticker.toUpperCase().trim();
    if (!upper) return;

    setRefreshingTickers((prev) => ({ ...prev, [upper]: true }));
    setQuoteError(null);
    try {
      const res = await axios.get<StockQuote>(`/api/stock/${upper}?refresh=true&t=${Date.now()}`, {
        timeout: 6000,
      });
      if (res.data) {
        setQuotes((prev) => ({ ...prev, [upper]: res.data }));
      }
    } catch (err: any) {
      console.warn(`Não foi possível atualizar cotação ao vivo de ${upper}.`, err);
      setQuoteError(`Não foi possível atualizar cotação de ${upper}. Tente novamente.`);
    } finally {
      setRefreshingTickers((prev) => ({ ...prev, [upper]: false }));
    }
  };

  // All Quotes Refresh Handler
  const handleRefreshAllQuotes = async () => {
    if (allPortfolioTickers.length === 0) return;
    setIsRefreshingAllQuotes(true);
    setQuoteError(null);

    try {
      const batchResult = await fetchBatchQuotes(allPortfolioTickers, true);
      setQuotes((prev) => ({ ...prev, ...batchResult }));
    } catch (err) {
      console.warn(`Indisponibilidade temporária ao atualizar cotações.`);
      setQuoteError(`Não foi possível atualizar as cotações. Verifique sua conexão e tente novamente.`);
    } finally {
      setIsRefreshingAllQuotes(false);
    }
  };

  const tickersKey = allPortfolioTickers.slice().sort().join(',');

  // Fetch Stock Quotes for active + watchlist tickers
  useEffect(() => {
    if (allPortfolioTickers.length === 0) {
      setQuotes({});
      return;
    }

    async function fetchQuotes() {
      setLoadingQuotes(true);
      setQuoteError(null);

      try {
        const batchResult = await fetchBatchQuotes(allPortfolioTickers, false);
        setQuotes(batchResult);
      } catch (err) {
        console.warn(`Falha ao carregar cotações em lote.`);
        setQuoteError(`Não foi possível carregar as cotações de alguns ativos. Tente atualizar novamente.`);
      } finally {
        setLoadingQuotes(false);
      }
    }

    fetchQuotes();
  }, [tickersKey]);

  return {
    quotes,
    loadingQuotes,
    refreshingTickers,
    isRefreshingAllQuotes,
    quoteError,
    handleRefreshSingleQuote,
    handleRefreshAllQuotes,
  };
}
