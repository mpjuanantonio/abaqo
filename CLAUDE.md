# Abaqo

Self-hosted, inbox-first envelope budgeting on top of Firefly III. Built for Spanish banks
(Santander via Enable Banking), mobile-first PWA, open source (AGPL-3.0).

Full design: `docs/architecture.md` (exported from the architecture doc). Read it before any
non-trivial change. If code and that document disagree, stop and ask.

## What Abaqo is

- **Firefly III is the source of truth for transactions.** Abaqo never duplicates them.
- **Abaqo owns** envelopes (monthly budget per category), month close, goals, classification
  metadata, the inbox, shared expenses and alerts. It stores them in its own Postgres DB `abaqo`.
- **Classification pipeline:** Firefly rules → (Bizum without concept → inbox) → Jev decision
  model with a confidence threshold (default 0.85) → inbox. Repeated merchants or Bizum concepts
  become Firefly rules automatically (tag `abaqo-auto`).

## Stack

- TypeScript everywhere, Node 24 LTS, npm workspaces.
- `api/`: Abaqo API (Hono), Postgres via a typed query layer, Vitest.
- `web/`: React + Vite PWA, TanStack Query, Tailwind, Playwright for e2e.
- `deploy/`: Docker Compose with profiles `full`, `companion` and `dev`.

## Commands

(Keep this list in sync with package.json.)

- `npm install` — install all workspaces
- `npm run dev` — API + web in watch mode against the `dev` stack
- `npm run test` — unit tests (Vitest) in all workspaces
- `npm run test:e2e` — Playwright e2e against the `dev` stack
- `npm run lint` / `npm run typecheck`
- `docker compose -f deploy/docker-compose.yml --profile dev up -d` — test Firefly + Postgres with fake data

## Non-negotiable rules

1. **Money is integer cents** (`amountCents: number`), never floats. Format only at the UI edge.
2. **Dates:** store UTC, compute months in `Europe/Madrid`. A budget month starts on the user's
   configured day (default 1), not on payday.
3. **Never touch real data.** Only the `dev` stack and fixtures. Never read `.env`, `*.pem` or
   anything under `deploy/secrets/`.
4. **Envelope balances are derived**, never stored as a loose number: sum of `envelope_entries`
   plus month spend from Firefly. Month close must be re-runnable.
5. **Privacy:** only merchant description / Bizum concept, amount, date and category list may be
   sent to the classifier. Never IBAN, holder name or balances.
6. Code, identifiers, commits and PRs in English. User-facing strings through i18n (es, en).

## How we work (agent team)

You are the tech lead. Plan, split work, delegate, integrate, commit.

| Work | Delegate to |
| --- | --- |
| Envelopes, month close, goals, shared expenses (pure domain logic) | `envelope-engine` |
| API routes, Postgres schema/migrations, Firefly webhooks and REST | `api-data` |
| Data Importer config, Enable Banking, Jev client, Docker Compose, CI | `integrations` |
| PWA screens and components | `frontend-pwa` |
| Tests, fixtures, e2e | `qa` |
| Review of every change before commit | `reviewer` |

Workflow per task:
1. One GitHub issue per task. Read it, plan in plan mode if it touches more than one area.
2. Delegate with a self-contained prompt: goal, files, acceptance criteria. Subagents do not see
   this conversation.
3. Run `npm run lint && npm run typecheck && npm run test` before asking `reviewer`.
4. Address review findings, then commit with Conventional Commits and open a PR that links the issue.

Definition of done: tests pass, reviewer has no blocking findings, docs updated if behaviour changed.
