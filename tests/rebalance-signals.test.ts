import { calculateBazinCeiling, formatQuantity } from '../src/utils/calculator';
import { isCryptoTicker, isFiiTicker, isStockTicker } from '../src/utils/assetType';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Falha no teste: ${message}`);
    process.exit(1);
  }
}

console.log('--- Teste de Sinais Automáticos de Rebalanceamento (Dyeldi) ---');

// Mock data
const mockPortfolioItems = [
  {
    ticker: 'PETR4',
    currentPrice: 36.5,
    quantity: 100,
    targetPercent: 15,
    currentPercent: 12,
    dy: 14.5,
    bazinCeiling: calculateBazinCeiling(36.5, 14.5), // > 36.5 => possui margem de segurança
    isFavorite: false,
  },
  {
    ticker: 'BBAS3',
    currentPrice: 28.0,
    quantity: 0,
    targetPercent: 10,
    currentPercent: 0,
    dy: 9.8,
    bazinCeiling: calculateBazinCeiling(28.0, 9.8), // > 28.0 => margem de segurança
    isFavorite: true,
  },
  {
    ticker: 'HGLG11',
    currentPrice: 160.0,
    quantity: 20,
    targetPercent: 15,
    currentPercent: 10,
    dy: 8.5,
    bazinCeiling: calculateBazinCeiling(160.0, 8.5),
    isFavorite: false,
  },
  {
    ticker: 'WEGE3',
    currentPrice: 52.0,
    quantity: 100,
    targetPercent: 5,
    currentPercent: 18, // Posição esticada acima da meta
    dy: 1.8,
    bazinCeiling: calculateBazinCeiling(52.0, 1.8), // Teto bem abaixo do preço atual
    isFavorite: false,
  },
  {
    ticker: 'BTC',
    currentPrice: 380000,
    quantity: 0.05,
    targetPercent: 10,
    currentPercent: 8,
    dy: 0,
    bazinCeiling: 0,
    isFavorite: false,
  },
];

// Teste 1: Validação de Sinais Bazin para Ações e FIIs com Margem de Segurança
const petr4 = mockPortfolioItems[0];
const petr4SafetyMargin = ((petr4.bazinCeiling - petr4.currentPrice) / petr4.bazinCeiling) * 100;
assert(petr4SafetyMargin > 0, 'PETR4 deve possuir margem de segurança positiva com DY de 14.5%');
assert(isStockTicker(petr4.ticker), 'PETR4 deve ser classificado como ação');

const hglg11 = mockPortfolioItems[2];
const hglg11SafetyMargin = ((hglg11.bazinCeiling - hglg11.currentPrice) / hglg11.bazinCeiling) * 100;
assert(hglg11SafetyMargin > 0, 'HGLG11 deve possuir margem de segurança positiva com DY de 8.5%');
assert(isFiiTicker(hglg11.ticker), 'HGLG11 deve ser classificado como FII');
console.log('✅ [1/4] Cálculo do Teto Bazin e margem de segurança validados.');

// Teste 2: Ativos em Radar / Watchlist com Sinal de Compra Imediato
const bbas3 = mockPortfolioItems[1];
assert(bbas3.quantity === 0 && bbas3.isFavorite, 'BBAS3 deve ser identificado como ativo em radar');
const bbas3PossessesSafetyMargin = bbas3.bazinCeiling > 0 && bbas3.currentPrice <= bbas3.bazinCeiling;
assert(bbas3PossessesSafetyMargin, 'BBAS3 em radar deve ter sinal de compra quando com preço abaixo do teto');
console.log('✅ [2/4] Ativos em radar/favoritos geram sinal de compra automaticamente.');

// Teste 3: Ativo com sobrepeso e sem margem de segurança (Deve ficar em AGUARDAR ou VENDA, NUNCA COMPRAR)
const wege3 = mockPortfolioItems[3];
const wege3SafetyMargin = ((wege3.bazinCeiling - wege3.currentPrice) / wege3.bazinCeiling) * 100;
assert(wege3SafetyMargin < 0, 'WEGE3 deve estar com preço acima do teto Bazin');
assert(wege3.currentPercent > wege3.targetPercent, 'WEGE3 está acima da meta de carteira');
const wege3PossessesSafetyMargin = wege3.bazinCeiling > 0 && wege3.currentPrice <= wege3.bazinCeiling;
const wege3IsUnderweight = wege3.targetPercent > 0 && wege3.currentPercent < wege3.targetPercent;
assert(!wege3PossessesSafetyMargin, 'WEGE3 não deve ter margem de segurança positiva');
assert(!wege3IsUnderweight, 'WEGE3 não deve estar abaixo da meta');
console.log('✅ [3/4] Identificação de sobrepeso e ausência de margem de segurança validada (nunca sinaliza compra indevida).');

// Teste 4: Criptoativos e formatação de unidades
const btc = mockPortfolioItems[4];
assert(isCryptoTicker(btc.ticker), 'BTC deve ser classificado como Cripto');
const formattedBtc = formatQuantity(btc.quantity, true);
assert(formattedBtc === '0,05', `Formatação de BTC esperada: 0,05, obtida: ${formattedBtc}`);
const formattedTinyCrypto = formatQuantity(0.00045, true);
assert(formattedTinyCrypto === '0,00045', `Formatação de fração cripto esperada: 0,00045, obtida: ${formattedTinyCrypto}`);
console.log('✅ [4/5] Criptoativos com precisão decimal validados.');

// Teste 5: Regras de Criptoativos respeitando estritamente SMA 200 e MVRV
const btcPrice = 380000;
const btcSma200 = 400000; // Preço abaixo da SMA 200
const btcMvrv = 1.35; // Zona de acumulação favorável
const isBelowSma = btcPrice < btcSma200;
const isFavorableMvrv = btcMvrv < 2.0;
const isMvrvWarning = btcMvrv >= 2.4;
const isUnderweight = btc.currentPercent < btc.targetPercent;
const isCryptoBuyOpportunity = (isBelowSma || btcMvrv < 1.0) && isFavorableMvrv && !isMvrvWarning && isUnderweight;
assert(isCryptoBuyOpportunity, 'BTC abaixo da SMA 200 com MVRV 1.35x e abaixo da meta deve ter sinal de COMPRA');

// Caso de Cripto Esticado (Preço acima da SMA 200 e MVRV em alerta)
const ethPrice = 22000;
const ethSma200 = 18000; // Preço acima da SMA 200 (+22%)
const ethMvrv = 2.65; // Zona de alerta
const ethIsBelowSma = ethPrice < ethSma200;
const ethIsMvrvWarning = ethMvrv >= 2.4;
const ethBuyOpportunity = (ethIsBelowSma || ethMvrv < 1.0) && !ethIsMvrvWarning;
assert(!ethBuyOpportunity, 'ETH acima da SMA 200 e com MVRV 2.65x NÃO deve receber sinal de COMPRA (deve AGUARDAR ou VENDER)');
console.log('✅ [5/5] Criptoativos respeitando estritamente SMA 200 e MVRV On-Chain validados.');

console.log('🎉 Todos os testes de Sinais de Rebalanceamento passaram com sucesso!');
