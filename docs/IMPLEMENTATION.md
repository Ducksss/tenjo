# Implementation decisions and remaining gates

The source PRD is docs/PRD.md. This file records implementation decisions; it does not silently resolve its team, prize or legal questions.

## Phase 1 implemented locally

- Next.js 16.3.6 / React 19; @worldcoin/idkit 4.3.0.
- Postgres query interface with `pg` for hosted Postgres, PGlite for a single local process. Local database migrations run on startup; hosted migration is explicit.
- Organiser creation, fresh signed proof challenges, entry, draw/settlement, pickup, public drop records, code history and measured verification outcomes.
- React server pages query the database directly. Only interactive controls load client JavaScript; the IDKit widget is lazy-loaded.
- No raw proof/nullifier or personal/contact data in storage. `proof_log` stores purpose, result category, duration and timestamp. Challenges store nonce, purpose, expiry and consumption status. Database credentials never go to the browser.

## Domain edge cases

1. **One active drop per series.** Create refuses a new drop until the previous one settles. This prevents stale entry weights and out-of-order loss updates. Cross-series drops are independent.
2. **Under-subscription.** Select min(items, entrants); record unallocated items. With zero entrants, settle an empty draw. Never invent winners.
3. **Concurrent requests.** Mutations lock series then drop, re-read state, and check database wall-clock time after locking. Unique constraints back up duplicate refusal. Drawing/settlement is atomic; retrying a draw returns the existing record. An entry challenge is consumed inside the same transaction as its entry; rejected/rolled-back operations do not consume it.
4. **Privacy scope.** Follow R4: one 128-bit anonymous code across drops, with losses scoped to series. UI says history is publicly linkable. The proposed series-scoped code is still an open product decision.
5. **Code derivation.** Canonicalize the verified nullifier as a padded 256-bit integer before hashing, avoiding case/leading-zero duplicate bypasses. Hash includes app, fixed action, protocol and Tenjo version. No nullifiers stored.
6. **Identity migration.** Pin one protocol and credential family, with a stored policy fingerprint after the first accepted entry. Changing app/RP/action/environment/protocol/credential afterwards fails closed; it needs an explicit migration or a new database. Staging defaults to v3 document legacy; production pins v4. Do not accept both versions without an identity-linking migration.
7. **Replay resistance.** Signal extends the PRD format to `purpose:drop_id:challenge_id`. Nonce, purpose, drop, signal, expiry, configured action and environment must match. An expired/consumed challenge cannot create an entry or pickup.
8. **Verification result.** HTTP 200 or an overall success bit is insufficient. The configured credential's individual verification result must succeed with a matching canonical nullifier. Failed/mismatched proofs create no member or entry. World 429/5xx/network failures are unavailable, not rejections.
9. **Draw record.** Store all weights, sampled roll and remaining pool for each winner, before/after loss counts, timestamp and unallocated quantity. SHA-256 uses recursively sorted object keys (`canonicalJson` in domain.ts), so Postgres jsonb key ordering does not break independent fingerprint calculation. The fingerprint does not prove fair randomness or operator honesty.
10. **Pickup liveness.** Request `require_user_presence`, but do not treat a client boolean as attested proof. Production pickup remains disabled until server-enforced liveness is verified. `WORLD_ALLOW_UNTESTED_PICKUP=true` enables an explicit staging-only fallback using a fresh valid identity proof; its record says `untested-staging`, even if a device reports presence completed.

## Security and deployment boundaries

Local test routes need TENJO_DEMO_MODE, non-production, no Vercel environment, and localhost. They only work on `is_demo` drops, use a separate identity hash namespace, and cannot enter real drops. Setup history is generated through the real draw/settlement code and publicly labelled. The setup script uses deterministic picks to give Fan A three losses; live draws use crypto.randomInt. No HTTP request controls the random source or clock.

Only server database credentials can write data. Do not expose these tables through unauthenticated PostgREST or give an anonymous database role writes. A Phase 1 database operator can tamper with records: the UI and README disclose this trust. Admin creation uses a timing-safe comparison of a server password, with no cookie/local-storage session. APP_ORIGIN pins the canonical deployed origin; local origin checks use Host because Next normalizes its internal URL.

Deployment requires DATABASE_URL and World app configuration. PGlite is not a Vercel/serverless database. Local scripts and the dev server must not access the same PGlite directory simultaneously. Browser tests use a separate database and Next build directory.

## Phase 2: Sui escrow drops

Implemented in `move/tenjo` (`tenjo::ballot`, Move 2024, Sui CLI 1.80.1), `src/lib/sui.ts` (server-only gRPC client), `src/lib/sui-draw.ts` (pure recomputation) and `src/lib/service.ts`. Tested with 22 Move unit tests, mocked-chain service tests and a full run on a local Sui network (protocol 137). **The testnet publish is pending funding**; no testnet digest exists yet. The UI never fabricates explorer links, and links are omitted for localnet.

1. **Objects.** `OrganiserCap` (key, store) is minted to the publisher. A shared `Series` holds the name, the registrar's Ed25519 public key, the loss ledger (`Table<code, u64>`, absent means 0) and `active_drop`. A shared `Drop<T>` is an escrow vault over any coin type: entries `{code, chances, payer, paid}`, a duplicate table, `Balance<T>`, the seed, winners and a settled flag. `Ticket` has `key` only, so it cannot be transferred; a legacy `sui::display` gives it a name.
2. **Weights on-chain.** Both entry paths compute `chances = 1 + min(5, losses)` from the series ledger, refuse duplicates, entries at or after close and a 301st entrant. `register` (organiser, free drops only) follows server-side World verification. `enter` (fan-signed) needs a deposit equal to the price and a permit.
3. **Permit.** The registrar signs `b"tenjo:enter:v1" || drop ID (32 bytes) || code (16) || sender address (32)`; `ed25519_verify` checks it against `series.registrar`. It binds the World-verified code to one wallet and one drop. Test vectors come from `@mysten/sui` (`scripts/sui-test-vectors.ts`) and pass on-chain verification in the Move tests.
4. **Commit, then settle.** `draw` is a non-public `entry` function taking `&Random`: after close, once, it only stores a 32-byte seed, so its gas never depends on the outcome (Sui's randomness guidance). `settle` is public and deterministic from the seed, so anyone can finish a drawn drop and nobody can reroll it.
5. **Algorithm.** For pick `i` in `0 .. min(items, entrants)`: `roll = u64_le(blake2b256(seed || bcs(i as u64))[0..8]) % remaining_chances`; walk unpicked entries in entry order, adding their chances, and pick the first whose running total exceeds the roll; its chances leave the pool. Modulo bias is below 1800 / 2⁶⁴. `chainDraw` in `sui-draw.ts` reproduces it and is tested against the Move vectors and a localnet settlement.
6. **One settlement transaction.** Winners reset to 0 and losers gain 1. The winners' deposits go to the payout address as one coin, each loser is refunded individually, and each winner whose payer is not `@0x0` gets a Ticket. The `Settled` event carries the seed, winners in pick order, rolls, pool totals, every entry's losses before and after, and the refund and payout totals.
7. **Chain authority and mirror.** The database mirrors the chain's entries, weights, winners and ledger into `results`, `pity` and `draw_records` (version 2, algorithm `sui::random + tenjo::ballot::settle`) in one transaction under the existing series/drop row locks. The record says whether recomputing from the seed reproduced the chain's winners (`verified`). A drawn but unmirrored drop is completed by rereading the chain; no step repeats.
8. **One ledger per series.** A series joins Sui only before its first drop. Setup drops stay off-chain because their scripted picks cannot be reproduced on-chain, so the seeded Fan A history keeps the server draw. A series on Sui refuses new drops while Sui is not configured, and a republished package needs new series.
9. **Free-entry resilience.** The entry commits before registration; a Sui failure leaves it `pending`, retried by later entries and before the draw. The chain closes 30 seconds after the database, so last-second entries land; an entry that never lands gets no result and is listed as unregistered.
10. **Paid entries.** `POST /api/drops/:id/permit` verifies World ID, consumes the challenge and returns a permit for the wallet in `x-tenjo-sui-address`; the wallet calls `ballot::enter`; `POST /api/drops/:id/confirm` checks the transaction's `Entered` event (this drop, payer = sender, paid = price) and mirrors the entry idempotently. Unconfirmed deposits are still mirrored at the draw.
11. **Concurrency.** Organiser-signed transactions are serialised with a Postgres advisory lock and an in-process queue, and each waits for indexing, so the gas coin and cap never race. Aborts are classified from the gas simulation before any gas is spent.
12. **Gas.** A draw costs the minimum computation. Settling six fans costs about 0.01 SUI; 300 entrants with 300 items fits one transaction (0.63 SUI computation, 0.72 SUI storage on localnet).

Known limits: no cancellation or pre-draw refund path (anyone may draw and settle after close, so deposits cannot be stranded by the organiser alone); one organiser cap; no registrar rotation; only SUI deposits are wired although `Drop<T>` is generic; digest recovery scans the latest 50 events; codes on-chain are the same public, linkable codes as the database.

## Unresolved gates

Remaining evidence: first World simulator proof, legacy document identifier/availability, My Number Card preset behavior, production v4 behavior, server-attested pickup presence, public Postgres deployment, the Sui testnet publish and a testnet settlement, two live rehearsals and video. Team/project priority and prize decisions remain @Chai's.

## Sources checked during implementation

- https://docs.world.org/world-id/idkit/integrate — fixed-action nullifiers, server verification and staging.
- https://docs.world.org/api-reference/developer-portal/verify — per-credential results and expected environment.
- https://docs.world.org/world-id/idkit/credentials — credential presets and user-presence request.
- Installed IDKit 4.3.0 type definitions and signing/hashing exports — actual package interface and legacy migration warning.
- Installed Next docs under node_modules/next/dist/docs — route handlers, server/client boundaries, async params and Webpack CLI support.

The SDK currently exposes separate Passport and Mnc presets. Production My Number Card compatibility with the selected passport path is untested; this build does not claim to resolve the PRD's booth question.
