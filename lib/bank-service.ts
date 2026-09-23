import { omitTransferFee } from './transfer-demo-mode';
import {
  BankError, addPayee, confirmTransfer, incrementCounter, login,
  prepareTransfer, seedBank,
  type BankCard, type BankState, type TransferDraft,
} from './bank';

type Ledger = {
  bank: BankState;
  sessions: Map<string, string>;
  drafts: Map<string, TransferDraft>;
  touchedAt: number;
};

const ledgers = new Map<string, Ledger>();
const COOKIE = 'aster-demo-ledger';
const MAX_IDLE_MS = 60 * 60 * 1000;
const scenarios = new Set(['baseline', 'low_balance', 'empty_beneficiaries', 'service_failure']);

function cookieValue(request: Request): string | undefined {
  return request.headers.get('cookie')?.split(';').map(value => value.trim())
    .find(value => value.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
}

function getLedger(request: Request): { id: string; ledger: Ledger; created: boolean } {
  const now = Date.now();
  for (const [id, ledger] of ledgers) {
    if (now - ledger.touchedAt > MAX_IDLE_MS) ledgers.delete(id);
  }
  const existing = cookieValue(request);
  const found = existing ? ledgers.get(existing) : undefined;
  if (found && existing) {
    found.touchedAt = now;
    return { id: existing, ledger: found, created: false };
  }
  if (ledgers.size >= 128) {
    const oldest = [...ledgers].sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
    if (oldest) ledgers.delete(oldest[0]);
  }
  const id = crypto.randomUUID();
  const ledger: Ledger = { bank: seedBank(), sessions: new Map(), drafts: new Map(), touchedAt: now };
  ledgers.set(id, ledger);
  return { id, ledger, created: true };
}

function tokenFor(request: Request): string {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
}

function signedIn(ledger: Ledger, request: Request): boolean {
  return ledger.bank.attempts < 3
    && ledger.sessions.get(tokenFor(request)) === ledger.bank.generation;
}

function publicBank(bank: BankState): BankState {
  return {
    version: 1, generation: bank.generation, revision: bank.revision,
    sequence: 41, accounts: [], cards: [], payees: [], transactions: [], receipts: [],
    attempts: bank.attempts, failNext: false, hideBalance: false,
  };
}

function stringField(body: Record<string, unknown>, key: string, fallback = ''): string {
  const value = body[key] ?? fallback;
  if (typeof value !== 'string' || value.length > 1000) {
    throw new BankError(key, 'Invalid ' + key + '.', 'validation');
  }
  return value;
}

function booleanField(body: Record<string, unknown>, key: string): boolean {
  if (typeof body[key] !== 'boolean') throw new BankError(key, 'Choose a valid setting.');
  return body[key];
}

function errorStatus(error: BankError): number {
  if (error.code === 'service_unavailable') return 503;
  if (error.code === 'unauthorized' || error.code === 'invalid_pin') return 401;
  if (error.code === 'locked') return 423;
  if (error.code === 'stale_review' || error.code === 'stale_session') return 409;
  if (error.code === 'not_found') return 404;
  return 422;
}

/** Local, disposable demo service. Every mutation below runs synchronously on one ledger. */
export async function handleBankRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/bank\/?/, '').replace(/\/$/, '');
  const requestId = crypto.randomUUID();
  const { id, ledger, created } = getLedger(request);
  const reply = (status: number, extra: Record<string, unknown> = {}): Response => {
    const authenticated = signedIn(ledger, request);
    const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Demo-Request-Id': requestId });
    if (created) headers.set('Set-Cookie', COOKIE + '=' + id + '; Path=/api/bank; HttpOnly; SameSite=Strict' + (url.protocol === 'https:' ? '; Secure' : ''));
    console.info('[bank-api]', request.method, path || 'bootstrap', status, requestId);
    return Response.json({ bank: authenticated ? ledger.bank : publicBank(ledger.bank), authenticated, requestId, ...extra }, { status, headers });
  };
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return reply(403, { error: { field: 'general', code: 'forbidden', message: 'Use the demo application to make this request.' } });
    let body: Record<string, unknown> = {};
    if (request.method !== 'GET') {
      const raw = await request.text();
      if (raw.length > 16_000) return reply(413, { error: { field: 'general', code: 'too_large', message: 'This request is too large.' } });
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
          body = parsed as Record<string, unknown>;
        } catch {
          return reply(400, { error: { field: 'general', code: 'invalid_json', message: 'Send a JSON object.' } });
        }
      }
    }

    if (request.method === 'GET' && path === '') return reply(200);
    if (request.method === 'POST' && path === 'reset') {
      const scenario = stringField(body, 'scenario', 'baseline');
      if (!scenarios.has(scenario)) throw new BankError('scenario', 'Choose a demo scenario.');
      ledger.bank = seedBank(scenario);
      ledger.sessions.clear();
      ledger.drafts.clear();
      return reply(200);
    }
    if (request.method === 'POST' && path === 'session') {
      ledger.bank = login(ledger.bank, stringField(body, 'pin'));
      const token = crypto.randomUUID();
      if (ledger.sessions.size >= 32) ledger.sessions.delete(ledger.sessions.keys().next().value!);
      ledger.sessions.set(token, ledger.bank.generation);
      return reply(200, { authenticated: true, bank: ledger.bank, sessionToken: token });
    }
    if (request.method === 'DELETE' && path === 'session') {
      ledger.sessions.delete(tokenFor(request));
      return reply(200);
    }

    if (!signedIn(ledger, request)) throw new BankError('general', 'Sign in again to continue.', 'unauthorized');
    if (request.method === 'GET' && path === 'state') return reply(200);
    if (request.method === 'POST' && path === 'transfers/review') {
      const draft = prepareTransfer(ledger.bank, stringField(body, 'from'), stringField(body, 'payeeId'),
        stringField(body, 'ownTo'), stringField(body, 'amount'), stringField(body, 'reference'));
      if (ledger.drafts.size >= 500) ledger.drafts.delete(ledger.drafts.keys().next().value!);
      ledger.drafts.set(draft.id, draft);
      return reply(200, { draft });
    }
    if (request.method === 'POST' && path === 'transfers/confirm') {
      const draft = ledger.drafts.get(stringField(body, 'draftId'));
      if (!draft) throw new BankError('review', 'This review is no longer valid. Start a new transfer.', 'stale_review');
      const result = confirmTransfer(ledger.bank, draft, stringField(body, 'pin'));
      ledger.bank = result.state;
      // Deliberate demo defect: the fee appears on the receipt but is not debited.
      if (omitTransferFee && draft.fee) {
        ledger.bank = { ...ledger.bank, accounts: ledger.bank.accounts.map(account =>
          account.id === draft.from ? { ...account, balance: account.balance + draft.fee } : account) };
      }
      return reply(200, { receipt: result.receipt });
    }
    if (request.method === 'PATCH' && path.startsWith('cards/')) {
      const cardId = decodeURIComponent(path.slice('cards/'.length));
      const card = ledger.bank.cards.find(item => item.id === cardId);
      if (!card) throw new BankError('card', 'Card not found.', 'not_found');
      const changes: Partial<BankCard> = {};
      for (const key of ['frozen', 'online', 'contactless'] as const) {
        if (key in body) changes[key] = booleanField(body, key);
      }
      if (card.virtual && changes.contactless) throw new BankError('contactless', 'Virtual cards do not support contactless payments.');
      if ('limit' in body) {
        if (!Number.isSafeInteger(body.limit) || Number(body.limit) < 1000 || Number(body.limit) > 500000) {
          throw new BankError('limit', 'Choose a daily limit between €10.00 and €5,000.00.');
        }
        changes.limit = Number(body.limit);
      }
      if (!Object.keys(changes).length) throw new BankError('card', 'Choose a card setting.');
      ledger.bank = { ...ledger.bank, revision: incrementCounter(ledger.bank.revision),
        cards: ledger.bank.cards.map(item => item.id === cardId ? { ...item, ...changes } : item) };
      return reply(200);
    }
    if (request.method === 'POST' && path === 'recipients') {
      ledger.bank = addPayee(ledger.bank, stringField(body, 'name'), stringField(body, 'iban'));
      return reply(201, { recipient: ledger.bank.payees.at(-1) });
    }
    if (request.method === 'DELETE' && path.startsWith('recipients/')) {
      const payeeId = decodeURIComponent(path.slice('recipients/'.length));
      if (!ledger.bank.payees.some(item => item.id === payeeId)) throw new BankError('recipient', 'Recipient not found.', 'not_found');
      ledger.bank = { ...ledger.bank, revision: incrementCounter(ledger.bank.revision),
        payees: ledger.bank.payees.filter(item => item.id !== payeeId) };
      return reply(200);
    }
    if (request.method === 'PATCH' && path === 'preferences') {
      ledger.bank = { ...ledger.bank, hideBalance: booleanField(body, 'hideBalance') };
      return reply(200);
    }
    if (request.method === 'PATCH' && path === 'failure') {
      ledger.bank = { ...ledger.bank, failNext: booleanField(body, 'failNext') };
      return reply(200);
    }
    return reply(404, { error: { field: 'general', code: 'not_found', message: 'Demo operation not found.' } });
  } catch (error) {
    if (error instanceof BankError) {
      if (error.nextState) ledger.bank = error.nextState;
      if (ledger.bank.attempts >= 3) ledger.sessions.clear();
      return reply(errorStatus(error), { error: { field: error.field, code: error.code, message: error.message } });
    }
    console.error('[bank-api]', requestId, error instanceof Error ? error.name : 'unexpected error');
    return reply(500, { error: { field: 'general', code: 'internal', message: 'The demo service could not complete this request.' } });
  }
}
