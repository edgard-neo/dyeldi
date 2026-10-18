import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserTransaction,
  TransactionType,
  PortfolioSummaryItem,
  StockQuote,
} from '../types';
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Hash,
  Wallet,
  Plus,
} from 'lucide-react';
import TickerAutocomplete from './TickerAutocomplete';
import axios from 'axios';
import { formatBRL, formatBRLDecimal } from '../utils/calculator';
import { isCryptoTicker, isFiiTicker, isStockTicker } from '../utils/assetType';

import { InvestorProfileType } from '../hooks/useUserProfile';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    tx: Omit<UserTransaction, 'id' | 'createdAt'>,
    id?: string
  ) => Promise<boolean | void> | void;
  editingTx?: UserTransaction | Partial<UserTransaction> | null;
  defaultTicker?: string;
  defaultType?: TransactionType;
  portfolioItems?: PortfolioSummaryItem[];
  quotes?: Record<string, StockQuote>;
  transactions?: UserTransaction[];
  investorProfile?: InvestorProfileType;
  dbGlobalFeeType?: 'fixed' | 'percent';
  dbGlobalFeeValue?: string;
  onSaveGlobalFees?: (feeType: 'fixed' | 'percent', val: string) => void;
}

const POPULAR_TICKERS_BY_PROFILE: Record<InvestorProfileType, string[]> = {
  ALL: ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'MXRF11', 'WEGE3', 'HGLG11', 'BTC', 'ETH'],
  STOCKS: ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'WEGE3', 'TAEE11', 'SAPR11', 'B3SA3', 'RENT3'],
  FIIS: ['MXRF11', 'HGLG11', 'XPML11', 'KNCR11', 'VISC11', 'BBRC11', 'TGAR11', 'HGBS11'],
  CRYPTO: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX', 'DOT'],
};

const PROVENTO_TYPES = [
  { label: 'Dividendo', note: 'Dividendo' },
  { label: 'JCP', note: 'JCP' },
  { label: 'Rendimento FII', note: 'Rendimento FII' },
  { label: 'Amortização', note: 'Amortização' },
];

export default function TransactionModal({
  isOpen,
  onClose,
  onSave,
  editingTx,
  defaultTicker = '',
  defaultType = 'COMPRA',
  portfolioItems = [],
  quotes = {},
  transactions = [],
  investorProfile = 'ALL',
  dbGlobalFeeType,
  dbGlobalFeeValue,
  onSaveGlobalFees,
}: Props) {
  const [type, setType] = useState<TransactionType>(defaultType);
  const [ticker, setTicker] = useState(defaultTicker);
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [proventoMode, setProventoMode] = useState<'PER_UNIT' | 'TOTAL'>('TOTAL');
  const [totalDividendInput, setTotalDividendInput] = useState('');

  // Cash Balance Calculation
  const cashBalance = useMemo(() => {
    if (!transactions) return 0;
    const filtered = editingTx?.id ? transactions.filter(t => t.id !== editingTx.id) : transactions;
    const pTxs = filtered.filter(t => t.type === 'COMPRA');
    const sTxs = filtered.filter(t => t.type === 'VENDA');
    const dTxs = filtered.filter(t => t.type === 'PROVENTO');
    const depTxs = filtered.filter(t => t.type === 'DEPOSITO');
    const wTxs = filtered.filter(t => t.type === 'RETIRADA');

    const totP = pTxs.reduce((sum, t) => sum + t.total, 0);
    const totS = sTxs.reduce((sum, t) => sum + t.total, 0);
    const totD = dTxs.reduce((sum, t) => sum + t.total, 0);
    const totDep = depTxs.reduce((sum, t) => sum + t.total, 0);
    const totW = wTxs.reduce((sum, t) => sum + t.total, 0);

    return totDep - totW - totP + totS + totD;
  }, [transactions, editingTx]);

  // Global Centralized Operational Fees Preference
  const [globalFeeType, setGlobalFeeType] = useState<'fixed' | 'percent'>(() => {
    try {
      const val = localStorage.getItem('dyeldi_global_fee_type');
      return val === 'percent' ? 'percent' : 'fixed';
    } catch {
      return 'fixed';
    }
  });
  const [globalFeeValue, setGlobalFeeValue] = useState<string>(() => {
    try {
      const val = localStorage.getItem('dyeldi_global_fee_value');
      return val || '0.00';
    } catch {
      return '0.00';
    }
  });
  const [isFeeConfigOpen, setIsFeeConfigOpen] = useState(false);

  // Synchronize with Firestore-backed global fee props
  useEffect(() => {
    if (dbGlobalFeeType) {
      setGlobalFeeType(dbGlobalFeeType);
    }
  }, [dbGlobalFeeType]);

  useEffect(() => {
    if (dbGlobalFeeValue !== undefined) {
      setGlobalFeeValue(dbGlobalFeeValue);
    }
  }, [dbGlobalFeeValue]);

  const handleSaveGlobalFees = (feeType: 'fixed' | 'percent', val: string) => {
    setGlobalFeeType(feeType);
    setGlobalFeeValue(val);
    try {
      localStorage.setItem('dyeldi_global_fee_type', feeType);
      localStorage.setItem('dyeldi_global_fee_value', val);
    } catch (e) {
      console.warn('Erro ao salvar custos operacionais globais:', e);
    }
    if (onSaveGlobalFees) {
      onSaveGlobalFees(feeType, val);
    }
  };

  const calculatedFee = useMemo(() => {
    if (type === 'PROVENTO') return 0;
    const numQty = parseFloat(quantity) || 0;
    const numPrice = parseFloat(price) || 0;
    const rawVolume = numQty * numPrice;
    if (rawVolume <= 0) return 0;

    const val = parseFloat(globalFeeValue) || 0;
    if (val <= 0) return 0;

    if (globalFeeType === 'percent') {
      return (rawVolume * val) / 100;
    } else {
      return val;
    }
  }, [type, quantity, price, globalFeeType, globalFeeValue]);

  const effectiveFees = useMemo(() => {
    return calculatedFee;
  }, [calculatedFee]);

  const popularTickersList = useMemo(() => {
    return POPULAR_TICKERS_BY_PROFILE[investorProfile] || POPULAR_TICKERS_BY_PROFILE.ALL;
  }, [investorProfile]);

  // Posições ativas (quantidade > 0) priorizando a classe de ativos do perfil do usuário
  const activePositions = useMemo(() => {
    const raw = portfolioItems.filter((item) => item.quantity > 0);
    if (investorProfile === 'ALL') return raw;

    return [...raw].sort((a, b) => {
      const isAProfile =
        (investorProfile === 'FIIS' && isFiiTicker(a.ticker)) ||
        (investorProfile === 'STOCKS' && isStockTicker(a.ticker)) ||
        (investorProfile === 'CRYPTO' && (isCryptoTicker(a.ticker) || quotes[a.ticker]?.type === 'Cripto'));
      const isBProfile =
        (investorProfile === 'FIIS' && isFiiTicker(b.ticker)) ||
        (investorProfile === 'STOCKS' && isStockTicker(b.ticker)) ||
        (investorProfile === 'CRYPTO' && (isCryptoTicker(b.ticker) || quotes[b.ticker]?.type === 'Cripto'));

      if (isAProfile && !isBProfile) return -1;
      if (!isAProfile && isBProfile) return 1;
      return 0;
    });
  }, [portfolioItems, investorProfile, quotes]);

  const [localQuotes, setLocalQuotes] = useState<Record<string, StockQuote>>({});
  const [loadingLocalQuote, setLoadingLocalQuote] = useState(false);

  const combinedQuotes = useMemo(() => {
    return { ...quotes, ...localQuotes };
  }, [quotes, localQuotes]);

  // Posição atual selecionada
  const currentPosition = useMemo(() => {
    if (type === 'DEPOSITO' || type === 'RETIRADA') return null;
    const clean = ticker.trim().toUpperCase();
    if (!clean) return null;
    return (
      activePositions.find((item) => item.ticker.toUpperCase() === clean) ||
      null
    );
  }, [ticker, activePositions, type]);

  // Cotação ativa do ticker selecionado
  const activeQuote = useMemo(() => {
    if (type === 'DEPOSITO' || type === 'RETIRADA') return null;
    const clean = ticker.trim().toUpperCase();
    if (!clean) return null;
    return combinedQuotes[clean] || null;
  }, [ticker, combinedQuotes, type]);

  // Identifica se o ativo é cripto para permitir frações decimais
  const isCrypto = useMemo(() => {
    const clean = ticker.trim().toUpperCase();
    if (!clean) return false;
    const q = combinedQuotes[clean];
    if (q?.type === 'Cripto') return true;
    return isCryptoTicker(clean);
  }, [ticker, combinedQuotes]);

  // Buscar cotação em tempo real ao digitar um ticker que não esteja em cache
  useEffect(() => {
    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker || cleanTicker.length < 3 || cleanTicker === 'CAIXA') return;

    if (quotes[cleanTicker] || localQuotes[cleanTicker]) {
      return;
    }

    let isMounted = true;
    const fetchQuote = async () => {
      setLoadingLocalQuote(true);
      try {
        const res = await axios.get<StockQuote>(`/api/stock/${cleanTicker}`);
        if (res.data && isMounted) {
          setLocalQuotes((prev) => ({ ...prev, [cleanTicker]: res.data }));
        }
      } catch (err) {
        console.warn(`Erro ao buscar cotação de ${cleanTicker} no modal:`, err);
      } finally {
        if (isMounted) setLoadingLocalQuote(false);
      }
    };

    const timer = setTimeout(() => {
      fetchQuote();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [ticker, quotes, localQuotes]);

  // Reset / preload ao abrir ou editar
  useEffect(() => {
    if (!isOpen) return;

    if (editingTx) {
      setType(editingTx.type);
      setTicker(editingTx.ticker);
      setDate(editingTx.date);
      setQuantity(String(editingTx.quantity));
      setPrice(String(editingTx.price));
      setNotes(editingTx.notes || '');

      if (editingTx.type === 'PROVENTO') {
        const total = editingTx.price * editingTx.quantity;
        setTotalDividendInput(total.toFixed(2));
      }
    } else {
      setType(defaultType);
      setDate(new Date().toISOString().substring(0, 10));
      setNotes('');
      setTotalDividendInput('');

      if (defaultType === 'DEPOSITO' || defaultType === 'RETIRADA') {
        setTicker('CAIXA');
        setQuantity('1');
        setPrice('');
      } else {
        const initialTicker =
          defaultTicker ||
          (defaultType === 'VENDA' && activePositions.length > 0
            ? activePositions[0].ticker
            : '');
        setTicker(initialTicker);
        setQuantity('');
        setPrice('');

        if (initialTicker) {
          const q = combinedQuotes[initialTicker];
          const pos = activePositions.find((p) => p.ticker === initialTicker);
          if (defaultType === 'PROVENTO' && pos) {
            setQuantity(String(pos.quantity));
          } else if (q && q.price > 0) {
            setPrice(q.price.toFixed(2));
          }
        }
      }
    }
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTx, defaultTicker, defaultType, isOpen]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleTypeChange = useCallback(
    (newType: TransactionType) => {
      setType(newType);
      setError('');

      if (newType === 'DEPOSITO' || newType === 'RETIRADA') {
        setTicker('CAIXA');
        setQuantity('1');
        setPrice('');
      } else if (newType === 'VENDA') {
        if (activePositions.length > 0) {
          const found = activePositions.find((p) => p.ticker === ticker);
          if (!found) {
            const first = activePositions[0];
            setTicker(first.ticker);
            const q = combinedQuotes[first.ticker];
            setPrice(
              (
                q?.price ||
                first.currentPrice ||
                first.averagePrice ||
                0
              ).toFixed(2)
            );
            setQuantity('');
          }
        } else {
          setTicker('');
          setQuantity('');
          setPrice('');
        }
      } else if (newType === 'PROVENTO') {
        if (currentPosition) {
          setQuantity(String(currentPosition.quantity));
        }
      }
    },
    [activePositions, ticker, combinedQuotes, currentPosition]
  );

  const handleSelectPortfolioAsset = useCallback(
    (pos: PortfolioSummaryItem) => {
      setTicker(pos.ticker);
      const q = combinedQuotes[pos.ticker];
      const livePrice = q?.price || pos.currentPrice || pos.averagePrice;
      if (livePrice > 0) {
        setPrice(livePrice.toFixed(2));
      }

      if (type === 'VENDA' || type === 'PROVENTO') {
        setQuantity(String(pos.quantity));
      }
    },
    [combinedQuotes, type]
  );

  const handleSetSalePercent = useCallback(
    (percent: number) => {
      if (!currentPosition) return;
      if (isCrypto) {
        const qty = (currentPosition.quantity * percent) / 100;
        setQuantity(String(Number(qty.toFixed(8))));
      } else {
        const qty = Math.max(
          1,
          Math.floor((currentPosition.quantity * percent) / 100)
        );
        setQuantity(String(qty));
      }
    },
    [currentPosition, isCrypto]
  );

  const handleTotalDividendChange = useCallback(
    (val: string) => {
      setTotalDividendInput(val);
      const totalNum = parseFloat(val);
      const qtyNum = parseFloat(quantity);
      if (!isNaN(totalNum) && !isNaN(qtyNum) && qtyNum > 0) {
        setPrice((totalNum / qtyNum).toFixed(4));
      }
    },
    [quantity]
  );

  const handlePerUnitDividendChange = useCallback(
    (val: string) => {
      setPrice(val);
      const priceNum = parseFloat(val);
      const qtyNum = parseFloat(quantity);
      if (!isNaN(priceNum) && !isNaN(qtyNum) && qtyNum > 0) {
        setTotalDividendInput((priceNum * qtyNum).toFixed(2));
      }
    },
    [quantity]
  );

  const handleQuantityChange = useCallback(
    (val: string) => {
      setQuantity(val);
      if (type === 'PROVENTO') {
        const qtyNum = parseFloat(val);
        if (proventoMode === 'TOTAL') {
          const totalNum = parseFloat(totalDividendInput);
          if (!isNaN(totalNum) && !isNaN(qtyNum) && qtyNum > 0) {
            setPrice((totalNum / qtyNum).toFixed(4));
          }
        } else {
          const priceNum = parseFloat(price);
          if (!isNaN(priceNum) && !isNaN(qtyNum) && qtyNum > 0) {
            setTotalDividendInput((priceNum * qtyNum).toFixed(2));
          }
        }
      }
    },
    [type, proventoMode, totalDividendInput, price]
  );

  // ── Cálculos de preview ────────────────────────────────────────────
  const numQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(price) || 0;
  const numFees = effectiveFees;

  const rawSubtotal = numQty * numPrice;
  const netTotal =
    type === 'COMPRA'
      ? rawSubtotal + numFees
      : type === 'VENDA'
      ? Math.max(0, rawSubtotal - numFees)
      : rawSubtotal;

  const simulatedNewAveragePrice = useMemo(() => {
    if (type !== 'COMPRA' || !currentPosition || numQty <= 0 || numPrice <= 0)
      return null;
    const currentCost = currentPosition.costBasis;
    const currentQty = currentPosition.quantity;
    const addedCost = rawSubtotal + numFees;
    const totalQty = currentQty + numQty;
    return totalQty > 0 ? (currentCost + addedCost) / totalQty : 0;
  }, [type, currentPosition, numQty, numPrice, rawSubtotal, numFees]);

  const simulatedRealizedPnl = useMemo(() => {
    if (type !== 'VENDA' || !currentPosition || numQty <= 0 || numPrice <= 0)
      return null;
    const costBasisSold = numQty * currentPosition.averagePrice;
    const grossReturn = rawSubtotal - numFees;
    const profitVal = grossReturn - costBasisSold;
    const profitPercent =
      costBasisSold > 0 ? (profitVal / costBasisSold) * 100 : 0;
    return {
      profitVal,
      profitPercent,
      costBasisSold,
      remainingQty: Math.max(0, currentPosition.quantity - numQty),
    };
  }, [type, currentPosition, numQty, numPrice, rawSubtotal, numFees]);

  const isSaleOverLimit =
    type === 'VENDA' && currentPosition && numQty > currentPosition.quantity;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (type === 'DEPOSITO' || type === 'RETIRADA') {
        const amt = parseFloat(price);
        if (isNaN(amt) || amt <= 0) {
          setError('Informe um valor válido em dinheiro (R$).');
          return;
        }

        setIsSubmitting(true);
        try {
          const saved = await onSave(
            {
              ticker: 'CAIXA',
              type,
              date,
              quantity: 1,
              price: amt,
              fees: 0,
              total: amt,
              notes: notes.trim() || (type === 'DEPOSITO' ? 'Depósito em Caixa' : 'Retirada de Caixa'),
            },
            editingTx?.id
          );
          if (saved !== false) {
            onClose();
          }
        } catch {
          setError('Erro ao salvar. Tente novamente.');
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      const cleanTicker = ticker.trim().toUpperCase();
      const qty = parseFloat(quantity);
      const prc = parseFloat(price);
      const feeVal = effectiveFees;

      if (!cleanTicker) {
        setError('Informe o código do ativo.');
        return;
      }
      if (
        type === 'VENDA' &&
        activePositions.length > 0 &&
        !currentPosition &&
        !editingTx
      ) {
        setError('Selecione um ativo da sua carteira para vender.');
        return;
      }
      if (isNaN(qty) || qty <= 0) {
        setError('Informe uma quantidade maior que zero.');
        return;
      }
      if (type === 'VENDA' && currentPosition && qty > currentPosition.quantity) {
        setError(
          `Quantidade informada (${qty}) é maior que o saldo em carteira (${currentPosition.quantity}).`
        );
        return;
      }
      if (isNaN(prc) || prc < 0) {
        setError('Informe um preço unitário válido.');
        return;
      }

      const totalCalculated =
        type === 'PROVENTO'
          ? prc * qty
          : qty * prc + (type === 'COMPRA' ? feeVal : -feeVal);

      if (type === 'COMPRA' && totalCalculated > cashBalance) {
        setError(
          `Saldo em caixa insuficiente (${formatBRL(cashBalance)}) para realizar esta compra de ${formatBRL(totalCalculated)}. Faça um depósito na aba Lançamentos.`
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const saved = await onSave(
          {
            ticker: cleanTicker,
            type,
            date,
            quantity: qty,
            price: prc,
            fees: feeVal,
            total: totalCalculated,
            notes: notes.trim(),
          },
          editingTx?.id
        );
        if (saved !== false) {
          onClose();
        }
      } catch {
        setError('Erro ao salvar. Tente novamente.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      ticker,
      quantity,
      price,
      effectiveFees,
      type,
      activePositions,
      currentPosition,
      editingTx,
      date,
      notes,
      onSave,
      onClose,
    ]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-5 text-white flex justify-between items-center transition-colors ${
            type === 'COMPRA'
              ? 'bg-slate-900 border-b-2 border-emerald-500'
              : type === 'VENDA'
              ? 'bg-slate-900 border-b-2 border-rose-500'
              : 'bg-slate-900 border-b-2 border-indigo-500'
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`p-1.5 rounded-lg text-white font-bold text-xs flex items-center gap-1 shrink-0 ${
                  type === 'COMPRA'
                    ? 'bg-emerald-600'
                    : type === 'VENDA'
                    ? 'bg-rose-600'
                    : 'bg-indigo-600'
                }`}
              >
                {type === 'COMPRA' && <ArrowUpRight className="w-4 h-4" />}
                {type === 'VENDA' && <ArrowDownRight className="w-4 h-4" />}
                {type === 'PROVENTO' && <DollarSign className="w-4 h-4" />}
                {type === 'COMPRA'
                  ? 'Compra'
                  : type === 'VENDA'
                  ? 'Venda'
                  : 'Dividendo'}
              </span>
              <h3 id="transaction-modal-title" className="font-bold text-base tracking-tight text-white truncate">
                {editingTx
                  ? 'Editar Lançamento'
                  : type === 'COMPRA'
                  ? 'Nova Compra'
                  : type === 'VENDA'
                  ? 'Nova Venda'
                  : type === 'PROVENTO'
                  ? 'Novo Dividendo'
                  : type === 'DEPOSITO'
                  ? 'Novo Depósito'
                  : 'Nova Retirada'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs">
          {/* Tipo de operação */}
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeChange('COMPRA')}
                className={`py-2 px-2 rounded-lg font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'COMPRA'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Compra</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('VENDA')}
                className={`py-2 px-2 rounded-lg font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'VENDA'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                <span>Venda</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('PROVENTO')}
                className={`py-2 px-2 rounded-lg font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'PROVENTO'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                <span>Dividendo</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('DEPOSITO')}
                className={`py-2 px-2 rounded-lg font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'DEPOSITO'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>Depósito</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('RETIRADA')}
                className={`py-2 px-2 rounded-lg font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                  type === 'RETIRADA'
                    ? 'bg-white text-orange-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wallet className="w-3.5 h-3.5 text-orange-600" />
                <span>Retirada</span>
              </button>
            </div>
          </div>

          {/* Saldo em Caixa Indicator for COMPRA, DEPOSITO, RETIRADA */}
          {(type === 'COMPRA' || type === 'DEPOSITO' || type === 'RETIRADA') && (
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              cashBalance > 0 
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-200' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>Saldo em caixa disponível: <strong className="font-mono">{formatBRLDecimal(cashBalance)}</strong></span>
              </div>
              {cashBalance <= 0 && type === 'COMPRA' && (
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  Sem saldo!
                </span>
              )}
            </div>
          )}

          {/* Centralized Global Fees Card (Collapsible) */}
          {type !== 'PROVENTO' && (
            <div className="bg-slate-50 dark:bg-zinc-900/40 border border-black/[0.06] dark:border-white/[0.08] rounded-xl p-3 space-y-2">
              <button
                type="button"
                onClick={() => setIsFeeConfigOpen(!isFeeConfigOpen)}
                className="w-full flex items-center justify-between text-slate-700 dark:text-zinc-300 font-bold hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <span className="text-xs">⚙️</span>
                  </span>
                  <span>Custos Operacionais Globais</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold font-mono bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded">
                    {globalFeeType === 'fixed' ? `Fixo: R$ ${parseFloat(globalFeeValue || '0').toFixed(2)}` : `Percentual: ${globalFeeValue || '0'}%`}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-zinc-400">
                    {isFeeConfigOpen ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              {isFeeConfigOpen && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/[0.04] dark:border-white/[0.04] animate-in fade-in duration-100">
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 dark:text-zinc-400 mb-1">
                      Tipo de Custo
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-200/80 dark:bg-zinc-800 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => handleSaveGlobalFees('fixed', globalFeeValue)}
                        className={`py-1 rounded font-bold text-xs text-center transition cursor-pointer ${
                          globalFeeType === 'fixed'
                            ? 'bg-white dark:bg-zinc-700 text-indigo-700 dark:text-white shadow-3xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Fixo (R$)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveGlobalFees('percent', globalFeeValue)}
                        className={`py-1 rounded font-bold text-xs text-center transition cursor-pointer ${
                          globalFeeType === 'percent'
                            ? 'bg-white dark:bg-zinc-700 text-indigo-700 dark:text-white shadow-3xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Percentual (%)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 dark:text-zinc-400 mb-1">
                      Valor da Taxa
                    </label>
                    <div className="relative">
                      {globalFeeType === 'fixed' && (
                        <span className="text-slate-600 dark:text-zinc-400 font-bold absolute left-2 top-1.5 pointer-events-none text-xs">
                          R$
                        </span>
                      )}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={globalFeeValue}
                        onChange={(e) => handleSaveGlobalFees(globalFeeType, e.target.value)}
                        placeholder="0.00"
                        className={`w-full py-1 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-white/[0.08] rounded-lg font-mono font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 transition text-xs text-center ${
                          globalFeeType === 'fixed' ? 'pl-5' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Seleção de ativo */}
          <div>
            {type === 'DEPOSITO' || type === 'RETIRADA' ? (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-blue-900 dark:text-blue-200">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-bold text-xs uppercase tracking-wider">
                      {type === 'DEPOSITO' ? 'Depósito de Saldo em Caixa' : 'Retirada de Saldo em Caixa'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-blue-700/80 dark:text-blue-300/80 font-medium">Saldo Atual: </span>
                    <strong className="font-mono text-xs text-blue-900 dark:text-blue-100">{formatBRLDecimal(cashBalance)}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Valor ({type === 'DEPOSITO' ? 'a depositar' : 'a retirar'}) R$:
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/[0.1] rounded-xl font-mono font-bold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Data
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/[0.1] rounded-xl font-medium text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : type === 'VENDA' ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Ativo da carteira:
                  </label>
                  <span className="text-xs text-slate-400">
                    {activePositions.length} em carteira
                  </span>
                </div>

                {activePositions.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-center space-y-2">
                    <p className="font-medium text-xs">
                      Nenhum ativo com saldo em carteira.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('COMPRA')}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-xs transition cursor-pointer"
                    >
                      Mudar para Compra
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {activePositions.map((pos) => {
                      const isSelected =
                        ticker.toUpperCase() === pos.ticker.toUpperCase();
                      return (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => handleSelectPortfolioAsset(pos)}
                          className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-400 text-rose-950 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-slate-900">
                              {pos.ticker}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-600 space-y-0.5">
                            <div>{pos.quantity} cotas</div>
                            <div className="text-xs text-slate-400 font-mono tabular-nums">
                              PM: {formatBRLDecimal(pos.averagePrice)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : type === 'PROVENTO' ? (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Código do Ativo:
                </label>

                {activePositions.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1.5 no-scrollbar mb-1.5">
                    {activePositions.map((pos) => {
                      const isSelected =
                        ticker.toUpperCase() === pos.ticker.toUpperCase();
                      return (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => handleSelectPortfolioAsset(pos)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-medium shrink-0 transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {pos.ticker} ({pos.quantity})
                        </button>
                      );
                    })}
                  </div>
                )}

                <TickerAutocomplete
                  value={ticker}
                  onChange={setTicker}
                  onSelectResult={(item) => {
                    setTicker(item.ticker);
                    const pos = activePositions.find(
                      (p) => p.ticker === item.ticker
                    );
                    if (pos) setQuantity(String(pos.quantity));
                  }}
                  placeholder="Ex: PETR4, MXRF11, VALE3..."
                />
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Código do Ativo:
                </label>

                {activePositions.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1.5 no-scrollbar mb-1.5">
                    {activePositions.map((pos) => {
                      const isSelected =
                        ticker.toUpperCase() === pos.ticker.toUpperCase();
                      return (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => handleSelectPortfolioAsset(pos)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-medium shrink-0 transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {pos.ticker}
                        </button>
                      );
                    })}
                  </div>
                )}

                <TickerAutocomplete
                  value={ticker}
                  onChange={setTicker}
                  onSelectResult={(item) => {
                    setTicker(item.ticker);
                    if (
                      item.price &&
                      item.price > 0 &&
                      (!price || parseFloat(price) === 0)
                    ) {
                      setPrice(item.price.toFixed(2));
                    }
                  }}
                  placeholder={
                    investorProfile === 'FIIS'
                      ? 'Ex: MXRF11, HGLG11, XPML11, KNCR11...'
                      : investorProfile === 'STOCKS'
                      ? 'Ex: PETR4, VALE3, ITUB4, WEGE3...'
                      : investorProfile === 'CRYPTO'
                      ? 'Ex: BTC, ETH, SOL, BNB, ADA...'
                      : 'Ex: PETR4, VALE3, MXRF11, BTC...'
                  }
                />

                {/* Atalhos Rápidos por Perfil de Investidor */}
                {type === 'COMPRA' && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-2 no-scrollbar">
                    <span className="text-xs text-slate-600 dark:text-zinc-400 font-semibold self-center shrink-0">
                      Populares ({investorProfile === 'FIIS' ? 'FIIs' : investorProfile === 'STOCKS' ? 'Ações' : investorProfile === 'CRYPTO' ? 'Cripto' : 'Dyeldi'}):
                    </span>
                    {popularTickersList.slice(0, 7).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setTicker(t);
                          const q = combinedQuotes[t];
                          if (q?.price) setPrice(q.price.toFixed(2));
                        }}
                        className={`px-2 py-0.5 rounded text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                          ticker.toUpperCase() === t
                            ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950 font-bold'
                            : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {loadingLocalQuote && (
            <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium px-2.5 py-1 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100/60 dark:border-indigo-900/40 animate-pulse w-max">
              <span className="w-2.5 h-2.5 border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span>Buscando cotação...</span>
            </div>
          )}

          {/* Badge da posição atual ou cotação ativa se não houver posição */}
          {currentPosition ? (
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                type === 'VENDA'
                  ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                  : type === 'COMPRA'
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                  : 'bg-indigo-50/60 border-indigo-200 text-indigo-950'
              }`}
            >
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {currentPosition.ticker}: {currentPosition.quantity} cotas
                </span>
                <span className="text-slate-600 dark:text-zinc-400 ml-1.5 tabular-nums text-xs">
                  (PM {formatBRLDecimal(currentPosition.averagePrice)})
                </span>
              </div>
              <div className="text-right flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatBRLDecimal(
                    combinedQuotes[currentPosition.ticker]?.price ||
                      currentPosition.currentPrice
                  )}
                </span>
                {(type === 'COMPRA' || type === 'VENDA') && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = combinedQuotes[currentPosition.ticker]?.price || currentPosition.currentPrice;
                      if (p > 0) setPrice(p.toFixed(2));
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                  >
                    Usar cotação
                  </button>
                )}
              </div>
            </div>
          ) : (
            activeQuote && (
              <div className="p-2.5 bg-zinc-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {activeQuote.ticker}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-zinc-400 ml-1.5">
                    {activeQuote.name}
                  </span>
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-950 dark:text-white tabular-nums">
                    {formatBRLDecimal(activeQuote.price)}
                  </span>
                  {(type === 'COMPRA' || type === 'VENDA') && (
                    <button
                      type="button"
                      onClick={() => setPrice(activeQuote.price.toFixed(2))}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                    >
                      Usar cotação
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {/* Data + Quantidade */}
          {type !== 'DEPOSITO' && type !== 'RETIRADA' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Data
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-700 dark:text-slate-300">
                    Quantidade
                  </label>
                  {type === 'VENDA' && currentPosition && (
                    <span className="text-xs text-rose-700 font-medium tabular-nums">
                      Saldo: {currentPosition.quantity}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="number"
                    step={isCrypto ? "any" : "1"}
                    min={isCrypto ? "0.00000001" : "1"}
                    max={
                      type === 'VENDA' && currentPosition
                        ? currentPosition.quantity
                        : undefined
                    }
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    placeholder={isCrypto ? "Ex: 0.005" : "Ex: 100"}
                    className={`w-full pl-9 pr-3 py-2 bg-slate-50 border rounded-xl font-medium text-slate-900 focus:ring-2 focus:bg-white transition ${
                      isSaleOverLimit
                        ? 'border-rose-400 ring-2 ring-rose-500/30'
                        : 'border-slate-300 focus:ring-indigo-500'
                    }`}
                  />
                </div>

                {type === 'VENDA' && currentPosition && (
                  <div className="flex gap-1 mt-1.5">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleSetSalePercent(pct)}
                        className={`flex-1 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                          pct === 100
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {pct === 100 ? 'Tudo (100%)' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preço / Provento */}
          {type !== 'DEPOSITO' && type !== 'RETIRADA' && (
            type === 'PROVENTO' ? (
              <div className="space-y-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-900 text-xs">
                  Valores:
                </span>
                <div className="flex bg-white rounded-lg p-0.5 border border-indigo-200 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setProventoMode('TOTAL')}
                    className={`px-2 py-0.5 rounded ${
                      proventoMode === 'TOTAL'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    Valor Total (R$)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProventoMode('PER_UNIT')}
                    className={`px-2 py-0.5 rounded ${
                      proventoMode === 'PER_UNIT'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    Por Cota (R$)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Valor Total (R$)
                  </label>
                  <div className="relative">
                    <span className="text-slate-500 font-medium absolute left-3 top-2 pointer-events-none">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalDividendInput}
                      onChange={(e) =>
                        handleTotalDividendChange(e.target.value)
                      }
                      placeholder="Ex: 150.00"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-indigo-200 rounded-xl font-mono font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 transition tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Valor por Cota (R$)
                  </label>
                  <div className="relative">
                    <span className="text-slate-500 font-medium absolute left-3 top-2 pointer-events-none">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={price}
                      onChange={(e) =>
                        handlePerUnitDividendChange(e.target.value)
                      }
                      placeholder="Ex: 0.85"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-indigo-200 rounded-xl font-mono font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 transition tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 block mb-1">
                  Tipo:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PROVENTO_TYPES.map((pt) => (
                    <button
                      key={pt.label}
                      type="button"
                      onClick={() => setNotes(pt.note)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                        notes === pt.note
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Preço Unitário (R$)
                  </label>
                  {activeQuote && (
                    <button
                      type="button"
                      onClick={() => setPrice(activeQuote.price.toFixed(2))}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                    >
                      Usar cotação ({formatBRLDecimal(activeQuote.price)})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="text-slate-400 font-medium absolute left-3 top-2 pointer-events-none">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex: 35.20"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition tabular-nums"
                  />
                </div>
              </div>
            )
          )}



          {/* Observação */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Observação <span className="text-slate-400 text-xs font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Aporte mensal, rebalanceamento..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Resumo */}
          {numQty > 0 && numPrice > 0 && (
            <div
              className={`p-3 rounded-xl border space-y-1.5 ${
                type === 'COMPRA'
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-500/30'
                  : type === 'VENDA'
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950 dark:bg-rose-950/20 dark:border-rose-500/30'
                  : 'bg-indigo-50/70 border-indigo-200 text-indigo-950 dark:bg-indigo-950/20 dark:border-indigo-500/30'
              }`}
            >
              <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatBRLDecimal(rawSubtotal)}
                </span>
              </div>

              {effectiveFees > 0 && (
                <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                  <span>Custo Operacional:</span>
                  <span className="font-mono font-semibold tabular-nums text-red-500 dark:text-red-400">
                    +{formatBRLDecimal(effectiveFees)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-1.5 border-t border-black/[0.06] dark:border-white/[0.08]">
                <span className="font-bold text-slate-800 dark:text-zinc-200">
                  Total Geral:
                </span>
                <span className="font-mono font-extrabold text-sm text-slate-950 dark:text-white tabular-nums">
                  {formatBRLDecimal(netTotal)}
                </span>
              </div>

              {type === 'COMPRA' && simulatedNewAveragePrice !== null && (
                <div className="pt-1.5 border-t border-emerald-200/70 flex items-center justify-between text-xs">
                  <span className="text-emerald-900">
                    Novo Preço Médio:
                  </span>
                  <span className="font-mono font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-300 tabular-nums">
                    {formatBRLDecimal(simulatedNewAveragePrice)}
                  </span>
                </div>
              )}

              {type === 'VENDA' && simulatedRealizedPnl !== null && (
                <div className="pt-1.5 border-t border-rose-200/70 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-rose-900">
                      Resultado:
                    </span>
                    <span
                      className={`font-mono font-semibold px-2 py-0.5 rounded border tabular-nums ${
                        simulatedRealizedPnl.profitVal >= 0
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}
                    >
                      {simulatedRealizedPnl.profitVal >= 0 ? '+' : ''}
                      {formatBRLDecimal(simulatedRealizedPnl.profitVal)} (
                      {simulatedRealizedPnl.profitPercent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                    <span>Saldo restante:</span>
                    <span className="font-medium tabular-nums">
                      {simulatedRealizedPnl.remainingQty} {isCrypto ? 'unidades' : 'cotas'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Avisos de validação */}
          {isSaleOverLimit && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Quantidade maior que o saldo em carteira ({currentPosition?.quantity} cotas).
              </span>
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition cursor-pointer text-xs"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                !!isSaleOverLimit ||
                !ticker.trim() ||
                numQty <= 0
              }
              className={`px-5 py-2 text-white font-semibold rounded-xl transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer text-xs ${
                type === 'COMPRA'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : type === 'VENDA'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {editingTx
                      ? 'Salvar'
                      : type === 'COMPRA'
                      ? 'Salvar Compra'
                      : type === 'VENDA'
                      ? 'Salvar Venda'
                      : 'Salvar Provento'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}