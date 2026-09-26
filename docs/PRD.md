# Tenjō (天井) — Product Requirements Document

Version 2.0 · 27 September 2026 · Product owner: Chai · Status: current

**One person, one entry, and every loss counts.**

This PRD describes Tenjō as built and deployed at [tenjo-azure.vercel.app](https://tenjo-azure.vercel.app). Requirements R1–R16 keep their original meanings; R4 now states how codes work for real World IDs, and R17 adds the passkey that carries their losses. Product outcomes and learning measures are hypotheses, not observed results. The [original 25 September PRD](PRD-ORIGINAL.md) is preserved.

## 1. Product summary

Tenjō is a lottery for scarce drops, free or with a refundable testnet deposit. A fan enters once with a verified identity. Each loss adds a chance in the next drop of the same series, up to six chances in total; a win resets the count. Anyone can inspect the anonymous entries, their weights, the results and the loss history.

Three capabilities make it work:

- **Verified participation.** World ID admits one entry per person per drop without Tenjō collecting contact details.
- **Recognition of repeat participation.** Losses raise a fan's weight in later drops of the same series. World's simulator keeps one code per identity; a real World ID keeps its losses with a passkey.
- **Visible allocation.** A public record shows which weights entered the draw, who won and how the counts changed. Drops on Sui take their randomness, deposits, refunds and loss counts from the chain; drops off Sui trust the server and database operator.

## 2. Problem and product hypothesis

Fans repeatedly miss scarce drops without their previous attempts counting for anything. Organisers need to discourage duplicate entries and explain allocation. Observers need enough information to inspect outcomes without seeing names or contact details.

**Hypothesis:** a clear, capped benefit for previous losses, combined with proof of personhood and a public record, makes repeat participation feel worthwhile and allocation easier to trust.

The mechanism deliberately weights people differently by loss history. It does not promise equal odds, an eventual win, resale prevention or uniqueness beyond the chosen credential's guarantees.

## 3. Users and jobs to be done

| User                     | Need                                                | Successful experience                                                                                                                    |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| First-time fan           | Understand the rules and enter an eligible drop     | Sees the item, deadline and chance rule; verifies; receives an anonymous receipt                                                         |
| Returning fan            | Carry forward losses and understand the next chance | Enters with the same identity (the simulator's code, or a real World ID with the same passkey); gets the right weight; sees past results |
| Paying fan               | Enter a drop that takes a deposit                   | Connects a Sui wallet, locks the deposit, and gets it back in the settlement on a loss                                                   |
| Winning fan              | Claim an allocation securely                        | Completes a fresh identity check; collects once; sees confirmation                                                                       |
| Organiser                | Allocate a limited quantity                         | Sets item, quantity, series, price and JST schedule; gets a settled public result                                                        |
| Public observer or judge | Check the mechanism and the evidence                | Reviews entries, weights, ordered winners and loss changes without signing in; follows every chain claim to Suiscan                      |

The context is an English-language hackathon build of Japanese-style scarce drops. Demand, organiser adoption and retention are unvalidated.

## 4. Goals, scope and status

### Goals

1. Demonstrate the full loop: create → enter → draw → update loss counts → collect → enter the next drop.
2. Prevent duplicate entries and repeat pickups for the same person, including concurrent requests.
3. Make the chance formula and each result understandable and inspectable.
4. Keep identity data minimal and disclose that anonymous codes are publicly linkable.
5. Claim an integration only with real evidence.

### Scope

| Scope                    | Included                                                                                                         | Status                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Core loop                | Discovery, organiser creation, entries, weighted draw, settlement, pickup checks, public records and code lookup | Live                                                                          |
| First-visit explanation  | The flow animation and the browser-only walkthrough of a loss, a win, refusals and pickup                        | Live on the home page                                                         |
| World ID                 | Signed requests, server verification, the simulator and real World IDs, replay protection                        | Live: 17 server-verified entries on production                                |
| Returning real World IDs | A passkey carries the code a real World ID's losses follow                                                       | Live; tested with a real device on production                                 |
| Production pickup        | Fresh winning identity plus server-attested liveness                                                             | Blocked until liveness is server-enforced; the labelled staging fallback runs |
| Hosting                  | Vercel with Neon Postgres                                                                                        | Live                                                                          |
| Sui                      | Registration, `sui::random` draw, on-chain ledger, settlement and explorer evidence                              | Live on testnet (`0x0d0f…3a65`); free and paid drops smoke-tested end to end  |
| Deposits (R13)           | Testnet deposits in a per-drop escrow, refunded to losers in the settlement                                      | Live on testnet                                                               |
| Stretch                  | Unclaimed-seat handoff                                                                                           | Not started                                                                   |

### Non-goals

Real-money entry, mainnet payments, organiser billing, native mobile apps, commerce or ticketing integrations, shipping, names or contact profiles, simultaneous credential tiers, guaranteed wins and large-scale drops. Pickup records a claim; it does not prove physical delivery. Japanese localisation is outside the current English build.

## 5. Core product rules

### Entries and chances

- A **series** groups related drops from a shop, artist or product line. A **drop** is one allocation in that series.
- One code enters a drop once. Extra chances weight that single entry; they are not extra entries.
- `chances = 1 + min(5, losses in this series since the last win)`, captured at entry. A first-time entrant gets one; three losses give four; losses in another series don't count.
- Only a settled draw changes a loss count; nobody can edit one by hand.
- A series has at most one unsettled drop; the next can't be created until it settles.
- A drop takes up to 300 entrants and 1–300 items.

### Draw and settlement

- Entry is accepted from the opening time until just before the closing time, by the database clock.
- After close, anyone may start the draw; the page asks for confirmation because the result is final.
- `min(items, entrants)` distinct winners are picked by weighted sampling without replacement; a winner's whole weight leaves the pool. For weights 1, 3 and 6, the first-pick odds are 10%, 30% and 60%.
- Every loser gains one loss; every winner resets to zero, even if the item is never collected. Non-entrants don't change.
- Retried or concurrent draws return the committed result and never reroll. Undersubscribed drops give everyone a win and record the unused items; an empty drop settles with no winners.
- **On Sui**, the draw commits a seed from `sui::random`, and one settlement transaction picks the winners, pays the organiser, refunds every loser and updates the ledger. **Off Sui**, the server draws with `crypto.randomInt`.

### Identity

- Every entry is recorded under a 32-character anonymous code: the key for its pity count, receipt and on-chain ledger.
- **World's simulator** uses one action, so an identity keeps its code across drops.
- **A real World ID** gets a fresh code in every drop, because World ID 4 lets a person prove each action once and each drop has its own action. With a passkey, its entries use the passkey's code instead, so its losses carry.
- **One person, one entry per drop**, whichever passkey or wallet they bring. A second passkey never adds an entry; a passkey already entered in a drop can't enter it again.
- Entry and pickup need fresh requests bound to purpose and drop. A code is a public lookup key, never a credential for claiming an item.
- The identity settings are pinned after the first real entry; changing them needs a migration or a fresh database.

### Deposits

- A priced drop holds each entrant's deposit, equal to the price, in the drop's escrow on Sui testnet.
- Winners' deposits pay the organiser as one coin; each loser is refunded in the same settlement transaction.
- A cancelled or refused wallet signature moves nothing. The wallet only pays; the code comes from World ID or the passkey.

### Pickup

- Only a settled drop's winner may collect, once. A failed or wrong-identity attempt leaves the item uncollected.
- Production pickup stays off until liveness is server-attested; the staging fallback records every pickup as liveness untested.

## 6. User journeys and screens

| Journey          | Screens and behaviour                                                                                                                                                                                                                 | Completion                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Discover         | `/` features the drop fans can enter now, the flow animation and the walkthrough. The empty state explains availability                                                                                                               | The fan opens a drop or starts the explanation     |
| Learn            | `/#how` (`/demo` redirects) takes Fan A through four chances, a loss, five chances, a win and pickup, with duplicate and wrong-identity refusals                                                                                      | The fan can explain the rule                       |
| Enter            | `/drops/[id]` explains the item, series, window, chance rule and verification. Real World IDs can tick "Keep my extra chances with a passkey"; paid drops connect a wallet first. A server-confirmed entry shows the code and chances | One durable entry exists                           |
| Check history    | `/results` takes a full code; `/codes/[code]` shows entries, results and per-series counts                                                                                                                                            | The fan can explain their count and next weight    |
| Draw and inspect | The drop page confirms before drawing, then shows the record, the Sui evidence and a browser re-run of the draw                                                                                                                       | One settled draw and matching public history exist |
| Collect          | A winning fan starts a fresh identity check on the drop page                                                                                                                                                                          | One pickup is saved and confirmed                  |
| Organise         | `/admin` takes the title, description, quantity, series name (reusing a name continues the series), price and window; publishing needs the organiser password                                                                         | A valid drop is created and its page opens         |

The walkthrough says its outcomes are scripted, with no World check, prize or saved entry, and it never calls mutation APIs. The local demo uses labelled test identities; neither is evidence of real World verification.

## 7. Functional requirements and acceptance

Priority: **P0** = core acceptance; **P1** = Sui phase; **P2** = conditional stretch.

| ID  | Priority | Requirement                          | Acceptance criteria                                                                                                                                                                                                                                      | Status  |
| --- | -------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| R1  | P0       | Organiser creates a drop             | Valid password and details create a drop showing item, quantity, series and schedule. Invalid quantity, malformed dates, close-before-open and a busy series create nothing. JST inputs keep the intended instant in other browser time zones.           | Done    |
| R2  | P0       | Verify World proofs on the server    | A valid proof admits an eligible identity. Tampered, missing, wrong-credential, wrong-purpose or expired proofs create no member or entry. Browser success alone is insufficient.                                                                        | Done    |
| R3  | P0       | One entry per person per drop        | Re-entry from another browser, device, passkey or concurrent request produces no second entry; the original weight is unchanged.                                                                                                                         | Done    |
| R4  | P0       | Stable anonymous receipt             | A simulator identity, or a real World ID with the same passkey, gets the same code in two drops under the pinned settings; different people get different codes. A real World ID without a passkey gets a fresh code per drop. Linkability is disclosed. | Done    |
| R5  | P0       | Apply capped series chances          | Zero, three, five and six prior losses give one, four, six and six chances. Another series starts at one unless it has its own losses.                                                                                                                   | Done    |
| R6  | P0 / P1  | Draw after close                     | An early draw changes nothing. An eligible draw returns the required distinct winners, or everyone when undersubscribed. The record has every weight and the ordered picks. Off Sui uses server randomness; on Sui uses `sui::random`.                   | Done    |
| R7  | P0 / P1  | Settle loss history once             | Losers gain one, winners reset, non-entrants are unchanged. Retrying keeps the result. A failure leaves no partial state.                                                                                                                                | Done    |
| R8  | P0       | Winner-only pickup                   | A fresh proof from the winner collects once; wrong identity, replay and a second collection are refused. Production waits for server-attested liveness; the staging fallback is marked untested.                                                         | Partial |
| R9  | P0 / P1  | Public records and lookup            | Without login, inspect entries, weights, winners, pickup status and before/after counts; search and paginate; look up a code. Sui links appear only for real transactions.                                                                               | Done    |
| R10 | P1       | Sui randomness                       | A published testnet package draws after close and exposes a transaction naming the winning codes.                                                                                                                                                        | Done    |
| R11 | P1       | Sui series ledger                    | On-chain counts match settled records; only settlement changes them. Registration reads weights from the ledger; a failed mirror recovers without repeating a draw.                                                                                      | Done    |
| R12 | P2       | Unclaimed-item handoff               | After a pickup window, the next eligible person is offered the allocation once. Needs a product decision on deadlines, ordering and loss counts first.                                                                                                   | Open    |
| R13 | P1       | Test deposits and refunds            | Losing wallets get the full refund in the settlement transaction; winners' deposits pay the organiser as one coin. No fees. A failed wallet signature moves nothing. No real money or mainnet.                                                           | Done    |
| R14 | P0       | Minimise retained identity data      | No names, emails, phone numbers, raw proofs or raw nullifiers are stored; passkeys keep only a public key. Proof logs hold only purpose, outcome, timing and time.                                                                                       | Done    |
| R15 | P0       | Record the World integration debrief | Measured first real verification, friction, unresolved behaviour and the highest-value improvement ([debrief](OPERATIONS.md#world-integration-debrief)).                                                                                                 | Done    |
| R16 | P0       | Explain the loop without credentials | The walkthrough shows a loss adding a chance, the cap, a win resetting, duplicate refusal and matching-identity pickup. Restarting resets it; nothing is saved.                                                                                          | Done    |
| R17 | P0       | Real World IDs keep their losses     | A real World ID entering two drops of a series with the same passkey carries its losses. A second passkey never adds an entry, and a passkey can't enter a drop twice. Refusals don't spend the World ID proof. Only the passkey's public key is stored. | Done    |

## 8. Failure behaviour

| Condition                                       | What the fan sees                                                                   | Data effect                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| Duplicate entry                                 | "You've already entered this draw", with a link to the first entry                  | No second entry or weight change            |
| Cancelled verification                          | Entry not completed; verify again when ready                                        | No entry                                    |
| Missing credential or invalid proof             | What is required, or why it was refused                                             | No member or entry                          |
| World unavailable or rate-limited               | Temporary unavailability, with manual retry                                         | No entry; outage kept distinct from refusal |
| Staging window closed                           | World's staging window is closed; the organiser must open a new one                 | No entry                                    |
| Browser remembers no passkey                    | "Entered with a passkey before?": **Use my passkey** or **Create a passkey**        | Nothing until the fan chooses               |
| Passkey prompt cancelled or interrupted         | Nothing entered yet; retry, the other option, or **Enter with World ID alone**      | No entry; the World ID request stays usable |
| Passkey unknown or its signature invalid        | Nothing saved; enter again to create a new passkey                                  | No entry; the World ID proof is not spent   |
| Passkey already entered in this drop            | Use your own passkey, or enter with World ID alone                                  | No entry; the World ID proof is not spent   |
| Wallet can't connect                            | "Connection failed" from the wallet picker (Slush's web wallet is blocked in Japan) | Nothing                                     |
| Deposit refused or cancelled in the wallet      | The wallet didn't approve the deposit, which did not move; entry not completed      | No entry                                    |
| Deposit refused by Sui                          | Sui refused the entry; the deposit did not move                                     | No entry                                    |
| Missing configuration                           | Verification is unavailable                                                         | Fail closed                                 |
| Closed, not-yet-open or full drop               | The current eligibility state                                                       | No entry                                    |
| Early draw                                      | "Draw not open yet"                                                                 | No change                                   |
| Wrong collector, expired proof, failed presence | Pickup refused, with a next step                                                    | No pickup                                   |
| Duplicate pickup                                | "Already collected"                                                                 | No second pickup                            |
| Invalid organiser input                         | Values kept, errors linked to fields, focus on the first                            | No drop                                     |
| Interrupted response                            | Uncertainty explained; refresh the record before retrying                           | Never repeated automatically                |

Primary flows work by keyboard and on mobile, with labelled controls, visible focus, persistent inline alerts, busy states and status announcements. Tables scroll inside their own region. Dates say JST explicitly. Success appears only after server confirmation.

## 9. Data, interfaces and trust

### Product records

| Record                                     | Purpose and invariant                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `members`                                  | One anonymous code; no contact profile                                   |
| `series`                                   | Related drops, with their Sui series                                     |
| `drops`                                    | Item, quantity, schedule, state, price, labels and chain references      |
| `entries`                                  | One row per drop and code, with the captured weight and any deposit      |
| `results`                                  | Outcome, pick order and before/after losses                              |
| `pity`                                     | Current losses per series and code                                       |
| `pickups`                                  | At most one claim per winning code and drop                              |
| `draw_records`                             | Inputs, rolls, pools, results, unallocated items and fingerprint         |
| `challenges`                               | World ID requests: nonce, drop, purpose, setup, expiry and use           |
| `identity_policy`, `identity_policy_modes` | Pinned identity settings for each World setup                            |
| `entry_identities`                         | Each drop's World ID code beside its entry's code: one person, one entry |
| `passkeys`                                 | Passkey public keys and the codes their entries use                      |
| `proof_log`                                | Verification outcome and timing, without proof contents                  |

The endpoints are listed in [IMPLEMENTATION.md](IMPLEMENTATION.md#http-interface).

### Security, privacy and operations

- Verify the original proof body on the server and check the credential's own result, nullifier, action, environment, nonce and purpose-bound signal. Consume the request with the protected change.
- Keep database, World and Sui keys on the server. Store no proofs, passwords or signing material in the browser.
- Enforce origin checks, bounded bodies, database uniqueness and transactional locking; handle dependency failure without partial state.
- Keep local test identities to explicitly enabled, non-production localhost use; never admit them to real drops.
- Treat codes, including passkey codes, as pseudonymous and linkable across series. Series-scoped codes are an open decision.
- Explain that the server draw's fingerprint supports comparison, not proof of unbiased randomness; drops on Sui take their randomness from the chain.
- Retention periods, abuse controls, load targets and service objectives are undefined; this prototype has no production SLA.

## 10. Success measures

### Release acceptance

| Measure                         | Required evidence                                                                           | Status                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Core loop correctness           | A full flow across two drops; formula, settlement and history agree                         | Met in tests and on testnet                             |
| Duplicate and replay protection | No extra entries, settlements or pickups in duplicate, concurrent and replay cases          | Met in tests; duplicate refusal seen on production      |
| Allocation integrity            | Winners equal `min(items, entrants)`; every count reconciles                                | Met; the chain ledger matched the database twice        |
| World integration               | Real server-verified successes, duplicate and invalid-proof refusals, identity across drops | Met: simulator, real World IDs and a real passkey entry |
| Pickup readiness                | Server-attested liveness in production, or a labelled staging fallback                      | Staging fallback only                                   |
| Presentation readiness          | Two clean four-minute rehearsals, the recording and the measured debrief                    | Debrief done; rehearsals and recording pending          |
| Sui completion                  | Real package, registration, draw and settled ledger transactions                            | Met on testnet                                          |

### Learning measures (proposed, not instrumented)

- **Rule comprehension:** can a fan explain three losses → four chances, the six-chance cap, series scope and the reset after a win?
- **Entry completion:** accepted entries over eligible starts, with cancellations, refusals and outages counted separately.
- **Verification friction:** successful verification time and failure categories, from the minimal timing log.
- **Passkey adoption:** real-World-ID entries with a passkey over all real-World-ID entries.
- **Repeat participation:** previous losers who enter the next drop in the same series, over those eligible.
- **Pickup completion:** collected allocations over winning allocations, against a future pickup window.

## 11. Delivery gates

The team target is submission by **27 September 2026, 09:00 JST**.

1. **Core gate, passed:** the server-backed lifecycle, real World entries and refusals, safe pickup behaviour and an inspectable record.
2. **Sui gate, passed on testnet:** registration, weighted randomness, ledger settlement and database reconciliation, with interrupted steps recoverable.
3. **Stretch gate:** deposits and refunds are done; the unclaimed-seat handoff needs its rules approved first.
4. **Submission gate:** two rehearsals, the video, setup instructions, the debrief and real evidence links for every claimed integration.

## 12. Risks and open decisions

| Risk or decision                    | Current position                                                                                                                                                            | Owner / gate                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Document credentials and uniqueness | Two identity documents could mean two World IDs; disclosed. Orb is used for real World IDs                                                                                  | Chai + World, before a broader launch                |
| Returning real World IDs            | Passkeys carry losses; a shared passkey hands over pity (never entries). World ID session proofs would bind pity to the person once their server verification is documented | Engineering, when World documents sessions           |
| Pickup presence                     | Production blocked; the staging fallback stays labelled untested                                                                                                            | Engineering, before production collection            |
| Wallet access in Japan              | Slush's web wallet is blocked there; paid-drop testers need a wallet extension or a wallet app's browser                                                                    | Chai, before inviting judges to paid drops           |
| Public cross-series history         | Codes, including passkey codes, are linkable across series; series-scoped codes would change R4                                                                             | Chai, before an identity migration or broader launch |
| Operator influence off Sui          | Server draws and records still trust the operator; drops on Sui do not                                                                                                      | Disclosed                                            |
| Unclaimed items                     | Wins reset losses even without pickup; no automatic reassignment                                                                                                            | Chai, before R12                                     |
| Deposits, fees and prize scope      | Testnet-only deposits for the Sui DeFi & Payments track; no fees; prizes entered: World IDKit and Sui                                                                       | Chai, before any real-money use                      |
| Production operations               | Retention, abuse protection, capacity, support and recovery are unspecified                                                                                                 | Product and engineering, before a broader rollout    |

## 13. Sources

This PRD was written from the repository and the live deployment, not external market research:

- [README](../README.md), [architecture and decisions](IMPLEMENTATION.md), [operations guide](OPERATIONS.md), [interaction contract](../UX-CONTRACT.md) and the [original PRD](PRD-ORIGINAL.md).
- [Domain rules](../src/lib/domain.ts), [lottery service](../src/lib/service.ts), [World verification](../src/lib/world.ts), [passkeys](../src/lib/passkey.ts), the [Move package](../move/tenjo/sources/ballot.move) and the [schema](../db/schema.sql).
- [Application screens](../src/app), the [walkthrough](../src/components/walkthrough.tsx), the [entry card](../src/components/drop-actions.tsx) and the [tests](../tests).
