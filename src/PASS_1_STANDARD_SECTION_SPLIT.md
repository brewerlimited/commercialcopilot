# Pass 1 - Standard Section Prompt Split

## What changed

The Multi-Stage flow no longer relies on the lightweight Standard-for-Multi baseline for the supporting narrative sections.

The following sections now have their own section-specific prompt files and are generated independently in Multi-Stage mode:

- Background
- Effect on Defined Cost / Valuation Impact
- Programme Impact
- Assumptions
- Risks & Qualifications
- Conclusion
- Commercial Pushback
- Rebuttal

## Files added

- `lib/ai/prompts/background.ts`
- `lib/ai/prompts/definedCostImpact.ts`
- `lib/ai/prompts/programmeImpact.ts`
- `lib/ai/prompts/assumptions.ts`
- `lib/ai/prompts/risksQualifications.ts`
- `lib/ai/prompts/conclusion.ts`
- `lib/ai/prompts/commercialPushback.ts`
- `lib/ai/prompts/rebuttal.ts`

Each prompt file includes generic, NEC and JCT variants.

## Routing

`aiDraft.ts` now routes these supporting sections through the same NEC/JCT/generic prompt family selection used by the three existing specialist agents.

The Multi-Stage output is now assembled from:

1. Context extraction
2. Lightweight Standard-for-Multi baseline for safety/fallback completeness
3. Independent supporting section agents
4. Independent specialist agents
5. QA harmonisation for the three main specialist sections
6. Independent Commercial Pushback intelligence agent
7. Final merged JSON for Excel export

## Notes

Standard mode remains available as the original full standard generation path.

The Rebuttal generator now uses the new routed rebuttal prompt file rather than relying only on the old embedded prompt text.
