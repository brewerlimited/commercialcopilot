# Pass - TPM 15s Agent Spacing

Emergency live-demo stability patch.

## Why
Multi-stage generation now uses many small AI section agents. Running them in parallel can exhaust the 30k TPM window even though each individual prompt is smaller.

## Changes
- Added `getMultiStageAgentGapMs()` with a default of 15 seconds.
- Added 15s spacing between multi-stage section agents.
- Changed section generation from `Promise.all` parallel execution to sequential execution.
- Increased required step retries to 4.
- Rate-limit retries now wait at least 15s, or the API requested delay if longer.
- Added spacing before QA Harmonisation and Commercial Pushback.

## Override
Set `MULTISTAGE_AGENT_GAP_MS` or `CC_MULTISTAGE_AGENT_GAP_MS` in Vercel if you need to adjust the delay.
