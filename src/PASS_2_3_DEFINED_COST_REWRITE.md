# Pass 2.3 - Defined Cost / Loss and Expense Rewrite

## Objective
Replace the accumulated patch-style Defined Cost prompt with a clean prompt built from first principles.

## Files changed
- `src/lib/ai/prompts/definedCostImpact.ts`

## What changed
- Rewrote the generic, NEC and JCT Defined Cost / valuation prompts from scratch.
- Refocused the section on recoverability rather than narrative summary.
- Added a strict resource-retention chain:
  - event / instruction
  - planned activity blocked or changed
  - resource retained, disrupted, remobilised, rehandled or used differently
  - inability to productively redeploy
  - sequence/productivity/attendance effect
  - recoverable Defined Cost / loss and expense consequence
- Added resource-specific rules for labour, supervision, plant, subcontract and materials.
- Added relevance rules so the AI should not write filler paragraphs for resources that are not actually affected.
- Kept NEC and JCT language separate.

## Syntax check
Prompt files were checked with TypeScript parsing after the rewrite.
