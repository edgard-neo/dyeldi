import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-white dark:bg-[#0f0f11] rounded-2xl border border-rose-200 dark:border-rose-950/60 shadow-xs flex flex-col items-center justify-center text-center my-4 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="max-w-md">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              {this.props.fallbackTitle || 'Ocorreu uma instabilidade nesta seção'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              {this.props.fallbackDescription ||
                'Não foi possível carregar os dados desta visualização. Você pode tentar recarregar.'}
            </p>
          </div>

          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
