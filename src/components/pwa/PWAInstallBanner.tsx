import React from 'react';
import { Download, Share, PlusSquare, MoreVertical, X, Smartphone, CheckCircle, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
  const {
    canInstall,
    isStandalone,
    isIOS,
    isFirefox,
    isDismissed,
    hasNativePrompt,
    showGuideModal,
    setShowGuideModal,
    triggerInstall,
    dismissBanner,
  } = usePWAInstall();

  // Se o app já está em modo PWA standalone, não renderiza nada
  if (isStandalone) return null;

  return (
    <>
      {/* Floating Bottom Banner (Aparece se for instalável e não tiver sido dispensado) */}
      {canInstall && !isDismissed && (
        <div className="fixed bottom-16 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-sm z-40 bg-zinc-900/95 dark:bg-[#121215]/95 backdrop-blur-md text-white p-4 rounded-2xl border border-zinc-700/60 dark:border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Aplicativo Dyeldi
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">
                Instale para acesso rápido
              </h4>
              <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                Acesse sua carteira B3 instantaneamente e use offline sem ocupar espaço.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerInstall}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  {hasNativePrompt ? 'Instalar Agora' : 'Como Instalar'}
                </button>
                <button
                  type="button"
                  onClick={dismissBanner}
                  className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  Agora não
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Fechar banner de instalação"
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal de Guia de Instalação para iOS Safari / Firefox / Desktop sem Prompt */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-guide-modal-title"
            className="bg-zinc-900 border border-zinc-800 text-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative my-auto space-y-5 animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="pwa-guide-modal-title" className="font-bold text-base text-white tracking-tight">
                    Instalar Dyeldi no seu dispositivo
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Siga o passo a passo do seu navegador
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Fechar guia de instalação"
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo específico por Navegador */}
            {isIOS ? (
              <div className="space-y-4 text-xs text-zinc-300">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 font-medium">
                  📱 No iPhone / iPad (Safari), a instalação leva poucos segundos:
                </div>

                <ol className="space-y-3 font-medium">
                  <li className="flex items-start gap-3 bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700/50">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </span>
                    <div>
                      Toque no ícone de <strong className="text-white flex items-center gap-1 inline-flex">Compartilhar <Share className="w-3.5 h-3.5 text-emerald-400" /></strong> na barra inferior ou superior do Safari.
                    </div>
                  </li>

                  <li className="flex items-start gap-3 bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700/50">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </span>
                    <div>
                      Role a lista de opções e selecione <strong className="text-white flex items-center gap-1 inline-flex">"Adicionar à Tela de Início" <PlusSquare className="w-3.5 h-3.5 text-emerald-400" /></strong>.
                    </div>
                  </li>

                  <li className="flex items-start gap-3 bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700/50">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </span>
                    <div>
                      Toque em <strong className="text-white">"Adicionar"</strong> no canto superior direito.
                    </div>
                  </li>
                </ol>
              </div>
            ) : isFirefox ? (
              <div className="space-y-4 text-xs text-zinc-300">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-300 font-medium">
                  🦊 No Mozilla Firefox:
                </div>

                <ol className="space-y-3 font-medium">
                  <li className="flex items-start gap-3 bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700/50">
                    <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </span>
                    <div>
                      Abra o menu de opções do Firefox (<MoreVertical className="w-3.5 h-3.5 inline text-indigo-400" />).
                    </div>
                  </li>

                  <li className="flex items-start gap-3 bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700/50">
                    <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </span>
                    <div>
                      Clique em <strong className="text-white">"Instalar"</strong> ou <strong className="text-white">"Adicionar à tela inicial"</strong>.
                    </div>
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-zinc-300">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 font-medium">
                  🖥️ No Chrome, Edge ou Navegador Desktop/Mobile:
                </div>

                <ol className="space-y-3 font-medium">
                  <li className="flex items-start gap-3 bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700/50">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </span>
                    <div>
                      Procure pelo ícone de instalação (<Download className="w-3.5 h-3.5 inline text-emerald-400" />) no lado direito da barra de endereço do navegador.
                    </div>
                  </li>

                  <li className="flex items-start gap-3 bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700/50">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </span>
                    <div>
                      Ou abra o menu (<MoreVertical className="w-3.5 h-3.5 inline text-emerald-400" />) e selecione <strong className="text-white">"Instalar Dyeldi"</strong>.
                    </div>
                  </li>
                </ol>
              </div>
            )}

            {/* Footer Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-2xl transition cursor-pointer text-xs"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
