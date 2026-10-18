import React, { useState } from 'react';
import i18n from '../../i18n';
import {
  Settings,
  Moon,
  Sun,
  Bell,
  Download,
  Database,
  Sparkles,
  MessageCircle,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Target,
  UserCheck,
  Percent,
} from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import { UserTransaction, PortfolioSummaryItem } from '../../types';
import { InvestorProfileType, ClassAllocations } from '../../hooks/useUserProfile';

interface SettingsViewProps {
  transactions: UserTransaction[];
  summaryItems: PortfolioSummaryItem[];
  onOpenNotificationModal: () => void;
  onRefreshAllQuotes: () => Promise<void>;
  isRefreshingAllQuotes: boolean;
  investorProfile?: InvestorProfileType;
  onUpdateInvestorProfile?: (profile: InvestorProfileType) => void;
  bazinHurdleRate: number;
  onUpdateBazinHurdleRate: (rate: number) => void;
  classAllocations?: ClassAllocations;
  onUpdateClassAllocations?: (allocations: ClassAllocations) => void;
  globalFeeType?: 'fixed' | 'percent';
  globalFeeValue?: string;
  onSaveGlobalFees?: (feeType: 'fixed' | 'percent', feeValue: string) => void;
  preferredLayout?: 'CARDS' | 'TABLE';
  onUpdatePreferredLayout?: (layout: 'CARDS' | 'TABLE') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  transactions,
  summaryItems,
  onOpenNotificationModal,
  onRefreshAllQuotes,
  isRefreshingAllQuotes,
  investorProfile = 'ALL',
  onUpdateInvestorProfile,
  bazinHurdleRate,
  onUpdateBazinHurdleRate,
  classAllocations = { stocks: 50, fiis: 20, crypto: 30 },
  onUpdateClassAllocations,
  globalFeeType = 'fixed',
  globalFeeValue = '0.00',
  onSaveGlobalFees,
  preferredLayout = 'CARDS',
  onUpdatePreferredLayout,
}) => {
  const t = (key: string, fallback?: string): string => {
    const res = i18n.t(key, fallback || '');
    return (res && typeof res === 'string' ? res : fallback || key);
  };
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Local state for Class Allocations editing in settings
  const [localAllocations, setLocalAllocations] = useState<ClassAllocations>(classAllocations);

  React.useEffect(() => {
    setLocalAllocations(classAllocations);
  }, [classAllocations.stocks, classAllocations.fiis, classAllocations.crypto]);

  const handleUpdateAllocations = (newAlloc: ClassAllocations) => {
    setLocalAllocations(newAlloc);
    if (onUpdateClassAllocations) {
      onUpdateClassAllocations(newAlloc);
    }
  };

  // Exportar dados em JSON
  const handleExportJSON = () => {
    const dataToExport = {
      exportDate: new Date().toISOString(),
      appName: 'Dyeldi Portfolio Manager',
      transactions,
      positions: summaryItems.map((i) => ({
        ticker: i.ticker,
        quantity: i.quantity,
        averagePrice: i.averagePrice,
        targetPercent: i.targetPercent,
      })),
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dyeldi_carteira_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportSuccess(t('settings_view.success_json', 'Dados exportados com sucesso em formato JSON!'));
    setTimeout(() => setExportSuccess(null), 3000);
  };

  // Exportar transações em CSV
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      setExportSuccess(t('settings_view.error_no_transactions', 'Nenhuma transação cadastrada para exportar.'));
      setTimeout(() => setExportSuccess(null), 3000);
      return;
    }

    const headers = ['Data', 'Ticker', 'Tipo', 'Quantidade', 'Preço Unitário (R$)', 'Taxas (R$)', 'Total (R$)', 'Notas'];
    const rows = transactions.map((t) => [
      t.date,
      t.ticker,
      t.type,
      t.quantity,
      t.price.toFixed(2),
      t.fees.toFixed(2),
      t.total.toFixed(2),
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dyeldi_lancamentos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setExportSuccess(t('settings_view.success_csv', 'Transações exportadas com sucesso em formato CSV!'));
    setTimeout(() => setExportSuccess(null), 3000);
  };

  const totalAllocPercent = localAllocations.stocks + localAllocations.fiis + localAllocations.crypto;

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-[#18181b] text-zinc-900 dark:text-white flex items-center justify-center font-bold shrink-0 border border-black/[0.06] dark:border-white/[0.08]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white leading-none">
              {t('settings_view.title', 'Configurações e Preferências')}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {t('settings_view.subtitle', 'Gerencie seu perfil de investidor, regras de rebalanceamento, taxas do método Bazin e exportações.')}
            </p>
          </div>
        </div>
      </div>

      {exportSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{exportSuccess}</span>
        </div>
      )}

      {/* 1. Perfil de Investidor Dyeldi */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Perfil de Investidor Dyeldi
          </h3>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Selecione o seu foco de alocação para adaptar visões, diagnósticos e filtros na plataforma. Salvo automaticamente no banco de dados.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {[
            { id: 'ALL', label: 'Geral (Completo)', desc: 'Ações, FIIs e Criptos' },
            { id: 'STOCKS', label: 'Ações B3', desc: 'Foco em Dividendos B3' },
            { id: 'FIIS', label: 'Fundos Imobiliários', desc: 'Foco em Renda Mensal' },
            { id: 'CRYPTO', label: 'Criptoativos', desc: 'Foco em Criptomoedas' },
          ].map((item) => {
            const isSelected = investorProfile === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onUpdateInvestorProfile && onUpdateInvestorProfile(item.id as InvestorProfileType)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between space-y-1 ${
                  isSelected
                    ? 'bg-blue-600/10 border-blue-600 dark:bg-blue-500/20 dark:border-blue-500 text-blue-900 dark:text-blue-100 shadow-xs'
                    : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.06] border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold">{item.label}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                </div>
                <span className="text-[11px] opacity-75">{item.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Definição de Alocação por Classe de Ativos */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Definição de Alocação por Classe de Ativos
            </h3>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-400 font-medium">Presets:</span>
            {[
              { label: '50/20/30', val: { stocks: 50, fiis: 20, crypto: 30 } },
              { label: '70/30/0', val: { stocks: 70, fiis: 30, crypto: 0 } },
              { label: '100% Ações', val: { stocks: 100, fiis: 0, crypto: 0 } },
              { label: '100% FIIs', val: { stocks: 0, fiis: 100, crypto: 0 } },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleUpdateAllocations(preset.val)}
                className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Determine as porcentagens alvo para rebalancear sua carteira por classe de investimento. As metas persistem na sua conta.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Ações */}
          <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
              <span>Ações (%)</span>
              <span className="font-mono text-zinc-500">{localAllocations.stocks}%</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={localAllocations.stocks}
              onChange={(e) => {
                const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                handleUpdateAllocations({ ...localAllocations, stocks: val });
              }}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.10] rounded-lg text-sm font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* FIIs */}
          <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
              <span>FIIs (%)</span>
              <span className="font-mono text-zinc-500">{localAllocations.fiis}%</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={localAllocations.fiis}
              onChange={(e) => {
                const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                handleUpdateAllocations({ ...localAllocations, fiis: val });
              }}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.10] rounded-lg text-sm font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cripto */}
          <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
              <span>Cripto (%)</span>
              <span className="font-mono text-zinc-500">{localAllocations.crypto}%</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={localAllocations.crypto}
              onChange={(e) => {
                const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                handleUpdateAllocations({ ...localAllocations, crypto: val });
              }}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.10] rounded-lg text-sm font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 text-xs">
          <span className="text-zinc-500">Soma Total:</span>
          <span className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
            totalAllocPercent === 100
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
          }`}>
            {totalAllocPercent}%
          </span>
          {totalAllocPercent !== 100 && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              (A soma ideal deve totalizar 100%)
            </span>
          )}
        </div>
      </div>

      {/* 3. Taxa de Dividend Yield Mínimo (Décio Bazin) */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            {t('settings_view.bazin_rate_title', 'Taxa de Dividend Yield Mínimo (Décio Bazin)')}
          </h3>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {t('settings_view.bazin_rate_desc', 'Ajuste a taxa de retorno mínima anual desejada para calcular o Preço Teto de Bazin. Taxas maiores reduzem o Preço Teto, tornando a margem de segurança mais conservadora.')}
        </p>

        <div className="flex flex-wrap items-center gap-2 max-w-md mt-2">
          {[0.06, 0.08, 0.10, 0.12].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => onUpdateBazinHurdleRate(rate)}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                Math.abs(bazinHurdleRate - rate) < 0.001
                  ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-zinc-950 shadow-xs'
                  : 'bg-zinc-50 hover:bg-zinc-100 border-black/[0.06] text-zinc-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.08] dark:text-zinc-300'
              }`}
            >
              {(rate * 100).toFixed(0)}% a.a.
            </button>
          ))}
        </div>
      </div>

      {/* 4. Taxas Padrão de Corretagem & Emolumentos */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Taxa Padrão de Corretagem e Emolumentos
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Defina o custo padrão aplicado automaticamente ao lançar compras/vendas de ativos.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 max-w-md">
          <div className="flex rounded-xl border border-black/[0.08] dark:border-white/[0.10] p-1 bg-zinc-50 dark:bg-zinc-950 shrink-0">
            <button
              type="button"
              onClick={() => onSaveGlobalFees && onSaveGlobalFees('fixed', globalFeeValue)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                globalFeeType === 'fixed'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Fixo (R$)
            </button>
            <button
              type="button"
              onClick={() => onSaveGlobalFees && onSaveGlobalFees('percent', globalFeeValue)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                globalFeeType === 'percent'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Porcentagem (%)
            </button>
          </div>

          <div className="relative flex-1 min-w-[120px]">
            <input
              type="number"
              step="0.01"
              min="0"
              value={globalFeeValue}
              onChange={(e) => onSaveGlobalFees && onSaveGlobalFees(globalFeeType, e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 5. Modo de Exibição Padrão (Cards / Tabela) */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Visualização Padrão das Tabelas e Cards
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Escolha se prefere visualizar ativos e lançamentos em formato de cards visuais ou tabela densa.
            </p>
          </div>

          <div className="flex rounded-xl border border-black/[0.08] dark:border-white/[0.10] p-1 bg-zinc-50 dark:bg-zinc-950 shrink-0">
            <button
              type="button"
              onClick={() => onUpdatePreferredLayout && onUpdatePreferredLayout('CARDS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                preferredLayout === 'CARDS'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => onUpdatePreferredLayout && onUpdatePreferredLayout('TABLE')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                preferredLayout === 'TABLE'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Tabela
            </button>
          </div>
        </div>
      </div>

      {/* 4. Aparência & Tema */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              {t('settings_view.theme_title', 'Tema da Interface')}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t('settings_view.theme_desc', 'Alterne entre os modos claro e escuro para melhor conforto visual.')}
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* 5. Notificações & Alertas */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {t('settings_view.notifications_title', 'Alertas de Preço Teto & Proventos')}
              </h3>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-bold px-1.5 py-0.2 rounded font-mono">
                {t('settings_view.notifications_badge', 'Notificações no Navegador')}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t('settings_view.notifications_desc', 'Receba avisos instantâneos quando um ativo atingir margem de segurança segundo a fórmula de Bazin ou pagar dividendos.')}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenNotificationModal}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs shrink-0"
          >
            <Bell className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>{t('settings_view.notifications_btn', 'Configurar Alertas')}</span>
          </button>
        </div>
      </div>

      {/* 6. Gestão de Dados & Backups */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            {t('settings_view.data_title', 'Baixar dados da carteira')}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t('settings_view.data_desc', 'Exporte o histórico de compras e posições em planilha para guardar ou abrir no Excel.')}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer border border-black/[0.06] dark:border-white/[0.08]"
          >
            <Download className="w-4 h-4 text-blue-500" />
            <span>{t('settings_view.csv_btn', 'Exportar planilha (CSV)')}</span>
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer border border-black/[0.06] dark:border-white/[0.08]"
          >
            <Database className="w-4 h-4 text-purple-500" />
            <span>{t('settings_view.json_btn', 'Exportar arquivo de segurança (JSON)')}</span>
          </button>

          <button
            type="button"
            onClick={onRefreshAllQuotes}
            disabled={isRefreshingAllQuotes}
            className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer border border-black/[0.06] dark:border-white/[0.08] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-500 ${isRefreshingAllQuotes ? 'animate-spin' : ''}`} />
            <span>{isRefreshingAllQuotes ? t('settings_view.refreshing_quotes', 'Atualizando...') : t('settings_view.refresh_quotes_btn', 'Recarregar Cotações B3')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
