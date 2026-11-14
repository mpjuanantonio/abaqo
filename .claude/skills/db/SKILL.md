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
| `categories` | Firefly category id, kind (`envelope`/`subcategory`), parent id, allocation (`fixed_cents` or `percent_bp`), surplus rule + target, shortfall rule + victim, sort order |
| `budget_months` | start/end dates, budget cents, status (`open`/`closed`), close snapshot (jsonb) |
| `envelope_entries` | month, category, kind (`allocation`, `extra_income`, `carry`, `loan`, `transfer_in/out`, `thief_in/out`, `adjustment`), amount cents, source ref |
| `goals` | category, target cents, margin cents, notified flags, status |
| `inbox_items` | Firefly journal id, type (`expense`/`income`/`bizum`), suggestion, probability, status |
| `classification_log` | Firefly journal id, source (`rule`/`jev`/`user`), category, probability, provider, latency |
| `merchant_keys` | normalized key, kind (`merchant`/`bizum_concept`), recent categories, Firefly rule id |
| `shared_expenses` | Firefly journal id, participants, user share cents, pending cents, status |
| `reimbursement_links` | shared expense id, Firefly journal id of the Bizum, amount cents |
| `settings` | single row: month start day, default budget, threshold, provider, generic merchants |

## Conventions

- Money columns end in `_cents` and are `bigint`. Percentages end in `_bp`.
- Timestamps `timestamptz` in UTC; dates of budget months as `date`.
- Every table has `id` (uuid v7), `created_at`, `updated_at`.
- Migrations in `api/migrations/`, numbered, forward-only. Never edit an applied migration.
- Balances are never stored as a single number; they are derived from `envelope_entries` and spend.
- Run migrations: `npm run db:migrate -w api` against the `dev` stack only.
