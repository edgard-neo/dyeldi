import React from 'react';
import i18n from '../../i18n';
import { User } from 'firebase/auth';
import {
  Sparkles,
  LogOut,
  LogIn,
  Layers,
  FileText,
  Wallet,
  Mail,
  CheckCircle2,
  Crown,
  Building2,
  TrendingUp,
  Coins,
  Compass,
} from 'lucide-react';
import { formatBRL } from '../../utils/calculator';
import { InvestorProfileType } from '../../hooks/useUserProfile';
import { getProfileTheme } from '../../utils/profileTheme';

interface ProfileViewProps {
  user: User | null;
  isDemoMode?: boolean;
  investorProfile?: InvestorProfileType;
  onUpdateInvestorProfile?: (newProfile: InvestorProfileType) => void;
  positionsCount: number;
  transactionsCount: number;
  totalPortfolioValue: number;
  onOpenAuthModal?: () => void;
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  isDemoMode = false,
  investorProfile = 'ALL',
  onUpdateInvestorProfile,
  positionsCount,
  transactionsCount,
  totalPortfolioValue,
  onOpenAuthModal,
  onLogout,
}) => {
  const t = (key: string, fallback?: string): string => {
    const res = i18n.t(key, fallback || '');
    return (res && typeof res === 'string' ? res : fallback || key);
  };
  const displayName =
    user?.displayName || user?.email?.split('@')[0] || (isDemoMode ? t('profile_view.guest_investor', 'Investidor Convidado') : t('profile_view.default_investor', 'Investidor'));
  const email = user?.email || (isDemoMode ? t('profile_view.guest_email', 'demo@example.com') : t('profile_view.unauthenticated', 'Não conectado'));

  const PROFILE_OPTIONS: {
    id: InvestorProfileType;
    title: string;
    subtitle: string;
    icon: React.ElementType;
    colorClass: string;
    badgeText: string;
  }[] = [
    {
      id: 'ALL',
      title: 'Pro / Multiativos (Todas)',
      subtitle: 'Carteira diversificada com Ações B3, FIIs e Criptoativos. Visão global completa.',
      icon: Crown,
      colorClass: 'emerald',
      badgeText: 'Padrão Recomendado',
    },
    {
      id: 'FIIS',
      title: 'Focado em FIIs',
      subtitle: 'Prioridade em fundos imobiliários, renda mensal previsível e proventos isentos de IR.',
      icon: Building2,
      colorClass: 'teal',
      badgeText: 'Foco em Renda Mensal',
    },
    {
      id: 'STOCKS',
      title: 'Focado em Ações',
      subtitle: 'Empresas perenes da B3, dividendos corporativos, JCP e crescimento patrimonial.',
      icon: TrendingUp,
      colorClass: 'indigo',
      badgeText: 'Foco em Proventos & Valor',
    },
    {
      id: 'CRYPTO',
      title: 'Focado em Cripto',
      subtitle: 'Ativos digitais, reserva de valor descorrelacionada e estratégia de valorização.',
      icon: Coins,
      colorClass: 'amber',
      badgeText: 'Foco em Ativos Digitais',
    },
  ];

  const activeProfileTheme = getProfileTheme(investorProfile);

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-3xl p-6 sm:p-8 border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          {/* Avatar with dynamic investor profile border */}
          <div className="relative">
            <div className={`w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-[#18181b] flex items-center justify-center text-zinc-900 dark:text-white font-extrabold text-2xl overflow-hidden shrink-0 transition-all duration-300 ${activeProfileTheme.avatarWrapperClass}`}>
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div
              className={`absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full ${activeProfileTheme.dotBg} text-white flex items-center justify-center shadow-md border-2 border-white dark:border-[#0f0f11] text-xs font-bold transition-transform duration-300 hover:scale-110`}
              title={`Perfil: ${activeProfileTheme.badgeText}`}
            >
              {activeProfileTheme.iconEmoji}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
                {displayName}
              </h1>
              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-500" />
                {t('profile_view.member_badge', 'Investidor Dyeldi')}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              {email}
            </p>

            <div className="mt-3 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {t('profile_view.connected', 'Conectado com segurança')}
              </span>
              {isDemoMode && (
                <span className="text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded-md border border-amber-500/20">
                  {t('profile_view.demo_mode', 'Modo Demonstração')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {isDemoMode && onOpenAuthModal ? (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('profile_view.save_google_btn', 'Salvar com Google')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-zinc-700 dark:text-zinc-300 hover:text-red-500 dark:hover:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border border-black/[0.06] dark:border-white/[0.08]"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('profile_view.logout_btn', 'Sair da conta')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Estatísticas da Conta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
            <Wallet className="w-4 h-4 text-emerald-500" />
            <span>{t('profile_view.total_assets', 'Patrimônio Total')}</span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-zinc-900 dark:text-white">
            {formatBRL(totalPortfolioValue)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>{t('profile_view.positions_count', 'Ativos na Carteira')}</span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-zinc-900 dark:text-white">
            {positionsCount} {t('profile_view.positions_unit', 'ativos')}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
            <FileText className="w-4 h-4 text-purple-500" />
            <span>{t('profile_view.transactions_count', 'Lançamentos Registrados')}</span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-zinc-900 dark:text-white">
            {transactionsCount} {t('profile_view.transactions_unit', 'lançamentos')}
          </div>
        </div>
      </div>

      {/* SELEÇÃO DO PERFIL DE INVESTIDOR */}
      <div className="bg-white dark:bg-[#0f0f11] rounded-3xl p-6 sm:p-8 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-emerald-500 shrink-0" />
              <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                Perfil de Investidor Dyeldi
              </h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Defina sua classe de preferência. Essa escolha pré-seleciona a aba em novos lançamentos e direciona os insights da IA.
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 self-start sm:self-auto shrink-0">
            Sincronizado automaticamente
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
          {PROFILE_OPTIONS.map((opt) => {
            const isSelected = investorProfile === opt.id;
            const IconComp = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdateInvestorProfile?.(opt.id)}
                className={`text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 relative group overflow-hidden ${
                  isSelected
                    ? 'bg-emerald-500/5 dark:bg-emerald-500/[0.08] border-emerald-500 dark:border-emerald-500/80 shadow-xs ring-1 ring-emerald-500/30'
                    : 'bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl transition-colors ${
                        isSelected
                          ? 'bg-emerald-500 text-zinc-950 font-bold'
                          : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white'
                      }`}
                    >
                      <IconComp className="w-5 h-5 shrink-0" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">
                        {opt.title}
                      </h4>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        {opt.badgeText}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="p-1 rounded-full bg-emerald-500 text-zinc-950 shrink-0">
                      <CheckCircle2 className="w-4 h-4 fill-emerald-500 text-zinc-950" />
                    </div>
                  )}
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {opt.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
