export const DEMO_PIN = '2468';
export const STORAGE_KEY = 'aster-bank-demo-v1';
export const SESSION_KEY = 'aster-bank-session-v1';

export type Account = {
  id: string;
  name: string;
  iban: string;
  balance: number;
  held: number;
  kind: 'current' | 'savings';
};
export type BankCard = {
  id: string;
  name: string;
  last4: string;
  expiry: string;
  frozen: boolean;
  online: boolean;
  contactless: boolean;
  limit: number;
  virtual: boolean;
};
export type Payee = {
  id: string;
  name: string;
  iban: string;
  bank: string;
  color: string;
};
export type Transaction = {
  id: string;
  accountId: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  time: string;
  status: 'completed' | 'pending';
  reference: string;
};
export type Receipt = {
  id: string;
  draftId: string;
  generation: string;
  from: string;
  payeeId: string;
  ownTo: string;
  recipient: string;
  iban: string;
  amount: number;
  fee: number;
  reference: string;
  date: string;
  time: string;
};
export type BankState = {
  version: 1;
  generation: string;
  revision: number;
  sequence: number;
  accounts: Account[];
  cards: BankCard[];
  payees: Payee[];
  transactions: Transaction[];
  receipts: Receipt[];
  attempts: number;
  failNext: boolean;
  hideBalance: boolean;
  recoveryNotice?: string;
};
export type TransferDraft = {
  id: string;
  generation: string;
  from: string;
  payeeId: string;
  ownTo: string;
  recipient: string;
  iban: string;
  amount: number;
  fee: number;
  reference: string;
  revision: number;
};

export class BankError extends Error {
  constructor(
    public field: string,
    message: string,
    public code = 'validation',
    public nextState?: BankState,
  ) {
    super(message);
    this.name = 'BankError';
  }
}

export function money(cents: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
export const available = (account: Account) => account.balance - account.held;
export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
export const displayIban = (iban: string) =>
  iban.match(/.{1,4}/g)?.join(' ') ?? iban;

function mod97(value: string): number {
  let remainder = 0;
  for (const character of value) {
    const digits = /[A-Z]/.test(character)
      ? String(character.charCodeAt(0) - 55)
      : character;
    for (const digit of digits)
      remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}
export function demoIban(tail: string): string {
  const bban = `DEMO800010${tail.padStart(8, '0')}`;
  return `BG${String(98 - mod97(`${bban}BG00`)).padStart(2, '0')}${bban}`;
}
export function normalizeIban(value: string): string {
  return value.replace(/\s/g, '').toUpperCase();
}
export function validIban(value: string): boolean {
  const iban = normalizeIban(value);
  const lengths: Record<string, number> = {
    BG: 22,
    DE: 22,
    GB: 22,
    FR: 27,
    NL: 18,
    ES: 24,
    IT: 27,
    IE: 22,
    BE: 16,
    AT: 20,
    GR: 27,
    PT: 25,
    RO: 24,
    CH: 21,
    LT: 20,
  };
  return (
    /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban) &&
    lengths[iban.slice(0, 2)] === iban.length &&
    mod97(iban.slice(4) + iban.slice(0, 4)) === 1
  );
}
export function parseAmount(value: string): number {
  const clean = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!clean) throw new BankError('amount', 'Enter an amount.');
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(clean))
    throw new BankError(
      'amount',
      'Use a number with no more than two decimal places.',
    );
  const [whole, fraction = ''] = clean.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0)
    throw new BankError('amount', 'The amount must be greater than €0.00.');
  if (cents > 5_000_000)
    throw new BankError('amount', 'Demo transfers are limited to €50,000.00.');
  return cents;
}

export function seedBank(
  scenario = 'baseline',
  generation = crypto.randomUUID(),
): BankState {
  return {
    version: 1,
    generation,
    revision: 0,
    sequence: 41,
    attempts: 0,
    failNext: scenario === 'service_failure',
    hideBalance: false,
    accounts: [
      {
        id: 'current',
        name: 'Everyday account',
        iban: demoIban('10000001'),
        balance: scenario === 'low_balance' ? 18850 : 645080,
        held: 16000,
        kind: 'current',
      },
      {
        id: 'savings',
        name: 'Savings account',
        iban: demoIban('10000002'),
        balance: 1250000,
        held: 0,
        kind: 'savings',
      },
    ],
    cards: [
      {
        id: 'debit',
        name: 'Everyday debit',
        last4: '4821',
        expiry: '08/29',
        frozen: false,
        online: true,
        contactless: true,
        limit: 100000,
        virtual: false,
      },
      {
        id: 'virtual',
        name: 'Virtual card',
        last4: '9036',
        expiry: '11/28',
        frozen: true,
        online: false,
        contactless: false,
        limit: 50000,
        virtual: true,
      },
    ],
    payees:
      scenario === 'empty_beneficiaries'
        ? []
        : [
            {
              id: 'alex',
              name: 'Alex Dimitrov',
              iban: demoIban('20000001'),
              bank: 'Demo Bank',
              color: 'peach',
            },
            {
              id: 'city',
              name: 'City Utilities',
              iban: demoIban('20000002'),
              bank: 'Demo Bank',
              color: 'blue',
            },
            {
              id: 'elena',
              name: 'Elena Ivanova',
              iban: demoIban('20000003'),
              bank: 'Demo Bank',
              color: 'mint',
            },
          ],
    transactions: [
      {
        id: 'tx-salary',
        accountId: 'current',
        name: 'September salary',
        category: 'Income',
        amount: 295000,
        date: '2026-09-04',
        time: '09:12',
        status: 'completed',
        reference: 'Monthly salary',
      },
      {
        id: 'tx-market',
        accountId: 'current',
        name: 'Green Market',
        category: 'Shopping',
        amount: -8420,
        date: '2026-09-04',
        time: '18:36',
        status: 'completed',
        reference: 'Card payment · 4821',
      },
      {
        id: 'tx-cafe',
        accountId: 'current',
        name: 'Sunday Coffee',
        category: 'Food & drink',
        amount: -580,
        date: '2026-09-04',
        time: '08:42',
        status: 'completed',
        reference: 'Card payment · 4821',
      },
      {
        id: 'tx-power',
        accountId: 'current',
        name: 'City Utilities',
        category: 'Bills',
        amount: -6500,
        date: '2026-09-03',
        time: '10:15',
        status: 'completed',
        reference: 'Electricity · August',
      },
      {
        id: 'tx-dinner',
        accountId: 'current',
        name: 'The Little Kitchen',
        category: 'Food & drink',
        amount: -4280,
        date: '2026-09-03',
        time: '20:08',
        status: 'completed',
        reference: 'Card payment · 4821',
      },
      {
        id: 'tx-subscription',
        accountId: 'current',
        name: 'Streamly',
        category: 'Subscriptions',
        amount: -1499,
        date: '2026-09-02',
        time: '07:00',
        status: 'completed',
        reference: 'Monthly subscription',
      },
      {
        id: 'tx-hold-hotel',
        accountId: 'current',
        name: 'Mountain Hotel',
        category: 'Travel',
        amount: -12000,
        date: '2026-09-02',
        time: '15:22',
        status: 'pending',
        reference: 'Card authorisation · included in held funds',
      },
      {
        id: 'tx-hold-ride',
        accountId: 'current',
        name: 'CityRide',
        category: 'Travel',
        amount: -4000,
        date: '2026-09-02',
        time: '12:05',
        status: 'pending',
        reference: 'Card authorisation · included in held funds',
      },
      {
        id: 'tx-savings',
        accountId: 'savings',
        name: 'Monthly savings',
        category: 'Transfers',
        amount: 50000,
        date: '2026-09-01',
        time: '10:00',
        status: 'completed',
        reference: 'From Everyday account',
      },
    ],
    receipts: [],
  };
}

export function incrementCounter(value: number): number {
  if (!Number.isSafeInteger(value) || !Number.isSafeInteger(value + 1))
    throw new BankError(
      'general',
      'The demo has reached its data limit. Reset the demo to continue.',
      'data_limit',
    );
  return value + 1;
}

export function login(state: BankState, pin: string): BankState {
  if (state.attempts >= 3)
    throw new BankError(
      'pin',
      'Demo access is locked. Reset the demo to sign in again.',
      'locked',
    );
  if (pin !== DEMO_PIN) {
    const next = {
      ...state,
      attempts: state.attempts + 1,
      revision: incrementCounter(state.revision),
    };
    throw new BankError(
      'pin',
      next.attempts >= 3
        ? 'Demo access is locked. Reset the demo to try again.'
        : `Incorrect PIN. ${3 - next.attempts} attempts remaining.`,
      'invalid_pin',
      next,
    );
  }
  return { ...state, attempts: 0 };
}

export function prepareTransfer(
  state: BankState,
  from: string,
  payeeId: string,
  ownTo: string,
  amountText: string,
  reference: string,
): TransferDraft {
  const source = state.accounts.find((account) => account.id === from);
  if (!source) throw new BankError('from', 'Choose an account.');
  const destination = ownTo
    ? state.accounts.find((account) => account.id === ownTo)
    : state.payees.find((payee) => payee.id === payeeId);
  if (!destination) throw new BankError('recipient', 'Choose a recipient.');
  if (ownTo === from)
    throw new BankError('recipient', 'Choose a different destination account.');
  if (reference.trim().length > 140)
    throw new BankError('reference', 'Use 140 characters or fewer.');
  const amount = parseAmount(amountText),
    fee = ownTo ? 0 : 50;
  if (amount + fee > available(source))
    throw new BankError(
      'amount',
      `Not enough available funds. You have ${money(available(source))}, including the ${money(fee)} fee.`,
      'insufficient_funds',
    );
  return {
    id: `draft-${crypto.randomUUID()}`,
    generation: state.generation,
    from,
    payeeId,
    ownTo,
    recipient: destination.name,
    iban: destination.iban,
    amount,
    fee,
    reference: reference.trim(),
    revision: state.revision,
  };
}

export function confirmTransfer(
  state: BankState,
  draft: TransferDraft,
  pin: string,
): { state: BankState; receipt: Receipt } {
  if (pin !== DEMO_PIN)
    throw new BankError(
      'pin',
      'Incorrect confirmation PIN. Your transfer has not been sent.',
      'invalid_pin',
    );
  if (state.attempts >= 3)
    throw new BankError(
      'pin',
      'Demo access is locked. Reset the demo to continue.',
      'locked',
    );
  if (
    draft.generation !== state.generation ||
    !Number.isSafeInteger(draft.amount) ||
    !Number.isSafeInteger(draft.fee) ||
    draft.amount <= 0
  )
    throw new BankError(
      'review',
      'This review is no longer valid. Start a new transfer.',
      'stale_review',
    );
  const completed = state.receipts.find(
    (receipt) => receipt.draftId === draft.id,
  );
  if (completed) {
    if (
      ![
        'generation',
        'from',
        'payeeId',
        'ownTo',
        'recipient',
        'iban',
        'amount',
        'fee',
        'reference',
      ].every(
        (key) =>
          completed[key as keyof Receipt] === draft[key as keyof TransferDraft],
      )
    )
      throw new BankError(
        'review',
        'This transfer reference belongs to a different request.',
        'stale_review',
      );
    return { state, receipt: completed };
  }
  if (draft.revision !== state.revision)
    throw new BankError(
      'review',
      'Your account information changed. Review this transfer again.',
      'stale_review',
    );
  const checked = prepareTransfer(
    state,
    draft.from,
    draft.payeeId,
    draft.ownTo,
    (draft.amount / 100).toFixed(2),
    draft.reference,
  );
  if (
    checked.recipient !== draft.recipient ||
    checked.iban !== draft.iban ||
    checked.fee !== draft.fee ||
    checked.amount !== draft.amount
  )
    throw new BankError(
      'review',
      'Recipient details changed. Review the transfer again.',
      'stale_review',
    );
  if (state.failNext)
    throw new BankError(
      'service',
      'The transfer service is temporarily unavailable. No money moved. Please try again.',
      'service_unavailable',
      { ...state, failNext: false },
    );
  const sequence = state.sequence;
  const nextSequence = incrementCounter(sequence);
  const nextRevision = incrementCounter(state.revision);
  const accounts = state.accounts.map((account) => {
    const balance =
      account.balance +
      (account.id === draft.from
        ? -(draft.amount + draft.fee)
        : account.id === draft.ownTo
          ? draft.amount
          : 0);
    if (!Number.isSafeInteger(balance) || balance < account.held)
      throw new BankError(
        'amount',
        'This transfer would exceed the demo account limit.',
        'data_limit',
      );
    return { ...account, balance };
  });
  const instant = new Date(Date.UTC(2026, 8, 5, 10, sequence));
  if (!Number.isFinite(instant.getTime()))
    throw new BankError(
      'general',
      'Reset the demo to restart its clock.',
      'data_limit',
    );
  const stamp = instant.toISOString(),
    date = stamp.slice(0, 10),
    time = stamp.slice(11, 16);
  const receipt: Receipt = {
    id: `AST-${date.replaceAll('-', '')}-${String(sequence).padStart(4, '0')}`,
    draftId: draft.id,
    generation: state.generation,
    from: draft.from,
    payeeId: draft.payeeId,
    ownTo: draft.ownTo,
    recipient: draft.recipient,
    iban: draft.iban,
    amount: draft.amount,
    fee: draft.fee,
    reference: draft.reference,
    date,
    time,
  };
  const transactions: Transaction[] = [
    {
      id: `tx-${sequence}-out`,
      accountId: draft.from,
      name: draft.recipient,
      category: 'Transfers',
      amount: -(draft.amount + draft.fee),
      date: receipt.date,
      time,
      status: 'completed',
      reference: draft.reference || receipt.id,
    },
  ];
  if (draft.ownTo)
    transactions.push({
      ...transactions[0],
      id: `tx-${sequence}-in`,
      accountId: draft.ownTo,
      name: `From your ${state.accounts.find((account) => account.id === draft.from)!.name.toLowerCase()}`,
      amount: draft.amount,
    });
  return {
    receipt,
    state: {
      ...state,
      sequence: nextSequence,
      revision: nextRevision,
      accounts,
      transactions: retainTransactions([
        ...transactions,
        ...state.transactions,
      ]),
      receipts: [receipt, ...state.receipts].slice(0, 500),
    },
  };
}

function retainTransactions(rows: Transaction[]): Transaction[] {
  const room = 1000 - rows.filter((row) => row.status === 'pending').length;
  let posted = 0;
  return rows.filter((row) => row.status === 'pending' || posted++ < room);
}

export function addPayee(
  state: BankState,
  name: string,
  rawIban: string,
): BankState {
  if (state.payees.length >= 100)
    throw new BankError(
      'name',
      'The demo supports up to 100 saved recipients.',
    );
  if (name.trim().length < 2 || name.trim().length > 60)
    throw new BankError(
      'name',
      'Enter a recipient name between 2 and 60 characters.',
    );
  const iban = normalizeIban(rawIban);
  if (!validIban(iban))
    throw new BankError(
      'iban',
      'Enter a valid IBAN, including its country and check digits.',
    );
  if (state.accounts.some((account) => account.iban === iban))
    throw new BankError(
      'iban',
      'This is one of your accounts. Use an own-account transfer.',
    );
  if (state.payees.some((payee) => payee.iban === iban))
    throw new BankError('iban', 'A recipient with this IBAN is already saved.');
  return {
    ...state,
    revision: incrementCounter(state.revision),
    sequence: incrementCounter(state.sequence),
    payees: [
      ...state.payees,
      {
        id: `payee-${state.sequence}`,
        name: name.trim(),
        iban,
        bank: 'Demo recipient',
        color: 'blue',
      },
    ],
  };
}

export function loadBank(rawState?: string | null): BankState {
  try {
    const raw =
      rawState === undefined ? localStorage.getItem(STORAGE_KEY) : rawState;
    if (!raw) return seedBank();
    const state = JSON.parse(raw) as BankState;
    const text = (value: unknown, max = 160): value is string =>
      typeof value === 'string' && value.length <= max;
    if (
      !state ||
      state.version !== 1 ||
      !text(state.generation, 80) ||
      !state.generation ||
      !Number.isSafeInteger(state.revision) ||
      state.revision < 0 ||
      !Number.isSafeInteger(state.sequence) ||
      state.sequence < 41 ||
      !Number.isInteger(state.attempts) ||
      state.attempts < 0 ||
      state.attempts > 3 ||
      typeof state.failNext !== 'boolean' ||
      typeof state.hideBalance !== 'boolean'
    )
      throw new Error('invalid metadata');
    if (
      !Array.isArray(state.accounts) ||
      state.accounts.length !== 2 ||
      !['current', 'savings'].every(
        (id) =>
          state.accounts.filter((account) => account?.id === id).length === 1,
      ) ||
      state.accounts.some(
        (account) =>
          !account ||
          !text(account.name) ||
          !text(account.iban, 34) ||
          !['current', 'savings'].includes(account.kind) ||
          !Number.isSafeInteger(account.balance) ||
          !Number.isSafeInteger(account.held) ||
          account.held < 0 ||
          account.balance < account.held ||
          !validIban(account.iban),
      )
    )
      throw new Error('invalid accounts');
    if (
      !Array.isArray(state.cards) ||
      state.cards.length !== 2 ||
      !['debit', 'virtual'].every(
        (id) => state.cards.filter((card) => card?.id === id).length === 1,
      ) ||
      state.cards.some(
        (card) =>
          !card ||
          !text(card.name) ||
          !/^\d{4}$/.test(card.last4) ||
          !/^\d{2}\/\d{2}$/.test(card.expiry) ||
          !Number.isSafeInteger(card.limit) ||
          card.limit < 1000 ||
          card.limit > 500000 ||
          [card.frozen, card.online, card.contactless, card.virtual].some(
            (value) => typeof value !== 'boolean',
          ),
      )
    )
      throw new Error('invalid cards');
    if (
      !Array.isArray(state.payees) ||
      !Array.isArray(state.transactions) ||
      !Array.isArray(state.receipts) ||
      state.payees.length > 100 ||
      state.transactions.length > 5000 ||
      state.receipts.length > 2000
    )
      throw new Error('invalid history');
    if (
      state.payees.some(
        (payee) =>
          !payee ||
          !text(payee.id) ||
          !text(payee.name) ||
          !text(payee.bank) ||
          !text(payee.color) ||
          !text(payee.iban, 34) ||
          !validIban(payee.iban),
      ) ||
      new Set(state.payees.map((payee) => payee.iban)).size !==
        state.payees.length
    )
      throw new Error('invalid recipients');
    if (
      state.transactions.some(
        (row) =>
          !row ||
          !text(row.id) ||
          !['current', 'savings'].includes(row.accountId) ||
          !text(row.name) ||
          !text(row.category) ||
          !text(row.date) ||
          !text(row.time) ||
          !text(row.reference) ||
          !Number.isSafeInteger(row.amount) ||
          !['completed', 'pending'].includes(row.status),
      )
    )
      throw new Error('invalid transactions');
    if (
      state.receipts.some(
        (row) =>
          !row ||
          !text(row.id) ||
          !text(row.draftId) ||
          row.generation !== state.generation ||
          !['current', 'savings'].includes(row.from) ||
          !text(row.payeeId) ||
          !text(row.ownTo) ||
          !text(row.recipient) ||
          !text(row.iban, 34) ||
          !validIban(row.iban) ||
          !text(row.reference) ||
          !text(row.date) ||
          !text(row.time) ||
          !Number.isSafeInteger(row.amount) ||
          row.amount <= 0 ||
          !Number.isSafeInteger(row.fee) ||
          ![0, 50].includes(row.fee),
      )
    )
      throw new Error('invalid receipts');
    return {
      ...state,
      transactions: retainTransactions(state.transactions),
      receipts: state.receipts.slice(0, 500),
      recoveryNotice: undefined,
    };
  } catch {
    return {
      ...seedBank(),
      recoveryNotice:
        'Your saved demo could not be read. A fresh demo has been loaded.',
    };
  }
}
