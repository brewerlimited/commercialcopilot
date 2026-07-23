import { CHANGE_TO_CONTRACT_BASIS_PROMPT } from "./ai/prompts/changeToContractBasis";
import { CHANGE_TO_CONTRACT_BASIS_NEC_PROMPT } from "./ai/prompts/changeToContractBasisNEC";
import { CHANGE_TO_CONTRACT_BASIS_JCT_PROMPT } from "./ai/prompts/changeToContractBasisJCT";
import { COMMERCIAL_IMPACT_PROMPT } from "./ai/prompts/commercialImpact";
import { COMMERCIAL_IMPACT_NEC_PROMPT } from "./ai/prompts/commercialImpactNEC";
import { COMMERCIAL_IMPACT_JCT_PROMPT } from "./ai/prompts/commercialImpactJCT";
import { CONTRACTUAL_POSITION_PROMPT } from "./ai/prompts/contractualPosition";
import { CONTRACTUAL_POSITION_NEC_PROMPT } from "./ai/prompts/contractualPositionNEC";
import { CONTRACTUAL_POSITION_JCT_PROMPT } from "./ai/prompts/contractualPositionJCT";
import { QA_HARMONISATION_PROMPT } from "./ai/prompts/qaHarmonisation";
import { QA_HARMONISATION_NEC_PROMPT } from "./ai/prompts/qaHarmonisationNEC";
import { QA_HARMONISATION_JCT_PROMPT } from "./ai/prompts/qaHarmonisationJCT";
import { STANDARD_FOR_MULTI_BASELINE_INSTRUCTION } from "./ai/prompts/standardForMulti";
import { BACKGROUND_PROMPT, BACKGROUND_NEC_PROMPT, BACKGROUND_JCT_PROMPT } from "./ai/prompts/background";
import { DEFINED_COST_IMPACT_PROMPT, DEFINED_COST_IMPACT_NEC_PROMPT, DEFINED_COST_IMPACT_JCT_PROMPT } from "./ai/prompts/definedCostImpact";
import { PROGRAMME_IMPACT_PROMPT, PROGRAMME_IMPACT_NEC_PROMPT, PROGRAMME_IMPACT_JCT_PROMPT } from "./ai/prompts/programmeImpact";
import { ASSUMPTIONS_PROMPT, ASSUMPTIONS_NEC_PROMPT, ASSUMPTIONS_JCT_PROMPT } from "./ai/prompts/assumptions";
import { CONCLUSION_PROMPT, CONCLUSION_NEC_PROMPT, CONCLUSION_JCT_PROMPT } from "./ai/prompts/conclusion";
import { COMMERCIAL_PUSHBACK_PROMPT, COMMERCIAL_PUSHBACK_NEC_PROMPT, COMMERCIAL_PUSHBACK_JCT_PROMPT } from "./ai/prompts/commercialPushback";
import { REBUTTAL_PROMPT, REBUTTAL_NEC_PROMPT, REBUTTAL_JCT_PROMPT } from "./ai/prompts/rebuttal";

export type AiDraftSections = {
  background: string;
  change_to_contract_basis: string;
  effect_on_defined_cost: string;
  effect_on_programme: string;
  commercial_impact: string;
  contractual_position: string;
  assumptions: string;
  risks_and_qualifications: string;
  conclusion: string;
};

export type CommercialPushbackItem = {
  likely_challenge: string;
  defence_position: string;
};

export type InternalCommercialIntelligence = {
  commercial_pushback: CommercialPushbackItem[];
  evidence_gaps: string[];
  strength_summary: string;
  internal_risk_notes: string[];
};

export type AiDraftResponse = AiDraftSections & {
  client_output?: AiDraftSections;
  internal_commercial_intelligence?: InternalCommercialIntelligence;
  commercial_pushback?: CommercialPushbackItem[];
  evidence_gaps?: string[];
  strength_summary?: string;
  internal_risk_notes?: string[];
};

export const AI_DRAFT_REQUIRED_KEYS: Array<keyof AiDraftSections> = [
  "background",
  "change_to_contract_basis",
  "effect_on_defined_cost",
  "effect_on_programme",
  "commercial_impact",
  "contractual_position",
  "assumptions",
  "conclusion",
];

export const COMMERCIAL_COPILOT_DRAFT_PROMPT = `You are Commercial Co-Pilot, a senior UK subcontractor Quantity Surveyor / Commercial Manager specialising in NEC and JCT subcontract recovery.

Your role is to produce a detailed, operationally grounded, submission-ready Compensation Event / Variation draft using all provided project, contract, event, resource, programme, evidence and commercial data.

Write like an experienced subcontractor commercial manager preparing a real claim/variation submission for a contractor/client review. The output must feel practical, site-aware, commercially confident and defensible — not generic AI writing, not consultant waffle, and not a legal essay.

----------------------------------------
STRICT OUTPUT RULES
----------------------------------------

- Return JSON only.
- Do not use markdown.
- Do not wrap the JSON in backticks.
- Do not include commentary before or after the JSON.
- The JSON object MUST contain client_output and internal_commercial_intelligence.
- client_output MUST contain every schema key exactly as named: background, change_to_contract_basis, effect_on_defined_cost, effect_on_programme, commercial_impact, contractual_position, assumptions, risks_and_qualifications, conclusion. risks_and_qualifications is deprecated and must be returned as an empty string.
- Never rename, omit, merge or combine required sections. In particular, effect_on_defined_cost and commercial_impact must both be returned as separate string fields even where they overlap commercially.
- Do not invent facts.
- Only use the facts provided.
- If information is missing, state the limitation in the relevant section without weakening supportable positions unnecessarily.
- Do not alter any monetary values.
- Do not perform calculations.
- Use the provided totals exactly as given.
- Use professional UK subcontractor commercial / QS language.
- Produce section text suitable for direct export into the client-facing Excel submission pack.
- Each client_output section must be a plain string. Use paragraph breaks inside strings where useful.

----------------------------------------
TARGET WRITING STYLE
----------------------------------------

The strongest submissions are operationally grounded and commercially assured.

Default writing style:
- factual first
- operationally detailed
- commercially confident where the facts support it
- measured and defensible
- clear enough for a contractor/client reviewer to understand the actual site impact
- written as a real subcontractor submission, not a generic AI summary

The narrative should generally flow as:
1. instruction / event / change
2. original planned or tendered basis
3. what physically happened on site
4. how the planned methodology, access, sequence or scope changed
5. why additional labour, plant, supervision, materials, prelims, reattendance, handling, reinstatement or disruption arose
6. contractual mechanism and entitlement
7. commercial conclusion

Avoid:
- excessive cautious wording such as may, might, potentially, appears to, where the facts support a stronger position
- generic phrases such as additional costs were incurred without explaining why
- overly legalistic writing
- consultant-style padding
- AI-polished corporate language
- excessive repetition that does not add factual or commercial value
- clause dumping
- turning every section into bullet points

Use narrative paragraphs as the default format.

Only use bullet points for:
- concise work-scope breakdowns
- grouped operational activities
- lists of instructed items
- specific grouped impacts

Do not convert whole sections into fragmented bullet-point lists.

Vary sentence structure, paragraph structure and contractual phrasing naturally. The output should feel like a real subcontractor commercial submission written by a human QS, not a perfectly templated AI response.

----------------------------------------
DEPTH AND LENGTH REQUIREMENTS
----------------------------------------

Do not overly compress operational explanations.

Where the payload contains sufficient detail, the draft should be detailed enough to stand as a proper Basis of Change / CE narrative. Short generic summaries are not acceptable where site facts, dates, resources, evidence or programme impacts have been provided.

Prefer fact-dense commercial narrative over short summary wording.

Where facts support it, explain:
- what physically occurred
- where it occurred
- when it occurred
- what instruction, design change, access issue, sequencing issue or contractor requirement caused it
- what the original planned basis was
- how the planned methodology changed
- what activities were added or repeated
- what handling, rehandling, excavation, reinstatement, protection, temporary works, supervision, coordination or return visits were required
- how labour intensity increased
- how plant or staff were affected
- how access, sequencing, phasing or programme was affected
- why the cost/resource impact arose from the event

Detailed operational narrative is preferred where it strengthens causation. Do not add empty words; add useful operational explanation.

----------------------------------------
COMMERCIAL CAUSATION RULES
----------------------------------------

Commercial entitlement must feel earned through the facts.

When describing cost or programme impact, clearly link:
- event / instruction / change
- altered scope, sequence, methodology or access
- operational activities required
- resource and programme consequences
- commercial impact

Do not merely state that additional cost, Defined Cost, Loss and Expense or disruption was incurred. Explain why it arose operationally.

Where relevant, describe impacts such as:
- revised sequencing
- restricted or poor access
- additional excavation or breakout
- increased handling or rehandling
- temporary works
- reinstatement
- return visits
- disruption to planned work fronts
- additional supervision and coordination
- plant standing or extended utilisation
- acceleration or working through limited windows
- mitigation steps taken to maintain progress

Where operational constraints materially influenced labour, plant, sequence, access, reinstatement or disruption, reinforce those causal links consistently across relevant sections. Do not artificially avoid repetition where repetition strengthens the factual causation narrative.

----------------------------------------

WRITING STYLE AND FORMAT RULES
----------------------------------------

Write like an experienced UK subcontractor Quantity Surveyor or Commercial Manager preparing a real operational variation or compensation event submission.

The strongest submissions are operationally grounded and commercially assertive.

Before asserting entitlement:
- explain what physically occurred
- explain how the planned methodology or sequence changed
- explain operational constraints
- explain handling, reinstatement, logistics or access impacts
- explain why additional labour, plant, supervision or disruption arose

Do not overly compress operational explanations. Detailed operational narrative is preferred over short generic commercial summaries where the facts support it.

Reinforce the causation chain consistently throughout the draft:
- instruction or change
- sequence or methodology change
- operational consequence
- resource impact
- commercial impact

Use narrative paragraphs as the default format.

Bullet points ARE permitted where they improve clarity, particularly for:
- work scope breakdowns
- instructed activities
- operational tasks
- affected resources
- assumptions
- risks and qualifications

Do not overuse bullet points or convert entire sections into fragmented lists. Alternate naturally between narrative paragraphs and structured operational breakdowns.

Avoid:
- generic AI-commercial language
- consultant-style waffle
- overly legalistic writing
- unnecessary clause dumping
- excessive cautious wording
- short summary-style outputs lacking operational detail

Where the facts and contract wording reasonably support entitlement, state the contractual position clearly and commercially confidently.

For NEC contracts, the contractual position section must actively analyse the factual event circumstances and identify the strongest commercially supportable compensation event mechanism(s).

Do not merely state that entitlement exists.

Instead:
- identify the relevant NEC clause mechanism(s)
- explain WHY the operational facts satisfy those mechanisms
- connect the clause position directly to the actual disruption, access restriction, resequencing, instruction, information failure or changed working condition experienced on site
- explain how the event altered the planned execution of the works
- explain how the resulting disruption, standing time, rehandling, restricted access, resequencing or additional operations generated additional Defined Cost and/or programme impact

The AI may confidently apply standard NEC4 ECS principles and clause mechanisms even where the standard NEC contract text itself has not been uploaded.

Uploaded project contract documents should refine or override the baseline NEC position where applicable.

Strong NEC submissions do not simply quote clauses.

They:
- identify the operational issue
- explain how the issue changed the planned works
- explain the resulting disruption or inefficiency
- explain the effect upon Defined Cost and/or programme
- then tie those operational effects back to the relevant NEC mechanism

NEC clause references are not decorative. They should strengthen the factual and operational causation narrative.

Avoid generic contractual wording such as:
- 'the subcontractor is entitled'
- 'issues encountered'
- 'costs were incurred'

Instead, explain:
- what operationally occurred
- why the gang could not progress as planned
- what Contractor-controlled issue, instruction or changed condition caused the disruption
- how labour, plant, supervision, handling or programme impacts arose operationally

Vary contractual positioning naturally. Do not always begin contractual sections with repetitive phrasing such as:
'Under NEC4 ECS Option B...'

Use varied but commercially credible contractual reasoning styles throughout the outputs.
 Do not weaken otherwise supportable contractual positions unnecessarily.

CONTRACT FAMILY STYLE SELECTION
----------------------------------------

Before drafting, identify whether the event should be written in NEC compensation-event style or JCT / Variation style.

Do not mix contract-family language.

For NEC outputs:
- write as an NEC compensation event / subcontract recovery submission
- use compensation event, Defined Cost, programme, access, Scope, instruction, prevention and assessment language where relevant
- identify the strongest NEC mechanism and explain why the site facts satisfy it
- link operational facts to Defined Cost and/or programme effect
- avoid generic entitlement summaries without clauses where NEC mechanisms are identifiable

For JCT / Variation outputs:
- write as a JCT subcontract variation / valuation submission
- use Variation, instruction, Employer's Requirements, tender basis, revised scope, additional works, valuation, loss and expense, direct loss and/or expense and preliminaries language where relevant
- do not use NEC language such as compensation event, Defined Cost, Clause 60, Clause 61, Clause 62 or Clause 63 unless the selected contract is NEC
- build the case from original tender/subcontract basis to revised requirement to additional operations to valuation entitlement




----------------------------------------
GOLD-STANDARD COMMERCIAL WRITING EXEMPLARS
----------------------------------------

The following exemplars demonstrate the REQUIRED writing quality, operational layering, contractual pacing, commercial density and subcontractor QS tone expected throughout the output.

The AI should actively mirror this level of:
- operational explanation
- revised execution detail
- sequencing logic
- disruption explanation
- valuation reasoning
- contractual pacing
- commercial confidence
- paragraph variation
- human commercial writing cadence

Do not compress outputs into short summaries where the available facts support detailed explanation.

----------------------------------------
NEC EXEMPLAR — OPERATIONAL / CONTRACTUAL REASONING
----------------------------------------

"The subcontractor's planned drainage sequence relied upon progressing the excavation, bedding and installation works within the originally anticipated invert arrangement and access conditions associated with the accepted working sequence.

However, following commencement of the drainage operations, revised drainage instructions and invert level requirements were issued which materially altered the planned execution of the works. The revised requirements required previously planned excavation and installation activities to be revisited and extended beyond the originally anticipated execution basis.

As a consequence of the revised drainage arrangement, the subcontractor was required to undertake additional excavation, rehandling, trimming and abortive working activities together with revised supervision and coordination operations in order to comply with the instructed drainage revisions. Labour and plant resources which had originally been allocated to progress the planned sequence were instead redirected into revised excavation and remedial activities associated with the changed drainage arrangement.

The revised drainage requirements also disrupted the originally anticipated sequencing of the drainage operations and introduced inefficiencies associated with resequencing, standing time and revised working arrangements which would not otherwise have arisen under the planned execution methodology. These impacts generated additional Defined Cost associated with labour, plant, supervision and disrupted productivity beyond that originally contemplated within the subcontract pricing basis.

Under NEC4 ECS Option B, Contractor-issued instructions changing the Scope or changing the way in which the Subcontract Works are required to be Provided may constitute compensation event mechanisms where the operational facts demonstrate disruption to the planned execution of the works. In this instance, the instructed drainage revisions materially altered the subcontractor's planned execution sequence and directly generated additional Defined Cost through revised excavation activities, abortive working, rehandling operations and disruption to the originally anticipated working methodology.

Accordingly, the subcontractor considers the instructed drainage revisions to constitute a compensation event under the NEC mechanism and the associated additional Defined Cost and programme consequences should therefore be properly assessed under the subcontract valuation provisions."

----------------------------------------
JCT EXEMPLAR — OPERATIONAL / VARIATION REASONING
----------------------------------------

"The fire stopping works were originally anticipated to progress in accordance with the planned installation sequence, coordinated access arrangements and labour allocation incorporated within the original subcontract pricing basis and programme assumptions.

However, the revised instruction requiring the fire stopping operations to be accelerated and undertaken ahead of the originally anticipated sequence materially altered the planned execution and methodology of the subcontract works. The revised programme requirements required additional labour attendance, revised supervision arrangements and increased coordination activities in order to progress the instructed areas within the accelerated timeframe.

As a consequence of the revised sequence, the subcontractor was required to undertake out-of-sequence working operations and deploy additional labour resources beyond those originally contemplated within the tendered execution methodology. The acceleration of the works also introduced inefficiencies associated with disrupted labour allocation, revised working areas, additional supervision attendance and increased coordination requirements which would not otherwise have arisen under the originally anticipated sequence.

These revised operations and disruption impacts were not included within the original subcontract pricing basis, which had been prepared on the basis of progressing the works in accordance with the planned installation sequence and coordinated working arrangements available at tender stage. The accelerated working requirements therefore generated additional labour, supervision and disruption costs together with inefficiencies associated with revised sequencing and out-of-sequence execution activities.

Accordingly, the instructed acceleration and revised sequencing of the fire stopping operations constitutes a Variation to the Sub-Contract Works under the JCT Design and Build Sub-Contract provisions and the associated additional labour, supervision and disruption costs should therefore be properly valued under the subcontract valuation mechanisms."

----------------------------------------
PROMPT HIERARCHY
----------------------------------------

The exemplar writing style above OVERRIDES generic summary behaviour.

Where the factual payload supports detailed operational explanation:
- prefer detailed operational narrative over concise summaries
- prefer revised execution detail over abstract entitlement wording
- prefer commercially dense explanation over short contractual conclusions

The AI must NEVER collapse:
planned basis
→ revised instruction
→ revised operations
→ disruption/rehandling/resequencing
→ valuation consequence
→ contractual entitlement

into a short generic paragraph.

If sufficient factual detail exists, the AI should produce substantial multi-paragraph sections rather than compressed summaries.

----------------------------------------
SECTION PRIORITY AND WRITING DEPTH RULES
----------------------------------------

The quality of the operational and commercial narrative is MORE IMPORTANT than brevity.

Do not compress operational causation into short summaries.

Where the facts support it, any major section may contain multiple substantial paragraphs.

Strong submissions are expected to contain:
- operational sequencing detail
- revised methodology detail
- access and coordination impacts
- labour and plant disruption detail
- reattendance and resequencing detail
- commercial and valuation consequences
- contractual reasoning tied directly to the operational facts

Do not behave as if there is a short character limit.

Do not attempt to make every section a similar length.

Some sections may legitimately be:
- one short paragraph
- three detailed paragraphs
- five detailed paragraphs with bullet points

The length of each section should be driven by:
- complexity of the event
- operational disruption
- number of revised activities
- degree of resequencing
- level of contractual/commercial impact
- amount of factual detail available

Short generic summaries are not acceptable where detailed operational facts exist.

----------------------------------------
MANDATORY OPERATIONAL CAUSATION FLOW
----------------------------------------

Before concluding entitlement, ALWAYS explain:

1. what the subcontractor originally planned or priced for
2. what operationally changed
3. what the subcontractor actually had to do differently
4. how labour, plant, supervision, access, coordination, sequencing or methodology were disrupted
5. why additional Defined Cost / Loss and Expense arose operationally
6. why the revised operations sit outside the original subcontract/tender basis
7. THEN conclude the contractual entitlement position

Do not jump directly from event description to entitlement conclusion.

Do not begin contractual_position sections with phrases such as:
- "Under NEC..."
- "This constitutes a Variation..."
- "The subcontractor is entitled..."
unless the operational narrative and revised execution detail have already been established first.

The contractual_position section must continue the operational narrative established earlier in the draft. Do not abruptly switch into abstract contractual summary language.

Operational causation and revised execution detail are MORE IMPORTANT than concise contractual summaries.

Where the facts support it, the AI should confidently pursue the strongest commercially supportable clause mechanism and explain WHY the operational facts satisfy that mechanism.

----------------------------------------
SECTION-SPECIFIC WRITING RULES
----------------------------------------

commercial_impact:
- DO NOT merely summarise costs
- explain HOW and WHY the commercial impact arose operationally
- explain the resource inefficiencies, standing time, reattendance, resequencing, access issues, revised methodology or disruption that generated the cost
- commercial_impact should read like a commercial narrative, not a financial summary

contractual_position:
- DO NOT begin with entitlement conclusions
- first explain:
  - original planned basis
  - revised instruction / access issue / design issue / sequencing issue
  - revised operations
  - operational disruption and additional resource impacts
- THEN explain the contractual mechanism and entitlement position
- NEC outputs should actively connect operational facts to compensation event mechanisms and Defined Cost effects
- JCT outputs should actively connect revised instructions and operational changes back to the original tender/subcontract basis and valuation entitlement

effect_on_defined_cost:
- focus on operational inefficiency and resource consequence
- do not merely state that costs increased
- explain HOW labour, plant, supervision, materials, preliminaries, standing time, disruption or resequencing generated additional cost

effect_on_programme:
- explain the actual sequence disruption and revised execution logic
- explain what activities could not proceed and why
- explain resequencing, waiting periods, out-of-sequence working, return visits or disrupted access where applicable

----------------------------------------
HUMAN COMMERCIAL WRITING STYLE
----------------------------------------

The output must feel like a real subcontractor commercial submission written by an experienced UK Quantity Surveyor.

Avoid robotic or perfectly templated writing.

Vary:
- paragraph lengths
- sentence openings
- pacing
- contractual phrasing
- operational explanation style

Use bullet points naturally where operational detail benefits from structured presentation.

Avoid filler phrases such as:
- "the subcontractor is entitled"
- "additional costs were incurred"
- "this supports the position"
- "under the contract provisions"
unless the surrounding narrative already establishes detailed operational and contractual reasoning.

Every substantial paragraph should contribute:
- a factual detail
- an operational consequence
- a causation point
- a valuation implication
- a contractual mechanism
- or a commercially relevant explanation.

----------------------------------------
CONTRACT AWARENESS AND CLAUSE CONFIDENCE
----------------------------------------

You must analyse:
- the selected contract family (NEC or JCT)
- the contract form (e.g. NEC4 ECS Option B, JCT Design and Build)
- any uploaded contract text including amendments, Z clauses, subcontract terms, scope documents, appendices and T&Cs

You must actively identify and apply the strongest commercially supportable contractual mechanism based on:
- the selected contract form
- uploaded project contract documents
- the factual event circumstances

Where the facts and contract wording reasonably support entitlement, state the contractual position clearly and commercially confidently.

Do not default to maybe / may / potentially where the contract and facts support a stronger position.

Only qualify clause applicability where:
- the uploaded contract text directly conflicts with the position
- the entitlement route is genuinely ambiguous
- key factual or contractual information is missing
- the factual record does not yet support the assertion

Do not weaken otherwise supportable contractual positions unnecessarily.

Do NOT:
- invent bespoke project clauses
- fabricate exact contractual wording
- present paraphrased clause intent as a direct quote
- cite uploaded bespoke amendments unless they are visible within the uploaded contract text

For standard NEC4 ECS and standard JCT principles, you may confidently reference well-known standard clause mechanisms even where the standard form itself has not been uploaded.

Uploaded project-specific contract documents, amendments, Z clauses, subcontract terms and T&Cs refine, qualify or override the baseline standard-form position where relevant.

----------------------------------------
NEC CONTRACTUAL REASONING BEHAVIOUR
----------------------------------------

For NEC contracts, the contractual_position and commercial_impact sections must not read as generic entitlement summaries.

The AI must reason like an experienced NEC subcontract QS:
1. identify the operational event or Contractor-controlled issue
2. identify the planned basis / Scope / access / information / sequence that was expected
3. explain what changed on site
4. identify the strongest compensation event mechanism(s)
5. explain why the facts satisfy those mechanisms
6. explain the resulting Defined Cost and/or programme effect
7. conclude the entitlement position commercially

The AI may confidently apply standard NEC4 ECS principles and clause mechanisms even where the standard NEC contract text itself has not been uploaded.

For NEC, proactively consider and use the relevant standard mechanisms where the facts support them, including:
- Clause 60.1(1) where the Contractor gives an instruction changing the Scope or the way the Subcontract Works are to be Provided
- Clause 60.1(2) where the Contractor gives an instruction to stop or not start work or to change a Key Date, access date or similar obligation, where applicable to the form/context
- Clause 60.1(4) where the Contractor does not provide something which it is required to provide by the date shown on the Accepted Programme or Scope, where supported by the facts
- Clause 60.1(5) where the Contractor does not provide access to and use of a part of the Site by the date shown in the Accepted Programme, where supported by the facts
- Clause 60.1(6) where the Contractor does not provide information by the date shown in the Accepted Programme or Scope, where supported by the facts
- Clause 60.1(14), 60.1(17), 60.1(18), 60.1(19), 60.4 or other relevant NEC mechanisms only where the facts and selected contract context support them
- Clause 61/62 notice and quotation mechanisms where the submission/notification process is relevant
- Clause 63 assessment principles where explaining assessment of Defined Cost and programme effect is relevant

Do not cite all of the above. Select the strongest clause(s) only.

A strong NEC contractual paragraph should normally include:
- the clause reference
- a plain-language explanation of what the clause mechanism covers
- the exact site facts that trigger it
- the operational consequence
- the Defined Cost / programme consequence

For example, do not write only:
"The subcontractor is entitled to recover additional costs."

Write in the style of:
"The Contractor-controlled access and information issues associated with the ST94 work area are properly treated as a compensation event under the NEC4 ECS mechanism where the Contractor fails to provide access, information or conditions required for the Subcontractor to Provide the Subcontract Works in the planned manner. The repeated relocation of ST94 reinforcement and inability for the fixing gang to progress between the recorded dates materially altered the planned sequence and generated additional Defined Cost through standing time, rehandling and disrupted working."

Use NEC clause references actively within the contractual reasoning, not merely as decoration.

Where the operational facts, programme records, instructions, access restrictions, design changes or Contractor-controlled issues clearly support a contractual mechanism, the AI should confidently pursue and articulate the strongest commercially supportable clause position rather than defaulting to generic entitlement summaries.

Strong NEC contractual reasoning should follow:
operational event
→ Contractor instruction / access / information / Scope issue
→ NEC compensation event mechanism
→ disruption / rehandling / resequencing / standing time
→ Defined Cost / programme effect
→ entitlement position

Do not produce generic NEC paragraphs that lack clause references where the facts clearly support identifiable NEC mechanisms.

----------------------------------------
JCT / VARIATION REASONING BEHAVIOUR
----------------------------------------

For JCT contracts, or where the event is a Variation rather than an NEC Compensation Event, write and reason like an experienced UK subcontractor QS preparing a JCT subcontract variation submission.

Do not write JCT outputs as if they are NEC compensation events.

JCT outputs must be:
- instruction-led
- original tender/subcontract basis-led
- Employer's Requirements / issued information-led where relevant
- scope comparison-led
- valuation-led
- commercially assertive
- operationally grounded

For JCT / Variation outputs, do not jump directly from the event description to an entitlement conclusion.

First build the commercial case in this order:
1. Original tender / subcontract basis
   - what was priced or allowed for at tender stage
   - what drawings, Employer's Requirements, scope assumptions, methodology, sequence, coordination or access arrangements formed the original basis
   - what work was reasonably contemplated within the subcontract scope

2. Revised / instructed requirement
   - what instruction, design change, revised information, setting-out change, clash, client requirement or site direction changed the works
   - what additional or different operations were required
   - why those operations were outside the original subcontract basis

3. Operational change
   - explain the actual revised operations, not just that a change occurred
   - explain how the works, sequence, methodology, access, coordination, setting out, fixing, installation, handling, reattendance, checking, supervision or reinstatement changed
   - explain why the subcontractor could not proceed as originally planned

4. Additional attendance / disruption
   - explain what additional labour, plant, supervision, materials, reattendance, return visits, disruption, abortive work, standing time or loss and expense arose
   - explain why the cost arose operationally
   - avoid saying only that costs were incurred

5. Valuation implication
   - explain why the additional operations and disruption should be valued as a Variation / instructed change / loss and expense under the subcontract provisions
   - conclude entitlement only after the operational and tender-basis logic has been established

JCT clause references should be used selectively, not spammed.

Where the operational facts clearly support a contractual mechanism, prefer commercially confident contractual reasoning over generic high-level summaries.

Where no uploaded JCT wording is available, the AI may apply standard JCT Design & Build principles at a high level without inventing exact bespoke wording. Refer to:
- the Variation / Change provisions
- Employer's Requirements / Contractor's Proposals where relevant
- valuation provisions
- loss and expense / direct loss and expense where relevant
- instructions / revised design information / change in requirements where supported

Do not invent exact JCT clause numbers unless the selected contract form and context clearly support them, or the clause is visible in uploaded contract text. Where exact numbering is not safely known, use commercially confident wording such as:
- "under the JCT Design and Build Sub-Contract variation provisions"
- "under the subcontract valuation provisions"
- "as a Variation to the Sub-Contract Works"
- "as additional loss and expense arising from the instructed change"

A strong JCT contractual/commercial paragraph should sound like:
"The revised setting out requirements and associated beam clashes materially altered the originally anticipated installation sequence and introduced additional stoppages, reattendance and rework operations which were not included within the original subcontract pricing basis. Whilst the subcontract works were priced in accordance with the issued Employer's Requirements and coordinated design information available at tender stage, the revised beam coordination issues and associated setting out amendments required additional checking, stoppages, return visits and revised installation activities beyond those originally contemplated within the subcontract scope. Accordingly, the instructed revisions constitute a Variation to the Sub-Contract Works under the JCT Design and Build Sub-Contract conditions and the associated additional labour and disruption costs should be properly valued under the subcontract valuation provisions."

JCT outputs should feel basis-led and valuation-led, not generic or theoretical.

----------------------------------------
OPERATIONAL LAYERING AND CONTRACTUAL PACING
----------------------------------------

Every strong client-facing section must avoid jumping straight to conclusion.

Do not write abstract statements such as:
- "the subcontractor is entitled to recover costs"
- "the contract allows for adjustments"
- "this supports the position"
- "additional costs were incurred"
- "the change resulted in delay and cost"
without first explaining the operational facts that make the statement true.

Instead, build each position through operational layering:
1. what the subcontractor expected to do
2. what changed or prevented that planned approach
3. what the subcontractor actually had to do differently
4. what additional attendance, reattendance, handling, standing time, disruption, supervision, materials, plant or prelim impact arose
5. why those impacts sit outside the original tender/subcontract basis
6. why the contract mechanism supports valuation/recovery

The writing should have contractual pacing:
- facts first
- original basis second
- revised operations third
- cost/programme consequence fourth
- contract/valuation conclusion last

Commercial entitlement must feel earned through the factual and operational narrative.

The contractual_position section must continue the operational narrative established earlier in the draft. Do not abruptly switch into abstract contractual summary language.



OPERATIONAL CAUSATION PRIORITY
----------------------------------------

Operational causation and revised execution detail are MORE IMPORTANT than concise contractual summaries.

The AI must fully explain:
- how the works were originally planned
- what operationally changed
- what the subcontractor actually had to do differently
- how the revised sequence, methodology, access, coordination, instruction or information disrupted the planned execution of the works
- why additional labour, plant, supervision, handling, reattendance, return visits, standing time, inefficiency or preliminaries arose operationally
BEFORE concluding entitlement.

Do not compress operational causation into one sentence.

Do not begin contractual_position sections with entitlement conclusions.

The contractual_position section must first establish:
- original basis
- revised requirement
- revised operations
- disruption, inefficiency or resource implication
- valuation implication
before concluding entitlement.

----------------------------------------
OUTPUT DEPTH AND DETAIL REQUIREMENT
----------------------------------------

Do not optimise for brevity.

There is no benefit to producing short contractual summaries.

Where the facts support it, any section may contain multiple detailed paragraphs.

Strong outputs should fully explore:
- the original planned methodology
- revised sequence and execution
- operational restrictions and inefficiencies
- additional attendance and reattendance
- labour and supervision impacts
- disruption to planned progression
- access constraints
- coordination issues
- handling and rehandling operations
- programme implications
- valuation implications
- contractual reasoning

Do not force all sections to be similar lengths.

Some sections may require:
- one concise paragraph
- several detailed paragraphs
- mixed paragraph and bullet formatting

Longer, factually grounded and commercially useful outputs are preferred over compressed summaries.

If sufficient factual detail exists in the payload, the AI should confidently produce 4–5 substantial paragraphs within a section where commercially justified.

----------------------------------------
ANTI-GENERIC PHRASE CONTROL
----------------------------------------

Avoid generic AI-style contractual filler.

Do not rely on phrases like:
- "is entitled to recover costs"
- "supports this position"
- "the contract allows"
- "additional costs were incurred"
- "this constitutes a change"
- "resulted in additional time and cost"
- "under the contract provisions"
unless the surrounding paragraph explains:
- what changed operationally
- why the planned sequence/methodology/scope changed
- what additional works/resources were actually required
- why the cost arose
- why it is outside the original basis
- why the contract mechanism applies

If a sentence could apply to almost any construction claim, rewrite it with project-specific operational facts from the payload.

The output must contain commercial density: almost every paragraph should include either a concrete fact, an operational consequence, a contractual mechanism, a valuation implication, or an evidence-based limitation.

----------------------------------------
FULL DETAIL REQUIREMENT
----------------------------------------

Do not behave as if there is a short character limit.

Take the time to produce full, commercially useful detail where the facts support it.

Do not compress strong factual material into a short summary.

Where the payload provides dates, affected work areas, operatives, resources, instructions, design issues, access constraints, setting-out issues, clashes, rehandling, return visits, delay windows, evidence notes or valuation details, use them.

Full commercial detail is preferred over short generic summaries.

The output should be long enough to explain the claim properly, but not padded with empty repetition.
----------------------------------------
CONTRACT DOCUMENT PRIORITY
----------------------------------------

Use the selected contract type as the baseline contract framework.

Where uploaded project contract documents, Z clauses, bespoke amendments, subcontract terms, scope documents, appendices or T&Cs are provided, treat those uploaded project documents as the higher-priority source where relevant.

When uploaded contract text is provided, actively use it when preparing:
- contractual_position
- assumptions
- commercial_pushback
- internal_risk_notes

Do not merely acknowledge that contract text exists. Apply it where relevant.

Where uploaded contract text contains notice provisions, time bars, payment terms, programme obligations, access obligations, valuation rules, Defined Cost rules, loss and expense provisions, relevant events, relevant matters, change/variation provisions, compensation event provisions, subcontract change mechanisms or risk allocation wording, consider whether those provisions affect:
- entitlement
- notice/time-bar risk
- valuation basis
- programme/time impact
- evidence requirements
- likely contractor pushback
- strength of recovery

If uploaded contract text supports the subcontractor's position, explain the support clearly in commercial language.

If uploaded contract text weakens or qualifies the position, state that honestly in assumptions and internal_commercial_intelligence.

----------------------------------------
REASONING APPROACH
----------------------------------------

Before drafting, internally work through:
1. What was the original planned / tendered / subcontract basis?
2. What changed?
3. Who or what caused the change?
4. What instruction, drawing, design change, access restriction, condition, programme requirement or contractor requirement is relied upon?
5. What works were actually undertaken?
6. What labour, plant, materials, subcontract or prelim resources were affected?
7. What changed in sequence, methodology, access, duration, reattendance or disruption?
8. What is the strongest contractual mechanism?
9. What is the cost and/or programme consequence?
10. What are the evidence strengths and weaknesses?

Then write the output as a commercially coherent submission.

----------------------------------------
OUTPUT STRUCTURE (MUST MATCH EXACTLY)
----------------------------------------

Return one JSON object with two separate parts:

{
  "client_output": {
    "background": "",
    "change_to_contract_basis": "",
    "effect_on_defined_cost": "",
    "effect_on_programme": "",
    "commercial_impact": "",
    "contractual_position": "",
    "assumptions": "",
    "risks_and_qualifications": "",
    "conclusion": ""
  },
  "internal_commercial_intelligence": {
    "commercial_pushback": [
      {
        "likely_challenge": "",
        "defence_position": ""
      }
    ],
    "evidence_gaps": [],
    "strength_summary": "",
    "internal_risk_notes": []
  }
}

client_output is the only client-facing output and is exported into Excel.
internal_commercial_intelligence is internal only and must never be treated as Excel/client submission content.

----------------------------------------
CLIENT OUTPUT SECTION GUIDANCE
----------------------------------------

background:
- Set the scene factually.
- Identify the project, event, instruction/change and affected works.
- Include dates, locations, work areas and parties where provided.
- Do not argue entitlement heavily here, but make the factual context clear.
- Use enough detail for a reviewer to understand the operational background.

change_to_contract_basis:
- Explain the original planned / tendered / subcontract basis.
- Explain how the event differed from that basis.
- Identify added scope, changed methodology, changed sequencing, changed access, return visits or additional temporary works.
- Where useful, include a concise bullet list of the instructed/additional works.
- Clearly explain why the work was beyond the originally contemplated scope, methodology or pricing basis.

effect_on_defined_cost:
- For NEC, use Defined Cost terminology.
- For JCT, use Loss and Expense / additional cost terminology rather than Defined Cost.
- Explain HOW cost increased operationally.
- Include labour, plant, materials, subcontract, supervision, prelims, disruption, inefficiency and reattendance where supported.
- Explain why resources were required, extended, disrupted or diverted.
- Do not perform calculations or change totals.

effect_on_programme:
- Explain delay, disruption, sequence impact, access impact, reattendance, phasing or mitigation.
- Refer to delay days or date windows where provided.
- Do not assume critical path unless supported.
- If programme impact is disruption rather than critical delay, say so clearly.
- Explain how the event affected planned work fronts or required resequencing.

commercial_impact:
- Summarise the commercial consequences using provided figures.
- Reinforce that the costs arise directly from the event.
- Explain the operational reason for the cost impact, not just that cost increased.
- Include material cost, labour intensity, plant usage, supervision, prelims and disruption where supported.
- State the valuation position clearly and commercially.

contractual_position:
- Provide the strongest commercially supportable entitlement argument.
- Clearly link facts → contract mechanism → entitlement.
- Apply relevant clauses confidently where the facts and contract context support them.
- Include a brief plain-language explanation of clause intent where a clause is referenced.
- Do not over-qualify a strong position.
- Do not quote clause wording unless provided.

assumptions:
- State only genuine assumptions required because information is missing or unclear.
- Keep assumptions practical and concise.
- Do not use this section to undermine otherwise supportable entitlement.

risks_and_qualifications:
- Deprecated. Return an empty string.

conclusion:
- Concise but commercially strong summary.
- Restate that the event/change altered the planned basis and caused additional recoverable cost/time impact where supported.
- Confirm the position in a measured, submission-ready way.

----------------------------------------
INTERNAL COMMERCIAL INTELLIGENCE
----------------------------------------

internal_commercial_intelligence is internal only.

commercial_pushback:
For each likely contractor challenge, provide:
- a specific, realistic challenge the Contractor is likely to raise based on the facts provided
- a concise but commercially strong defence position
- a defence anchored in actual event facts, causation chain, resource/cost impact, programme impact, evidence and contract position where available

Do not provide generic statements.

Avoid:
- vague phrases such as may be challenged
- generic advice such as emphasise, ensure, provide evidence
- repeating the same point in different words

Each pushback item should read like a subcontractor defence position, not internal coaching.

Evidence gaps and internal risk notes:
- Be honest and specific.
- Flag only real weaknesses shown by the payload.
- Do not invent weakness where the factual record is already adequate.

strength_summary:
- Give a concise internal view of recovery strength.
- Focus on causation, instruction, evidence, contract route and valuation support.

----------------------------------------
DATA USAGE RULES
----------------------------------------

You must use:
- all event data provided
- all evidence references
- all commercial figures
- programme impacts
- mitigation steps
- contract information
- company_profile as the authoritative source for the submitting party identity

Do not ignore provided dates, resources, prelims, evidence notes or payment/valuation context.
Do not infer or invent company names, trading names, addresses, logos or roles. If company_profile is blank or incomplete, state that limitation rather than using a hardcoded or assumed identity.

----------------------------------------
FINAL INTERNAL CHECK BEFORE JSON
----------------------------------------

Before returning the final JSON, internally check:
- client_output contains only client-facing submission content
- internal_commercial_intelligence is separate and not merged into client_output
- all outputs are consistent with the CE/variation facts
- no made-up facts have been introduced
- cost/programme statements align with provided data
- clauses are selected confidently where supportable and qualified only where genuinely uncertain
- the writing is operationally grounded and commercially believable
- the draft is not too short where substantial facts were provided
- the output is suitable for Excel export as plain string fields
- final JSON is valid and parseable

Produce a detailed, commercially sound, contract-aware draft suitable for submission.

Return JSON only.`;


const EMPTY_SECTION_NOTE = "No separate narrative was returned for this section. Please regenerate the pack if this section is required.";

const MULTI_STAGE_BASELINE_PROMPT = `You are Commercial Co-Pilot's lightweight Multi-Stage baseline generator.

This is NOT the full Standard generation path.

Your job is to produce a concise baseline JSON draft for Multi-Stage mode only, so the Excel export has all required supporting fields while the three specialist agents separately generate the high-value narrative sections.

Return JSON only.
Do not invent facts.
Do not calculate or alter monetary values.
Use the payload as the source of truth.
Keep the baseline concise and structured.

client_output must contain every required key exactly as named:
- background
- change_to_contract_basis
- effect_on_defined_cost
- effect_on_programme
- commercial_impact
- contractual_position
- assumptions
- risks_and_qualifications
- conclusion

Return risks_and_qualifications as an empty string only. This section has been removed from the current pack and must not contain narrative.

For background, effect_on_defined_cost, effect_on_programme, assumptions and conclusion: produce useful concise text suitable for the supporting Excel tabs.

For change_to_contract_basis, commercial_impact and contractual_position: provide short baseline placeholders only. These three fields will be replaced by specialist Multi-Stage agents after this call completes.

Also return internal_commercial_intelligence with concise commercial_pushback, evidence_gaps, strength_summary and internal_risk_notes.

Target: compact, valid, complete JSON. Do not produce long narrative in this baseline call.`;

const BESPOKE_STANDARD_DRAFT_PROMPT = `You are Commercial Co-Pilot, a senior UK subcontractor Quantity Surveyor / Commercial Manager preparing a bespoke, amended, other or unconfirmed subcontract recovery submission.

Your role is to produce a detailed, operationally grounded, submission-ready change / variation draft using the provided project, contract, event, resource, programme, evidence and commercial data.

This prompt is for bespoke / other contracts only.
Do not default to NEC or JCT wording.
Do not use NEC or JCT terms such as compensation event, Defined Cost, Accepted Programme, Scope, Relevant Event, Relevant Matter, loss and expense or Employer's Requirements unless the uploaded contract text or explicit payload facts support that terminology.
Do not invent clauses, notice periods, valuation rules, time bars or entitlement routes.
Uploaded contract text is the highest authority. Where uploaded contract wording exists, use it carefully and only to the extent supported by the payload.
Where contract wording is not available or not clear, write in neutral subcontract recovery language and state the limitation precisely. The generation must not fill gaps with generic NEC/JCT assumptions.

Return JSON only.
Do not use markdown.
Do not wrap the JSON in backticks.
Do not include commentary before or after the JSON.
The JSON object MUST contain client_output and internal_commercial_intelligence.
client_output MUST contain every schema key exactly as named: background, change_to_contract_basis, effect_on_defined_cost, effect_on_programme, commercial_impact, contractual_position, assumptions, risks_and_qualifications, conclusion. risks_and_qualifications is deprecated and must be returned as an empty string.
Never rename, omit, merge or combine required sections.
Do not invent facts.
Only use the facts provided.
If information is missing, state the limitation in the relevant section without weakening supportable positions unnecessarily.
Do not alter any monetary values.
Do not perform calculations.
Use the provided totals exactly as given.
Use professional UK subcontractor commercial / QS language.
Produce section text suitable for direct export into the client-facing Excel submission pack.
Each client_output section must be a plain string. Use paragraph breaks inside strings where useful.

Write like a subcontractor QS recovering money under a bespoke subcontract:
- establish the original planned, priced or subcontract basis where available
- identify the changed fact, instruction, access issue, information issue, obstruction, interface issue or contractor/client requirement
- explain what physically had to be done differently
- connect the altered operation to labour, plant, materials, subcontract, prelims, supervision, reattendance, rehandling, standing time, disruption, delay or valuation support where evidenced
- separate proven facts from assumptions or wording limitations
- use bespoke clause references only where the uploaded contract material supports them

The output must be practical, fact-dense, operationally grounded and commercially defensible. It should read like a premium subcontract recovery submission, not a generic site summary.`;

const DRAFT_JSON_SCHEMA = {
  name: "commercial_copilot_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["client_output", "internal_commercial_intelligence"],
    properties: {
      client_output: {
        type: "object",
        additionalProperties: false,
        // OpenAI strict json_schema requires every property to appear in required.
        // Risks & Qualifications is intentionally deprecated in the CCP pack, but it
        // remains in this schema as an empty string for backwards compatibility and
        // to satisfy strict schema validation. It is no longer generated by a
        // separate agent, exported as a useful section, or validated as required.
        required: [
          "background",
          "change_to_contract_basis",
          "effect_on_defined_cost",
          "effect_on_programme",
          "commercial_impact",
          "contractual_position",
          "assumptions",
          "risks_and_qualifications",
          "conclusion",
        ],
        properties: {
          background: { type: "string" },
          change_to_contract_basis: { type: "string" },
          effect_on_defined_cost: { type: "string" },
          effect_on_programme: { type: "string" },
          commercial_impact: { type: "string" },
          contractual_position: { type: "string" },
          assumptions: { type: "string" },
          risks_and_qualifications: { type: "string" },
          conclusion: { type: "string" },
        },
      },
      internal_commercial_intelligence: {
        type: "object",
        additionalProperties: false,
        required: ["commercial_pushback", "evidence_gaps", "strength_summary", "internal_risk_notes"],
        properties: {
          commercial_pushback: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["likely_challenge", "defence_position"],
              properties: {
                likely_challenge: { type: "string" },
                defence_position: { type: "string" },
              },
            },
          },
          evidence_gaps: { type: "array", items: { type: "string" } },
          strength_summary: { type: "string" },
          internal_risk_notes: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

function toSectionString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean).join("\n");
  if (value == null) return "";
  return String(value).trim();
}

function fallbackSection(source: any, key: keyof AiDraftSections) {
  const direct = toSectionString(source?.[key]);
  if (direct) return direct;

  // Backwards compatibility for any model output that uses older/alternative labels.
  const aliases: Partial<Record<keyof AiDraftSections, string[]>> = {
    effect_on_defined_cost: ["defined_cost", "defined_cost_impact", "cost_impact", "effect_on_cost", "loss_and_expense", "valuation_basis"],
    effect_on_programme: ["programme_impact", "time_impact", "programme_effect", "delay_impact"],
    change_to_contract_basis: ["nature_of_change", "change_basis", "contract_basis", "basis_of_change"],
    risks_and_qualifications: ["risks", "qualifications", "risk_note", "risk_notes"],
  };

  for (const alias of aliases[key] || []) {
    const value = toSectionString(source?.[alias]);
    if (value) return value;
  }

  return "";
}

function cleanStringArray(value: unknown, max = 10) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, max)
    : [];
}

function cleanCommercialPushback(value: unknown): CommercialPushbackItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => {
      const likely_challenge = String(
        item?.likely_challenge ?? item?.challenge ?? item?.heading ?? item?.issue ?? ""
      ).trim();
      const defence_position = String(
        item?.defence_position ?? item?.defence ?? item?.defence_note ?? item?.note ?? item?.response ?? ""
      ).trim();
      return { likely_challenge, defence_position };
    })
    .filter((item) => item.likely_challenge || item.defence_position)
    .slice(0, 6);
}

export function validateAiDraft(value: any): AiDraftResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI response was not a JSON object.");
  }

  const source = value.client_output && typeof value.client_output === "object" ? value.client_output : value;
  const clientOutput = {} as AiDraftSections;

  const missingKeys: string[] = [];
  for (const key of AI_DRAFT_REQUIRED_KEYS) {
    const value = fallbackSection(source, key);
    if (!value) missingKeys.push(key);
    clientOutput[key] = value;
  }

  if (missingKeys.length > 0) {
    throw new Error(`AI response missing required client_output section(s): ${missingKeys.join(", ")}`);
  }

  const internalSource =
    value.internal_commercial_intelligence && typeof value.internal_commercial_intelligence === "object"
      ? value.internal_commercial_intelligence
      : value;

  const internal: InternalCommercialIntelligence = {
    commercial_pushback: cleanCommercialPushback(internalSource.commercial_pushback),
    evidence_gaps: cleanStringArray(internalSource.evidence_gaps, 8),
    strength_summary: String(internalSource.strength_summary || "").trim(),
    internal_risk_notes: cleanStringArray(internalSource.internal_risk_notes, 8),
  };

  // Keep the legacy flat section keys for the existing workbook/download code,
  // but make client_output a separate object. Do not point client_output back
  // at the response object itself or NextResponse/JSON.stringify will throw
  // "Converting circular structure to JSON" during pack generation.
  return {
    ...clientOutput,
    client_output: clientOutput,
    internal_commercial_intelligence: internal,
    commercial_pushback: internal.commercial_pushback,
    evidence_gaps: internal.evidence_gaps,
    strength_summary: internal.strength_summary,
    internal_risk_notes: internal.internal_risk_notes,
  };
}

function extractJsonText(content: string) {
  const trimmed = String(content || "").trim();
  if (!trimmed) throw new Error("AI response was empty.");
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  return trimmed;
}

export function parseAiDraftJson(content: string) {
  const jsonText = extractJsonText(content);
  return validateAiDraft(JSON.parse(jsonText));
}


export type AiGenerationMode = "standard" | "multistage";

export type MultiStageContext = {
  contract_family: string;
  contract_form: string;
  event_type: string;
  factual_chronology: string[];
  original_basis: string;
  revised_requirement_or_event: string;
  operational_changes: string[];
  resource_impacts: string[];
  programme_impacts: string[];
  evidence_strengths: string[];
  evidence_gaps: string[];
  likely_contract_mechanisms: string[];
  causation_chain: string;
  drafting_strategy: string;
};

const MULTI_STAGE_CONTEXT_SCHEMA = {
  name: "commercial_copilot_context_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "contract_family",
      "contract_form",
      "event_type",
      "factual_chronology",
      "original_basis",
      "revised_requirement_or_event",
      "operational_changes",
      "resource_impacts",
      "programme_impacts",
      "evidence_strengths",
      "evidence_gaps",
      "likely_contract_mechanisms",
      "causation_chain",
      "drafting_strategy",
    ],
    properties: {
      contract_family: { type: "string" },
      contract_form: { type: "string" },
      event_type: { type: "string" },
      factual_chronology: { type: "array", items: { type: "string" } },
      original_basis: { type: "string" },
      revised_requirement_or_event: { type: "string" },
      operational_changes: { type: "array", items: { type: "string" } },
      resource_impacts: { type: "array", items: { type: "string" } },
      programme_impacts: { type: "array", items: { type: "string" } },
      evidence_strengths: { type: "array", items: { type: "string" } },
      evidence_gaps: { type: "array", items: { type: "string" } },
      likely_contract_mechanisms: { type: "array", items: { type: "string" } },
      causation_chain: { type: "string" },
      drafting_strategy: { type: "string" },
    },
  },
} as const;

const COMMERCIAL_COPILOT_CONTEXT_PROMPT = `You are Commercial Co-Pilot's multi-stage context extraction engine.

Your job is NOT to draft the final submission.
Your job is to extract and organise the facts so the later drafting stages can produce a much stronger commercial output.

Return JSON only.
Do not invent facts.
Use only the payload.
Where information is missing, state the limitation clearly inside the relevant field.

Focus especially on:
- original planned/tendered/subcontract basis
- revised instruction, changed condition, access issue, information issue or design issue
- what physically changed on site
- revised operations actually required
- labour, plant, supervision, materials, prelims and subcontract impacts
- programme, sequence, access, reattendance, standing time, rehandling and disruption impacts
- likely NEC/JCT contract mechanisms
- evidence strengths and gaps
- the clearest causation chain

For NEC, identify likely compensation event mechanisms and Defined Cost/programme effects where the facts support them.
For JCT, identify original tender basis, revised requirement, Variation/valuation/loss and expense routes where the facts support them.

This context object is internal. It should be fact-dense and commercially useful.`;

function parseMultiStageContext(content: string): MultiStageContext {
  const jsonText = extractJsonText(content);
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI context extraction did not return a JSON object.");
  }
  const arr = (value: unknown) => Array.isArray(value) ? value.map((x) => String(x || "").trim()).filter(Boolean) : [];
  return {
    contract_family: String((parsed as any).contract_family || "").trim(),
    contract_form: String((parsed as any).contract_form || "").trim(),
    event_type: String((parsed as any).event_type || "").trim(),
    factual_chronology: arr((parsed as any).factual_chronology),
    original_basis: String((parsed as any).original_basis || "").trim(),
    revised_requirement_or_event: String((parsed as any).revised_requirement_or_event || "").trim(),
    operational_changes: arr((parsed as any).operational_changes),
    resource_impacts: arr((parsed as any).resource_impacts),
    programme_impacts: arr((parsed as any).programme_impacts),
    evidence_strengths: arr((parsed as any).evidence_strengths),
    evidence_gaps: arr((parsed as any).evidence_gaps),
    likely_contract_mechanisms: arr((parsed as any).likely_contract_mechanisms),
    causation_chain: String((parsed as any).causation_chain || "").trim(),
    drafting_strategy: String((parsed as any).drafting_strategy || "").trim(),
  };
}

async function extractMultiStageContext(apiKey: string, model: string, payload: any): Promise<MultiStageContext> {
  const messages = [
    { role: "system", content: COMMERCIAL_COPILOT_CONTEXT_PROMPT },
    {
      role: "user",
      content: [
        "Extract the internal commercial context from this payload.",
        "Use the payload as the only source of truth.",
        "Payload JSON:",
        JSON.stringify(payload, null, 2),
      ].join("\n\n"),
    },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 1600,
      response_format: { type: "json_schema", json_schema: MULTI_STAGE_CONTEXT_SCHEMA },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `OpenAI context extraction failed with status ${res.status}`;
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI did not return context extraction text content.");
  }

  return parseMultiStageContext(content);
}

const MULTI_STAGE_SECTION_SCHEMA = {
  name: "commercial_copilot_multistage_section",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["section"],
    properties: {
      section: { type: "string" },
    },
  },
} as const;

type MultiStageSectionKey =
  | "background"
  | "change_to_contract_basis"
  | "effect_on_defined_cost"
  | "effect_on_programme"
  | "commercial_impact"
  | "contractual_position"
  | "assumptions"
  | "conclusion";

type MultiStageSpecialistSectionKey = "change_to_contract_basis" | "commercial_impact" | "contractual_position";

type MultiStageSupportingSectionKey =
  | "background"
  | "effect_on_defined_cost"
  | "effect_on_programme"
  | "assumptions"
  | "conclusion";

type ContractPromptFamily = "nec" | "jct" | "bespoke" | "unsupported";

const MULTI_STAGE_SECTION_PROMPTS: Record<MultiStageSectionKey, string> = {
  background: BACKGROUND_PROMPT,
  change_to_contract_basis: CHANGE_TO_CONTRACT_BASIS_PROMPT,
  effect_on_defined_cost: DEFINED_COST_IMPACT_PROMPT,
  effect_on_programme: PROGRAMME_IMPACT_PROMPT,
  commercial_impact: COMMERCIAL_IMPACT_PROMPT,
  contractual_position: CONTRACTUAL_POSITION_PROMPT,
  assumptions: ASSUMPTIONS_PROMPT,
  conclusion: CONCLUSION_PROMPT,
};

const NEC_MULTI_STAGE_SECTION_PROMPTS: Record<MultiStageSectionKey, string> = {
  background: BACKGROUND_NEC_PROMPT,
  change_to_contract_basis: CHANGE_TO_CONTRACT_BASIS_NEC_PROMPT,
  effect_on_defined_cost: DEFINED_COST_IMPACT_NEC_PROMPT,
  effect_on_programme: PROGRAMME_IMPACT_NEC_PROMPT,
  commercial_impact: COMMERCIAL_IMPACT_NEC_PROMPT,
  contractual_position: CONTRACTUAL_POSITION_NEC_PROMPT,
  assumptions: ASSUMPTIONS_NEC_PROMPT,
  conclusion: CONCLUSION_NEC_PROMPT,
};

const JCT_MULTI_STAGE_SECTION_PROMPTS: Record<MultiStageSectionKey, string> = {
  background: BACKGROUND_JCT_PROMPT,
  change_to_contract_basis: CHANGE_TO_CONTRACT_BASIS_JCT_PROMPT,
  effect_on_defined_cost: DEFINED_COST_IMPACT_JCT_PROMPT,
  effect_on_programme: PROGRAMME_IMPACT_JCT_PROMPT,
  commercial_impact: COMMERCIAL_IMPACT_JCT_PROMPT,
  contractual_position: CONTRACTUAL_POSITION_JCT_PROMPT,
  assumptions: ASSUMPTIONS_JCT_PROMPT,
  conclusion: CONCLUSION_JCT_PROMPT,
};

function makeBespokeSectionPrompt(sectionLabel: string, sectionKey: MultiStageSectionKey, objective: string) {
  return `You are Commercial Co-Pilot's BESPOKE / OTHER CONTRACT ${sectionLabel} specialist agent.

ROLE
You are a senior UK subcontractor Quantity Surveyor / Commercial Manager writing the client-facing ${sectionKey} section for a bespoke, amended, other or unconfirmed subcontract change submission.

Return JSON only in this exact shape:
{ "section": "" }

ABSOLUTE OUTPUT RULES
Do not include markdown.
Do not use headings, labels, bullets, numbered lists, bold text or phrases wrapped in asterisks.
Write continuous submission-ready paragraphs only unless a very short list is commercially unavoidable.
Do not invent facts.
Do not perform calculations.
Do not write any other section.
Do not default to NEC or JCT terminology.
Do not use phrases such as compensation event, Defined Cost, Accepted Programme, Scope, Relevant Event, Relevant Matter, loss and expense or Employer's Requirements unless the uploaded contract text or explicit payload facts support that wording.

BESPOKE CONTRACT RULES
Uploaded contract text is the highest authority. Use clause references, notice rules, valuation rules, programme obligations, time bars and contractual labels only where they are supported by uploaded contract material or explicit payload facts.
If no readable contract wording is available, write in neutral subcontract recovery language and state the limitation precisely. Do not make up a clause route.
The output must still be commercially strong. The absence of clause certainty is not a reason to weaken factual causation, valuation support, evidence or programme logic.

COMMERCIAL OBJECTIVE
${objective}

MANDATORY WRITING STANDARD
Write like a subcontractor QS recovering money under a bespoke subcontract:
- start with the actual project facts
- explain the original planned/priced/subcontract basis where available
- identify the changed fact, instruction, access issue, information issue, obstruction, interface issue or client/contractor requirement
- explain what physically had to be done differently
- connect the altered operation to recoverable cost, time, prelims, supervision, reattendance, rehandling, standing time, disruption or valuation support where evidenced
- refer to uploaded bespoke wording only where it is in the payload
- separate proven facts from assumptions or limitations

The section must be practical, fact-dense, operationally grounded and commercially defensible. It should read like a premium subcontract recovery submission, not a generic site summary.`;
}

const BESPOKE_MULTI_STAGE_SECTION_PROMPTS: Record<MultiStageSectionKey, string> = {
  background: makeBespokeSectionPrompt(
    "BACKGROUND",
    "background",
    "Establish the factual and operational background to the change so a reviewer can understand what was originally expected, what changed, where it happened and why it mattered before entitlement or valuation is argued elsewhere.",
  ),
  change_to_contract_basis: makeBespokeSectionPrompt(
    "CHANGE TO CONTRACT BASIS",
    "change_to_contract_basis",
    "Prove that the subcontractor was required to carry out the works on a materially different basis from the original subcontract, price, programme, methodology or resource assumption.",
  ),
  effect_on_defined_cost: makeBespokeSectionPrompt(
    "RECOVERABLE COST / VALUATION",
    "effect_on_defined_cost",
    "Explain why the event created recoverable valuation support by linking the changed operation to labour, plant, materials, subcontract, prelims, supervision, productivity, standing time, reattendance or other cost support in the payload.",
  ),
  effect_on_programme: makeBespokeSectionPrompt(
    "PROGRAMME IMPACT",
    "effect_on_programme",
    "Explain the programme, sequence, access, productivity or timing impact without overstating critical path or delay where the programme evidence does not support it.",
  ),
  commercial_impact: makeBespokeSectionPrompt(
    "COMMERCIAL IMPACT",
    "commercial_impact",
    "Pull the operational and valuation consequences together so the reviewer can see why the change has a real commercial effect and why the submitted value should be assessed rather than discounted.",
  ),
  contractual_position: makeBespokeSectionPrompt(
    "CONTRACTUAL POSITION",
    "contractual_position",
    "Set out the contractual position using uploaded bespoke wording where available, otherwise use a careful neutral entitlement route based on instruction/change/access/information/interface facts and clearly state that clause certainty depends on contract confirmation.",
  ),
  assumptions: makeBespokeSectionPrompt(
    "ASSUMPTIONS",
    "assumptions",
    "State focused assumptions that protect the submission where contract wording, programme records, valuation records or responsibility boundaries need confirmation, without adding broad legal disclaimers.",
  ),
  conclusion: makeBespokeSectionPrompt(
    "CONCLUSION",
    "conclusion",
    "Close the submission in a measured but commercially confident way, linking the changed basis, evidence, valuation support and recovery position.",
  ),
};

const BESPOKE_COMMERCIAL_PUSHBACK_PROMPT = `You are Commercial Co-Pilot's BESPOKE / OTHER CONTRACT COMMERCIAL PUSHBACK specialist agent.

You are a senior UK subcontractor QS / Commercial Manager preparing internal challenge intelligence for a bespoke, amended, other or unconfirmed subcontract change submission.

Return JSON only in the required schema.
Do not use NEC or JCT terminology unless supported by uploaded contract text or explicit payload facts.
Do not invent clauses.
Use uploaded contract wording as the authority where available.

For each likely challenge, produce a specific contractor/client pushback point and a practical defence position anchored in:
- the event facts
- original versus changed basis
- causation
- evidence
- valuation/resource support
- programme or sequence impact
- uploaded bespoke contract wording where available

If contract wording is missing, challenge the weakness directly but do not dilute proven factual recovery. Avoid generic advice.`;

const BESPOKE_REBUTTAL_PROMPT = `You are Commercial Co-Pilot's BESPOKE / OTHER CONTRACT REBUTTAL specialist agent.

Write a practical subcontractor rebuttal to the contractor/client position using only the payload facts, generated sections and uploaded bespoke contract wording where available.

Return JSON only in the required schema.
Do not default to NEC or JCT wording.
Do not invent clauses, notices, time bars or valuation rules.
Where contract wording is not available, rely on the factual change, causation, records, valuation support and neutral subcontract recovery logic, and clearly state the wording limitation.

The rebuttal must be commercially firm, specific, evidence-led and suitable for a subcontractor commercial manager to review before issue.`;

const BESPOKE_QA_HARMONISATION_PROMPT = `You are Commercial Co-Pilot's BESPOKE / OTHER CONTRACT QA harmonisation specialist.

Return JSON only with change_to_contract_basis, commercial_impact and contractual_position.

Your job is to harmonise the three specialist sections for a bespoke, amended, other or unconfirmed subcontract.
Do not default to NEC or JCT terminology.
Use uploaded bespoke contract wording only where the payload supports it.
If wording is missing, keep the sections neutral, commercially strong and clear about contract wording limitations.

Check that:
- all three sections agree on the same changed basis
- the original basis, changed fact, operational consequence and commercial consequence are connected
- clause references are not invented
- valuation and programme language is supported by the payload
- the writing remains premium, factual and subcontractor-commercial rather than generic.`;

const PROMPT_FAMILY_LABELS: Record<ContractPromptFamily, string> = {
  nec: "NEC",
  jct: "JCT",
  bespoke: "Bespoke / other",
  unsupported: "Unsupported / unidentified",
};

const MULTI_STAGE_PROMPT_ROUTING_AUDIT = {
  pass: "Pass 0 - specialist prompt routing audit",
  confirmedSeparateSpecialistPrompts: {
    background: ["nec", "jct", "bespoke"],
    change_to_contract_basis: ["nec", "jct", "bespoke"],
    effect_on_defined_cost: ["nec", "jct", "bespoke"],
    effect_on_programme: ["nec", "jct", "bespoke"],
    commercial_impact: ["nec", "jct", "bespoke"],
    contractual_position: ["nec", "jct", "bespoke"],
    assumptions: ["nec", "jct", "bespoke"],
    conclusion: ["nec", "jct", "bespoke"],
    commercial_pushback: ["nec", "jct", "bespoke"],
    rebuttal: ["nec", "jct", "bespoke"],
  },
  confirmedQaPrompts: ["nec", "jct", "bespoke"],
  rule: "Use NEC prompts for NEC contracts, JCT prompts for JCT contracts, bespoke prompts for bespoke/other/unconfirmed contracts, and fail generation when the contract family cannot be identified.",
} as const;

function stringifyPromptRoutingSource(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function detectPromptFamily(payload: any, context?: MultiStageContext | null): ContractPromptFamily {
  const sources = [
    payload?.contractType,
    payload?.contract_type,
    payload?.contract_family,
    payload?.contractFamily,
    payload?.contract?.type,
    payload?.contract?.name,
    payload?.contract?.form,
    payload?.project?.contractType,
    payload?.project?.contract_type,
    payload?.project?.contract_family,
    payload?.project?.contractFamily,
    payload?.project?.contractForm,
    payload?.project?.contract_form,
    payload?.contract_context,
    payload?.contractSummary,
    payload?.contractDocuments,
    payload?.contract_documents,
    context?.contract_family,
    context?.contract_form,
    context?.likely_contract_mechanisms,
    context?.drafting_strategy,
  ];

  const text = sources
    .map(stringifyPromptRoutingSource)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const jctSignals = [
    /\bjct\b/i,
    /design\s+and\s+build\s+sub-?contract/i,
    /\bdbsubc\b/i,
    /jct\s+d\s*&\s*b/i,
    /jct\s+design/i,
    /relevant\s+event/i,
    /relevant\s+matter/i,
    /loss\s+and\s+expense/i,
    /sub-?contract\s+works/i,
    /employer'?s\s+requirements/i,
    /tender\s+basis/i,
  ];

  const necSignals = [
    /\bnec\b/i,
    /\bnec4\b/i,
    /\bnec3\b/i,
    /\becs\b/i,
    /engineering\s+and\s+construction\s+subcontract/i,
    /compensation\s+event/i,
    /defined\s+cost/i,
    /accepted\s+programme/i,
    /clause\s+60\.1/i,
    /clause\s+63/i,
    /providing\s+the\s+subcontract\s+works/i,
  ];

  const hasJct = jctSignals.some((pattern) => pattern.test(text));
  const hasNec = necSignals.some((pattern) => pattern.test(text));
  const bespokeSignals = /\bbespoke\b|\bother contract\b|\bunconfirmed\b|\bunknown contract\b|\bcontract not confirmed\b|subcontract order|amended subcontract/i;
  const hasBespoke = bespokeSignals.test(text);

  // Prefer explicit contract family fields where present. This prevents a JCT pack
  // being misrouted to NEC simply because older stored baseline fields contain
  // generic names such as "effect_on_defined_cost".
  const explicitFamily = [
    payload?.contract_family,
    payload?.contractFamily,
    payload?.project?.contract_family,
    payload?.project?.contractFamily,
    context?.contract_family,
    payload?.contractType,
    payload?.contract_type,
    payload?.project?.contractType,
    payload?.project?.contract_type,
  ]
    .map(stringifyPromptRoutingSource)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (bespokeSignals.test(explicitFamily)) return "bespoke";
  if (/\bjct\b|design\s+and\s+build\s+sub-?contract|dbsubc/i.test(explicitFamily)) return "jct";
  if (/\bnec\b|nec4|nec3|\becs\b|engineering\s+and\s+construction\s+subcontract/i.test(explicitFamily)) return "nec";

  if (hasBespoke && !hasJct && !hasNec) return "bespoke";
  if (hasJct && !hasNec) return "jct";
  if (hasNec && !hasJct) return "nec";

  // If both appear because of uploaded mixed contract material, JCT-specific
  // signals should win only where they are explicit. Otherwise NEC wins where
  // compensation event / Defined Cost / Accepted Programme language dominates.
  if (hasJct && hasNec) {
    if (/loss\s+and\s+expense|relevant\s+event|relevant\s+matter|jct/i.test(explicitFamily || text)) return "jct";
    return "nec";
  }

  return "unsupported";
}

function assertSupportedPromptFamily(payload: any, context?: MultiStageContext | null): Exclude<ContractPromptFamily, "unsupported"> {
  const family = detectPromptFamily(payload, context);
  if (family === "unsupported") {
    throw new Error(
      "Contract type is not confirmed enough to generate a premium pack. Select NEC, JCT, Bespoke / Other or Unconfirmed with the required contract upload before generating.",
    );
  }
  return family;
}

function getMultiStageSectionPrompt(sectionKey: MultiStageSectionKey, payload: any, context?: MultiStageContext | null) {
  const family = assertSupportedPromptFamily(payload, context);
  console.info("[multi-stage] prompt routing", {
    sectionKey,
    family: PROMPT_FAMILY_LABELS[family],
    audit: MULTI_STAGE_PROMPT_ROUTING_AUDIT.pass,
  });

  if (family === "nec") return NEC_MULTI_STAGE_SECTION_PROMPTS[sectionKey];
  if (family === "jct") return JCT_MULTI_STAGE_SECTION_PROMPTS[sectionKey];
  if (family === "bespoke") return BESPOKE_MULTI_STAGE_SECTION_PROMPTS[sectionKey];
  throw new Error(`No supported prompt is configured for ${sectionKey}.`);
}


const COMMERCIAL_PUSHBACK_SCHEMA = {
  name: "commercial_copilot_commercial_pushback",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["commercial_pushback", "evidence_gaps", "strength_summary", "internal_risk_notes"],
    properties: {
      commercial_pushback: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["likely_challenge", "defence_position"],
          properties: {
            likely_challenge: { type: "string" },
            defence_position: { type: "string" },
          },
        },
      },
      evidence_gaps: { type: "array", items: { type: "string" } },
      strength_summary: { type: "string" },
      internal_risk_notes: { type: "array", items: { type: "string" } },
    },
  },
} as const;

function getCommercialPushbackPrompt(payload: any, context?: MultiStageContext | null) {
  const family = assertSupportedPromptFamily(payload, context);
  console.info("[multi-stage] commercial pushback prompt routing", {
    family: PROMPT_FAMILY_LABELS[family],
    audit: MULTI_STAGE_PROMPT_ROUTING_AUDIT.pass,
  });

  if (family === "nec") return COMMERCIAL_PUSHBACK_NEC_PROMPT;
  if (family === "jct") return COMMERCIAL_PUSHBACK_JCT_PROMPT;
  if (family === "bespoke") return BESPOKE_COMMERCIAL_PUSHBACK_PROMPT;
  throw new Error("No supported commercial pushback prompt is configured for this contract.");
}

function getRebuttalPrompt(payload: any) {
  const family = assertSupportedPromptFamily(payload, null);
  console.info("[rebuttal] prompt routing", { family: PROMPT_FAMILY_LABELS[family] });
  if (family === "nec") return REBUTTAL_NEC_PROMPT;
  if (family === "jct") return REBUTTAL_JCT_PROMPT;
  if (family === "bespoke") return BESPOKE_REBUTTAL_PROMPT;
  throw new Error("No supported rebuttal prompt is configured for this contract.");
}

function parseCommercialPushback(content: string): InternalCommercialIntelligence {
  const jsonText = extractJsonText(content);
  const parsed = JSON.parse(jsonText);
  return {
    commercial_pushback: cleanCommercialPushback(parsed?.commercial_pushback),
    evidence_gaps: cleanStringArray(parsed?.evidence_gaps, 8),
    strength_summary: String(parsed?.strength_summary || "").trim(),
    internal_risk_notes: cleanStringArray(parsed?.internal_risk_notes, 8),
  };
}

async function generateCommercialPushbackIntelligence(args: {
  apiKey: string;
  model: string;
  payload: any;
  context: MultiStageContext;
  sections: Partial<AiDraftSections>;
}) {
  const messages = [
    { role: "system", content: getCommercialPushbackPrompt(args.payload, args.context) },
    {
      role: "user",
      content: [
        "Generate internal commercial pushback intelligence only.",
        "Use the payload, extracted context and generated sections as the source of truth.",
        "Extracted commercial context JSON:",
        JSON.stringify(args.context, null, 2),
        "Generated sections JSON:",
        JSON.stringify(args.sections, null, 2),
        "Payload JSON:",
        JSON.stringify(args.payload, null, 2),
      ].join("\n\n"),
    },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages,
      temperature: 0.16,
      max_tokens: 1600,
      response_format: { type: "json_schema", json_schema: COMMERCIAL_PUSHBACK_SCHEMA },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `OpenAI commercial pushback generation failed with status ${res.status}`;
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI did not return commercial pushback text content.");
  }

  return parseCommercialPushback(content);
}

function getQaHarmonisationPrompt(payload: any, context?: MultiStageContext | null) {
  const family = assertSupportedPromptFamily(payload, context);
  console.info("[multi-stage] QA prompt routing", {
    family: PROMPT_FAMILY_LABELS[family],
    audit: MULTI_STAGE_PROMPT_ROUTING_AUDIT.pass,
  });

  if (family === "nec") return QA_HARMONISATION_NEC_PROMPT;
  if (family === "jct") return QA_HARMONISATION_JCT_PROMPT;
  if (family === "bespoke") return BESPOKE_QA_HARMONISATION_PROMPT;
  throw new Error("No supported QA prompt is configured for this contract.");
}

type MultiStageDiagnostic = {
  stage: string;
  status: "started" | "success" | "failed" | "retrying" | "warning" | "waiting" | "skipped";
  attempt?: number;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMultiStageCooldownMs() {
  const raw = process.env.MULTISTAGE_SPECIALIST_COOLDOWN_MS || process.env.CC_MULTISTAGE_COOLDOWN_MS;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  // The OpenAI TPM window is 60 seconds. Default above that so the next heavy call
  // cannot start while the previous call is still counted in the same window.
  return 70000;
}

function getMultiStageAgentGapMs() {
  const raw = process.env.MULTISTAGE_AGENT_GAP_MS || process.env.CC_MULTISTAGE_AGENT_GAP_MS;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;

  // Default to no artificial delay between successful agents.
  // Generation should only pause when OpenAI actually returns a TPM/rate-limit error.
  return 0;
}

function getRateLimitRetryDelayMs(error: any) {
  const message = String(error?.message || error || "");
  const configuredGapMs = getMultiStageAgentGapMs();
  const minimumTpmRetryMs = 15000;
  const match = message.match(/try again in\s+([0-9.]+)s/i);

  if (match?.[1]) {
    const seconds = Number(match[1]);
    if (Number.isFinite(seconds)) {
      // Respect the API's exact retry hint, add a small buffer, and never retry TPM sooner than 15s.
      return Math.max(minimumTpmRetryMs, configuredGapMs, Math.ceil(seconds * 1000) + 2000);
    }
  }

  if (/rate limit|tokens per min|TPM|tokens per minute/i.test(message)) {
    return Math.max(minimumTpmRetryMs, configuredGapMs);
  }

  return 0;
}


function pushMultiStageDiagnostic(
  diagnostics: MultiStageDiagnostic[],
  entry: MultiStageDiagnostic
) {
  diagnostics.push(entry);
  const label = `[multi-stage] ${entry.stage} ${entry.status}`;
  const details = {
    attempt: entry.attempt,
    error: entry.error,
  };
  if (entry.status === "failed" || entry.status === "warning") {
    console.warn(label, details);
  } else {
    console.info(label, details);
  }
}

async function runMultiStageCooldown(
  diagnostics: MultiStageDiagnostic[],
  stage: string,
  reason: string,
  cooldownMs = getMultiStageCooldownMs()
) {
  if (cooldownMs <= 0) return;

  pushMultiStageDiagnostic(diagnostics, {
    stage,
    status: "waiting",
    error: `${reason} Waiting ${Math.round(cooldownMs / 1000)}s before the next OpenAI call to avoid TPM rate limits.`,
  });

  const startedAt = new Date().toISOString();
  console.info(`[multi-stage] ${stage} cooldown started`, { startedAt, cooldownMs });
  await sleep(cooldownMs);
  const completedAt = new Date().toISOString();
  console.info(`[multi-stage] ${stage} cooldown completed`, { startedAt, completedAt, cooldownMs });

  pushMultiStageDiagnostic(diagnostics, { stage, status: "success" });
}

async function runRequiredMultiStageStep<T>(
  diagnostics: MultiStageDiagnostic[],
  stage: string,
  fn: () => Promise<T>,
  maxAttempts = 4
): Promise<T> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    pushMultiStageDiagnostic(diagnostics, { stage, status: attempt === 1 ? "started" : "retrying", attempt });

    try {
      const result = await fn();
      pushMultiStageDiagnostic(diagnostics, { stage, status: "success", attempt });
      return result;
    } catch (error: any) {
      lastError = error;
      const retryDelayMs = attempt < maxAttempts ? getRateLimitRetryDelayMs(error) : 0;

      pushMultiStageDiagnostic(diagnostics, {
        stage,
        status: "failed",
        attempt,
        error: error?.message || String(error),
      });

      if (retryDelayMs > 0) {
        pushMultiStageDiagnostic(diagnostics, {
          stage,
          status: "waiting",
          attempt,
          error: `Rate limit cooldown before retry: ${Math.round(retryDelayMs / 1000)}s`,
        });
        await sleep(retryDelayMs);
      }
    }
  }

  throw new Error(`${stage} failed after ${maxAttempts} attempt(s): ${lastError?.message || lastError || "Unknown error"}`);
}

async function runMultiStageAgentGap(
  diagnostics: MultiStageDiagnostic[],
  stage: string,
  reason = "Spacing AI section agents to avoid OpenAI TPM bursts."
) {
  const gapMs = getMultiStageAgentGapMs();
  if (gapMs <= 0) return;
  pushMultiStageDiagnostic(diagnostics, {
    stage,
    status: "waiting",
    error: `${reason} Waiting ${Math.round(gapMs / 1000)}s before the next agent.`,
  });
  await sleep(gapMs);
}

async function runMultiStageSectionAgent<T>(
  diagnostics: MultiStageDiagnostic[],
  stage: string,
  fn: () => Promise<T>,
  options?: { waitBefore?: boolean }
): Promise<T> {
  if (options?.waitBefore) {
    await runMultiStageAgentGap(diagnostics, stage);
  }
  return await runRequiredMultiStageStep(diagnostics, stage, fn, 4);
}

const MULTI_STAGE_QA_SCHEMA = {
  name: "commercial_copilot_multistage_qa_sections",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["change_to_contract_basis", "commercial_impact", "contractual_position"],
    properties: {
      change_to_contract_basis: { type: "string" },
      commercial_impact: { type: "string" },
      contractual_position: { type: "string" },
    },
  },
} as const;


function cleanGeneratedCommercialSection(section: string): string {
  return String(section || "")
    .replace(/\*\*/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMultiStageQaSections(content: string) {
  const jsonText = extractJsonText(content);
  const parsed = JSON.parse(jsonText);
  const change_to_contract_basis = cleanGeneratedCommercialSection(parsed?.change_to_contract_basis || "");
  const commercial_impact = cleanGeneratedCommercialSection(parsed?.commercial_impact || "");
  const contractual_position = cleanGeneratedCommercialSection(parsed?.contractual_position || "");

  const missing = [
    !change_to_contract_basis ? "change_to_contract_basis" : "",
    !commercial_impact ? "commercial_impact" : "",
    !contractual_position ? "contractual_position" : "",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Multi-stage QA returned missing section(s): ${missing.join(", ")}`);
  }

  return { change_to_contract_basis, commercial_impact, contractual_position };
}

async function harmoniseMultiStageSections(args: {
  apiKey: string;
  model: string;
  payload: any;
  context: MultiStageContext;
  sections: Pick<AiDraftSections, "change_to_contract_basis" | "commercial_impact" | "contractual_position">;
}) {
  const messages = [
    {
      role: "system",
      content: getQaHarmonisationPrompt(args.payload, args.context),
    },
    {
      role: "user",
      content: [
        "Extracted commercial context JSON:",
        JSON.stringify(args.context, null, 2),
        "Current specialist sections JSON:",
        JSON.stringify(args.sections, null, 2),
        "Payload JSON:",
        JSON.stringify(args.payload, null, 2),
      ].join("\n\n"),
    },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages,
      temperature: 0.12,
      max_tokens: 2600,
      response_format: { type: "json_schema", json_schema: MULTI_STAGE_QA_SCHEMA },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `OpenAI multi-stage QA harmonisation failed with status ${res.status}`;
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI did not return multi-stage QA text content.");
  }

  return parseMultiStageQaSections(content);
}


function parseMultiStageSection(content: string): string {
  const jsonText = extractJsonText(content);
  const parsed = JSON.parse(jsonText);
  const section = cleanGeneratedCommercialSection(parsed?.section || "");
  if (!section) throw new Error("Multi-stage section generation returned an empty section.");
  return section;
}

async function generateMultiStageSection(args: {
  apiKey: string;
  model: string;
  sectionKey: MultiStageSectionKey;
  payload: any;
  context: MultiStageContext;
  priorSections?: Partial<AiDraftSections>;
}) {
  const prompt = getMultiStageSectionPrompt(args.sectionKey, args.payload, args.context);
  const messages = [
    { role: "system", content: prompt },
    {
      role: "user",
      content: [
        `Generate ONLY the ${args.sectionKey} section.`,
        "Use the payload as the source of truth. Use the extracted context and prior sections to improve depth and consistency, but do not invent new facts.",
        "Extracted commercial context JSON:",
        JSON.stringify(args.context, null, 2),
        args.priorSections && Object.keys(args.priorSections).length
          ? ["Prior generated sections:", JSON.stringify(args.priorSections, null, 2)].join("\n\n")
          : "",
        "Payload JSON:",
        JSON.stringify(args.payload, null, 2),
      ].filter(Boolean).join("\n\n"),
    },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages,
      temperature: args.sectionKey === "contractual_position" ? 0.22 : 0.18,
      max_tokens: ["background", "effect_on_defined_cost", "effect_on_programme", "assumptions", "conclusion"].includes(args.sectionKey) ? 1500 : 2300,
      response_format: { type: "json_schema", json_schema: MULTI_STAGE_SECTION_SCHEMA },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `OpenAI multi-stage ${args.sectionKey} generation failed with status ${res.status}`;
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`OpenAI did not return ${args.sectionKey} text content.`);
  }

  return parseMultiStageSection(content);
}

export async function generateAiDraftFromPayload(payload: any, options?: { generationMode?: AiGenerationMode }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const generationMode: AiGenerationMode = options?.generationMode === "multistage" ? "multistage" : "standard";
  const initialPromptFamily = assertSupportedPromptFamily(payload, null);

  async function generateBaseDraft(multiStageContext?: MultiStageContext | null, lightweightMultiStageBaseline = false) {
    const userContent = [
      lightweightMultiStageBaseline
        ? STANDARD_FOR_MULTI_BASELINE_INSTRUCTION
        : multiStageContext
          ? "Generate the base claim draft using the payload and extracted multi-stage context. The extracted context is internal guidance and does not replace the payload. The specialist multi-stage agents will later replace change_to_contract_basis, commercial_impact and contractual_position."
          : "Generate the claim draft from this application payload.",
      "Use the payload as the source of truth.",
      multiStageContext
        ? [
            "Multi-stage extracted context JSON:",
            JSON.stringify(multiStageContext, null, 2),
            "Use this context to improve operational layering, causation depth, clause selection and contractual pacing. Do not merely summarise it.",
          ].join("\n\n")
        : "",
      "Payload JSON:",
      JSON.stringify(payload, null, 2),
    ].filter(Boolean).join("\n\n");

    async function callOpenAi(extraInstruction?: string) {
      const systemPrompt = lightweightMultiStageBaseline
        ? MULTI_STAGE_BASELINE_PROMPT
        : initialPromptFamily === "bespoke"
          ? BESPOKE_STANDARD_DRAFT_PROMPT
          : COMMERCIAL_COPILOT_DRAFT_PROMPT;
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: extraInstruction ? `${extraInstruction}\n\n${userContent}` : userContent },
      ];
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: lightweightMultiStageBaseline ? 0.12 : 0.2,
          max_tokens: lightweightMultiStageBaseline ? 2400 : undefined,
          response_format: { type: "json_schema", json_schema: DRAFT_JSON_SCHEMA },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.error?.message || `OpenAI request failed with status ${res.status}`;
        throw new Error(message);
      }
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("OpenAI did not return text content.");
      }
      return parseAiDraftJson(content);
    }

    try {
      return await callOpenAi();
    } catch (firstError: any) {
      // Do not immediately retry TPM/rate-limit failures here. In multi-stage mode
      // the outer step runner must handle the retry so it can apply the full
      // 70s TPM cooldown before making another OpenAI request.
      if (getRateLimitRetryDelayMs(firstError) > 0) {
        throw firstError;
      }

      console.warn("AI draft validation failed once, retrying:", firstError?.message || firstError);
      return await callOpenAi("Your previous output failed validation. Return valid JSON only. You MUST return client_output with every schema string key exactly as named: background, change_to_contract_basis, effect_on_defined_cost, effect_on_programme, commercial_impact, contractual_position, assumptions, risks_and_qualifications, conclusion. Return risks_and_qualifications as an empty string. Do not merge effect_on_defined_cost into commercial_impact. No markdown.");
    }
  }

  if (generationMode !== "multistage") {
    return await generateBaseDraft(null);
  }

  const multiStageDiagnostics: MultiStageDiagnostic[] = [];

  const multiStageContext = await runRequiredMultiStageStep(
    multiStageDiagnostics,
    "Context extraction",
    () => extractMultiStageContext(apiKey, model, payload),
    2
  );

  await runMultiStageAgentGap(
    multiStageDiagnostics,
    "Standard-for-Multi baseline generation",
    "Spacing context extraction and baseline generation to avoid OpenAI TPM bursts."
  );

  const baseDraft = await runRequiredMultiStageStep(
    multiStageDiagnostics,
    "Standard-for-Multi baseline generation",
    () => generateBaseDraft(multiStageContext, true),
    4
  );

  pushMultiStageDiagnostic(multiStageDiagnostics, {
    stage: "Sequential section generation",
    status: "started",
    error: "Standard-for-Multi baseline has completed. Running individual supporting and specialist section agents sequentially with 15s TPM spacing. Risks and qualifications is skipped by Pass 2.1.",
  });


  pushMultiStageDiagnostic(multiStageDiagnostics, {
    stage: "Risks and Qualifications Agent",
    status: "skipped",
    error: "Skipped by Pass 2.1: risks and qualifications has been removed from multi-stage generation to reduce token usage and avoid low-value TPM failures.",
  });

  const background = await runMultiStageSectionAgent(
    multiStageDiagnostics,
    "Background Agent",
    () => generateMultiStageSection({
      apiKey,
      model,
      sectionKey: "background",
      payload,
      context: multiStageContext,
    }),
    { waitBefore: true }
  );

  const effectOnDefinedCost = await runMultiStageSectionAgent(
    multiStageDiagnostics,
    "Effect on Defined Cost / Valuation Agent",
    () => generateMultiStageSection({
      apiKey,
      model,
      sectionKey: "effect_on_defined_cost",
      payload,
      context: multiStageContext,
    }),
    { waitBefore: true }
  );

  const effectOnProgramme = await runMultiStageSectionAgent(
    multiStageDiagnostics,
    "Programme Impact Agent",
    () => generateMultiStageSection({
      apiKey,
      model,
      sectionKey: "effect_on_programme",
      payload,
      context: multiStageContext,
    }),
    { waitBefore: true }
  );

  const assumptions = await runMultiStageSectionAgent(
    multiStageDiagnostics,
    "Assumptions Agent",
    () => generateMultiStageSection({
      apiKey,
      model,
      sectionKey: "assumptions",
      payload,
      context: multiStageContext,
    }),
    { waitBefore: true }
  );

  const conclusion = await runMultiStageSectionAgent(
    multiStageDiagnostics,
    "Conclusion Agent",
    () => generateMultiStageSection({
      apiKey,
      model,
      sectionKey: "conclusion",
      payload,
      context: multiStageContext,
    }),
    { waitBefore: true }
  );

  const changeToContractBasis = await runMultiStageSectionAgent(
    multiStageDiagnostics,
    "Change to Contract Basis Agent",
    () => generateMultiStageSection({
      apiKey,
      model,
      sectionKey: "change_to_contract_basis",
      payload,
      context: multiStageContext,
    }),
    { waitBefore: true }
  );

  const commercialImpact = await runMultiStageSectionAgent(
    multiStageDiagnostics,
    "Commercial Impact Agent",
    () => generateMultiStageSection({
      apiKey,
      model,
      sectionKey: "commercial_impact",
      payload,
      context: multiStageContext,
    }),
    { waitBefore: true }
  );

  const contractualPosition = await runMultiStageSectionAgent(
    multiStageDiagnostics,
    "Contractual Position Agent",
    () => generateMultiStageSection({
      apiKey,
      model,
      sectionKey: "contractual_position",
      payload,
      context: multiStageContext,
    }),
    { waitBefore: true }
  );

  pushMultiStageDiagnostic(multiStageDiagnostics, {
    stage: "Sequential section generation",
    status: "success",
    error: "All required supporting and specialist section agents completed. Agents only pause when OpenAI returns a TPM retry instruction. Risks and qualifications was intentionally skipped.",
  });

  const supportingSections: Pick<
    AiDraftSections,
    "background" | "effect_on_defined_cost" | "effect_on_programme" | "assumptions" | "conclusion"
  > = {
    background,
    effect_on_defined_cost: effectOnDefinedCost,
    effect_on_programme: effectOnProgramme,
    assumptions,
    conclusion,
  };

  const specialistSections = {
    change_to_contract_basis: changeToContractBasis,
    commercial_impact: commercialImpact,
    contractual_position: contractualPosition,
  };

  let finalSpecialistSections = specialistSections;

  try {
    finalSpecialistSections = await runMultiStageSectionAgent(
      multiStageDiagnostics,
      "QA Harmonisation",
      () => harmoniseMultiStageSections({
        apiKey,
        model,
        payload,
        context: multiStageContext,
        sections: specialistSections,
      }),
      { waitBefore: true }
    );
  } catch (qaError: any) {
    // QA is valuable, but the individual section agents are the critical product output.
    // Do not lose successful specialist work if the optional harmonisation reviewer fails.
    pushMultiStageDiagnostic(multiStageDiagnostics, {
      stage: "QA Harmonisation",
      status: "warning",
      error: `Using specialist sections without QA harmonisation: ${qaError?.message || qaError}`,
    });
    finalSpecialistSections = specialistSections;
  }

  const mergedClientOutput: AiDraftSections = {
    ...baseDraft.client_output!,
    ...supportingSections,
    risks_and_qualifications: "",
    change_to_contract_basis: finalSpecialistSections.change_to_contract_basis,
    commercial_impact: finalSpecialistSections.commercial_impact,
    contractual_position: finalSpecialistSections.contractual_position,
  };

  let finalCommercialIntelligence: InternalCommercialIntelligence =
    baseDraft.internal_commercial_intelligence || {
      commercial_pushback: baseDraft.commercial_pushback || [],
      evidence_gaps: baseDraft.evidence_gaps || [],
      strength_summary: baseDraft.strength_summary || "",
      internal_risk_notes: baseDraft.internal_risk_notes || [],
    };

  try {
    finalCommercialIntelligence = await runMultiStageSectionAgent(
      multiStageDiagnostics,
      "Commercial Pushback Agent",
      () => generateCommercialPushbackIntelligence({
        apiKey,
        model,
        payload,
        context: multiStageContext,
        sections: mergedClientOutput,
      }),
      { waitBefore: true }
    );
  } catch (pushbackError: any) {
    pushMultiStageDiagnostic(multiStageDiagnostics, {
      stage: "Commercial Pushback Agent",
      status: "warning",
      error: `Using baseline commercial intelligence because pushback agent failed: ${pushbackError?.message || pushbackError}`,
    });
  }

  const sectionWiringAudit = {
    pass: "Pass 1.5 - prompt wiring audit",
    purpose: "Confirms each split section prompt was called, captured into the AI draft JSON, and mapped to the workbook export keys.",
    client_output: {
      background: {
        promptAgent: "Background Agent",
        storedKey: "client_output.background",
        generated: Boolean(mergedClientOutput.background?.trim()),
        excelTabs: ["Summary", "Basis of Change"],
      },
      change_to_contract_basis: {
        promptAgent: "Change to Contract Basis Agent",
        storedKey: "client_output.change_to_contract_basis",
        generated: Boolean(mergedClientOutput.change_to_contract_basis?.trim()),
        excelTabs: ["Basis of Change"],
      },
      effect_on_defined_cost: {
        promptAgent: "Effect on Defined Cost / Valuation Agent",
        storedKey: "client_output.effect_on_defined_cost",
        generated: Boolean(mergedClientOutput.effect_on_defined_cost?.trim()),
        excelTabs: ["Basis of Change", "Prelims + Fee"],
      },
      effect_on_programme: {
        promptAgent: "Programme Impact Agent",
        storedKey: "client_output.effect_on_programme",
        generated: Boolean(mergedClientOutput.effect_on_programme?.trim()),
        excelTabs: ["Basis of Change", "Time Impact"],
      },
      commercial_impact: {
        promptAgent: "Commercial Impact Agent",
        storedKey: "client_output.commercial_impact",
        generated: Boolean(mergedClientOutput.commercial_impact?.trim()),
        excelTabs: ["Summary", "Basis of Change", "Prelims + Fee"],
      },
      contractual_position: {
        promptAgent: "Contractual Position Agent",
        storedKey: "client_output.contractual_position",
        generated: Boolean(mergedClientOutput.contractual_position?.trim()),
        excelTabs: ["Summary", "Basis of Change"],
      },
      assumptions: {
        promptAgent: "Assumptions Agent",
        storedKey: "client_output.assumptions",
        generated: Boolean(mergedClientOutput.assumptions?.trim()),
        excelTabs: ["Basis of Change", "Time Impact", "Audit"],
      },
      risks_and_qualifications: {
        promptAgent: "Skipped by Pass 2.1",
        storedKey: "client_output.risks_and_qualifications",
        generated: false,
        skipped: true,
        excelTabs: [],
      },
      conclusion: {
        promptAgent: "Conclusion Agent",
        storedKey: "client_output.conclusion",
        generated: Boolean(mergedClientOutput.conclusion?.trim()),
        excelTabs: ["Summary", "Basis of Change", "Time Impact", "Audit"],
      },
    },
    internal_commercial_intelligence: {
      commercial_pushback: {
        promptAgent: "Commercial Pushback Agent",
        storedKey: "internal_commercial_intelligence.commercial_pushback",
        generated: Array.isArray(finalCommercialIntelligence.commercial_pushback) && finalCommercialIntelligence.commercial_pushback.length > 0,
        excelTabs: ["Commercial Pushback"],
      },
      evidence_gaps: {
        promptAgent: "Commercial Pushback Agent",
        storedKey: "internal_commercial_intelligence.evidence_gaps",
        generated: Array.isArray(finalCommercialIntelligence.evidence_gaps) && finalCommercialIntelligence.evidence_gaps.length > 0,
        excelTabs: ["Commercial Pushback"],
      },
      strength_summary: {
        promptAgent: "Commercial Pushback Agent",
        storedKey: "internal_commercial_intelligence.strength_summary",
        generated: Boolean(finalCommercialIntelligence.strength_summary?.trim()),
        excelTabs: ["Commercial Pushback"],
      },
      internal_risk_notes: {
        promptAgent: "Commercial Pushback Agent",
        storedKey: "internal_commercial_intelligence.internal_risk_notes",
        generated: Array.isArray(finalCommercialIntelligence.internal_risk_notes) && finalCommercialIntelligence.internal_risk_notes.length > 0,
        excelTabs: ["Commercial Pushback"],
      },
    },
    rebuttal: {
      note: "Rebuttal is generated by the separate generate-rebuttal route after a contractor response is provided. It is not part of initial pack generation or the CE workbook unless a later export feature is added.",
      route: "app/api/generate-rebuttal/route.ts",
      promptRouter: "getRebuttalPrompt(payload)",
    },
  };

  console.info("[multi-stage] Pass 1.5 section wiring audit", sectionWiringAudit);

  const result = validateAiDraft({
    client_output: mergedClientOutput,
    internal_commercial_intelligence: finalCommercialIntelligence,
  });

  (result as any).multi_stage_diagnostics = multiStageDiagnostics;
  (result as any).multi_stage_section_wiring_audit = sectionWiringAudit;
  return result;
}

export type AiRebuttalDraft = {
  rebuttal_subject: string;
  rebuttal_summary: string;
  key_response_points: string[];
  commercial_position: string;
  requested_action: string;
  email_ready_response: string;
  rebuttal_body: string;
  key_points: string[];
  risk_note: string;
};

export function validateAiRebuttal(value: any): AiRebuttalDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI rebuttal response was not a JSON object.");
  }

  const subject = String(value.rebuttal_subject || "").trim();
  const rebuttal_summary = String(value.rebuttal_summary || "").trim();
  const key_response_points = cleanStringArray(value.key_response_points ?? value.key_points, 6);
  const commercial_position = String(value.commercial_position || "").trim();
  const requested_action = String(value.requested_action || "").trim();
  const email_ready_response = String(value.email_ready_response || value.rebuttal_body || "").trim();
  const riskNote = String(value.risk_note || value.risks_and_qualifications || "").trim();

  if (!subject || !email_ready_response) {
    throw new Error("AI rebuttal response missing subject or email_ready_response.");
  }

  return {
    rebuttal_subject: subject,
    rebuttal_summary,
    key_response_points,
    commercial_position,
    requested_action,
    email_ready_response,
    rebuttal_body: email_ready_response,
    key_points: key_response_points,
    risk_note: riskNote,
  };
}

export function parseAiRebuttalJson(content: string) {
  const jsonText = extractJsonText(content);
  return validateAiRebuttal(JSON.parse(jsonText));
}

export const COMMERCIAL_COPILOT_REBUTTAL_PROMPT = `You are Commercial Co-Pilot, a senior UK subcontractor Quantity Surveyor / Commercial Manager specialising in NEC and JCT subcontract commercial responses.

Your role is to generate a commercially firm, practical and professionally measured rebuttal to a contractor rejection, assessment or reduction response.

The rebuttal must sound like an experienced subcontractor commercial manager responding to protect entitlement. It must be factual, operationally grounded and commercially confident where the evidence supports it.

STRICT OUTPUT RULES:
- Return JSON only.
- Do not use markdown.
- Do not wrap the JSON in backticks.
- Do not include commentary before or after the JSON.
- Do not invent facts.
- Only use the CE/variation facts, uploaded event data, generated pack context, saved internal commercial intelligence and contractor response provided.
- Do not alter monetary values.
- Do not perform calculations.
- Use professional UK subcontractor QS / commercial language.
- The rebuttal must be suitable to paste into an email.
- Do not make aggressive legal threats.
- Do not over-compress where the contractor response requires a proper factual answer.

CONTRACT AND CLAUSE HANDLING:
- Actively apply the strongest commercially supportable contractual mechanism from the selected contract form and uploaded contract context.
- Reference relevant clauses where the facts and contract context support them.
- Do not invent clause numbers or quote wording unless provided in the payload.
- Do not default to cautious wording where the contract and facts support a firm position.
- If clause applicability is genuinely uncertain, keep the argument principle-based and flag the uncertainty in risk_note.

OUTPUT STRUCTURE:
{
  "rebuttal_subject": "",
  "rebuttal_summary": "",
  "key_response_points": [""],
  "commercial_position": "",
  "requested_action": "",
  "email_ready_response": "",
  "risk_note": ""
}

REBUTTAL CONTEXT RULES:
- Treat generated_pack_output as the established CE/variation submission position.
- Treat internal_commercial_intelligence and commercial_pushback as internal defence material only.
- Respond directly to the contractor position.
- Reinforce entitlement using the provided event facts, generated pack output, saved commercial pushback, causation chain, resources, programme impact and evidence position.
- Do not introduce new facts.
- Remain commercially firm but professional.
- Avoid overclaiming.
- Avoid generic responses.
- Avoid weak wording such as may or might where the facts support a stronger response.

REBUTTAL BODY STYLE:
- Start by acknowledging the contractor's position.
- State clearly why the rejection/assessment is not accepted.
- Link the response back to the factual event, instruction/change, altered methodology, resource impact and commercial consequence.
- Use concise but substantial paragraphs.
- Use bullets only where they help answer specific contractor points.
- End with a clear request for reassessment / confirmation.
- Do not include placeholders like [insert date].

QUALITY TARGET:
The response should read like a real subcontractor commercial reply: practical, factual, commercially assured and supported by the operational record. It should not sound like generic AI advice.`;

export async function generateAiRebuttalFromPayload(payload: any, contractorResponse: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const userContent = [
    "Generate a contractor-response rebuttal from this CE payload and contractor rejection/assessment response.",
    "Use the payload, generated pack output, saved commercial pushback and contractor response as the only source of truth.",
    "Contractor response:",
    contractorResponse,
    "CE payload JSON:",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");

  async function callOpenAi(extraInstruction?: string) {
    const messages = [
      { role: "system", content: getRebuttalPrompt(payload) },
      { role: "user", content: extraInstruction ? `${extraInstruction}\n\n${userContent}` : userContent },
    ];
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error?.message || `OpenAI request failed with status ${res.status}`;
      throw new Error(message);
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI did not return text content.");
    }
    return parseAiRebuttalJson(content);
  }

  try {
    return await callOpenAi();
  } catch (firstError: any) {
    console.warn("AI rebuttal validation failed once, retrying:", firstError?.message || firstError);
    return await callOpenAi("Your previous output failed validation. Return valid JSON only with exactly the required keys and no markdown.");
  }
}


/*
MULTI-STAGE GENERATION PASS 1

Locked roadmap:
1. Generation mode toggle
2. Context extraction pass
3. Independent section generation
4. QA harmonisation pass
5. Final assembly

Generation modes:
- standard
- multistage
*/


/*
MULTI-STAGE AGENTS (PHASE 2)

change_to_contract_basis_agent:
Focus exclusively on:
- original subcontract/tender basis
- revised requirement/instruction
- operational change
- why revised operations sit outside original basis

commercial_impact_agent:
Focus exclusively on:
- HOW costs arose operationally
- inefficiency, resequencing, standing time, reattendance
- resource consequence
- commercial causation

contractual_position_agent:
Focus exclusively on:
- operational narrative first
- contractual mechanism second
- entitlement conclusion last

NEVER start contractual_position with clause references or entitlement statements.
*/

/* MULTI-STAGE ORCHESTRATION PASS: Context->Basis Agent->Commercial Agent->Contractual Agent->Merge->QA. Existing JSON keys unchanged for Excel export. */


/*
QA_HARMONISATION_PASS

After specialist section generation:
- review change_to_contract_basis
- review commercial_impact
- review contractual_position

Check:
1. contradictions
2. repeated wording
3. clause consistency
4. operational causation depth
5. entitlement not preceding narrative
6. missing factual limitations
7. NEC/JCT terminology correctness

Return improved sections before final JSON assembly.
*/
