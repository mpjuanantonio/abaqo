---
name: db
description: Abaqo's Postgres database `abaqo` - tables, conventions, migrations and how to run them against the dev stack. Use when adding or changing tables, queries or repositories.
---

# Database `abaqo`

Same Postgres instance as Firefly, separate database and role (`abaqo`). Abaqo never queries
Firefly's database directly; it uses the Firefly API.

## Tables

| Table | Holds |
| --- | --- |
| `categories` | Firefly category id, archived flag, kind (`envelope`/`subcategory`), parent id, allocation (`fixed_cents` or `percent_bp`), surplus rule + target, shortfall rule + victim, sort order |
| `budget_months` | start/end dates, budget cents, frozen `savings_floor_cents`, status (`open`/`closed`), `config_snapshot` (jsonb, category configuration frozen at close), close snapshot (jsonb, includes unclassified spend) |
| `envelope_entries` | month, category, kind, amount cents (signed), `source` (`user`, `open`, `close`), `source_month` (the open or close that wrote it), `pair_id` (both halves of a movement), source ref (financing id, Firefly journal id...) |
| `financings` | borrower category, lender category, principal cents, months, start month. Outstanding and status are derived from `envelope_entries` |
| `goals` | category, target cents, margin cents, optional due date, notified flags, status (`active`/`reached`/`fulfilled`) |
| `alerts` | kind (`chained_loan`, `savings_below_floor`, goal and budget alerts), category, month, payload, status |
| `accounts` | Firefly account id, role (`salary`/`spending`/`savings`/`cash`), manual balance cents + date for accounts without sync |
| `inbox_items` | Firefly journal id, type (`expense`/`income`/`bizum`/`internal_transfer`), suggestion, probability, status |
| `classification_log` | Firefly journal id, source (`rule`/`jev`/`user`), category, probability, provider, latency |
| `merchant_keys` | normalized key, kind (`merchant`/`bizum_concept`), recent categories, Firefly rule id |
| `shared_expenses` | Firefly journal id, participants and shares, user share cents, written-off cents + `written_off_at`, status. The pending amount is derived |
| `reimbursement_links` | shared expense id, Firefly journal id of the Bizum, amount cents |
| `refund_links` | Firefly journal id of the refund, category, optional journal id of the purchase, amount cents |
| `settings` | single row: month start day, default budget, threshold, provider, generic merchants, salary keys, install date, savings category id, investment category id, savings floor mode (`none`/`fixed`/`months`) with its cents or months |

`envelope_entries.kind` values: `opening`, `allocation`, `carry`, `loan`, `installment_in/out`,
`extra_income`, `manual_in/out`, `financing_in/out`, `adjustment`, `transfer_in/out`,
`thief_in/out`. Their meaning and who writes each one is in the `envelope-rules` skill.

## Conventions

- Money columns end in `_cents` and are `bigint`. Percentages end in `_bp`.
- Timestamps `timestamptz` in UTC; dates of budget months as `date`.
- Every table has `id` (uuid v7), `created_at`, `updated_at`.
- Migrations in `api/migrations/`, numbered, forward-only. Never edit an applied migration.
- Balances are never stored as a single number; they are derived from `envelope_entries` and spend.
  The same goes for a financing's outstanding amount and for receivables.
- Entries with source `open` or `close` are regenerated when that open or close is re-run (matched by
  `source` and `source_month`), inside one database transaction. Entries with source `user` are never deleted by a re-run.
- Run migrations: `npm run db:migrate -w api` against the `dev` stack only.
