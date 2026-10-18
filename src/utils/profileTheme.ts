import { InvestorProfileType } from '../hooks/useUserProfile';

export interface ProfileColorConfig {
  id: InvestorProfileType;
  label: string;
  badgeText: string;
  borderColor: string;
  ringColor: string;
  badgeBg: string;
  dotBg: string;
  textColor: string;
  avatarWrapperClass: string;
  iconEmoji: string;
}

export const PROFILE_COLOR_MAP: Record<InvestorProfileType, ProfileColorConfig> = {
  ALL: {
    id: 'ALL',
    label: 'Multiativos',
    badgeText: 'Pro / Multiativos',
    borderColor: 'border-emerald-500',
    ringColor: 'ring-2 ring-emerald-500/30 dark:ring-emerald-400/30',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dotBg: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    avatarWrapperClass: 'border-2 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs shadow-emerald-500/10',
    iconEmoji: '👑',
  },
  STOCKS: {
    id: 'STOCKS',
    label: 'Ações',
    badgeText: 'Focado em Ações',
    borderColor: 'border-indigo-500',
    ringColor: 'ring-2 ring-indigo-500/30 dark:ring-indigo-400/30',
    badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    dotBg: 'bg-indigo-500',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    avatarWrapperClass: 'border-2 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xs shadow-indigo-500/10',
    iconEmoji: '📈',
  },
  FIIS: {
    id: 'FIIS',
    label: 'FIIs',
    badgeText: 'Focado em FIIs',
    borderColor: 'border-teal-500',
    ringColor: 'ring-2 ring-teal-500/30 dark:ring-teal-400/30',
    badgeBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    dotBg: 'bg-teal-500',
    textColor: 'text-teal-600 dark:text-teal-400',
    avatarWrapperClass: 'border-2 border-teal-500 ring-2 ring-teal-500/30 shadow-xs shadow-teal-500/10',
    iconEmoji: '🏢',
  },
  CRYPTO: {
    id: 'CRYPTO',
    label: 'Cripto',
    badgeText: 'Focado em Cripto',
    borderColor: 'border-amber-500',
    ringColor: 'ring-2 ring-amber-500/30 dark:ring-amber-400/30',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dotBg: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    avatarWrapperClass: 'border-2 border-amber-500 ring-2 ring-amber-500/30 shadow-xs shadow-amber-500/10',
    iconEmoji: '🪙',
  },
};

export function getProfileTheme(profileType: InvestorProfileType = 'ALL'): ProfileColorConfig {
  return PROFILE_COLOR_MAP[profileType] || PROFILE_COLOR_MAP.ALL;
}
