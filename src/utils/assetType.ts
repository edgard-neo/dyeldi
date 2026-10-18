// Utilitário centralizado para classificação e identificação de ativos B3 e Criptoativos

export const CRYPTO_TICKERS = [
  // Top Market Cap & Layer 1s
  'BTC',
  'ETH',
  'SOL',
  'BNB',
  'XRP',
  'ADA',
  'AVAX',
  'TRX',
  'TON',
  'DOT',
  'SUI',
  'NEAR',
  'APT',
  'SEI',
  'KAS',
  'ICP',
  'HBAR',
  'ATOM',
  'BCH',
  'LTC',
  'XLM',
  'XMR',
  'ETC',
  'VET',
  'ALGO',
  'FTM',
  'TIA',
  'INJ',
  'STX',
  'KAVA',
  'FLOW',
  'MINA',
  'EGLD',
  'ASTR',
  'RON',
  'NEO',
  'ZEC',
  'IOTA',
  'EOS',
  'KLAY',

  // Layer 2 & Rollups
  'MATIC',
  'POL',
  'ARB',
  'OP',
  'STRK',
  'MANTA',
  'BLAST',
  'ZK',
  'METIS',
  'IMX',

  // Stablecoins & Wrapped
  'USDT',
  'USDC',
  'DAI',
  'FDUSD',
  'USDE',
  'WBTC',
  'WETH',

  // DeFi, RWA, Staking & Oracles
  'LINK',
  'UNI',
  'AAVE',
  'MKR',
  'LDO',
  'ONDO',
  'PENDLE',
  'ENA',
  'JUP',
  'RAY',
  'CRV',
  'SNX',
  'COMP',
  'DYDX',
  'RUNE',
  '1INCH',
  'CAKE',
  'GMX',
  'PYTH',
  'SUSHI',
  'RPL',

  // AI, DePIN & Big Data / Storage
  'TAO',
  'RENDER',
  'RNDR',
  'FET',
  'GRT',
  'FIL',
  'AR',
  'THETA',
  'WLD',
  'AKT',
  'IO',
  'JASMY',
  'OCEAN',

  // Memecoins
  'DOGE',
  'SHIB',
  'PEPE',
  'WIF',
  'BONK',
  'FLOKI',
  'BRETT',
  'POPCAT',
  'BOME',
  'MEW',
  'NEIRO',
  'MOG',

  // Gaming, NFT & Metaverse
  'GALA',
  'SAND',
  'MANA',
  'AXS',
  'BEAM',
  'NOT',
  'APE',
  'CHZ',
  'ENJ',
  'REN'
];

export const UNITS_EXCEPTIONS = [
  'TAEE11',
  'SANB11',
  'KLBN11',
  'SAPR11',
  'ALUP11',
  'BIDI11',
  'BPAC11',
  'ITSA11',
  'SOMA11',
  'AESB11'
];

export const KNOWN_ASSET_NAMES: Record<string, string> = {
  // Ações Principais B3
  PETR4: 'Petrobras PN',
  PETR3: 'Petrobras ON',
  VALE3: 'Vale S.A.',
  BBAS3: 'Banco do Brasil ON',
  ITUB4: 'Itaú Unibanco PN',
  ITUB3: 'Itaú Unibanco ON',
  BBDC4: 'Bradesco PN',
  BBDC3: 'Bradesco ON',
  ITSA4: 'Itaúsa PN',
  ITSA3: 'Itaúsa ON',
  WEGE3: 'WEG S.A.',
  TAEE11: 'Taesa Unit',
  TAEE4: 'Taesa PN',
  TAEE3: 'Taesa ON',
  EGIE3: 'Engie Brasil Energia',
  CPLE6: 'Copel PNB',
  CPLE3: 'Copel ON',
  CMIG4: 'Cemig PN',
  CMIG3: 'Cemig ON',
  SAPR11: 'Sanepar Unit',
  SAPR4: 'Sanepar PN',
  KLBN11: 'Klabin Unit',
  KLBN4: 'Klabin PN',
  SUZB3: 'Suzano S.A.',
  PRIO3: 'PRIO S.A.',
  RENT3: 'Localiza Rent a Car',
  VIVT3: 'Telefônica Brasil (Vivo)',
  BBSE3: 'BB Seguridade ON',
  CXSE3: 'Caixa Seguridade ON',
  PSSA3: 'Porto Seguro S.A.',
  SANB11: 'Santander Brasil Unit',
  BPAC11: 'BTG Pactual Unit',
  RADL3: 'RaiaDrogasil S.A.',
  FLRY3: 'Fleury S.A.',
  MGLU3: 'Magazine Luiza ON',
  LREN3: 'Lojas Renner ON',
  CSAN3: 'Cosan S.A.',
  ABEV3: 'Ambev S.A.',
  EMBR3: 'Embraer S.A.',
  JBSS3: 'JBS S.A.',
  BRFS3: 'BRF S.A.',
  BEEF3: 'Minerva Foods',
  MRVE3: 'MRV Engenharia',
  CYRE3: 'Cyrela Realty',
  EQTL3: 'Equatorial Energia',
  TRPL4: 'ISA CTEEP PN',
  VBBR3: 'Vibra Energia',
  USIM5: 'Usiminas PNA',
  CSNA3: 'CSN S.A.',
  GGBR4: 'Gerdau PN',
  GOAU4: 'Metalúrgica Gerdau PN',
  MULT3: 'Multiplan Shopping',
  IGTI11: 'Iguatemi Unit',
  ALOS3: 'Allos Shopping',
  SBSP3: 'Sabesp S.A.',
  ALUP11: 'Alupar Unit',
  ASAI3: 'Assaí Atacadista',
  CRFB3: 'Carrefour Brasil',
  TIMS3: 'TIM S.A.',
  ELET3: 'Eletrobras ON',
  ELET6: 'Eletrobras PNB',
  RAIZ4: 'Raízen PN',
  SLCE3: 'SLC Agrícola',
  SMTO3: 'São Martinho',

  // FIIs Populares
  MXRF11: 'Maxi Renda FII',
  HGLG11: 'CSHG Logística FII',
  KNRI11: 'Kinea Renda Imobiliária FII',
  XPML11: 'XP Malls FII',
  VISC11: 'Vinci Shopping Centers FII',
  BTLG11: 'BTG Pactual Logística FII',
  XPLG11: 'XP Log FII',
  KNCR11: 'Kinea Rendimentos FII',
  KNHY11: 'Kinea High Yield FII',
  CPTS11: 'Capitânia Securities FII',
  VGIR11: 'Valora RE III FII',
  IRDM11: 'Iridium Recebíveis FII',
  RECR11: 'REC Recebíveis FII',
  BCFF11: 'BTG Fundo de Fundos FII',
  HGRU11: 'CSHG Renda Urbana FII',
  HGBS11: 'Hedge Brasil Shopping FII',
  RBRR11: 'RBR High Grade FII',
  TGAR11: 'TG Ativo Real FII',
  TRXF11: 'TRX Real Estate FII',
  JSRE11: 'JS Real Estate FII',
  VRTA11: 'Fator Veritá FII',
  VGHF11: 'Valora Hedge Fund FII',
  RURA11: 'Itaú Asset Rural Fiagro',
  VGIA11: 'Valora CRA Fiagro',
  KNCA11: 'Kinea Crédito Agro Fiagro',
  SNAG11: 'Suno Agro Fiagro',
  GALG11: 'Guardian Logística FII',
  ALZR11: 'Alianza Trust Renda FII',
  HFOF11: 'Hedge Top FOFII 3 FII',
  GGRC11: 'GGR Covepi Renda FII',
  VINO11: 'Vinci Offices FII',
  BRCO11: 'Bresco Logística FII',
  LVBI11: 'VBI Logístico FII',
  PVBI11: 'VBI Prime Properties FII',
  KFOF11: 'Kinea FOF FII',

  // Criptoativos
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  BNB: 'BNB',
  USDT: 'Tether USD',
  USDC: 'USD Coin',
  XRP: 'XRP (Ripple)',
  ADA: 'Cardano',
  DOGE: 'Dogecoin',
  AVAX: 'Avalanche',
  TRX: 'TRON',
  TON: 'Toncoin',
  DOT: 'Polkadot',
  SUI: 'Sui',
  NEAR: 'NEAR Protocol',
  APT: 'Aptos',
  SEI: 'Sei',
  KAS: 'Kaspa',
  ICP: 'Internet Computer',
  HBAR: 'Hedera',
  ATOM: 'Cosmos',
  BCH: 'Bitcoin Cash',
  LTC: 'Litecoin',
  XLM: 'Stellar',
  XMR: 'Monero',
  ETC: 'Ethereum Classic',
  VET: 'VeChain',
  ALGO: 'Algorand',
  FTM: 'Fantom',
  TIA: 'Celestia',
  INJ: 'Injective',
  STX: 'Stacks',
  KAVA: 'Kava',
  FLOW: 'Flow',
  MINA: 'Mina',
  EGLD: 'MultiversX',
  ASTR: 'Astar',
  RON: 'Ronin',
  NEO: 'Neo',
  ZEC: 'Zcash',
  IOTA: 'IOTA',
  EOS: 'EOS',
  KLAY: 'Kaia (Klaytn)',
  MATIC: 'Polygon',
  POL: 'Polygon Ecosystem Token',
  ARB: 'Arbitrum',
  OP: 'Optimism',
  STRK: 'Starknet',
  MANTA: 'Manta Network',
  BLAST: 'Blast',
  ZK: 'ZKsync',
  METIS: 'Metis',
  IMX: 'Immutable',
  DAI: 'Dai',
  FDUSD: 'First Digital USD',
  USDE: 'Ethena USDe',
  WBTC: 'Wrapped Bitcoin',
  WETH: 'Wrapped Ethereum',
  LINK: 'Chainlink',
  UNI: 'Uniswap',
  AAVE: 'Aave',
  MKR: 'Maker',
  LDO: 'Lido DAO',
  ONDO: 'Ondo Finance',
  PENDLE: 'Pendle',
  ENA: 'Ethena',
  JUP: 'Jupiter',
  RAY: 'Raydium',
  CRV: 'Curve DAO',
  SNX: 'Synthetix',
  COMP: 'Compound',
  DYDX: 'dYdX',
  RUNE: 'THORChain',
  '1INCH': '1inch',
  CAKE: 'PancakeSwap',
  GMX: 'GMX',
  PYTH: 'Pyth Network',
  SUSHI: 'SushiSwap',
  RPL: 'Rocket Pool',
  TAO: 'Bittensor',
  RENDER: 'Render',
  RNDR: 'Render Token',
  FET: 'Artificial Superintelligence Alliance',
  GRT: 'The Graph',
  FIL: 'Filecoin',
  AR: 'Arweave',
  THETA: 'Theta Network',
  WLD: 'Worldcoin',
  AKT: 'Akash Network',
  IO: 'io.net',
  JASMY: 'JasmyCoin',
  OCEAN: 'Ocean Protocol',
  SHIB: 'Shiba Inu',
  PEPE: 'Pepe',
  WIF: 'dogwifhat',
  BONK: 'Bonk',
  FLOKI: 'FLOKI',
  BRETT: 'Brett',
  POPCAT: 'Popcat',
  BOME: 'BOOK OF MEME',
  MEW: 'cat in a dogs world',
  NEIRO: 'First Neiro on Ethereum',
  MOG: 'Mog Coin',
  GALA: 'GALA',
  SAND: 'The Sandbox',
  MANA: 'Decentraland',
  AXS: 'Axie Infinity',
  BEAM: 'Beam',
  NOT: 'Notcoin',
  APE: 'ApeCoin',
  CHZ: 'Chiliz',
  ENJ: 'Enjin Coin',
  REN: 'Ren Protocol',
};

/**
 * Retorna o nome amigável de exibição para qualquer ativo (Ação, FII ou Cripto)
 */
export function getAssetName(ticker: string, quoteName?: string): string {
  if (!ticker) return '';
  const clean = ticker.trim().toUpperCase();
  if (KNOWN_ASSET_NAMES[clean]) {
    return KNOWN_ASSET_NAMES[clean];
  }
  if (quoteName && quoteName.trim() && quoteName !== clean) {
    // Limpa sufixos excessivamente longos como " - BANCO DO BRASIL S.A."
    return quoteName
      .replace(/\s*-\s*(ON|PN|UNT|CI|DIR).*$/i, '')
      .replace(/\s+S\.?A\.?/i, ' S.A.')
      .trim();
  }
  if (isFiiTicker(clean)) {
    return `Fundo Imobiliário ${clean}`;
  }
  if (isCryptoTicker(clean)) {
    return `Criptoativo ${clean}`;
  }
  return `Ação ${clean}`;
}

/**
 * Verifica se um ticker é um criptoativo
 */
export function isCryptoTicker(ticker: string): boolean {
  if (!ticker) return false;
  const normalized = ticker.trim().toUpperCase().replace(/USD$|BRL$/, '');
  return CRYPTO_TICKERS.includes(normalized) || CRYPTO_TICKERS.includes(ticker.trim().toUpperCase());
}

/**
 * Verifica se um ticker é um FII (Fundo de Investimento Imobiliário)
 */
export function isFiiTicker(ticker: string): boolean {
  if (!ticker) return false;
  const clean = ticker.trim().toUpperCase();
  if (isCryptoTicker(clean)) return false;
  if (!clean.endsWith('11')) return false;
  return !UNITS_EXCEPTIONS.includes(clean);
}

/**
 * Verifica se um ticker é uma ação da B3
 */
export function isStockTicker(ticker: string): boolean {
  if (!ticker) return false;
  const clean = ticker.trim().toUpperCase();
  if (isCryptoTicker(clean)) return false;
  if (isFiiTicker(clean)) return false;
  return true;
}
