---
name: testing
description: How to test Abaqo - Vitest for unit and integration, Playwright for e2e on the dev stack, fixtures and builders, and how to start and reset the dev environment. Use when writing tests, adding fixtures or running the suite.
---

# Testing Abaqo

## Layers

| Layer | Tool | Where | Network |
| --- | --- | --- | --- |
| Domain (envelopes, close, goals) | Vitest | `api/src/domain/__tests__/` | none |
| API + DB | Vitest + dev Postgres | `api/test/integration/` | dev stack only |
| Classifier | Vitest with `FakeClassifier` | `api/src/classifier/__tests__/` | none |
| UI flows | Playwright, 390x844 viewport first | `web/e2e/` | dev stack only |

## Dev environment

```bash
docker compose -f deploy/docker-compose.yml --profile dev up -d   # Firefly + Postgres + fake data
npm run db:migrate -w api
npm run seed -w api      # loads api/test/fixtures/seed.json into the dev Firefly
```

Reset: `docker compose -f deploy/docker-compose.yml --profile dev down -v` then start again.
Stop the stack when you finish; the server has 8 GB RAM shared with other services.

## Fixtures

- Builders in `api/test/builders.ts` (`aMonth()`, `anEnvelope()`, `anExpense()`), amounts in cents.
- Bank descriptions: anonymized samples in `api/test/fixtures/santander/`.
- Required scenarios: card payment with merchant, Bizum sent with concept, Bizum received
  without concept, dinner paid by user and repaid by three Bizums (one missing), salary in a
  different account, month close using every surplus and shortfall rule.

## Rules

- Never use real data or real credentials.
- Tests are deterministic: fixed clock (`vi.setSystemTime`), seeded ids.
- Report the exact command and real output; do not summarise a run you did not see.
