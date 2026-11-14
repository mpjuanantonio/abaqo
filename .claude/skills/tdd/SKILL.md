---
name: tdd
description: Test-first workflow for Abaqo domain logic with Vitest - write a failing test from the spec, make it pass with the smallest change, refactor. Use when implementing or changing envelope, month-close, goal or shared-expense logic.
---

# Test-driven development

1. **Pick one rule** from the spec (usually `envelope-rules`). One rule per cycle.
2. **Red:** write a Vitest test in `api/src/domain/__tests__/` named after the rule
   (`month-close.thief-never-overdraws-victim.test.ts`). Use builders from
   `api/test/builders.ts`, amounts in cents. Run `npx vitest run <file>` and confirm it fails
   for the expected reason.
3. **Green:** smallest change in `api/src/domain/` that passes. No persistence, no clock.
4. **Refactor:** clean up with all tests green. Run `npm run test -w api`.
5. Repeat for the next rule.

Conventions:
- Arrange-Act-Assert; one behaviour per test; no snapshots for money.
- Property tests (fast-check) for invariants: allocations sum exactly to the budget; month close
  conserves money (sum of all movements is zero apart from carry and loan); re-running a close
  gives identical entries.
- Never weaken an assertion to make a test pass. If the spec looks wrong, stop and report.
