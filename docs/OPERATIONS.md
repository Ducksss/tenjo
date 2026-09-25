# Operations and integration guide

**One person, one entry, and every loss counts.**

A free drop lottery built from scratch for the September 2026 hackathon. World ID gates entry and pickup; each loss adds a ticket to the next drop in the same series, capped at six total. The public record shows anonymous entries, ticket weights, draws and loss changes.

**Current status:** Phase 1 application and a working local demonstration. The World ID request/verification integration is implemented and tested with mocked verifier responses, but **no real simulator proof has been verified yet**: app/RP/signing credentials are missing. Production pickup is deliberately blocked pending server-attested liveness. **Sui Phase 2, deposits, hosting, video and submission are not complete.** No fabricated World successes, transactions or explorer links.

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

On Vercel, configure the World variables, ADMIN_PASSWORD, DATABASE_URL and `APP_ORIGIN=https://your-deployment.example`. Run migrations against that database before deployment. Do not use PGlite in serverless production. Keep all database credentials server-only and do not grant public/anonymous roles writes to these tables. No cloud database has been provisioned or deployment performed by this build.

`npm run build` uses supported Next.js Webpack mode because this local tool environment denied Turbopack's CSS worker port. Development still uses Turbopack. There are no network-loaded fonts.

## Draw and audit rules

- Tickets = `1 + min(5, series losses)`.
- Select without replacement using Node `crypto.randomInt`: a winner's entire weight leaves the pool.
- Only after closing time; database clock is checked after acquiring the mutation lock.
- One unsettled drop per series prevents stale weights and out-of-order counts.
- Draw and settlement commit together: losers increment, winners reset, receipt stores before/after counts.
- Concurrent/repeated draws return the same committed record; failed transactions make no partial changes.
- If entrants are fewer than items, each entrant wins once; unused items are recorded. Empty drops settle with no winners.
- `/api/drops/:id/public` includes the complete draw record and a page of entries. `/api/codes/:code` returns a page of history and series counts. UI pages contain search and pagination.

A record fingerprint uses SHA-256 over recursively key-sorted JSON (`canonicalJson` in `src/lib/domain.ts`). This survives Postgres jsonb reordering. It is **not proof of independent randomness or tamper-proof storage**. Phase 1 still trusts the server/database operator. Sui is the intended trust reduction, not an existing capability.

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
- [ ] Provision hosted Postgres and deploy.
- [ ] Phase 2: Sui Move package, testnet publish, registration, randomness, settlement and database mirror.
- [ ] **Sui package ID: not deployed.** Explorer links: not available.
- [ ] Stretch deposits/refunds and unclaimed handoff only after both phase gates pass.
- [ ] Two clean four-minute rehearsals, recording, measured debrief and ETHGlobal submission.
- [ ] @Chai decides project replacement, series-scoped privacy and prize scope.
