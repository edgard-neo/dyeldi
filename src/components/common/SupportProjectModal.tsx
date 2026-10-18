import React, { useState } from 'react';
import { Heart, Copy, Check, QrCode, X, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';

interface SupportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportProjectModal: React.FC<SupportProjectModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  // Chave Pix do desenvolvedor / suporte Dyeldi via variáveis de ambiente
  const pixKey = (import.meta.env.VITE_SUPPORT_PIX_KEY || 'chave-pix@exemplo.com').trim();
  const pixName = (import.meta.env.VITE_SUPPORT_PIX_NAME || 'Dyeldi Suporte & Doações').trim();
  const whatsappNumber = (import.meta.env.VITE_SUPPORT_WHATSAPP || '').trim();
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Acabei de apoiar o projeto Dyeldi.')}`
    : null;

  if (!isOpen) return null;

  const handleCopyPix = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white dark:bg-[#0f0f11] rounded-3xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com gradiente sutil */}
        <div className="p-6 pb-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/10 dark:bg-pink-500/20 text-pink-500 flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 fill-pink-500 text-pink-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Apoie o Projeto Dyeldi
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Desenvolvimento independente &amp; sem anúncios
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            O <strong className="text-zinc-900 dark:text-white">Dyeldi</strong> é uma ferramenta gratuita mantida com dedicação para a comunidade de investidores. Sua contribuição voluntária ajuda a custear servidores, APIs de cotações em tempo real e novas melhorias.
          </p>

          {/* Card Chave Pix */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-black/[0.06] dark:border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-emerald-500" />
                Chave Pix (Telefone)
              </span>
              <span className="text-[11px] text-zinc-400">{pixName}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-[#09090b] border border-black/[0.08] dark:border-white/[0.08] font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 select-all tracking-wide truncate">
                {pixKey}
              </div>

              <button
                type="button"
                onClick={handleCopyPix}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                  copied
                    ? 'bg-emerald-500 text-zinc-950 shadow-xs'
                    : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Pix</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Vantagens / Selo de Transparência */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Contribuição 100% voluntária de qualquer valor</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Apoia o desenvolvimento de novos recursos e cotações B3</span>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Falar no WhatsApp</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Chave Pix Protegida</span>
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-300 dark:hover:bg-zinc-700 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
