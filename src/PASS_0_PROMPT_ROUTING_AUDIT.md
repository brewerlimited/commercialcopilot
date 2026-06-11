# Commercial Co-Pilot Pass 0 — Prompt Routing Audit

Status: complete.

Confirmed in this source:
- change_to_contract_basis has generic, NEC and JCT prompt files.
- commercial_impact has generic, NEC and JCT prompt files.
- contractual_position has generic, NEC and JCT prompt files.
- QA harmonisation has generic, NEC and JCT prompt files.
- aiDraft.ts imports all prompt families.
- Multi-stage generation routes each specialist section through contract-family detection.
- Generic prompts remain as fallback only where NEC/JCT cannot be identified.

Pass 0 amendments made:
- Strengthened contract-family detection in src/lib/aiDraft.ts.
- Added detection for contract_form, contract documents, project contract fields, context contract family/form and likely contract mechanisms.
- Added JCT signals: JCT, DBSubC, Relevant Event, Relevant Matter, loss and expense, Sub-Contract Works, Employer's Requirements and tender basis.
- Added NEC signals: NEC3/NEC4, ECS, compensation event, Defined Cost, Accepted Programme, clause 60.1, clause 63 and Providing the Subcontract Works.
- Added routing logs so generation confirms whether NEC, JCT or generic fallback prompts are being used.
- Added protection so JCT does not accidentally route to NEC because of generic legacy field names such as effect_on_defined_cost.

Next pass:
- Split the remaining Standard generation sections into individual prompt files.
