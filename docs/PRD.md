# Pity Lottery PRD

Sep 25, 2026 · @Chai. Working name: **Tenjō (天井)**.

Source: user-provided PRD in the Codex task; original shared document: https://claude.ai/code/artifact/362406eb-c88c-46be-862b-f67704fb70aa . This repository transcription preserves the requirements and decisions; formatting and surrounding prose are condensed. Open questions are not resolved by their inclusion here.

## Goal and problem

Ship a working lottery by **September 27, 2026, 07:00 JST**. World ID gates entries and pickup. Each loss earns an extra ticket next time, scoped to the same series. Sui eventually runs the draw and makes every count public. Scarce Japanese drops attract duplicate accounts, while repeat losers cannot inspect the draw. Nintendo's first Switch 2 lottery attracted about 2.2 million applications; account/playtime restrictions are proxies for a real person.

Hackathon success: full live run, World failure paths, and a draw inspectable on a Sui explorer. Phase 1 must work independently if Sui misses the cut line.

## Requirements

| ID  | Requirement                                                  | Phase              | Acceptance                                                                      |
| --- | ------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------- |
| R1  | Organiser creates item, quantity, entry window and series    | 1                  | Drop page shows item, close time and number of winners                          |
| R2  | World proof verified on server before saving an entry        | 1                  | Valid simulator proof enters; unverified or tampered proof saves no entry       |
| R3  | One entry per person per drop                                | 1                  | Re-entry from any account/browser is refused, with no second entry              |
| R4  | Stable anonymous code across drops                           | 1                  | Same identity has same code in two drops; another identity has a different code |
| R5  | Tickets = 1 + series losses, maximum 5 extra                 | 1                  | Three losses give four tickets                                                  |
| R6  | Weighted draw after close                                    | 1 server / 2 Sui   | No early draw; quantity winners; log lists all entrants' weights                |
| R7  | Losers +1, winners reset to zero                             | 1 server / 2 Sui   | Counts change through a draw only                                               |
| R8  | Fresh World proof for pickup, winner only                    | 1                  | Winner collects once; another identity refused                                  |
| R9  | Public audit and code lookup                                 | 1 database / 2 Sui | Entries, weights, winners, record and loss counts inspectable                   |
| R10 | Built-in Sui randomness adapted from raffle example          | 2                  | Explorer transaction names winning codes                                        |
| R11 | Public Sui ledger per series                                 | 2                  | Counts match audit; only draw settlement updates them                           |
| R12 | Unclaimed wins pass to next drawn person after pickup window | Stretch            | Next entrant offered item                                                       |
| R13 | Sui deposits, full loser refunds, small World-cost fee       | Stretch            | Losing test wallet refunded in draw transaction                                 |
| R14 | No names, emails, phone numbers                              | 1                  | Only anonymous codes and drop data retained                                     |
| R15 | World integration debrief                                    | 1                  | README records observed timing, friction, missing docs, top improvement         |

Out of scope: real money/mainnet, store/ticketing integrations, names/KYC, native mobile apps, multiple credential tiers, organiser billing. Free entry; no legal claim about real-money operation.

## Identity and trust

Use @worldcoin/idkit, chosen passport credential (including My Number Card per PRD); Proof of Human/Orb is fallback if document proofs cannot run in staging. Selfie Check alone lacks the needed uniqueness assurance. Accepted limitation: a person holding both document types might get two World IDs.

- One fixed World action for entry and pickup. Code is a short hash of the stable nullifier.
- Backend issues a fresh signed request. Proof signal binds `enter:<drop>` or `collect:<drop>`.
- Backend forwards original IDKit result bytes directly to `POST https://developer.world.org/api/v4/verify/{rp_id}`; never trust browser success alone.
- Pickup requests `require_user_presence` (live selfie); if unavailable in simulator, demonstrate without it and label it untested.
- Staging uses World's simulator and `allow_legacy_proofs: true`; staging actions verify only simulator proofs.
- If repeated action proofs fail, investigate session fallback: prove uniqueness at signup and session on later entries.

## Pity and draw rules

Base 1; +1 per loss; at most 6 total tickets. Win resets loss count even if uncollected. Counts scoped to artist/shop/product series, no manual admin editing. No guaranteed win at a fixed count.

Weighted sampling without replacement: a selected person's whole weight leaves the pool. For weights 1, 3, 6, first-pick odds are 10%, 30%, 60%; the second pick uses remaining weights. Draw log lists entrants and tickets.

## Phase 2 contract sketch

- Shared `PityLedger` per series maps anonymous codes to loss counts.
- Shared `Drop` stores close time, item count, entries, winners and state.
- Server wallet owns `RegistrarCap`, the only authority to add entries.
- `add_entry(drop, cap, code)` before close derives capped weights from the ledger.
- Private entry `draw(drop, random, clock)` callable after close, multiple weighted winners.
- Separate `settle(drop, ledger)` transaction increments losers, resets winners.
- Use built-in `Random` at 0x8, clock at 0x6. Fixed work over every entry for every pick; no winner-dependent gas paths. Isolate randomness transaction, separate settlement. Validate against current Sui guide/compiler.
- Server controls verified registration and pickup; chain controls weights, draw, counts. Database mirrors chain records. A few hundred entrants maximum for demo; larger drops need batching.

## Data model

Hosted Postgres; Next.js; @worldcoin/idkit; phase 2 @mysten/sui; Vercel. Signing/wallet keys server environment only.

- `members(code, created_at)` unique code, no personal/contact details.
- `series(id, name, max_extra)` max_extra=5.
- `drops(id, series_id, title, items, opens_at, closes_at, state, sui_drop_id, draw_tx)` draft → open → closed → drawn → settled.
- `entries(drop_id, member_code, tickets, created_at)` unique drop/code.
- `results(drop_id, member_code, outcome, pick_order)` only draw writes.
- `pity(series_id, member_code, losses)` only settlement writes; mirrors chain in phase 2.
- `pickups(drop_id, member_code, collected_at)` at most one per winner.
- `proof_log(route, outcome, duration_ms, created_at)` timings only, never proof contents.

## API

- POST `/api/rp-signature`: fresh IDKit request signature.
- POST `/api/drops/:id/enter`: verify purpose-bound proof, reject repeat, persist; phase 2 registers on chain.
- POST `/api/drops/:id/draw`: anyone after close; server crypto.randomInt in phase 1, draw + settle + mirror in phase 2.
- POST `/api/drops/:id/collect`: fresh proof with liveness, winning code, collect once.
- GET `/api/drops/:id/public`: entries, tickets, winners, chain links.
- GET `/api/codes/:code`: entries, results, series loss counts.
- POST `/api/admin/drops`: one admin password for demo; creates drop.

## Demo and failures

Four minutes: hook (2.2m applications); A enters with three past losses/four tickets; same A from second browser refused; close and draw; inspect explorer; loser gets one extra ticket; winner collects and wrong identity refused; close: “One person, one entry, and every loss counts, in public.” Demo history is created by setup script and labelled as setup on audit.

| Path                | UI                  | Effect                                          |
| ------------------- | ------------------- | ----------------------------------------------- |
| Repeat person       | Already entered     | No second entry                                 |
| Cancel in World App | Entry not completed | No entry                                        |
| Missing credential  | Credential needed   | No entry                                        |
| Wrong collector     | Pickup refused      | Item uncollected                                |
| Selfie fails        | Pickup refused      | Item uncollected                                |
| Early draw          | Draw not open yet   | No state changes                                |
| World unavailable   | Try again shortly   | No entry, outcome is unavailable, not rejection |

## Milestones (JST)

- Fri 23:00–01:00: staging app/action/key, first real server verification; log time; Orb fallback if passport fails.
- Sat 09:00–13:00: complete Phase 1. **Cut line 1: full server draw run works.**
- Sat 13:00–19:00: Move testnet and integration. **Cut line 2: explorer draw or ship Phase 1.**
- Sat 19:00–23:00: R13 then R12 only if Phase 2 passed.
- Sun 00:00–05:00: setup, two clean four-minute rehearsals, video, README and debrief.
- Sun 07:00 submit; actual deadline 09:00.

## Submission checklist

- [ ] New public repo started this weekend (no earlier project code reuse).
- [ ] README names server verification file/line and actual Sui package ID.
- [ ] Trust moment and credential choice explained.
- [ ] Live successful verification and refusal demonstrated.
- [ ] Real measured World debrief complete.
- [ ] Sui drop, draw, ledger explorer links.
- [ ] Rehearsal video.
- [ ] World Best Use of IDKit; Sui DeFi & Payments only if deposits ship.

## Risks and open questions

Sui learning time: hard cutoff. Simulator passport failure: Orb fallback. Repeated action limitation: session fallback. Simulator selfie unsupported: disclose untested. Concert Kit comparison: this adds loss history and auditable draws. Wi-Fi: hotspot/video. Dual documents: accepted limitation. Real money: excluded, legal review before launch.

Unresolved decisions from the source:

- Does this replace the existing bank account-unfreeze helper? Team/@Chai, Sep 25.
- Does staging support passport with legacy proofs? World booth, Sep 25.
- Repeated action proofs and stable nullifier? World booth, Sep 25.
- Simulator presence and production My Number Card preset compatibility? World booth, Sep 25.
- Do deposits/refunds qualify for Sui DeFi & Payments? Sui booth, Sep 26.
- Ship deposits? Team, Sep 26 13:00.
- Scope code hashing to series to reduce cross-series linking? Source recommends yes, but R4 describes stable cross-drop codes. Needs explicit decision.
- Confirm Tenjō name, demo item and series.

## Sources from the PRD

- https://mynintendonews.com/2025/04/23/japan-nintendo-confirms-2-2-million-people-applied-for-the-switch-2-lottery/
- https://www.animenewsnetwork.com/interest/2025-04-08/my-nintendo-store-sets-restrictions-on-switch-2-pre-orders-in-japan/.223238
- https://mynintendonews.com/2026/05/25/japan-nintendo-scraps-50-hour-playtime-requirement-to-get-switch-2-from-my-nintendo/
- https://www.bcnretail.com/market/detail/20260210_596529.html
- World Concert Kit, Apr 17 2026; World credential, IDKit, sessions and RP signatures guides.
- Sui raffle example (example1.move) and on-chain randomness guide.
