# MASTER HANDOVER — COMMERCIAL CO-PILOT

## Product
Premium SaaS for subcontractor QS teams to build clause-aware, commercially robust Compensation Event / variation packs.

The platform should feel calm, structured, premium, minimal and professional.
Reference feel: Stripe / Linear / Notion style SaaS.

## Core workflow
1. Basis of Change
2. Evidence
3. Resources
4. Prelims + Fee
5. Review

The workflow should feel guided and linear, not like disconnected pages.

## What the product does
- helps subcontractors recover value they are entitled to
- structures cause → effect → entitlement clearly
- keeps cost build-up deterministic
- highlights weak areas before submission
- produces professional pack outputs

AI supports:
- narrative structure
- clause-aware wording
- time impact wording
- evidence guidance
- commercial pushback / rebuttal support

AI must not do cost maths.
All maths stays deterministic.

## Pack output strategy
Keep outputs to a maximum of 1–3 files.
Preferred output:
1. Word document containing:
   - Basis of Change
   - entitlement reasoning
   - time impact narrative
   - qualifications / risk notes
   - commercial pushback / rebuttal section when selected
2. Excel workbook containing:
   - deterministic cost build-up
   - labour / plant / material / prelims / fee
3. optional cover email text

The product is not trying to create lots of documents.
It should create one coherent commercially strong pack.

## Contract logic
Current contract selection direction:
- NEC4 ECS Option A
- NEC4 ECS Option B
- NEC4 ECC Option A
- NEC4 ECC Option B

Future:
- broader contract families
- uploaded bespoke contracts
- Z clause review / contract review AI

## Tech stack
- Next.js App Router
- TypeScript
- Supabase
- Tailwind available but much of the UI uses inline styles

Main app routes:
- /app
- /app/new
- /app/event/[id]
- /app/event/[id]/evidence
- /app/event/[id]/resources
- /app/event/[id]/prelims
- /app/event/[id]/review
- /app/settings
- /app/rates

Public pages:
- /
- /pricing
- /terms
- /privacy
- /disclaimer
- /contact

## Design rules
Visual system:
- white cards
- light grey borders
- dark typography
- minimal shadows
- rounded corners
- no gradients
- no loud colours
- calm premium spacing

Avoid:
- clutter
- gimmicky AI visuals
- duplicate controls
- oversized marketing-style typography inside app pages

## App layout pattern
Workflow pages use:
- main content column left
- support column right

Right column typically contains:
- CEProgress component
- guidance card
- quality / summary / next step cards depending on page

## CEProgress
Use existing CEProgress component.
Do not change prop structure.

## Current important UI decisions
- input typography should stay consistent across pages
- labels small / medium weight
- input text regular weight, not bold
- resources, basis, evidence, prelims and review should feel part of one system
- sidebar collapsed state should stay minimal

## Current features already added
- premium marketing pages and pricing page refresh
- account menu top right with plan / credits / settings / sign out
- settings page scaffold
- dashboard title card tightened up
- resources page aligned with workflow header style
- resources row details toggle restored
- review page can include commercial pushback toggle in pack selection
- sidebar smoother open / close interaction

## Working method (important)
User does not code.
User uploads src zip.
Assistant edits files directly.
Assistant returns full updated src zip.
Do not give partial snippets unless specifically asked.
Preserve existing logic, autosave behaviour, routing and working structure.
Avoid unnecessary refactors.

## Current focus / next steps
1. unify save-state pill styling across all workflow pages where needed
2. refine Review page pack configuration and wording polish
3. wire settings page to real persisted account settings instead of placeholders
4. prepare Stripe billing + credit tracking
5. implement pack generation spine
   - selected outputs from Review page
   - pushback section included when toggled
   - Word / Excel generation path
6. prepare profile/account area for real plan + credit data
7. continue tightening dashboard and app-wide consistency

## MVP ready standard
The MVP is ready for early paid users when:
- workflow feels coherent
- outputs look professional
- deterministic totals reconcile properly
- pushback section is useful
- UI consistency feels premium
- billing and credits are wired
- pack generation works reliably

## Product goal
Build the best tool available for subcontractors to prepare Compensation Events, structure entitlement clearly, recover value confidently and reduce commercial friction.
