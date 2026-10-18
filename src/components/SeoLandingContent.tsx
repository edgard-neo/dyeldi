import React from 'react';

/**
 * SeoLandingContent Component
 * 
 * Isolated, pure static component for static pre-rendering (SSG).
 * No hooks, no API calls, no browser state or window/document dependencies.
 * Contains semantic HTML (h1, h2, p, ul) enriched with target keywords for search crawlers.
 */
export const SeoLandingContent: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans p-6 sm:p-12 max-w-5xl mx-auto space-y-8 antialiased">
      <header className="space-y-4 border-b border-zinc-800 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold">
          Plataforma de Gestão de Investimentos
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          Dyeldi — Gestão de Ações, FIIs &amp; Criptoativos
        </h1>
        <p className="text-base sm:text-lg text-zinc-300 max-w-3xl leading-relaxed">
          Gerencie sua carteira de Ações, FIIs e Criptomoedas com rebalanceamento inteligente, projeção de dividendos e cotações em tempo real.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-snug">
          Recursos Principais para Investidores da B3 e Mercado Cripto
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <article className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
            <h3 className="text-base font-bold text-emerald-400">
              Rebalanceamento Inteligente de Carteira
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Direcione seus aportes mensais com precisão matemática para os ativos em despesca ou abaixo da sua meta percentual, aplicando a estratégia Décio Bazin com limite de Preço Teto.
            </p>
          </article>

          <article className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
            <h3 className="text-base font-bold text-blue-400">
              Calculadora e Projeção de Dividendos
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Acompanhe sua curva de renda passiva com projeções de dividendos, JCP e proventos anunciados de Ações e Fundos Imobiliários da Bolsa de Valores (B3).
            </p>
          </article>

          <article className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
            <h3 className="text-base font-bold text-purple-400">
              Cotações em Tempo Real e Indicadores Fundamentalistas
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Monitore preços atualizados de Ações, FIIs, Bitcoin, Ethereum e Criptomoedas, além de indicadores fundamentais como P/VP, LPA, VPA e Dividend Yield (DY TTM).
            </p>
          </article>

          <article className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
            <h3 className="text-base font-bold text-amber-400">
              Diagnóstico e Inteligência Financeira
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Obtenha análises de diversificação setorial, nível de risco da carteira, margem de segurança e recomendações inteligentes de rebalanceamento.
            </p>
          </article>
        </div>
      </section>

      <section className="space-y-4 pt-4 border-t border-zinc-800/60">
        <h2 className="text-lg font-bold text-white">
          Metodologia e Estratégias Suportadas
        </h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-zinc-300 leading-relaxed">
          <li><strong>Método Bazin (Preço Teto)</strong>: Cálculo de preço teto com base no dividend yield histórico e taxa de desconto personalizada.</li>
          <li><strong>Gestão de Fundos Imobiliários (FIIs)</strong>: Acompanhamento de P/VP, rendimentos mensais por cota e alocação em FIIs de tijolo e papel.</li>
          <li><strong>Diversificação em Criptoativos</strong>: Integração das principais criptomoedas (BTC, ETH, SOL) junto à carteira tradicional B3.</li>
          <li><strong>Relatórios e Exportação de Dados</strong>: Exportação completa do histórico de operações e posições em arquivos CSV e JSON.</li>
        </ul>
      </section>
    </div>
  );
};

export default SeoLandingContent;
