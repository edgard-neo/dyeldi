export function formatTimeAgo(isoDateString?: string): string {
  if (!isoDateString) return 'Sem data';

  const date = new Date(isoDateString);
  if (isNaN(date.getTime())) return 'Sem data';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) {
    return 'Atualizado agora';
  }
  if (diffMin < 60) {
    return `Atualizado há ${diffMin} min`;
  }
  if (diffHours < 24) {
    return `Atualizado há ${diffHours}h`;
  }
  if (diffDays === 1) {
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `Ontem às ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} às ${timeStr}`;
}

export function formatExactTime(isoDateString?: string): string {
  if (!isoDateString) return '--:--';
  const date = new Date(isoDateString);
  if (isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function isQuoteOutdated(isoDateString?: string, maxHours: number = 2): boolean {
  if (!isoDateString) return true;
  const date = new Date(isoDateString);
  if (isNaN(date.getTime())) return true;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours >= maxHours;
}

export function getOutdatedReason(isoDateString?: string, isFallback?: boolean): string {
  if (isFallback) {
    return 'Estimativa de mercado (serviço ao vivo temporariamente indisponível). Clique para tentar atualizar cotação.';
  }
  if (!isoDateString) return 'Cotação sem registro de data/hora recente.';

  const timeAgo = formatTimeAgo(isoDateString);
  return `Cotação ${timeAgo.toLowerCase()}. Durante o horário de pregão ou flutuações, clique para atualizar manualmente.`;
}
