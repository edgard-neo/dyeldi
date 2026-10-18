import { Request, Response, NextFunction } from 'express';
import { VALID_TABS } from '../types';

/**
 * ALLOWLIST DE ROTAS - PLATAFORMA DYELDI
 *
 * Qualquer requisição cujo path não esteja contemplado nesta allowlist
 * é rejeitada imediatamente com HTTP 404 sem processar autenticação,
 * middlewares de negócio ou renderização de páginas/componentes.
 */

// 1. Rotas válidas da SPA no cliente (ex: '/', '/overview', '/positions', etc.)
export const ALLOWED_SPA_ROUTES = new Set<string>([
  '/',
  ...VALID_TABS.map((tab) => `/${tab}`),
]);

// 2. Arquivos estáticos e metadados públicos autorizados
export const ALLOWED_STATIC_FILES = new Set<string>([
  '/favicon.svg',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-48x48.png',
  '/apple-touch-icon.png',
  '/og-image.png',
  '/og-image.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/site.webmanifest',
  '/sw.js',
]);

// 3. Rotas de API registradas (URLs exatas)
export const ALLOWED_EXACT_API_ROUTES = new Set<string>([
  '/api/health',
  '/api/cron/sync-dividends',
  '/api/admin/brapi-calls',
  '/api/admin/bolsai-calls',
  '/api/admin/users',
  '/api/notifications/dispatch',
  '/api/market/status',
  '/api/stocks/quotes',
  '/api/stocks/search',
  '/api/macro',
  '/api/ai/analyze-portfolio',
]);

// 4. Padrões de Rotas de API dinâmicas (ex: /api/stock/:ticker, /api/technical/:ticker)
export const ALLOWED_API_PATTERNS: RegExp[] = [
  /^\/api\/stock\/[A-Za-z0-9._%-]+$/,
  /^\/api\/stock\/[A-Za-z0-9._%-]+\/history$/,
  /^\/api\/technical\/[A-Za-z0-9._%-]+$/,
];

/**
 * Função utilitária para verificar se um caminho está na Allowlist.
 */
export function isAllowedPath(pathname: string): boolean {
  // Normaliza o path removendo barras finais (exceto a raiz '/')
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  // 1. Verifica rotas da SPA no cliente
  if (ALLOWED_SPA_ROUTES.has(normalizedPath)) {
    return true;
  }

  // 2. Verifica arquivos estáticos autorizados na raiz
  if (ALLOWED_STATIC_FILES.has(normalizedPath)) {
    return true;
  }

  // 3. Verifica diretórios de assets estáticos compilados ou do Vite
  if (
    normalizedPath.startsWith('/assets/') ||
    normalizedPath.startsWith('/@') ||
    normalizedPath.startsWith('/__') ||
    normalizedPath.startsWith('/.vite/') ||
    normalizedPath.startsWith('/src/') ||
    normalizedPath.startsWith('/node_modules/')
  ) {
    return true;
  }

  // 4. Verifica rotas de API exatas
  if (ALLOWED_EXACT_API_ROUTES.has(normalizedPath)) {
    return true;
  }

  // 5. Verifica rotas de API com parâmetros dinâmicos via Express / Regex
  for (const pattern of ALLOWED_API_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Middleware Express para aplicação da Allowlist.
 * Executa no início do ciclo de vida da requisição (early return).
 */
export function allowlistMiddleware(req: Request, res: Response, next: NextFunction) {
  // Em ambiente de desenvolvimento, o Vite dev server necessita de livre trânsito para
  // HMR, source maps, chunks sob demanda e módulos virtuais
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Extrai apenas o pathname (ignorando query strings como ?tab=overview)
  const pathname = req.path || req.url.split('?')[0];

  if (isAllowedPath(pathname)) {
    return next();
  }

  // Retorna 404 puro imediatamente para scanners e bots sem processar mais nada
  res.status(404).type('text/plain').send('404 Not Found');
}
