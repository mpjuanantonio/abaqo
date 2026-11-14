---
name: envelope-rules
description: Authoritative rules of Abaqo's envelope budgeting - month definition, month open, allocation (fixed or percentage), sub-categories, balance formula, manual transfers, protected savings floor, internal financing, surplus rules (accumulate, transfer), shortfall rules (loan, thief), month close order, unclassified spend, refunds, extra income, shared expenses, goals, chained-loan alerts and account reconciliation. Use whenever code computes balances, opens or closes a month or moves money between envelopes.
---

# Envelope rules

These rules are the specification. Code and tests must match them. If something is not covered,
stop and ask the tech lead; do not invent behaviour.

Guiding principle: the user is free to move their money however they want. Automatic mechanisms
(month open, close, thieves) are conservative and never create money or break a protection.
Manual transfers and early repayments are only refused when they would create money that does
not exist; crossing a protection only asks for confirmation. Internal financing is the one
manual action with hard limits, taken from the architecture, because it commits future months.

All amounts are integer cents. All examples are in euros for readability. Zero-amount entries
are never written.

## Rounding

- Splitting an amount in parts (percentage allocations, extra-income splits, shared expenses,
  installments) uses largest remainder. Ties go to the lower `sort_order`, then the lower id;
  for installments, to the earlier one.
- Percentage allocations: the total to distribute is `floor(budget x sum of bp / 10000)`.
- Means of money (floor in `months` mode, promotion and chained-loan suggestions) divide with
  round-half-up to the cent.
- A percentage equivalent of an amount uses the current month's base budget, rounded up to the
  next basis point.

## Month

- A budget month starts on the user's configured day (`settings.month_start_day`, default 1) at
  00:00 Europe/Madrid and ends the day before the next start. If the day does not exist in a
  month (29-31), the month starts on that month's last day.
- The base budget of a month is set by the user (usually the salary). It does not depend on
  when the salary arrives. Extra income is added on top (see Extra income).
- A month is `open` or `closed`. Only one month is open at a time: the current one.
- Month boundary: at the month start a job closes month M and opens M+1 in one database
  transaction. No user action is needed. The guided close is a review of that result and may
  trigger re-runs. A transaction always belongs to the month of its date.
- A change of `month_start_day` applies from the next month: the current month ends the day
  before the new start day's next occurrence.
- Configuration is live while a month is open. At close, the configuration used (every
  category's kind, parent, allocation, rules, target, victim and sort order, plus the special
  envelope ids) is frozen in the month's `config_snapshot`. Re-running a closed month always
  uses its snapshot, never the current configuration.

## Categories

| Kind | Has allocation | Surplus/shortfall rules | Spending tracked |
| --- | --- | --- | --- |
| `envelope` | yes | its own | yes |
| `subcategory` | no, spends from its parent envelope | the parent's | yes, separately |

- Only one level: a subcategory cannot have subcategories.
- A subcategory can be promoted to an envelope. Suggest it once the subcategory has spend in 3
  closed months, with an allocation from its real spend (mean and max of those months).
  Promotion takes effect at the next month open; the current month is not changed.
- Archiving an envelope or demoting it to a subcategory takes effect at the next month open and
  is rejected unless its `available` is 0 (move it first with a manual transfer), it has no
  active financing as borrower or lender, no unfulfilled goal, and no other envelope uses it as
  target or victim. Categories are archived, never deleted: closed months keep them.
- Only envelopes can be the source or target of transfers, thieves and financing.
- Income and internal transfers between own accounts are not envelopes and never count as spend.

Two envelopes are special. Both are identified by settings, never by name:

| Envelope | Setting | Fixed behaviour |
| --- | --- | --- |
| Savings ("Ahorro") | `settings.savings_category_id` | Exactly one, cannot be archived. Surplus rule is always `accumulate`; it has no shortfall rule (its balance carries as it is, even negative). Default target of transfers, thieves, unallocated money and unassigned extra income. Has the protected floor. |
| Investment | `settings.investment_category_id` (optional) | Surplus rule is always `accumulate`. Never lends (financing) and is never a thief's victim. |

## Envelope entries (the ledger)

Every movement of budget money is one row in `envelope_entries`. Balances are always derived.

| Kind | Sign | Written by |
| --- | --- | --- |
| `opening` | + | user, once, at install |
| `allocation` | + | month open |
| `carry` | + | close of the previous month |
| `loan` | − | close of the previous month |
| `installment_out` / `installment_in` | − / + | month open (financing), or user (early repayment) |
| `extra_income` | + | user, or close (unassigned income to savings) |
| `manual_out` / `manual_in` | − / + | user |
| `financing_out` / `financing_in` | − / + | user |
| `adjustment` | ± | user (reconciliation) |
| `transfer_out` / `transfer_in` | − / + | close |
| `thief_in` / `thief_out` | + / − | close (`thief_in` on the thief, `thief_out` on the victim) |

Each entry has a `source` (`user`, `open` or `close`) and, for the last two, the `sourceMonth`
of the open or close that wrote it. Close M writes into M (step 0, transfers, thefts) and into
M+1 (`carry`, `loan`), all with `sourceMonth` = M. Re-running an open or a close deletes and
regenerates exactly the entries with its own source and `sourceMonth`. User entries are inputs
and are never touched by a re-run. The two halves of a movement share a `pairId`.

## Balance during the month

```
netSpent  = expenses (own share only for shared expenses, including subcategories)
            - refunds of that category dated in the month
            + receivables written off in the month
available = sum of the envelope's entries in the month - netSpent
```

`netSpent` can be negative in a month (a refund larger than the spend); that is valid.

## Month open

Opening a month is re-runnable while the month is open (the user may change the budget or the
allocations at any time). The first month after install has no open: its money comes from
`opening` entries (see Accounts and reconciliation). Steps, in order:

1. `carry` and `loan` entries come from the previous close (nothing to compute here).
2. Resolve allocations (see Allocation) and write one `allocation` entry per envelope.
3. Add the unallocated remainder to savings. Savings may also have its own allocation; both
   go in a single `allocation` entry.
4. For every active financing, write its installment: `installment_out` on the borrower,
   `installment_in` on the lender.
5. The first time the month is opened, freeze the savings floor (see Protected savings floor).
   Re-runs keep the frozen value.
6. Compute the transfer plan (see Accounts and reconciliation). It is information, not entries.

## Allocation

- Each envelope has either `fixedCents` or `percentBp` (basis points).
- Percentages apply to the **base budget** only, never to extra income.
- Percentages are resolved first, then fixed amounts. Use largest-remainder rounding so the
  resolved total is exact to the cent.
- The sum of allocations must be <= base budget. Reject the configuration otherwise (validation
  error listing the excess). The remainder goes to savings.

## Manual transfers

- At any time in the open month the user can move money between two different envelopes:
  `manual_out` on the source, `manual_in` on the target, same amount.
- The amount must be > 0 and <= the source's `available`. A transfer never creates money.
- From savings, the amount above the floor moves freely. Going below the floor requires the
  explicit flag `confirmBelowFloor`; without it, reject with the maximum free amount.
- Manual transfers cannot be dated in a closed month.
- If a late transaction later leaves the source negative, the transfer stays and the source's
  shortfall rule applies at close.

Example: Ocio has 80 available, Viajes 200. Move 50 from Ocio to Viajes: Ocio 30, Viajes 250.
Moving 90 is rejected.

## Protected savings floor

The emergency cushion is a floor inside savings, not a separate envelope.

- Setting: `settings.savings_floor_mode` = `none` (default), `fixed` (`savings_floor_cents`) or
  `months` (`savings_floor_months` x mean total net spend of the last 3 closed months; with fewer
  than 3 closed months, use the ones that exist; with none, floor is 0).
- The floor is resolved the first time the month is opened and frozen in the month
  (`budget_months.savings_floor_cents`). Re-runs never recompute it, so opens and closes are
  deterministic. The engine receives it as an input.
- `lendable(savings) = max(0, available - floor)`. For any other envelope,
  `lendable = max(0, available)`.
- Automatic mechanisms (thieves at close, new financing) can only use `lendable`. What they
  cannot cover becomes a loan on the envelope that needed it.
- Real spend from savings and its subcategories cannot be refused: it reduces savings even
  below the floor. The deficit simply carries (savings has no shortfall rule) and raises the
  alert `savings_below_floor`. While savings is below the floor its `lendable` is 0.
- Only a manual transfer with `confirmBelowFloor` takes savings below the floor on purpose.
- Display: months covered = savings available / mean monthly net spend of the last 3 closed
  months, rounded down to one decimal; not shown when that mean is 0 or negative.

Example: savings 3,200, floor 3,000. Viajes (thief of savings) closes 350 short. It takes 200;
150 becomes a loan on Viajes. Savings ends at 3,000.

## Internal financing

A large purchase an envelope cannot pay is financed by another envelope and repaid in
installments, without interest.

- Created by the user in the open month: borrower, lender, `principalCents`, `months` (1-12).
- Rejected if: borrower = lender; the lender is the investment envelope; `principalCents` >
  `lendable(lender)`; `months` > 12; or the borrower's total installments (existing + new)
  exceed 50 % of its resolved monthly allocation.
- On creation: `financing_out` on the lender and `financing_in` on the borrower, for the
  principal, in the open month.
- Installments: the principal split in `months` parts with largest-remainder rounding (earlier
  installments get the extra cents). The first one is charged at the next month open.
- Early repayment: at any time, any amount <= outstanding and <= the borrower's `available`;
  written as `installment_out` / `installment_in` with source `user`. It cancels the last
  installments first (the term gets shorter, the installment stays).
- Outstanding = principal - sum of installments paid. Derived, never stored. A financing is
  `active` while outstanding > 0.
- The installment charged at an open is `min(scheduled installment, outstanding before that
  open)`, so after an early repayment the plan simply ends sooner.
- A financing is a user input: if a re-run later shows the lender did not have the money, the
  financing stays and the lender's shortfall rule (or savings' carry) absorbs it.
- If the borrower's allocation is later lowered so installments exceed 50 %, existing financings
  continue unchanged; only new ones are rejected.
- An installment is always charged in full. If it leaves the borrower short, the borrower's
  shortfall rule applies at close.
- Display: total debt with yourself (sum of outstanding) and the month the last one ends.
- Difference with `loan`: a loan deducts the whole excess next month; financing spreads it.

Example: Caprichos has allocation 200 and 100 available. A 500 table: savings (lendable 1,000)
finances 400 over 4 months. Now: savings -400, Caprichos +400 (available 500, pays the table).
Next four opens: Caprichos gets 200 - 100 = 100; savings +100. Installment 100 = 50 % of 200: valid.
With allocation 150 the same plan is rejected (100 > 75); over 6 months (four of 66.67, then two
of 66.66) it is valid.

## Month close

Each envelope has one surplus rule and one shortfall rule (savings and investment are fixed,
see Categories).

| Case | Rule | Effect at close |
| --- | --- | --- |
| Surplus | `accumulate` | surplus becomes `carry` of the same envelope next month |
| Surplus | `transfer` | surplus is added to `targetEnvelope` (default savings) this close; next month starts at its allocation |
| Shortfall | `loan` | shortfall becomes `loan` of the same envelope next month |
| Shortfall | `thief` | shortfall is taken from `victimEnvelope` (default savings) |

`targetEnvelope` and `victimEnvelope` must be envelopes other than the envelope itself. The
target's own surplus rule must be `accumulate` (no chains of transfers), and the victim cannot
be the investment envelope.

Order is fixed:

0. Unassigned extra income of the month goes to savings (`extra_income`, source `close`).
1. Compute every envelope's end balance (`available`).
2. For every envelope with rule `transfer` and a positive step-1 balance, move that balance to
   its target (`transfer_out` / `transfer_in`).
3. Re-evaluate balances. For every envelope still negative with rule `thief`, in envelope sort
   order: take `min(shortfall, lendable(victim))` from the victim (`thief_in` / `thief_out`).
   A thief never takes a victim below 0, nor savings below its floor.
4. Every envelope now has a final balance. Positive: write `carry` in the next month, whatever
   the rule (a `transfer` envelope is normally at 0 here). Negative: write `loan` in the next
   month. This covers rule `loan`, the part a thief could not cover, and a negative savings.
5. Snapshot the close (inputs, final balances, unclassified spend, entries written).

Clarifications:

- No cascading: a thief takes only from its own victim. If the victim is itself short, it has
  nothing to give and the thief's shortfall becomes a loan. Chains (A steals from B, B steals
  from C) are therefore order-independent; sort order only matters when several thieves share
  a victim.
- An envelope with surplus rule `transfer` gives its surplus away in step 2, so thieves in
  step 3 find it at 0. That is intended: transfers first, then thieves.
- Conservation: in a close, transfers and thefts sum to zero, and for every envelope,
  regardless of its rules, `available after steps 2-3 = carry or loan written to the next month`.

Close is re-runnable: a late transaction, a classification, a refund or a shared-expense change
dated in a closed month re-runs that close and every later one (and the opens in between).
Re-running with the same inputs must produce identical entries (idempotent).

Example with every rule (budget 2,000, floor 0, sort order as listed):

| Envelope | Rules | Available at close | Step 2 | Step 3 | Next month |
| --- | --- | --- | --- | --- | --- |
| Supermercado | transfer -> Ahorro / loan | +40 | -40 | | no entry |
| Caprichos | accumulate / loan | -30 | | | loan -30 |
| Transporte | accumulate / loan | +25 | | | carry +25 |
| Vivienda | transfer / thief <- Imprevistos | -80 | | +50 | loan -30 |
| Imprevistos | accumulate / thief <- Ahorro | +50 | | -50 | no entry |
| Ahorro | accumulate | +300 | +40 | | carry +340 |

## Unclassified spend (inbox not emptied)

- Closing is never blocked by a non-empty inbox.
- Pending expenses at close count as `unclassified` spend: a system bucket with no allocation
  and no rules. It does not reduce any envelope. Its total is stored in the close snapshot.
- When the user classifies one, the close of that month and the later ones are re-run.
- Pending income at close is unassigned extra income (step 0). Reassigning it later re-runs
  the close.

## Refunds

- A refund of a purchase reduces the `netSpent` of its category. It is never income.
- It counts in the month of the refund's own date, not the purchase's. Closed months are not
  reopened because of a refund in a later month.
- If linked to a shared expense, the refund is split with the expense's own proportions: the
  user's part is negative `netSpent` in the refund's month and the rest reduces the receivable.
  The purchase month is not changed.
- Incoming money is asked in this order in the inbox: reimbursement of a shared expense,
  refund of a purchase, or extra income.

Example: 120 jacket bought in March (Ropa). Returned in April: April's Ropa `netSpent` is -120
if nothing else was bought, so April's available is allocation + carry + 120.

## Extra income

- Salary is any income whose normalized payer key is in `settings.salary_keys` (the user marks
  the first one in the inbox). Salary is never extra income: it funds the base budget (see
  Accounts and reconciliation).
- Any other income enters the inbox as income.
- Cash added by hand is extra income on the cash account, assigned in the same step.
- The user assigns it to one envelope or splits it (amounts or percentages, largest-remainder):
  `extra_income` entries in the month of the income's date.
- Unassigned extra income goes to savings at close (step 0).
- Interest from a savings account is extra income; a rule usually sends it to savings.
- Extra income never changes percentage allocations.

## Shared expenses

- Marking an expense as shared sets `participants` (equal split, largest-remainder with the
  user's share taking the extra cents) or explicit shares, which must sum to the expense total.
  The envelope counts only the user's share immediately; the rest is a receivable ("te deben").
- A linked reimbursement only reduces the receivable. It is neither income nor a change to
  `netSpent`: the envelope already counted only the user's share.
- The receivable of an expense is derived: others' shares - linked reimbursements - write-offs.
  It can be negative (the user was paid too much, or a refund arrived after everyone paid):
  that is a payable ("debes"). Paying it back by a linked Bizum is not an expense; the user may
  instead keep it as extra income.
- Received Bizums are matched to open shared expenses by amount close to a share, similar
  concept and a date 0-14 days after the expense. Matching is a suggestion; the user confirms.
- Unpaid receivables carry over to the next month. If the user writes one off, it is added to
  the envelope's `netSpent` in the month it is written off.
- Paying someone back by Bizum is a normal expense classified by its concept.

## Goals

- A goal belongs to one envelope: `targetCents`, `marginCents`, optional `dueDate`.
- A goal requires the envelope's surplus rule to be `accumulate`; reject otherwise. Changing
  that rule while the envelope has unfulfilled goals is rejected too.
- Several goals on one envelope stack in creation order: the progress of a goal is
  `available - sum of targets of earlier goals not yet fulfilled`, floored at 0.
- Notify once when progress >= target - margin, and once when progress >= target (`reached`).
- Fulfilment: when an expense of at least `target - margin` is classified into the envelope
  while the goal is `reached` or within margin, the goal is marked `fulfilled` automatically
  (undoable). Smaller expenses do nothing. The user can also mark or unmark it by hand.
- With `dueDate`: monthly amount needed = `max(0, target - progress)` / months left, rounded up
  to the cent. Months left counts budget months from the current one through the one that
  contains `dueDate`, inclusive, minimum 1.

## Chained loans

- If an envelope's close writes a `loan` (from rule `loan` or from an uncovered thief) three
  months in a row, raise the alert `chained_loan` once, with a proposed allocation: the mean
  `netSpent` of those three months rounded up to the next euro (for percentage envelopes, the
  equivalent basis points rounded up).
- The streak resets with any close without a loan. If it continues, alert again every three
  further months. Savings is excluded (see `savings_below_floor`).

## Accounts and reconciliation

Envelopes are not tied to an account. Abaqo checks that real money matches the envelopes.

```
expected   = sum of available of all envelopes
             + unassigned extra income of the open month
             - net receivables of every shared expense still open, from any month
             - unclassified spend still pending, from any month
             + funding balance
difference = real balance of all own accounts - expected
```

- Funding balance: envelopes receive the base budget at month open, but the real salary lands
  whenever it lands. `fundingBalance = salary received - base budgets opened - top-ups`, counting
  salary deposits dated after install and every month opened after the first. Negative: budget
  not yet funded (salary pending). Positive: salary not yet budgeted (arrived early or is higher
  than the budget).
- A positive funding balance that remains after a month open can be assigned by the user to
  envelopes as a top-up (`extra_income` entries); a persistently negative one means the base
  budget is higher than the salary and the user should lower it. Neither is ever a difference.
- Real balances come from Firefly asset accounts, or a manual balance for accounts without sync.
- If `difference` is not 0, the user either assigns it to an envelope or accepts it as a plain
  adjustment (which goes to savings). Both write one `adjustment` entry for the difference.
- Internal transfers: a withdrawal and a deposit on two own accounts with the same amount and
  dates at most 3 days apart are paired. They are neither spend nor income. An unpaired half
  goes to the inbox.
- Opening balance: at install the user distributes the real money once (`opening` entries in
  the first month, which has no allocations; the wizard prefills them from the configured
  allocations). What is not distributed goes to savings, so `difference` starts at 0.
- Transfer plan at month open (information only): for each envelope,
  `planned = allocation + installment_in - installment_out`. To the spending account goes the
  sum of `planned` of every envelope except savings and investment; to the savings account,
  `planned` of savings (including the unallocated remainder) and investment. The two add up to
  the base budget.

Example: envelopes sum 2,450, receivables 60, unclassified 15, no unassigned income, funding
balance 0. Expected 2,375. Accounts hold 2,365: difference -10. Assigning it to Ocio writes
`adjustment` -10 there.

Funding example: budget 2,000, month opens on the 1st, salary arrives on the 3rd. On the 2nd the
funding balance is -2,000 and the difference is 0; on the 3rd both are 0.

## Outside the engine

These belong to the inbox and classification, not to this specification: rules for recurring
income, suggesting that an expense followed by several Bizums is shared, matching heuristics,
and when notifications are sent. The engine only receives their result.

## Worked example (use as a test)

Budget 2,000.00. Caprichos: fixed 100.00, surplus accumulate, shortfall loan. Spent 60.00.
Close: carry next month = 40.00, next month available starts at 140.00.
Same envelope, spent 130.00 instead: next month loan = -30.00, available starts at 70.00.
