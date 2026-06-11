# Pass 2.1C - Risks & Qualifications Full Cleanup

This pass completes the removal of the Risks & Qualifications section from the active Commercial Co-Pilot generation/export flow.

## Fixed

- The separate Risks and Qualifications AI agent is not called.
- `risks_and_qualifications` is not part of the active multi-stage section key/router.
- The OpenAI strict `DRAFT_JSON_SCHEMA` still includes `risks_and_qualifications` as a required empty string for backwards compatibility and because strict schemas require all object properties to be listed in `required`.
- Validation no longer treats `risks_and_qualifications` as a required meaningful section.
- Excel export no longer adds Risks and Qualifications rows.
- Draft templates no longer show Risks and Qualifications.
- Review page section selection no longer shows Risks & Qualifications.
- Payload Excel mapping no longer maps Risks and Qualifications to any tab.

## Why the field still exists in the schema

OpenAI strict JSON schema requires every key in `properties` to be included in `required`. To avoid breaking older generated pack records while still removing the section from the product, the field remains as `risks_and_qualifications: ""` only.

## Expected behaviour

Generation should no longer fail because Risks & Qualifications is missing, and no tokens should be spent generating a Risks & Qualifications narrative.
