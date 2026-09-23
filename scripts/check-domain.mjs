import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Banking-domain units plus API-client units with controlled HTTP replies.
// Real HTTP and UI integration are covered by the separate demo Playwright suite.
const require = createRequire(import.meta.url);
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const bankUrl = moduleUrl(
  compile(readFileSync(new URL('../lib/bank.ts', import.meta.url), 'utf8')),
);
const b = await import(bankUrl);
let checks = 0;
function check(name, run) {
  run();
  checks++;
  console.log(`✓ ${name}`);
}
async function checkAsync(name, run) {
  await run();
  checks++;
  console.log(`✓ ${name}`);
}
const seed = (scenario = 'baseline') => b.seedBank(scenario, 'checks');
const draft = (state, amount = '10.25', own = false) =>
  b.prepareTransfer(
    state,
    'current',
    own ? '' : 'alex',
    own ? 'savings' : '',
    amount,
    'Demo transfer',
  );
const reject = (fn, code) =>
  assert.throws(
    fn,
    (error) => error instanceof b.BankError && (!code || error.code === code),
  );
check('Exact cents and decimal separators', () => {
  assert.equal(b.parseAmount('12.34'), 1234);
  assert.equal(b.parseAmount('12,34'), 1234);
  for (const amount of ['', '0', '-1', '1.005', '1e2', '50000.01'])
    reject(() => b.parseAmount(amount));
});
check('IBAN checksum and recipient uniqueness', () => {
  const state = seed();
  assert.ok(b.validIban(b.demoIban('30000001')));
  const next = b.addPayee(state, 'New recipient', b.demoIban('30000001'));
  assert.equal(next.payees.length, state.payees.length + 1);
  reject(() => b.addPayee(next, 'Duplicate', b.demoIban('30000001')));
  reject(() => b.addPayee(state, 'Own account', state.accounts[0].iban));
  reject(() => b.addPayee(state, 'Bad checksum', 'BG00DEMO80001030000001'));
});
check('Available funds include holds and external transfer fee', () => {
  const state = seed(),
    snapshot = structuredClone(state);
  const result = b.confirmTransfer(state, draft(state, '6290.30'), b.DEMO_PIN);
  assert.equal(result.state.accounts[0].balance, 16000);
  assert.equal(result.state.accounts[0].held, 16000);
  assert.equal(result.receipt.fee, 50);
  reject(() => draft(state, '6290.31'), 'insufficient_funds');
  assert.deepEqual(state, snapshot);
});
check('Own transfers conserve balances and holds', () => {
  const state = seed();
  const result = b.confirmTransfer(
    state,
    draft(state, '10.25', true),
    b.DEMO_PIN,
  );
  assert.equal(
    result.state.accounts[0].balance,
    state.accounts[0].balance - 1025,
  );
  assert.equal(
    result.state.accounts[1].balance,
    state.accounts[1].balance + 1025,
  );
  assert.equal(result.receipt.fee, 0);
  assert.equal(result.state.transactions.length, state.transactions.length + 2);
  assert.deepEqual(
    result.state.accounts.map((a) => a.held),
    state.accounts.map((a) => a.held),
  );
});
check('Idempotency and payload-bound replay', () => {
  const state = seed(),
    request = draft(state),
    second = draft(state);
  assert.notEqual(request.id, second.id);
  const result = b.confirmTransfer(state, request, b.DEMO_PIN);
  const replay = b.confirmTransfer(result.state, request, b.DEMO_PIN);
  assert.strictEqual(replay.state, result.state);
  assert.strictEqual(replay.receipt, result.receipt);
  reject(
    () =>
      b.confirmTransfer(result.state, { ...request, amount: 100 }, b.DEMO_PIN),
    'stale_review',
  );
});
check('One-shot service failure is atomic and retryable', () => {
  const state = seed('service_failure'),
    request = draft(state),
    snapshot = structuredClone(state);
  let failed;
  try {
    b.confirmTransfer(state, request, b.DEMO_PIN);
  } catch (error) {
    failed = error;
  }
  assert.equal(failed.code, 'service_unavailable');
  assert.equal(failed.nextState.failNext, false);
  assert.deepEqual(failed.nextState.accounts, state.accounts);
  assert.deepEqual(state, snapshot);
  const result = b.confirmTransfer(failed.nextState, request, b.DEMO_PIN);
  assert.equal(result.state.receipts.length, 1);
  assert.equal(
    result.state.accounts[0].balance,
    state.accounts[0].balance - 1075,
  );
});
check('Lockout, reset, stale review and altered amounts reject', () => {
  let state = seed();
  const request = draft(state);
  for (let i = 0; i < 3; i++) {
    try {
      b.login(state, '0000');
    } catch (error) {
      state = error.nextState;
    }
  }
  assert.equal(state.attempts, 3);
  reject(() => b.login(state, b.DEMO_PIN), 'locked');
  reject(() => b.confirmTransfer(state, request, b.DEMO_PIN), 'locked');
  reject(
    () =>
      b.confirmTransfer(b.seedBank('baseline', 'reset'), request, b.DEMO_PIN),
    'stale_review',
  );
  reject(
    () => b.confirmTransfer(seed(), { ...request, amount: 0.5 }, b.DEMO_PIN),
    'stale_review',
  );
  reject(
    () => b.confirmTransfer({ ...seed(), revision: 2 }, request, b.DEMO_PIN),
    'stale_review',
  );
});
check('Computed balance and counter overflow reject without mutation', () => {
  for (const field of ['balance', 'revision', 'sequence']) {
    const state = seed();
    if (field === 'balance')
      state.accounts[1].balance = Number.MAX_SAFE_INTEGER;
    else state[field] = Number.MAX_SAFE_INTEGER;
    const request = draft(state, '0.01', true),
      snapshot = structuredClone(state);
    reject(() => b.confirmTransfer(state, request, b.DEMO_PIN), 'data_limit');
    assert.deepEqual(state, snapshot);
  }
});
check('Demo clock rolls midnight into the next day', () => {
  let state = { ...seed(), sequence: 839 };
  let result = b.confirmTransfer(state, draft(state, '0.01', true), b.DEMO_PIN);
  assert.equal(result.receipt.time, '23:59');
  assert.equal(result.receipt.date, '2026-09-05');
  state = result.state;
  result = b.confirmTransfer(state, draft(state, '0.01', true), b.DEMO_PIN);
  assert.equal(result.receipt.time, '00:00');
  assert.equal(result.receipt.date, '2026-09-06');
  assert.equal(result.state.transactions[0].date, result.receipt.date);
});
check('Long demo sessions retain bounded history and pending holds', () => {
  let state = seed();
  for (let i = 0; i < 600; i++) {
    const request = b.prepareTransfer(
      state,
      i % 2 ? 'savings' : 'current',
      '',
      i % 2 ? 'current' : 'savings',
      '1.00',
      'Retention',
    );
    state = b.confirmTransfer(state, request, b.DEMO_PIN).state;
  }
  const loaded = b.loadBank(JSON.stringify(state));
  assert.equal(loaded.generation, 'checks');
  assert.equal(loaded.transactions.length, 1000);
  assert.equal(loaded.receipts.length, 500);
  assert.equal(
    loaded.transactions.filter((t) => t.status === 'pending').length,
    2,
  );
  assert.deepEqual(loaded.accounts, seed().accounts);
  assert.equal(loaded.sequence, 641);
});
check('Malformed saved records recover explicitly', () => {
  for (const mutate of [
    (s) => (s.cards[0] = null),
    (s) => (s.receipts = [null]),
    (s) => (s.accounts[0].balance = 0.5),
  ]) {
    const state = seed();
    mutate(state);
    const loaded = b.loadBank(JSON.stringify(state));
    assert.notEqual(loaded.generation, 'checks');
    assert.ok(loaded.recoveryNotice);
  }
  assert.ok(b.loadBank('{broken').recoveryNotice);
  assert.equal(b.available(seed('low_balance').accounts[0]), 2850);
});

class Storage {
  values = new Map();
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = new Storage();
globalThis.sessionStorage = new Storage();
const storeSource = compile(
  readFileSync(new URL('../lib/bank-store.ts', import.meta.url), 'utf8'),
)
  .replace(/from ['"]\.\/bank['"]/, `from '${bankUrl}'`)
  .replace(
    /from ['"]react['"]/,
    `from '${pathToFileURL(require.resolve('react')).href}'`,
  );
const store = await import(moduleUrl(storeSource));
const reply = (bank, authenticated, extra = {}, status = 200) =>
  Response.json({ bank, authenticated, ...extra }, { status });
const apiError = (code) => ({ error: { field: 'general', code, message: code } });

await checkAsync('Unauthenticated server reply clears the tab session', async () => {
  globalThis.fetch = async () => reply(seed(), true, { sessionToken: 'unit-session' });
  await store.bankApi.signIn(b.DEMO_PIN);
  assert.equal(store.isSignedIn(), true);
  assert.equal(sessionStorage.getItem(b.SESSION_KEY), 'unit-session');
  const reset = b.seedBank('baseline', 'server-reset');
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer unit-session');
    return reply(reset, false, apiError('unauthorized'), 401);
  };
  await assert.rejects(store.bankApi.hideBalance(true), (e) => e.code === 'unauthorized');
  assert.equal(store.isSignedIn(), false);
  assert.equal(sessionStorage.getItem(b.SESSION_KEY), null);
  assert.equal(store.currentBank().generation, 'server-reset');
});

await checkAsync('Commands serialize and the queue continues after rejection', async () => {
  const calls = [];
  let releaseFirst;
  const responseGate = new Promise(resolve => { releaseFirst = resolve; });
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (calls.length === 1) {
      notifyStarted();
      await responseGate;
      return reply(seed(), true, apiError('service_unavailable'), 503);
    }
    return reply({ ...seed(), failNext: true }, true);
  };
  const first = store.bankApi.hideBalance(true);
  const rejected = assert.rejects(first, (e) => e.code === 'service_unavailable');
  const second = store.bankApi.failNext(true);
  await started;
  assert.equal(calls.length, 1, 'the second request must wait for the first response');
  releaseFirst();
  await rejected;
  await second;
  assert.deepEqual(calls, [
    { url: '/api/bank/preferences', body: { hideBalance: true } },
    { url: '/api/bank/failure', body: { failNext: true } },
  ]);
  assert.equal(store.currentBank().failNext, true);
});

await checkAsync('Error state is published and retry uses the same server draft', async () => {
  const requests = [];
  const consumed = { ...seed(), failNext: false };
  const receipt = { id: 'server-receipt', draftId: 'server-draft' };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return requests.length === 1
      ? reply(consumed, true, apiError('service_unavailable'), 503)
      : reply({ ...consumed, receipts: [receipt] }, true, { receipt });
  };
  await assert.rejects(store.bankApi.confirm('server-draft', b.DEMO_PIN), (e) => e.code === 'service_unavailable');
  assert.deepEqual(store.currentBank(), consumed);
  const completed = await store.bankApi.confirm('server-draft', b.DEMO_PIN);
  assert.deepEqual(completed, receipt);
  assert.deepEqual(requests, [1, 2].map(() => ({
    url: '/api/bank/transfers/confirm', body: { draftId: 'server-draft', pin: b.DEMO_PIN },
  })));
  assert.deepEqual(store.currentBank().receipts, [receipt]);
});

await checkAsync('Unavailable session storage retains an in-memory auth token', async () => {
  globalThis.sessionStorage = {
    getItem() { throw Error('blocked'); },
    setItem() { throw Error('blocked'); },
    removeItem() { throw Error('blocked'); },
  };
  const memoryStore = await import(moduleUrl(storeSource + '\n// isolated session-storage check'));
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    if (calls === 1) return reply(seed(), true, { sessionToken: 'memory-session' });
    assert.equal(options.headers.Authorization, 'Bearer memory-session');
    return reply({ ...seed(), hideBalance: true }, true);
  };
  await memoryStore.bankApi.signIn(b.DEMO_PIN);
  await memoryStore.bankApi.hideBalance(true);
  assert.equal(memoryStore.isSignedIn(), true);
  assert.equal(memoryStore.currentBank().hideBalance, true);
  assert.equal(calls, 2);
});
console.log(`\n${checks} banking-domain and API-client unit checks passed.`);
