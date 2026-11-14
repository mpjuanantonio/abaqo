---
name: envelope-rules
description: Authoritative rules of Abaqo's envelope budgeting - month definition, allocation (fixed or percentage), sub-categories, surplus rules (accumulate, transfer), shortfall rules (loan, thief), month close order, extra income, shared expenses and goals. Use whenever code computes balances, closes a month or moves money between envelopes.
---

# Envelope rules

These rules are the specification. Code and tests must match them. If something is not covered,
stop and ask the tech lead; do not invent behaviour.

## Month

- A budget month starts on the user's configured day (`settings.month_start_day`, default 1) at
  00:00 Europe/Madrid and ends the day before the next start.
- The month budget is set by the user (usually the salary) plus any extra income assigned
  during that month. It does not depend on when the salary arrives.

## Categories

Two kinds:

| Kind | Has allocation | Surplus/shortfall rules | Spending tracked |
| --- | --- | --- | --- |
| `envelope` | yes | its own | yes |
| `subcategory` | no, spends from its parent envelope | the parent's | yes, separately |

- Only one level: a subcategory cannot have subcategories.
- A subcategory can be promoted to an envelope. Suggest an allocation from its real spend
  (mean and max of the last 3 closed months). After promotion it stops spending from the parent.
- `Ahorro` (savings) is a regular envelope that is the default target for transfers, unassigned
  money and thieves. Its name comes from the user's settings, not from code.
- Income and internal transfers are not envelopes and never count as spend.

## Allocation

- Each envelope has either `fixedCents` or `percentBp` (basis points of the month budget).
- Percentages are resolved first, then fixed amounts. Use largest-remainder rounding so the
  resolved total is exact to the cent.
- The sum of allocations must be <= month budget. Reject the configuration otherwise (validation
  error listing the excess). The remainder goes to the savings envelope.

## Balance during the month

```
available = allocated + carryIn + extraIncomeAssigned - spent + reimbursementsLinked
```

`spent` for an envelope includes its subcategories. For shared expenses only the user's share
counts (see below).

## Month close

Each envelope has one surplus rule and one shortfall rule.

| Case | Rule | Effect at close |
| --- | --- | --- |
| Surplus | `accumulate` | surplus becomes `carryIn` of the same envelope next month |
| Surplus | `transfer` | surplus is added to `targetEnvelope` (default savings) this close; next month starts at its allocation |
| Shortfall | `loan` | shortfall becomes negative `carryIn` of the same envelope next month |
| Shortfall | `thief` | shortfall is taken from `victimEnvelope` (default savings) |

Order is fixed:
1. Compute every envelope's end balance.
2. Apply all `transfer` surpluses.
3. Apply all `thief` shortfalls, in envelope sort order. A thief never takes a victim below 0:
   the part it cannot cover becomes a `loan` on the thief envelope.
4. Apply `accumulate` and `loan`.
5. Write one `envelope_entries` row per movement (`kind`: `transfer_in`, `transfer_out`,
   `thief_in`, `thief_out`, `carry`, `loan`) and snapshot the close.

Close is re-runnable: a late transaction dated in a closed month re-runs that close and every
later one. Re-running with the same inputs must produce identical entries (idempotent).

## Extra income

- Any income that is not the configured salary enters the inbox as income.
- The user assigns it to one envelope, splits it (amounts or percentages) or leaves it. Unassigned
  extra income goes to savings at close.
- A received Bizum first asks: reimbursement of a shared expense, or extra income?

## Shared expenses

- Marking an expense as shared sets `participants` (equal split) or explicit shares. The envelope
  counts only the user's share immediately; the rest is a receivable ("te deben").
- Received Bizums are matched to open shared expenses by amount close to a share, similar
  concept and date within 14 days. Matching is a suggestion; the user confirms.
- Unpaid receivables carry over to the next month. If the user writes one off, it is added to the
  envelope's spend in the month it is written off.
- Paying someone back by Bizum is a normal expense classified by its concept.

## Goals

- A goal belongs to one envelope: `targetCents`, `marginCents`.
- Notify once when balance >= target - margin, and once when balance >= target.
- A goal requires the envelope's surplus rule to be `accumulate`; reject otherwise.
- The goal is fulfilled when the user marks the purchase; the envelope continues normally.

## Worked example (use as a test)

Budget 2,000.00. Caprichos: fixed 100.00, surplus accumulate, shortfall loan. Spent 60.00.
Close: carryIn next month = 40.00, next month available starts at 140.00.
Same envelope, spent 130.00 instead: next month carryIn = -30.00, available starts at 70.00.
