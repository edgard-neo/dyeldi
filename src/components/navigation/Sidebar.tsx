import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Landmark,
  Scale,
  PiggyBank,
  FileText,
  Sparkles,
  Calculator,
  User as UserIcon,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MessageCircle,
  ShieldCheck,
  Zap,
  Smartphone,
  Heart,
} from 'lucide-react';
import { NavigationTab } from '../../types';
import { RiseLogo } from '../RiseLogo';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  positionsCount?: number;
  transactionsCount?: number;
  onOpenSupport?: () => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  shortLabel?: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeType?: 'default' | 'accent';
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  positionsCount = 0,
  transactionsCount = 0,
  onOpenSupport,
}) => {
  const { t } = useTranslation();
  const { canInstall, isStandalone, triggerInstall } = usePWAInstall();

  // 1. Ordem de preferência - Seções Principais
  const primaryNavItems: NavItem[] = [
    {
      id: 'overview',
      label: t('nav.overview'),
      icon: LayoutDashboard,
    },
    {
      id: 'transactions',
      label: t('nav.transactions'),
      icon: FileText,
      badge: transactionsCount > 0 ? transactionsCount : undefined,
      badgeType: 'default',
    },
    {
      id: 'positions',
      label: t('nav.positions'),
      shortLabel: t('nav.positions'),
      icon: TrendingUp,
      badge: positionsCount > 0 ? positionsCount : undefined,
      badgeType: 'default',
    },
    {
      id: 'rebalance',
      label: t('nav.rebalance'),
      icon: Scale,
    },
  ];

  // 2. Novo Grupo: Análise
  const analysisNavItems: NavItem[] = [
    {
      id: 'dividends',
      label: t('nav.dividends'),
      icon: PiggyBank,
    },
    {
      id: 'diagnosis',
      label: t('nav.diagnosis'),
      icon: Sparkles,
      badge: 'IA',
      badgeType: 'accent',
    },
    {
      id: 'simulator',
      label: t('nav.simulator'),
      icon: Calculator,
    },
  ];

  const secondaryNavItems: NavItem[] = [
    {
      id: 'profile',
      label: t('nav.profile'),
      icon: UserIcon,
    },
    {
      id: 'settings',
      label: t('nav.settings'),
      icon: Settings,
    },
  ];

  const renderNavList = (items: NavItem[]) => (
    <div className="space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px]
              transition-all duration-150 cursor-pointer group relative
              ${
                isActive
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-xs font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.04] font-medium'
              }
            `}
            title={isCollapsed ? item.label : undefined}
          >
            <Icon
              className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                isActive
                  ? 'text-emerald-400 dark:text-emerald-600'
                  : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white'
              }`}
            />

            {!isCollapsed && (
              <span className="truncate flex-1 text-left tracking-tight">
                {item.label}
              </span>
            )}

            {!isCollapsed && item.badge && (
              <span
                className={`
                  text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0 tabular-nums
                  ${
                    item.badgeType === 'accent'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : isActive
                      ? 'bg-white/20 text-white dark:bg-black/20 dark:text-zinc-950'
                      : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 border border-black/[0.06] dark:border-white/[0.08]'
                  }
                `}
              >
                {item.badge}
              </span>
            )}

            {/* Tooltip collapsed */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-medium rounded-lg shadow-xl border border-white/10 pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {item.label}
                {item.badge && ` (${item.badge})`}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <aside
      className={`
        hidden md:flex flex-col flex-shrink-0
        bg-white dark:bg-[#09090b]
        border-r border-black/[0.06] dark:border-white/[0.06]
        transition-all duration-300 select-none z-30 sticky top-0 h-screen
        ${isCollapsed ? 'w-[72px]' : 'w-[240px]'}
      `}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div
          className="flex items-center gap-3 cursor-pointer overflow-hidden"
          onClick={() => onSelectTab('overview')}
          title="Dyeldi - Gestão de Ações & Crypto"
        >
          {isCollapsed ? (
            <div className="flex items-center justify-center w-full">
              <RiseLogo size="sm" variant="mark" />
            </div>
          ) : (
            <RiseLogo size="sm" variant="full" badge="none" />
          )}
        </div>

        {!isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
            title={t('nav.collapse_sidebar')}
            aria-label={t('nav.collapse_sidebar')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 no-scrollbar" aria-label="Navegação principal">
        {renderNavList(primaryNavItems)}

        {/* Seção Análise */}
        {!isCollapsed ? (
          <div className="pt-4 pb-1.5 px-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('nav.sections.analysis')}
            </span>
          </div>
        ) : (
          <div className="my-2 border-t border-black/[0.06] dark:border-white/[0.06]" />
        )}
        {renderNavList(analysisNavItems)}

        {/* Seção Conta */}
        {!isCollapsed ? (
          <div className="pt-4 pb-1.5 px-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('nav.sections.account')}
            </span>
          </div>
        ) : (
          <div className="my-2 border-t border-black/[0.06] dark:border-white/[0.06]" />
        )}
        {renderNavList(secondaryNavItems)}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2">
        {isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
            title={t('nav.expand_sidebar')}
            aria-label={t('nav.expand_sidebar')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {onOpenSupport && (
          <button
            type="button"
            onClick={onOpenSupport}
            className={`
              w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium
              text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300
              bg-pink-500/10 hover:bg-pink-500/15 dark:bg-pink-500/[0.12] dark:hover:bg-pink-500/[0.2]
              border border-pink-500/20
              transition cursor-pointer
              ${isCollapsed ? 'justify-center px-0' : ''}
            `}
            title="Apoie o Projeto Dyeldi"
            aria-label="Apoie o Projeto Dyeldi"
          >
            <Heart className="w-3.5 h-3.5 shrink-0 fill-pink-500 text-pink-500" />
            {!isCollapsed && <span className="truncate">Apoie o Projeto</span>}
          </button>
        )}

        {!isStandalone && (
          <button
            type="button"
            onClick={triggerInstall}
            className={`
              w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium
              text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400
              bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12]
              border border-black/[0.06] dark:border-white/[0.08]
              transition cursor-pointer
              ${isCollapsed ? 'justify-center px-0' : ''}
            `}
            title="Instalar Aplicativo Dyeldi"
            aria-label="Instalar Aplicativo Dyeldi"
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            {!isCollapsed && <span className="truncate">Instalar Aplicativo</span>}
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
              className={`
                w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium
                text-emerald-600 dark:text-emerald-400
                bg-emerald-500/10 hover:bg-emerald-500/20
                border border-emerald-500/20
                transition cursor-pointer
                ${isCollapsed ? 'justify-center px-0' : ''}
              `}
              title={t('nav.support_whatsapp')}
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span className="truncate">{t('nav.support_whatsapp')}</span>}
            </a>
          );
        })()}
      </div>
    </aside>
  );
};

export default Sidebar;
