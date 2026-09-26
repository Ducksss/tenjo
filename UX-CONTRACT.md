# Tenjō interaction contract

Business source: docs/PRD.md (R1–R15). Visual source: DESIGN.md. No inherited product workflows exist.

| Capability         | Canonical owner                                             | Policy / verification                                                   |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Buttons and fields | src/components/ui.tsx                                       | Native elements, focus, busy state, labelled fields                     |
| Feedback           | Notice in ui.tsx                                            | Persistent inline status/alert, errors retain form data                 |
| Date               | src/lib/format.ts                                           | JST display; native wall-time inputs converted by date-input.ts         |
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

| Capability     | Canonical owner              | Source of truth                          | Allowed variants                                              | Verification                                                      |
| -------------- | ---------------------------- | ---------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Select/Listbox | Native select in DropActions | DESIGN.md / demo-only identity selection | Native platform popup                                         | tests/app.spec.ts focus and selection; keyboard lookup submission |
| Date           | src/lib/date-input.ts        | PRD entry window / explicit JST          | Native date/time input, explicit JST conversion, Intl display | unit + admin browser flow                                         |
| Form           | ui.tsx fields and zod schema | PRD R1 / server validation               | Admin create, code lookup                                     | tests/app.spec.ts                                                 |
| Scrollbar      | src/app/globals.css          | DESIGN.md runtime tokens                 | Global baseline, table horizontal scroll                      | Mobile overflow assertion                                         |

## First visit and organiser improvements

The hosted /demo walkthrough is a browser-only explanation of the PRD’s chance/reset/pickup rules, told as one fan’s concert ballots for two nights of a tour, with World ID at entry and pickup. Example outcomes are scripted, records are ephemeral, and no World proof or API mutation occurs. Reset and refresh discard example state. It never shares a code with real lookup. Empty discovery, audit and lookup flows offer a route to this example without requiring organiser access.

The organiser form groups drop details, JST scheduling and publishing. Native datetime-local controls use the browser’s picker presentation; values are explicitly treated as Japan wall times and converted by src/lib/date-input.ts, never by the browser’s local timezone. Invalid values remain in place, errors are linked to their fields, and submit focuses the first invalid field. Server authority and creation destination are unchanged. Password reveal is transient and nothing is persisted. FormLeaveGuard confirms in-app link navigation with a native HTML dialog and warns on actual page unload; Keep editing preserves all fields. Browser history navigation remains browser-owned.

Verification: tests/app.spec.ts exercises the walkthrough’s loss/win/refusal/reset states, field-error focus, schedule preset and timezone conversion, narrow viewports and keyboard controls. tests/date-input.test.ts checks JST midnight and impossible dates.

## Story and storefront clarity

Discovery states the product before the brand line: a free pity system for ticket ballots, World ID for one entry per real person, and an extra chance after each loss. An “Under the hood” section follows the hero (src/components/architecture.tsx): a full-width map of the browser, World App, Tenjō server, World’s verify service and Postgres, with Sui drawn dashed as next and not built. Below 1100px the map gives way to its five numbered step cards, so no text shrinks unreadably and the page never scrolls sideways. A four-step story (verify, enter, draw, win or try again) follows, introduced by sourced real-world ballot figures. A “why” section explains the World ID trust moment and credential choice, the 天井 name, and the server-now/Sui-next trust boundary. Examples use concert ballots; a real artist appears only in the sourced statistic, never as a demo drop.

Discovery features drops that are open for entry before newer closed ones. One status vocabulary (Entries open, Opens soon, Awaiting draw, Draw complete) is shared by discovery, drop and record pages. On the drop page the entry card’s copy follows the live phase, and crossing the open or close time refreshes server-rendered status. Draw controls sit in their own step-03 card rather than beside entry. Receipts explain the chance breakdown and when the draw runs.

Fan-facing copy calls draw weight chances; tickets means real event tickets only. See DESIGN.md for the vocabulary.

## How it’s built

/architecture is the technical companion to discovery’s map, linked from the main navigation. It uses the same node language and step numbers (01 request to 05 record, plus 06 publish) in src/components/architecture-diagram.tsx, then walks through the World ID pipeline, the pity ledger, draw integrity and the Sui Phase 2 design, pickup, failure paths and World’s IDKit brief. Its live, pending and planned status comes from worldConfig at request time, so it never claims live proofs without credentials; Sui stays labelled designed and not deployed. Below 700px the detailed map scrolls inside its own region and the page never scrolls sideways.
