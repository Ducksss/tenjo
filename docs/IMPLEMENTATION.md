# Architecture and implementation decisions

How Tenjō is built and why. What it must do is in [PRD.md](PRD.md); how to run and deploy it is in [OPERATIONS.md](OPERATIONS.md). This file records engineering decisions; it does not settle the team, prize or legal questions the PRD leaves open.

## The pieces

![How the pieces connect: the fan's browser (pages, IDKit, passkey and wallet) sends a request to Tenjō on Vercel, proves with World App, and sends the proof back. Tenjō checks it with World's verify API, mirrors every record in Neon Postgres, and registers, draws and settles on Sui testnet. On paid drops the fan's wallet locks the deposit on Sui directly.](assets/diagram-system.svg)

- **Next.js 16.3.6 and React 19** on Vercel. Server pages query the database directly; only interactive controls ship client JavaScript, and the IDKit and wallet widgets load lazily.
- **World ID** through IDKit 4.3.0 in the browser and a byte-preserving verifier on the server.
- **Passkeys** (WebAuthn) through `@simplewebauthn/browser` and `@simplewebauthn/server` 14, for returning real World IDs.
- **Postgres**: Neon when hosted, PGlite for a single local process.
- **Sui**: the `tenjo::ballot` Move package on testnet, a server-only gRPC client and dApp Kit for fan wallets.

## One entry, step by step

A free entry, in code order. A stop anywhere saves nothing.

1. The fan taps **Enter**. The browser asks `POST /api/rp-signature` for a World ID request: an RP-signed nonce, valid for 5 minutes, for this drop and purpose, in either the primary (simulator) or the production (real World ID) setup.
2. With a real World ID and the passkey step ticked, the browser creates or uses the fan's passkey over a challenge derived from that request ([Passkeys](#passkeys)).
3. The fan proves in World App. The proof's signal is `enter:<drop>:<request>`.
4. The browser posts the untouched proof to `POST /api/drops/:id/enter`, with the request in `x-tenjo-challenge` and any passkey answer in `x-tenjo-passkey`.
5. The server checks the origin and the body size (64 KiB), then the passkey, before World is asked, so a passkey refusal never spends the proof.
6. `verifyWorldProof` checks the identity settings, the proof's shape and context, the request, the credential and the signal, then forwards the exact bytes to World's verify API and requires the credential's own success with a matching nullifier.
7. `enterDrop` locks the series and the drop, re-reads the clock, refuses closed drops and repeat entries, consumes the request, and saves the entry with `1 + min(5, losses)` chances, all in one transaction.
8. After the commit, an entry in a drop on Sui is registered on-chain by the organiser. If Sui is down, the entry waits as `pending` and is retried.

A paid entry swaps steps 7–8: `POST /api/drops/:id/permit` runs the same checks, then signs a permit instead of saving an entry. The fan's wallet sends `ballot::enter` with the deposit, and `POST /api/drops/:id/confirm` mirrors the on-chain entry.

## Code map

| Path                              | Responsibility                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/lib/world.ts`                | World setups, RP-signed requests, byte-preserving proof verification, code derivation               |
| `src/lib/passkey.ts`              | Passkey registration and entry checks (server)                                                      |
| `src/lib/passkey-code.ts`         | Passkey codes and WebAuthn challenges, shared by server and browser                                 |
| `src/lib/service.ts`              | Drops, entries, permits, draws, settlement, pickup, public records; every lottery rule              |
| `src/lib/domain.ts`               | Codes, the chance formula, the weighted draw, canonical JSON                                        |
| `src/lib/sui.ts`                  | Server-only Sui client: series, drops, registration, permits, draw and settle, reading the chain    |
| `src/lib/sui-draw.ts`             | Pure re-run of `ballot::settle` and the permit bytes, used by the server, the browser and the tests |
| `src/lib/db.ts`, `db/schema.sql`  | Postgres or PGlite, and the additive schema                                                         |
| `src/lib/http.ts`                 | Response handling, bounded bodies, origin and admin checks                                          |
| `src/components/drop-actions.tsx` | The entry card: World ID, passkey step, wallet, receipts and refusals                               |
| `src/components/passkey.ts`       | Browser passkey flow                                                                                |
| `src/components/world-widget.tsx` | The IDKit widget                                                                                    |
| `src/components/sui-wallet.tsx`   | dApp Kit wallet connection and the deposit transaction                                              |
| `move/tenjo/sources/ballot.move`  | Series, drops, entries, `draw`, `settle`, tickets                                                   |

## Identity

### World ID

- **Two setups.** The primary setup (`WORLD_*`) runs staging for World's simulator; the production setup (`WORLD_PRODUCTION_*`) takes real World IDs beside it. Each request records its setup, so a proof is checked against the setup that issued it, and each setup has its own identity lock.
- **Actions.** The simulator uses one fixed action (`tenjo-person`), so an identity keeps its code across drops. Real World IDs use `<action>-<drop id>`, because World ID 4 nullifiers are one-time: World App records a nullifier when it makes the proof and, from ten minutes later, refuses to prove that action again (the replay guard in World's WalletKit; the verify API itself accepts a repeat). So World refuses a second proof for the same drop, each drop sees a fresh code, and a paid entry finishes from the permit its browser kept instead of a second proof.
- **Replay resistance.** The signal is `purpose:drop:request`. The nonce, purpose, drop, signal, expiry, action and environment must all match, and the request is consumed inside the same transaction as the entry or pickup. An expired or used request can't create anything.
- **Verification result.** HTTP 200 or an overall success flag is never enough: the configured credential's own result must succeed with the same canonical nullifier. World outages and rate limits are reported as unavailable, not as refusals.
- **Credential pinning.** The first accepted entry pins the app, RP, action, environment, protocol and credential as a fingerprint. Changing any of them afterwards fails closed, because accepting two protocol versions or credentials without an identity migration would let one person hold two codes. Staging defaults to protocol 3.0 with the document legacy preset; production uses 4.0.
- **Pickup.** A fresh proof bound to `collect:<drop>:<request>` must resolve to a winning code, once. The client requests user presence, but a browser-reported flag is not attested liveness, so real-World-ID pickup stays off and the staging fallback records `untested-staging`.

### Codes

Every entry is recorded under a 32-hex anonymous code, the key for its pity count, its receipt and the on-chain ledger.

| Entrant                      | Code                                                                                              | Carries across drops    |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------- |
| Simulator (fixed action)     | `sha256("tenjo:v1:<app>:<action>:<protocol>:<nullifier>")`, nullifier as a padded 256-bit integer | Yes                     |
| Real World ID, no passkey    | The same formula; the nullifier differs in every drop                                             | No                      |
| Real World ID with a passkey | `sha256("tenjo:v1:passkey:<credential ID>")`                                                      | Yes                     |
| Local demo identity          | `sha256("tenjo:local-demo:<identity>")`                                                           | Yes, in demo drops only |

All codes are truncated to 32 hex characters. Canonicalising the nullifier stops casing and leading zeros from splitting one identity. No raw nullifier is stored.

### Passkeys

World ID answers "is this a unique person who hasn't entered this drop?". For real World IDs it can't answer "is this the fan who lost last time?", because per-drop nullifiers are unlinkable by design. A passkey carries that continuity, and World ID stays the only gate.

1. **Registration.** `registerPasskey` (`POST /api/passkeys`) needs an open, unused real-World-ID request for the drop. The WebAuthn challenge is `sha256("tenjo:passkey:create:v1:<drop>:<request>")`, so a registration can't be replayed. Attestation is `none`: Tenjō stores the public key (COSE), the signature counter, the code and the request it was created in (`created_challenge`), and nothing about the person.
2. **One prompt on first use.** Creating the passkey counts as the proof for the entry whose request it was created in (`{created}` in the header).
3. **Later entries.** The passkey signs `sha256("tenjo:passkey:get:v1:<drop>:<request>")` (`{assertion}`), verified against the site's origin and host name (`APP_ORIGIN`, or the Host header locally). The counter must not go backwards.
4. **Order.** `passkeyForEntry` runs before `verifyWorldProof` and refuses an unknown passkey, a bad signature and a passkey that already entered the drop, all without spending the World ID proof.
5. **Only real World IDs link.** `linkPasskey` swaps the code only for production-setup identities; the simulator and demo identities keep their own.
6. **Browser.** `src/components/passkey.ts` remembers the credential ID in `localStorage` and signs with it directly. A browser that remembers none asks first (**Use my passkey** or **Create a passkey**): "use" lets the device offer any Tenjō passkey it holds (discoverable credentials), so a fan who cleared their browser data, or brings a passkey synced from another device, keeps their losses instead of starting over. The question runs the passkey prompt from the fan's tap, which browsers that need a fresh gesture expect. A cancelled or failed prompt offers a retry, the other option, or World ID alone.

### One person, one entry

- **Per drop, per person.** `entry_identities` keeps each drop's World ID code beside the code the entry uses. `admit` refuses the same person with another passkey, or none (`already_entered`, pointing to the first entry), inside the entry transaction. World refuses the same person's second proof first.
- **Per drop, per code.** The entries table has one row per drop and code, and the Move contract refuses a repeat code in a drop. Another person with the same passkey gets `passkey_in_use`, before World is asked and again inside the transaction.
- **Concurrency.** Mutations lock the series, then the drop, and re-read the database clock after locking. Unique constraints back up every refusal.

## The lottery

- **Chances.** `1 + min(5, losses in this series since the last win)`, captured at entry. Only a settled draw changes a count.
- **One unsettled drop per series**, so weights can't go stale and counts can't update out of order.
- **Server draw** (a local run without Sui, or seeded setup history): weighted selection without replacement with Node's `crypto.randomInt`; a winner's whole weight leaves the pool. Draw and settlement commit together; retries return the committed record.
- **Undersubscription.** `min(items, entrants)` winners; unallocated items are recorded; an empty drop settles with none.
- **Draw record.** Every weight, roll and remaining pool, before and after counts, and a SHA-256 fingerprint over key-sorted JSON (`canonicalJson`), so Postgres `jsonb` key order doesn't break it. The fingerprint supports comparison, not proof of fair randomness: for drops off Sui, the operator is still trusted.

## Sui

Implemented in `move/tenjo` (`tenjo::ballot`, Move 2024), `src/lib/sui.ts` and `src/lib/sui-draw.ts`. Published on testnet on 26 September 2026 as `0x0d0f…3a65` and smoke-tested end to end there ([OPERATIONS](OPERATIONS.md#sui)). The UI never fabricates explorer links, and omits them for localnet.

1. **Objects.** `OrganiserCap` is minted to the publisher. A shared `Series` holds the name, the registrar's Ed25519 public key, the loss ledger (`Table<code, u64>`, absent means 0) and `active_drop`. A shared `Drop<T>` is an escrow vault over any coin type, with entries `{code, chances, payer, paid}`, a duplicate table, a `Balance<T>`, the seed, the winners and a settled flag. `Ticket` has `key` only, so it can't be transferred.
2. **Two entry paths.** `register` (organiser, free drops only) follows the server's World check. `enter` (fan-signed) needs a deposit equal to the price and a permit. Both compute `chances = 1 + min(5, losses)` from the ledger and refuse repeats, entries at or after close and a 301st entrant.
3. **The permit** is the registrar's signature over `b"tenjo:enter:v1" ‖ drop ID ‖ code ‖ sender address`. `ballot::enter` rebuilds it with the transaction's actual sender, so a permit works for one wallet, one drop and one code, and a copied permit fails for anyone else. Test vectors come from `@mysten/sui` (`scripts/sui-test-vectors.ts`).
4. **Commit, then settle.** `draw` is a non-public `entry` function taking `&Random`: after close, once, it only stores a 32-byte seed, so its gas never depends on the outcome and an unlucky result can't be aborted. `settle` is public and deterministic from the seed, so anyone can finish a drawn drop and nobody can reroll it.
5. **Algorithm.** For pick `i`: `roll = u64_le(blake2b256(seed ‖ bcs(i))[0..8]) % remaining_chances`; walk the unpicked entries in entry order and pick the first whose running total exceeds the roll. `chainDraw` reproduces it exactly and is tested against the Move vectors and a real settlement.
6. **One settlement.** Winners reset to 0 and losers gain 1. The winners' deposits go to the payout address as one coin, each loser is refunded, and each winner with a payer gets a `Ticket`. The `Settled` event carries the seed, the winners, the rolls, the pools and every entry's losses before and after.
7. **Chain authority.** The database mirrors the chain's entries, weights, winners and ledger in one transaction under the series and drop locks, and records whether recomputing from the seed reproduced the chain (`verified`). A drawn but unmirrored drop is completed by rereading the chain.
8. **One ledger per series.** A series joins Sui only before its first drop; seeded setup history stays off-chain because its scripted picks can't be reproduced on-chain. A republished package needs new series.
9. **Free-entry resilience.** The entry commits before registration; the chain closes 30 seconds after the database, so last-second entries land.
10. **Serialised organiser transactions** (a Postgres advisory lock plus an in-process queue), so the gas coin and cap never race. Aborts are classified from the gas simulation before any gas is spent.

## Data model

| Table                   | Purpose                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| `members`               | One row per anonymous code; no contact details                                    |
| `series`                | Related drops, with their Sui series and package                                  |
| `drops`                 | Item, quantity, schedule, state, price, demo/setup labels and chain references    |
| `entries`               | One row per drop and code: chances, Sui status and transaction, payer and deposit |
| `results`               | Outcome, pick order, losses before and after                                      |
| `pity`                  | Current losses per series and code                                                |
| `pickups`               | At most one pickup per winning code and drop, with its presence classification    |
| `draw_records`          | The full draw record and its fingerprint                                          |
| `challenges`            | World ID requests: nonce, drop, purpose, setup, expiry and use                    |
| `identity_policy`       | The primary setup's pinned identity settings                                      |
| `identity_policy_modes` | The same for the real-World-ID setup                                              |
| `entry_identities`      | Each drop's World ID code beside the code its entry uses                          |
| `passkeys`              | Each passkey's public key, counter, code and the request it was created in        |
| `proof_log`             | Purpose, outcome, duration and time of every verification; no proof or identity   |

A drop is stored as `open` and its timestamps decide eligibility; a successful draw moves it straight to `settled`.

## HTTP interface

| Endpoint                      | Purpose                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST /api/rp-signature`      | A World ID request for a drop, a purpose (`enter`, `collect`) and a setup (`primary`, `production`) |
| `POST /api/passkeys`          | Register a passkey created for a real-World-ID entry request                                        |
| `POST /api/drops/:id/enter`   | Verify a proof (and passkey) and save a free entry                                                  |
| `POST /api/drops/:id/permit`  | Verify a proof (and passkey) and sign a deposit permit for the wallet in `x-tenjo-sui-address`      |
| `POST /api/drops/:id/confirm` | Mirror a deposit from its Sui transaction digest                                                    |
| `POST /api/drops/:id/draw`    | Draw and settle after close, or return the committed record                                         |
| `POST /api/drops/:id/collect` | Verify a winner's fresh proof and record the pickup                                                 |
| `GET /api/drops/:id/public`   | Entries, winners, the draw record and Sui evidence, paginated                                       |
| `GET /api/codes/:code`        | A code's history and per-series counts                                                              |
| `POST /api/admin/drops`       | Create a drop (`Authorization: Bearer <ADMIN_PASSWORD>`)                                            |
| `POST /api/demo/:id`          | Local demo identities only: `TENJO_DEMO_MODE`, non-production, localhost                            |

Every mutation checks the origin. Request headers: `x-tenjo-challenge` (the World ID request), `x-tenjo-passkey` (base64url JSON `{created}` or `{assertion}`) and `x-tenjo-sui-address` (the paying wallet).

## Security and privacy boundaries

- **Stored identity data**: anonymous codes, passkey public keys and per-drop World ID codes. No names, emails, phone numbers, raw proofs or raw nullifiers.
- **Codes are public and linkable** across drops and series, including passkey codes. The UI says so; series-scoped codes are an open decision.
- **Secrets stay on the server**: database, World signing keys and the Sui key. Tenjō itself keeps only a passkey's credential ID in browser storage.
- **Origin and size limits** on every mutation, uniqueness in the database, locks around every rule, and no partial state on dependency failure.
- **Admin** uses a timing-safe comparison of a server password, with no session.
- **Local demo routes** need the demo flag, a non-production build, no Vercel environment and localhost; they work only on demo drops and use their own code namespace.
- **Operator trust.** Off-chain drops trust the server and database operator; drops on Sui take the seed, weights, winners, money and ledger from the chain.

## Decisions

| Decision                                                        | Why                                                                                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verify proofs on the server, forwarding the exact bytes         | Browser success is forgeable, and remapping fields risks verifying something the fan didn't prove                                                            |
| Passport credential, Orb for real World IDs                     | Entry needs uniqueness, not identity; the simulator offers passport, and real World IDs are Orb-verified                                                     |
| One action per drop for real World IDs                          | World ID 4 nullifiers are single-use per action; a shared action would refuse a person's second drop                                                         |
| A passkey for returning real World IDs                          | It needs no wallet, extension or network, works on every modern phone, syncs across a fan's devices, and can't add entries                                   |
| Not a wallet link                                               | Slush's web wallet is blocked in Japan, and a wallet is easy to hand over. An earlier version linked wallets and was withdrawn                               |
| Not World ID session proofs, yet                                | They would bind pity to the person, but server verification is undocumented, they add a second World App prompt, and simulator support is unknown            |
| Not a browser-only key, blind-signed tokens or our own ZK group | A browser key is lost with site data; tokens can be traded unless bound to a secret; a ZK group verified on Sui is days of work and changes the ledger model |
| The chain decides on-chain drops; Postgres mirrors              | Randomness, money and counts need no trust on Sui; the mirror keeps pages fast and the public record searchable                                              |
| Commit, then settle                                             | Sui's randomness guidance: a result can't be seen and then rejected                                                                                          |
| Free entries registered after commit                            | A Sui outage never loses an entry; `pending` entries retry                                                                                                   |
| Explicit hosted migrations                                      | Serverless functions shouldn't race to alter the schema; the schema is additive so reruns are safe                                                           |

## Known limits

- A shared passkey hands over pity (never entries); a lost passkey starts fresh; passkeys are bound to the host name; some in-app browsers lack WebAuthn.
- Paid-drop testers in Japan need a Sui wallet extension or a wallet app's browser.
- Real-World-ID pickup waits for server-attested liveness.
- Two identity documents could mean two World IDs; this is a known limit of document credentials.
- No cancellation or pre-draw refund; anyone may draw and settle after close, so the organiser alone can't strand deposits.
- One organiser cap, no registrar rotation, only SUI deposits wired although `Drop<T>` is generic, and digest recovery scans the latest 50 events.

## Sources checked

- [World ID: integrate IDKit](https://docs.world.org/world-id/idkit/integrate): actions, nullifiers, server verification and staging.
- [Developer Portal: verify](https://docs.world.org/api-reference/developer-portal/verify): per-credential results and the expected environment.
- [World ID: credentials](https://docs.world.org/world-id/idkit/credentials): presets and the user-presence request.
- [World ID: session proofs](https://docs.world.org/world-id/idkit/session-proofs): considered for cross-drop identity.
- Installed IDKit 4.3.0, `@simplewebauthn` 14 and `@mysten/sui` type definitions: the actual interfaces.
- Next.js docs installed under `node_modules/next/dist/docs`: route handlers, server and client boundaries, async params and Webpack builds.

The SDK exposes separate Passport and My Number Card presets; My Number Card compatibility with the passport path is untested.
