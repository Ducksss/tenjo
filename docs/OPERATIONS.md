# Operations and integration guide

**One person, one entry, and every loss counts.**

A free drop lottery built from scratch for the September 2026 hackathon. World ID gates entry and pickup; each loss adds a ticket to the next drop in the same series, capped at six total. The public record shows anonymous entries, ticket weights, draws and loss changes.

**Current status:** Phase 1 application and a working local demonstration. The World ID request/verification integration is implemented and tested with mocked verifier responses, but **no real simulator proof has been verified yet**: app/RP/signing credentials are missing. Production pickup is deliberately blocked pending server-attested liveness. **Sui escrow drops (randomness, loss ledger, deposits and refunds) are implemented and tested locally; the testnet publish is pending funding** (see [Sui](#sui)). Video and submission are not complete. Hosting is live at [tenjo-azure.vercel.app](https://tenjo-azure.vercel.app); World credentials are still required for real entries. No fabricated World successes, transactions or explorer links.

The hosted `/demo` route is an interactive, browser-only walkthrough with scripted outcomes. It makes no lottery API writes and does not verify World ID; real production records remain separate.

## Run the local demo

Requires Node 22+ and npm.

```sh
npm ci
npm run demo:seed
npm run dev:demo
```

Open [the local app](http://127.0.0.1:3000). Choose **The weekend console drop**. Fan A has three losses from labelled setup draws and receives four tickets. Enter again to see duplicate refusal; follow the receipt to public history. The default demo closes 24 hours after setup.

PGlite persists local Postgres data in `.data/tenjo`. The seed is idempotent and does not erase data. **Stop the dev server before running a script on the same database directory**; PGlite is single-process.

For a fresh short rehearsal, stop the dev server and run:

```sh
npm run demo:rehearsal
```

The command creates a new isolated database and prints the exact launch command. Entries close after two minutes. Fan A still has three setup losses. Enter A, demonstrate the duplicate refusal, wait for close, confirm the draw, then pick a winning/losing demo identity for pickup. Starting a new rehearsal preserves all earlier records.

The local demo uses test identities, **not** World's simulator. It performs no World ID verification or live selfie. Demo controls require an explicit flag, localhost and non-production; they cannot enter real drops. Use World staging for the actual judging run.

## Configure World staging and a real drop

Copy `.env.example` to `.env.local`. Fill these values from [World Developer Portal](https://developer.world.org):

```dotenv
WORLD_APP_ID=app_...
WORLD_RP_ID=rp_...
WORLD_ACTION=tenjo-person
WORLD_RP_SIGNING_KEY=0x...
WORLD_ENVIRONMENT=staging
WORLD_PROTOCOL=3.0
WORLD_CREDENTIAL=passport
ADMIN_PASSWORD=use-a-unique-password-of-at-least-16-characters
```

Never expose the signing key with a `NEXT_PUBLIC_` prefix or commit it. Restart `npm run dev`, open `/admin`, create a **new real drop** and enter through IDKit using [World's simulator](https://simulator.worldcoin.org). Staging requests use the document legacy preset and allow legacy proofs. If World's booth confirms document support is unavailable, select `WORLD_CREDENTIAL=orb` **before accepting any real entries**.

World verifies staging proofs only while the team keeps a staging window open; otherwise it answers `403 environment_not_allowed` and entries fail with "World's staging verification window is closed". The portal has no button for it yet. Create a team API key (**Team settings → API keys**), then run `npm run world:staging-window` and paste the key at the hidden prompt. The script calls the Developer Portal MCP tool `set_world_id_staging_verification`, opens a 24-hour window and writes the one-time token to `.env.local` as `WORLD_STAGING_VERIFICATION_TOKEN`; it never prints the key or the token. Set the same token on Vercel and redeploy; the server sends it as the `x-staging-verification-token` header. When the window lapses, run the script again and replace the token everywhere. `npm run world:staging-window -- --close` closes the window early. Production proofs need no window.

Keep one fixed action. Do not rotate app, RP, action, environment, protocol or credential after accepting entries; a stored policy fingerprint refuses the change. A protocol/credential migration needs identity reconciliation or a fresh database.

Trust moments:

- **Entry:** server verifies the configured credential, action, environment, nonce, fresh challenge and purpose-bound signal before creating a member/entry. One canonical code per verified nullifier, unique per drop.
- **Pickup:** require a fresh proof of the winning identity and allow exactly one pickup. The client requests user presence, but a browser-reported boolean is not treated as a cryptographic guarantee.

The passport credential follows the PRD's document-backed anti-multi-accounting choice; Selfie Check alone does not provide its required uniqueness assurance. Proof of Human is the explicit fallback. Passport/My Number Card equivalence and actual simulator behavior still need testing against the chosen credential. The PRD accepts a dual-document limitation.

`WORLD_ALLOW_UNTESTED_PICKUP=true` permits the PRD's **staging-only** pickup fallback. It still verifies a fresh World proof, but every pickup is recorded as liveness untested. Production pickup stays disabled until the server-attested presence path is validated.

### Verification code

The server verifier is [`verifyWorldProof` in src/lib/world.ts](../src/lib/world.ts). The byte-preserving verification boundary is at **src/lib/world.ts:284–286** in this version. Find it after future edits with:

```sh
rg -n 'verification boundary|developer.world.org/api/v4/verify' src/lib/world.ts
```

The enter route [`src/app/api/drops/[id]/enter/route.ts`](../src/app/api/drops/[id]/enter/route.ts) calls it before `enterDrop`. The received body is forwarded **byte for byte**, without field remapping. HTTP 200 alone is insufficient: the expected credential must be individually verified with the matching nullifier, action and environment. The challenge is consumed atomically with entry/pickup.

## Postgres and deployment

For hosted Postgres, set `DATABASE_URL`, using the provider's TLS connection string, then:

```sh
npm run db:migrate
npm run build
npm start
```

On Vercel, configure the World variables, ADMIN_PASSWORD, DATABASE_URL and `APP_ORIGIN=https://your-deployment.example`. Run migrations against that database before deployment. Do not use PGlite in serverless production. Keep all database credentials server-only and do not grant public/anonymous roles writes to these tables. Tenjō is deployed to [Vercel](https://tenjo-azure.vercel.app), project `ducksss-projects/tenjo`, with a dedicated Neon Free Postgres database (`tenjo-db`) in Singapore. The schema has been applied. Production starts empty; local setup identities and records were not copied. Vercel stores `DATABASE_URL`, `ADMIN_PASSWORD`, `APP_ORIGIN` and the World staging configuration: `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY` (Sensitive), `WORLD_ACTION=tenjo-person`, `WORLD_ENVIRONMENT=staging`, `WORLD_PROTOCOL=3.0` and `WORLD_CREDENTIAL=passport`, plus `WORLD_STAGING_VERIFICATION_TOKEN` while a staging window is open. Keep the organiser password private; never put it into documentation or a public issue. With the staging environment, the live site accepts proofs from World's simulator, not World App on real phones, and the `tenjo-person` action must exist on the app in the Developer Portal. `WORLD_ALLOW_UNTESTED_PICKUP=true` turns on the staging pickup fallback, so every pickup is recorded as liveness untested. Vercel applies variable changes only to new deployments, so redeploy production after changing any of them.

`vercel.json` selects the Singapore function region and the existing production build command. `.vercelignore` excludes local data, secrets and development artifacts. The GitHub repository is connected for automatic deployments; production configuration currently belongs to the production environment, not preview deployments.

`npm run build` uses supported Next.js Webpack mode because this local tool environment denied Turbopack's CSS worker port. Development still uses Turbopack. There are no network-loaded fonts.

## Sui

**Status:** the `tenjo::ballot` Move package, server integration and paid-entry API are implemented and tested (Move unit tests, mocked-chain service tests and a full run on a local Sui network). **Testnet: not deployed yet** — the organiser address `0x2700344d3b6accedebabda56e819b769be2246be4c438434f37ffb0b81c6783c` is waiting for testnet SUI, so there are no testnet digests or explorer links yet.

On Sui a drop is an escrow vault. A **series** object holds the loss ledger; a **drop** holds each entry's weight and deposit. Free drops: after World ID verification the server registers the entry on-chain and pays the gas. Priced drops: the fan's wallet locks a refundable deposit, admitted by a permit the server signs after verification. After close, `ballot::draw` commits a 32-byte seed from `sui::random`; `ballot::settle` then picks the winners from that seed and, in the same transaction, pays the organiser for the winners' seats, refunds every loser, mints each winner a non-transferable `Ticket` and updates the ledger. The database mirrors the chain's result.

| Variable                   | Purpose                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `SUI_NETWORK`              | `testnet` (default), `devnet`, `mainnet` or `localnet`                                  |
| `SUI_RPC_URL`              | Optional gRPC endpoint; defaults to `https://fullnode.<network>.sui.io:443`             |
| `SUI_PACKAGE_ID`           | Published package, printed by `npm run sui:publish`                                     |
| `SUI_ORGANISER_CAP_ID`     | `OrganiserCap` owned by the organiser key, printed by `npm run sui:publish`             |
| `SUI_SECRET_KEY`           | Organiser key, `suiprivkey…` (Ed25519). Server-only; Sensitive on Vercel                |
| `SUI_REGISTRAR_SECRET_KEY` | Optional Ed25519 key that signs entry permits; defaults to the organiser key            |
| `SUI_PAYOUT_ADDRESS`       | Optional address that receives the winners' deposits; defaults to the organiser address |

Sui switches on only when the package, the cap and the key are all set. Otherwise every drop uses the server draw exactly as before. Browser tests blank every `SUI_*` variable.

### Publish

```sh
sui client new-address ed25519 tenjo-organiser   # fund it with ~3 testnet SUI at faucet.sui.io
# Put SUI_SECRET_KEY=<the suiprivkey… from `sui keytool export --key-identity tenjo-organiser`> in .env.local
npm run sui:test                                 # Move unit tests
npm run sui:publish -- --write-env               # publishes; writes SUI_PACKAGE_ID and SUI_ORGANISER_CAP_ID
npm run sui:smoke                                # end-to-end check: prints every digest and Suiscan link
```

**Before deploying this version anywhere hosted, run `npm run db:migrate` against that database**, even without Sui: queries read the new, additive Sui columns. To switch Sui on there, add the same variables to Vercel and redeploy.

### Rehearse the paid demo

```sh
npm run sui:demo-drop -- --live-drop   # stop the dev server first; add --fresh to start new series
npm run dev:demo
```

Round 1 of the labelled Capsule Shop demo is entered by six throwaway fan wallets (funded with 0.05 SUI each, keys in the Git-ignored `.data/demo-wallets.json`) and settled at once, so four fans carry an on-chain loss. Round 2 is entered by the same fans with those losses counted, and closes after `--closes-in` seconds (default 180) for a live **Run draw**. `--live-drop` adds a real drop, "Tokyo Dome · Night 2", for entry with World ID and a wallet.

### Verify on the explorer

Every drop on Sui exposes its object IDs and transaction digests through `/api/drops/:id/public` (`sui`) and its draw record (`record.sui`). Open `https://suiscan.xyz/testnet/tx/<digest>` or `https://suiscan.xyz/testnet/object/<id>`. The settle transaction's balance changes show the payout and each refund; its `Settled` event lists the seed, winners in pick order, rolls, pools and every entry's losses before and after. Anyone can recompute the winners from the seed with `chainDraw` in `src/lib/sui-draw.ts`.

### Rules on-chain

- Only a series that starts on Sui joins it, so the chain ledger holds its whole history. Seeded setup history stays off-chain, and a series on Sui refuses new drops while Sui is not configured.
- The chain accepts entries until 30 seconds after the database closes, so last-second registrations land. The draw opens after that.
- A free entry is saved first, then registered on-chain. If Sui fails, it stays `pending` and is retried by the next entry and before the draw. An entry that never reaches Sui gets no result and is listed in `record.sui.unregistered`.
- Organiser transactions run one at a time (a database advisory lock plus an in-process queue), so gas coins never race.
- Retrying a draw repeats only the missing chain step and never rerolls. A mirror lost after settlement is recovered from the chain.
- Gas measured on a local network: a six-fan settlement costs about 0.01 SUI. The worst case, 300 entrants and 300 items, fits in one transaction: 0.63 SUI computation and 0.72 SUI storage (0.15 SUI rebate).
- Testnet SUI only. There are no real-money or mainnet payments.

## Draw and audit rules

- Tickets = `1 + min(5, series losses)`.
- Select without replacement using Node `crypto.randomInt`: a winner's entire weight leaves the pool.
- Only after closing time; database clock is checked after acquiring the mutation lock.
- One unsettled drop per series prevents stale weights and out-of-order counts.
- Draw and settlement commit together: losers increment, winners reset, receipt stores before/after counts.
- Concurrent/repeated draws return the same committed record; failed transactions make no partial changes.
- If entrants are fewer than items, each entrant wins once; unused items are recorded. Empty drops settle with no winners.
- `/api/drops/:id/public` includes the complete draw record and a page of entries. `/api/codes/:code` returns a page of history and series counts. UI pages contain search and pagination.

A record fingerprint uses SHA-256 over recursively key-sorted JSON (`canonicalJson` in `src/lib/domain.ts`). This survives Postgres jsonb reordering. It is **not proof of independent randomness or tamper-proof storage**. Phase 1 still trusts the server/database operator. For drops on Sui, the seed, weights, winners and ledger come from the chain instead (see [Sui](#sui)).

See [PRD](PRD.md), [implementation decisions](IMPLEMENTATION.md), [design](../DESIGN.md) and [UX contract](../UX-CONTRACT.md).

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run format:check
```

Browser tests launch an isolated local database and server on port 3100, with a separate `.next-e2e` directory. They use installed Playwright Chromium. If needed, install the browser once with `npx playwright install chromium`.

Tests cover weighted probabilities/cap, nullifier normalization, duplicate entry races, early draw, settlement idempotency, cross-series counts, wrong identity, duplicate pickup, exact proof forwarding, nonce/signal/action/environment/credential verification, partial verifier success, replay, dependency failure, bounded payloads, admin access and fail-closed World configuration. Browser flows check real rendered receipts/history, confirmations/refusals, desktop (1440×1000), mobile (390×844) and page overflow. Mocked verification does not replace a real simulator acceptance test.

## World integration debrief (in progress)

| Item                                       | Observed evidence                                                                                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build integration start                    | Sep 25, 2026, approximately 23:22 JST; dependency/doc investigation started in this task                                                                                      |
| First real server-verified simulator proof | **Pending credentials — not yet achieved**                                                                                                                                    |
| Time to first success                      | **Not measurable yet**; mock tests and local identity controls do not count                                                                                                   |
| Friction                                   | Must reconcile docs and actual 4.3.0 exports, distinguish staging legacy/v4 identities, and validate each credential in a possibly partial verify result                      |
| Missing clarification                      | Server-verifiable presence enforcement, simulator passport support, My Number Card/preset behavior and cross-version identity reconciliation                                  |
| Highest-value improvement                  | An official Next.js staging example covering repeat proofs with a stable identity, byte-preserving server verification, document fallback and server-attested pickup liveness |

Every real verification attempt records only purpose, category, elapsed milliseconds and timestamp in `proof_log`; no proof contents or identity. Once configured, set `WORLD_INTEGRATION_STARTED_AT` to the actual start timestamp and run `npm run world:debrief` (stop the local PGlite server first). Record the first real success and booth answers here; do not substitute test timings.

## Remaining submission work

- [ ] Complete real World simulator success and refusal; resolve passport/Orb choice.
- [ ] Validate liveness or explicitly show the staging fallback.
- [x] Provision hosted Postgres and deploy to Vercel.
- [x] Phase 2: Sui Move package, registration, randomness, settlement, deposits/refunds and database mirror (tested on a local Sui network).
- [ ] **Sui testnet publish: pending funding.** Package ID and explorer links: not available yet.
- [ ] Stretch: unclaimed-item handoff, only after both phase gates pass.
- [ ] Two clean four-minute rehearsals, recording, measured debrief and ETHGlobal submission.
- [ ] @Chai decides project replacement, series-scoped privacy and prize scope.
