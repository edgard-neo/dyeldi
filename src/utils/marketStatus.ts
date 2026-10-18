export interface MarketStatusInfo {
  isOpen: boolean;
  state: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS' | 'WEEKEND';
  stateLabel: string;
  stateDescription: string;
  brasiliaTime: string;
  nextEventDescription: string;
}

/**
 * Retorna o status operacional do pregão da B3 em Horário de Brasília (UTC-3).
 * Horário padrão do pregão B3: Segunda a Sexta, das 10:00 às 18:00.
 */
export function getB3MarketStatus(referenceDate: Date = new Date()): MarketStatusInfo {
  // Ajusta para o Horário de Brasília (UTC-3)
  const utc = referenceDate.getTime() + referenceDate.getTimezoneOffset() * 60000;
  const spDate = new Date(utc - 3 * 3600000);

  const dayOfWeek = spDate.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const hours = spDate.getHours();
  const minutes = spDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const timeFormatted = spDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Fim de semana (Sábado ou Domingo)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      isOpen: false,
      state: 'WEEKEND',
      stateLabel: 'Mercado Fechado',
      stateDescription: 'Fim de semana na B3 • Preços oficiais de fechamento',
      brasiliaTime: `${timeFormatted} (Brasília)`,
      nextEventDescription: 'Reabre Segunda-feira às 10:00',
    };
  }

  // Dia útil antes das 10:00
  if (totalMinutes < 10 * 60) {
    return {
      isOpen: false,
      state: 'PRE_MARKET',
      stateLabel: 'Pré-Mercado',
      stateDescription: 'Fora do horário de negociação • Último fechamento mantido',
      brasiliaTime: `${timeFormatted} (Brasília)`,
      nextEventDescription: 'Abertura hoje às 10:00',
    };
  }

  // Dia útil entre 10:00 e 18:00 (Pregão Aberto)
  if (totalMinutes >= 10 * 60 && totalMinutes < 18 * 60) {
    return {
      isOpen: true,
      state: 'OPEN',
      stateLabel: 'Mercado Aberto',
      stateDescription: 'Pregão B3 em andamento • Cotações oscilando ao vivo',
      brasiliaTime: `${timeFormatted} (Brasília)`,
      nextEventDescription: 'Encerra hoje às 18:00',
    };
  }

  // Dia útil após as 18:00
  const isFriday = dayOfWeek === 5;
  return {
    isOpen: false,
    state: 'AFTER_HOURS',
    stateLabel: 'Mercado Fechado',
    stateDescription: 'Pregão encerrado • Preço oficial de fechamento consolidado',
    brasiliaTime: `${timeFormatted} (Brasília)`,
    nextEventDescription: isFriday ? 'Reabre Segunda-feira às 10:00' : 'Reabre amanhã às 10:00',
  };
}

export interface QuotesSyncSummary {
  latestUpdateIso: string | null;
  formattedLatestTime: string;
  hasFallback: boolean;
  totalQuotes: number;
  liveCount: number;
  syncFreshness: 'LIVE' | 'RECENT' | 'CLOSING_PRICE' | 'OUTDATED';
  syncMessage: string;
}

/**
 * Avalia o estado geral das cotações em carteira para exibir quando os dados
 * foram atualizados fora do cache de memória.
 */
export function getQuotesSyncSummary(
  quotes: Record<string, { updatedAt?: string; fetchedAt?: string; isFallback?: boolean; price?: number }>,
  tickers: string[]
): QuotesSyncSummary {
  const activeQuotes = tickers
    .map((t) => quotes[t.toUpperCase().trim()])
    .filter(Boolean);

  if (activeQuotes.length === 0) {
    return {
      latestUpdateIso: null,
      formattedLatestTime: 'Sem cotações registradas',
      hasFallback: false,
      totalQuotes: 0,
      liveCount: 0,
      syncFreshness: 'OUTDATED',
      syncMessage: 'Aguardando sincronização inicial de preços da B3.',
    };
  }

  let latestTimestamp = 0;
  let latestIso: string | null = null;
  let fallbackCount = 0;

  activeQuotes.forEach((q) => {
    if (q.isFallback) {
      fallbackCount++;
    }
    const candidate = q.updatedAt || q.fetchedAt;
    if (candidate) {
      const ms = new Date(candidate).getTime();
      if (!isNaN(ms) && ms > latestTimestamp) {
        latestTimestamp = ms;
        latestIso = candidate;
      }
    }
  });

  const now = Date.now();
  const diffMinutes = latestTimestamp > 0 ? (now - latestTimestamp) / 60000 : 9999;
  const market = getB3MarketStatus();

  let formattedTime = 'Sem registro recente';
  if (latestIso) {
    const d = new Date(latestIso);
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const isToday = d.toDateString() === new Date().toDateString();
    formattedTime = isToday ? `Hoje às ${timeStr}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${timeStr}`;
  }

  let syncFreshness: 'LIVE' | 'RECENT' | 'CLOSING_PRICE' | 'OUTDATED' = 'RECENT';
  let syncMessage = '';

  if (!market.isOpen) {
    syncFreshness = 'CLOSING_PRICE';
    syncMessage = `Preço oficial de fechamento gravado (${formattedTime}). Sem novas variações até a reabertura do pregão.`;
  } else if (diffMinutes <= 15) {
    syncFreshness = 'LIVE';
    syncMessage = `Cotações sincronizadas com a B3 (${formattedTime}). Dados atualizados.`;
  } else if (diffMinutes <= 60) {
    syncFreshness = 'RECENT';
    syncMessage = `Última sincronização externa às ${formattedTime}. Clique em Atualizar para verificar oscilações.`;
  } else {
    syncFreshness = 'OUTDATED';
    syncMessage = `Última consulta externa às ${formattedTime}. Recomendado atualizar para sincronizar com o pregão.`;
  }

  return {
    latestUpdateIso: latestIso,
    formattedLatestTime: formattedTime,
    hasFallback: fallbackCount > 0,
    totalQuotes: activeQuotes.length,
    liveCount: activeQuotes.length - fallbackCount,
    syncFreshness,
    syncMessage,
  };
}
