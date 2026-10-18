import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  query,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserTransaction } from '../types';
import { processTransactions } from '../utils/calculator';

const DEMO_STORAGE_KEY = 'rise_demo_portfolio_txs';
const DEMO_TARGETS_KEY = 'rise_demo_portfolio_targets';
const DEMO_WATCH_KEY = 'rise_demo_portfolio_watchlist';
const DEMO_BROKERAGE_KEY = 'rise_demo_portfolio_brokerage';

const DEFAULT_SAMPLE_TXS: UserTransaction[] = [
  {
    id: 'demo_tx_1',
    ticker: 'PETR4',
    type: 'COMPRA',
    date: '2025-01-10',
    quantity: 200,
    price: 36.5,
    fees: 2.5,
    total: 7302.5,
    notes: 'Aporte inicial Petrobras',
    createdAt: '2025-01-10T10:00:00Z',
  },
  {
    id: 'demo_tx_2',
    ticker: 'VALE3',
    type: 'COMPRA',
    date: '2025-01-15',
    quantity: 100,
    price: 61.2,
    fees: 1.8,
    total: 6121.8,
    notes: 'Aporte Vale',
    createdAt: '2025-01-15T11:30:00Z',
  },
  {
    id: 'demo_tx_3',
    ticker: 'ITUB4',
    type: 'COMPRA',
    date: '2025-02-01',
    quantity: 300,
    price: 33.4,
    fees: 2.0,
    total: 10022.0,
    notes: 'Itaú Unibanco',
    createdAt: '2025-02-01T14:15:00Z',
  },
  {
    id: 'demo_tx_4',
    ticker: 'BBAS3',
    type: 'COMPRA',
    date: '2025-02-10',
    quantity: 150,
    price: 27.8,
    fees: 1.5,
    total: 4171.5,
    notes: 'Banco do Brasil',
    createdAt: '2025-02-10T09:45:00Z',
  },
  {
    id: 'demo_tx_5',
    ticker: 'MXRF11',
    type: 'COMPRA',
    date: '2025-02-20',
    quantity: 500,
    price: 10.15,
    fees: 1.0,
    total: 5076.0,
    notes: 'FII Maxi Renda',
    createdAt: '2025-02-20T16:00:00Z',
  },
  {
    id: 'demo_tx_6',
    ticker: 'PETR4',
    type: 'VENDA',
    date: '2025-03-01',
    quantity: 50,
    price: 39.8,
    fees: 1.5,
    total: 1988.5,
    notes: 'Realização parcial de lucro',
    createdAt: '2025-03-01T12:00:00Z',
  },
  {
    id: 'demo_tx_7',
    ticker: 'ITUB4',
    type: 'PROVENTO',
    date: '2025-03-05',
    quantity: 300,
    price: 0.85,
    fees: 0,
    total: 255.0,
    notes: 'Dividendo Mensal',
    createdAt: '2025-03-05T08:00:00Z',
  },
  {
    id: 'demo_tx_8',
    ticker: 'MXRF11',
    type: 'PROVENTO',
    date: '2025-03-15',
    quantity: 500,
    price: 0.1,
    fees: 0,
    total: 50.0,
    notes: 'Rendimento FII',
    createdAt: '2025-03-15T08:00:00Z',
  },
];

const DEFAULT_SAMPLE_TARGETS: Record<string, number> = {
  PETR4: 25,
  VALE3: 25,
  ITUB4: 25,
  BBAS3: 15,
  MXRF11: 10,
};

export function usePortfolioData(
  user: User | null,
  onDemoActionBlocked?: (actionName: string) => void
) {
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [targetPercents, setTargetPercents] = useState<Record<string, number>>({});
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [brokerages, setBrokerages] = useState<Record<string, string>>({});
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [isSeedingSample, setIsSeedingSample] = useState<boolean>(false);

  const isDemo = user?.uid === 'demo_user' || user?.uid === 'guest_user';

  // Subscribe to Firestore transactions, positions, and watchlist (or load Demo state)
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoadingData(false);
      try {
        const savedWatch = localStorage.getItem('rise_watchlist');
        if (savedWatch) {
          setWatchlist(JSON.parse(savedWatch));
        }
      } catch (e) {
        console.error(e);
      }
      return;
    }

    if (isDemo) {
      setLoadingData(true);
      try {
        const storedTxs = sessionStorage.getItem(DEMO_STORAGE_KEY);
        const storedTargets = sessionStorage.getItem(DEMO_TARGETS_KEY);
        const storedWatch = sessionStorage.getItem(DEMO_WATCH_KEY);
        const storedBroker = sessionStorage.getItem(DEMO_BROKERAGE_KEY);

        setTransactions(storedTxs ? JSON.parse(storedTxs) : DEFAULT_SAMPLE_TXS);
        setTargetPercents(storedTargets ? JSON.parse(storedTargets) : DEFAULT_SAMPLE_TARGETS);
        setWatchlist(storedWatch ? JSON.parse(storedWatch) : ['WEGE3', 'BBAS3', 'TAEE11']);
        setBrokerages(storedBroker ? JSON.parse(storedBroker) : { PETR4: 'XP Investimentos', VALE3: 'BTG Pactual', ITUB4: 'Íon Itaú', BBAS3: 'Banco do Brasil', MXRF11: 'NuInvest' });
      } catch (e) {
        setTransactions(DEFAULT_SAMPLE_TXS);
        setTargetPercents(DEFAULT_SAMPLE_TARGETS);
        setWatchlist(['WEGE3', 'BBAS3', 'TAEE11']);
      } finally {
        setLoadingData(false);
      }
      return;
    }

    setLoadingData(true);
    const txQuery = query(collection(db, 'users', user.uid, 'transactions'));
    const posQuery = query(collection(db, 'users', user.uid, 'positions'));
    const watchQuery = query(collection(db, 'users', user.uid, 'watchlist'));
    const metaQuery = query(collection(db, 'users', user.uid, 'portfolioMeta'));

    const unsubscribeTx = onSnapshot(
      txQuery,
      (snapshot) => {
        const list: UserTransaction[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            ticker: data.ticker || '',
            type: data.type || 'COMPRA',
            date: data.date || '',
            quantity: Number(data.quantity) || 0,
            price: Number(data.price) || 0,
            fees: Number(data.fees) || 0,
            total: Number(data.total) || 0,
            notes: data.notes || '',
            createdAt: data.createdAt,
          });
        });
        setTransactions(list);
        setLoadingData(false);
      },
      (err) => {
        if (!auth.currentUser || (err as { code?: string })?.code === 'permission-denied') {
          setLoadingData(false);
          return;
        }
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/transactions`);
        setLoadingData(false);
      }
    );

    const unsubscribePos = onSnapshot(
      posQuery,
      (snapshot) => {
        const targets: Record<string, number> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.targetPercent !== undefined) {
            targets[docSnap.id.toUpperCase()] = Number(data.targetPercent);
          }
        });
        setTargetPercents(targets);
      },
      (err) => {
        if (!auth.currentUser || (err as { code?: string })?.code === 'permission-denied') return;
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/positions`);
      }
    );

    const unsubscribeWatch = onSnapshot(
      watchQuery,
      (snapshot) => {
        const list: string[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.id.toUpperCase());
        });
        setWatchlist(list);
      },
      (err) => {
        if (!auth.currentUser || (err as { code?: string })?.code === 'permission-denied') return;
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/watchlist`);
      }
    );

    const unsubscribeMeta = onSnapshot(
      metaQuery,
      (snapshot) => {
        const bMap: Record<string, string> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.brokerage) {
            bMap[docSnap.id.toUpperCase()] = data.brokerage;
          }
        });
        setBrokerages(bMap);
      },
      (err) => {
        if (!auth.currentUser || (err as { code?: string })?.code === 'permission-denied') return;
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/portfolioMeta`);
      }
    );

    return () => {
      unsubscribeTx();
      unsubscribePos();
      unsubscribeWatch();
      unsubscribeMeta();
    };
  }, [user, isDemo]);

  const handleUpdateBrokerage = async (ticker: string, brokerage: string) => {
    if (isDemo) {
      onDemoActionBlocked?.('vincular corretora');
      return;
    }
    const upper = ticker.toUpperCase().trim();
    setBrokerages((prev) => {
      const next = { ...prev, [upper]: brokerage };
      return next;
    });

    if (!user || isDemo) return;
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'portfolioMeta', upper),
        {
          ticker: upper,
          brokerage,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/portfolioMeta/${upper}`);
    }
  };

  const handleToggleFavorite = async (ticker: string) => {
    if (isDemo) {
      onDemoActionBlocked?.('adicionar ativos à watchlist');
      return;
    }
    const upper = ticker.toUpperCase().trim();
    if (!upper) return;

    const isFav = watchlist.includes(upper);

    if (user) {
      try {
        if (isFav) {
          await deleteDoc(doc(db, 'users', user.uid, 'watchlist', upper));
        } else {
          await setDoc(doc(db, 'users', user.uid, 'watchlist', upper), {
            ticker: upper,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        handleFirestoreError(
          err,
          isFav ? OperationType.DELETE : OperationType.WRITE,
          `users/${user.uid}/watchlist/${upper}`
        );
      }
    } else {
      let newFavs: string[];
      if (isFav) {
        newFavs = watchlist.filter((t) => t !== upper);
      } else {
        newFavs = [...watchlist, upper];
      }
      setWatchlist(newFavs);
      try {
        localStorage.setItem('rise_watchlist', JSON.stringify(newFavs));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSaveTransaction = async (
    txData: Omit<UserTransaction, 'id' | 'createdAt'>,
    id?: string
  ) => {
    if (isDemo) {
      onDemoActionBlocked?.(id ? 'editar transação' : 'adicionar transação');
      return false;
    }
    if (!user) return;

    const now = new Date().toISOString();
    const txId = id || `tx_${Date.now()}`;
    const newTx: UserTransaction = {
      ...txData,
      id: txId,
      createdAt: now,
    };

    try {
      const payload: any = {
        ticker: txData.ticker,
        type: txData.type,
        date: txData.date,
        quantity: Number(txData.quantity) || 0,
        price: Number(txData.price) || 0,
        fees: Number(txData.fees) || 0,
        total: Number(txData.total) || 0,
        notes: txData.notes || '',
        createdAt: now,
      };

      await setDoc(
        doc(db, 'users', user.uid, 'transactions', txId),
        payload,
        { merge: true }
      );
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/transactions/${txId}`);
      return false;
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (isDemo) {
      onDemoActionBlocked?.('excluir transação');
      return;
    }
    if (!user) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'transactions', txId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/transactions/${txId}`);
    }
  };

  const handleUpdateTargetPercent = async (ticker: string, newTarget: number) => {
    if (isDemo) {
      onDemoActionBlocked?.('alterar metas de alocação');
      return;
    }
    if (!user) return;

    try {
      await setDoc(
        doc(db, 'users', user.uid, 'positions', ticker.toUpperCase()),
        {
          targetPercent: newTarget,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/positions/${ticker.toUpperCase()}`);
    }
  };

  const handleSeedSamplePortfolio = async () => {
    if (!user || isSeedingSample) return;
    setIsSeedingSample(true);

    if (isDemo) {
      setTransactions(DEFAULT_SAMPLE_TXS);
      setTargetPercents(DEFAULT_SAMPLE_TARGETS);
      sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(DEFAULT_SAMPLE_TXS));
      sessionStorage.setItem(DEMO_TARGETS_KEY, JSON.stringify(DEFAULT_SAMPLE_TARGETS));
      setIsSeedingSample(false);
      return;
    }

    try {
      const now = new Date();
      for (let i = 0; i < DEFAULT_SAMPLE_TXS.length; i++) {
        const tx = DEFAULT_SAMPLE_TXS[i];
        await setDoc(doc(db, 'users', user.uid, 'transactions', `sample_tx_${i + 1}`), {
          ...tx,
          createdAt: now.toISOString(),
        });
      }

      for (const t of Object.keys(DEFAULT_SAMPLE_TARGETS)) {
        await setDoc(
          doc(db, 'users', user.uid, 'positions', t),
          { targetPercent: DEFAULT_SAMPLE_TARGETS[t], updatedAt: now.toISOString() },
          { merge: true }
        );
      }
    } catch (err) {
      console.error('Erro ao criar carteira exemplo:', err);
    } finally {
      setIsSeedingSample(false);
    }
  };

  return {
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
  };
}
