# Pass 2.1B - Skip Risks and Qualifications Agent

## Why
The Risks and Qualifications section has been removed from the current Commercial Co-Pilot pack direction. It was still being generated as an individual AI section agent, which wasted tokens and could fail the full pack generation on TPM even though the section is no longer required.

## What changed
- Removed the Risks and Qualifications AI call from the multi-stage Promise.all section generation flow.
- Set `risks_and_qualifications` to an empty string in the generated client output.
- Added a multi-stage diagnostic entry showing the Risks and Qualifications agent was intentionally skipped.
- Updated the wiring audit entry so it is marked as skipped rather than generated.

## Result
Multi-stage generation no longer calls the Risks and Qualifications agent, reducing TPM pressure and preventing low-value failures from blocking pack generation.
