import assert from 'node:assert';
import { isCryptoTicker, isFiiTicker, isStockTicker, getAssetName, CRYPTO_TICKERS } from '../src/utils/assetType';

console.log('--- Teste de Validação do Catálogo de Criptomoedas (Dyeldi) ---');

// 1. Validar lista principal de Criptos Famosas
const popularCryptos = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'TRX', 'TON', 'DOT',
  'SUI', 'NEAR', 'APT', 'SEI', 'KAS', 'ICP', 'HBAR', 'ATOM', 'BCH', 'LTC',
  'XLM', 'XMR', 'ETC', 'VET', 'ALGO', 'FTM', 'TIA', 'INJ', 'STX', 'POL',
  'MATIC', 'ARB', 'OP', 'USDT', 'USDC', 'DAI', 'LINK', 'UNI', 'AAVE', 'MKR',
  'LDO', 'ONDO', 'PENDLE', 'ENA', 'JUP', 'RAY', 'TAO', 'RENDER', 'FET', 'GRT',
  'FIL', 'DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'GALA', 'SAND', 'MANA'
];

popularCryptos.forEach((ticker) => {
  assert.strictEqual(
    isCryptoTicker(ticker),
    true,
    `Ticker ${ticker} deve ser reconhecido como criptoativo`
  );
  assert.strictEqual(
    isFiiTicker(ticker),
    false,
    `Ticker ${ticker} NÃO deve ser considerado FII`
  );
  assert.strictEqual(
    isStockTicker(ticker),
    false,
    `Ticker ${ticker} NÃO deve ser considerado Ação B3`
  );
});

console.log(`✅ [1/4] Todas as ${popularCryptos.length} criptomoedas famosas foram validadas com sucesso.`);

// 2. Validar normalizações e Edge Cases
assert.strictEqual(isCryptoTicker('btc'), true, 'Lowercase btc deve ser identificado');
assert.strictEqual(isCryptoTicker('  ETH  '), true, 'ETH com espaços deve ser identificado');
assert.strictEqual(isCryptoTicker('SOLBRL'), true, 'SOLBRL com sufixo BRL deve ser identificado');
assert.strictEqual(isCryptoTicker('ADAUSD'), true, 'ADAUSD com sufixo USD deve ser identificado');
console.log('✅ [2/4] Casos de borda de formatação e pares de moedas validados.');

// 3. Validar não colisão com ativos B3
const b3Assets = ['PETR4', 'VALE3', 'BBAS3', 'MXRF11', 'HGLG11', 'TAEE11', 'WEGE3'];
b3Assets.forEach((ticker) => {
  assert.strictEqual(
    isCryptoTicker(ticker),
    false,
    `Ativo B3 ${ticker} NÃO pode ser classificado como cripto`
  );
});
console.log('✅ [3/4] Isolamento entre ativos da B3 e Criptoativos validado.');

// 4. Validar nomes amigáveis em getAssetName
assert.strictEqual(getAssetName('BTC'), 'Bitcoin');
assert.strictEqual(getAssetName('ETH'), 'Ethereum');
assert.strictEqual(getAssetName('SOL'), 'Solana');
assert.strictEqual(getAssetName('TRX'), 'TRON');
assert.strictEqual(getAssetName('TON'), 'Toncoin');
assert.strictEqual(getAssetName('PEPE'), 'Pepe');
assert.strictEqual(getAssetName('ONDO'), 'Ondo Finance');
assert.strictEqual(getAssetName('TAO'), 'Bittensor');
console.log('✅ [4/4] Nomes amigáveis e resolução de ativos conferidos.');

console.log('🎉 Todos os testes de Criptoativos passaram com 100% de sucesso!');
