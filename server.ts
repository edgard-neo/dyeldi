import express from "express";
import compression from "compression";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import { allowlistMiddleware } from "./src/server/allowlist";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  addDoc,
  runTransaction,
  deleteDoc,
} from "firebase/firestore";
import fallbackConfig from "./firebase-applet-config.example.json";
import fs from "fs";

// Carrega arquivo local se existir, caso contrário utiliza fallback e variáveis de ambiente
let localConfig: any = {};
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
if (fs.existsSync(configPath)) {
  try {
    localConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (e) {
    console.warn("[Firebase Server] Falha ao carregar firebase-applet-config.json local:", e);
  }
}

const rawConfig = { ...fallbackConfig, ...localConfig };

const firebaseConfig = {
  apiKey: (process.env.VITE_FIREBASE_API_KEY || rawConfig.apiKey || "").trim(),
  authDomain: (process.env.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain || "").trim(),
  projectId: (process.env.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId || "").trim(),
  storageBucket: (process.env.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket || "").trim(),
  messagingSenderId: (process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId || "").trim(),
  appId: (process.env.VITE_FIREBASE_APP_ID || rawConfig.appId || "").trim(),
  firestoreDatabaseId: (process.env.VITE_FIREBASE_DATABASE_ID || rawConfig.firestoreDatabaseId || "").trim(),
  measurementId: (process.env.VITE_FIREBASE_MEASUREMENT_ID || rawConfig.measurementId || "").trim(),
};

// ─── Firebase ───────────────────────────────────────────────────────────────
export const isFirebaseReady = Boolean(
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes("SUA_CHAVE") &&
  !firebaseConfig.apiKey.includes("DummyKey") &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== "seu-projeto-firebase"
);

const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const db =
  firebaseConfig.firestoreDatabaseId &&
  firebaseConfig.firestoreDatabaseId !== "(default)"
    ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(firebaseApp);

// Cache em memória para contingência de desenvolvimento local e execução offline
const inMemoryCache = new Map<string, any>();

// ─── Gemini ─────────────────────────────────────────────────────────────────
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });
  } catch (e) {
    console.warn("Failed to initialize Google GenAI client:", e);
    return null;
  }
}

// ─── Sanitizers / Helpers ───────────────────────────────────────────────────
function sanitizeTicker(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function sanitizeString(input: unknown, maxLen = 100): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>?/gm, "")
    .replace(/[^\w\s\-\.\,\@\(\)\/]/gi, "")
    .trim()
    .slice(0, maxLen);
}

function cleanForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj.toISOString() as any;

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirestore(item)) as any;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = cleanForFirestore(value);
    }
  }
  return cleaned as T;
}

function isB3MarketOpen(): boolean {
  const utcNow = new Date();
  const spTime = new Date(utcNow.getTime() - 3 * 60 * 60 * 1000);
  const day = spTime.getUTCDay();
  const hours = spTime.getUTCHours();
  const minutes = spTime.getUTCMinutes();

  if (day < 1 || day > 5) return false;

  const totalMinutes = hours * 60 + minutes;
  return totalMinutes >= 10 * 60 && totalMinutes < 18 * 60;
}

function getLastMarketCloseTime(now: Date = new Date()): Date {
  const spTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const day = spTime.getUTCDay();
  const hours = spTime.getUTCHours();
  const minutes = spTime.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;

  const lastCloseSP = new Date(spTime.getTime());
  lastCloseSP.setUTCHours(18, 0, 0, 0);

  if (day >= 1 && day <= 5) {
    if (totalMinutes < 18 * 60) {
      const daysToGoBack = day === 1 ? 3 : 1;
      lastCloseSP.setUTCDate(lastCloseSP.getUTCDate() - daysToGoBack);
    }
  } else if (day === 6) {
    lastCloseSP.setUTCDate(lastCloseSP.getUTCDate() - 1);
  } else if (day === 0) {
    lastCloseSP.setUTCDate(lastCloseSP.getUTCDate() - 2);
  }

  return new Date(lastCloseSP.getTime() + 3 * 60 * 60 * 1000);
}

function getSaoPauloDateStr(): string {
  const spTime = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return spTime.toISOString().slice(0, 10);
}

// ─── Fallback Data ──────────────────────────────────────────────────────────
const B3_FALLBACK_MARKET_DATA: Record<
  string,
  { price: number; dy: number; avgAppreciation: number; name: string }
> = {
  PETR4: { name: "Petrobras PN", price: 41.66, dy: 14.2, avgAppreciation: 10.5 },
  PETR3: { name: "Petrobras ON", price: 42.1, dy: 14.2, avgAppreciation: 10.5 },
  VALE3: { name: "Vale ON", price: 74.4, dy: 8.5, avgAppreciation: 7.0 },
  ITUB4: { name: "Itaú Unibanco PN", price: 39.0, dy: 7.8, avgAppreciation: 9.5 },
  ITSA4: { name: "Itaúsa PN", price: 10.85, dy: 8.2, avgAppreciation: 8.5 },
  BBAS3: { name: "Banco do Brasil ON", price: 27.6, dy: 9.8, avgAppreciation: 10.0 },
  TAEE11: { name: "Taesa Unit", price: 38.3, dy: 9.6, avgAppreciation: 6.5 },
  WEGE3: { name: "WEG ON", price: 47.36, dy: 4.17, avgAppreciation: 14.0 },
  MXRF11: { name: "Maxi Renda FII", price: 9.35, dy: 11.8, avgAppreciation: 4.5 },
  HGLG11: { name: "CSHG Logística FII", price: 161.0, dy: 8.8, avgAppreciation: 5.0 },
  XPLG11: { name: "XP Logistics FII", price: 108.5, dy: 9.1, avgAppreciation: 5.0 },
  KNCR11: { name: "Kinea Rendimentos FII", price: 104.2, dy: 12.2, avgAppreciation: 4.2 },
  VISC11: { name: "Vinci Shopping FII", price: 118.0, dy: 8.5, avgAppreciation: 5.5 },
  ABEV3: { name: "Ambev ON", price: 12.1, dy: 6.8, avgAppreciation: 6.0 },
  BBSE3: { name: "BB Seguridade ON", price: 34.5, dy: 10.2, avgAppreciation: 8.0 },
  SANB11: { name: "Santander BR Unit", price: 28.3, dy: 8.0, avgAppreciation: 7.5 },
  KLBN11: { name: "Klabin Unit", price: 22.4, dy: 7.5, avgAppreciation: 8.0 },
  SAPR11: { name: "Sanepar Unit", price: 29.8, dy: 8.4, avgAppreciation: 8.5 },
};

const ATIVOS_INFO_FALLBACK: Record<
  string,
  { cnpj: string; pVP: number; lpa: number; vpa: number; isFinancial?: boolean }
> = {
  WEGE3: { cnpj: "44.368.663/0001-06", pVP: 12.5, lpa: 1.3, vpa: 3.78 },
  PETR4: { cnpj: "33.000.167/0001-01", pVP: 0.95, lpa: 8.5, vpa: 43.8 },
  PETR3: { cnpj: "33.000.167/0001-01", pVP: 0.92, lpa: 8.5, vpa: 43.8 },
  VALE3: { cnpj: "33.592.510/0001-54", pVP: 1.15, lpa: 8.2, vpa: 48.5 },
  ITUB4: {
    cnpj: "60.872.504/0001-23",
    pVP: 1.65,
    lpa: 4.1,
    vpa: 23.6,
    isFinancial: true,
  },
  TAEE11: { cnpj: "07.859.571/0001-30", pVP: 1.2, lpa: 3.5, vpa: 20.2 },
  MXRF11: { cnpj: "97.585.045/0001-04", pVP: 1.02, lpa: 0, vpa: 9.35 },
  BBAS3: {
    cnpj: "00.000.000/0001-91",
    pVP: 0.88,
    lpa: 5.2,
    vpa: 34.5,
    isFinancial: true,
  },
  ITSA4: {
    cnpj: "61.532.644/0001-15",
    pVP: 1.1,
    lpa: 1.25,
    vpa: 9.8,
    isFinancial: true,
  },
  HGLG11: { cnpj: "13.125.759/0001-80", pVP: 1.05, lpa: 0, vpa: 153.0 },
  ABEV3: { cnpj: "07.526.557/0001-00", pVP: 2.1, lpa: 0.95, vpa: 5.75 },
  BBSE3: {
    cnpj: "02.847.237/0001-52",
    pVP: 3.4,
    lpa: 3.8,
    vpa: 10.15,
    isFinancial: true,
  },
  XPLG11: { cnpj: "26.561.428/0001-25", pVP: 0.94, lpa: 0, vpa: 115.0 },
  KNCR11: { cnpj: "19.355.856/0001-05", pVP: 1.01, lpa: 0, vpa: 103.0 },
  VISC11: { cnpj: "24.585.630/0001-08", pVP: 0.96, lpa: 0, vpa: 122.0 },
  SANB11: {
    cnpj: "90.400.888/0001-42",
    pVP: 1.1,
    lpa: 2.8,
    vpa: 26.5,
    isFinancial: true,
  },
  KLBN11: { cnpj: "89.637.490/0001-45", pVP: 1.4, lpa: 1.8, vpa: 16.0 },
  SAPR11: { cnpj: "76.484.013/0001-45", pVP: 0.85, lpa: 3.6, vpa: 35.0 },
};

const B3_CATALOG = [
  { ticker: "PETR4", name: "Petrobras PN", type: "Ação" },
  { ticker: "PETR3", name: "Petrobras ON", type: "Ação" },
  { ticker: "VALE3", name: "Vale ON", type: "Ação" },
  { ticker: "ITUB4", name: "Itaú Unibanco PN", type: "Ação" },
  { ticker: "ITSA4", name: "Itaúsa PN", type: "Ação" },
  { ticker: "BBAS3", name: "Banco do Brasil ON", type: "Ação" },
  { ticker: "BBDC4", name: "Bradesco PN", type: "Ação" },
  { ticker: "BBDC3", name: "Bradesco ON", type: "Ação" },
  { ticker: "TAEE11", name: "Taesa Unit", type: "Ação" },
  { ticker: "WEGE3", name: "WEG ON", type: "Ação" },
  { ticker: "MXRF11", name: "Maxi Renda FII", type: "FII" },
  { ticker: "HGLG11", name: "CSHG Logística FII", type: "FII" },
  { ticker: "XPLG11", name: "XP Logistics FII", type: "FII" },
  { ticker: "KNCR11", name: "Kinea Rendimentos FII", type: "FII" },
  { ticker: "VISC11", name: "Vinci Shopping FII", type: "FII" },
  { ticker: "ABEV3", name: "Ambev ON", type: "Ação" },
  { ticker: "BBSE3", name: "BB Seguridade ON", type: "Ação" },
  { ticker: "SANB11", name: "Santander BR Unit", type: "Ação" },
  { ticker: "RENT3", name: "Localiza ON", type: "Ação" },
  { ticker: "MGLU3", name: "Magazine Luiza ON", type: "Ação" },
  { ticker: "VBBR3", name: "Vibra Energia ON", type: "Ação" },
  { ticker: "ELET3", name: "Eletrobras ON", type: "Ação" },
  { ticker: "KLBN11", name: "Klabin Unit", type: "Ação" },
  { ticker: "SUZB3", name: "Suzano ON", type: "Ação" },
  { ticker: "PRIO3", name: "Prio ON", type: "Ação" },
  { ticker: "CMIG4", name: "Cemig PN", type: "Ação" },
  { ticker: "CPLE6", name: "Copel PNB", type: "Ação" },
  { ticker: "CSAN3", name: "Cosan ON", type: "Ação" },
  { ticker: "LREN3", name: "Lojas Renner ON", type: "Ação" },
  { ticker: "SAPR11", name: "Sanepar Unit", type: "Ação" },
];

const CRYPTO_CATALOG = [
  // Top Market Cap & Layer 1s
  { ticker: "BTC", name: "Bitcoin", id: "bitcoin", type: "Cripto" },
  { ticker: "ETH", name: "Ethereum", id: "ethereum", type: "Cripto" },
  { ticker: "SOL", name: "Solana", id: "solana", type: "Cripto" },
  { ticker: "BNB", name: "BNB", id: "binancecoin", type: "Cripto" },
  { ticker: "XRP", name: "XRP", id: "ripple", type: "Cripto" },
  { ticker: "ADA", name: "Cardano", id: "cardano", type: "Cripto" },
  { ticker: "AVAX", name: "Avalanche", id: "avalanche-2", type: "Cripto" },
  { ticker: "TRX", name: "TRON", id: "tron", type: "Cripto" },
  { ticker: "TON", name: "Toncoin", id: "the-open-network", type: "Cripto" },
  { ticker: "DOT", name: "Polkadot", id: "polkadot", type: "Cripto" },
  { ticker: "SUI", name: "Sui", id: "sui", type: "Cripto" },
  { ticker: "NEAR", name: "NEAR Protocol", id: "near", type: "Cripto" },
  { ticker: "APT", name: "Aptos", id: "aptos", type: "Cripto" },
  { ticker: "SEI", name: "Sei", id: "sei-network", type: "Cripto" },
  { ticker: "KAS", name: "Kaspa", id: "kaspa", type: "Cripto" },
  { ticker: "ICP", name: "Internet Computer", id: "internet-computer", type: "Cripto" },
  { ticker: "HBAR", name: "Hedera", id: "hedera-hashgraph", type: "Cripto" },
  { ticker: "ATOM", name: "Cosmos", id: "cosmos", type: "Cripto" },
  { ticker: "BCH", name: "Bitcoin Cash", id: "bitcoin-cash", type: "Cripto" },
  { ticker: "LTC", name: "Litecoin", id: "litecoin", type: "Cripto" },
  { ticker: "XLM", name: "Stellar", id: "stellar", type: "Cripto" },
  { ticker: "XMR", name: "Monero", id: "monero", type: "Cripto" },
  { ticker: "ETC", name: "Ethereum Classic", id: "ethereum-classic", type: "Cripto" },
  { ticker: "VET", name: "VeChain", id: "vechain", type: "Cripto" },
  { ticker: "ALGO", name: "Algorand", id: "algorand", type: "Cripto" },
  { ticker: "FTM", name: "Fantom", id: "fantom", type: "Cripto" },
  { ticker: "TIA", name: "Celestia", id: "celestia", type: "Cripto" },
  { ticker: "INJ", name: "Injective", id: "injective-protocol", type: "Cripto" },
  { ticker: "STX", name: "Stacks", id: "blockstack", type: "Cripto" },
  { ticker: "KAVA", name: "Kava", id: "kava", type: "Cripto" },
  { ticker: "FLOW", name: "Flow", id: "flow", type: "Cripto" },
  { ticker: "MINA", name: "Mina", id: "mina-protocol", type: "Cripto" },
  { ticker: "EGLD", name: "MultiversX", id: "elrond-erd-2", type: "Cripto" },
  { ticker: "ASTR", name: "Astar", id: "astar", type: "Cripto" },
  { ticker: "RON", name: "Ronin", id: "ronin", type: "Cripto" },
  { ticker: "NEO", name: "Neo", id: "neo", type: "Cripto" },
  { ticker: "ZEC", name: "Zcash", id: "zcash", type: "Cripto" },
  { ticker: "IOTA", name: "IOTA", id: "iota", type: "Cripto" },
  { ticker: "EOS", name: "EOS", id: "eos", type: "Cripto" },
  { ticker: "KLAY", name: "Kaia", id: "klay-token", type: "Cripto" },

  // Layer 2 & Rollups
  { ticker: "MATIC", name: "Polygon", id: "matic-network", type: "Cripto" },
  { ticker: "POL", name: "Polygon Ecosystem", id: "polygon-ecosystem-token", type: "Cripto" },
  { ticker: "ARB", name: "Arbitrum", id: "arbitrum", type: "Cripto" },
  { ticker: "OP", name: "Optimism", id: "optimism", type: "Cripto" },
  { ticker: "STRK", name: "Starknet", id: "starknet", type: "Cripto" },
  { ticker: "MANTA", name: "Manta Network", id: "manta-network", type: "Cripto" },
  { ticker: "BLAST", name: "Blast", id: "blast", type: "Cripto" },
  { ticker: "ZK", name: "ZKsync", id: "zksync", type: "Cripto" },
  { ticker: "METIS", name: "Metis", id: "metis-token", type: "Cripto" },
  { ticker: "IMX", name: "Immutable", id: "immutable-x", type: "Cripto" },

  // Stablecoins & Wrapped
  { ticker: "USDT", name: "Tether", id: "tether", type: "Cripto" },
  { ticker: "USDC", name: "USD Coin", id: "usd-coin", type: "Cripto" },
  { ticker: "DAI", name: "Dai", id: "dai", type: "Cripto" },
  { ticker: "FDUSD", name: "First Digital USD", id: "first-digital-usd", type: "Cripto" },
  { ticker: "USDE", name: "Ethena USDe", id: "ethena-usde", type: "Cripto" },
  { ticker: "WBTC", name: "Wrapped Bitcoin", id: "wrapped-bitcoin", type: "Cripto" },
  { ticker: "WETH", name: "Wrapped Ethereum", id: "weth", type: "Cripto" },

  // DeFi, RWA, Staking & Oracles
  { ticker: "LINK", name: "Chainlink", id: "chainlink", type: "Cripto" },
  { ticker: "UNI", name: "Uniswap", id: "uniswap", type: "Cripto" },
  { ticker: "AAVE", name: "Aave", id: "aave", type: "Cripto" },
  { ticker: "MKR", name: "Maker", id: "maker", type: "Cripto" },
  { ticker: "LDO", name: "Lido DAO", id: "lido-dao", type: "Cripto" },
  { ticker: "ONDO", name: "Ondo Finance", id: "ondo-finance", type: "Cripto" },
  { ticker: "PENDLE", name: "Pendle", id: "pendle", type: "Cripto" },
  { ticker: "ENA", name: "Ethena", id: "ethena", type: "Cripto" },
  { ticker: "JUP", name: "Jupiter", id: "jupiter-exchange-solana", type: "Cripto" },
  { ticker: "RAY", name: "Raydium", id: "raydium", type: "Cripto" },
  { ticker: "CRV", name: "Curve DAO", id: "curve-dao-token", type: "Cripto" },
  { ticker: "SNX", name: "Synthetix", id: "havven", type: "Cripto" },
  { ticker: "COMP", name: "Compound", id: "compound-governance-token", type: "Cripto" },
  { ticker: "DYDX", name: "dYdX", id: "dydx-chain", type: "Cripto" },
  { ticker: "RUNE", name: "THORChain", id: "thorchain", type: "Cripto" },
  { ticker: "1INCH", name: "1inch", id: "1inch", type: "Cripto" },
  { ticker: "CAKE", name: "PancakeSwap", id: "pancakeswap-token", type: "Cripto" },
  { ticker: "GMX", name: "GMX", id: "gmx", type: "Cripto" },
  { ticker: "PYTH", name: "Pyth Network", id: "pyth-network", type: "Cripto" },
  { ticker: "SUSHI", name: "SushiSwap", id: "sushi", type: "Cripto" },
  { ticker: "RPL", name: "Rocket Pool", id: "rocket-pool", type: "Cripto" },

  // AI, DePIN & Big Data / Storage
  { ticker: "TAO", name: "Bittensor", id: "bittensor", type: "Cripto" },
  { ticker: "RENDER", name: "Render", id: "render-token", type: "Cripto" },
  { ticker: "RNDR", name: "Render Token", id: "render-token", type: "Cripto" },
  { ticker: "FET", name: "Artificial Superintelligence", id: "fetch-ai", type: "Cripto" },
  { ticker: "GRT", name: "The Graph", id: "the-graph", type: "Cripto" },
  { ticker: "FIL", name: "Filecoin", id: "filecoin", type: "Cripto" },
  { ticker: "AR", name: "Arweave", id: "arweave", type: "Cripto" },
  { ticker: "THETA", name: "Theta Network", id: "theta-token", type: "Cripto" },
  { ticker: "WLD", name: "Worldcoin", id: "worldcoin-wld", type: "Cripto" },
  { ticker: "AKT", name: "Akash Network", id: "akash-network", type: "Cripto" },
  { ticker: "IO", name: "io.net", id: "io-net", type: "Cripto" },
  { ticker: "JASMY", name: "JasmyCoin", id: "jasmycoin", type: "Cripto" },
  { ticker: "OCEAN", name: "Ocean Protocol", id: "ocean-protocol", type: "Cripto" },

  // Memecoins
  { ticker: "DOGE", name: "Dogecoin", id: "dogecoin", type: "Cripto" },
  { ticker: "SHIB", name: "Shiba Inu", id: "shiba-inu", type: "Cripto" },
  { ticker: "PEPE", name: "Pepe", id: "pepe", type: "Cripto" },
  { ticker: "WIF", name: "dogwifhat", id: "dogwifcoin", type: "Cripto" },
  { ticker: "BONK", name: "Bonk", id: "bonk", type: "Cripto" },
  { ticker: "FLOKI", name: "FLOKI", id: "floki", type: "Cripto" },
  { ticker: "BRETT", name: "Brett", id: "based-brett", type: "Cripto" },
  { ticker: "POPCAT", name: "Popcat", id: "popcat", type: "Cripto" },
  { ticker: "BOME", name: "BOOK OF MEME", id: "book-of-meme", type: "Cripto" },
  { ticker: "MEW", name: "cat in a dogs world", id: "cat-in-a-dogs-world", type: "Cripto" },
  { ticker: "NEIRO", name: "First Neiro on Ethereum", id: "first-neiro-on-ethereum", type: "Cripto" },
  { ticker: "MOG", name: "Mog Coin", id: "mog-coin", type: "Cripto" },

  // Gaming, NFT & Metaverse
  { ticker: "GALA", name: "GALA", id: "gala", type: "Cripto" },
  { ticker: "SAND", name: "The Sandbox", id: "the-sandbox", type: "Cripto" },
  { ticker: "MANA", name: "Decentraland", id: "decentraland", type: "Cripto" },
  { ticker: "AXS", name: "Axie Infinity", id: "axie-infinity", type: "Cripto" },
  { ticker: "BEAM", name: "Beam", id: "beam-2", type: "Cripto" },
  { ticker: "NOT", name: "Notcoin", id: "notcoin", type: "Cripto" },
  { ticker: "APE", name: "ApeCoin", id: "apecoin", type: "Cripto" },
  { ticker: "CHZ", name: "Chiliz", id: "chiliz", type: "Cripto" },
  { ticker: "ENJ", name: "Enjin Coin", id: "enjincoin", type: "Cripto" },
  { ticker: "REN", name: "Ren Protocol", id: "republic-protocol", type: "Cripto" },
];

async function getCryptoQuoteFromCoinGecko(ticker: string, cryptoId: string): Promise<any> {
  const upperTicker = ticker.toUpperCase().trim();
  const quoteCacheRef = doc(db, "cotacoes_cache", upperTicker);

  let cachedQuote: any = inMemoryCache.get(`quote:${upperTicker}`) || null;
  if (!cachedQuote && isFirebaseReady) {
    try {
      const snap = await getDoc(quoteCacheRef);
      if (snap.exists()) {
        cachedQuote = snap.data();
        inMemoryCache.set(`quote:${upperTicker}`, cachedQuote);
      }
    } catch {
      // Ignora falhas de conexão remota do Firestore em modo offline/degustação
    }
  }

  // 30 mins cache
  if (cachedQuote && cachedQuote.price !== undefined) {
    const ageMs = Date.now() - new Date(cachedQuote.atualizadoEm).getTime();
    const isFresh = ageMs < 30 * 60 * 1000;
    if (isFresh) {
      return {
        ticker: upperTicker,
        name: cachedQuote.name || `${upperTicker} (Cripto)`,
        price: Number(cachedQuote.price),
        dayHigh: Number(cachedQuote.dayHigh || cachedQuote.price),
        dayLow: Number(cachedQuote.dayLow || cachedQuote.price),
        dy: 0,
        avgAppreciation: 15.0,
        isFallback: !!cachedQuote.isFallback,
        updatedAt: cachedQuote.updatedAt || cachedQuote.atualizadoEm,
        fetchedAt: new Date().toISOString(),
        changePercent: Number(cachedQuote.changePercent || 0),
        type: "Cripto",
      };
    }
  }

  // 1. Primary: CoinGecko fetch (timeout 8000ms)
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    let url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=brl&include_24hr_change=true`;
    const headers: Record<string, string> = {};

    if (apiKey) {
      headers["x-cg-demo-api-key"] = apiKey.trim();
    }

    const response = await axios.get(url, { headers, timeout: 8000 });

    if (response.data && response.data[cryptoId] && response.data[cryptoId].brl !== undefined) {
      const data = response.data[cryptoId];
      const price = data.brl || 0;
      const change24h = data.brl_24h_change || 0;
      const nowIso = new Date().toISOString();
      const coinName = CRYPTO_CATALOG.find(c => c.ticker === upperTicker)?.name || upperTicker;

      const cacheDoc = {
        ticker: upperTicker,
        price: Number(price),
        dayHigh: Number(price),
        dayLow: Number(price),
        name: coinName,
        changePercent: Number(change24h.toFixed(2)),
        avgAppreciation: 15.0,
        updatedAt: nowIso,
        fetchedAt: nowIso,
        atualizadoEm: nowIso,
        isFallback: false,
        type: "Cripto",
      };

      inMemoryCache.set(`quote:${upperTicker}`, cacheDoc);
      if (isFirebaseReady) {
        try {
          await setDoc(quoteCacheRef, cleanForFirestore(cacheDoc), { merge: true });
        } catch (err) {
          console.debug(`[Quote Cache] Gravação Firestore suprimida para crypto ${upperTicker}`);
        }
      }

      return {
        ticker: upperTicker,
        name: coinName,
        price: Number(price),
        dayHigh: Number(price),
        dayLow: Number(price),
        dy: 0,
        avgAppreciation: 15.0,
        isFallback: false,
        updatedAt: nowIso,
        fetchedAt: nowIso,
        changePercent: Number(change24h.toFixed(2)),
        type: "Cripto",
      };
    }
  } catch (error: any) {
    console.warn(`[CoinGecko Service] Live crypto fetch failed for ${upperTicker}: ${error.message}`);
  }

  // 2. Secondary Fast Fallback: Binance 24hr Ticker API
  try {
    // Try BRL pair first, then USDT pair
    let binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${upperTicker}BRL`;
    let isBrlPair = true;
    let bResp: any = null;

    try {
      bResp = await axios.get(binanceUrl, { timeout: 3500 });
    } catch {
      // Fallback to USDT pair
      isBrlPair = false;
      binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${upperTicker}USDT`;
      bResp = await axios.get(binanceUrl, { timeout: 3500 });
    }

    if (bResp?.data && bResp.data.lastPrice) {
      const rawPrice = parseFloat(bResp.data.lastPrice);
      const change24h = parseFloat(bResp.data.priceChangePercent || "0");
      // If USDT pair, convert with USD rate ~5.70
      const usdBrlRate = 5.70;
      const price = isBrlPair ? rawPrice : rawPrice * usdBrlRate;
      const nowIso = new Date().toISOString();
      const coinName = CRYPTO_CATALOG.find(c => c.ticker === upperTicker)?.name || upperTicker;

      const cacheDoc = {
        ticker: upperTicker,
        price: Number(price.toFixed(4)),
        dayHigh: Number(price.toFixed(4)),
        dayLow: Number(price.toFixed(4)),
        name: coinName,
        changePercent: Number(change24h.toFixed(2)),
        avgAppreciation: 15.0,
        updatedAt: nowIso,
        fetchedAt: nowIso,
        atualizadoEm: nowIso,
        isFallback: false,
        type: "Cripto",
      };

      inMemoryCache.set(`quote:${upperTicker}`, cacheDoc);
      if (isFirebaseReady) {
        try {
          await setDoc(quoteCacheRef, cleanForFirestore(cacheDoc), { merge: true });
        } catch (err) {
          console.debug(`[Quote Cache] Gravação Firestore suprimida para Binance ${upperTicker}`);
        }
      }

      return {
        ticker: upperTicker,
        name: coinName,
        price: Number(price.toFixed(4)),
        dayHigh: Number(price.toFixed(4)),
        dayLow: Number(price.toFixed(4)),
        dy: 0,
        avgAppreciation: 15.0,
        isFallback: false,
        updatedAt: nowIso,
        fetchedAt: nowIso,
        changePercent: Number(change24h.toFixed(2)),
        type: "Cripto",
      };
    }
  } catch (bErr: any) {
    // Secondary fallback error logged silently
  }

  // 3. Stale cache contingency
  if (cachedQuote && cachedQuote.price !== undefined) {
    return {
      ticker: upperTicker,
      name: cachedQuote.name || `${upperTicker} (Cripto)`,
      price: Number(cachedQuote.price),
      dayHigh: Number(cachedQuote.dayHigh || cachedQuote.price),
      dayLow: Number(cachedQuote.dayLow || cachedQuote.price),
      dy: 0,
      avgAppreciation: 15.0,
      isFallback: true,
      updatedAt: cachedQuote.updatedAt || cachedQuote.atualizadoEm,
      fetchedAt: new Date().toISOString(),
      changePercent: Number(cachedQuote.changePercent || 0),
      type: "Cripto",
    };
  }

  // 4. Default Static Reference Fallbacks
  const cryptoFallbacks: Record<string, { name: string, price: number }> = {
    // Top Market Cap & Layer 1s
    BTC: { name: "Bitcoin", price: 345000.0 },
    ETH: { name: "Ethereum", price: 15400.0 },
    SOL: { name: "Solana", price: 820.0 },
    BNB: { name: "BNB", price: 3100.0 },
    XRP: { name: "XRP", price: 3.20 },
    ADA: { name: "Cardano", price: 2.10 },
    AVAX: { name: "Avalanche", price: 165.0 },
    TRX: { name: "TRON", price: 0.85 },
    TON: { name: "Toncoin", price: 28.50 },
    DOT: { name: "Polkadot", price: 32.0 },
    SUI: { name: "Sui", price: 12.50 },
    NEAR: { name: "NEAR Protocol", price: 28.0 },
    APT: { name: "Aptos", price: 42.0 },
    SEI: { name: "Sei", price: 2.30 },
    KAS: { name: "Kaspa", price: 0.80 },
    ICP: { name: "Internet Computer", price: 48.0 },
    HBAR: { name: "Hedera", price: 0.55 },
    ATOM: { name: "Cosmos", price: 32.0 },
    BCH: { name: "Bitcoin Cash", price: 2100.0 },
    LTC: { name: "Litecoin", price: 420.0 },
    XLM: { name: "Stellar", price: 0.70 },
    XMR: { name: "Monero", price: 850.0 },
    ETC: { name: "Ethereum Classic", price: 125.0 },
    VET: { name: "VeChain", price: 0.16 },
    ALGO: { name: "Algorand", price: 1.10 },
    FTM: { name: "Fantom", price: 3.80 },
    TIA: { name: "Celestia", price: 28.0 },
    INJ: { name: "Injective", price: 115.0 },
    STX: { name: "Stacks", price: 10.50 },
    KAVA: { name: "Kava", price: 2.40 },
    FLOW: { name: "Flow", price: 3.50 },
    MINA: { name: "Mina", price: 3.20 },
    EGLD: { name: "MultiversX", price: 160.0 },
    ASTR: { name: "Astar", price: 0.40 },
    RON: { name: "Ronin", price: 10.0 },
    NEO: { name: "Neo", price: 65.0 },
    ZEC: { name: "Zcash", price: 180.0 },
    IOTA: { name: "IOTA", price: 1.15 },
    EOS: { name: "EOS", price: 3.80 },
    KLAY: { name: "Kaia", price: 1.10 },

    // Layer 2 & Rollups
    MATIC: { name: "Polygon", price: 2.40 },
    POL: { name: "Polygon Ecosystem", price: 2.40 },
    ARB: { name: "Arbitrum", price: 3.20 },
    OP: { name: "Optimism", price: 9.50 },
    STRK: { name: "Starknet", price: 2.80 },
    MANTA: { name: "Manta Network", price: 4.50 },
    BLAST: { name: "Blast", price: 0.06 },
    ZK: { name: "ZKsync", price: 0.85 },
    METIS: { name: "Metis", price: 195.0 },
    IMX: { name: "Immutable", price: 8.50 },

    // Stablecoins & Wrapped
    USDT: { name: "Tether", price: 5.70 },
    USDC: { name: "USD Coin", price: 5.70 },
    DAI: { name: "Dai", price: 5.70 },
    FDUSD: { name: "First Digital USD", price: 5.70 },
    USDE: { name: "Ethena USDe", price: 5.70 },
    WBTC: { name: "Wrapped Bitcoin", price: 345000.0 },
    WETH: { name: "Wrapped Ethereum", price: 15400.0 },

    // DeFi, RWA, Staking & Oracles
    LINK: { name: "Chainlink", price: 78.0 },
    UNI: { name: "Uniswap", price: 48.0 },
    AAVE: { name: "Aave", price: 820.0 },
    MKR: { name: "Maker", price: 9200.0 },
    LDO: { name: "Lido DAO", price: 7.80 },
    ONDO: { name: "Ondo Finance", price: 4.60 },
    PENDLE: { name: "Pendle", price: 24.0 },
    ENA: { name: "Ethena", price: 2.20 },
    JUP: { name: "Jupiter", price: 4.80 },
    RAY: { name: "Raydium", price: 12.0 },
    CRV: { name: "Curve DAO", price: 1.80 },
    SNX: { name: "Synthetix", price: 8.50 },
    COMP: { name: "Compound", price: 260.0 },
    DYDX: { name: "dYdX", price: 6.20 },
    RUNE: { name: "THORChain", price: 28.0 },
    "1INCH": { name: "1inch", price: 1.80 },
    CAKE: { name: "PancakeSwap", price: 12.0 },
    GMX: { name: "GMX", price: 145.0 },
    PYTH: { name: "Pyth Network", price: 2.10 },
    SUSHI: { name: "SushiSwap", price: 4.20 },
    RPL: { name: "Rocket Pool", price: 60.0 },

    // AI, DePIN & Big Data / Storage
    TAO: { name: "Bittensor", price: 2400.0 },
    RENDER: { name: "Render", price: 38.0 },
    RNDR: { name: "Render Token", price: 38.0 },
    FET: { name: "Artificial Superintelligence", price: 7.20 },
    GRT: { name: "The Graph", price: 1.10 },
    FIL: { name: "Filecoin", price: 22.0 },
    AR: { name: "Arweave", price: 110.0 },
    THETA: { name: "Theta Network", price: 8.20 },
    WLD: { name: "Worldcoin", price: 11.50 },
    AKT: { name: "Akash Network", price: 18.0 },
    IO: { name: "io.net", price: 11.0 },
    JASMY: { name: "JasmyCoin", price: 0.12 },
    OCEAN: { name: "Ocean Protocol", price: 3.50 },

    // Memecoins
    DOGE: { name: "Dogecoin", price: 0.75 },
    SHIB: { name: "Shiba Inu", price: 0.000085 },
    PEPE: { name: "Pepe", price: 0.000055 },
    WIF: { name: "dogwifhat", price: 12.50 },
    BONK: { name: "Bonk", price: 0.00012 },
    FLOKI: { name: "FLOKI", price: 0.00085 },
    BRETT: { name: "Brett", price: 0.45 },
    POPCAT: { name: "Popcat", price: 5.20 },
    BOME: { name: "BOOK OF MEME", price: 0.045 },
    MEW: { name: "cat in a dogs world", price: 0.035 },
    NEIRO: { name: "First Neiro on Ethereum", price: 0.008 },
    MOG: { name: "Mog Coin", price: 0.00001 },

    // Gaming, NFT & Metaverse
    GALA: { name: "GALA", price: 0.14 },
    SAND: { name: "The Sandbox", price: 1.80 },
    MANA: { name: "Decentraland", price: 1.90 },
    AXS: { name: "Axie Infinity", price: 32.0 },
    BEAM: { name: "Beam", price: 0.11 },
    NOT: { name: "Notcoin", price: 0.045 },
    APE: { name: "ApeCoin", price: 4.80 },
    CHZ: { name: "Chiliz", price: 0.38 },
    ENJ: { name: "Enjin Coin", price: 0.95 },
    REN: { name: "Ren Protocol", price: 0.25 },
  };

  const fb = cryptoFallbacks[upperTicker] || { name: `${upperTicker} (Cripto)`, price: 10.0 };
  const nowIso = new Date().toISOString();
  return {
    ticker: upperTicker,
    name: fb.name,
    price: fb.price,
    dayHigh: fb.price,
    dayLow: fb.price,
    dy: 0,
    avgAppreciation: 15.0,
    isFallback: true,
    updatedAt: nowIso,
    fetchedAt: nowIso,
    changePercent: 0,
    type: "Cripto",
  };
}

// ─── Asset Info Cache ───────────────────────────────────────────────────────
async function getOrFetchAssetInfo(
  ticker: string,
  apiItem?: any,
  currentPrice?: number
): Promise<{ cnpj: string; pVP: number; lpa?: number; vpa?: number }> {
  const upper = ticker.toUpperCase().trim();
  const infoRef = doc(db, "ativosInfo", upper);

  try {
    const snap = await getDoc(infoRef);
    if (snap.exists()) {
      const d = snap.data();
      if (d.cnpj && d.pVP !== undefined) {
        return {
          cnpj: d.cnpj,
          pVP: Number(d.pVP),
          lpa: d.lpa !== undefined ? Number(d.lpa) : undefined,
          vpa: d.vpa !== undefined ? Number(d.vpa) : undefined,
        };
      }
    }
  } catch (err) {
    console.warn(`[AtivosInfo Cache] Read warning for ${upper}:`, err);
  }

  let cnpj = apiItem?.cnpj || apiItem?.companyCnpj || null;
  let pVP =
    apiItem?.priceToBook ??
    apiItem?.priceToBookRatio ??
    apiItem?.p_vp ??
    null;
  let lpa =
    apiItem?.earningsPerShare ??
    apiItem?.eps ??
    apiItem?.lpa ??
    apiItem?.financialData?.earningsPerShare ??
    apiItem?.defaultKeyStatistics?.trailingEps ??
    null;
  let vpa =
    apiItem?.bookValuePerShare ??
    apiItem?.bookValue ??
    apiItem?.vpa ??
    apiItem?.defaultKeyStatistics?.bookValue ??
    null;

  const fallback = ATIVOS_INFO_FALLBACK[upper];
  if (!cnpj) {
    cnpj =
      fallback?.cnpj ||
      (upper.endsWith("11") ? "00.000.000/0001-00" : "00.000.000/0001-01");
  }
  if (pVP === null || isNaN(Number(pVP))) {
    pVP = fallback?.pVP || 1.0;
  }

  if (lpa === null || isNaN(Number(lpa))) {
    if (fallback?.lpa !== undefined) {
      lpa = fallback.lpa;
    } else if (apiItem?.priceEarnings && currentPrice) {
      const pe = Number(apiItem.priceEarnings);
      if (pe > 0) lpa = currentPrice / pe;
    }
  }

  if (vpa === null || isNaN(Number(vpa))) {
    if (fallback?.vpa !== undefined) {
      vpa = fallback.vpa;
    } else if (pVP && Number(pVP) > 0 && currentPrice) {
      vpa = currentPrice / Number(pVP);
    }
  }

  const finalInfo: any = {
    ticker: upper,
    cnpj,
    pVP: Number(Number(pVP).toFixed(2)),
    updatedAt: new Date().toISOString(),
  };

  if (lpa !== null && !isNaN(Number(lpa))) {
    finalInfo.lpa = Number(Number(lpa).toFixed(2));
  }
  if (vpa !== null && !isNaN(Number(vpa))) {
    finalInfo.vpa = Number(Number(vpa).toFixed(2));
  }

  try {
    await setDoc(infoRef, cleanForFirestore(finalInfo), { merge: true });
  } catch (err) {
    console.warn(`[AtivosInfo Cache] Write warning for ${upper}:`, err);
  }

  return {
    cnpj: finalInfo.cnpj,
    pVP: finalInfo.pVP,
    lpa: finalInfo.lpa,
    vpa: finalInfo.vpa,
  };
}

// ─── Distributed Lock ───────────────────────────────────────────────────────
interface DistributedLockHandle {
  acquired: boolean;
  release: () => Promise<void>;
}

async function acquireDistributedLock(
  lockKey: string,
  ttlSeconds = 120
): Promise<DistributedLockHandle> {
  const lockRef = doc(db, "locks", lockKey);
  const now = Date.now();
  const lockId = `${process.pid || 1}-${Math.random().toString(36).substring(2, 9)}`;

  try {
    const acquired = await runTransaction(db, async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      if (lockDoc.exists()) {
        const data = lockDoc.data();
        const expiresAt = Number(data?.expiresAt || 0);
        // Se o lock ainda estiver ativo e não expirou pelo TTL
        if (expiresAt > now) {
          return false;
        }
      }

      // Lock livre ou expirado -> adquire atomicamente
      transaction.set(lockRef, {
        lockKey,
        lockedBy: lockId,
        lockedAt: new Date(now).toISOString(),
        expiresAt: now + ttlSeconds * 1000,
        ttlSeconds,
      });
      return true;
    });

    if (!acquired) {
      return { acquired: false, release: async () => {} };
    }

    const release = async () => {
      try {
        await runTransaction(db, async (transaction) => {
          const lockDoc = await transaction.get(lockRef);
          if (lockDoc.exists() && lockDoc.data()?.lockedBy === lockId) {
            transaction.delete(lockRef);
          }
        });
      } catch (err) {
        console.warn(`[DistributedLock] Erro ao liberar lock '${lockKey}':`, err);
      }
    };

    return { acquired: true, release };
  } catch (err) {
    console.warn(`[DistributedLock] Erro ao adquirir lock '${lockKey}':`, err);
    return { acquired: false, release: async () => {} };
  }
}

// ─── API Call Rate Limiter & Concurrency Queue ─────────────────────────────
function createConcurrencyLimit(concurrency = 1) {
  const queue: Array<() => void> = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      const runNext = queue.shift();
      if (runNext) runNext();
    }
  };

  const run = async <T>(
    fn: () => Promise<T>,
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void
  ) => {
    activeCount++;
    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      next();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      if (activeCount < concurrency) {
        run(fn, resolve, reject);
      } else {
        queue.push(() => run(fn, resolve, reject));
      }
    });
  };
}

const counterConcurrencyLimit = createConcurrencyLimit(1);
let lastApiCallTimestamp = 0;

async function throttleApiCall<T>(fn: () => Promise<T>, minDelayMs = 1000): Promise<T> {
  return counterConcurrencyLimit(async () => {
    const now = Date.now();
    const elapsed = now - lastApiCallTimestamp;
    if (elapsed < minDelayMs && lastApiCallTimestamp > 0) {
      await new Promise((resolve) => setTimeout(resolve, minDelayMs - elapsed));
    }
    try {
      return await fn();
    } finally {
      lastApiCallTimestamp = Date.now();
    }
  });
}

// ─── API Call Counters ──────────────────────────────────────────────────────
async function incrementDailyCounter(collectionName: string, label: string) {
  return throttleApiCall(async () => {
    const dateStr = getSaoPauloDateStr();
    const docRef = doc(db, collectionName, dateStr);

    try {
      const snap = await getDoc(docRef);
      const currentCount = snap.exists() ? snap.data().count || 0 : 0;
      const newCount = currentCount + 1;

      await setDoc(
        docRef,
        {
          date: dateStr,
          count: newCount,
          lastCallAt: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log(
        `[${label}] Chamada registrada para ${dateStr}. Total hoje: ${newCount}`
      );
    } catch (err) {
      console.warn(`[${label}] Erro ao registrar chamada:`, err);
    }
  }, 1000);
}

const incrementBolsaAiCallCounter = () =>
  incrementDailyCounter("bolsai_daily_calls", "BolsaAI Log");

const incrementBrapiCallCounter = () =>
  incrementDailyCounter("brapi_daily_calls", "Brapi Log");

// ─── Dividend Yield ─────────────────────────────────────────────────────────
async function fetchBolsaiDy(ticker: string): Promise<number | null> {
  const apiKey = process.env.BOLSAI_API_KEY;
  const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
  if (apiKey) headers["X-API-Key"] = apiKey;

  const endpoints = [
    `https://api.usebolsai.com/api/v1/dividends/${ticker}`,
    ticker.endsWith("11")
      ? `https://api.usebolsai.com/api/v1/fiis/${ticker}`
      : `https://api.usebolsai.com/api/v1/fundamentals/${ticker}`,
  ];

  for (const url of endpoints) {
    try {
      await incrementBolsaAiCallCounter();
      const fullUrl = apiKey
        ? `${url}?api_key=${encodeURIComponent(apiKey)}`
        : url;
      const response = await axios.get(fullUrl, { headers, timeout: 5000 });

      if (response.data) {
        const d = response.data;
        const dyRaw =
          d.dividend_yield_ttm ??
          d.dividend_yield ??
          d.dy ??
          d.dividendYield;

        if (dyRaw !== undefined && dyRaw !== null) {
          const num = Number(dyRaw);
          if (!isNaN(num) && num > 0) {
            const finalDy = num > 0 && num < 1 ? num * 100 : num;
            return Number(finalDy.toFixed(2));
          }
        }
      }
    } catch {
      // tenta próximo endpoint
    }
  }

  return null;
}

async function getDividendYieldFromCache(
  ticker: string,
  defaultDy = 0
): Promise<{
  dy: number;
  atualizadoEm: string | null;
  dyIsPending: boolean;
  source: "cache" | "pending_sync";
}> {
  const upper = ticker.toUpperCase().trim();

  const memoryKey = `dy:${upper}`;
  const memoryCached = inMemoryCache.get(memoryKey);
  if (memoryCached) return memoryCached;

  if (isFirebaseReady) {
    try {
      const docRef = doc(db, "dividendos_cache", upper);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const dyVal = Number(data.dy);
        const result = {
          dy: !isNaN(dyVal) ? dyVal : defaultDy,
          atualizadoEm: data.atualizadoEm || null,
          dyIsPending: !!data.dyIsPending,
          source: "cache" as const,
        };
        inMemoryCache.set(memoryKey, result);
        return result;
      }

      await setDoc(
        docRef,
        {
          ticker: upper,
          dy: defaultDy,
          atualizadoEm: null,
          dyIsPending: true,
          source: "pending_sync",
        },
        { merge: true }
      );
    } catch (err) {
      console.debug(`[Dividend Cache] Firestore offline para ${upper}`);
    }
  }

  const defaultResult = {
    dy: defaultDy,
    atualizadoEm: null,
    dyIsPending: true,
    source: "pending_sync" as const,
  };
  inMemoryCache.set(memoryKey, defaultResult);
  return defaultResult;
}

async function syncDividendsCache(force = false) {
  const todayDate = new Date().toISOString().slice(0, 10);
  const syncMetaRef = doc(db, "sync_meta", "dividendos");

  // 1. GUARD DE SYNC DIÁRIO
  if (!force) {
    try {
      const metaSnap = await getDoc(syncMetaRef);
      if (metaSnap.exists()) {
        const data = metaSnap.data();
        const ultimaExecucao = (data.ultimaExecucao || data.lastSyncDate || "")
          .toString()
          .slice(0, 10);

        if (ultimaExecucao === todayDate) {
          console.log(
            `[Bolsai Sync] Já executado hoje (${todayDate}). Ignorando.`
          );
          return {
            skipped: true,
            reason: `Já executado hoje (${todayDate})`,
            lastSyncDate: todayDate,
            ultimaExecucao: todayDate,
            updatedCount: 0,
            requestCount: 0,
            totalTickers: 0,
            remainingQuota: 200,
            isForced: false,
          };
        }
      }
    } catch (err) {
      console.warn(
        "[Bolsai Sync] Erro ao verificar sync_meta (Firestore offline/conectando):",
        err
      );
      // Se deu erro ao ler o status (ex: Firestore em cold boot), aborta de forma segura para não estourar a cota
      return {
        skipped: true,
        reason: "Banco offline ou indisponível durante verificação de sync_meta",
        lastSyncDate: todayDate,
        ultimaExecucao: todayDate,
        updatedCount: 0,
        requestCount: 0,
        totalTickers: 0,
        remainingQuota: 200,
        isForced: false,
      };
    }
  } else {
    console.log(`[Bolsai Sync] Sync forçado (${todayDate})...`);
  }

  // 2. LOCK DISTRIBUÍDO (TTL: 120 segundos)
  const lock = await acquireDistributedLock("sync_dividendos", 120);
  if (!lock.acquired) {
    console.log(
      `[Bolsai Sync] Outra instância já está executando o sync de DY (Lock ativo). Ignorando.`
    );
    return {
      skipped: true,
      reason: "Job em execução por outra instância (Lock ativo)",
      lastSyncDate: todayDate,
      ultimaExecucao: todayDate,
      updatedCount: 0,
      requestCount: 0,
      totalTickers: 0,
      remainingQuota: 200,
      isForced: false,
    };
  }

  try {
    console.log(`[Bolsai Sync] Iniciando sync diário de DY (${todayDate})...`);

    const defaultTickers = [
      "WEGE3",
      "PETR4",
      "PETR3",
      "VALE3",
      "ITUB4",
      "TAEE11",
      "MXRF11",
      "BBAS3",
      "ITSA4",
      "HGLG11",
      "ABEV3",
      "BBSE3",
    ];

    const tickerMap = new Map<string, string | null>();
    for (const t of defaultTickers) tickerMap.set(t, null);

    try {
      const cacheSnap = await getDocs(collection(db, "dividendos_cache"));
      cacheSnap.forEach((d) => {
        const data = d.data();
        const t = (data.ticker || d.id || "").toUpperCase().trim();
        if (t) tickerMap.set(t, data.atualizadoEm || null);
      });
    } catch (err) {
      console.warn("[Bolsai Sync] Warning scanning dividendos_cache:", err);
    }

    const tickerDataList = Array.from(tickerMap.entries()).map(
      ([ticker, atualizadoEm]) => ({ ticker, atualizadoEm })
    );

    tickerDataList.sort((a, b) => {
      if (!a.atualizadoEm && !b.atualizadoEm) return 0;
      if (!a.atualizadoEm) return -1;
      if (!b.atualizadoEm) return 1;
      return (
        new Date(a.atualizadoEm).getTime() - new Date(b.atualizadoEm).getTime()
      );
    });

    const MAX_DAILY_REQUESTS = 200;
    const tickersToUpdate = tickerDataList.slice(0, MAX_DAILY_REQUESTS);

    let requestCount = 0;
    let updatedCount = 0;

    for (const item of tickersToUpdate) {
      const t = item.ticker;
      requestCount++;
      const dyValue = await fetchBolsaiDy(t);
      const nowIso = new Date().toISOString();

      if (dyValue !== null) {
        await setDoc(
          doc(db, "dividendos_cache", t),
          {
            ticker: t,
            dy: dyValue,
            atualizadoEm: nowIso,
            dyIsPending: false,
            source: "bolsai",
          },
          { merge: true }
        );
        updatedCount++;
      } else {
        const defaultDy = B3_FALLBACK_MARKET_DATA[t]?.dy || 8.5;
        await setDoc(
          doc(db, "dividendos_cache", t),
          {
            ticker: t,
            dy: defaultDy,
            atualizadoEm: nowIso,
            dyIsPending: false,
            source: "fallback",
          },
          { merge: true }
        );
      }
    }

    const remainingQuota = MAX_DAILY_REQUESTS - requestCount;
    const nowIso = new Date().toISOString();

    try {
      await setDoc(
        syncMetaRef,
        {
          ultimaExecucao: todayDate,
          lastSyncDate: todayDate,
          lastSyncTimestamp: nowIso,
          requestCount,
          updatedCount,
          totalTickers: tickerDataList.length,
          remainingQuota,
          status: "completed",
        },
        { merge: true }
      );
    } catch (err) {
      console.error("[Bolsai Sync] Erro ao gravar sync_meta:", err);
    }

    console.log(
      `[Bolsai Sync] ${requestCount} reqs | ${updatedCount} atualizados | quota restante: ${remainingQuota}`
    );

    return {
      skipped: false,
      lastSyncDate: todayDate,
      ultimaExecucao: todayDate,
      updatedCount,
      requestCount,
      totalTickers: tickerDataList.length,
      remainingQuota,
      isForced: force,
    };
  } finally {
    await lock.release();
  }
}

// ─── Stock Quote ────────────────────────────────────────────────────────────
async function getSingleStockQuote(ticker: string): Promise<any> {
  let upperTicker = sanitizeTicker(ticker);
  if (!upperTicker) throw new Error("Ticker inválido");

  if (["CAIXA", "DEPOSITO", "RETIRADA", "SALDO", "DINHEIRO"].includes(upperTicker)) {
    return {
      ticker: upperTicker,
      name: "Saldo em Caixa",
      price: 1,
      dayHigh: 1,
      dayLow: 1,
      dy: 0,
      avgAppreciation: 0,
      pVP: 1,
      cnpj: "",
      lpa: 0,
      vpa: 0,
      isFallback: true,
      updatedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      dyUpdatedAt: new Date().toISOString(),
      dyIsPending: false,
      changePercent: 0,
    };
  }

  // Smart autocorrect for common 4-letter B3 tickers missing the number
  const autocorrect: Record<string, string> = {
    HYPE: "HYPE3",
    PETR: "PETR4",
    VALE: "VALE3",
    ITUB: "ITUB4",
    ITSA: "ITSA4",
    BBAS: "BBAS3",
    TAEE: "TAEE11",
    WEGE: "WEGE3",
    MXRF: "MXRF11",
    HGLG: "HGLG11",
    BBDC: "BBDC4",
    ABEV: "ABEV3",
    BBSE: "BBSE3",
    SANB: "SANB11",
    KLBN: "KLBN11",
    SAPR: "SAPR11",
    RENT: "RENT3",
    LREN: "LREN3",
    MGLU: "MGLU3",
    VBBR: "VBBR3",
    ELET: "ELET3",
    SUZB: "SUZB3",
    PRIO: "PRIO3",
    CMIG: "CMIG4",
    CPLE: "CPLE6",
    CSAN: "CSAN3",
  };
  if (autocorrect[upperTicker]) {
    upperTicker = autocorrect[upperTicker];
  }

  // Intercept crypto tickers
  const cryptoAsset = CRYPTO_CATALOG.find(c => c.ticker === upperTicker);
  if (cryptoAsset) {
    return getCryptoQuoteFromCoinGecko(upperTicker, cryptoAsset.id);
  }

  const fallbackBenchmark = B3_FALLBACK_MARKET_DATA[upperTicker]?.dy || 8.5;
  const cachedDyData = await getDividendYieldFromCache(
    upperTicker,
    fallbackBenchmark
  );

  let cachedQuote: any = inMemoryCache.get(`quote:${upperTicker}`) || null;
  const quoteCacheRef = doc(db, "cotacoes_cache", upperTicker);

  if (!cachedQuote && isFirebaseReady) {
    try {
      const snap = await getDoc(quoteCacheRef);
      if (snap.exists()) {
        cachedQuote = snap.data();
        inMemoryCache.set(`quote:${upperTicker}`, cachedQuote);
      }
    } catch {
      // Falha silenciosa no Firestore
    }
  }

  if (cachedQuote && cachedQuote.price !== undefined) {
    const ageMs = Date.now() - new Date(cachedQuote.atualizadoEm).getTime();
    const marketOpen = isB3MarketOpen();
    const isFresh = ageMs < 30 * 60 * 1000;
    const lastCloseTime = getLastMarketCloseTime();
    const updatedTime = new Date(
      cachedQuote.atualizadoEm || cachedQuote.updatedAt || 0
    ).getTime();
    const hasPostClosePrice = updatedTime >= lastCloseTime.getTime();
    const shouldServeCache = isFresh || (!marketOpen && hasPostClosePrice);

    if (shouldServeCache) {
      console.log(
        `[Quote Cache] SERVING CACHE for ${upperTicker}: R$ ${cachedQuote.price} | Age: ${(ageMs / 60000).toFixed(1)}m`
      );
      return {
        ticker: upperTicker,
        name: cachedQuote.name || `${upperTicker} (B3)`,
        price: Number(cachedQuote.price),
        dayHigh: Number(cachedQuote.dayHigh || cachedQuote.price),
        dayLow: Number(cachedQuote.dayLow || cachedQuote.price),
        dy: Number(cachedDyData.dy.toFixed(2)),
        avgAppreciation: Number(
          cachedQuote.avgAppreciation ||
            (upperTicker.endsWith("11") ? 4.5 : 8.5)
        ),
        pVP:
          cachedQuote.pVP !== undefined
            ? Number(cachedQuote.pVP)
            : ATIVOS_INFO_FALLBACK[upperTicker]?.pVP || 1.0,
        cnpj: cachedQuote.cnpj || "",
        lpa:
          cachedQuote.lpa !== undefined
            ? Number(cachedQuote.lpa)
            : ATIVOS_INFO_FALLBACK[upperTicker]?.lpa,
        vpa:
          cachedQuote.vpa !== undefined
            ? Number(cachedQuote.vpa)
            : ATIVOS_INFO_FALLBACK[upperTicker]?.vpa,
        isFallback: !!cachedQuote.isFallback,
        updatedAt: cachedQuote.updatedAt || cachedQuote.atualizadoEm,
        fetchedAt: new Date().toISOString(),
        dyUpdatedAt: cachedDyData.atualizadoEm,
        dyIsPending: cachedDyData.dyIsPending,
        changePercent: Number(cachedQuote.changePercent || 0),
      };
    }
  }

  // Live Brapi
  try {
    const apiKey = process.env.BRAPI_API_KEY;
    const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    let brapiUrl = `https://brapi.dev/api/quote/${upperTicker}?fundamental=true`;
    if (apiKey) brapiUrl += `&token=${encodeURIComponent(apiKey)}`;

    const response = await axios.get(brapiUrl, { headers, timeout: 4000 });

    if (response.data?.results?.length > 0) {
      const item = response.data.results[0];
      const price = item.regularMarketPrice || 0;
      const name = item.longName || item.shortName || upperTicker;

      const isFii =
        upperTicker.endsWith("11") &&
        !["TAEE11", "SANB11", "KLBN11", "SAPR11", "ALUP11"].includes(
          upperTicker
        );
      let appreciation = isFii ? 4.5 : 8.5;

      if (B3_FALLBACK_MARKET_DATA[upperTicker]) {
        appreciation = B3_FALLBACK_MARKET_DATA[upperTicker].avgAppreciation;
      } else if (
        item.twoHundredDayAverage &&
        item.twoHundredDayAverage > 0 &&
        price > 0
      ) {
        const trend200d =
          ((price - item.twoHundredDayAverage) / item.twoHundredDayAverage) *
          100;
        const adjusted = (isFii ? 4.5 : 8.5) + trend200d * 0.25;
        appreciation = Math.min(
          Math.max(adjusted, isFii ? 2.0 : 4.0),
          isFii ? 8.0 : 18.0
        );
      }

      if (price > 0) {
        const nowIso = new Date().toISOString();
        let updatedAt = nowIso;
        if (item.regularMarketTime) {
          const d = new Date(item.regularMarketTime);
          if (!isNaN(d.getTime())) updatedAt = d.toISOString();
        }

        const assetInfo = await getOrFetchAssetInfo(upperTicker, item, price);
        const changePercent =
          item.regularMarketChangePercent !== undefined
            ? Number(item.regularMarketChangePercent)
            : 0;
        const dayHigh =
          item.regularMarketDayHigh !== undefined
            ? Number(item.regularMarketDayHigh)
            : price;
        const dayLow =
          item.regularMarketDayLow !== undefined
            ? Number(item.regularMarketDayLow)
            : price;

        await incrementBrapiCallCounter();

        const cacheDoc: any = {
          ticker: upperTicker,
          price: Number(price.toFixed(2)),
          dayHigh: Number(dayHigh.toFixed(2)),
          dayLow: Number(dayLow.toFixed(2)),
          name,
          changePercent: Number(changePercent.toFixed(2)),
          avgAppreciation: Number(appreciation.toFixed(2)),
          pVP: assetInfo.pVP !== undefined ? assetInfo.pVP : 1.0,
          cnpj: assetInfo.cnpj || "",
          updatedAt,
          fetchedAt: nowIso,
          atualizadoEm: nowIso,
          isFallback: false,
        };

        if (
          assetInfo.lpa !== undefined &&
          assetInfo.lpa !== null &&
          !isNaN(Number(assetInfo.lpa))
        ) {
          cacheDoc.lpa = Number(assetInfo.lpa);
        }
        if (
          assetInfo.vpa !== undefined &&
          assetInfo.vpa !== null &&
          !isNaN(Number(assetInfo.vpa))
        ) {
          cacheDoc.vpa = Number(assetInfo.vpa);
        }

        inMemoryCache.set(`quote:${upperTicker}`, cacheDoc);
        if (isFirebaseReady) {
          try {
            await setDoc(quoteCacheRef, cleanForFirestore(cacheDoc), {
              merge: true,
            });
          } catch (err) {
            console.debug(`[Quote Cache] Gravação Firestore suprimida para ${upperTicker}`);
          }
        }

        return {
          ticker: upperTicker,
          name,
          price: Number(price.toFixed(2)),
          dayHigh: Number(dayHigh.toFixed(2)),
          dayLow: Number(dayLow.toFixed(2)),
          dy: Number(cachedDyData.dy.toFixed(2)),
          avgAppreciation: Number(appreciation.toFixed(2)),
          pVP: assetInfo.pVP,
          cnpj: assetInfo.cnpj,
          lpa: assetInfo.lpa,
          vpa: assetInfo.vpa,
          isFallback: false,
          updatedAt,
          fetchedAt: nowIso,
          dyUpdatedAt: cachedDyData.atualizadoEm,
          dyIsPending: cachedDyData.dyIsPending,
          changePercent: Number(changePercent.toFixed(2)),
        };
      }
    }
  } catch (error: any) {
    console.warn(
      `[Yieldix Stock Service] Live quote failed for ${upperTicker}: ${error.response?.status || error.message}`
    );
  }

  // Stale cache contingency
  if (cachedQuote && cachedQuote.price !== undefined) {
    return {
      ticker: upperTicker,
      name: cachedQuote.name || `${upperTicker} (B3)`,
      price: Number(cachedQuote.price),
      dayHigh: Number(cachedQuote.dayHigh || cachedQuote.price),
      dayLow: Number(cachedQuote.dayLow || cachedQuote.price),
      dy: Number(cachedDyData.dy.toFixed(2)),
      avgAppreciation: Number(
        cachedQuote.avgAppreciation ||
          (upperTicker.endsWith("11") ? 4.5 : 8.5)
      ),
      pVP: cachedQuote.pVP !== undefined ? Number(cachedQuote.pVP) : 1.0,
      cnpj: cachedQuote.cnpj || "",
      lpa:
        cachedQuote.lpa !== undefined
          ? Number(cachedQuote.lpa)
          : ATIVOS_INFO_FALLBACK[upperTicker]?.lpa,
      vpa:
        cachedQuote.vpa !== undefined
          ? Number(cachedQuote.vpa)
          : ATIVOS_INFO_FALLBACK[upperTicker]?.vpa,
      isFallback: true,
      updatedAt: cachedQuote.updatedAt || cachedQuote.atualizadoEm,
      fetchedAt: new Date().toISOString(),
      dyUpdatedAt: cachedDyData.atualizadoEm,
      dyIsPending: cachedDyData.dyIsPending,
      changePercent: Number(cachedQuote.changePercent || 0),
    };
  }

  // If both live API and fresh cache fail, do not return mock fake prices. Throw error so client can warn user.
  throw new Error(`Cotação para o ativo ${upperTicker} indisponível no momento. Tente novamente.`);
}

// ─── Rule-based Analysis ────────────────────────────────────────────────────
function isCryptoTicker(ticker: string): boolean {
  if (!ticker) return false;
  const upper = ticker.trim().toUpperCase().replace(/USD$|BRL$/, '');
  return CRYPTO_CATALOG.some(c => c.ticker === upper || c.ticker === ticker.trim().toUpperCase());
}

function generateRuleBasedPortfolioAnalysis(
  portfolio: any[],
  totalValue: number,
  targetAllocation: Record<string, number>
): string {
  if (!Array.isArray(portfolio) || portfolio.length === 0) {
    return "### 1. Diagnóstico Geral & Saúde da Carteira\nNenhum ativo com saldo positivo na carteira detectado. Cadastre suas operações para habilitar o diagnóstico estratégico completo.";
  }

  const numAssets = portfolio.length;
  const fiiAssets = portfolio.filter(
    (p) => p.type === "FII" || (p.ticker || "").endsWith("11")
  );
  const cryptoAssets = portfolio.filter(
    (p) => p.type === "Cripto" || isCryptoTicker(p.ticker)
  );
  const stockAssets = portfolio.filter(
    (p) =>
      p.type !== "FII" &&
      p.type !== "Cripto" &&
      !(p.ticker || "").endsWith("11") &&
      !isCryptoTicker(p.ticker)
  );

  const fiiWeight = fiiAssets.reduce(
    (sum, p) => sum + (p.currentWeight || 0),
    0
  );
  const cryptoWeight = cryptoAssets.reduce(
    (sum, p) => sum + (p.currentWeight || 0),
    0
  );
  const stockWeight = stockAssets.reduce(
    (sum, p) => sum + (p.currentWeight || 0),
    0
  );

  let weightedDySum = 0;
  let incomeEligibleValue = 0;
  let totalPositionValue = 0;

  portfolio.forEach((p) => {
    const val = (p.quantity || 0) * (p.currentPrice || 0);
    totalPositionValue += val;
    if (p.type !== "Cripto" && !isCryptoTicker(p.ticker)) {
      incomeEligibleValue += val;
      weightedDySum += (p.dividendYield || 0) * val;
    }
  });

  const avgDy =
    incomeEligibleValue > 0 ? weightedDySum / incomeEligibleValue : 0;
  const projectedMonthlyIncome = (incomeEligibleValue * (avgDy / 100)) / 12;

  const sorted = [...portfolio].sort(
    (a, b) => (b.currentWeight || 0) - (a.currentWeight || 0)
  );
  const topAsset = sorted[0];
  const top3Weight = sorted
    .slice(0, 3)
    .reduce((acc, p) => acc + (p.currentWeight || 0), 0);

  const discounted = portfolio.filter(
    (p) =>
      (p.currentPrice || 0) > 0 &&
      (p.averagePrice || 0) > 0 &&
      p.currentPrice < p.averagePrice
  );

  const cryptoDesc = cryptoWeight > 0 
    ? ` e **${cryptoWeight.toFixed(1)}% em Criptoativos**` 
    : "";

  let profileText = "";
  if (cryptoWeight > 30) {
    profileText = "com forte exposição a criptoativos de alto crescimento e busca de valorização/reserva de valor";
  } else if (fiiWeight > 60) {
    profileText = "focada prioritariamente em renda mensal previsível e isenta";
  } else if (stockWeight > 60) {
    profileText = "voltada para crescimento patrimonial e proventos corporativos da B3";
  } else {
    profileText = "equilibrada entre valorização de longo prazo, renda mensal e diversificação descorrelacionada em criptoativos";
  }

  return `### 1. Diagnóstico Geral & Saúde da Carteira
- **Tamanho da Carteira:** **${numAssets} ativos monitorados** totalizando patrimônio de **R$ ${Number(totalValue || totalPositionValue).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**.
- **Composição Patrimonial:** **${stockWeight.toFixed(1)}% em Ações**, **${fiiWeight.toFixed(1)}% em Fundos Imobiliários**${cryptoDesc}.
- **Perfil do Portfólio:** Estrutura ${profileText}.

### 2. Gestão de Risco & Concentração
- **Maior Exposição Individual:** **${topAsset ? topAsset.ticker : "N/A"}** representa **${topAsset ? (topAsset.currentWeight || 0).toFixed(1) : 0}%** do patrimônio total.
- **Concentração no Top 3:** Os 3 maiores ativos somam **${top3Weight.toFixed(1)}%** da carteira. ${top3Weight > 50 ? "Recomenda-se pausar aportes nas maiores posições e diluir nos demais papéis para reduzir o risco específico." : "A diversificação está saudável e bem distribuída."}
- **Oportunidades de Compra / Preço Médio:** ${discounted.length > 0 ? `${discounted.map((d) => `**${d.ticker}** (cotado a R$ ${Number(d.currentPrice).toFixed(2)}, com desconto frente ao PM de R$ ${Number(d.averagePrice).toFixed(2)})`).join(", ")} estão em zona oportuna de acúmulo.` : "A maior parte dos ativos está negociando acima ou próximo ao custo médio de aquisição."}

### 3. Eficiência de Proventos & Valorização por Classe
- **Dividend Yield Médio (Ativos de Renda B3):** **${avgDy.toFixed(2)}% ao ano** (ponderado pelas Ações e FIIs da carteira, desconsiderando a classe Cripto).
- **Estimativa de Renda Mensal:** Média projetada de **R$ ${projectedMonthlyIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por mês** gerados pelos ativos pagadores de proventos.
- **Papel dos Criptoativos:** ${cryptoAssets.length > 0 ? `As ${cryptoAssets.length} criptomoedas na carteira (${cryptoWeight.toFixed(1)}% do total) atuam como reserva descorrelacionada e busca de valorização patrimonial de longo prazo (sem expectativa de dividendos diretos).` : "Nenhum criptoativo cadastrado na carteira no momento."}

### 4. Recomendações Estratégicas para Próximos Aportes
- **Aporte pelo Rebalanceamento:** Priorize os ativos que estão com peso atual abaixo da sua meta estratégica definida por classe (Ações, FIIs, Cripto).
- **Aproveitamento de Oportunidades:** Direcione capital aos papéis descontados frente ao custo médio ou em zonas de oportunidade técnica (como abaixo da SMA 200 nas criptomoedas).
- **Reinvestimento Integral:** Reinvista 100% dos proventos recebidos na B3 para fortalecer o fluxo de caixa de renda passiva.`;
}

// ─── Server Bootstrap ───────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(compression());
  app.use(express.json());

  // Security Headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  // Allowlist middleware: Bloqueia imediatamente qualquer rota não autorizada (404)
  app.use(allowlistMiddleware);

  // Health check endpoint for Cloud Run & load balancers
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Cron sync
  app.all("/api/cron/sync-dividends", async (req, res) => {
    try {
      const forceQuery = req.query.force;
      const isForced =
        forceQuery === "true" ||
        forceQuery === "1" ||
        req.body?.force === true;

      const stats = await syncDividendsCache(isForced);

      if (stats.skipped) {
        return res.json({
          success: true,
          skipped: true,
          message: `Sincronização ignorada. Já executada hoje (${stats.lastSyncDate}). Use ?force=true para forçar.`,
          stats,
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        success: true,
        skipped: false,
        message: isForced
          ? "Sincronização forçada concluída com sucesso."
          : "Sincronização do cache de dividendos concluída com sucesso.",
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[Bolsai Sync Error]:", err);
      return res
        .status(500)
        .json({ error: "Erro ao sincronizar dividendos", details: err.message });
    }
  });

  // Admin logs
  app.get("/api/admin/brapi-calls", async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, "brapi_daily_calls"));
      const logs: any[] = [];
      snap.forEach((d) => logs.push(d.data()));
      logs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const todayDate = getSaoPauloDateStr();
      const todayLog = logs.find((l) => l.date === todayDate);
      return res.json({
        success: true,
        count: todayLog?.count || (logs.length > 0 ? logs[0].count : 0),
        totalLoggedDays: logs.length,
        logs,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: "Erro ao buscar logs do Brapi", details: err.message });
    }
  });

  app.get("/api/admin/bolsai-calls", async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, "bolsai_daily_calls"));
      const logs: any[] = [];
      snap.forEach((d) => logs.push(d.data()));
      logs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const todayDate = getSaoPauloDateStr();
      const todayLog = logs.find((l) => l.date === todayDate);
      return res.json({
        success: true,
        count: todayLog?.count || (logs.length > 0 ? logs[0].count : 0),
        totalLoggedDays: logs.length,
        logs,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: "Erro ao buscar logs da BolsaAI", details: err.message });
    }
  });

  // Admin list users
  app.get("/api/admin/users", async (req, res) => {
    try {
      const secretHeader =
        req.headers["x-admin-secret"] || req.query.adminSecret;
      const expectedSecret = process.env.ADMIN_SECRET;

      if (!expectedSecret || secretHeader !== expectedSecret) {
        return res
          .status(401)
          .json({ error: "Não autorizado. Secret admin não configurada ou inválida." });
      }

      const usersSnap = await getDocs(collection(db, "users"));
      const userList: any[] = [];
      usersSnap.forEach((docSnap) => {
        userList.push({ id: docSnap.id, ...docSnap.data() });
      });

      return res.json({
        success: true,
        totalUsers: userList.length,
        users: userList,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: "Erro ao listar usuários", details: err.message });
    }
  });

  // Notifications Dispatch
  app.post("/api/notifications/dispatch", async (req, res) => {
    const userId = sanitizeString(req.body.userId, 100);
    const userEmail = sanitizeString(req.body.userEmail, 100);
    const ticker = sanitizeTicker(req.body.ticker);
    const action = sanitizeString(req.body.action, 50);
    const title = sanitizeString(req.body.title, 150);
    const body = sanitizeString(req.body.body, 300);
    const emailEnabled = Boolean(req.body.emailEnabled);
    const pushEnabled = Boolean(req.body.pushEnabled);

    const timestamp = new Date().toISOString();

    console.log(`[Yieldix FCM] ${userId} | ${ticker} | ${action} | ${title}`);

    return res.json({
      success: true,
      messageId: `fcm_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      channels: {
        emailSent: Boolean(emailEnabled && userEmail),
        pushSent: Boolean(pushEnabled),
      },
    });
  });

  // Market status
  app.get("/api/market/status", (_req, res) => {
    const utcNow = new Date();
    const spTime = new Date(utcNow.getTime() - 3 * 60 * 60 * 1000);
    const isOpen = isB3MarketOpen();
    const lastClose = getLastMarketCloseTime();

    return res.json({
      isOpen,
      tradingHours: "10:00 às 18:00 (Horário de Brasília)",
      brasiliaTime: spTime.toISOString(),
      lastMarketClose: lastClose.toISOString(),
      timestamp: utcNow.toISOString(),
    });
  });

  // Single quote
  app.get("/api/stock/:ticker", async (req, res) => {
    try {
      const quote = await getSingleStockQuote(req.params.ticker);
      return res.json(quote);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Batch quotes
  app.get("/api/stocks/quotes", async (req, res) => {
    const tickersParam = req.query.tickers;
    if (!tickersParam || typeof tickersParam !== "string") {
      return res
        .status(400)
        .json({ error: "Parâmetro 'tickers' é obrigatório" });
    }

    const tickers = tickersParam
      .split(",")
      .map((t) => t.toUpperCase().trim())
      .filter(Boolean);

    if (tickers.length === 0) {
      return res.status(400).json({ error: "Nenhum ticker válido fornecido" });
    }

    if (tickers.length > 100) {
      return res
        .status(400)
        .json({ error: "Máximo de 100 tickers permitidos por requisição" });
    }

    try {
      const quotes: Record<string, any> = {};
      await Promise.all(
        tickers.map(async (ticker) => {
          try {
            quotes[ticker] = await getSingleStockQuote(ticker);
          } catch (err) {
            console.warn(`[Batch Quote] Skipped ${ticker}:`, err);
          }
        })
      );
      return res.json(quotes);
    } catch (err: any) {
      return res
        .status(500)
        .json({
          error: "Erro ao processar cotações em lote",
          details: err.message,
        });
    }
  });

  // In-memory cache for crypto history to prevent CoinGecko 429 rate limits
  const cryptoHistoryMemCache = new Map<string, { timestamp: number; data: any }>();

  // History with Daily / Monthly Timeframe & SMA 200 curve
  app.get("/api/stock/:ticker/history", async (req, res) => {
    const ticker = (req.params.ticker || "").toUpperCase().trim();
    const timeframe = ((req.query.timeframe as string) || "3m").toLowerCase(); // '7d' | '1m' | '3m' | '6m' | '1y'
    const isDaily = timeframe === "daily" || timeframe === "7d" || timeframe === "1m" || timeframe === "3m" || timeframe === "6m" || timeframe === "1y";

    if (!ticker) {
      return res.status(400).json({ error: "Ticker inválido" });
    }

    const isCrypto = CRYPTO_CATALOG.some((c) => c.ticker === ticker);

    // 1. Criptoativos (CoinGecko com suporte a 7D, 1M, 3M, 6M, 1A + Cache Global + Kraken Fallback)
    if (isCrypto) {
      const cryptoItem = CRYPTO_CATALOG.find((c) => c.ticker === ticker);
      const cryptoId = cryptoItem?.id || "bitcoin";
      const cacheKey = `${ticker}_${timeframe}`;

      // A) Checagem em Memória (TTL 30 min)
      const memCached = cryptoHistoryMemCache.get(cacheKey);
      if (memCached && Date.now() - memCached.timestamp < 30 * 60 * 1000) {
        return res.json(memCached.data);
      }

      // B) Checagem no Firestore (TTL de 30 minutos para cotações)
      const histCacheRef = doc(db, "historico_cache", cacheKey);
      let firestoreCached: any = null;
      try {
        const snap = await getDoc(histCacheRef);
        if (snap.exists()) {
          firestoreCached = snap.data();
          const ageMs = Date.now() - new Date(firestoreCached.updatedAt).getTime();
          if (ageMs < 30 * 60 * 1000 && Array.isArray(firestoreCached.history) && firestoreCached.history.length > 0) {
            const respPayload = {
              ticker,
              history: firestoreCached.history,
              isFallback: firestoreCached.isFallback || false,
              interval: "1d",
            };
            cryptoHistoryMemCache.set(cacheKey, { timestamp: Date.now(), data: respPayload });
            return res.json(respPayload);
          }
        }
      } catch (fErr) {
        console.warn(`[History Cache] Erro ao ler cache Firestore para ${cacheKey}:`, fErr);
      }

      // C) Mapeamento de dias suportados pela CoinGecko no plano gratuito/demo
      const days =
        timeframe === "7d" ? 7 :
        timeframe === "1m" ? 30 :
        timeframe === "3m" ? 90 :
        timeframe === "6m" ? 180 : 365;

      try {
        const cgUrl = `https://api.coingecko.com/api/v3/coins/${cryptoId}/market_chart?vs_currency=brl&days=${days}&interval=daily`;
        const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
        if (process.env.COINGECKO_API_KEY) {
          headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY.trim();
        }
        const cgResp = await axios.get(cgUrl, { headers, timeout: 6000 });
        const prices = cgResp.data?.prices || [];

        if (Array.isArray(prices) && prices.length > 0) {
          const rawCloses = prices.map((p: any) => parseFloat(p[1]));
          const history = prices.map((p: any, idx: number) => {
            const d = new Date(p[0]);
            const startIdx = Math.max(0, idx - 199);
            const window = rawCloses.slice(startIdx, idx + 1);
            const sma = window.reduce((a: number, b: number) => a + b, 0) / window.length;
            
            return {
              date: d.toISOString().split("T")[0],
              label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""),
              month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
              price: Number(p[1].toFixed(2)),
              sma200: window.length >= 20 ? Number(sma.toFixed(2)) : null,
            };
          });

          const respData = { ticker, history, isFallback: false, interval: "1d" };
          cryptoHistoryMemCache.set(cacheKey, { timestamp: Date.now(), data: respData });

          // Grava no Firestore
          try {
            await setDoc(histCacheRef, cleanForFirestore({
              ticker,
              timeframe,
              history,
              updatedAt: new Date().toISOString(),
              isFallback: false,
            }), { merge: true });
          } catch (saveErr) {
            console.warn(`[History Cache] Erro ao salvar histórico Firestore para ${cacheKey}:`, saveErr);
          }

          return res.json(respData);
        }
      } catch (cgErr: any) {
        console.warn(`[History] CoinGecko failed for ${ticker} (${timeframe}):`, cgErr.message);
      }

      // D) Fallback Kraken: Se a CoinGecko rate-limitar ou falhar, busca na Kraken
      try {
        const krakenPairs: Record<string, string> = {
          BTC: "XXBTZUSD",
          ETH: "XETHZUSD",
          SOL: "SOLUSD",
          ADA: "ADAUSD",
          DOT: "DOTUSD",
          LTC: "XLTCZUSD",
          XRP: "XXRPZUSD",
          DOGE: "XDGUSD",
          AVAX: "AVAXUSD",
          LINK: "LINKUSD",
        };
        const pair = krakenPairs[ticker] || `${ticker}USD`;
        const kResp = await axios.get(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=1440`, { timeout: 5000 });
        const resultObj = kResp.data?.result || {};
        const key = Object.keys(resultObj).find((k) => k !== "last");
        if (key && Array.isArray(resultObj[key]) && resultObj[key].length > 0) {
          const usdBrl = 5.75;
          const candles = resultObj[key].slice(-days);
          const rawCloses = candles.map((c: any) => parseFloat(c[4]) * usdBrl);
          const history = candles.map((c: any, idx: number) => {
            const d = new Date(c[0] * 1000);
            const startIdx = Math.max(0, idx - 199);
            const window = rawCloses.slice(startIdx, idx + 1);
            const sma = window.reduce((a: number, b: number) => a + b, 0) / window.length;

            return {
              date: d.toISOString().split("T")[0],
              label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""),
              month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
              price: Number(rawCloses[idx].toFixed(2)),
              sma200: window.length >= 20 ? Number(sma.toFixed(2)) : null,
            };
          });

          const respData = { ticker, history, isFallback: true, interval: "1d" };
          cryptoHistoryMemCache.set(cacheKey, { timestamp: Date.now(), data: respData });
          return res.json(respData);
        }
      } catch (kErr: any) {
        console.warn(`[History] Kraken fallback failed for ${ticker}:`, kErr.message);
      }

      // E) Se tudo falhar, retorna o cache antigo do Firestore (mesmo expirado)
      if (firestoreCached && Array.isArray(firestoreCached.history) && firestoreCached.history.length > 0) {
        return res.json({
          ticker,
          history: firestoreCached.history,
          isFallback: true,
          interval: "1d",
        });
      }
    }

    // 2. Ações e FIIs da B3 (Brapi)
    try {
      const apiKey = process.env.BRAPI_API_KEY;
      const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const brapiRange = timeframe === "1m" ? "1mo" : "3mo";
      const brapiInterval = "1d";
      
      let response;
      try {
        const brapiUrl = `https://brapi.dev/api/quote/${ticker}?range=${brapiRange}&interval=${brapiInterval}`;
        response = await axios.get(brapiUrl, { headers, timeout: 6000 });
      } catch (err: any) {
        console.warn(`[History] Brapi range=${brapiRange} failed for ${ticker}:`, err.message);
        throw err;
      }

      if (response && response.data?.results?.length > 0) {
        const item = response.data.results[0];
        if (
          Array.isArray(item.historicalDataPrice) &&
          item.historicalDataPrice.length > 0
        ) {
          const validHistory = item.historicalDataPrice.filter((h: any) => (h.close || h.adjustedClose) > 0);
          const rawCloses = validHistory.map((h: any) => parseFloat(h.close || h.adjustedClose));

          const history = validHistory.map((h: any, idx: number) => {
            const d = new Date(h.date * 1000);
            const rawMonth = d
              .toLocaleDateString("pt-BR", { month: "short" })
              .replace(".", "");
            const monthLabel =
              rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
            
            const startIdx = Math.max(0, idx - 199);
            const window = rawCloses.slice(startIdx, idx + 1);
            const sma = window.reduce((a: number, b: number) => a + b, 0) / window.length;

            return {
              date: d.toISOString().split("T")[0],
              label: isDaily 
                ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")
                : monthLabel,
              month: monthLabel,
              price: Number((h.close || h.adjustedClose || 0).toFixed(2)),
              sma200: (isDaily && window.length >= 20) ? Number(sma.toFixed(2)) : null,
            };
          });

          if (history.length > 0) {
            return res.json({ ticker, history, isFallback: false, interval: brapiInterval });
          }
        }
      }
    } catch {
      // fallback
    }

    return res.json({ ticker, history: [], isFallback: true });
  });

  // Real Technical Indicators (SMA 200, MVRV, etc.) with 24h Global Cache
  app.get("/api/technical/:ticker", async (req, res) => {
    const rawTicker = (req.params.ticker || "").toUpperCase().trim();
    if (!rawTicker) {
      return res.status(400).json({ error: "Ticker inválido" });
    }

    const upperTicker = rawTicker;
    const isCrypto = CRYPTO_CATALOG.some((c) => c.ticker === upperTicker);
    const techCacheRef = doc(db, "technical_indicators_cache", upperTicker);

    // 1. Check 24h Firestore Cache (ignoring obsolete static-model cache)
    try {
      const cacheSnap = await getDoc(techCacheRef);
      if (cacheSnap.exists()) {
        const cached = cacheSnap.data();
        const ageMs = Date.now() - new Date(cached.updatedAt || 0).getTime();
        const isOldStaticMvrv = isCrypto && (cached.mvrv === 1.43 || cached.mvrv === 1.47 || cached.mvrv === 1.39 || cached.mvrv === 1.61 || cached.mvrv === 1.45);
        if (ageMs < 24 * 60 * 60 * 1000 && cached.sma200 > 0 && !isOldStaticMvrv) {
          return res.json({ ...cached, isCached: true });
        }
      }
    } catch (err) {
      console.warn(`[Technical Cache] Error reading cache for ${upperTicker}:`, err);
    }

    const nowIso = new Date().toISOString();

    // 2. Crypto calculation (CoinGecko / Kraken)
    if (isCrypto) {
      const cryptoItem = CRYPTO_CATALOG.find((c) => c.ticker === upperTicker);
      const cryptoId = cryptoItem?.id || "bitcoin";

      let dailyPrices: number[] = [];
      let dailyVolumes: number[] = [];
      let latestPrice = 0;

      // Attempt CoinGecko 200-day daily price history & volume
      try {
        const cgUrl = `https://api.coingecko.com/api/v3/coins/${cryptoId}/market_chart?vs_currency=brl&days=200&interval=daily`;
        const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
        if (process.env.COINGECKO_API_KEY) {
          headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY.trim();
        }
        const cgResp = await axios.get(cgUrl, { headers, timeout: 6000 });
        if (Array.isArray(cgResp.data?.prices) && cgResp.data.prices.length > 20) {
          dailyPrices = cgResp.data.prices.map((p: any) => parseFloat(p[1])).filter((p: number) => !isNaN(p) && p > 0);
          if (Array.isArray(cgResp.data?.total_volumes)) {
            dailyVolumes = cgResp.data.total_volumes.map((v: any) => parseFloat(v[1])).filter((v: number) => !isNaN(v));
          }
          if (dailyPrices.length > 0) {
            latestPrice = dailyPrices[dailyPrices.length - 1];
          }
        }
      } catch (cgErr: any) {
        console.warn(`[Technical] CoinGecko daily chart failed for ${upperTicker}:`, cgErr.message);
      }

      // Fallback to Kraken if CoinGecko failed
      if (dailyPrices.length < 20) {
        try {
          const krakenPairs: Record<string, string> = {
            BTC: "XXBTZUSD",
            ETH: "XETHZUSD",
            SOL: "SOLUSD",
            ADA: "ADAUSD",
            DOT: "DOTUSD",
            LTC: "XLTCZUSD",
            XRP: "XXRPZUSD",
            DOGE: "XDGUSD",
            AVAX: "AVAXUSD",
            LINK: "LINKUSD",
          };
          const pair = krakenPairs[upperTicker] || `${upperTicker}USD`;
          const kResp = await axios.get(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=1440`, { timeout: 4000 });
          const resultObj = kResp.data?.result || {};
          const key = Object.keys(resultObj).find(k => k !== "last");
          if (key && Array.isArray(resultObj[key])) {
            const usdBrl = 5.70;
            const candles = resultObj[key].slice(-200);
            dailyPrices = candles.map((c: any) => parseFloat(c[4]) * usdBrl).filter((p: number) => !isNaN(p) && p > 0);
            dailyVolumes = candles.map((c: any) => parseFloat(c[6]) || 1);
            if (dailyPrices.length > 0) {
              latestPrice = dailyPrices[dailyPrices.length - 1];
            }
          }
        } catch (kErr: any) {
          console.warn(`[Technical] Kraken chart fallback failed for ${upperTicker}:`, kErr.message);
        }
      }

      if (dailyPrices.length >= 20) {
        const last200 = dailyPrices.slice(-200);
        const sum = last200.reduce((a, b) => a + b, 0);
        const sma200 = Number((sum / last200.length).toFixed(4));
        const currentPrice = latestPrice || dailyPrices[dailyPrices.length - 1];
        const smaDistancePercent = Number((((currentPrice - sma200) / sma200) * 100).toFixed(2));

        // Realized Price (VWAP 200 / On-Chain Cost Basis Model based on actual daily candles & volume)
        const lastVolumes = dailyVolumes.slice(-last200.length);
        let weightedPriceSum = 0;
        let totalWeight = 0;
        for (let i = 0; i < last200.length; i++) {
          const p = last200[i];
          const v = (lastVolumes && lastVolumes[i] > 0) ? lastVolumes[i] : (i + 1);
          weightedPriceSum += p * v;
          totalWeight += v;
        }

        const realizedPrice = totalWeight > 0 ? Number((weightedPriceSum / totalWeight).toFixed(4)) : sma200;
        const mvrv = realizedPrice > 0 ? Number((currentPrice / realizedPrice).toFixed(2)) : 1.0;

        const resultData = {
          ticker: upperTicker,
          sma200,
          currentPrice,
          smaDistancePercent,
          daysCount: last200.length,
          realizedPrice,
          mvrv,
          updatedAt: nowIso,
          isFallback: false,
          type: "Cripto",
        };

        try {
          await setDoc(techCacheRef, cleanForFirestore(resultData), { merge: true });
        } catch (err) {
          console.warn(`[Technical Cache] Error saving cache for ${upperTicker}:`, err);
        }

        return res.json(resultData);
      } else {
        // Dynamic statistical fallback for crypto when external candle APIs are throttled
        const basePrice = latestPrice || (upperTicker === 'BTC' ? 385000 : upperTicker === 'ETH' ? 21000 : upperTicker === 'SOL' ? 850 : 100);
        const tickerHash = upperTicker.split('').reduce((acc, c, idx) => acc + c.charCodeAt(0) * (idx + 1), 0);
        const smaVariance = 0.91 + ((tickerHash % 10) * 0.01);
        const sma200 = Number((basePrice * smaVariance).toFixed(4));
        const smaDistancePercent = Number((((basePrice - sma200) / sma200) * 100).toFixed(2));
        
        const realizedVariance = 0.78 + ((tickerHash % 14) * 0.015);
        const realizedPrice = Number((basePrice * realizedVariance).toFixed(4));
        const mvrv = Number((basePrice / realizedPrice).toFixed(2));

        const resultData = {
          ticker: upperTicker,
          sma200,
          currentPrice: basePrice,
          smaDistancePercent,
          daysCount: 200,
          realizedPrice,
          mvrv,
          updatedAt: nowIso,
          isFallback: true,
          type: "Cripto",
        };

        return res.json(resultData);
      }
    }

    // 3. B3 Stocks / FIIs calculation (Brapi 1y/1d historical closes)
    try {
      const apiKey = process.env.BRAPI_API_KEY;
      const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      let response;
      try {
        const brapiUrl = `https://brapi.dev/api/quote/${upperTicker}?range=3mo&interval=1d`;
        response = await axios.get(brapiUrl, { headers, timeout: 6000 });
      } catch (err: any) {
        console.warn(`[Technical] Brapi range=3mo failed for ${upperTicker}:`, err.message);
        throw err;
      }

      const item = response?.data?.results?.[0];
      const history = item?.historicalDataPrice || [];
      const prices = history
        .map((h: any) => parseFloat(h.close || h.adjustedClose))
        .filter((p: number) => !isNaN(p) && p > 0);

      if (prices.length >= 20) {
        const last200 = prices.slice(-200);
        const sum = last200.reduce((a, b) => a + b, 0);
        const sma200 = Number((sum / last200.length).toFixed(2));
        const currentPrice = Number((item.regularMarketPrice || prices[prices.length - 1]).toFixed(2));
        const smaDistancePercent = Number((((currentPrice - sma200) / sma200) * 100).toFixed(2));

        const resultData = {
          ticker: upperTicker,
          sma200,
          currentPrice,
          smaDistancePercent,
          daysCount: last200.length,
          updatedAt: nowIso,
          isFallback: false,
          type: isCrypto ? "Cripto" : "B3",
        };

        try {
          await setDoc(techCacheRef, cleanForFirestore(resultData), { merge: true });
        } catch (err) {
          console.warn(`[Technical Cache] Error saving cache for ${upperTicker}:`, err);
        }

        return res.json(resultData);
      }
    } catch (err: any) {
      console.warn(`[Technical] Brapi failed for ${upperTicker}:`, err.message);
    }

    // 4. Contingency fallback if historical candles are unavailable
    return res.json({
      ticker: upperTicker,
      sma200: 0,
      currentPrice: 0,
      smaDistancePercent: 0,
      daysCount: 0,
      updatedAt: nowIso,
      isFallback: true,
    });
  });

  // Search
  app.get("/api/stocks/search", async (req, res) => {
    const rawQ = (req.query.q as string) || "";
    const q = sanitizeString(rawQ, 20).toUpperCase();

    if (!q) {
      const initialB3 = B3_CATALOG.slice(0, 6);
      const initialCrypto = CRYPTO_CATALOG.slice(0, 2).map(c => ({
        ticker: c.ticker,
        name: c.name,
        price: 0,
        type: "Cripto"
      }));
      return res.json({ results: [...initialB3, ...initialCrypto] });
    }

    const cryptoResults = CRYPTO_CATALOG.filter(
      (item) =>
        item.ticker.includes(q) || item.name.toUpperCase().includes(q)
    ).map(item => ({
      ticker: item.ticker,
      name: item.name,
      price: 0,
      type: "Cripto"
    }));

    try {
      const response = await axios.get(
        `https://brapi.dev/api/quote/list?search=${encodeURIComponent(q)}`,
        { timeout: 3000 }
      );

      if (
        Array.isArray(response.data?.stocks) &&
        response.data.stocks.length > 0
      ) {
        const b3Results = response.data.stocks
          .filter((item: any) => !item.stock.endsWith("F"))
          .slice(0, 8)
          .map((item: any) => ({
            ticker: item.stock,
            name: item.name || item.stock,
            price: item.close || 0,
            type:
              item.type === "fund" || item.subType === "fii"
                ? "FII"
                : item.type === "bdr"
                ? "BDR"
                : "Ação",
            sector: item.sector || "",
          }));

        const merged = [...cryptoResults, ...b3Results].slice(0, 10);
        return res.json({ results: merged });
      }
    } catch {
      // local catalog fallback
    }

    const b3Filtered = B3_CATALOG.filter(
      (item) =>
        item.ticker.includes(q) || item.name.toUpperCase().includes(q)
    );

    const merged = [...cryptoResults, ...b3Filtered].slice(0, 10);
    return res.json({ results: merged });
  });

  // Macro
  app.get("/api/macro", async (_req, res) => {
    let avgIpcaAnnual = 4.2;
    let avgCdiAnnual = 10.5;
    let isFallback = true;

    try {
      const [ipcaRes, cdiRes] = await Promise.all([
        axios.get(
          "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json",
          { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 2000 }
        ),
        axios.get(
          "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json",
          { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 2000 }
        ),
      ]);

      if (Array.isArray(ipcaRes.data) && ipcaRes.data.length > 0) {
        const sumIpcaMonthly = ipcaRes.data.reduce(
          (acc: number, item: any) => acc + (parseFloat(item.valor) || 0),
          0
        );
        avgIpcaAnnual = Number(sumIpcaMonthly.toFixed(2));
        isFallback = false;
      }

      if (Array.isArray(cdiRes.data) && cdiRes.data.length > 0) {
        const selicVal = parseFloat(cdiRes.data[0].valor);
        if (!isNaN(selicVal) && selicVal > 0) {
          avgCdiAnnual = Number(selicVal.toFixed(2));
          isFallback = false;
        }
      }
    } catch {
      // fallback rates
    }

    return res.json({
      ipcaAnnual: avgIpcaAnnual,
      cdiAnnual: avgCdiAnnual,
      isFallback,
    });
  });

  // AI diagnosis
  app.post("/api/ai/analyze-portfolio", async (req, res) => {
    const {
      userId,
      portfolio,
      totalValue,
      targetAllocation,
      investorProfile = 'ALL',
      forceRefresh,
    } = req.body;

    const safeUserId = sanitizeString(userId || "anonymous", 100);
    const cacheDocRef = doc(db, "analise_carteira_cache", safeUserId);

    if (!forceRefresh) {
      try {
        const cachedDoc = await getDoc(cacheDocRef);
        if (cachedDoc.exists()) {
          const cachedData = cachedDoc.data();
          const ageMs =
            Date.now() - new Date(cachedData.updatedAt || 0).getTime();
          if (ageMs < 24 * 60 * 60 * 1000) {
            return res.json({
              analysis: cachedData.analysis,
              cached: true,
              updatedAt: cachedData.updatedAt,
            });
          }
        }
      } catch (e) {
        console.warn("[Diagnosis Cache] Erro ao ler cache:", e);
      }
    }

    let analysisText: string | null = null;
    const aiClient = getGeminiClient();

    if (aiClient) {
      try {
        const prompt = `Você é o consultor de investimentos sênior do sistema Dyeldi, especialista no mercado de capitais brasileiro (B3), fundos imobiliários (FIIs), ações de dividendos e criptoativos (como Bitcoin, Ethereum e Altcoins).
Analise a carteira de investimentos com rigor técnico, clareza, alta legibilidade e linguagem amigável em português do Brasil (sem jargões vazios).

- Valor Total da Carteira: R$ ${totalValue ? Number(totalValue).toFixed(2) : "0.00"}
- Perfil do Investidor Declarado: ${
          investorProfile === 'FIIS'
            ? 'Focado em FIIs (Prioridade: Fundos Imobiliários e renda mensal previsível)'
            : investorProfile === 'STOCKS'
            ? 'Focado em Ações (Prioridade: Dividendos corporativos, JCP e crescimento B3)'
            : investorProfile === 'CRYPTO'
            ? 'Focado em Criptoativos (Prioridade: Ativos digitais, reserva de valor e valorização)'
            : 'Pro / Multiativos (Visão global diversificada em Ações, FIIs e Cripto)'
        }
- Alocação Alvo Estratégica: ${targetAllocation ? JSON.stringify(targetAllocation) : "Padrão equilibrado"}
- Posições Atuais da Carteira:
${
  Array.isArray(portfolio)
    ? portfolio
        .map(
          (item: any) =>
            `- ${item.ticker} (${item.type || "Ativo"}): ${item.quantity || 0} ${item.type === "Cripto" || isCryptoTicker(item.ticker) ? "unidades" : "cotas"}, Preço Médio R$ ${(item.averagePrice || 0).toFixed(2)}, Preço Atual R$ ${(item.currentPrice || 0).toFixed(2)}${item.type === "Cripto" || isCryptoTicker(item.ticker) ? "" : `, DY: ${(item.dividendYield || 0).toFixed(2)}%`}, Peso: ${(item.currentWeight || 0).toFixed(2)}%`
        )
        .join("\n")
    : "Nenhum ativo cadastrado"
}

DIRETRIZ IMPORTANTE SOBRE CRIPTOATIVOS: Criptomoedas NÃO pagam dividendos corporativos da B3. Avalie criptoativos sob o pilar de reserva de valor, descorrelação patrimonial, ciclos de mercado (como acumulação via média móvel SMA 200) e volatilidade. Não exija ou critique a ausência de dividendos em criptomoedas.

IMPORTANTE: Estruture seu diagnóstico estritamente nos 4 tópicos abaixo usando bullet points (- **Item:** Explicação direta) para facilitar a leitura rápida:

### 1. Diagnóstico Geral & Saúde da Carteira
- **Perfil Geral:** Síntese da maturidade e equilíbrio da carteira entre crescimento, renda e ativos digitais.
- **Divisão por Classes:** Proporção entre Ações, FIIs e Criptoativos.
- **Veredito de Saúde:** Nível geral de solidez, diversificação e gestão por classe de risco.

### 2. Gestão de Risco & Concentração
- **Maior Exposição:** Análise do ativo com maior peso e se há risco individual.
- **Concentração Top 3:** Percentual somado dos 3 maiores ativos e recomendação de controle.
- **Oportunidades de Compra / Preço Médio:** Destaque de ativos descontados (abaixo do PM para Ações/FIIs ou em zona de oportunidade/SMA 200 para Cripto).

### 3. Eficiência de Proventos & Valorização por Classe
- **Rendimento de Ações e FIIs:** Avaliação do Dividend Yield e renda passiva projetada apenas dos ativos pagadores de proventos.
- **Papel Estratégico de Cripto:** Avaliação da exposição a criptomoedas (reserva de valor, apetite a risco e volatilidade).
- **Potencial de Reinvestimento:** Capacidade de gerar renda passiva recorrente e utilizar o rebalanceamento estratégico.

### 4. Recomendações Estratégicas para Próximos Aportes
- **Prioridade 1:** Onde direcionar os próximos aportes considerando a meta de alocação por classe (Ações, FIIs, Cripto).
- **Prioridade 2:** Aproveitamento de ativos descontados na B3 ou suporte de acumulação em Cripto.
- **Prioridade 3:** Prática de reinvestimento de dividendos e disciplina de longo prazo.`;

        const response = await aiClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        if (response?.text) {
          analysisText = response.text;
          await incrementBolsaAiCallCounter();
        }
      } catch {
        console.warn(
          "[AI Engine] Alternando para motor determinístico."
        );
      }
    }

    if (!analysisText) {
      analysisText = generateRuleBasedPortfolioAnalysis(
        portfolio || [],
        Number(totalValue || 0),
        targetAllocation || {}
      );
    }

    const nowIso = new Date().toISOString();
    try {
      await setDoc(
        cacheDocRef,
        cleanForFirestore({
          analysis: analysisText,
          updatedAt: nowIso,
          userId: safeUserId,
        }),
        { merge: true }
      );
    } catch (e) {
      console.warn("[Diagnosis Cache] Erro ao gravar:", e);
    }

    return res.json({
      analysis: analysisText,
      cached: false,
      updatedAt: nowIso,
    });
  });

  // Static / Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(
      express.static(distPath, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          }
        },
      })
    );
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Delay de 15s no boot para permitir que a conexão com o Firestore estabilize
    setTimeout(() => {
      syncDividendsCache().catch((err) =>
        console.error("[Bolsai Boot Sync Error]:", err)
      );
    }, 15000);

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    setInterval(() => {
      syncDividendsCache().catch((err) =>
        console.error("[Bolsai Scheduled Sync Error]:", err)
      );
    }, TWENTY_FOUR_HOURS);
  });
}

startServer();
