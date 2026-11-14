---
name: firefly-api
description: How Abaqo integrates with Firefly III - REST API with a personal access token, webhooks on new transactions, categories, rules, tags and transaction links. Use when reading or writing anything in Firefly or handling its webhooks.
---

# Firefly III integration

Firefly III is the source of truth for accounts and transactions. Abaqo keeps only Firefly ids
plus its own metadata.

## Before coding

The API evolves. Check the current reference before writing a client call:
- API reference: https://api-docs.firefly-iii.org/
- Webhooks and rules: https://docs.firefly-iii.org/ (search "webhooks" and "rules")
Note the API version you checked in a comment next to the client.

## What Abaqo uses

| Need | Firefly feature |
| --- | --- |
| New transaction arrives | Webhook on transaction store, delivered to `POST /webhooks/firefly` |
| Assign a category | Update transaction's category |
| Rule for a merchant or Bizum concept | Create rule (trigger on description contains / concept), action set category |
| Mark auto-created rules | Tag `abaqo-auto` on the rule's transactions and a title prefix `[abaqo]` |
| Inbox visibility in Firefly | Tag `abaqo-bandeja` while pending |
| Manual expense or cash income | Create transaction on the cash account |
| Category list | Categories API, synced with Abaqo categories |

## Rules

- Auth: personal access token from env `FIREFLY_TOKEN`; base URL `FIREFLY_URL`. Never log them.
- Verify the webhook signature with the webhook secret before parsing the body. Reject on
  mismatch with 401 and do not retry processing.
- Webhooks can arrive twice. Processing must be idempotent by Firefly transaction id.
- Split transactions exist: classify per split (journal), not per group.
- Amounts from Firefly are decimal strings. Convert to integer cents at the boundary.
- In tests, use the `dev` stack Firefly or recorded fixtures under `api/test/fixtures/firefly/`.
