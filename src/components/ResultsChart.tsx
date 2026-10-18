import { useState, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { YearData } from '../types';
import { formatBRL } from '../utils/calculator';
import { LineChart as LineIcon, Layers } from 'lucide-react';

interface Props {
  data: YearData[];
  ticker: string;
}

type ViewMode = 'lines' | 'area';

const formatYAxisTick = (val: number): string => {
  if (val >= 1_000_000_000) return `R$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `R$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `R$${(val / 1_000).toFixed(0)}k`;
  return `R$${val}`;
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-zinc-900/95 dark:bg-zinc-950/95 backdrop-blur-md text-white p-3 sm:p-4 rounded-xl shadow-xl border border-white/10 text-xs space-y-2 min-w-[200px]">
      <p className="font-bold text-zinc-200 border-b border-white/10 pb-1.5 flex justify-between">
        <span>{label}</span>
        <span className="text-indigo-400 font-mono">B3</span>
      </p>
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => (
          <div
            key={`item-${index}`}
            className="flex justify-between items-center gap-3"
          >
            <span className="flex items-center gap-1.5 text-zinc-300 truncate">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}:
            </span>
            <span className="font-bold text-white font-mono shrink-0">
              {formatBRL(entry.value as number)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResultsChart({ data, ticker }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('area');

  const setArea = useCallback(() => setViewMode('area'), []);
  const setLines = useCallback(() => setViewMode('lines'), []);

  // Cálculos memoizados
  const {
    totalNominal,
    totalInvested,
    totalDividends,
    totalAppreciation,
    pctInvested,
    pctDividends,
    pctAppreciation,
    chartData,
  } = useMemo(() => {
    if (!data.length) {
      return {
        totalNominal: 0,
        totalInvested: 0,
        totalDividends: 0,
        totalAppreciation: 0,
        pctInvested: '0',
        pctDividends: '0',
        pctAppreciation: '0',
        chartData: [],
      };
    }

    const finalYear = data[data.length - 1];
    const nominal = finalYear.nominalValue;
    const invested = finalYear.totalInvested;
    const dividends = finalYear.accumulatedDividends;
    const appreciation = Math.max(0, nominal - invested - dividends);

    const toPct = (value: number) =>
      nominal > 0 ? ((value / nominal) * 100).toFixed(1) : '0';

    const mapped = data.map((d) => ({
      yearLabel: `Ano ${d.year}`,
      nominal: d.nominalValue,
      real: d.realValue,
      cdi: d.cdiValue,
      cdiNet: d.cdiNetValue || d.cdiValue,
      invested: d.totalInvested,
      dividends: d.accumulatedDividends,
      appreciation: Math.max(
        0,
        d.nominalValue - d.totalInvested - d.accumulatedDividends
      ),
    }));

    return {
      totalNominal: nominal,
      totalInvested: invested,
      totalDividends: dividends,
      totalAppreciation: appreciation,
      pctInvested: toPct(invested),
      pctDividends: toPct(dividends),
      pctAppreciation: toPct(appreciation),
      chartData: mapped,
    };
  }, [data]);

  if (!data.length) return null;

  return (
    <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
      {/* Header + Toggle */}
      <div className="flex flex-row items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">
            Evolução Patrimonial ({ticker})
          </h3>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
            Projeção comparativa de saldo, CDI e poder de compra real
          </p>
        </div>

        <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={setArea}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === 'area'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Área</span>
          </button>
          <button
            type="button"
            onClick={setLines}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === 'lines'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <LineIcon className="w-3.5 h-3.5" />
            <span>Linhas</span>
          </button>
        </div>
      </div>

      {/* Composição final */}
      <div className="bg-zinc-50 dark:bg-zinc-950/40 p-3.5 rounded-xl border border-black/[0.04] dark:border-white/[0.04] space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <span>Composição no Ano {data.length}:</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">
            {formatBRL(totalNominal)}
          </span>
        </div>

        <div className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${pctInvested}%` }}
            className="bg-zinc-400 dark:bg-zinc-600 h-full"
            title={`Total Aportado: ${pctInvested}%`}
          />
          <div
            style={{ width: `${pctAppreciation}%` }}
            className="bg-indigo-600 dark:bg-indigo-500 h-full"
            title={`Valorização de Capital: ${pctAppreciation}%`}
          />
          <div
            style={{ width: `${pctDividends}%` }}
            className="bg-emerald-500 h-full"
            title={`Dividendos Reinvestidos: ${pctDividends}%`}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 font-medium pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" />
            <span>
              Aportes: <strong className="font-mono text-zinc-800 dark:text-zinc-200">{pctInvested}%</strong> ({formatBRL(totalInvested)})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-500 shrink-0" />
            <span>
              Valorização: <strong className="font-mono text-zinc-800 dark:text-zinc-200">{pctAppreciation}%</strong> ({formatBRL(totalAppreciation)})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>
              Dividendos: <strong className="font-mono text-zinc-800 dark:text-zinc-200">{pctDividends}%</strong> ({formatBRL(totalDividends)})
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="h-72 sm:h-80 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'area' ? (
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorNominal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCdi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(128,128,128,0.15)"
                vertical={false}
              />
              <XAxis
                dataKey="yearLabel"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxisTick}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ fontSize: '11px' }}
              />

              <Area
                type="monotone"
                dataKey="nominal"
                name={`Patrimônio (${ticker})`}
                stroke="#4f46e5"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorNominal)"
              />
              <Area
                type="monotone"
                dataKey="cdiNet"
                name="CDI Líquido (Pós-IR 15%)"
                stroke="#0284c7"
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={0.6}
                fill="url(#colorCdi)"
              />
              <Line
                type="monotone"
                dataKey="real"
                name="Valor Real (IPCA)"
                stroke="#059669"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="invested"
                name="Total Aportado"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                dot={false}
              />
            </AreaChart>
          ) : (
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(128,128,128,0.15)"
                vertical={false}
              />
              <XAxis
                dataKey="yearLabel"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxisTick}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ fontSize: '11px' }}
              />

              <Line
                type="monotone"
                dataKey="nominal"
                name={`Patrimônio (${ticker})`}
                stroke="#4f46e5"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#4f46e5' }}
              />
              <Line
                type="monotone"
                dataKey="cdiNet"
                name="CDI Líquido (Pós-IR 15%)"
                stroke="#0284c7"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="real"
                name="Valor Real (IPCA)"
                stroke="#059669"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="invested"
                name="Total Aportado"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}