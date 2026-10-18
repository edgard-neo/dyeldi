import React, { useState, useEffect } from 'react';
import { User } from '../lib/firebase';
import {
  getUserNotificationSettings,
  saveUserNotificationSettings,
  requestWebPushPermission,
  sendBrowserPushNotification,
  getUserAlertHistory,
  logTriggerAlert,
  NotificationSettings,
  TriggerAlertLog,
} from '../lib/notifications';
import {
  Bell,
  Mail,
  Smartphone,
  Check,
  AlertTriangle,
  Send,
  History,
  X,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Trash2,
  Sparkles,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import axios from 'axios';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  activeTriggers?: Array<{
    ticker: string;
    action: 'COMPRAR' | 'VENDA';
    reason: string;
    amountDiff: number;
    quantityDiff: number;
  }>;
}

export default function NotificationModal({ isOpen, onClose, user, activeTriggers = [] }: Props) {
  const [settings, setSettings] = useState<NotificationSettings>({
    pushEnabled: false,
    emailEnabled: false,
    emailAddress: user?.email || '',
    alertOnBuyTrigger: true,
    alertOnSellTrigger: true,
  });

  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [alertHistory, setAlertHistory] = useState<TriggerAlertLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toastAlert, setToastAlert] = useState<{ title: string; body: string } | null>(null);

  // Load Settings and History on open
  useEffect(() => {
    if (!isOpen) return;

    getUserNotificationSettings(user?.uid).then((s) => {
      setSettings({
        ...s,
        emailAddress: s.emailAddress || user?.email || '',
      });
    });

    setLoadingHistory(true);
    getUserAlertHistory(user?.uid)
      .then((h) => setAlertHistory(h))
      .finally(() => setLoadingHistory(false));

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleTogglePushPermission = async () => {
    setFeedbackMsg(null);
    const granted = await requestWebPushPermission();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    }

    if (granted) {
      const updated = { ...settings, pushEnabled: true };
      setSettings(updated);
      await saveUserNotificationSettings(user?.uid, updated);
      setFeedbackMsg({ type: 'success', text: 'Notificações Push ativadas no navegador.' });
      sendBrowserPushNotification('🔔 Notificações Dyeldi Ativadas!', {
        body: 'Você receberá alertas quando seus ativos atingirem gatilhos.',
      });
    } else {
      setFeedbackMsg({
        type: 'error',
        text: 'Permissão não concedida no navegador.',
      });
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setFeedbackMsg(null);
    try {
      await saveUserNotificationSettings(user?.uid, settings);
      setFeedbackMsg({ type: 'success', text: 'Preferências salvas com sucesso!' });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Erro ao salvar preferências.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTestSending(true);
    setFeedbackMsg(null);

    const sampleTrigger =
      activeTriggers.length > 0
        ? activeTriggers[0]
        : {
            ticker: 'VALE3',
            action: 'COMPRAR' as const,
            reason: 'Abaixo da meta estipulada',
            amountDiff: 1250,
            quantityDiff: 20,
          };

    const title = `Alerta Dyeldi: Gatilho de ${sampleTrigger.action} em ${sampleTrigger.ticker}`;
    const body = `${sampleTrigger.ticker} atingiu a condição de ${sampleTrigger.action} (${sampleTrigger.reason}). Sugestão: ${sampleTrigger.quantityDiff} cotas.`;

    // 1. In-App Visual Toast
    setToastAlert({ title, body });
    setTimeout(() => setToastAlert(null), 5000);

    // 2. Local Browser Desktop Notification (if enabled)
    let pushSent = false;
    if (settings.pushEnabled && browserPermission === 'granted') {
      pushSent = sendBrowserPushNotification(title, { body });
    }

    // 3. Dispatch Server FCM / Email endpoint
    try {
      await axios.post('/api/notifications/dispatch', {
        userId: user?.uid || 'guest_user',
        userEmail: settings.emailAddress || user?.email || 'demo@example.com',
        ticker: sampleTrigger.ticker,
        action: sampleTrigger.action,
        title,
        body,
        emailEnabled: settings.emailEnabled,
        pushEnabled: settings.pushEnabled,
      });

      // 4. Log to Firestore & Local Storage
      const logId = await logTriggerAlert(user?.uid, {
        userId: user?.uid || 'demo_user',
        ticker: sampleTrigger.ticker,
        action: sampleTrigger.action,
        title,
        body,
        timestamp: new Date().toISOString(),
        channelSent: settings.emailEnabled && pushSent ? 'both' : pushSent ? 'push' : 'email',
        read: false,
      });

      if (logId) {
        const updatedHistory = await getUserAlertHistory(user?.uid);
        setAlertHistory(updatedHistory);
      }

      setFeedbackMsg({
        type: 'success',
        text: 'Alerta de teste emitido e registrado no histórico.',
      });
    } catch (e) {
      await logTriggerAlert(user?.uid, {
        userId: user?.uid || 'demo_user',
        ticker: sampleTrigger.ticker,
        action: sampleTrigger.action,
        title,
        body,
        timestamp: new Date().toISOString(),
        channelSent: pushSent ? 'push' : 'email',
        read: false,
      });
      const updatedHistory = await getUserAlertHistory(user?.uid);
      setAlertHistory(updatedHistory);

      setFeedbackMsg({
        type: 'success',
        text: 'Alerta de teste emitido com sucesso na tela.',
      });
    } finally {
      setTestSending(false);
    }
  };

  const handleClearHistory = () => {
    try {
      localStorage.removeItem('rise_notification_history');
      setAlertHistory([]);
      setFeedbackMsg({ type: 'success', text: 'Histórico limpo.' });
      setTimeout(() => setFeedbackMsg(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-slate-200/90 space-y-4 my-auto max-h-[90vh] flex flex-col justify-between overflow-y-auto">
        {/* Compact Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs flex items-center justify-center">
              <Bell className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                Alertas da Carteira
              </h3>
              <p className="text-[11px] text-slate-500">
                Gatilhos de Compra e Venda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dica Informativa */}
        <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span className="leading-snug">
            Configure abaixo os alertas de preço e preferências de aviso no seu navegador.
          </span>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium text-xs">{feedbackMsg.text}</span>
          </div>
        )}

        {/* Toast Alert */}
        {toastAlert && (
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg border border-indigo-500/40 space-y-0.5">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {toastAlert.title}
              </span>
              <span className="text-xs text-slate-400 font-mono">Agora</span>
            </div>
            <p className="text-xs text-slate-200">{toastAlert.body}</p>
          </div>
        )}

        {/* Active Triggers Compact */}
        {activeTriggers.length > 0 && (
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                {activeTriggers.length} Oportunidades Identificadas
              </span>
              <span className="text-xs text-indigo-600 font-mono">Ao Vivo</span>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
              {activeTriggers.map((tr) => (
                <div
                  key={tr.ticker}
                  className="bg-white p-1.5 px-2 rounded-lg border border-indigo-100/80 text-xs flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-xs flex items-center gap-0.5 ${
                        tr.action === 'COMPRAR'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {tr.action === 'COMPRAR' ? (
                        <ArrowUpRight className="w-2.5 h-2.5" />
                      ) : (
                        <ArrowDownRight className="w-2.5 h-2.5" />
                      )}
                      {tr.action}
                    </span>
                    <strong className="text-slate-900">{tr.ticker}</strong>
                  </div>
                  <span className="text-slate-500 text-xs">
                    {tr.quantityDiff} cotas
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Channel Settings Compact */}
        <div className="space-y-2 text-xs">
          {/* Push Web */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-800 text-xs">Notificações no navegador</span>
            </div>
            {browserPermission === 'granted' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs">
                <Check className="w-3 h-3" /> Ativo
              </span>
            ) : (
              <button
                type="button"
                onClick={handleTogglePushPermission}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
              >
                Ativar
              </button>
            )}
          </div>

          {/* Trigger check toggles */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="font-bold text-slate-800 text-xs">Alertar em:</div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <label className="flex items-center gap-1.5 p-1.5 bg-white rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.alertOnBuyTrigger}
                  onChange={(e) => setSettings({ ...settings, alertOnBuyTrigger: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                />
                <span className="font-bold text-emerald-700">Compra</span>
              </label>

              <label className="flex items-center gap-1.5 p-1.5 bg-white rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.alertOnSellTrigger}
                  onChange={(e) => setSettings({ ...settings, alertOnSellTrigger: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                />
                <span className="font-bold text-amber-700">Venda</span>
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons Compact */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleSendTestNotification}
            disabled={testSending}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
          >
            {testSending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3 text-emerald-400" />
            )}
            <span>Testar Alerta</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Alert History Logs Compact */}
        {alertHistory.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <History className="w-3 h-3 text-slate-400" />
                Histórico ({alertHistory.length})
              </span>
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-xs text-slate-400 hover:text-rose-600 font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <Trash2 className="w-2.5 h-2.5" />
                Limpar
              </button>
            </div>

            <div className="max-h-20 overflow-y-auto space-y-1 text-xs pr-1">
              {alertHistory.slice(0, 3).map((item) => (
                <div
                  key={item.id || item.timestamp}
                  className="p-1.5 bg-slate-50 rounded-lg border border-slate-200/70 flex items-center justify-between gap-1.5"
                >
                  <div className="truncate text-slate-800 font-medium">{item.title}</div>
                  <span className="text-xs font-mono text-slate-400 shrink-0">
                    {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

