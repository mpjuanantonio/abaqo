---
name: jev
description: How Abaqo classifies transactions with the Jev decision model (TypeSafe) behind the Classifier interface - inputs allowed, choice-from-set questions with probabilities, threshold, recurring-charge detection, failures and alternative providers. Use when touching api/src/classifier/ or the dynamic-rule logic.
---

# Jev classifier

Jev is a decision model: it does not write text, it returns typed decisions (yes/no with a
probability, one choice from a defined set, or a score). Pricing is per input token and output is
free, so a transaction costs a fraction of a cent.

## Before coding

Check the current API docs from TypeSafe or the gateway you use (OpenRouter, Vercel AI Gateway,
AI/ML API and others expose it under different ids such as `typesafe/jev`). Record the endpoint,
model id and request shape you verified in a comment. Do not guess the payload.

## The interface

```ts
interface Classifier {
  classify(input: ClassifyInput): Promise<ClassifyResult | null>; // null = failed, send to inbox
  isRecurring(input: RecurringInput): Promise<number | null>;     // probability 0..1
}
type ClassifyInput = { text: string; amountCents: number; date: string; categories: string[] };
type ClassifyResult = { category: string; probability: number };
```

Implementations: `JevClassifier` (default), `OpenAICompatibleClassifier`, `OllamaClassifier`.
Selected by `CLASSIFIER_PROVIDER`.

## Rules

- `text` is the merchant description, or the Bizum concept for Bizums. Nothing else leaves the
  server: no IBAN, no names, no balances.
- Ask Jev a choice question over the user's active categories (envelopes and subcategories by
  their display names).
- Threshold `settings.jev_threshold` (default 0.85): at or above, assign and tag
  `abaqo-auto`; below, inbox with the suggestion.
- Recurring check: same normalized merchant key, similar amount (within 10 %), ~monthly. Ask
  `isRecurring`; if yes, create the rule at the second charge.
- Dynamic rule after 3 consecutive same-category decisions for the same merchant key or Bizum
  concept. Never for generic merchants (Amazon, PayPal) listed in `settings.generic_merchants`.
- Timeouts at 5 s, one retry. Any failure returns `null`; the transaction goes to the inbox
  without suggestion. Log provider, latency and token count to `classification_log`, never the text.
- Tests use a fake classifier; no network calls in unit tests.
