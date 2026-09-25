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

## Phase 2 and unresolved gates

No Move package, testnet publish, Sui wallet, chain draw or settlement mirror has been implemented. The UI never fabricates explorer links. Phase 1's real simulator acceptance gate must be demonstrated before pursuing Phase 2 per the PRD. Deposits and unclaimed handoff are not implemented.

Remaining evidence: first World simulator proof, legacy document identifier/availability, My Number Card preset behavior, production v4 behavior, server-attested pickup presence, public Postgres deployment, Sui testnet randomness/gas review, two live rehearsals and video. Team/project priority and prize decisions remain @Chai's.

## Sources checked during implementation

- https://docs.world.org/world-id/idkit/integrate — fixed-action nullifiers, server verification and staging.
- https://docs.world.org/api-reference/developer-portal/verify — per-credential results and expected environment.
- https://docs.world.org/world-id/idkit/credentials — credential presets and user-presence request.
- Installed IDKit 4.3.0 type definitions and signing/hashing exports — actual package interface and legacy migration warning.
- Installed Next docs under node_modules/next/dist/docs — route handlers, server/client boundaries, async params and Webpack CLI support.

The SDK currently exposes separate Passport and Mnc presets. Production My Number Card compatibility with the selected passport path is untested; this build does not claim to resolve the PRD's booth question.
