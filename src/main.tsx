import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nextProvider} from 'react-i18next';
import App from './App.tsx';
import './index.css';
import i18n from './i18n';

// Previne erros não capturados causados por inspecção cross-origin no ambiente iframe de AI Studio
if (typeof window !== 'undefined') {
  const isCrossOriginError = (err: any) => {
    const str = String((err && (err.message || err.reason || err.error)) || err || '');
    return (
      str.includes('$$typeof') ||
      str.includes('SecurityError') ||
      str.includes('Blocked a frame') ||
      str.includes('cross-origin')
    );
  };

  const prevOnError = window.onerror;
  window.onerror = (msg, url, line, col, error) => {
    if (isCrossOriginError(msg) || isCrossOriginError(error)) {
      return true;
    }
    if (typeof prevOnError === 'function') {
      return prevOnError(msg, url, line, col, error);
    }
  };

  window.addEventListener(
    'error',
    (event) => {
      if (
        isCrossOriginError(event.message) ||
        isCrossOriginError(event.error) ||
        isCrossOriginError(event)
      ) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isCrossOriginError(event.reason) || isCrossOriginError(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </StrictMode>,
);

// Gerenciamento de Service Worker (PWA):
// Em desenvolvimento (Vite dev), desregistra qualquer SW e limpa cache para evitar duplicação ou conflitos de instâncias de React/hooks.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key);
        }
      });
    }
  } else {
    // Em produção, registra o Service Worker para suporte offline PWA
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] Nova versão disponível do Dyeldi.');
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', err);
        });
    });
  }
}

