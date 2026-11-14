---
name: enable-banking
description: How Abaqo gets bank transactions - Firefly Data Importer with Enable Banking in free restricted mode for Santander (Spain), consent renewal, daily cron import, Santander/Bizum description quirks and the CSV fallback. Use when configuring imports or parsing bank descriptions.
---

# Enable Banking and the Data Importer

Abaqo does not call Enable Banking directly. The Firefly III Data Importer does; Abaqo
configures, schedules and monitors it.

Official guide: https://docs.firefly-iii.org/tutorials/data-importer/eb/

## Setup facts

- Application in the Enable Banking Control Panel, environment Production (sandbox returns no
  real data). Restricted mode is free but only returns accounts linked with "Link accounts".
- Redirect URL `https://<importer>/eb-callback` must match exactly and be HTTPS in production
  (Tailscale Serve certificate is fine; it does not need to be public).
- Importer env: `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_PRIVATE_KEY` (PEM as one line with `\n`).
  These live in `deploy/.env`, never in the repo.
- Consent expires (check the validity the bank reports). Abaqo must alert the user a week before
  expiry with a link to re-authorize.

## Daily import

- A cron container calls the importer once a day (default 07:00 Europe/Madrid) with a saved
  JSON configuration. Duplicate detection: content-based.
- After import, Firefly fires webhooks and Abaqo's pipeline takes over.

## Parsing descriptions

- Normalize to a merchant key: uppercase, strip card numbers, dates, references, city suffixes
  and repeated spaces. Keep a fixture file of real-looking examples and test the normalizer.
- Bizum: detect sent vs received and extract the concept and counterpart name. The counterpart
  name is personal data: use it for matching shared expenses, never send it to the classifier.
- Description formats must be confirmed with real samples from the user's first import; record
  anonymized examples in `api/test/fixtures/santander/`.

## Fallback

If the bank connection fails, the importer accepts CSV exports. Keep a CSV mapping config for
Santander in `deploy/importer/`.
