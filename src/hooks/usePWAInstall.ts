import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Global state to ensure any button across the app can trigger the native PWA download prompt or guide
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const guideModalListeners = new Set<(show: boolean) => void>();
const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn(globalDeferredPrompt));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((fn) => fn(null));
    localStorage.setItem('dyeldi_pwa_dismissed', 'true');
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => globalDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isFirefox, setIsFirefox] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dyeldi_pwa_dismissed') === 'true' || localStorage.getItem('yieldix_pwa_dismissed') === 'true';
    }
    return false;
  });
  const [showGuideModal, setShowGuideModalState] = useState<boolean>(false);

  const setShowGuideModal = useCallback((show: boolean) => {
    guideModalListeners.forEach((fn) => fn(show));
  }, []);

  useEffect(() => {
    const handleGuideModal = (show: boolean) => {
      setShowGuideModalState(show);
    };
    guideModalListeners.add(handleGuideModal);

    const handlePromptChange = (prompt: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(prompt);
      if (!prompt) {
        setIsInstalled(true);
      }
    };
    promptListeners.add(handlePromptChange);

    return () => {
      guideModalListeners.delete(handleGuideModal);
      promptListeners.delete(handlePromptChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detectar se já está instalado ou rodando em modo standalone
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (navigator as any).standalone === true;
      const isTWA = document.referrer.includes('android-app://');
      const standalone = isStandaloneMedia || isIOSStandalone || isTWA;
      setIsStandalone(standalone);
      if (standalone) setIsInstalled(true);
    };

    checkStandalone();

    // Detectar iOS / Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // Detectar Firefox
    const isFx = ua.includes('firefox');
    setIsFirefox(isFx);
  }, []);

  const triggerInstall = useCallback(async () => {
    if (globalDeferredPrompt) {
      try {
        await globalDeferredPrompt.prompt();
        const { outcome } = await globalDeferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          globalDeferredPrompt = null;
          promptListeners.forEach((fn) => fn(null));
        }
      } catch (err) {
        console.warn('[PWA] Prompt install warning:', err);
      }
    } else {
      // Se não há prompt automático disponível (Safari/iOS, Firefox ou Desktop manual), abre modal de instruções
      setShowGuideModal(true);
    }
  }, [setShowGuideModal]);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem('dyeldi_pwa_dismissed', 'true');
  }, []);

  return {
    canInstall: !isStandalone && !isInstalled && (deferredPrompt !== null || globalDeferredPrompt !== null || isIOS || isFirefox),
    isStandalone,
    isInstalled,
    isIOS,
    isFirefox,
    isDismissed,
    hasNativePrompt: deferredPrompt !== null || globalDeferredPrompt !== null,
    showGuideModal,
    setShowGuideModal,
    triggerInstall,
    dismissBanner,
  };
}
