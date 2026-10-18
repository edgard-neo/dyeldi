import React from 'react';
import {
  X,
  TrendingUp,
  Sparkles,
  Calculator,
  User as UserIcon,
  Settings,
  MessageCircle,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Zap,
  PiggyBank,
  Smartphone,
  Heart,
} from 'lucide-react';
import { NavigationTab } from '../../types';
import { User } from 'firebase/auth';
import { InvestorProfileType } from '../../hooks/useUserProfile';
import { getProfileTheme } from '../../utils/profileTheme';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  user: User | null;
  isDemoMode?: boolean;
  investorProfile?: InvestorProfileType;
  onLogout?: () => void;
  onOpenSupport?: () => void;
}

export const MobileMoreDrawer: React.FC<MobileMoreDrawerProps> = ({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  user,
  isDemoMode = false,
  investorProfile = 'ALL',
  onLogout,
  onOpenSupport,
}) => {
  const { isStandalone, triggerInstall } = usePWAInstall();

  if (!isOpen) return null;

  const handleSelect = (tab: NavigationTab) => {
    onSelectTab(tab);
    onClose();
  };

  const displayName =
    user?.displayName || user?.email?.split('@')[0] || (isDemoMode ? 'Investidor Convidado' : 'Investidor');

  return (
    <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative z-10 bg-white dark:bg-[#0f0f11] rounded-t-3xl border-t border-black/[0.08] dark:border-white/[0.1] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250">
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-[#18181b] flex items-center justify-center text-zinc-900 dark:text-white font-bold text-sm overflow-hidden shrink-0 transition-all ${getProfileTheme(investorProfile).avatarWrapperClass}`}>
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
                className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${getProfileTheme(investorProfile).dotBg} border-2 border-white dark:border-[#0f0f11] flex items-center justify-center text-[8px]`}
                title={`Perfil: ${getProfileTheme(investorProfile).badgeText}`}
              >
                {getProfileTheme(investorProfile).iconEmoji}
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {displayName}
                </span>
                {isDemoMode && (
                  <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded font-mono border border-amber-500/20">
                    DEMO
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {user?.email || 'Navegação e Ferramentas'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Grupo: Análise */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 px-1 font-mono">
              Análise
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleSelect('dividends')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition cursor-pointer ${
                  currentTab === 'dividends'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-[#141416] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold">Dividendos</div>
                    <div className="text-[10px] opacity-70">
                      Histórico e projeção de proventos recebidos
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>

              <button
                type="button"
                onClick={() => handleSelect('diagnosis')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition cursor-pointer ${
                  currentTab === 'diagnosis'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-[#141416] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      Diagnóstico de Carteira
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded font-mono font-bold">
                        IA
                      </span>
                    </div>
                    <div className="text-[10px] opacity-70">
                      Score de diversificação e risco
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>

              <button
                type="button"
                onClick={() => handleSelect('simulator')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition cursor-pointer ${
                  currentTab === 'simulator'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-[#141416] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold">Simulador B3 & Crypto</div>
                    <div className="text-[10px] opacity-70">
                      Projeções de juros compostos e metas rápidas
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>
            </div>
          </div>

          {/* Account & Settings */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 px-1">
              Conta & Preferências
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleSelect('profile')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition cursor-pointer ${
                  currentTab === 'profile'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-[#141416] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold">Meu Perfil</div>
                    <div className="text-[10px] opacity-70">
                      Dados da conta e plano
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>

              <button
                type="button"
                onClick={() => handleSelect('settings')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition cursor-pointer ${
                  currentTab === 'settings'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-[#141416] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold">Configurações</div>
                    <div className="text-[10px] opacity-70">
                      Aparência, alertas e backup
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>
            </div>
          </div>

          {/* Quick External Actions */}
          <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col gap-2">
            {onOpenSupport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSupport();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/15 dark:bg-pink-500/[0.12] dark:hover:bg-pink-500/[0.2] text-pink-600 dark:text-pink-400 border border-pink-500/20 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                title="Apoie o Projeto Dyeldi"
              >
                <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
                <span>Apoie o Projeto</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              {!isStandalone && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    triggerInstall();
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.08] font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  title="Instalar Aplicativo Dyeldi"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Instalar App</span>
                </button>
              )}

              {(() => {
                const whatsappNumber = (import.meta.env.VITE_SUPPORT_WHATSAPP || '').trim();
                if (!whatsappNumber) return null;
                const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Estou usando o Dyeldi.')}`;

                return (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileMoreDrawer;
