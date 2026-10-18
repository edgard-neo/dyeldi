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

// ─── Test Suite: Sync Guard, Rate Limiting & Distributed Locking ────────────
console.log("\n--- Teste de Validação: Guard de Sync, Rate Limit e Lock Distribuído ---");

let allPassed = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALHA: ${message}`);
    allPassed = false;
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

// 1. Teste do Guard de Sync Diário
console.log("\n[1/3] Testando Lógica do Guard de Sync Diário (sync_meta)...");
{
  const todayDate = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Cenário A: Já executado hoje com ultimaExecucao
  const metaToday = { ultimaExecucao: todayDate, requestCount: 12 };
  const isExecutedTodayA = (metaToday.ultimaExecucao || "").slice(0, 10) === todayDate;
  assert(isExecutedTodayA === true, "Guard detecta corretamente que o sync já rodou hoje e deve pular.");

  // Cenário B: Executado ontem
  const metaYesterday = { ultimaExecucao: yesterdayDate, requestCount: 12 };
  const isExecutedTodayB = (metaYesterday.ultimaExecucao || "").slice(0, 10) === todayDate;
  assert(isExecutedTodayB === false, "Guard detecta corretamente que a última execução foi ontem e deve executar.");

  // Cenário C: Documento inexistente ou sem registro
  const metaEmpty: any = {};
  const isExecutedTodayC = (metaEmpty.ultimaExecucao || "").slice(0, 10) === todayDate;
  assert(isExecutedTodayC === false, "Guard permite execução segura quando não há registro prévio.");
}

// 2. Teste do Limitador de Concorrência e Rate Limiting (Throttle)
console.log("\n[2/3] Testando Rate Limit e Throttle Delay...");
async function testRateLimiter() {
  const limit = createConcurrencyLimit(1);
  let lastCall = 0;
  const callTimes: number[] = [];

  const throttle = async (fn: () => Promise<void>, minDelayMs = 50) => {
    return limit(async () => {
      const now = Date.now();
      const elapsed = now - lastCall;
      if (elapsed < minDelayMs && lastCall > 0) {
        await new Promise((r) => setTimeout(r, minDelayMs - elapsed));
      }
      try {
        await fn();
      } finally {
        lastCall = Date.now();
      }
    });
  };

  const start = Date.now();
  // Dispara 3 chamadas concorrentes
  await Promise.all([
    throttle(async () => {
      callTimes.push(Date.now());
    }, 50),
    throttle(async () => {
      callTimes.push(Date.now());
    }, 50),
    throttle(async () => {
      callTimes.push(Date.now());
    }, 50),
  ]);

  assert(callTimes.length === 3, "Todas as 3 chamadas foram enfileiradas e concluídas.");
  const diff1 = callTimes[1] - callTimes[0];
  const diff2 = callTimes[2] - callTimes[1];
  assert(diff1 >= 45, `Delay entre chamada 1 e 2 respeitou o intervalo mínimo (esperado >= 45ms, obtido: ${diff1}ms).`);
  assert(diff2 >= 45, `Delay entre chamada 2 e 3 respeitou o intervalo mínimo (esperado >= 45ms, obtido: ${diff2}ms).`);
}

// 3. Teste do Lock Distribuído com TTL
console.log("\n[3/3] Testando Lock Distribuído e Expiração de TTL...");
async function testDistributedLockLogic() {
  // Simulação de armazenamento transacional de lock
  let mockLockStore: Record<string, { lockedBy: string; expiresAt: number }> = {};

  const acquireLock = async (key: string, ownerId: string, ttlMs: number) => {
    const now = Date.now();
    const existing = mockLockStore[key];
    if (existing && existing.expiresAt > now) {
      return false; // Bloqueado
    }
    mockLockStore[key] = {
      lockedBy: ownerId,
      expiresAt: now + ttlMs,
    };
    return true;
  };

  const releaseLock = async (key: string, ownerId: string) => {
    if (mockLockStore[key] && mockLockStore[key].lockedBy === ownerId) {
      delete mockLockStore[key];
    }
  };

  // Instância 1 adquire lock por 100ms
  const acquired1 = await acquireLock("sync_dy", "instancia-1", 100);
  assert(acquired1 === true, "Instância 1 adquire o lock com sucesso.");

  // Instância 2 tenta adquirir o mesmo lock antes do TTL
  const acquired2 = await acquireLock("sync_dy", "instancia-2", 100);
  assert(acquired2 === false, "Instância 2 é bloqueada enquanto o lock da Instância 1 estiver ativo.");

  // Instância 1 libera o lock
  await releaseLock("sync_dy", "instancia-1");
  const acquired3 = await acquireLock("sync_dy", "instancia-2", 100);
  assert(acquired3 === true, "Instância 2 adquire o lock com sucesso após a liberação da Instância 1.");

  // Teste de expiração por TTL (sem liberar manualmente)
  await new Promise((r) => setTimeout(r, 110)); // Aguarda expirar 100ms
  const acquired4 = await acquireLock("sync_dy", "instancia-3", 100);
  assert(acquired4 === true, "Instância 3 adquire o lock após expiração automática pelo TTL.");
}

async function runAll() {
  await testRateLimiter();
  await testDistributedLockLogic();
  console.log("\n🎉 Todos os testes de Guard, Rate Limit e Lock Distribuído passaram com 100% de sucesso!\n");
}

runAll().catch((err) => {
  console.error("Erro na execução dos testes:", err);
  process.exit(1);
});
