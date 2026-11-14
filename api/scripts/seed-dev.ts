// Seeds the DEV Firefly III with fake data through its REST API (never through its database).
// Idempotent: accounts and categories are matched by name, transactions by external_id.
//
// Usage: npm run seed -w api
// Env (dev names only; FIREFLY_URL / FIREFLY_TOKEN are the production names and are NEVER read):
//   DEV_FIREFLY_URL    default http://127.0.0.1:18080
//   DEV_FIREFLY_TOKEN  default: contents of deploy/dev/.dev-token (created by deploy/dev/bootstrap.sh)
//   SEED_TODAY         optional YYYY-MM-DD override of "today" (Europe/Madrid), for reproducible dates
//
// Safety: before writing anything the script refuses to run unless the URL host is loopback AND
// GET /api/v1/about/user returns the dev email (dev@abaqo.invalid).
//
// Firefly API checked 2026-11-14 against the pinned v6.7.9 source and its OpenAPI-based behaviour:
//   https://api-docs.firefly-iii.org/  (docs site blocks automated fetches; payload shapes verified
//   with live calls against the dev stack: POST /api/v1/accounts, /categories, /transactions)
// Auth: `Authorization: Bearer <personal access token>`, `Accept: application/json`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  centsToDecimal,
  checkDevUser,
  checkTargetUrl,
  madridToday,
  openingBalanceDate,
  parseSeedToday,
  resolveDate,
} from './seed-lib.js';

interface FixtureAccount {
  name: string;
  role: 'defaultAsset' | 'savingAsset' | 'cashWalletAsset';
  openingBalanceCents: number;
}
interface FixtureTx {
  id: string;
  type: 'withdrawal' | 'deposit' | 'transfer';
  month: number;
  day: number;
  amountCents: number;
  description: string;
  account: string;
  counterparty: string;
  category: string | null;
  notes?: string;
}
interface Fixture {
  accounts: FixtureAccount[];
  categories: string[];
  transactions: FixtureTx[];
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = JSON.parse(
  readFileSync(new URL('../test/fixtures/seed.json', import.meta.url), 'utf8'),
) as Fixture;

const baseUrl = (process.env.DEV_FIREFLY_URL || 'http://127.0.0.1:18080').replace(/\/$/, '');
let token = '';

interface Page<T> {
  data: T[];
  meta: { pagination: { total_pages: number } };
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function listAll<T>(path: string): Promise<T[]> {
  const sep = path.includes('?') ? '&' : '?';
  const out: T[] = [];
  for (let page = 1; ; page++) {
    const res = await api<Page<T>>('GET', `${path}${sep}limit=100&page=${page}`);
    out.push(...res.data);
    if (page >= res.meta.pagination.total_pages) return out;
  }
}

function readToken(): string {
  const fromEnv = process.env.DEV_FIREFLY_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const fromFile = readFileSync(`${root}deploy/dev/.dev-token`, 'utf8').trim();
    if (fromFile) return fromFile;
  } catch {
    // fall through to the friendly error
  }
  throw new Error('No dev token. Run deploy/dev/bootstrap.sh or set DEV_FIREFLY_TOKEN.');
}

async function main(): Promise<void> {
  // Guards first: nothing is written unless both pass.
  const urlError = checkTargetUrl(baseUrl);
  if (urlError) throw new Error(urlError);
  token = readToken();
  const me = await api<{ data: { attributes: { email: string } } }>('GET', '/about/user');
  const userError = checkDevUser(me.data.attributes.email);
  if (userError) throw new Error(userError);

  const today = process.env.SEED_TODAY ? parseSeedToday(process.env.SEED_TODAY) : madridToday();
  const counts = { accounts: 0, categories: 0, transactions: 0, skipped: 0 };

  // Accounts, matched by name.
  const existingAccounts = await listAll<{ id: string; attributes: { name: string } }>(
    '/accounts?type=asset',
  );
  const accountIds = new Map(existingAccounts.map((a) => [a.attributes.name, a.id]));
  for (const acc of fixture.accounts) {
    if (accountIds.has(acc.name)) continue;
    const res = await api<{ data: { id: string } }>('POST', '/accounts', {
      name: acc.name,
      type: 'asset',
      account_role: acc.role,
      currency_code: 'EUR',
      opening_balance: centsToDecimal(acc.openingBalanceCents),
      opening_balance_date: openingBalanceDate(today),
      active: true,
    });
    accountIds.set(acc.name, res.data.id);
    counts.accounts++;
  }

  // Categories, matched by name.
  const existingCategories = await listAll<{ attributes: { name: string } }>('/categories');
  const categoryNames = new Set(existingCategories.map((c) => c.attributes.name));
  for (const name of fixture.categories) {
    if (categoryNames.has(name)) continue;
    await api('POST', '/categories', { name });
    counts.categories++;
  }

  // Transactions, matched by external_id (the fixture id).
  const existingTx = await listAll<{
    attributes: { transactions: { external_id: string | null }[] };
  }>('/transactions?type=all');
  const seen = new Set(
    existingTx.flatMap((g) => g.attributes.transactions.map((t) => t.external_id ?? '')),
  );
  const idOf = (name: string): string => {
    const id = accountIds.get(name);
    if (!id) throw new Error(`Fixture references unknown account "${name}"`);
    return id;
  };

  for (const tx of fixture.transactions) {
    if (seen.has(tx.id)) {
      counts.skipped++;
      continue;
    }
    const split: Record<string, unknown> = {
      type: tx.type,
      date: resolveDate(today, tx.month, tx.day),
      amount: centsToDecimal(tx.amountCents),
      currency_code: 'EUR',
      description: tx.description,
      external_id: tx.id,
      tags: ['seed-dev'],
      ...(tx.category ? { category_name: tx.category } : {}),
      ...(tx.notes ? { notes: tx.notes } : {}),
    };
    if (tx.type === 'withdrawal') {
      split.source_id = idOf(tx.account);
      split.destination_name = tx.counterparty;
    } else if (tx.type === 'deposit') {
      split.source_name = tx.counterparty;
      split.destination_id = idOf(tx.account);
    } else {
      split.source_id = idOf(tx.account);
      split.destination_id = idOf(tx.counterparty);
    }
    await api('POST', '/transactions', {
      error_if_duplicate_hash: false,
      apply_rules: false,
      fire_webhooks: false,
      transactions: [split],
    });
    counts.transactions++;
  }

  console.log(
    `Seed done (${today}): created ${counts.accounts} accounts, ${counts.categories} categories, ` +
      `${counts.transactions} transactions; skipped ${counts.skipped} existing transactions.`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  if (err instanceof Error && err.cause) console.error('Cause:', err.cause);
  process.exit(1);
});
