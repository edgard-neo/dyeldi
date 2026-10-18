import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import fallbackConfig from '../../firebase-applet-config.example.json';

// Tenta carregar arquivo local caso exista, sem quebrar o build do Vite quando o arquivo for removido/ignorado
const localConfigs = import.meta.glob('/**/firebase-applet-config.json', { eager: true }) as Record<string, any>;
const localFileConfig = Object.values(localConfigs)[0]?.default || Object.values(localConfigs)[0] || {};
const rawConfig = { ...fallbackConfig, ...localFileConfig };

// Suporta variáveis de ambiente (VITE_FIREBASE_*) para deploys abertos/seguros no GitHub,
// com fallback para o template público de exemplo
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || rawConfig.apiKey || '').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain || '').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId || '').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket || '').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId || '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || rawConfig.appId || '').trim(),
  firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_DATABASE_ID || rawConfig.firestoreDatabaseId || '').trim(),
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || rawConfig.measurementId || '').trim(),
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch((err) => {
    console.debug('[Firebase Analytics] Analytics disabled or unsupported in iframe:', err);
  });
}

// Use custom named database ID if provisioned
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes('SUA_CHAVE') &&
  !firebaseConfig.apiKey.includes('DummyKey') &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'seu-projeto-firebase'
);

async function testConnection() {
  if (!isFirebaseConfigured || typeof window === 'undefined') return;
  const runProbe = () => {
    getDocFromServer(doc(db, 'test', 'connection')).catch((error) => {
      console.debug('[Firestore] Connection probe status:', error instanceof Error ? error.message : error);
    });
  };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(runProbe, { timeout: 4000 });
  } else {
    setTimeout(runProbe, 2000);
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };

  const isPermissionErr =
    (error as { code?: string })?.code === 'permission-denied' ||
    String(error).toLowerCase().includes('permission') ||
    String(error).toLowerCase().includes('insufficient');

  if (!auth.currentUser || isPermissionErr) {
    console.warn('[Firestore Log] Unauthenticated or permission error suppressed:', errInfo.error);
  } else {
    console.error('Firestore Diagnostic Error: ', JSON.stringify(errInfo));
  }
  return errInfo;
}

export {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
};
export type { User };

