'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  Asterisk,
  Check,
  CheckCircle2,
  ChevronRight,
  Coffee,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Globe,
  Home,
  Landmark,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Snowflake,
  Trash2,
  UserRound,
  Users,
  Wallet,
  Wifi,
  Zap,
  AlertCircle,
  PiggyBank,
  ReceiptText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  currentBank,
  isSignedIn,
  bankApi,
  subscribeViewport,
  useBankStore,
  viewportSnapshot,
} from '@/lib/bank-store';
import {
  BankError,
  DEMO_PIN,
  available,
  demoIban,
  displayIban,
  initials,
  money,
  parseAmount,
  type BankCard,
  type Receipt,
  type Transaction,
  type TransferDraft,
} from '@/lib/bank';

type View =
  | 'home'
  | 'cards'
  | 'card'
  | 'payments'
  | 'transfer'
  | 'review'
  | 'receipt'
  | 'beneficiaries'
  | 'activity'
  | 'transaction'
  | 'account'
  | 'profile'
  | 'demo';
type Notice = { text: string; tone: 'success' | 'error' | 'warning' } | null;
type DialogState = {
  kind:
    | 'reset'
    | 'payee'
    | 'delete-payee'
    | 'limit'
    | 'card-info'
    | 'account-info';
  id?: string;
  scenario?: string;
} | null;
const labels: Record<View, string> = {
  home: 'Overview',
  cards: 'Cards',
  card: 'Card details',
  payments: 'Payments',
  transfer: 'New transfer',
  review: 'Review transfer',
  receipt: 'Transfer receipt',
  beneficiaries: 'Recipients',
  activity: 'Activity',
  transaction: 'Transaction details',
  account: 'Account details',
  profile: 'Your profile',
  demo: 'Demo controls',
};
const sectionFor = (view: View) =>
  ['cards', 'card'].includes(view)
    ? 'cards'
    : ['payments', 'transfer', 'review', 'receipt', 'beneficiaries'].includes(
          view,
        )
      ? 'payments'
      : ['activity', 'transaction'].includes(view)
        ? 'activity'
        : ['profile', 'demo'].includes(view)
          ? 'profile'
          : 'home';
const navItems = [
  { value: 'home', label: 'Home', icon: Home },
  { value: 'cards', label: 'Cards', icon: CreditCard },
  { value: 'payments', label: 'Payments', icon: Send },
  { value: 'activity', label: 'Activity', icon: ArrowLeftRight },
  { value: 'profile', label: 'Profile', icon: UserRound },
];

function Brand({ mobile = false }: { mobile?: boolean }) {
  return (
    <div
      className={`brand ${mobile ? 'mobile-brand' : ''}`}
      aria-label="Aster Bank"
    >
      <span className="brand-mark">
        <Asterisk strokeWidth={2.2} />
      </span>
      Aster{mobile && <span className="mobile-demo-label">DEMO</span>}
    </div>
  );
}
function Pin({
  value,
  onChange,
  label,
  id,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  id: string;
  disabled?: boolean;
}) {
  return (
    <InputOTP
      aria-label={label}
      data-testid={id}
      id={id}
      value={value}
      onChange={onChange}
      maxLength={4}
      type="password"
      inputMode="numeric"
      pattern="^[0-9]*$"
      disabled={disabled}
      containerClassName="pin-box"
    >
      <InputOTPGroup>
        {[0, 1, 2, 3].map((index) => (
          <InputOTPSlot key={index} index={index} className="masked-pin-slot" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
function CardVisual({ card }: { card: BankCard }) {
  return (
    <div
      className={`card-visual ${card.virtual ? 'virtual' : ''} ${card.frozen ? 'frozen' : ''}`}
      data-testid={`card-visual-${card.id}`}
      aria-label={`${card.name}, ending ${card.last4}, ${card.frozen ? 'frozen' : 'active'}`}
    >
      <div className="card-top">
        <span>Aster.</span>
        <Wifi />
      </div>
      <div>
        <div className="card-chip" aria-hidden="true" />
        <div className="card-number" data-testid={`card-number-${card.id}`}>
          ••••&nbsp;&nbsp; ••••&nbsp;&nbsp; ••••&nbsp;&nbsp; {card.last4}
        </div>
      </div>
      <div className="card-bottom">
        <div>
          <span>Card holder</span>
          <div className="card-owner">Mira Petrova</div>
        </div>
        <div>
          <span>Expires</span>
          <div className="card-expiry">{card.expiry}</div>
        </div>
        <div className="card-network" aria-hidden="true">
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
function TransactionIcon({ transaction }: { transaction: Transaction }) {
  const Icon =
    transaction.amount > 0
      ? ArrowDownLeft
      : transaction.category === 'Bills'
        ? Zap
        : transaction.category === 'Transfers'
          ? ArrowUpRight
          : transaction.category === 'Food & drink'
            ? Coffee
            : ShoppingBag;
  return (
    <div
      className={`transaction-icon ${transaction.amount > 0 ? 'income' : transaction.category === 'Bills' ? 'bills' : transaction.category === 'Transfers' ? 'transfer' : ''}`}
    >
      <Icon />
    </div>
  );
}
function DetailLine({
  label,
  value,
  total = false,
  id,
}: {
  label: string;
  value: string;
  total?: boolean;
  id?: string;
}) {
  return (
    <div className={`detail-line ${total ? 'total' : ''}`}>
      <span>{label}</span>
      <strong data-testid={id}>{value}</strong>
    </div>
  );
}

export default function BankingApp() {
  const { bank, authenticated } = useBankStore();
  return <BankingScreen key={`${bank.generation}-${authenticated}`} />;
}

function BankingScreen() {
  const { bank, ready, authenticated, storageWarning } = useBankStore();
  const mobile = useSyncExternalStore(
    subscribeViewport,
    viewportSnapshot,
    () => false,
  );
  const [view, setView] = useState<View>('home');
  const [selectedId, setSelectedId] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [formError, setFormError] = useState<{
    field: string;
    message: string;
  } | null>(null);
  const [form, setForm] = useState({
    from: 'current',
    payeeId: '',
    ownTo: 'savings',
    amount: '',
    reference: '',
    type: 'recipient',
  });
  const [draft, setDraft] = useState<TransferDraft | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogName, setDialogName] = useState('');
  const [dialogValue, setDialogValue] = useState('');
  const [dialogError, setDialogError] = useState('');

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      if (event.state?.view && event.state.view in labels) {
        setView(event.state.view);
        setSelectedId(event.state.id ?? '');
        setFormError(null);
        setNotice(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  async function save(operation: () => Promise<unknown>) {
    try {
      await operation();
      return true;
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : 'Unable to save this change.',
        tone: 'error',
      });
      return false;
    }
  }
  function go(next: View, id = '') {
    if (!isSignedIn() && next !== 'demo') return;
    setView(next);
    setSelectedId(id);
    setFormError(null);
    setNotice(null);
    window.history.pushState(
      { view: next, id },
      '',
      `#${next}${id ? `/${encodeURIComponent(id)}` : ''}`,
    );
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function showError(error: unknown) {
    if (error instanceof BankError) {
      setFormError({ field: error.field, message: error.message });
    } else
      setFormError({
        field: 'general',
        message: 'That action could not be completed. Please try again.',
      });
  }
  async function signIn(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    try {
      await bankApi.signIn(pin);
      setPin('');
      setView('home');
      setNotice(null);
      window.history.replaceState({ view: 'home' }, '', '#home');
    } catch (error) {
      showError(error);
      setPin('');
    }
  }
  async function signOut(expired = false) {
    if (!await save(() => bankApi.signOut())) return;
    finishSignOut(expired);
  }
  function finishSignOut(expired = false) {
    setPin('');
    setConfirmPin('');
    setDraft(null);
    setView('home');
    setFormError(null);
    setNotice(
      expired
        ? {
            text: 'Your session has expired. Sign in again to continue.',
            tone: 'warning',
          }
        : null,
    );
    window.history.replaceState({}, '', '#login');
  }
  function startTransfer(payeeId = '', from = 'current', own = false) {
    setForm({
      from,
      payeeId,
      ownTo: from === 'current' ? 'savings' : 'current',
      amount: '',
      reference: '',
      type: own ? 'own' : 'recipient',
    });
    setDraft(null);
    setConfirmPin('');
    go('transfer');
  }
  async function reviewTransfer(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    try {
      setDraft(
        await bankApi.review(
          form.from,
          form.type === 'recipient' ? form.payeeId : '',
          form.type === 'own' ? form.ownTo : '',
          form.amount,
          form.reference,
        ),
      );
      setConfirmPin('');
      go('review');
    } catch (error) {
      showError(error);
    }
  }
  async function submitTransfer(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setFormError(null);
    try {
      const completed = await bankApi.confirm(draft.id, confirmPin);
      setReceipt(completed);
      setConfirmPin('');
      go('receipt');
    } catch (error) {
      showError(error);
      if (error instanceof BankError && error.code === 'invalid_pin')
        setConfirmPin('');
    }
  }
  async function updateCard(
    id: string,
    changes: Partial<BankCard>,
    message?: string,
  ) {
    const saved = await save(() => bankApi.updateCard(id, changes));
    if (saved && message) setNotice({ text: message, tone: 'success' });
  }
  function openDialog(next: DialogState) {
    setDialog(next);
    setDialogName('');
    setDialogValue(
      next?.kind === 'limit'
        ? (
            (currentBank().cards.find((card) => card.id === next.id)?.limit ??
              100000) / 100
          ).toFixed(2)
        : '',
    );
    setDialogError('');
  }
  async function resetDemo(scenario = 'baseline') {
    if (!await save(() => bankApi.reset(scenario))) return;
    setDialog(null);
    setReceipt(null);
    setDraft(null);
    setSearch('');
    setFilter('all');
    setAccountFilter('all');
    finishSignOut();
    setNotice({
      text: `Demo reset. ${scenario === 'low_balance' ? 'Low balance scenario is ready.' : scenario === 'empty_beneficiaries' ? 'Your recipient list is empty.' : scenario === 'service_failure' ? 'The next valid transfer will fail once.' : 'Your original balances and recipients are restored.'}`,
      tone: 'success',
    });
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ text: `${label} copied.`, tone: 'success' });
    } catch {
      setNotice({
        text: 'Clipboard access is unavailable. You can select and copy the displayed text.',
        tone: 'warning',
      });
    }
  }
  async function addRecipient(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const next = await bankApi.addRecipient(dialogName, dialogValue);
      const payee = next.payees[next.payees.length - 1];
      if (view === 'transfer') setForm({ ...form, payeeId: payee.id });
      setDialog(null);
      setNotice({
        text: `${payee.name} has been added to your recipients.`,
        tone: 'success',
      });
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : 'Check the recipient details.',
      );
    }
  }
  async function changeLimit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const amount = parseAmount(dialogValue);
      if (amount < 1000 || amount > 500000)
        throw new Error('Choose a daily limit between €10.00 and €5,000.00.');
      await updateCard(
        dialog?.id ?? 'debit',
        { limit: amount },
        'Your daily card limit has been updated.',
      );
      setDialog(null);
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : 'Enter a valid limit.',
      );
    }
  }
  const current = bank.accounts.find((account) => account.id === 'current')!;
  const selectedAccount =
    bank.accounts.find((account) => account.id === selectedId) ?? current;
  const selectedCard =
    bank.cards.find((card) => card.id === selectedId) ?? bank.cards[0];
  const selectedTransaction = bank.transactions.find(
    (transaction) => transaction.id === selectedId,
  );
  const total = bank.accounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );
  const totalAvailable = bank.accounts.reduce(
    (sum, account) => sum + available(account),
    0,
  );
  const spending = bank.transactions.filter(
    (transaction) =>
      transaction.amount < 0 &&
      transaction.status === 'completed' &&
      transaction.category !== 'Transfers',
  );
  const categories = ['Shopping', 'Bills', 'Food & drink', 'Subscriptions'].map(
    (name, index) => ({
      name,
      amount: -spending
        .filter((transaction) => transaction.category === name)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      color: ['#9580b5', '#c7b7df', '#ddb7a2', '#d9e5bb'][index],
    }),
  );
  const spent = categories.reduce((sum, category) => sum + category.amount, 0);

  function banner() {
    const message =
      notice ??
      (storageWarning ? { text: storageWarning, tone: 'warning' } : null);
    return (
      message && (
        <output className={`notice ${message.tone}`} data-testid="app-notice">
          {message.tone === 'error' ? <AlertCircle /> : <CheckCircle2 />}
          <span>{message.text}</span>
        </output>
      )
    );
  }
  function error(field?: string) {
    return formError && (!field || formError.field === field) ? (
      <p
        className="field-error"
        role="alert"
        id={`${field ?? 'form'}-error`}
        data-testid={`${field ?? 'form'}-error`}
      >
        {formError.message}
      </p>
    ) : null;
  }
  function heading(
    title: string,
    subtitle?: string,
    back?: View,
    action?: React.ReactNode,
  ) {
    return (
      <div className="page-heading">
        <div className="heading-left">
          {back && (
            <button
              className="icon-button back"
              onClick={() => go(back)}
              aria-label={`Back to ${labels[back]}`}
              data-testid="back-button"
            >
              <ArrowLeft />
            </button>
          )}
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
    );
  }
  function transactionList(rows: Transaction[], id = 'transaction-list') {
    return (
      <div className="activity-panel" data-testid={id}>
        {rows.length ? (
          rows.map((transaction) => (
            <button
              className="transaction-row"
              key={transaction.id}
              data-testid={`transaction-${transaction.id}`}
              onClick={() => go('transaction', transaction.id)}
              aria-label={`View ${transaction.name}, ${money(transaction.amount)}, ${transaction.status}`}
            >
              <TransactionIcon transaction={transaction} />
              <div className="transaction-copy">
                <div className="transaction-name">{transaction.name}</div>
                <div className="transaction-category">
                  {transaction.category}
                  {transaction.status === 'pending' ? ' · Pending' : ''}
                </div>
              </div>
              <div
                className={`transaction-amount ${transaction.amount > 0 ? 'positive' : ''}`}
              >
                {transaction.amount > 0 ? '+' : '−'}
                {money(Math.abs(transaction.amount))}
                <div className="transaction-date">
                  {transaction.date === '2026-09-05'
                    ? 'Today'
                    : transaction.date === '2026-09-04'
                      ? 'Yesterday'
                      : `${Number(transaction.date.slice(-2))} Sep`}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="empty-state">
            <Search />
            <h3>No transactions found</h3>
            <p>Try a different search or filter.</p>
            <Button
              className="btn btn-secondary"
              onClick={() => {
                setSearch('');
                setFilter('all');
                setAccountFilter('all');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>
    );
  }
  function accountOptions() {
    return bank.accounts.map((account) => (
      <SelectItem className="select-option" key={account.id} value={account.id}>
        {account.name}
      </SelectItem>
    ));
  }

  function overview() {
    return (
      <>
        {heading('Hello, Mira', "Here's your money at a glance.")}
        {banner()}
        <div className="overview-grid">
          <div className="main-column">
            <section className="balance-hero" aria-label="Your total balance">
              <div className="hero-grain" aria-hidden="true" />
              <div className="balance-label">
                Total balance{' '}
                <button
                  className="eye-toggle"
                  aria-label={
                    bank.hideBalance ? 'Show balances' : 'Hide balances'
                  }
                  data-testid="balance-visibility"
                  onClick={() =>
                    save(() => bankApi.hideBalance(!bank.hideBalance))
                  }
                >
                  {bank.hideBalance ? <EyeOff /> : <Eye />}
                </button>
              </div>
              <div className="hero-balance" data-testid="total-balance">
                {bank.hideBalance ? '••••••' : money(total)}
              </div>
              <div className="hero-available" data-testid="total-available">
                {bank.hideBalance
                  ? 'Your balances are hidden'
                  : `${money(totalAvailable)} available to use`}
              </div>
              <div className="hero-actions">
                <Button
                  className="btn btn-lime"
                  data-testid="send-money"
                  onClick={() => startTransfer()}
                >
                  <ArrowUpRight />
                  Send money
                </Button>
                <Button
                  className="btn btn-glass"
                  data-testid="account-details-shortcut"
                  onClick={() => go('account', 'current')}
                >
                  <Landmark />
                  Account details
                </Button>
              </div>
            </section>
            <div className="section-title">
              Your accounts <span className="small-muted">EUR</span>
            </div>
            <div className="account-grid">
              {bank.accounts.map((account) => (
                <button
                  key={account.id}
                  className="account-tile"
                  data-testid={`account-${account.id}`}
                  onClick={() => go('account', account.id)}
                >
                  <div
                    className={`account-icon ${account.kind === 'savings' ? 'savings' : ''}`}
                  >
                    {account.kind === 'savings' ? <PiggyBank /> : <Wallet />}
                  </div>
                  <div className="account-name">
                    {account.name}
                    <ChevronRight />
                  </div>
                  <div
                    className="account-amount"
                    data-testid={`balance-${account.id}`}
                  >
                    {bank.hideBalance ? '••••••' : money(account.balance)}
                  </div>
                  <div className="account-tail">
                    •••• {account.iban.slice(-4)}
                  </div>
                </button>
              ))}
            </div>
            <div className="section-title">
              Recent activity{' '}
              <button
                className="text-action"
                onClick={() => go('activity')}
                data-testid="view-all-transactions"
              >
                View all
                <ChevronRight />
              </button>
            </div>
            {transactionList(
              bank.transactions.slice(0, 5),
              'recent-transactions',
            )}
          </div>
          <aside className="side-column">
            <section className="panel">
              <div className="panel-title">
                Your card <CreditCard size={17} color="#a8a1b7" />
              </div>
              <CardVisual card={bank.cards[0]} />
              <div className="card-meta">
                <span>Everyday debit</span>
                <span
                  className={`state-chip ${bank.cards[0].frozen ? 'frozen' : ''}`}
                >
                  {bank.cards[0].frozen ? 'Frozen' : 'Active'}
                </span>
              </div>
              <Button
                className="card-manage"
                data-testid="manage-debit-card"
                onClick={() => go('card', 'debit')}
              >
                Manage card
                <ChevronRight size={14} />
              </Button>
            </section>
            <section className="panel spending-panel">
              <div className="panel-title">
                Spending this month <span className="small-muted">Sep</span>
              </div>
              <div className="spending-total" data-testid="monthly-spending">
                {money(spent)}
                <span>in card & bill payments</span>
              </div>
              <div className="spend-bar" aria-hidden="true">
                {categories.map((category) => (
                  <span
                    key={category.name}
                    style={{
                      flex: Math.max(category.amount, 1),
                      background: category.color,
                    }}
                  />
                ))}
              </div>
              {categories.map((category) => (
                <div key={category.name} className="spend-category">
                  <span className="spend-category-name">
                    <i
                      className="spend-dot"
                      style={{ background: category.color }}
                    />
                    {category.name}
                  </span>
                  <span>{money(category.amount)}</span>
                </div>
              ))}
              <div className="insight-foot">
                <ShieldCheck />
                <span>
                  Everything here is fictional demo data. Explore freely and
                  reset anytime.
                </span>
              </div>
            </section>
          </aside>
        </div>
      </>
    );
  }

  function accountsView() {
    return (
      <>
        {heading(selectedAccount.name, 'Your account, in detail.', 'home')}
        {banner()}
        <div className="account-detail-hero">
          <h2>Account balance</h2>
          <div className="large-amount" data-testid="account-detail-balance">
            {money(selectedAccount.balance)}
          </div>
          <div className="iban-line">
            <span data-testid="account-iban">
              {displayIban(selectedAccount.iban)}
            </span>
            <button
              aria-label="Copy account IBAN"
              data-testid="copy-iban"
              onClick={() => copy(selectedAccount.iban, 'IBAN')}
            >
              <Copy />
            </button>
          </div>
          <div style={{ marginTop: 18 }}>
            <DetailLine
              label="Available to use"
              value={money(available(selectedAccount))}
              id="account-available"
            />
            <DetailLine
              label="Pending card authorisations"
              value={money(selectedAccount.held)}
              id="account-held"
            />
            <DetailLine label="Currency" value="Euro · EUR" />
          </div>
          <div className="form-actions">
            <Button
              className="btn btn-primary"
              onClick={() => startTransfer('', selectedAccount.id)}
            >
              <Send />
              Make a transfer
            </Button>
          </div>
        </div>
        <div className="section-title">Account activity</div>
        {transactionList(
          bank.transactions.filter(
            (transaction) => transaction.accountId === selectedAccount.id,
          ),
        )}
      </>
    );
  }

  function cardsView() {
    return (
      <>
        {heading('Your cards', 'A little more control, wherever you go.')}
        {banner()}
        <div className="cards-grid">
          {bank.cards.map((card) => (
            <section className="panel" key={card.id}>
              <div className="card-list-title">
                <h2>{card.name}</h2>
                <span
                  className={`state-chip ${card.frozen ? 'frozen' : ''}`}
                  data-testid={`card-status-${card.id}`}
                >
                  {card.frozen ? 'Frozen' : 'Active'}
                </span>
              </div>
              <CardVisual card={card} />
              <DetailLine label="Linked account" value="Everyday account" />
              <DetailLine
                label="Daily payment limit"
                value={money(card.limit)}
              />
              <Button
                className="btn btn-secondary full-width"
                onClick={() => go('card', card.id)}
                data-testid={`manage-card-${card.id}`}
                style={{ marginTop: 18 }}
              >
                Manage card
                <ArrowRight />
              </Button>
            </section>
          ))}
        </div>
      </>
    );
  }

  function cardView() {
    return (
      <>
        {heading(
          selectedCard.name,
          `Card ending ${selectedCard.last4}`,
          'cards',
        )}
        {banner()}
        <div className="card-detail-layout">
          <div>
            <CardVisual card={selectedCard} />
            <div className="detail-summary">
              <DetailLine
                label="Status"
                value={selectedCard.frozen ? 'Frozen' : 'Active'}
                id="card-status"
              />
              <DetailLine label="Linked account" value="Everyday account" />
              <DetailLine label="Expires" value={selectedCard.expiry} />
            </div>
            <Button
              className={`btn full-width freeze-button ${selectedCard.frozen ? 'btn-primary' : 'btn-outline'}`}
              data-testid="freeze-card"
              onClick={() =>
                updateCard(
                  selectedCard.id,
                  { frozen: !selectedCard.frozen },
                  selectedCard.frozen
                    ? 'Your card is active again.'
                    : 'Your card is frozen. You can unfreeze it anytime.',
                )
              }
            >
              <Snowflake />
              {selectedCard.frozen ? 'Unfreeze card' : 'Freeze card'}
            </Button>
            <p className="safe-note">
              Freezing your card does not affect account transfers.
            </p>
          </div>
          <section className="panel">
            <div className="panel-title">
              Card controls <Settings2 size={18} color="#9e92ae" />
            </div>
            <div className="control-row">
              <div className="control-icon">
                <Globe />
              </div>
              <div className="control-copy">
                <h3 id="online-label">Online payments</h3>
                <p>Use this card for online purchases.</p>
              </div>
              <Switch
                className="bank-switch"
                aria-labelledby="online-label"
                data-testid="card-online"
                checked={selectedCard.online}
                onCheckedChange={(checked) =>
                  updateCard(selectedCard.id, { online: checked })
                }
              />
            </div>
            <div className="control-row">
              <div className="control-icon">
                <Wifi />
              </div>
              <div className="control-copy">
                <h3 id="contactless-label">Contactless payments</h3>
                <p>Tap to pay with your physical card.</p>
              </div>
              <Switch
                className="bank-switch"
                aria-labelledby="contactless-label"
                data-testid="card-contactless"
                checked={selectedCard.contactless}
                disabled={selectedCard.virtual}
                onCheckedChange={(checked) =>
                  updateCard(selectedCard.id, { contactless: checked })
                }
              />
            </div>
            <button
              className="settings-button"
              onClick={() => openDialog({ kind: 'limit', id: selectedCard.id })}
              data-testid="change-card-limit"
            >
              <Wallet />
              <span>Daily limit · {money(selectedCard.limit)}</span>
              <ChevronRight />
            </button>
            <button
              className="settings-button"
              onClick={() =>
                openDialog({ kind: 'card-info', id: selectedCard.id })
              }
              data-testid="card-information"
            >
              <ShieldCheck />
              <span>Card information</span>
              <ChevronRight />
            </button>
            <p className="field-help" style={{ marginTop: 19 }}>
              Card controls are simulated locally. No real card network is
              connected.
            </p>
          </section>
        </div>
      </>
    );
  }

  function paymentsView() {
    return (
      <>
        {heading('Payments', 'Move money with a little more ease.')}
        {banner()}
        <div className="account-grid">
          <button
            className="account-tile"
            data-testid="new-transfer"
            onClick={() => startTransfer()}
          >
            <div className="account-icon">
              <Send />
            </div>
            <div
              className="account-name"
              style={{ color: '#434958', fontWeight: 550, fontSize: 15 }}
            >
              Make a transfer
              <ChevronRight />
            </div>
            <p className="field-help">To a saved or new recipient</p>
          </button>
          <button
            className="account-tile"
            data-testid="own-transfer"
            onClick={() => startTransfer('', 'current', true)}
          >
            <div className="account-icon savings">
              <ArrowLeftRight />
            </div>
            <div
              className="account-name"
              style={{ color: '#434958', fontWeight: 550, fontSize: 15 }}
            >
              Between accounts
              <ChevronRight />
            </div>
            <p className="field-help">Instant, with no demo fee</p>
          </button>
        </div>
        <div className="section-title">
          Your recipients{' '}
          <button
            className="text-action"
            data-testid="manage-recipients"
            onClick={() => go('beneficiaries')}
          >
            Manage
            <ChevronRight />
          </button>
        </div>
        {bank.payees.length ? (
          <div className="payee-grid">
            {bank.payees.map((payee) => (
              <button
                className="payee-tile"
                key={payee.id}
                data-testid={`pay-recipient-${payee.id}`}
                onClick={() => startTransfer(payee.id)}
              >
                <div className={`payee-avatar ${payee.color}`}>
                  {initials(payee.name)}
                </div>
                <div className="payee-name">{payee.name}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="panel empty-state">
            <Users />
            <h3>No recipients yet</h3>
            <p>Add someone to make your first demo transfer.</p>
            <Button
              className="btn btn-primary"
              onClick={() => openDialog({ kind: 'payee' })}
            >
              <Plus />
              Add recipient
            </Button>
          </div>
        )}
        <div className="section-title">Recent transfers</div>
        {transactionList(
          bank.transactions
            .filter((transaction) => transaction.category === 'Transfers')
            .slice(0, 5),
        )}
      </>
    );
  }

  function transferView() {
    const source = bank.accounts.find((account) => account.id === form.from)!;
    return (
      <div className="form-layout">
        {heading('New transfer', 'Choose where your money goes.', 'payments')}
        {banner()}
        <form className="panel form-panel" onSubmit={reviewTransfer} noValidate>
          <div className="field">
            <label id="from-label" htmlFor="transfer-source-select">
              From account
            </label>
            <Select
              value={form.from}
              onValueChange={(value) => {
                const from = String(value);
                setForm({
                  ...form,
                  from,
                  ownTo: from === 'current' ? 'savings' : 'current',
                });
                setFormError(null);
              }}
            >
              <SelectTrigger
                className="select-trigger"
                id="transfer-source-select"
                aria-labelledby="from-label"
                data-testid="transfer-source"
              >
                <SelectValue>{source.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>{accountOptions()}</SelectContent>
            </Select>
            <p className="field-help" data-testid="transfer-available">
              {money(available(source))} available
            </p>
            {error('from')}
          </div>
          <Tabs
            className="transfer-type"
            value={form.type}
            onValueChange={(value) => {
              setForm({ ...form, type: String(value) });
              setFormError(null);
            }}
          >
            <TabsList aria-label="Transfer destination type">
              <TabsTrigger
                value="recipient"
                data-testid="transfer-to-recipient"
              >
                To a recipient
              </TabsTrigger>
              <TabsTrigger value="own" data-testid="transfer-to-own">
                My accounts
              </TabsTrigger>
            </TabsList>
            <TabsContent value="recipient">
              <div
                className="section-title"
                style={{ margin: '0 0 13px', fontSize: 13 }}
              >
                Recipient{' '}
                <button
                  type="button"
                  className="text-action"
                  onClick={() => openDialog({ kind: 'payee' })}
                  data-testid="transfer-add-recipient"
                >
                  <Plus size={13} />
                  Add new
                </button>
              </div>
              <RadioGroup
                value={form.payeeId}
                onValueChange={(value) => {
                  setForm({ ...form, payeeId: String(value) });
                  setFormError(null);
                }}
                aria-label="Choose a recipient"
                className="recipient-radio-group"
              >
                {bank.payees.map((payee) => (
                  <label
                    htmlFor={`recipient-option-${payee.id}`}
                    className={`recipient-choice ${form.payeeId === payee.id ? 'selected' : ''}`}
                    key={payee.id}
                  >
                    <div className={`payee-avatar ${payee.color}`}>
                      {initials(payee.name)}
                    </div>
                    <div>
                      <div className="recipient-name">{payee.name}</div>
                      <small>IBAN ending {payee.iban.slice(-4)}</small>
                    </div>
                    <RadioGroupItem
                      className="recipient-radio"
                      id={`recipient-option-${payee.id}`}
                      value={payee.id}
                      data-testid={`recipient-${payee.id}`}
                    />
                  </label>
                ))}
              </RadioGroup>
              {!bank.payees.length && (
                <div className="empty-state">
                  <Users />
                  <h3>No saved recipients</h3>
                  <p>Add a recipient to continue.</p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="own">
              {bank.accounts
                .filter((account) => account.id !== form.from)
                .map((account) => (
                  <button
                    type="button"
                    className={`recipient-choice ${form.ownTo === account.id ? 'selected' : ''}`}
                    key={account.id}
                    aria-pressed={form.ownTo === account.id}
                    data-testid={`own-recipient-${account.id}`}
                    onClick={() => setForm({ ...form, ownTo: account.id })}
                  >
                    <div className="account-icon savings" style={{ margin: 0 }}>
                      <PiggyBank />
                    </div>
                    <div>
                      <div className="recipient-name">{account.name}</div>
                      <small>{money(account.balance)}</small>
                    </div>
                    <span className="choice-check">
                      <CheckCircle2 />
                    </span>
                  </button>
                ))}
            </TabsContent>
          </Tabs>
          {error('recipient')}
          <hr className="form-divider" />
          <div className="field">
            <label htmlFor="transfer-amount">Amount</label>
            <div className="amount-wrap">
              <span className="amount-currency">€</span>
              <Input
                id="transfer-amount"
                data-testid="transfer-amount"
                className="field-input"
                value={form.amount}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={formError?.field === 'amount'}
                aria-describedby={
                  formError?.field === 'amount' ? 'amount-error' : undefined
                }
                onChange={(event) => {
                  setForm({ ...form, amount: event.target.value });
                  setFormError(null);
                }}
              />
            </div>
            <p className="field-help">
              {form.type === 'own'
                ? 'No fee between your accounts.'
                : 'A €0.50 demo transfer fee applies.'}
            </p>
            {error('amount')}
          </div>
          <div className="field">
            <label htmlFor="transfer-reference">
              Reference <span className="small-muted">(optional)</span>
            </label>
            <Input
              className="field-input"
              id="transfer-reference"
              data-testid="transfer-reference"
              placeholder="What's this transfer for?"
              value={form.reference}
              maxLength={140}
              onChange={(event) =>
                setForm({ ...form, reference: event.target.value })
              }
            />
            {error('reference')}
          </div>
          {formError &&
            !['amount', 'from', 'recipient', 'reference'].includes(
              formError.field,
            ) &&
            error()}
          <div className="form-actions">
            <Button
              type="button"
              className="btn btn-outline"
              onClick={() => go('payments')}
            >
              Cancel
            </Button>
            <Button
              className="btn btn-primary"
              type="submit"
              data-testid="review-transfer"
            >
              Review transfer
              <ArrowRight />
            </Button>
          </div>
        </form>
      </div>
    );
  }

  function reviewView() {
    if (!draft)
      return (
        <div className="panel empty-state">
          <ReceiptText />
          <h3>No transfer to review</h3>
          <p>Start a new transfer from Payments.</p>
          <Button className="btn btn-primary" onClick={() => startTransfer()}>
            New transfer
          </Button>
        </div>
      );
    return (
      <div className="form-layout">
        {heading(
          'Review transfer',
          'Make sure everything looks right.',
          'transfer',
        )}
        <form className="panel form-panel" onSubmit={submitTransfer}>
          <div className="review-person">
            <div className="payee-avatar peach">
              {initials(draft.recipient)}
            </div>
            <div>
              <h3 data-testid="review-recipient">{draft.recipient}</h3>
              <p>{displayIban(draft.iban)}</p>
            </div>
          </div>
          <DetailLine
            label="From"
            value={
              bank.accounts.find((account) => account.id === draft.from)
                ?.name ?? ''
            }
          />
          <DetailLine
            label="Amount"
            value={money(draft.amount)}
            id="review-amount"
          />
          <DetailLine
            label="Transfer fee"
            value={money(draft.fee)}
            id="review-fee"
          />
          <DetailLine
            label="Reference"
            value={draft.reference || 'No reference'}
          />
          <DetailLine
            label="Total debit"
            value={money(draft.amount + draft.fee)}
            total
            id="review-total"
          />
          <div className="review-pin">
            <label htmlFor="confirm-pin">Confirm with your 4-digit PIN</label>
            <Pin
              id="confirm-pin"
              label="Confirmation PIN"
              value={confirmPin}
              onChange={(value) => {
                setConfirmPin(value);
                setFormError(null);
              }}
            />
            {error('pin')}
            <p className="field-help">Demo PIN: {DEMO_PIN}</p>
          </div>
          {formError && formError.field !== 'pin' && (
            <div
              className="notice error"
              style={{ marginTop: 19 }}
              role="alert"
              data-testid="transfer-error"
            >
              <AlertCircle />
              <span>{formError.message}</span>
            </div>
          )}
          <div className="form-actions">
            <Button
              type="button"
              className="btn btn-outline"
              onClick={() => go('transfer')}
              data-testid="edit-transfer"
            >
              Edit details
            </Button>
            <Button
              className="btn btn-primary"
              type="submit"
              disabled={confirmPin.length !== 4}
              data-testid="confirm-transfer"
            >
              <LockKeyhole />
              Confirm & send
            </Button>
          </div>
          <p className="review-note">
            <ShieldCheck />
            Demo transaction. No real money moves.
          </p>
        </form>
      </div>
    );
  }

  function receiptView() {
    if (!receipt)
      return (
        <div className="panel empty-state">
          <ReceiptText />
          <h3>No receipt selected</h3>
          <Button className="btn btn-primary" onClick={() => go('payments')}>
            Back to Payments
          </Button>
        </div>
      );
    return (
      <div className="form-layout">
        {banner()}
        <section className="panel form-panel" data-testid="transfer-receipt">
          <div className="receipt-head">
            <div className="success-mark">
              <Check />
            </div>
            <h1 data-testid="transfer-success">Transfer complete</h1>
            <p>Your demo payment to {receipt.recipient} has been sent.</p>
            <div className="receipt-amount" data-testid="receipt-amount">
              {money(receipt.amount)}
            </div>
            <span className="state-chip">Completed</span>
          </div>
          <div className="receipt-body">
            <DetailLine label="Recipient" value={receipt.recipient} />
            <DetailLine label="IBAN" value={displayIban(receipt.iban)} />
            <DetailLine
              label="From"
              value={
                bank.accounts.find((account) => account.id === receipt.from)
                  ?.name ?? ''
              }
            />
            <DetailLine label="Transfer fee" value={money(receipt.fee)} />
            <DetailLine
              label="Reference"
              value={receipt.reference || 'No reference'}
            />
            <DetailLine
              label="Date"
              value={`${new Date(`${receipt.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} · ${receipt.time}`}
            />
            <DetailLine
              label="New account balance"
              value={money(
                bank.accounts.find((account) => account.id === receipt.from)!
                  .balance,
              )}
              id="receipt-new-balance"
            />
          </div>
          <p className="receipt-id" data-testid="receipt-id">
            {receipt.id}
          </p>
          <div className="form-actions">
            <Button
              className="btn btn-outline"
              onClick={() => copy(receipt.id, 'Transfer reference')}
              data-testid="copy-receipt-reference"
            >
              <Copy />
              Copy reference
            </Button>
            <Button
              className="btn btn-primary"
              onClick={() => go('home')}
              data-testid="receipt-done"
            >
              Back to overview
              <ArrowRight />
            </Button>
          </div>
        </section>
      </div>
    );
  }

  function beneficiariesView() {
    return (
      <>
        {heading(
          'Your recipients',
          'The people you pay, all in one place.',
          'payments',
          <Button
            className="btn btn-primary"
            onClick={() => openDialog({ kind: 'payee' })}
            data-testid="add-recipient"
          >
            <Plus />
            Add new
          </Button>,
        )}
        {banner()}
        <div className="panel">
          {bank.payees.length ? (
            bank.payees.map((payee) => (
              <div
                className="control-row"
                key={payee.id}
                data-testid={`saved-recipient-${payee.id}`}
              >
                <div
                  className={`payee-avatar ${payee.color}`}
                  style={{ margin: 0 }}
                >
                  {initials(payee.name)}
                </div>
                <div className="control-copy">
                  <h3>{payee.name}</h3>
                  <p>{displayIban(payee.iban)}</p>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Pay ${payee.name}`}
                  onClick={() => startTransfer(payee.id)}
                >
                  <ArrowUpRight />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Remove ${payee.name}`}
                  data-testid={`remove-recipient-${payee.id}`}
                  onClick={() =>
                    openDialog({ kind: 'delete-payee', id: payee.id })
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <Users />
              <h3>No recipients yet</h3>
              <p>Add a recipient to make your first transfer.</p>
              <Button
                className="btn btn-primary"
                onClick={() => openDialog({ kind: 'payee' })}
              >
                <Plus />
                Add recipient
              </Button>
            </div>
          )}
        </div>
      </>
    );
  }

  function activityView() {
    const rows = bank.transactions.filter(
      (transaction) =>
        (accountFilter === 'all' || transaction.accountId === accountFilter) &&
        (filter === 'all' ||
          (filter === 'in' && transaction.amount > 0) ||
          (filter === 'out' && transaction.amount < 0)) &&
        `${transaction.name} ${transaction.reference} ${transaction.category}`
          .toLowerCase()
          .includes(search.toLowerCase().trim()),
    );
    return (
      <>
        {heading('Your activity', 'Every little detail, in one place.')}
        <div className="activity-toolbar">
          <div className="search-box">
            <Search />
            <Input
              className="field-input"
              data-testid="transaction-search"
              aria-label="Search transactions"
              placeholder="Search transactions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <ToggleGroup
            className="activity-filters"
            value={[filter]}
            onValueChange={(values) => setFilter(String(values[0] ?? 'all'))}
            aria-label="Transaction direction"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="in" data-testid="filter-money-in">
              Money in
            </ToggleGroupItem>
            <ToggleGroupItem value="out" data-testid="filter-money-out">
              Money out
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="account-select-filter">
            <Select
              value={accountFilter}
              onValueChange={(value) => setAccountFilter(String(value))}
            >
              <SelectTrigger
                className="select-trigger"
                aria-label="Filter activity by account"
                data-testid="activity-account"
              >
                <SelectValue>
                  {accountFilter === 'all'
                    ? 'All accounts'
                    : bank.accounts.find(
                        (account) => account.id === accountFilter,
                      )?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="select-option" value="all">
                  All accounts
                </SelectItem>
                {accountOptions()}
              </SelectContent>
            </Select>
          </div>
        </div>
        {transactionList(rows)}
      </>
    );
  }

  function transactionView() {
    if (!selectedTransaction)
      return (
        <div className="empty-state">
          <ReceiptText />
          <h3>This transaction is no longer available</h3>
          <Button className="btn btn-primary" onClick={() => go('activity')}>
            Back to activity
          </Button>
        </div>
      );
    const transaction = selectedTransaction;
    return (
      <div className="form-layout">
        {heading('Transaction details', undefined, 'activity')}
        <section className="panel form-panel">
          <div className="transaction-detail-head">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <TransactionIcon transaction={transaction} />
            </div>
            <h2>{transaction.name}</h2>
            <div
              className="large-amount"
              data-testid="transaction-detail-amount"
            >
              {transaction.amount > 0 ? '+' : '−'}
              {money(Math.abs(transaction.amount))}
            </div>
            <span
              className={`state-chip ${transaction.status === 'pending' ? 'frozen' : ''}`}
              data-testid="transaction-detail-status"
            >
              {transaction.status === 'pending' ? 'Pending' : 'Completed'}
            </span>
          </div>
          <DetailLine
            label="Account"
            value={
              bank.accounts.find(
                (account) => account.id === transaction.accountId,
              )?.name ?? ''
            }
          />
          <DetailLine label="Category" value={transaction.category} />
          <DetailLine
            label="Date"
            value={`${Number(transaction.date.slice(-2))} Sep 2026 · ${transaction.time}`}
          />
          <DetailLine label="Reference" value={transaction.reference} />
          <DetailLine label="Transaction ID" value={transaction.id} />
          {transaction.status === 'pending' && (
            <div className="notice warning" style={{ marginTop: 20 }}>
              <AlertCircle />
              <span>
                This authorisation is included in held funds. Your posted
                balance has not been debited.
              </span>
            </div>
          )}
        </section>
      </div>
    );
  }

  function profileView() {
    return (
      <div className="settings-layout">
        {heading('Your profile', 'A few things that make banking yours.')}
        {banner()}
        <section className="panel profile-card">
          <div className="avatar">MP</div>
          <div>
            <h2>Mira Petrova</h2>
            <p>mira@example.test</p>
            <p className="small-muted">Fictional demo customer</p>
          </div>
        </section>
        <section className="panel settings-group">
          <div className="control-row">
            <div className="control-icon">
              <EyeOff />
            </div>
            <div className="control-copy">
              <h3 id="privacy-label">Hide balances on Home</h3>
              <p>Keep your overview private at a glance.</p>
            </div>
            <Switch
              className="bank-switch"
              aria-labelledby="privacy-label"
              data-testid="profile-balance-privacy"
              checked={bank.hideBalance}
              onCheckedChange={(checked) =>
                save(() => bankApi.hideBalance(checked))
              }
            />
          </div>
          <button
            className="settings-button"
            onClick={() => go('beneficiaries')}
          >
            <Users />
            <span>Manage recipients</span>
            <ChevronRight />
          </button>
          <button
            className="settings-button"
            onClick={() => openDialog({ kind: 'account-info' })}
          >
            <ShieldCheck />
            <span>About this demo account</span>
            <ChevronRight />
          </button>
        </section>
        <section className="panel settings-group">
          <button
            className="settings-button"
            data-testid="demo-controls"
            onClick={() => go('demo')}
          >
            <Settings2 />
            <span>Demo controls</span>
            <ChevronRight />
          </button>
          <button
            className="settings-button danger"
            data-testid="sign-out"
            onClick={() => signOut()}
          >
            <LogOut />
            <span>Sign out</span>
            <ChevronRight />
          </button>
        </section>
        <p className="safe-note">
          Aster is a fictional banking demo, prepared for the FiBank
          presentation.
          <br />
          Version 1.0 · Demo clock: 5 September 2026
        </p>
      </div>
    );
  }

  function demoView() {
    return (
      <div className="settings-layout">
        {heading(
          'Demo controls',
          'A fresh start for every demonstration.',
          authenticated ? 'profile' : undefined,
        )}
        {banner()}
        <p className="demo-description">
          Choose a repeatable starting point. Resetting signs you out and
          restores the demo accounts, cards, recipients and activity. No real
          banking system is connected.
        </p>
        <div className="scenario-grid">
          {[
            {
              id: 'baseline',
              title: 'Ready to present',
              text: 'Restore the original balances and saved recipients.',
              icon: RefreshCw,
            },
            {
              id: 'low_balance',
              title: 'Low available balance',
              text: 'Start with €28.50 available in Everyday account.',
              icon: Wallet,
            },
            {
              id: 'empty_beneficiaries',
              title: 'No saved recipients',
              text: 'Start with an empty list and add your first recipient.',
              icon: Users,
            },
            {
              id: 'service_failure',
              title: 'One transfer failure',
              text: 'The next valid transfer fails once, without moving money.',
              icon: Zap,
            },
          ].map((scenario) => (
            <button
              className="scenario"
              key={scenario.id}
              data-testid={`scenario-${scenario.id}`}
              onClick={() =>
                openDialog({ kind: 'reset', scenario: scenario.id })
              }
            >
              <scenario.icon />
              <h3>{scenario.title}</h3>
              <p>{scenario.text}</p>
            </button>
          ))}
        </div>
        {authenticated && (
          <section className="panel section-panel">
            <div className="control-row">
              <div className="control-icon">
                <Zap />
              </div>
              <div className="control-copy">
                <h3 id="failure-label">Fail the next transfer once</h3>
                <p>
                  The failure clears after one valid submission. Retry without a
                  duplicate debit.
                </p>
              </div>
              <Switch
                className="bank-switch"
                aria-labelledby="failure-label"
                data-testid="fail-next-transfer"
                checked={bank.failNext}
                onCheckedChange={(checked) =>
                  save(() => bankApi.failNext(checked))
                }
              />
            </div>
            <button
              className="settings-button"
              data-testid="expire-session"
              onClick={() => signOut(true)}
            >
              <LockKeyhole />
              <span>Simulate session expiry</span>
              <ChevronRight />
            </button>
          </section>
        )}
        {!authenticated && (
          <Button
            className="btn btn-outline full-width"
            style={{ marginTop: 25 }}
            onClick={() => setView('home')}
          >
            Back to sign in
          </Button>
        )}
      </div>
    );
  }

  function dialogs() {
    if (dialog?.kind === 'reset' || dialog?.kind === 'delete-payee') {
      const reset = dialog.kind === 'reset';
      const payee = bank.payees.find((item) => item.id === dialog.id);
      return (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        >
          <AlertDialogContent className="dialog-bank">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {reset ? 'Reset the demo?' : 'Remove this recipient?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {reset
                  ? 'Your demo changes will be cleared and the selected starting point restored. You will be signed out.'
                  : `${payee?.name ?? 'This recipient'} will be removed. Completed transfers stay in your activity.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="form-actions">
              <AlertDialogCancel className="btn btn-outline">
                {reset ? 'Cancel' : 'Keep recipient'}
              </AlertDialogCancel>
              <AlertDialogAction
                className={`btn ${reset ? 'btn-primary' : 'btn-danger'}`}
                data-testid={
                  reset ? 'confirm-demo-reset' : 'confirm-remove-recipient'
                }
                onClick={async () => {
                  if (reset) await resetDemo(dialog.scenario);
                  else {
                    const saved = await save(() => bankApi.removeRecipient(dialog.id ?? ''));
                    if (!saved) return;
                    setDialog(null);
                    setNotice({ text: 'Recipient removed.', tone: 'success' });
                  }
                }}
              >
                {reset ? 'Reset demo' : 'Remove'}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      );
    }
    const dialogCard =
      bank.cards.find((card) => card.id === dialog?.id) ?? bank.cards[0];
    return (
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="dialog-bank">
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === 'payee'
                ? 'Add a recipient'
                : dialog?.kind === 'limit'
                  ? 'Daily payment limit'
                  : dialog?.kind === 'card-info'
                    ? 'Card information'
                    : 'A banking sandbox'}
            </DialogTitle>
            <DialogDescription>
              {dialog?.kind === 'payee'
                ? 'Save a name and IBAN for your next demo transfer.'
                : dialog?.kind === 'limit'
                  ? 'Choose a daily demo card payment limit between €10 and €5,000.'
                  : dialog?.kind === 'card-info'
                    ? 'These are fictional card details. Card controls are simulated locally.'
                    : 'Aster is a fictional app for demonstrating banking journeys and automation. It is not a FiBank product and is not connected to a real bank.'}
            </DialogDescription>
          </DialogHeader>
          {dialog?.kind === 'payee' && (
            <form onSubmit={addRecipient} noValidate>
              <div className="field">
                <label htmlFor="recipient-name">Recipient name</label>
                <Input
                  id="recipient-name"
                  data-testid="recipient-name"
                  className="field-input"
                  value={dialogName}
                  placeholder="Full name or business"
                  maxLength={60}
                  onChange={(event) => {
                    setDialogName(event.target.value);
                    setDialogError('');
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="recipient-iban">IBAN</label>
                <Input
                  id="recipient-iban"
                  data-testid="recipient-iban"
                  className="field-input"
                  value={dialogValue}
                  placeholder="BG00 DEMO …"
                  onChange={(event) => {
                    setDialogValue(event.target.value);
                    setDialogError('');
                  }}
                />
                <p className="field-help">
                  For a fictional demo recipient, use{' '}
                  {displayIban(demoIban('20000004'))}.
                </p>
              </div>
              {dialogError && (
                <p
                  className="field-error"
                  role="alert"
                  data-testid="recipient-error"
                >
                  {dialogError}
                </p>
              )}
              <div className="form-actions">
                <Button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="btn btn-primary"
                  data-testid="save-recipient"
                >
                  Save recipient
                </Button>
              </div>
            </form>
          )}
          {dialog?.kind === 'limit' && (
            <form onSubmit={changeLimit}>
              <div className="field">
                <label htmlFor="card-limit">Daily limit in EUR</label>
                <Input
                  id="card-limit"
                  data-testid="card-limit-input"
                  className="field-input"
                  value={dialogValue}
                  inputMode="decimal"
                  onChange={(event) => {
                    setDialogValue(event.target.value);
                    setDialogError('');
                  }}
                />
              </div>
              {dialogError && (
                <p className="field-error" role="alert">
                  {dialogError}
                </p>
              )}
              <div className="form-actions">
                <Button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="btn btn-primary"
                  type="submit"
                  data-testid="save-card-limit"
                >
                  Save limit
                </Button>
              </div>
            </form>
          )}
          {dialog?.kind === 'card-info' && (
            <div>
              <DetailLine label="Cardholder" value="Mira Petrova" />
              <DetailLine label="Card ending" value={dialogCard.last4} />
              <DetailLine label="Expiry" value={dialogCard.expiry} />
              <DetailLine
                label="Type"
                value={
                  dialogCard.virtual ? 'Virtual demo card' : 'Debit demo card'
                }
              />
              <DetailLine
                label="Status"
                value={dialogCard.frozen ? 'Frozen' : 'Active'}
              />
            </div>
          )}
          {dialog?.kind === 'account-info' && (
            <div>
              <DetailLine label="Demo customer" value="Mira Petrova" />
              <DetailLine label="Currency" value="EUR" />
              <DetailLine label="Demo PIN" value={DEMO_PIN} />
              <DetailLine label="Data storage" value="Local demo session" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  if (!authenticated && view !== 'demo')
    return (
      <main className="login-page">
        <div className="login-brand">
          <Brand />
          <div className="brand-sub">BANKING DEMO</div>
        </div>
        <form className="login-card" onSubmit={signIn}>
          <div className="avatar login-avatar">MP</div>
          <h1>Welcome back, Mira</h1>
          <p className="login-intro">Sign in to your demo account.</p>
          <div className="login-lock">
            <LockKeyhole />
          </div>
          <label htmlFor="login-pin" className="login-pin-label">
            Enter your 4-digit PIN
          </label>
          <Pin
            id="login-pin"
            label="4-digit demo PIN"
            value={pin}
            onChange={(value) => {
              setPin(value);
              setFormError(null);
            }}
            disabled={!ready || bank.attempts >= 3}
          />
          {error('pin')}
          {bank.attempts >= 3 && !formError && (
            <p className="field-error" role="alert" data-testid="login-locked">
              Demo access is locked. Use Demo controls to reset it.
            </p>
          )}
          {banner()}
          {formError?.field === 'general' && error('general')}
          <Button
            className="btn btn-primary full-width"
            type="submit"
            data-testid="login-submit"
            disabled={!ready || pin.length !== 4 || bank.attempts >= 3}
          >
            Sign in
            <ArrowRight />
          </Button>
          <div className="demo-pin-hint">
            Explore with demo PIN <strong>{DEMO_PIN}</strong>
          </div>
        </form>
        <div className="login-foot">
          <ShieldCheck />
          Fictional accounts. No real money.
        </div>
        <button
          className="login-reset"
          data-testid="login-demo-controls"
          onClick={() => {
            setNotice(null);
            setView('demo');
          }}
        >
          Demo controls & reset
        </button>
        {dialogs()}
      </main>
    );

  const screen =
    view === 'home'
      ? overview()
      : view === 'account'
        ? accountsView()
        : view === 'cards'
          ? cardsView()
          : view === 'card'
            ? cardView()
            : view === 'payments'
              ? paymentsView()
              : view === 'transfer'
                ? transferView()
                : view === 'review'
                  ? reviewView()
                  : view === 'receipt'
                    ? receiptView()
                    : view === 'beneficiaries'
                      ? beneficiariesView()
                      : view === 'activity'
                        ? activityView()
                        : view === 'transaction'
                          ? transactionView()
                          : view === 'profile'
                            ? profileView()
                            : demoView();
  if (!authenticated)
    return (
      <main className="login-page">
        <div className="login-brand">
          <Brand />
        </div>
        {screen}
        {dialogs()}
      </main>
    );
  return (
    <Tabs
      className="bank-root"
      value={sectionFor(view)}
      orientation={mobile ? 'horizontal' : 'vertical'}
      onValueChange={(value) => go(value as View)}
    >
      <SidebarProvider className="bank-shell">
        <Sidebar collapsible="none" className="sidebar">
          <Brand />
          <div className="brand-sub">EVERYDAY BANKING</div>
          <TabsList className="bank-nav" aria-label="Banking navigation">
            {navItems.map((item) => (
              <TabsTrigger
                className="nav-item"
                key={item.value}
                value={item.value}
                data-testid={`nav-${item.value}`}
                aria-label={item.label}
              >
                <item.icon />
                <span>
                  {mobile && item.value === 'payments' ? 'Pay' : item.label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="sidebar-bottom">
            <div className="sandbox-status">
              <i className="status-dot" />
              Demo environment
            </div>
            <button
              className="demo-link"
              onClick={() => go('demo')}
              data-testid="sidebar-demo-controls"
            >
              <Settings2 size={15} />
              Demo controls
            </button>
          </div>
        </Sidebar>
        <div className="content-shell">
          <header className="topbar">
            <Brand mobile />
            <div className="topbar-title">
              Personal banking
              <span />
              EUR accounts
            </div>
            <div className="top-actions">
              <span className="top-date">Saturday, 5 September</span>
              <button
                className="profile-button"
                aria-label="Open Mira's profile"
                data-testid="profile-menu"
                onClick={() => go('profile')}
              >
                <span className="profile-copy">Mira Petrova</span>
                <span className="avatar">MP</span>
              </button>
            </div>
          </header>
          <TabsContent value={sectionFor(view)} style={{ margin: 0 }}>
            <main data-testid={`screen-${view}`}>{screen}</main>
          </TabsContent>
        </div>
      </SidebarProvider>
      {dialogs()}
    </Tabs>
  );
}
