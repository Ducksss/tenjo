# Tenjō interaction contract

Business source: docs/PRD.md (R1–R15). Visual source: DESIGN.md. No inherited product workflows exist.

| Capability         | Canonical owner                                             | Policy / verification                                                   |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Buttons and fields | src/components/ui.tsx                                       | Native elements, focus, busy state, labelled fields                     |
| Feedback           | Notice in ui.tsx                                            | Persistent inline status/alert, errors retain form data                 |
| Date               | src/lib/format.ts                                           | JST display; organiser submits explicit ISO +09:00 text                 |
| Select/Listbox     | Native select via field classes                             | Platform popup/keyboard accepted                                        |
| Scrollbars         | globals.css                                                 | Global visible standard + WebKit fallback, forced-colors override       |
| Forms              | zod schemas in src/lib/service.ts; client inline validation | noValidate, no native validation bubbles                                |
| Lifecycle          | src/lib/service.ts                                          | Entry/collect wait for confirmed commit; draw confirms and settles once |
| Lists/table        | Server URL paging                                           | 20 rows, query/page in URL, clear search available                      |

Entry creates a receipt on the same drop; repeated entry reports Already entered. Lookup navigates to a shareable public code history. No proof, signing key or password is stored in browser storage. Draw shows finality before confirmation; duplicate requests return the existing result. Collect accepts a fresh proof and verifies winning identity before one-time pickup.

Failures distinguish refused, unavailable, cancelled, missing configuration, and stale/closed state. No automatic mutation retry; refresh public records if completion is uncertain. Critical inline errors use role=alert and never disappear automatically. Mutation buttons prevent duplicate submissions. Fetches have a bounded timeout.

R4 currently uses a global anonymous code; cross-series pseudonymous linking is explicitly visible. Entries are capped at 300 per drop for this demo. Series are serialized: a new drop may only open after its predecessor settles, so weights cannot become stale through overlapping same-series draws. If entrants are fewer than items, every entrant wins and unused items remain undistributed. These edge-case resolutions are documented in docs/IMPLEMENTATION.md.

Free/test use only; no deposits, payments, legal promises or account data. World simulator and local setup are distinct. Production requires hosted Postgres and real World config; local fixtures cannot enter real drops. No Sui explorer badge before a real chain transaction exists.

Checks: npm run lint; npm run typecheck; npm test; npm run build; npm run test:e2e. Validate desktop/mobile, keyboard, success, refusal, empty lookup, early draw, wrong identity, duplicate draw and pickup. Native Japanese full-locale testing is outside this English hackathon build.

## Canonical UI Map

| Capability     | Canonical owner              | Source of truth                          | Allowed variants                         | Verification                                                      |
| -------------- | ---------------------------- | ---------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Select/Listbox | Native select in DropActions | DESIGN.md / demo-only identity selection | Native platform popup                    | tests/app.spec.ts focus and selection; keyboard lookup submission |
| Date           | src/lib/format.ts            | PRD entry window / explicit JST          | Typed ISO input, Intl display            | unit + admin browser flow                                         |
| Form           | ui.tsx fields and zod schema | PRD R1 / server validation               | Admin create, code lookup                | tests/app.spec.ts                                                 |
| Scrollbar      | src/app/globals.css          | DESIGN.md runtime tokens                 | Global baseline, table horizontal scroll | Mobile overflow assertion                                         |
