import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from '../lib/firebase';
import {
  Coins,
  Layers,
  LineChart,
  Target,
  Mail,
  KeyRound,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { RiseLogo } from './RiseLogo';

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
  isModal?: boolean;
  onExploreDemo?: () => void;
}

type AuthMode = 'login' | 'signup' | 'reset';

export default function AuthModal({
  isOpen = true,
  onClose,
  isModal = false,
  onExploreDemo,
}: Props) {
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status States
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (isModal && !isOpen) return null;

  const translateFirebaseError = (code: string, rawMessage?: string): string => {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'seu-dominio';
    switch (code) {
      case 'auth/unauthorized-domain':
        return `O domínio (${currentHost}) não está registrado nos "Domínios autorizados" do Firebase. Para habilitar: acesse o Firebase Console > Authentication > Settings > Authorized domains e adicione "${currentHost}", ou entre com E-mail e Senha abaixo.`;
      case 'auth/operation-not-allowed':
        return 'O método de login com o Google não está ativado no Firebase Console (Authentication > Sign-in method > Google).';
      case 'auth/popup-blocked':
        return 'O pop-up de login foi bloqueado pelo seu navegador. Por favor, habilite pop-ups para este site ou entre com E-mail e Senha.';
      case 'auth/popup-closed-by-user':
        return 'A janela de login com o Google foi fechada antes da conclusão.';
      case 'auth/cancelled-popup-request':
        return 'Solicitação de login cancelada. Tente novamente ou entre com E-mail e Senha.';
      case 'auth/network-request-failed':
        return t('auth.errors.network');
      case 'auth/email-already-in-use':
        return t('auth.errors.email_in_use');
      case 'auth/invalid-email':
        return t('auth.errors.invalid_email');
      case 'auth/user-not-found':
        return t('auth.errors.user_not_found');
      case 'auth/wrong-password':
        return t('auth.errors.wrong_password');
      case 'auth/invalid-credential':
        return t('auth.errors.invalid_credential');
      case 'auth/weak-password':
        return t('auth.errors.weak_password');
      case 'auth/too-many-requests':
        return t('auth.errors.too_many_requests');
      default:
        if (rawMessage && (rawMessage.toLowerCase().includes('closing') || rawMessage.toLowerCase().includes('hidden') || rawMessage.toLowerCase().includes('indexeddb'))) {
          return 'O navegador bloqueou temporariamente a conexão com o banco de dados durante o pop-up (Database closing/hidden). Tentando conexão alternativa com redirecionamento...';
        }
        return rawMessage || t('auth.errors.default');
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setGoogleLoading(true);

    const performSignIn = async (isRetry = false): Promise<void> => {
      try {
        await signInWithPopup(auth, googleProvider);
        onClose?.();
      } catch (err: any) {
        console.warn('[Google Sign-In Warning]:', err);
        const rawErrMsg = (err?.message || String(err || '')).toLowerCase();
        const isIndexedDBClosing =
          rawErrMsg.includes('closing') ||
          rawErrMsg.includes('hidden') ||
          rawErrMsg.includes('indexeddb');

        // If it's the tab visibility / IndexedDB closing race condition, retry once after short stabilization
        if (isIndexedDBClosing && !isRetry) {
          console.info('[Google Sign-In] Retrying sign-in after database/tab visibility recovery...');
          await new Promise((resolve) => setTimeout(resolve, 500));
          return performSignIn(true);
        }

        // Fallback to redirect if popup is blocked, cancelled, or if IndexedDB closed in popup
        if (
          err?.code === 'auth/popup-blocked' ||
          err?.code === 'auth/cancelled-popup-request' ||
          isIndexedDBClosing
        ) {
          try {
            await signInWithRedirect(auth, googleProvider);
            return;
          } catch (redirectErr: any) {
            setErrorMsg(translateFirebaseError(redirectErr?.code, redirectErr?.message));
          }
        } else {
          setErrorMsg(translateFirebaseError(err?.code, err?.message));
        }
      }
    };

    try {
      await performSignIn();
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg(t('auth.errors.invalid_email'));
      return;
    }

    if (authMode === 'reset') {
      setEmailLoading(true);
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        setSuccessMsg(t('auth.reset_sent_desc'));
      } catch (err: any) {
        setErrorMsg(translateFirebaseError(err?.code, err?.message));
      } finally {
        setEmailLoading(false);
      }
      return;
    }

    if (!password) {
      setErrorMsg(t('auth.errors.weak_password'));
      return;
    }

    if (authMode === 'signup') {
      if (password.length < 6) {
        setErrorMsg(t('auth.errors.weak_password'));
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg(t('auth.errors.password_mismatch'));
        return;
      }

      setEmailLoading(true);
      try {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (name.trim() && userCred.user) {
          try {
            await updateProfile(userCred.user, { displayName: name.trim() });
          } catch (profileErr) {
            console.warn('Profile name update warning:', profileErr);
          }
        }
        onClose?.();
      } catch (err: any) {
        setErrorMsg(translateFirebaseError(err?.code, err?.message));
      } finally {
        setEmailLoading(false);
      }
    } else {
      // Login mode
      setEmailLoading(true);
      try {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        onClose?.();
      } catch (err: any) {
        setErrorMsg(translateFirebaseError(err?.code, err?.message));
      } finally {
        setEmailLoading(false);
      }
    }
  };

  const handleDemoLogin = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setDemoLoading(true);
    try {
      onExploreDemo?.();
      onClose?.();
    } catch (err) {
      console.error(err);
    } finally {
      setDemoLoading(false);
    }
  };

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // ── REUSABLE FORM CONTENT (FOR MODAL & FULL-PAGE) ─────────────────────────
  const renderAuthForm = () => (
    <div className="w-full space-y-5">
      {/* Segmented Control: Entrar / Criar Conta (Hidden in Reset mode) */}
      {authMode !== 'reset' ? (
        <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-[#15151a] rounded-xl border border-black/[0.06] dark:border-white/[0.06] text-xs font-semibold">
          <button
            type="button"
            id="auth-tab-login"
            onClick={() => switchMode('login')}
            className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
              authMode === 'login'
                ? 'bg-white dark:bg-[#22222a] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {t('auth.tab_login')}
          </button>
          <button
            type="button"
            id="auth-tab-signup"
            onClick={() => switchMode('signup')}
            className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
              authMode === 'signup'
                ? 'bg-white dark:bg-[#22222a] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {t('auth.tab_signup')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            ← {t('auth.back_to_login')}
          </button>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            {t('auth.reset_title')}
          </span>
        </div>
      )}

      {/* Header Info */}
      <div className="text-center sm:text-left space-y-1">
        <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          {authMode === 'signup'
            ? t('auth.signup_title')
            : authMode === 'reset'
            ? t('auth.reset_title')
            : t('auth.title')}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {authMode === 'signup'
            ? t('auth.signup_subtitle')
            : authMode === 'reset'
            ? t('auth.reset_subtitle')
            : t('auth.subtitle')}
        </p>
      </div>

      {/* Error & Success Alerts */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
          <span className="leading-relaxed">{successMsg}</span>
        </div>
      )}

      {/* Primary Social: Google Login (Only in login and signup) */}
      {authMode !== 'reset' && (
        <>
          <button
            type="button"
            id="auth-google-btn"
            onClick={handleGoogleLogin}
            disabled={googleLoading || emailLoading}
            className="w-full h-11 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2.5 shadow-xs cursor-pointer disabled:opacity-60 active:scale-[0.99]"
          >
            {googleLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-zinc-400 dark:text-zinc-600" />
                <span>{t('auth.google_loading')}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{t('auth.google_button')}</span>
              </>
            )}
          </button>

          <div className="relative py-0.5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider font-semibold">
              <span className="px-3 bg-white dark:bg-[#0f0f12] text-zinc-600 dark:text-zinc-400">
                {t('auth.divider')}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Clean Email & Password Form */}
      <form onSubmit={handleEmailSubmit} className="space-y-3.5">
        {/* Name Field (Only in Signup) */}
        {authMode === 'signup' && (
          <div className="space-y-1">
            <label
              htmlFor="auth-name-input"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              {t('auth.name_label')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                id="auth-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.name_placeholder')}
                className="w-full h-10 pl-9 pr-3 text-xs bg-zinc-50 dark:bg-[#15151a] border border-zinc-200 dark:border-white/[0.1] rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
              />
            </div>
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-1">
          <label
            htmlFor="auth-email-input"
            className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            {t('auth.email_label')}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="auth-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email_placeholder')}
              className="w-full h-10 pl-9 pr-3 text-xs bg-zinc-50 dark:bg-[#15151a] border border-zinc-200 dark:border-white/[0.1] rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {/* Password Field (Not in Reset) */}
        {authMode !== 'reset' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="auth-password-input"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                {t('auth.password_label')}
              </label>
              {authMode === 'login' && (
                <button
                  type="button"
                  id="auth-forgot-password-btn"
                  onClick={() => switchMode('reset')}
                  className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                >
                  {t('auth.forgot_password')}
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="auth-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password_placeholder')}
                className="w-full h-10 pl-9 pr-10 text-xs bg-zinc-50 dark:bg-[#15151a] border border-zinc-200 dark:border-white/[0.1] rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Confirm Password Field (Only in Signup) */}
        {authMode === 'signup' && (
          <div className="space-y-1">
            <label
              htmlFor="auth-confirm-password-input"
              className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300"
            >
              {t('auth.confirm_password_label')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="auth-confirm-password-input"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.confirm_password_placeholder')}
                className="w-full h-10 pl-9 pr-10 text-xs bg-zinc-50 dark:bg-[#15151a] border border-zinc-200 dark:border-white/[0.1] rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                aria-label={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          id="auth-submit-btn"
          disabled={emailLoading || googleLoading}
          className="w-full h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-60 active:scale-[0.99]"
        >
          {emailLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Processando...</span>
            </>
          ) : (
            <>
              <span>
                {authMode === 'signup'
                  ? t('auth.submit_signup')
                  : authMode === 'reset'
                  ? t('auth.submit_reset')
                  : t('auth.submit_login')}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Alternative links: switch between login & signup in text */}
      <div className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        {authMode === 'login' ? (
          <p>
            {t('auth.no_account')}{' '}
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
            >
              {t('auth.tab_signup')}
            </button>
          </p>
        ) : authMode === 'signup' ? (
          <p>
            {t('auth.has_account')}{' '}
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
            >
              {t('auth.tab_login')}
            </button>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
          >
            ← {t('auth.back_to_login')}
          </button>
        )}
      </div>

      {/* Demo Mode Button */}
      {onExploreDemo && (
        <div className="pt-1">
          <button
            type="button"
            id="auth-demo-btn"
            onClick={handleDemoLogin}
            disabled={demoLoading || emailLoading || googleLoading}
            className="w-full h-10 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/[0.08] font-medium text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {demoLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>{t('auth.demo_title')}</span>
          </button>
        </div>
      )}
    </div>
  );

  // ── MODAL COMPONENT (POPUP DIALOG) ─────────────────────────────────────────
  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs overflow-y-auto">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="bg-white dark:bg-[#0f0f12] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl overflow-hidden max-w-md w-full p-6 sm:p-7 relative space-y-5 my-auto"
        >
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <RiseLogo size="md" variant="full" badge="none" />
          </div>

          {renderAuthForm()}
        </div>
      </div>
    );
  }

  // ── FULL SCREEN LOGIN PAGE ────────────────────────────────────────────────
  return (
    <div className="dark min-h-screen w-full bg-[#08080a] text-white flex flex-col lg:flex-row antialiased selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* ── PAINEL ESQUERDO (HERO & RECURSOS ATUALIZADOS DO DYELDI) ─────────── */}
      <div className="lg:w-7/12 xl:w-2/3 bg-radial from-indigo-950/30 via-[#0a0a0e] to-[#060608] p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-white/[0.06]">
        {/* Ambient glow backgrounds */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <RiseLogo size="lg" variant="full" badge="none" />
        </div>

        {/* Center Hero Copy & Value Props */}
        <div className="relative z-10 my-10 lg:my-auto max-w-2xl space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
              {t('auth.hero_title')}
            </h1>
            <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed max-w-xl">
              {t('auth.hero_desc')}
            </p>
          </div>

          {/* Cards de Destaques dos Recursos Reais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* 1. Crypto & B3 */}
            <div className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.07] transition space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <Coins className="w-4 h-4" />
                <span>{t('auth.features.crypto_title')}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t('auth.features.crypto_desc')}
              </p>
            </div>

            {/* 2. Rebalanceamento */}
            <div className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.07] transition space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <Layers className="w-4 h-4" />
                <span>{t('auth.features.rebalance_title')}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t('auth.features.rebalance_desc')}
              </p>
            </div>

            {/* 3. Projeções de Proventos */}
            <div className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.07] transition space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <LineChart className="w-4 h-4" />
                <span>{t('auth.features.projections_title')}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t('auth.features.projections_desc')}
              </p>
            </div>

            {/* 4. Diagnóstico de Carteira */}
            <div className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.07] transition space-y-2">
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>{t('auth.features.diagnosis_title')}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t('auth.features.diagnosis_desc')}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pt-6 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-400">
          <p>{t('auth.footer.rights', { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {t('auth.footer.b3')}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {t('auth.footer.crypto')}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {t('auth.footer.bc')}
            </span>
          </div>
        </div>
      </div>

      {/* ── PAINEL DIREITO (ENTRADA DE USUÁRIO / EMAIL / GOOGLE) ──────────── */}
      <div className="lg:w-5/12 xl:w-1/3 bg-[#0d0d11] p-8 sm:p-12 lg:p-16 flex flex-col justify-between items-center relative overflow-y-auto">
        <div className="w-full max-w-sm my-auto py-6">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center justify-center mb-6">
            <RiseLogo size="md" variant="full" badge="none" />
          </div>

          {renderAuthForm()}
        </div>

        {/* Termos no rodapé */}
        <p className="text-center text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mt-4">
          {t('auth.privacy.terms')}
        </p>
      </div>
    </div>
  );
}
