import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  emailAddress: string;
  fcmToken?: string;
  alertOnBuyTrigger: boolean;
  alertOnSellTrigger: boolean;
  updatedAt?: string;
}

export interface TriggerAlertLog {
  id?: string;
  userId: string;
  ticker: string;
  action: 'COMPRAR' | 'VENDA';
  title: string;
  body: string;
  timestamp: string;
  channelSent: 'push' | 'email' | 'both' | 'browser';
  read: boolean;
}

const LOCAL_STORAGE_SETTINGS_KEY = 'rise_notification_settings';
const LOCAL_STORAGE_HISTORY_KEY = 'rise_notification_history';

/**
 * Get user notification settings from Firestore or LocalStorage fallback
 */
export async function getUserNotificationSettings(userId?: string | null): Promise<NotificationSettings> {
  if (userId && userId !== 'demo_user' && userId !== 'guest_user') {
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'notifications');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as NotificationSettings;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${userId}/settings/notifications`);
    }
  }

  // Local Storage Fallback
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (local) {
      return JSON.parse(local) as NotificationSettings;
    }
  } catch (e) {
    console.warn('Could not read notification settings from localStorage', e);
  }

  return {
    pushEnabled: false,
    emailEnabled: true,
    emailAddress: '',
    alertOnBuyTrigger: true,
    alertOnSellTrigger: true,
  };
}

/**
 * Save user notification settings to Firestore and LocalStorage
 */
export async function saveUserNotificationSettings(userId: string | null | undefined, settings: NotificationSettings): Promise<boolean> {
  const updatedSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(updatedSettings));
  } catch (e) {
    console.warn('Could not save to localStorage', e);
  }

  if (userId && userId !== 'demo_user' && userId !== 'guest_user') {
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'notifications');
      await setDoc(docRef, updatedSettings, { merge: true });
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}/settings/notifications`);
      return false;
    }
  }
  return true;
}

/**
 * Log a trigger alert to Firestore alert history & LocalStorage
 */
export async function logTriggerAlert(userId: string | null | undefined, alert: Omit<TriggerAlertLog, 'id'>): Promise<string | null> {
  const newAlert: TriggerAlertLog = {
    ...alert,
    id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: alert.timestamp || new Date().toISOString(),
    read: false,
  };

  // Save to local storage history
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    const list: TriggerAlertLog[] = raw ? JSON.parse(raw) : [];
    list.unshift(newAlert);
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
  } catch (e) {
    console.warn('Could not save alert log to localStorage', e);
  }

  if (userId && userId !== 'demo_user' && userId !== 'guest_user') {
    try {
      const colRef = collection(db, 'users', userId, 'alerts_history');
      const docRef = await addDoc(colRef, newAlert);
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}/alerts_history`);
      return newAlert.id || null;
    }
  }

  return newAlert.id || null;
}

/**
 * Fetch alert history for user
 */
export async function getUserAlertHistory(userId?: string | null, maxItems = 20): Promise<TriggerAlertLog[]> {
  if (userId && userId !== 'demo_user' && userId !== 'guest_user') {
    try {
      const colRef = collection(db, 'users', userId, 'alerts_history');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxItems));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as TriggerAlertLog[];
      if (items.length > 0) return items;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/alerts_history`);
    }
  }

  // Fallback to local storage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    if (raw) {
      return JSON.parse(raw).slice(0, maxItems) as TriggerAlertLog[];
    }
  } catch (e) {
    console.warn('Could not read alert history from localStorage', e);
  }

  return [];
}

/**
 * Request Web Push Permission in Browser (safe for iframes)
 */
export async function requestWebPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Este navegador ou ambiente não suporta notificações de área de trabalho.');
    return false;
  }

  try {
    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (err) {
    console.warn('Acesso a notificações de sistema bloqueado ou restrito no iframe:', err);
  }

  return false;
}

/**
 * Send a browser desktop notification
 */
export function sendBrowserPushNotification(title: string, options?: NotificationOptions): boolean {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notification = new Notification(title, {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch (e) {
    console.error('Erro ao emitir notificação no navegador:', e);
    return false;
  }
}
