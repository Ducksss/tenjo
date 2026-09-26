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

Entry creates a receipt on the same drop. A repeated entry gets its own "You’ve already entered this draw" refusal instead of a generic error, also after World ID: the World ID modal closes on any Tenjō refusal so the page's message is never hidden behind IDKit's generic "declined" screen. It says nothing new was saved (and, on a paid drop, that no deposit moved) and links back to the first entry: the server returns the person's own anonymous code, which is safe because their World ID proof or demo identity was checked first. Lookup navigates to a shareable public code history. No proof, signing key or password is stored in browser storage. Draw shows finality before confirmation; duplicate requests return the existing result. Collect accepts a fresh proof and verifies winning identity before one-time pickup.

Failures distinguish refused, unavailable, cancelled, missing configuration, and stale/closed state. No automatic mutation retry; refresh public records if completion is uncertain. Critical inline errors use role=alert and never disappear automatically. Mutation buttons prevent duplicate submissions. Fetches have a bounded timeout.

R4 currently uses a global anonymous code; cross-series pseudonymous linking is explicitly visible. Entries are capped at 300 per drop for this demo. Series are serialized: a new drop may only open after its predecessor settles, so weights cannot become stale through overlapping same-series draws. If entrants are fewer than items, every entrant wins and unused items remain undistributed. These edge-case resolutions are documented in docs/IMPLEMENTATION.md.

Free drops need no money. Paid drops take a refundable deposit on Sui testnet only; there is no mainnet, real money, legal promise or account data. The fan's own wallet signs the deposit after World ID earns a server permit, and a loser's refund arrives in the settlement transaction. World simulator and local setup are distinct. Production requires hosted Postgres and real World config; local fixtures cannot enter real drops. No Sui explorer link or "live on Sui" label appears before the configured package and a real chain transaction exist. Without Sui configuration the UI says "Tested · not published" or "not published yet".

Checks: npm run lint; npm run typecheck; npm test; npm run build; npm run test:e2e. Validate desktop/mobile, keyboard, success, refusal, empty lookup, early draw, wrong identity, duplicate draw and pickup. Native Japanese full-locale testing is outside this English hackathon build.

## Canonical UI Map

| Capability     | Canonical owner              | Source of truth                          | Allowed variants                                              | Verification                                                      |
| -------------- | ---------------------------- | ---------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Select/Listbox | Native select in DropActions | DESIGN.md / demo-only identity selection | Native platform popup                                         | tests/app.spec.ts focus and selection; keyboard lookup submission |
| Date           | src/lib/date-input.ts        | PRD entry window / explicit JST          | Native date/time input, explicit JST conversion, Intl display | unit + admin browser flow                                         |
| Form           | ui.tsx fields and zod schema | PRD R1 / server validation               | Admin create, code lookup                                     | tests/app.spec.ts                                                 |
| Scrollbar      | src/app/globals.css          | DESIGN.md runtime tokens                 | Global baseline, table horizontal scroll                      | Mobile overflow assertion                                         |

## First visit and organiser improvements

The walkthrough lives on discovery at /#how (/demo redirects there). It is a browser-only explanation of the PRD’s chance/reset/pickup rules, told as one fan’s concert ballots for two nights of a tour, with World ID at entry and pickup. Example outcomes are scripted, records are ephemeral, and no World proof or API mutation occurs. Reset and refresh discard example state. It never shares a code with real lookup. Its last step hands over to the real open drop, or to the drop list when there are none or several. Empty discovery and Results offer a route to this example without requiring organiser access.

Main navigation has three destinations: Drops (discovery, and every drop page), Results (every drop’s public record plus your own history by code, including /codes/[code]) and How it’s built, beside Create a drop. /audit and /codes redirect to /results. The hero offers one real action (the open drop, or the list when several are open) and "See how it works", which scrolls to the walkthrough, so a first visitor never has to choose between two destinations that sound alike.

The organiser form asks four plain questions: what fans can win, which series it belongs to, when fans can enter, and publish. Organisers name a series and never type an ID: the same name in any case continues that series (seriesIdFor in src/lib/service.ts), recent series are offered as one-click picks, and a series still waiting for its draw is flagged as you type and refused before submission. Scripts may still pass an explicit series_id. Entries open on publish for one day by default; presets cover 15 minutes to a week, and "At a set time" or "Until a set time" reveal native datetime-local controls, whose values are explicitly treated as Japan wall times and converted by src/lib/date-input.ts, never by the browser’s local timezone. A live sentence states the window in JST. "Fill in an example" loads a sample concert ballot, continuing its series if it already exists. On wide screens a live preview shows the drop as fans will see it, above what happens after publishing. Invalid values remain in place, errors are linked to their fields, and submit focuses the first invalid field. Server authority and creation destination are unchanged. Password reveal is transient and nothing is persisted. FormLeaveGuard confirms in-app link navigation with a native HTML dialog and warns on actual page unload; Keep editing preserves all fields. Browser history navigation remains browser-owned.

Verification: tests/app.spec.ts exercises the flow animation’s on-screen start, pause, step jumps and reduced-motion stillness, the walkthrough’s loss/win/refusal/reset states and hand-over, field-error focus, schedule presets and timezone conversion, series continuation and busy-series refusal, the old-URL redirects, narrow viewports and keyboard controls. tests/lottery.test.ts checks series naming. tests/date-input.test.ts checks JST midnight and impossible dates.

## Story and storefront clarity

Discovery follows the Capsule direction in DESIGN.md.

1. **Hero:** a split panel. The forest copy side states the product ("Lose a ballot, gain a chance"), then the World ID and Sui roles, one real action beside "See how it works", then live status pills. The periwinkle side holds the capsule machine: four of six capsules, with fact pills.
2. **Drops:** the featured opportunity and other drops, immediately after the hero so visitors can act before reading the technical explanation.
3. **Problem:** sourced ballot figures on tilted cards.
4. **How it works:** first the flow animation (src/components/flow-animation.tsx), a 32-second loop of the same two-ballot story beside a four-step flow diagram, then the interactive walkthrough (src/components/walkthrough.tsx), four steps from verify and enter to collect. The animation is labelled as an example, names Sui only when it is configured, and plays only while on screen and visible. It has a Pause button, step buttons that jump to a step, captions sized to the longest so nothing below moves, and a screen-reader transcript. Under reduced motion it starts paused. The walkthrough's World ID note names the configured credential, and its last step hands back to the real drop.
5. **Under the hood** (src/components/architecture.tsx): the map of browser, World App, Tenjō server, World verify, Postgres and the tenjo::ballot package. Sui is drawn solid only when configured. Below 1100px the map gives way to six step cards, so no text shrinks unreadably and the page never scrolls sideways.
6. **Why Sui** (src/components/why-sui.tsx): four jobs Sui does (randomness, one-transaction settlement, the loss ledger, self-refunding deposits) and a sourced "Sui right now" strip. It shows a package link only when configured.
7. **Lookup:** "Kept your code?", the same lookup Results leads with.

The hero shows a featured paid drop's refundable deposit rather than describing every drop as free. A saved free entry awaiting Sui registration is not yet in the chain draw: its receipt and history say so. After settlement an unregistered entry says "Not included in draw" and explains that no loss was added. These labels do not change retry or settlement rules.

Examples use concert ballots; a real artist appears only in the sourced statistic, never as a demo drop. Every chance count is drawn as capsules with a text equivalent.

Discovery features drops that are open for entry before newer closed ones. One status vocabulary (Entries open, Opens soon, Awaiting draw, Draw complete) is shared by discovery, drop and record pages. On the drop page the entry card’s copy follows the live phase, and crossing the open or close time refreshes server-rendered status. Draw controls sit in their own card rather than beside entry, and the drop page's cards reuse the walkthrough's step names (Verify & enter, The draw, Collect). Receipts explain the chance breakdown and when the draw runs.

Fan-facing copy calls draw weight chances; tickets means real event tickets only. See DESIGN.md for the vocabulary.

## How it’s built

/architecture is the technical companion to discovery’s map, linked from the main navigation. It uses the same node language and step numbers in src/components/architecture-diagram.tsx: 01 request to 06 publish, plus 07 register/draw/settle on Sui when configured. It then walks through:

- the World ID pipeline;
- the pity ledger;
- draw integrity, with the real `draw`/`settle` Move excerpt;
- where the money goes (permit, deposit, settlement);
- pickup;
- failure paths;
- both partner briefs (World IDKit, and Sui DeFi & Payments).

Live, pending and planned status comes from worldConfig and suiStatus at request time, so it never claims live proofs or chain activity without configuration. Below 700px the detailed map scrolls inside its own region and the page never scrolls sideways.

## Paid drops

A drop with a price shows a wallet step inside the entry card: a periwinkle panel, the dApp Kit connect button and one sentence on the deposit. The entry button stays disabled until a wallet is connected and names the deposit ("Enter with World ID + 0.01 SUI"). The flow has four stages: World ID proof, then the server permit, then the wallet signature, then server confirmation of the on-chain `Entered` event. The receipt only appears after confirmation, with the Suiscan link. A refused or cancelled wallet signature leaves the deposit unmoved and says so; the World ID challenge is consumed, so the fan verifies again to retry.
