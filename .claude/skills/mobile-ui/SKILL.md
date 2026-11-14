---
name: mobile-ui
description: UI rules for the Abaqo PWA - which screens exist on mobile vs desktop, one-handed layout, inbox interactions, money formatting, i18n and accessibility. Use when building or changing any screen or component in web/.
---

# Abaqo PWA UI

## Screens

| Phone (day to day) | Desktop (analysis) |
| --- | --- |
| Inbox: one card per pending item, category chips, "create rule?" toggle on by default, shared-expense and reimbursement actions | Dashboard: envelopes over time, spend by category, % auto-classified, Jev cost |
| Add: expense or income in two taps, envelope picker, split for income | Category and rules management |
| Month: each envelope's available amount and progress, "te deben" list | Month close history and re-run |
| Goals: progress bars with target and margin markers | Settings |
| Alerts: budget and goal notifications | |

## Layout

- Design at 360 px wide first. Primary actions in the bottom third (thumb zone), sticky bottom bar.
- Touch targets at least 44 x 44 px. No hover-only interactions.
- Inbox: process with one tap per item; undo via toast for 5 s instead of confirm dialogs.
- Loading: skeletons, not spinners. Offline: show cached data with a "sin conexión" banner.

## Content

- Money: `formatMoney(cents)` → `1.234,56 €`. Negative available amounts in the critical colour
  and with a minus sign (never colour alone).
- Dates in es-ES short format; month names from i18n.
- Every string from i18n (`es`, `en`); Spanish is the default.

## Accessibility

- Semantic elements, labelled form controls, visible focus, contrast AA in light and dark.
- Progress bars expose `aria-valuenow`/`aria-valuemax` and a text equivalent.
