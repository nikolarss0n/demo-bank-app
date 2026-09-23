'use client';

import { useSyncExternalStore } from 'react';
import { BankError, seedBank, SESSION_KEY, type BankCard, type BankState, type Receipt, type TransferDraft } from './bank';

type Snapshot = {
  bank: BankState;
  authenticated: boolean;
  ready: boolean;
  storageWarning: string;
};
type ApiReply = {
  bank: BankState;
  authenticated: boolean;
  sessionToken?: string;
  draft?: TransferDraft;
  receipt?: Receipt;
  error?: { field: string; code: string; message: string };
};

const serverSnapshot: Snapshot = {
  bank: seedBank('baseline', 'server-render-only'),
  authenticated: false, ready: false, storageWarning: '',
};
const NOTICE_KEY = 'aster-bank-service-notice-v1';
let snapshot = serverSnapshot;
let started = false;
let sessionToken = '';
let storageWarning = '';
let requestQueue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function rememberSession(token: string) {
  sessionToken = token;
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    storageWarning = 'Your sign-in will last for this visit only.';
  }
}

function publish(reply: ApiReply) {
  if (reply.sessionToken) rememberSession(reply.sessionToken);
  else if (!reply.authenticated) rememberSession('');
  snapshot = { bank: reply.bank, authenticated: reply.authenticated, ready: true, storageWarning };
  emit();
}

function announceChange() {
  try { localStorage.setItem(NOTICE_KEY, crypto.randomUUID()); }
  catch {
    storageWarning = 'Other tabs may need a refresh to show these changes.';
  }
}

function requestBank(path = '', method = 'GET', body?: Record<string, unknown>): Promise<ApiReply> {
  // Refreshes and commands share one queue, so an older response cannot
  // overwrite a later session or financial state in this tab.
  const pending = requestQueue.then(() => performRequest(path, method, body));
  requestQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

async function performRequest(path: string, method: string, body?: Record<string, unknown>): Promise<ApiReply> {
  let response: Response;
  let reply: ApiReply;
  try {
    response = await fetch('/api/bank' + (path ? '/' + path : ''), {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(sessionToken ? { Authorization: 'Bearer ' + sessionToken } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    reply = await response.json() as ApiReply;
    if (!reply.bank || typeof reply.authenticated !== 'boolean') throw new Error('Invalid service response');
  } catch {
    snapshot = { ...snapshot, ready: true, storageWarning: 'The demo service is unavailable. Please try again.' };
    emit();
    throw new BankError('general', snapshot.storageWarning, 'service_unavailable');
  }
  publish(reply);
  if (method !== 'GET') announceChange();
  if (!response.ok) {
    throw new BankError(reply.error?.field ?? 'general', reply.error?.message ?? 'The request could not be completed.', reply.error?.code ?? 'service_error');
  }
  return reply;
}

async function refresh() {
  try { await requestBank(); } catch { /* The snapshot already exposes the service error. */ }
}

function onStorage(event: StorageEvent) {
  if (event.key === NOTICE_KEY) void refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  if (!started) {
    started = true;
    try { sessionToken = sessionStorage.getItem(SESSION_KEY) ?? ''; }
    catch { storageWarning = 'Your sign-in will last for this visit only.'; }
    void refresh();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): Snapshot {
  return typeof window === 'undefined' ? serverSnapshot : snapshot;
}

export function useBankStore() {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}
export const currentBank = () => getSnapshot().bank;
export const isSignedIn = () => getSnapshot().authenticated;

export const bankApi = {
  signIn: (pin: string) => requestBank('session', 'POST', { pin }),
  signOut: () => requestBank('session', 'DELETE'),
  reset: (scenario: string) => requestBank('reset', 'POST', { scenario }),
  review: async (from: string, payeeId: string, ownTo: string, amount: string, reference: string) => {
    const reply = await requestBank('transfers/review', 'POST', { from, payeeId, ownTo, amount, reference });
    if (!reply.draft) throw new BankError('review', 'The service did not return a transfer review.');
    return reply.draft;
  },
  confirm: async (draftId: string, pin: string) => {
    const reply = await requestBank('transfers/confirm', 'POST', { draftId, pin });
    if (!reply.receipt) throw new BankError('general', 'The service did not return a receipt.');
    return reply.receipt;
  },
  updateCard: (id: string, changes: Partial<BankCard>) => requestBank('cards/' + encodeURIComponent(id), 'PATCH', changes),
  addRecipient: async (name: string, iban: string) => (await requestBank('recipients', 'POST', { name, iban })).bank,
  removeRecipient: (id: string) => requestBank('recipients/' + encodeURIComponent(id), 'DELETE'),
  hideBalance: (hideBalance: boolean) => requestBank('preferences', 'PATCH', { hideBalance }),
  failNext: (failNext: boolean) => requestBank('failure', 'PATCH', { failNext }),
};

export function subscribeViewport(listener: () => void) {
  const media = window.matchMedia('(max-width: 900px)');
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
export const viewportSnapshot = () => window.matchMedia('(max-width: 900px)').matches;
