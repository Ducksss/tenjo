# Operations guide

How to run, configure, deploy and check Tenjō. How it works inside is in [IMPLEMENTATION.md](IMPLEMENTATION.md); what it must do is in [PRD.md](PRD.md).

## At a glance

|                |                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live site      | [tenjo-azure.vercel.app](https://tenjo-azure.vercel.app): Vercel project `ducksss-projects/tenjo`, functions in Singapore (`sin1`)                                                                                     |
| Database       | Neon Postgres `tenjo-db`, Singapore                                                                                                                                                                                    |
| World ID       | A staging app for World's simulator (passport credential), and a production app for real World IDs (Orb, Proof of Human)                                                                                               |
| Sui            | Testnet package [`0x0d0f…3a65`](https://suiscan.xyz/testnet/object/0x0d0fd7d2dbedc277136bb41c3efc1048d1a2158197183899cda6a57a327b3a65), organiser `0x2700344d3b6accedebabda56e819b769be2246be4c438434f37ffb0b81c6783c` |
| Returning fans | The simulator keeps one code, so its losses carry on their own; real World IDs carry theirs with a passkey                                                                                                             |
| Deploys        | Every push to `main` deploys production                                                                                                                                                                                |

As of 27 September 2026: 17 World ID entries verified on production (see the [debrief](#world-integration-debrief)), draws, deposits and refunds settle on Sui testnet, and real World IDs keep their extra chances with a passkey (first real passkey entry at 01:21 JST). Real-World-ID pickup stays off until liveness is server-attested; simulator winners collect through the labelled staging fallback.

## Run it locally

Requires Node 22+ and npm. Run `npm ci` after every pull: dependencies change, and a stale install serves "Module not found" errors.

### Demo mode: no credentials

```sh
npm ci
npm run demo:seed
npm run dev:demo
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) and choose **The weekend console drop**. Fan A has three losses from labelled setup draws and gets four chances. Enter again to see the duplicate refusal, then follow the receipt to the public history. The seeded drop closes 24 hours after setup (`TENJO_DEMO_WINDOW_SECONDS` changes it).

For a fresh two-minute rehearsal, stop the dev server and run `npm run demo:rehearsal`: it creates an isolated database, prints the launch command and closes entries after two minutes. Earlier records are kept.

Demo mode uses labelled test identities, **not** World's simulator: no World ID check, no live selfie. Its controls need `TENJO_DEMO_MODE=true`, a non-production build and localhost, and they only work on demo drops.

PGlite keeps local data in `.data/tenjo`, and it allows one process at a time: **stop the dev server before running a script on the same database.**

### With World ID and Sui

1. Copy `.env.example` to `.env.local` and fill in the World and Sui values ([configuration](#configuration)).
2. Run `npm run dev` and open **[http://localhost:3000](http://localhost:3000)**. Use `localhost`, not `127.0.0.1`: passkeys need a host name.
3. Create a drop at `/admin` with the organiser password, then enter it with World's [simulator](https://simulator.worldcoin.org) or a real World ID.

Without `DATABASE_URL`, local runs use PGlite and apply `db/schema.sql` on start.

## Configuration

Every variable is server-only. Never give a secret a `NEXT_PUBLIC_` prefix or commit `.env.local`.

| Variable                                                                               | Purpose                                                                                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `APP_ORIGIN`                                                                           | The site's exact origin (`https://tenjo-azure.vercel.app`). Same-origin checks and passkeys both use it. Optional locally |
| `DATABASE_URL`                                                                         | Hosted Postgres. Omit locally to use PGlite                                                                               |
| `TENJO_LOCAL_DB`                                                                       | Another PGlite directory, for tests and rehearsals                                                                        |
| `ADMIN_PASSWORD`                                                                       | Organiser password, at least 16 characters, sent only in the `Authorization` header                                       |
| `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`                                  | The primary World setup. On production it runs staging, for the simulator                                                 |
| `WORLD_ACTION`                                                                         | The primary setup's fixed action, `tenjo-person`                                                                          |
| `WORLD_ENVIRONMENT`                                                                    | `staging` or `production`                                                                                                 |
| `WORLD_PROTOCOL`                                                                       | `3.0` or `4.0`; production always uses 4.0                                                                                |
| `WORLD_CREDENTIAL`                                                                     | `passport` (default) or `orb`                                                                                             |
| `WORLD_STAGING_VERIFICATION_TOKEN`                                                     | Token for World's 24-hour staging window ([below](#the-staging-verification-window))                                      |
| `WORLD_ALLOW_UNTESTED_PICKUP`                                                          | `true` turns on the staging-only pickup fallback                                                                          |
| `WORLD_PRODUCTION_APP_ID`, `WORLD_PRODUCTION_RP_ID`, `WORLD_PRODUCTION_RP_SIGNING_KEY` | Real World IDs beside the simulator. Used only while the primary setup is staging                                         |
| `WORLD_PRODUCTION_ACTION`                                                              | Base action for real World IDs; each drop uses `<action>-<drop id>`                                                       |
| `WORLD_PRODUCTION_CREDENTIAL`                                                          | `orb` (Proof of Human, default) or `passport`                                                                             |
| `WORLD_INTEGRATION_STARTED_AT`                                                         | ISO timestamp for the debrief's time to first success                                                                     |
| `SUI_NETWORK`                                                                          | `testnet` (default), `devnet`, `mainnet` or `localnet`                                                                    |
| `SUI_RPC_URL`                                                                          | Optional gRPC endpoint; defaults to `https://fullnode.<network>.sui.io:443`                                               |
| `SUI_PACKAGE_ID`, `SUI_ORGANISER_CAP_ID`                                               | Printed by `npm run sui:publish`                                                                                          |
| `SUI_SECRET_KEY`                                                                       | Organiser key, `suiprivkey…` (Ed25519)                                                                                    |
| `SUI_REGISTRAR_SECRET_KEY`                                                             | Optional key that signs entry permits; defaults to the organiser key                                                      |
| `SUI_PAYOUT_ADDRESS`                                                                   | Optional address for the winners' deposits; defaults to the organiser                                                     |
| `TENJO_DEMO_MODE`, `TENJO_DEMO_WINDOW_SECONDS`                                         | Local demo controls and the seeded drop's window                                                                          |
| `TENJO_TEST_PORT`                                                                      | Port for browser tests (default 3100)                                                                                     |

Sui switches on only when the package, the cap and the key are all set; otherwise every drop uses the server draw. On Vercel, the signing keys, the Sui key, `ADMIN_PASSWORD`, `APP_ORIGIN` and the staging token are Sensitive.

## World ID

### Two setups

The primary setup runs World's staging environment, so the live site accepts the [simulator](https://simulator.worldcoin.org). The `WORLD_PRODUCTION_*` setup accepts real World IDs from World App. With both configured, the drop page's **Enter with World ID** uses a real World ID, and **No World ID? Use the World ID simulator** uses the simulator. Pickup always uses the primary setup.

- **The simulator keeps one action** (`tenjo-person`), so the same identity gets the same code in every drop, and its losses carry.
- **Real World IDs get one action per drop** (`tenjo-person-<drop id>`), because World ID 4 lets a person prove each action only once. World itself then refuses a second entry in the same drop, and each drop sees a fresh code. A [passkey](#passkeys) carries the losses instead.

### The staging verification window

Since 25 September 2026, World's verify API refuses staging proofs (`403 environment_not_allowed`) unless the team keeps a 24-hour staging window open and sends its token. Entries then fail with "World's staging verification window is closed". To open one:

1. Create a team API key in the Developer Portal (**Team settings → API keys**).
2. Run `npm run world:staging-window` and paste the key at the hidden prompt. The script opens the window through World's `set_world_id_staging_verification` tool and writes `WORLD_STAGING_VERIFICATION_TOKEN` to `.env.local`, without printing the key or the token.
3. Set the same token on Vercel and redeploy. The server sends it as the `x-staging-verification-token` header.

Repeat when the window lapses. `npm run world:staging-window -- --close` closes it early. Real World IDs need no window.

### Identity settings lock

The first accepted entry pins each setup's app, RP, action, environment, protocol and credential as a fingerprint. Changing any of them afterwards fails closed with an identity-policy error: restore the settings or use a fresh database. Choose the credential (`passport` or `orb`) **before** real entries arrive.

### Pickup

Pickup needs a fresh World ID proof from a winning code, once. `WORLD_ALLOW_UNTESTED_PICKUP=true` turns on the staging-only fallback, and every such pickup is recorded as liveness untested. Pickup for real World IDs stays off until liveness is server-attested.

### Where the verification happens

[`verifyWorldProof` in src/lib/world.ts](../src/lib/world.ts) forwards the received proof **byte for byte** to `developer.world.org/api/v4/verify`, then checks the credential's own result, nullifier, action, environment, nonce and the purpose-bound signal. HTTP 200 alone is never enough. Find the boundary after edits with:

```sh
rg -n 'verification boundary|developer.world.org/api/v4/verify' src/lib/world.ts
```

## Passkeys

A real World ID gets a fresh code in every drop, so a passkey keeps one code for the fan. World ID still decides who may enter; the passkey decides whose losses an entry counts toward.

- **Fan flow.** When the site takes real World IDs and the browser supports passkeys, the entry card shows "Keep my extra chances with a passkey", ticked. The first entry creates a Tenjō passkey behind Face ID or a fingerprint; creating it is that entry's proof, so there is one prompt. Later entries sign the entry's World ID request. A cancelled prompt enters nothing and offers **Confirm passkey** or **Enter with World ID alone**. The simulator never asks for a passkey.
- **Storage.** `POST /api/passkeys` stores only the passkey's public key, its counter and the code its entries use, in `passkeys`. `entry_identities` keeps each drop's World ID code beside the entry's code, so one person still gets one entry per drop.
- **Configuration.** No new variables. Passkeys belong to the host name in `APP_ORIGIN`, so they don't carry across domains, preview URLs or `127.0.0.1`.
- **On a paid drop** the wallet only pays the deposit; the passkey carries the code.

How the checks work is in [IMPLEMENTATION.md](IMPLEMENTATION.md#passkeys).

## Sui

**Status:** live on testnet. Package [`0x0d0f…3a65`](https://suiscan.xyz/testnet/object/0x0d0fd7d2dbedc277136bb41c3efc1048d1a2158197183899cda6a57a327b3a65) was published on 26 September 2026 ([transaction](https://suiscan.xyz/testnet/tx/EbbQyCRbv9Xv5LMvTZxK78fEUGjV1e1Lym4tSDF7Pe3G)). `npm run sui:smoke` ran a free and a paid drop end to end there twice: the paid drop's [draw](https://suiscan.xyz/testnet/tx/8hCVmGFzq57mDy488F4bfha9AMdKc5qsYZt2vDAtHKdF) took its seed from `sui::random`, and its [settlement](https://suiscan.xyz/testnet/tx/DGAHZgteY7e1HMmmkCNsLwV67NzLqbGUoXN1Wci6RsuJ) paid the organiser 0.01 SUI and refunded the loser 0.01 SUI in one transaction. The second run ([draw](https://suiscan.xyz/testnet/tx/H9FXbahCWUCwLBQKK5uC4sfEnXvmydnLi6yBAcoDLgMY), [settlement](https://suiscan.xyz/testnet/tx/6QPjXre4j1cqqNzrivc3pH5jP3fVNYWe2Uh76ojD7jpE)) matched the on-chain ledger to the database again.

A drop on Sui is an escrow vault, and a series object holds the loss ledger. Free entries are registered on-chain by the server after World ID; paid entries are sent by the fan's wallet under a permit the server signs. After close, `ballot::draw` commits a seed from `sui::random` and `ballot::settle` picks the winners, pays the organiser, refunds every loser, mints each winner a non-transferable `Ticket` and updates the ledger, in one transaction. The database mirrors the result.

### Organiser wallet

Keep the organiser above 0.5 SUI. `sui client faucet` only prints a link for testnet now: open `https://faucet.sui.io/?address=<address>`, choose Testnet and press **Request Testnet SUI**. A check runs for about 30 seconds, then 1 SUI arrives. Public fullnodes no longer answer JSON-RPC, so check a balance through GraphQL:

```sh
curl -s https://graphql.testnet.sui.io/graphql -H 'content-type: application/json' \
  --data '{"query":"{ address(address: \"0x2700344d3b6accedebabda56e819b769be2246be4c438434f37ffb0b81c6783c\") { balance(coinType: \"0x2::sui::SUI\") { totalBalance } } }"}'
```

A smoke run costs about 0.05 SUI; a publish about 0.06 SUI.

### Publish, smoke-test and rehearse

```sh
sui client new-address ed25519 tenjo-organiser   # fund it at faucet.sui.io
# Put SUI_SECRET_KEY=<suiprivkey… from `sui keytool export --key-identity tenjo-organiser`> in .env.local
npm run sui:test                                 # Move unit tests
npm run sui:publish -- --write-env               # writes SUI_PACKAGE_ID and SUI_ORGANISER_CAP_ID
npm run sui:smoke                                # free and paid drop end to end, printing every Suiscan link
```

`sui:smoke` uses an in-memory database, so it never touches Postgres. A new package needs new series.

For the paid demo, stop the dev server and run `npm run sui:demo-drop -- --live-drop` (add `--fresh` for new series). Six throwaway fan wallets (0.05 SUI each, keys in the Git-ignored `.data/demo-wallets.json`) enter and settle **Nintendo Switch 2 · Pre-drop 1**, so four carry an on-chain loss; they enter **Pre-drop 2** with those losses counted, and it closes after `--closes-in` seconds (default 180) for a live **Run draw**. `--live-drop` adds an open **Taylor Swift · Tokyo Night 2** for entry with World ID and a wallet. Every demo drop says it is a demo, not affiliated with Nintendo or Taylor Swift.

### Rules on-chain

- A series joins Sui only before its first drop, so the chain ledger holds its whole history. Seeded setup history stays off-chain, and a series on Sui refuses new drops while Sui is off.
- A series takes one unsettled drop at a time.
- The chain accepts entries until 30 seconds after the database closes, so last-second entries land. The draw opens after that.
- A free entry is saved first, then registered on-chain. If Sui fails, it stays `pending` and is retried by the next entry and before the draw; an entry that never lands gets no result and is listed in `record.sui.unregistered`.
- Organiser transactions run one at a time (a database advisory lock plus an in-process queue), so gas coins never race.
- Retrying a draw repeats only the missing chain step and never rerolls.
- A six-fan settlement costs about 0.01 SUI; 300 entrants with 300 items fit in one transaction.
- Testnet SUI only: no real money, no mainnet.

### Verify on the explorer

Every drop on Sui exposes its object IDs and transaction digests through `/api/drops/:id/public` (`sui`) and its draw record (`record.sui`). Open `https://suiscan.xyz/testnet/tx/<digest>` or `https://suiscan.xyz/testnet/object/<id>`. The settlement's balance changes show the payout and each refund, and its `Settled` event lists the seed, the winners in pick order, the rolls and every entry's losses before and after. Anyone can recompute the winners from the seed with `chainDraw` in [src/lib/sui-draw.ts](../src/lib/sui-draw.ts); the drop page does it in the browser.

## Test a paid drop as a fan

1. Install a Sui wallet **browser extension**, such as the Slush extension. In Chrome, set its **Site access** to **On all sites**, so the page can find it.
2. Switch the wallet to **Testnet**. The wallet picker lists only wallets that support `sui:testnet`.
3. Get testnet SUI at `https://faucet.sui.io/?address=<your address>`. A paid entry needs 0.01 SUI plus gas.
4. On the drop page: **Connect Wallet** → your wallet → **Enter with World ID + 0.01 SUI** → World ID → approve the deposit. The receipt links the deposit on Suiscan.

**Slush's web wallet (`my.slush.app`) is blocked in Japan.** It answers "451 · not available in your region", so its popup stays blank and the page says "Connection failed". The picker's single "Slush" entry is that web wallet until a Slush extension is detected; the extension then replaces it. Phone browsers can't run extensions, so test paid drops from a laptop in Japan; World ID still works by scanning the QR code with World App.

## Database

`db/schema.sql` is the whole schema, written as additive `CREATE … IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` statements, so running it again is safe. Local PGlite applies it on start; **hosted Postgres is never migrated automatically**:

```sh
DATABASE_URL=<postgres url> npm run db:migrate    # prints "Tenjo schema applied."
```

Run it from a checkout of the code you are about to deploy, **before** deploying code that reads new tables or columns; otherwise those pages or routes fail. Production Neon has every table, including `passkeys` and `entry_identities` (27 September 2026). The tables are described in [IMPLEMENTATION.md](IMPLEMENTATION.md#data-model).

## Deploy

- **Environments.** Production holds every variable. Preview deployments hold none (no database, World or Sui), so a preview only proves that a branch builds; test flows locally.
- **Pushes to `main` deploy production.** The Vercel project is on a Hobby team, which only builds commits its owner authored, so [vercel-deploy.yml](../.github/workflows/vercel-deploy.yml) deploys teammates' pushes by committing a timestamped note under `.github/deploys/` as the owner. Run it from the Actions tab to redeploy.
- **Merge with a merge commit.** Vercel skips the production build for a commit it already built as a preview, so fast-forwarding `main` to a previewed commit deploys nothing. If that happens, push a new commit.
- **Promoting a preview** in Vercel puts production ahead of `main`. Merge the branch afterwards, or the next push to `main` deploys without it.
- **Variable changes** apply to new deployments only: redeploy after changing one.
- **Before shipping:** run the checks below, migrate Neon if the schema changed, merge, then confirm the live pages and `curl -s https://tenjo-azure.vercel.app/api/drops/<id>/public`.

`vercel.json` pins the Singapore region and the build command (`next build --webpack`; this environment denied Turbopack's CSS worker port, while development still uses Turbopack). `.vercelignore` keeps local data and secrets out of uploads. Keep the organiser password out of documentation and issues.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run format:check
npm run sui:test
```

Browser tests start an isolated database and server on port 3100 with a separate `.next-e2e` directory and every `SUI_*` variable blank; set `TENJO_TEST_PORT` if another server holds the port. They use installed Playwright Chromium (`npx playwright install chromium` once).

- **TypeScript tests:** weighted probabilities and the cap, nullifier normalisation, duplicate-entry races, early draws, settlement idempotency, cross-series counts, wrong identity and duplicate pickup; exact proof forwarding, nonce, signal, action, environment and credential checks, partial verifier success, replay, dependency failure, bounded payloads, admin access and fail-closed configuration; the Sui mirror against an in-memory chain and the TypeScript re-run of the Move draw; passkeys, with a software authenticator holding a real Ed25519 key: registration, signatures bound to one drop and request, one entry per person and per passkey, and losses carried across free and paid drops.
- **Move tests:** permits, deposits, refunds and payout, the six-chance cap and every draw and settle gate.
- **Browser tests:** rendered receipts and history, confirmations and refusals, keyboard access, desktop (1440×1000) and mobile (390×844) layouts, and page overflow.

For a browser check of passkeys, Chrome's DevTools protocol can add a virtual authenticator (`WebAuthn.addVirtualAuthenticator`) to a Playwright page against `next dev`.

## Troubleshooting

| Symptom                                                 | Cause and fix                                                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| "World's staging verification window is closed"         | Open a new window ([above](#the-staging-verification-window)), update the token on Vercel and redeploy                             |
| IDKit says "Verification declined" on a simulator entry | The same staging gate, or a closed window; check the page's own message first                                                      |
| "Already entered" for a real World ID                   | World refuses a second proof for the same drop's action (`nullifier_replayed`). One entry per person is working                    |
| "Connection failed" after choosing Slush                | Slush's web wallet is blocked in Japan. Use a wallet extension with site access on all sites ([above](#test-a-paid-drop-as-a-fan)) |
| "Tenjō doesn't know this passkey"                       | The browser remembered a passkey this database never stored. It is forgotten; the next entry creates a new one                     |
| "This passkey already has an entry in this drop"        | One entry per passkey per drop. Use your own passkey, or untick it to enter with World ID alone                                    |
| "The passkey step didn't finish"                        | The prompt was cancelled, or the browser wanted a fresh tap. Press **Confirm passkey**                                             |
| Pages return 500 after a deploy                         | New tables or columns missing on Neon: run `npm run db:migrate` against it                                                         |
| "Module not found: @mysten/sui/…" locally               | Stale install: run `npm ci`                                                                                                        |
| A script hangs or fails on the local database           | PGlite allows one process: stop the dev server first                                                                               |
| Browser tests fail with "port is already used"          | Another server holds 3100: set `TENJO_TEST_PORT`                                                                                   |
| A push to `main` didn't deploy                          | The commit was already built as a preview: push a new commit                                                                       |

## World integration debrief

Measured from production's `proof_log` with `npm run world:debrief` at 02:25 JST on 27 September 2026.

| Item                        | Observed evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build integration start     | 25 September 2026, about 23:22 JST                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| First server-verified proof | 26 September 2026, 17:25:53 JST                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Time to first success       | About 18 hours. The last stretch went on World's new staging gate: the first proof passed minutes after the staging-window token went live at 17:19 JST                                                                                                                                                                                                                                                                                                                                                                  |
| Production attempts         | 17 verified entries (average 0.98 s, including World's verify call) and 16 rejected (average 0.17 s), from 26 September 16:36 JST to 27 September 01:48 JST, for the simulator and real World IDs                                                                                                                                                                                                                                                                                                                        |
| Friction                    | World's verify API refuses staging proofs without a 24-hour window, opened only through the Developer Portal's MCP tool, and IDKit then shows only "Verification declined". World ID 4 nullifiers are single-use per action, so real World IDs need one action per drop and lose the cross-drop code; Tenjō restores it with a passkey. Also: reconciling the docs with the actual IDKit 4.3.0 exports, telling staging legacy and v4 identities apart, and checking each credential in a possibly partial verify result |
| Missing clarification       | Server-verifiable presence for pickup, simulator passport support, My Number Card behaviour, cross-version identity reconciliation and how to verify session proofs on the server                                                                                                                                                                                                                                                                                                                                        |
| Highest-value improvement   | An official Next.js example covering session proofs (a stable identity across repeat proofs), byte-preserving server verification, the staging window, the document fallback and server-attested pickup liveness                                                                                                                                                                                                                                                                                                         |

`proof_log` records only the purpose, the outcome category, the elapsed milliseconds and the time; never proof contents or identity. To refresh these numbers, run `npm run world:debrief` with `DATABASE_URL` set (stop a local PGlite server first) and `WORLD_INTEGRATION_STARTED_AT` for the time to first success.

## Open work

- [x] Real World ID success and duplicate refusal on production, for the simulator (passport) and real World IDs (Orb).
- [x] Hosted Postgres and Vercel deployment.
- [x] Sui testnet package, smoke-tested end to end with free and paid drops.
- [x] Real World IDs carry their losses with a passkey, tested on production with a real device.
- [x] Staging pickup fallback on and labelled; real-World-ID pickup off until liveness is server-attested.
- [ ] Two clean four-minute rehearsals, the recording and the ETHGlobal submission ([PITCH.md](PITCH.md)).
- [ ] Stretch: unclaimed-seat handoff.
- [ ] @Chai decides series-scoped privacy and prize scope.
