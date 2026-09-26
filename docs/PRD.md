# Tenjō (天井) — Product Requirements Document

Version 1.2 · September 27, 2026 · Product owner: Chai · Status: draft for review

**One person, one entry, and every loss counts.**

This PRD describes Tenjō from the current repository, including the in-progress walkthrough and organiser improvements. It separates implemented behavior from integration gates and future scope. Product outcomes and measurement proposals are hypotheses, not observed results. The [original September 25 PRD](PRD-ORIGINAL.md) is preserved; R1–R15 retain their original meaning. This revision adds R16 for the explanatory walkthrough.

## 1. Product summary

Tenjō is a free lottery for scarce product drops. Fans enter once using a verified identity. Each unsuccessful entry earns an additional ticket in the next drop of the same series, up to six tickets total. A win resets that series’ loss count. Anyone can inspect anonymous entries, ticket weights, results and loss history.

The core product combines three capabilities:

- **Verified participation:** World ID is intended to enforce one eligible identity per drop without Tenjō collecting contact details.
- **Recognition of repeat participation:** losses increase a fan’s future entry weight within the same series.
- **Visible allocation:** a public record explains which weights entered the draw, who won and how loss counts changed.

Phase 1 uses a server draw and database ledger. Phase 2 proposes Sui randomness and an on-chain ledger. The current product requires trust in the server and database operator; a public record alone does not establish independent fairness.

## 2. Problem and product hypothesis

Fans repeatedly miss scarce drops without their previous participation affecting the next attempt. Organisers need a way to discourage duplicate entries and explain allocation decisions. Observers need enough information to inspect outcomes without seeing names or contact details.

**Hypothesis:** a clear, capped benefit for previous losses, combined with identity verification and a public record, will make repeat participation feel more worthwhile and allocation easier to understand.

The mechanism intentionally gives different weights to people with different loss histories. It does not promise equal odds, eventual victory, resale prevention or universal person-level uniqueness beyond the selected identity credential’s guarantees.

## 3. Users and jobs to be done

| User                     | Need                                                | Successful experience                                                                  |
| ------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| First-time fan           | Understand the rules and enter an eligible drop     | Sees the item, deadline and ticket rule; verifies; receives an anonymous receipt       |
| Returning fan            | Carry forward losses and understand the next chance | Uses the same identity; receives the correct series weight; inspects previous outcomes |
| Winning fan              | Claim an allocation securely                        | Completes a fresh identity check; collects once; sees confirmation                     |
| Organiser                | Allocate a limited quantity                         | Sets item details, quantity, series and JST schedule; obtains a settled public result  |
| Public observer or judge | Check the mechanism and evidence                    | Reviews entries, weights, ordered winners and loss changes without signing in          |

Initial context is a small, English-language hackathon demonstration of Japanese-style scarce drops. Broader demand, organiser adoption and retention remain unvalidated.

## 4. Goals, scope and current status

### Goals

1. Demonstrate the full loop: create → enter → draw → update loss counts → collect → enter the next drop.
2. Prevent duplicate entry and repeat collection for the same verified identity, including concurrent requests.
3. Make the ticket formula and each participant’s result understandable and inspectable.
4. Preserve minimal identity data and disclose the public linkability of anonymous codes.
5. Validate real World verification before describing the integrated flow as complete.

### Delivery scope

| Scope                   | Included                                                                                                         | Status based on repository evidence                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Phase 1 core            | Discovery, organiser creation, entries, weighted draw, settlement, pickup checks, public records and code lookup | Implemented with local test identities and automated test coverage                            |
| First-visit explanation | Browser-only walkthrough of loss, win, duplicate refusal and pickup                                              | Present in current working tree; scripted, ephemeral and separate from real entries           |
| World integration       | Signed requests, server verification, stable codes and replay protection                                         | Live on production: 14 server-verified entries on 26 September, simulator and real World IDs  |
| Production pickup       | Fresh winning identity plus server-attested liveness                                                             | Blocked pending liveness validation and implementation of a supported enforcement path        |
| Hosting                 | Vercel application with hosted Postgres                                                                          | Deployed at tenjo-azure.vercel.app with Neon Postgres                                         |
| Phase 2                 | Sui registration, randomness, ledger, settlement and explorer evidence                                           | Published on Sui testnet (`0x0d0f…3a65`); free and paid drops smoke-tested end to end         |
| Real-World-ID pity      | A passkey carries a real World ID's losses across drops                                                          | Implemented and tested; not yet tried with a real phone passkey                               |
| Deposits (R13)          | Testnet deposits into a per-drop escrow, refunded to losers at settlement                                        | Promoted for the Sui DeFi & Payments track: in the Move package and wallet flow; testnet-only |
| Stretch                 | Unclaimed-item handoff                                                                                           | Planned only after both phase gates pass                                                      |

### Non-goals for the MVP

Real-money entry, mainnet payments, organiser billing, native mobile apps, commerce/ticketing integrations, shipping or physical fulfilment management, names/contact profiles, simultaneous credential tiers, guaranteed wins and large-scale drops are excluded. Pickup records a claim; it does not itself prove physical delivery. Japanese localisation is outside the current English build.

## 5. Core product rules

### Entries and tickets

- A **series** groups related drops from a shop, artist or product line. A **drop** is one allocation event in that series.
- One verified code may enter a drop once. Extra tickets increase that single entry’s weight; they are not extra entries.
- `tickets = 1 + min(5, losses in this series since the last win)`.
- The ticket cap is six. The stored loss count may continue above five.
- A first-time participant receives one ticket. Three prior losses give four tickets. Losses in another series have no effect.
- Weights are captured at entry. Only draw settlement changes loss counts; ordinary admins cannot manually edit them.
- A series may have only one unsettled drop. The next drop cannot be created until its predecessor settles.
- The current limit is 300 entrants per drop and 1–300 available items.

### Draw and settlement

- Entry is accepted at or after opening time and strictly before closing time, using the server/database clock.
- After closing, any same-origin caller may trigger the draw; the UI requires confirmation because the result is final.
- Select `min(items, entrants)` distinct winners using weighted sampling without replacement. A winner’s entire weight leaves the pool.
- For weights 1, 3 and 6, first-pick probabilities are 10%, 30% and 60%. Later picks use the remaining pool. These are not the final probabilities of winning at least one item in a multi-item draw.
- Every losing entrant gains one loss; each winner resets to zero even if the item is never collected. Nonparticipants’ counts do not change.
- The Phase 1 draw and settlement commit atomically. Repeated or concurrent draw requests return the existing result and never reroll.
- If entrants are fewer than items, all entrants win once and the remainder is recorded as unallocated. An empty drop settles with zero winners.

### Identity and pickup

- A stable 32-character anonymous code represents an identity across drops; loss counts remain series-specific.
- A real World ID gets a fresh code in every drop, because World ID 4 nullifiers are single-use per action. With a passkey, its entries use the passkey's code, so losses carry; World ID still admits one entry per person per drop.
- Entry and pickup require separately issued, fresh challenges bound to purpose and drop. The code itself is a public lookup key, not a credential for claiming an item.
- Only a settled drop’s winner may collect, once. A failed or wrong-identity attempt leaves the item uncollected.
- The selected credential and identity configuration are pinned after the first accepted real entry. Changes require an explicit migration or a fresh database.
- Document credential compatibility, repeat proofs and the original dual-document uniqueness concern remain validation questions. Orb is the planned fallback and must be selected before accepting real entries.

## 6. User journeys and screens

| Journey          | Screens and behavior                                                                                                                                       | Completion                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Discover         | `/` shows available drops, quantities and schedules, with the walkthrough inline. Empty state explains availability.                                       | Fan opens a drop or starts the explanation               |
| Learn            | `/#how` (`/demo` redirects) takes Fan A through four tickets, a loss, five tickets, a win and pickup; includes duplicate and wrong-identity refusals.      | Fan understands the rule and can restart or enter a drop |
| Enter            | `/drops/[id]` explains item, series, entry window, ticket rule and verification availability; successful server commit displays a code and ticket receipt. | One durable entry exists                                 |
| Check history    | `/results` accepts a full code; `/codes/[code]` shows entries, results and per-series loss counts.                                                         | Fan can explain their current count and next weight      |
| Draw and inspect | Drop page confirms finality before drawing; `/results` and drop records expose entries, weights and results.                                               | One settled draw and matching public history exist       |
| Collect          | Winning fan starts a fresh identity check on the drop page.                                                                                                | One pickup is saved and confirmed                        |
| Organise         | `/admin` collects title, description, quantity, a series name (reusing a name continues that series) and the entry window; publishing needs the password.  | Validated drop is created and its page opens             |

The hosted walkthrough must say that outcomes are scripted and no World check, real prize or saved entry exists. Refresh or restart clears its state. It must not call mutation APIs or fabricate public records. The separate local demo uses labelled test identities and real local database mutations; neither mode is evidence of real World verification.

## 7. Functional requirements and acceptance

Priority: **P0** = Phase 1 acceptance requirement; **P1** = Phase 2; **P2** = conditional stretch. Priorities describe delivery order, not proof of completion.

| ID  | Priority | Requirement                          | Acceptance criteria                                                                                                                                                                                                                               |
| --- | -------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | P0       | Organiser creates a drop             | Valid password and details create a drop showing item, quantity, series and schedule. Invalid quantity, malformed dates, close-before-open and a busy series create no drop. JST inputs preserve the intended instant in other browser timezones. |
| R2  | P0       | Verify World proofs on the server    | A real valid staging proof admits an eligible identity. Tampered, missing, wrong-credential, wrong-purpose or expired proofs create no member or entry. Browser success alone is insufficient.                                                    |
| R3  | P0       | One entry per identity per drop      | Re-entry from another browser or concurrent request produces no second entry. The original ticket weight remains unchanged.                                                                                                                       |
| R4  | P0       | Stable anonymous receipt             | The same verified identity receives the same code in two drops under the pinned policy; a different identity receives a different code. Cross-series linkability is disclosed.                                                                    |
| R5  | P0       | Apply capped series tickets          | Zero, three, five and six prior losses yield one, four, six and six tickets respectively. A different series starts at one unless it has its own losses.                                                                                          |
| R6  | P0 / P1  | Draw after close                     | Early draw changes nothing. Eligible draw returns the required distinct winners, or all entrants when undersubscribed. Record includes every entry’s weight and ordered picks. Phase 1 uses server randomness; Phase 2 uses Sui.                  |
| R7  | P0 / P1  | Settle loss history once             | Losers increment once, winners reset once, nonparticipants remain unchanged. Retrying preserves the result. Phase 1 failure rolls back the entire draw and settlement.                                                                            |
| R8  | P0       | Winner-only pickup                   | Fresh proof for the winner collects once. Wrong identity, replay and second collection are refused. Production remains disabled until server-attested liveness is validated; any staging fallback is explicitly marked untested.                  |
| R9  | P0 / P1  | Public records and lookup            | Without login, inspect entries, weights, winners, pickup status and before/after counts; search and paginate records; look up a code. Sui links appear only after real transactions exist.                                                        |
| R10 | P1       | Sui randomness                       | A published testnet package performs a weighted draw after close and exposes a transaction identifying winning codes. Current Sui implementation guidance must be validated before build.                                                         |
| R11 | P1       | Sui series ledger                    | On-chain counts match settled audit records; only authorised settlement changes them. Registration derives weights from the ledger; failed mirroring is recoverable without repeating a draw.                                                     |
| R12 | P2       | Unclaimed-item handoff               | After a defined pickup window, the next eligible person is offered the allocation once. Deadline, alternate ordering and loss-count consequences require a product decision before implementation.                                                |
| R13 | P1       | Test deposits and refunds            | Losing test wallets receive the full refund in the settlement transaction; winners' deposits pay the organiser as one coin. No fees. A failed wallet signature moves nothing. No real-money or mainnet rollout is authorised by this PRD.         |
| R14 | P0       | Minimise retained identity data      | No names, emails, phone numbers, raw proofs or raw nullifiers are stored. Public codes and lottery records are retained; proof logs contain only purpose, outcome, timing and timestamp.                                                          |
| R15 | P0       | Record the World integration debrief | Document measured first real verification timing, observed friction, unresolved behavior and the highest-value improvement. Pending measurements remain labelled pending.                                                                         |
| R16 | P0       | Explain the loop without credentials | Walkthrough demonstrates loss increment, ticket cap explanation, win reset, duplicate refusal and matching-identity pickup. Restart/refresh resets example state; no entry or proof is saved.                                                     |

## 8. Failure behavior and interaction requirements

| Condition                                         | User-facing behavior                                                     | Data effect                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| Duplicate entry                                   | “Already entered”; explain one entry per person                          | No second entry or weight change            |
| Cancelled verification                            | Explain entry was not completed; allow a new attempt                     | No entry                                    |
| Missing credential or invalid proof               | Explain what is required or why verification was refused                 | No member or entry created                  |
| World unavailable or rate-limited                 | Temporary-unavailability message with manual retry                       | No entry; distinguish outage from rejection |
| Missing configuration                             | Clearly state verification is unavailable                                | Fail closed                                 |
| Closed, not-yet-open or full drop                 | Explain current eligibility state                                        | No entry                                    |
| Early draw                                        | “Draw not open yet”                                                      | No state change                             |
| Wrong collector, expired proof or failed presence | Pickup refused with a useful next step                                   | No pickup                                   |
| Duplicate pickup                                  | “Already collected”                                                      | No second pickup                            |
| Unknown code or empty search                      | Clear no-results state and recovery path                                 | Read-only                                   |
| Invalid organiser input                           | Preserve values, link errors to fields and focus the first invalid field | No drop                                     |
| Interrupted mutation response                     | Explain uncertainty and offer record refresh before retry                | Do not automatically repeat the mutation    |

Primary flows must work by keyboard and on mobile. Use labelled controls, visible focus, persistent inline alerts, busy states and status announcements. Tables may scroll within their own region without overflowing the page. Dates must explicitly communicate JST; browser locale must not silently shift an organiser’s schedule. Entry, draw and pickup success may appear only after server confirmation.

## 9. Data, APIs and trust boundaries

### Product records

| Record            | Purpose and invariant                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `members`         | Unique anonymous code; no contact profile                                                       |
| `series`          | Related-drop grouping with five maximum extra tickets                                           |
| `drops`           | Item details, quantity, schedule, state and demo/setup labels; optional future chain references |
| `entries`         | One row per drop/code with captured ticket weight                                               |
| `results`         | Outcome, winner order and before/after loss counts                                              |
| `pity`            | Current losses per series/code                                                                  |
| `pickups`         | At most one claim per winning code/drop, with presence-validation classification                |
| `draw_records`    | Inputs, rolls, remaining pools, results, unallocated items and fingerprint                      |
| `challenges`      | Fresh nonce, drop, purpose, expiry and consumption state                                        |
| `identity_policy` | Pinned identity configuration to prevent accidental identity splitting                          |
| `proof_log`       | Verification outcome and timing without proof contents                                          |

In Phase 1, creation stores an `open` drop; opening and closing timestamps control actual entry eligibility. A closed-by-time drop may still have `open` stored state until draw. Successful draw moves directly to `settled` within one transaction. Schema values such as `draft` and `drawn` do not imply implemented publishing or intermediate-settlement workflows.

### Application interface

| Endpoint                      | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `POST /api/rp-signature`      | Issue a fresh signed verification challenge                 |
| `POST /api/drops/:id/enter`   | Verify proof and persist one eligible entry                 |
| `POST /api/drops/:id/draw`    | Draw and settle after close, or return the committed result |
| `POST /api/drops/:id/collect` | Verify a fresh winning identity and record pickup           |
| `GET /api/drops/:id/public`   | Read paginated entries, winners and draw record             |
| `GET /api/codes/:code`        | Read paginated history and series counts                    |
| `POST /api/admin/drops`       | Authorise and create a drop                                 |

The current architecture uses Next.js/React, server-side World ID verification, hosted Postgres and local PGlite. Implementation details live in [IMPLEMENTATION.md](IMPLEMENTATION.md) and [OPERATIONS.md](OPERATIONS.md).

### Security, privacy and operational requirements

- Verify the original proof body server-side and validate the configured credential result, identity, action, environment, nonce and purpose-bound signal. Challenge consumption must commit with the protected mutation.
- Keep database and signing credentials server-only. Do not persist proofs, organiser passwords or signing material in browser storage.
- Enforce origin checks, bounded request bodies, database uniqueness and transactional locking. Handle dependency failure without partial lottery state.
- Restrict local test-identity routes to explicitly enabled, non-production localhost use; never admit those identities to real drops.
- Treat public codes as pseudonymous and linkable across series. Series-scoped codes remain an open privacy decision requiring a migration design.
- Explain that the Phase 1 SHA-256 fingerprint supports record comparison, not proof of unbiased randomness or protection from an operator rewriting both the record and hash.
- Use hosted Postgres for serverless deployment. Keep local fixture databases isolated from production and from simultaneous PGlite processes.
- Retention periods, abuse controls, load targets and production service objectives remain to be defined before a broader launch; this prototype has no established production SLA.

## 10. Success measures and validation

### Release acceptance measures

| Measure                         | Required evidence                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Core loop correctness           | Complete local flow across two drops; formula, settlement and history agree                                                                 |
| Duplicate and replay protection | Zero additional entries, settlements or pickups in tested duplicate/concurrent/replay cases                                                 |
| Allocation integrity            | Distinct winner count equals `min(items, entrants)`; all before/after counts reconcile                                                      |
| World integration               | At least one real server-verified simulator success, duplicate refusal and invalid-proof refusal; stable identity demonstrated across drops |
| Pickup readiness                | Demonstrated server-attested liveness for production, or explicitly labelled staging-only fallback                                          |
| Presentation readiness          | Two clean four-minute rehearsals, recording and measured integration debrief                                                                |
| Phase 2 completion              | Real package ID and explorer transactions for registration, draw and settled ledger                                                         |

Existing tests cover domain rules, races, HTTP protections, mocked proof verification and browser journeys, including the current walkthrough and JST scheduling changes. Their presence is evidence of intended checks, not a fresh passing test run for this document. Mocked World tests cannot satisfy the real integration gate.

### Product learning measures — proposed, not instrumented

- **Rule comprehension:** can a fan explain three losses → four tickets, the six-ticket cap, series scope and reset after winning in a short usability check?
- **Entry completion:** accepted entries divided by eligible entry-flow starts; classify cancellations, refusals and dependency outages separately.
- **Verification friction:** successful verification latency and failure categories, using minimal timing logs.
- **Repeat participation:** previous losers who enter the next eligible drop in the same series divided by previous losers eligible for that drop.
- **Pickup completion:** collected allocations divided by winning allocations, evaluated against a future agreed pickup window.

Set baselines and targets after the first observed pilot. Any additional analytics must respect the minimal-data policy; do not claim retention or conversion gains before measurement.

## 11. Delivery gates

The original plan targets **September 27, 2026, 07:00 JST** for submission. This is the inherited team target, not an independently verified event deadline. The original detailed schedule and submission checklist remain in [PRD-ORIGINAL.md](PRD-ORIGINAL.md).

1. **Phase 1 gate:** complete the server-backed lifecycle, validate real World entry/refusal and stable codes, demonstrate safe pickup behavior, and retain an inspectable record. Passed: real World entries and refusals are on production (see the [debrief](OPERATIONS.md#world-integration-debrief)).
2. **Phase 2 gate:** only after Phase 1 passes, publish and validate Sui registration, weighted randomness, ledger settlement and database reconciliation. Design for an interrupted draw/settlement sequence and bounded work at the demo scale. If this gate misses the cut line, ship Phase 1 with its server-trust disclosure. Passed on Sui testnet.
3. **Stretch gate:** consider test deposits/refunds, then unclaimed handoff, only after both prior gates pass and their unresolved rules are approved.
4. **Submission gate:** complete two rehearsals, video, setup instructions, honest integration debrief and real evidence links for every claimed integration.

## 12. Risks and open decisions

| Risk or decision                                  | Current position                                                                                            | Owner / resolution gate                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Real document proofs and repeated-action identity | Simulator and real World IDs verified on production; real World IDs need a passkey for cross-drop identity  | Integration owner + Chai, before Phase 1 acceptance     |
| Passport, My Number Card and Orb choice           | Compatibility and dual-document uniqueness remain unresolved; do not switch after accepting entries         | Chai + World support, before first real entry           |
| Pickup presence                                   | Production blocked; staging fallback must remain labelled untested                                          | Integration owner, before production collection         |
| Public cross-series history                       | Current code is globally stable; series-scoped privacy would change R4 behavior                             | Chai, before identity migration or broader launch       |
| Operator influence over Phase 1                   | Records and fingerprints do not remove server/database trust                                                | Disclose for Phase 1; reassess after Phase 2 validation |
| Sui implementation and time budget                | Published on testnet and smoke-tested; Phase 1 still ships standalone                                       | Chai, at Phase 2 cut line                               |
| Wallet access in Japan                            | Slush's web wallet is blocked in Japan; paid-drop testers need a wallet extension or a wallet app's browser | Chai, before inviting judges to paid drops              |
| Unclaimed items                                   | Wins reset losses even without pickup; no automatic reassignment                                            | Chai, before R12 implementation                         |
| Deposits, fees and prize scope                    | Testnet-only deposits built for the Sui DeFi & Payments track; no fees; prize targets World IDKit and Sui   | Chai, before any mainnet or real-money use              |
| Production operations                             | Retention, abuse protection, capacity, support and recovery expectations remain unspecified                 | Product and engineering owners, before broader rollout  |
| Team/project positioning                          | Original project-replacement, naming, demo-item and prize decisions remain owner decisions                  | Chai, before submission                                 |

## 13. Repository evidence

This PRD was derived from local sources, not external market research or a fresh deployment audit:

- [README](../README.md), [original PRD](PRD-ORIGINAL.md), [implementation decisions](IMPLEMENTATION.md), [operations guide](OPERATIONS.md) and [interaction contract](../UX-CONTRACT.md).
- [Domain rules](../src/lib/domain.ts), [lottery service](../src/lib/service.ts), [World verification](../src/lib/world.ts) and [database schema](../db/schema.sql).
- [Application screens](../src/app), [walkthrough](../src/components/walkthrough.tsx), [organiser form](../src/components/admin-form.tsx) and [tests](../tests).

When older planning prose and current behavior differ, this document explicitly describes the implemented behavior and retains unvalidated integrations as gates. The original requirements remain available for traceability.
