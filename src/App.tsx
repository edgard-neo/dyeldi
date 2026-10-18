import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { User, auth, onAuthStateChanged, signOut, getRedirectResult } from './lib/firebase';
import { usePortfolioData } from './hooks/usePortfolioData';
import { useStockQuotes } from './hooks/useStockQuotes';
import { useUserProfile } from './hooks/useUserProfile';
import { getProfileTheme } from './utils/profileTheme';
import { calculatePortfolioMetrics } from './utils/portfolioMetrics';
import { processTransactions, calculateProjection } from './utils/calculator';
import { formatTimeAgo, isQuoteOutdated, getOutdatedReason } from './utils/timeAgo';
import { getUserSimulationInputs, saveUserSimulationInputs } from './lib/simulationStore';
import {
  NavigationTab,
  VALID_TABS,
  UserTransaction,
  TransactionType,
  ConsolidatedPortfolio,
  InvestmentInputs,
  StockQuote,
  MacroIndicators,
  YearData,
} from './types';

// Error Boundary & Fallbacks
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ViewLoadingFallback } from './components/common/ViewLoadingFallback';

// Navigation Components
import { Sidebar } from './components/navigation/Sidebar';
import { MobileBottomNav } from './components/navigation/MobileBottomNav';
import { MobileMoreDrawer } from './components/navigation/MobileMoreDrawer';
import { RiseLogo } from './components/RiseLogo';
import ThemeToggle from './components/ThemeToggle';
import { PWAInstallBanner } from './components/pwa/PWAInstallBanner';

// Modals
import TransactionModal from './components/TransactionModal';
import NotificationModal from './components/NotificationModal';
import AuthModal from './components/AuthModal';
import { SupportProjectModal } from './components/common/SupportProjectModal';

// Dedicated Views (Lazy Loaded for Bundle Optimization)
const OverviewView = lazy(() => import('./components/views/OverviewView'));
const PositionsView = lazy(() => import('./components/views/PositionsView'));
const RebalanceView = lazy(() => import('./components/views/RebalanceView'));
const DividendsView = lazy(() => import('./components/views/DividendsView'));
const TransactionsView = lazy(() => import('./components/views/TransactionsView'));
const DiagnosisView = lazy(() => import('./components/views/DiagnosisView'));
const SimulatorView = lazy(() => import('./components/views/SimulatorView'));
const ProfileView = lazy(() => import('./components/views/ProfileView'));
const SettingsView = lazy(() => import('./components/views/SettingsView'));

// Icons
import {
  Plus,
  Bell,
  LogIn,
  Lock,
  X,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const TAB_SEO_METADATA: Record<NavigationTab, { title: string; description: string }> = {
  overview: {
    title: 'Dyeldi — Visão Geral da Carteira & Investimentos B3',
    description: 'Acompanhe a evolução consolidada do seu patrimônio, cotações ao vivo da B3 e indicadores de proventos da sua carteira.',
  },
  positions: {
    title: 'Dyeldi — Carteira & Posições de Investimentos',
    description: 'Análise detalhada de posições de ações, FIIs e BDRs com cálculo de preço médio, preço teto e rentabilidade.',
  },
  rebalance: {
    title: 'Dyeldi — Rebalanceamento Inteligente de Carteira',
    description: 'Rebalanceie sua carteira de ações e FIIs automaticamente com base nas notas e metas de alocação configuradas.',
  },
  dividends: {
    title: 'Dyeldi — Acompanhamento de Proventos & Dividendos',
    description: 'Histórico e projeções de proventos e dividendos mensais recebidos das suas ações e FIIs na B3.',
  },
  transactions: {
    title: 'Dyeldi — Extrato & Histórico de Transações',
    description: 'Gerencie e consulte todas as operações de compra, venda e recebimento de proventos registradas na sua carteira.',
  },
  diagnosis: {
    title: 'Dyeldi — Diagnóstico da Carteira & Saúde Financeira',
    description: 'Avaliação de diversificação, riscos e concentração da sua carteira de investimentos na B3.',
  },
  simulator: {
    title: 'Dyeldi — Simulador de Investimentos & Projeções',
    description: 'Simule projeções de rendimento passivo, bola de neve de dividendos e independência financeira.',
  },
  profile: {
    title: 'Dyeldi — Perfil & Conta do Investidor',
    description: 'Gerencie seus dados de usuário, preferências de conta e assinatura na plataforma Dyeldi.',
  },
  settings: {
    title: 'Dyeldi — Configurações & Preferências',
    description: 'Ajuste parâmetros de visualização, notificações e sincronização da sua carteira na plataforma.',
  },
};

export default function App() {
  const { t } = useTranslation();

  // 1. Auth & User State
  const [user, setUser] = useState<User | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [authInitializing, setAuthInitializing] = useState<boolean>(true);

  // Derive the effective user (real user or demo guest user)
  const effectiveUser = useMemo<User | null>(() => {
    if (user) return user;
    if (isDemoMode) {
      return {
        uid: 'demo_user',
        displayName: 'Investidor Convidado (Degustação)',
        email: 'demo@example.com',
        isAnonymous: true,
        photoURL: null,
      } as unknown as User;
    }
    return null;
  }, [user, isDemoMode]);

  // Monitor Firebase Auth State & Redirect Result
  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.debug('[Firebase Redirect Result Status]:', err);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsDemoMode(false);
      }
      setAuthInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Navigation State with URL & History Sync
  const [currentTab, setCurrentTab] = useState<NavigationTab>(() => {
    if (typeof window !== 'undefined') {
      const cleanPath = window.location.pathname.replace(/^\/+|\/+$/g, '') as NavigationTab;
      if (cleanPath && VALID_TABS.includes(cleanPath)) return cleanPath;

      const urlParams = new URLSearchParams(window.location.search);
      const queryTab = urlParams.get('tab') as NavigationTab;
      const hashTab = window.location.hash.replace('#', '') as NavigationTab;
      if (queryTab && VALID_TABS.includes(queryTab)) return queryTab;
      if (hashTab && VALID_TABS.includes(hashTab)) return hashTab;
    }
    return 'overview';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState<boolean>(false);

  // Navigate tab and push history state
  const handleNavigateTab = useCallback((tab: NavigationTab) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      const newUrl = tab === 'overview' ? '/' : `/${tab}`;
      window.history.pushState({ tab }, '', newUrl);
      window.scrollTo(0, 0);
    }
  }, []);

  // Scroll to top automatically whenever active tab changes (e.g. mobile navigation)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [currentTab]);

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const cleanPath = window.location.pathname.replace(/^\/+|\/+$/g, '') as NavigationTab;
      if (cleanPath && VALID_TABS.includes(cleanPath)) {
        setCurrentTab(cleanPath);
        return;
      }
      const urlParams = new URLSearchParams(window.location.search);
      const queryTab = urlParams.get('tab') as NavigationTab;
      const hashTab = window.location.hash.replace('#', '') as NavigationTab;
      if (queryTab && VALID_TABS.includes(queryTab)) {
        setCurrentTab(queryTab);
      } else if (hashTab && VALID_TABS.includes(hashTab)) {
        setCurrentTab(hashTab);
      } else {
        setCurrentTab('overview');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Synchronize Page Title, Meta Description, OpenGraph, Twitter and Canonical Link per Route
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = TAB_SEO_METADATA[currentTab] || TAB_SEO_METADATA.overview;
    document.title = meta.title;

    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', meta.description);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', meta.description);

    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute('content', meta.title);

    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) twitterDesc.setAttribute('content', meta.description);

    const canonicalLink = document.getElementById('canonical-url');
    if (canonicalLink) {
      const canonicalUrl = currentTab === 'overview'
        ? 'https://dyeldi.site/'
        : `https://dyeldi.site/${currentTab}`;
      canonicalLink.setAttribute('href', canonicalUrl);
    }
  }, [currentTab]);

  // 3. User Profile Hook
  const {
    investorProfile,
    bazinHurdleRate,
    classAllocations,
    globalFeeType,
    globalFeeValue,
    preferredLayout,
    updateInvestorProfile,
    updateBazinHurdleRate,
    updateClassAllocations,
    updateGlobalFees,
    updatePreferredLayout,
  } = useUserProfile(user);

  // 4. Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<UserTransaction | Partial<UserTransaction> | null>(null);
  const [defaultTickerForModal, setDefaultTickerForModal] = useState('');
  const [defaultModalType, setDefaultModalType] = useState<TransactionType>('COMPRA');

  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  const [demoBlockedAction, setDemoBlockedAction] = useState<string | null>(null);

  // Auto-clear demo warning toast after 5s
  useEffect(() => {
    if (demoBlockedAction) {
      const timer = setTimeout(() => {
        setDemoBlockedAction(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [demoBlockedAction]);

  const handleOpenQuickAdd = useCallback(() => {
    setEditingTx(null);
    setDefaultTickerForModal('');
    setDefaultModalType('COMPRA');
    setIsModalOpen(true);
  }, []);

  const handleCloseTransactionModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTx(null);
    setDefaultTickerForModal('');
  }, []);

  const handleOpenDividendModal = useCallback(() => {
    setEditingTx(null);
    setDefaultTickerForModal('');
    setDefaultModalType('PROVENTO');
    setIsModalOpen(true);
  }, []);

  const handleOpenSpecificDividendModal = useCallback((ticker: string) => {
    setEditingTx(null);
    setDefaultTickerForModal(ticker);
    setDefaultModalType('PROVENTO');
    setIsModalOpen(true);
  }, []);

  const handleOpenNotifications = useCallback(() => {
    setIsNotificationModalOpen(true);
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setIsNotificationModalOpen(false);
  }, []);

  const handleOpenAuth = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

  const handleCloseAuth = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const handleExploreDemo = useCallback(() => {
    setIsDemoMode(true);
    setIsAuthModalOpen(false);
    setCurrentTab('overview');
  }, []);

  const handleExitDemo = useCallback(() => {
    setIsDemoMode(false);
  }, []);

  // 5. Portfolio Data Hook (Firestore / Demo)
  const {
    transactions,
    targetPercents,
    watchlist,
    brokerages,
    loadingData,
    isSeedingSample,
    handleSaveTransaction,
    handleDeleteTransaction,
    handleUpdateTargetPercent,
    handleUpdateBrokerage,
    handleToggleFavorite,
    handleSeedSamplePortfolio,
  } = usePortfolioData(effectiveUser, setDemoBlockedAction);

  // 6. Calculate Active Tickers for Quote Loading
  const { positions: calculatedPositionsMapPre } = processTransactions(transactions);
  const activeTickersPre = Object.keys(calculatedPositionsMapPre).filter(
    (t) => calculatedPositionsMapPre[t].quantity > 0 || calculatedPositionsMapPre[t].totalDividendsReceived > 0
  );
  const allPortfolioTickers = Array.from(new Set([...activeTickersPre, ...watchlist]));

  // 7. Stock Quotes Hook
  const {
    quotes,
    loadingQuotes,
    refreshingTickers,
    isRefreshingAllQuotes,
    handleRefreshSingleQuote,
    handleRefreshAllQuotes,
  } = useStockQuotes(allPortfolioTickers);

  // 7.5 Bazin Hurdle Rate handled via useUserProfile (Firestore + localStorage)

  // 8. Consolidated Metrics Calculation
  const {
    calculatedPositionsMap,
    monthlyDividends,
    activeTickers,
    summaryItems,
    totalCurrentPortfolioValue,
    totalCostBasis,
    totalUnrealizedPnl,
    totalRealizedPnl,
    totalDividendsAllTime,
    totalAnnualDividendsEst,
    weightedDy,
    weightedAppreciation,
    consolidatedData,
    pieData,
  } = calculatePortfolioMetrics(transactions, quotes, targetPercents, watchlist, bazinHurdleRate);

  // 9. Simulator / Juros Compostos State
  const [inputs, setInputs] = useState<InvestmentInputs>({
    ticker: 'PETR4',
    initialInvestment: 5000,
    monthlyContribution: 1000,
    expectedAppreciation: 10.0,
    dividendYield: 11.5,
    reinvestDividends: true,
    years: 10,
    ipcaAnnual: 4.2,
    cdiAnnual: 10.5,
    adjustContributionForInflation: false,
  });

  const [stockQuote, setStockQuote] = useState<StockQuote | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [results, setResults] = useState<YearData[]>([]);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isLoadedFromFirestore, setIsLoadedFromFirestore] = useState(false);

  // Fetch Macro Data on mount
  useEffect(() => {
    async function loadMacro() {
      try {
        const res = await axios.get<MacroIndicators>('/api/macro');
        if (res.data) {
          setInputs((prev) => ({
            ...prev,
            ipcaAnnual: res.data.ipcaAnnual || 4.2,
            cdiAnnual: res.data.cdiAnnual || 10.5,
          }));
        }
      } catch (e) {
        console.log('Using default macro indicators');
      }
    }
    loadMacro();
  }, []);

  // Fetch Stock Data for Simulator
  const fetchStock = useCallback(async (tickerToFetch: string) => {
    if (!tickerToFetch || tickerToFetch === 'CARTEIRA') return;
    setLoadingStock(true);
    setBannerMessage(null);
    try {
      const res = await axios.get<StockQuote>(`/api/stock/${tickerToFetch}`);
      if (res.data) {
        setStockQuote(res.data);
        setInputs((prev) => ({
          ...prev,
          ticker: res.data.ticker,
          dividendYield: res.data.dy || prev.dividendYield,
          expectedAppreciation: res.data.avgAppreciation || prev.expectedAppreciation,
        }));
        if (res.data.isFallback) {
          setBannerMessage(`Exibindo dados de referência de mercado para ${res.data.ticker}.`);
        }
      }
    } catch (e) {
      setBannerMessage(`Utilizando estimativas de mercado para ${tickerToFetch}.`);
    } finally {
      setLoadingStock(false);
    }
  }, []);

  // Load simulator inputs from Firestore for logged in user
  useEffect(() => {
    const currentUid = user?.uid;
    if (currentUid && currentUid !== 'demo_user' && currentUid !== 'guest_user') {
      getUserSimulationInputs(currentUid).then((savedInputs) => {
        if (savedInputs) {
          setInputs(savedInputs);
          if (savedInputs.ticker && savedInputs.ticker !== 'CARTEIRA') {
            fetchStock(savedInputs.ticker);
          }
        }
        setIsLoadedFromFirestore(true);
      });
    } else {
      setIsLoadedFromFirestore(false);
    }
  }, [user?.uid, fetchStock]);

  // Save simulator inputs
  useEffect(() => {
    const currentUid = user?.uid;
    if (currentUid && currentUid !== 'demo_user' && currentUid !== 'guest_user' && isLoadedFromFirestore) {
      const timer = setTimeout(() => {
        saveUserSimulationInputs(currentUid, inputs);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [user?.uid, inputs, isLoadedFromFirestore]);

  // Recalculate projection
  useEffect(() => {
    const projection = calculateProjection(inputs);
    setResults(projection);
  }, [inputs]);

  const handleCalculate = () => {
    const projection = calculateProjection(inputs);
    setResults(projection);
  };

  // Apply consolidated portfolio metrics to projection calculator
  const handleApplyPortfolioToProjection = (consolidated: ConsolidatedPortfolio) => {
    setInputs((prev) => ({
      ...prev,
      ticker: 'CARTEIRA',
      initialInvestment: Math.round(consolidated.totalCurrentValue),
      dividendYield: consolidated.weightedDy || prev.dividendYield,
      expectedAppreciation: consolidated.weightedAppreciation || prev.expectedAppreciation,
    }));
    setCurrentTab('simulator');
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      setUser(null);
      setIsDemoMode(false);
      setCurrentTab('overview');
      await signOut(auth);
    } catch (err) {
      console.warn('Informação ao sair da conta:', err);
    }
  };

  // Labels for Top Header
  const tabTitles: Record<NavigationTab, { title: string; subtitle: string }> = useMemo(() => ({
    overview: {
      title: t('titles.overview.title'),
      subtitle: t('titles.overview.subtitle'),
    },
    positions: {
      title: t('titles.positions.title'),
      subtitle: t('titles.positions.subtitle'),
    },
    rebalance: {
      title: t('titles.rebalance.title'),
      subtitle: t('titles.rebalance.subtitle'),
    },
    dividends: {
      title: t('titles.dividends.title'),
      subtitle: t('titles.dividends.subtitle'),
    },
    transactions: {
      title: t('titles.transactions.title'),
      subtitle: t('titles.transactions.subtitle'),
    },
    diagnosis: {
      title: t('titles.diagnosis.title'),
      subtitle: t('titles.diagnosis.subtitle'),
    },
    simulator: {
      title: t('titles.simulator.title'),
      subtitle: t('titles.simulator.subtitle'),
    },
    profile: {
      title: t('titles.profile.title'),
      subtitle: t('titles.profile.subtitle'),
    },
    settings: {
      title: t('titles.settings.title'),
      subtitle: t('titles.settings.subtitle'),
    },
  }), [t]);

  if (authInitializing) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] flex flex-col items-center justify-center p-4 transition-colors">
        <div className="flex flex-col items-center gap-3">
          <RiseLogo size="lg" variant="full" badge="none" />
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
            <span>{t('app.loading')}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!effectiveUser) {
    return (
      <AuthModal
        isModal={false}
        onExploreDemo={() => {
          setIsDemoMode(true);
          handleNavigateTab('overview');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans flex flex-row transition-colors duration-200 antialiased selection:bg-emerald-500/30 selection:text-emerald-400">
      {/* 1. Web / Desktop Sidebar (Collapsible & Fixed) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleNavigateTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        positionsCount={summaryItems.length}
        transactionsCount={transactions.length}
        onOpenSupport={() => setIsSupportModalOpen(true)}
      />

      {/* 2. Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 md:pb-8">
        {/* Top Navbar Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06] px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-colors">
          {/* Left: Mobile Brand & Section Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Logo */}
            <div
              className="md:hidden cursor-pointer shrink-0"
              onClick={() => handleNavigateTab('overview')}
            >
              <RiseLogo size="sm" variant="mark" />
            </div>

            {/* Desktop / Mobile Breadcrumb Title */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                  Dyeldi
                </span>
                <span className="hidden sm:inline text-xs text-zinc-300 dark:text-zinc-700">
                  /
                </span>
                <span className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white truncate">
                  {tabTitles[currentTab]?.title || 'Dyeldi'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions, Alerts, Theme & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Add Button */}
            <button
              type="button"
              onClick={handleOpenQuickAdd}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              title={t('header.launch_tooltip')}
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
              <span className="hidden xs:inline">{t('header.launch_button')}</span>
            </button>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={handleOpenNotifications}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer relative"
              title={t('header.notifications_tooltip')}
              aria-label={t('header.notifications_tooltip')}
            >
              <Bell className="w-4 h-4" />
            </button>

            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* User Pill / Login Button */}
            {user ? (
              <button
                type="button"
                onClick={() => handleNavigateTab('profile')}
                className="flex items-center gap-2 p-1 pl-2 bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.12] rounded-xl border border-black/[0.06] dark:border-white/[0.08] transition cursor-pointer"
                title={`${t('header.profile')} • Perfil: ${getProfileTheme(investorProfile).badgeText}`}
              >
                <span className="hidden md:inline text-xs font-medium text-zinc-800 dark:text-zinc-200 max-w-[120px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <div className={`w-7 h-7 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium text-[10px] flex items-center justify-center overflow-hidden shrink-0 transition-all ${getProfileTheme(investorProfile).avatarWrapperClass}`}>
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Avatar do investidor'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (user.displayName || user.email || 'U').charAt(0).toUpperCase()
                  )}
                </div>
              </button>
            ) : isDemoMode ? (
              <button
                type="button"
                onClick={handleOpenAuth}
                className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium rounded-xl border border-amber-500/20 transition cursor-pointer flex items-center gap-1.5"
                title={t('header.demo_tooltip')}
              >
                <span>{t('header.demo_badge')}</span>
                <LogIn className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAuth}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-medium rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('header.enter')}</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Main Body Content with ErrorBoundary & Suspense */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5">
          <ErrorBoundary
            fallbackTitle="Instabilidade na visualização"
            fallbackDescription="Não foi possível renderizar esta seção da carteira. Você pode tentar recarregar os dados com segurança."
          >
            <Suspense fallback={<ViewLoadingFallback title={tabTitles[currentTab]?.title} />}>
              {currentTab === 'overview' && (
                <OverviewView
                  user={effectiveUser}
                  summaryItems={summaryItems}
                  quotes={quotes}
                  consolidatedData={consolidatedData}
                  pieData={pieData}
                  COLORS={COLORS}
                  monthlyDividends={monthlyDividends}
                  totalCurrentPortfolioValue={totalCurrentPortfolioValue}
                  totalCostBasis={totalCostBasis}
                  totalUnrealizedPnl={totalUnrealizedPnl}
                  totalRealizedPnl={totalRealizedPnl}
                  totalDividendsAllTime={totalDividendsAllTime}
                  totalAnnualDividendsEst={totalAnnualDividendsEst}
                  weightedDy={weightedDy}
                  isRefreshingAllQuotes={isRefreshingAllQuotes}
                  onRefreshAllQuotes={handleRefreshAllQuotes}
                  onApplyPortfolioToProjection={handleApplyPortfolioToProjection}
                  onNavigate={handleNavigateTab}
                  setIsModalOpen={setIsModalOpen}
                  setEditingTx={setEditingTx}
                  setDefaultTickerForModal={setDefaultTickerForModal}
                  setDefaultModalType={setDefaultModalType}
                  onExitDemo={handleExitDemo}
                  onOpenAuthModal={handleOpenAuth}
                  onSeedSample={handleSeedSamplePortfolio}
                />
              )}

              {currentTab === 'positions' && (
                <PositionsView
                  summaryItems={summaryItems}
                  quotes={quotes}
                  loadingData={loadingData}
                  loadingQuotes={loadingQuotes}
                  isRefreshingAllQuotes={isRefreshingAllQuotes}
                  isSeedingSample={isSeedingSample}
                  refreshingTickers={refreshingTickers}
                  pieData={pieData}
                  COLORS={COLORS}
                  totalCurrentPortfolioValue={totalCurrentPortfolioValue}
                  investorProfile={investorProfile}
                  preferredLayout={preferredLayout}
                  onUpdatePreferredLayout={updatePreferredLayout}
                  handleRefreshAllQuotes={handleRefreshAllQuotes}
                  handleRefreshSingleQuote={handleRefreshSingleQuote}
                  handleSeedSamplePortfolio={handleSeedSamplePortfolio}
                  onToggleFavorite={handleToggleFavorite}
                  setDefaultTickerForModal={setDefaultTickerForModal}
                  setDefaultModalType={setDefaultModalType}
                  setEditingTx={setEditingTx}
                  setIsModalOpen={setIsModalOpen}
                  isQuoteOutdated={isQuoteOutdated}
                  getOutdatedReason={getOutdatedReason}
                  formatTimeAgo={formatTimeAgo}
                />
              )}

              {currentTab === 'rebalance' && (
                <RebalanceView
                  items={summaryItems}
                  quotes={quotes}
                  transactions={transactions}
                  investorProfile={investorProfile}
                  classAllocations={classAllocations}
                  onUpdateClassAllocations={updateClassAllocations}
                  preferredLayout={preferredLayout}
                  onUpdatePreferredLayout={updatePreferredLayout}
                  onUpdateTargetPercent={handleUpdateTargetPercent}
                  onOpenNotificationModal={handleOpenNotifications}
                  onToggleFavorite={handleToggleFavorite}
                  onRefreshQuote={handleRefreshSingleQuote}
                  refreshingTickers={refreshingTickers}
                  setDefaultTickerForModal={setDefaultTickerForModal}
                  setDefaultModalType={setDefaultModalType}
                  setEditingTx={setEditingTx}
                  setIsModalOpen={setIsModalOpen}
                />
              )}

              {currentTab === 'dividends' && (
                <DividendsView
                  monthlyDividends={monthlyDividends}
                  items={summaryItems}
                  transactions={transactions}
                  preferredLayout={preferredLayout}
                  onUpdatePreferredLayout={updatePreferredLayout}
                  onOpenDividendModal={handleOpenDividendModal}
                  onOpenSpecificDividendModal={handleOpenSpecificDividendModal}
                />
              )}

              {currentTab === 'transactions' && (
                <TransactionsView
                  transactions={transactions}
                  summaryItems={summaryItems}
                  quotes={quotes}
                  preferredLayout={preferredLayout}
                  onUpdatePreferredLayout={updatePreferredLayout}
                  setEditingTx={setEditingTx}
                  setDefaultTickerForModal={setDefaultTickerForModal}
                  setDefaultModalType={setDefaultModalType}
                  setIsModalOpen={setIsModalOpen}
                  handleDeleteTransaction={handleDeleteTransaction}
                />
              )}

              {currentTab === 'diagnosis' && (
                <DiagnosisView
                  userId={effectiveUser?.uid || 'guest'}
                  summaryItems={summaryItems}
                  totalCurrentPortfolioValue={totalCurrentPortfolioValue}
                  targetPercents={targetPercents}
                  investorProfile={investorProfile}
                />
              )}

              {currentTab === 'simulator' && (
                <SimulatorView
                  inputs={inputs}
                  setInputs={setInputs}
                  stockQuote={stockQuote}
                  loadingStock={loadingStock}
                  onFetchStock={fetchStock}
                  onCalculate={handleCalculate}
                  results={results}
                  bannerMessage={bannerMessage}
                  consolidatedData={consolidatedData}
                  onApplyPortfolioToProjection={handleApplyPortfolioToProjection}
                  investorProfile={investorProfile}
                  bazinHurdleRate={bazinHurdleRate}
                />
              )}

              {currentTab === 'profile' && (
                <ProfileView
                  user={effectiveUser}
                  isDemoMode={isDemoMode}
                  investorProfile={investorProfile}
                  onUpdateInvestorProfile={updateInvestorProfile}
                  positionsCount={summaryItems.length}
                  transactionsCount={transactions.length}
                  totalPortfolioValue={totalCurrentPortfolioValue}
                  onOpenAuthModal={handleOpenAuth}
                  onLogout={handleLogout}
                />
              )}

              {currentTab === 'settings' && (
                <SettingsView
                  transactions={transactions}
                  summaryItems={summaryItems}
                  onOpenNotificationModal={handleOpenNotifications}
                  onRefreshAllQuotes={handleRefreshAllQuotes}
                  isRefreshingAllQuotes={isRefreshingAllQuotes}
                  investorProfile={investorProfile}
                  onUpdateInvestorProfile={updateInvestorProfile}
                  bazinHurdleRate={bazinHurdleRate}
                  onUpdateBazinHurdleRate={updateBazinHurdleRate}
                  classAllocations={classAllocations}
                  onUpdateClassAllocations={updateClassAllocations}
                  globalFeeType={globalFeeType}
                  globalFeeValue={globalFeeValue}
                  onSaveGlobalFees={updateGlobalFees}
                  preferredLayout={preferredLayout}
                  onUpdatePreferredLayout={updatePreferredLayout}
                />
              )}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* 3. Mobile Bottom Navigation (4 items) */}
      <MobileBottomNav
        currentTab={currentTab}
        onSelectTab={handleNavigateTab}
        onOpenMoreDrawer={() => setIsMoreDrawerOpen(true)}
        isMoreOpen={isMoreDrawerOpen}
      />

      {/* 4. Mobile "Mais" Drawer */}
      <MobileMoreDrawer
        isOpen={isMoreDrawerOpen}
        onClose={() => setIsMoreDrawerOpen(false)}
        currentTab={currentTab}
        onSelectTab={handleNavigateTab}
        user={effectiveUser}
        isDemoMode={isDemoMode}
        investorProfile={investorProfile}
        onLogout={handleLogout}
        onOpenSupport={() => setIsSupportModalOpen(true)}
      />

      {/* Lazy Suspense Wrapper for Modals */}
      <Suspense fallback={null}>
        {/* 5. Transaction Modal (Add / Edit Buy, Sell, Dividend) */}
        {isModalOpen && (
          <TransactionModal
            isOpen={isModalOpen}
            onClose={handleCloseTransactionModal}
            onSave={handleSaveTransaction}
            editingTx={editingTx}
            defaultTicker={defaultTickerForModal}
            defaultType={defaultModalType}
            quotes={quotes}
            portfolioItems={summaryItems}
            transactions={transactions}
            investorProfile={investorProfile}
            dbGlobalFeeType={globalFeeType}
            dbGlobalFeeValue={globalFeeValue}
            onSaveGlobalFees={updateGlobalFees}
          />
        )}

        {/* 6. Notification Modal (Push & Email FCM Alerts) */}
        {isNotificationModalOpen && (
          <NotificationModal
            isOpen={isNotificationModalOpen}
            onClose={handleCloseNotifications}
            user={effectiveUser}
          />
        )}

        {/* 7. Auth Modal (Login / Register / Password Reset) */}
        {isAuthModalOpen && (
          <AuthModal
            isModal={true}
            isOpen={isAuthModalOpen}
            onClose={handleCloseAuth}
            onExploreDemo={handleExploreDemo}
          />
        )}

        {/* 8. Support Project Modal (Chave Pix & Voluntário) */}
        {isSupportModalOpen && (
          <SupportProjectModal
            isOpen={isSupportModalOpen}
            onClose={() => setIsSupportModalOpen(false)}
          />
        )}
      </Suspense>

      {/* Demo Action Blocked Toast */}
      {demoBlockedAction && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full bg-zinc-950 border border-amber-500/30 text-white rounded-2xl shadow-2xl p-4 flex flex-col gap-3 transition-all duration-300 transform scale-100 opacity-100 md:max-w-md">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-semibold text-zinc-100">{t('demo.title')}</h4>
              <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                Você tentou <span className="text-amber-400 font-medium">{demoBlockedAction}</span>. No modo demonstração, as alterações estão desativadas para que você possa apenas analisar como a carteira se comporta.
              </p>
            </div>
            <button
              onClick={() => setDemoBlockedAction(null)}
              className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer shrink-0"
              title={t('common.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => setDemoBlockedAction(null)}
              className="px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              {t('demo.not_now')}
            </button>
            <button
              onClick={() => {
                setDemoBlockedAction(null);
                setIsAuthModalOpen(true);
              }}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <span>{t('demo.create_account')}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Banner & Guia de Instalação PWA Cross-Browser */}
      <PWAInstallBanner />
    </div>
  );
}
