import { useState, useMemo, useCallback } from 'react';
import { YearData } from '../types';
import { formatBRL } from '../utils/calculator';
import {
  ChevronDown,
  ChevronUp,
  Table,
  Download,
  X,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

interface Props {
  data: YearData[];
}

export default function YearlyTable({ data }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [showOnlyMilestones, setShowOnlyMilestones] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvContentState, setCsvContentState] = useState('');
  const [copied, setCopied] = useState(false);

  const displayData = useMemo(() => {
    if (!data.length) return [];
    if (!showOnlyMilestones) return data;
    return data.filter(
      (r) => r.year % 5 === 0 || r.year === data.length || r.year === 1
    );
  }, [data, showOnlyMilestones]);

  const csvContent = useMemo(() => {
    if (!data.length) return '';

    const headers = [
      'Ano',
      'Aportes Acumulados',
      'Valorizacao no Ano',
      'Dividendos no Ano',
      'Renda Mensal Media',
      'Patrimonio Total',
      'Valor Real (IPCA)',
      'CDI Liquido (Pos-IR)',
    ];

    const rows = data.map((r) => [
      r.year,
      r.totalInvested,
      r.appreciationGain,
      r.dividendGain,
      Math.round(r.dividendGain / 12),
      r.nominalValue,
      r.realValue,
      r.cdiNetValue || r.cdiValue,
    ]);

    return [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
  }, [data]);

  const handleDownloadCSV = useCallback(() => {
    setCsvContentState(csvContent);
    setCopied(false);
    setShowCsvModal(true);

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'projecao_investimentos_ano_a_ano.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn(
        'Silent download fail inside iframe (using copy fallback).',
        e
      );
    }
  }, [csvContent]);

  const handleCopyClipboard = useCallback(() => {
    navigator.clipboard.writeText(csvContentState);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [csvContentState]);

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);
  const closeCsvModal = useCallback(() => setShowCsvModal(false), []);

  if (!data.length) return null;

  return (
    <div className="bg-white dark:bg-[#0f0f11] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 flex flex-row items-center justify-between gap-3 bg-white dark:bg-[#0f0f11] border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
            <Table className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white tracking-tight">
              Tabela Detalhada Ano a Ano
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block font-medium">
              Demonstrativo financeiro completo da evolução dos aportes e
              rendimentos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro de marcos */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <button
              type="button"
              onClick={() => setShowOnlyMilestones(false)}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                !showOnlyMilestones
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Todos ({data.length})
            </button>
            <button
              type="button"
              onClick={() => setShowOnlyMilestones(true)}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                showOnlyMilestones
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Marcos (5y)
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadCSV}
            className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            title="Exportar para Excel / CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={toggleOpen}
            className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
          >
            <span>{isOpen ? 'Recolher' : 'Expandir'}</span>
            {isOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="relative">
          {/* Indicador de scroll no mobile */}
          <div className="sm:hidden bg-zinc-50 dark:bg-zinc-950/50 border-b border-black/[0.06] dark:border-white/[0.06] px-4 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium text-center">
            ← Deslize a tabela para ver todas as colunas →
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="bg-zinc-50/90 dark:bg-zinc-950/90 text-zinc-700 dark:text-zinc-300 font-semibold uppercase tracking-wider text-xs border-b border-black/[0.06] dark:border-white/[0.06]">
                <tr>
                  <th className="py-3 px-3 sm:px-4">Prazo</th>
                  <th className="py-3 px-3 sm:px-4">Aportes Acum.</th>
                  <th className="py-3 px-3 sm:px-4">Valorização (no Ano)</th>
                  <th className="py-3 px-3 sm:px-4 text-emerald-600 dark:text-emerald-400">
                    Dividendos (no Ano)
                  </th>
                  <th className="py-3 px-3 sm:px-4 text-emerald-600 dark:text-emerald-400">
                    Renda Mensal Média
                  </th>
                  <th className="py-3 px-3 sm:px-4 text-indigo-600 dark:text-indigo-400">
                    Patrimônio Total
                  </th>
                  <th className="py-3 px-3 sm:px-4 text-zinc-600 dark:text-zinc-300">
                    Valor Real (IPCA)
                  </th>
                  <th className="py-3 px-3 sm:px-4 text-blue-600 dark:text-blue-400">
                    CDI Líquido (Pós-IR)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04] text-zinc-700 dark:text-zinc-300 font-mono tabular-nums">
                {displayData.map((row) => {
                  const isMilestone =
                    row.year % 5 === 0 || row.year === data.length;

                  return (
                    <tr
                      key={row.year}
                      className={`transition ${
                        isMilestone
                          ? 'bg-indigo-50/30 dark:bg-indigo-950/30 font-semibold'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                      }`}
                    >
                      <td className="py-2.5 px-3 sm:px-4 font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap font-sans">
                        <span>Ano {row.year}</span>
                        {isMilestone && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs rounded font-mono font-medium">
                            {row.year === data.length ? 'Final' : `${row.year}y`}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                        {formatBRL(row.totalInvested)}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        +{formatBRL(row.appreciationGain)}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                        +{formatBRL(row.dividendGain)}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                        {formatBRL(row.dividendGain / 12)}/mês
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {formatBRL(row.nominalValue)}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                        {formatBRL(row.realValue)}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {formatBRL(row.cdiNetValue || row.cdiValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de fallback CSV */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden shadow-xl flex flex-col max-h-[85vh]">
            {/* Header do modal */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 bg-indigo-50 rounded-lg border border-indigo-100 shrink-0">
                  <Download className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm">
                    Exportar Projeção (CSV)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Copia ou baixa os dados tabulados em formato CSV
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCsvModal}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl flex items-start gap-2.5">
                <ExternalLink className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <p className="font-bold mb-0.5">
                    Aviso de Segurança do Navegador:
                  </p>
                  Como o aplicativo está sendo executado em um painel do AI
                  Studio, o navegador pode bloquear o download automático por
                  segurança.
                  <p className="font-semibold mt-1">💡 Dica:</p>
                  Para baixar arquivos diretamente para sua máquina, clique no
                  ícone de{' '}
                  <strong className="text-amber-950">
                    "Abrir em nova aba" ↗
                  </strong>{' '}
                  no canto superior direito do seu navegador.
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700">
                    Conteúdo CSV Gerado:
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyClipboard}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1.5 border border-indigo-200/60 transition cursor-pointer shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar para Área de Transferência</span>
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  readOnly
                  value={csvContentState}
                  onClick={(e) =>
                    (e.target as HTMLTextAreaElement).select()
                  }
                  className="w-full min-h-[11rem] p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-hidden resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Tentar Download Novamente
              </button>
              <button
                type="button"
                onClick={closeCsvModal}
                className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer transition shadow-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}