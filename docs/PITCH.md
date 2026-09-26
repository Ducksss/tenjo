# Tenjō pitch pack · ETHGlobal Tokyo 2026

Finalists get **4 minutes of demo and 3 of Q&A**, judged on technicality, originality, practicality, usability and wow. The submission video must be **2–4 minutes**, at least 720p, at normal speed and in a human voice: no text-to-speech, no speed-ups, no phone recording, an intro under 20 seconds and at most four bullets per slide. The deadline is **Sunday 27 September, 09:00 JST**.

Partner prizes entered (three allowed): **World · Best use of IDKit** and **Sui · DeFi & Payments**.

## Who we pitch to

**The fan is the heart. The organiser is the customer.** Tell Yui’s story so judges feel the problem. Then show why a ticketing platform, fan club or shop running a lottery sale would switch; that is the practicality score.

Name the customer categories, not partners. We have no partners, pilots or conversations with Nintendo, e+, Pia or anyone else, so never say or imply otherwise, and show no third-party logos. Use public facts as **evidence the market wants this**:

- **Nintendo’s Switch 2 lotteries in Japan.** Entrants needed [50 hours of Switch play and a year of Nintendo Switch Online](https://nintendosoup.com/my-nintendo-store-japan-adds-new-requirements-to-5th-switch-2-lottery-deliveries-scheduled-for-september/), a proxy bot filter that shuts out new fans. The fifth lottery added a rule: [you must have entered an earlier lottery and never won](https://nintendosoup.com/my-nintendo-store-japan-adds-new-requirements-to-5th-switch-2-lottery-deliveries-scheduled-for-september/). That is a pity system, built by hand. **The biggest organiser in the market already invented Tenjō, the hard way.**
- **[2.2 million people](https://mynintendonews.com/2025/04/23/japan-nintendo-confirms-2-2-million-people-applied-for-the-switch-2-lottery/)** applied for the first Switch 2 lottery in Japan, and **[3.5 million](https://business.ticketmaster.com/press-release/taylor-swift-the-eras-tour-onsale-explained/)** pre-registered for the Eras Tour presale.
- **Japan has banned reselling specified event tickets above face value since June 2019** ([the Act, in English](https://www.japaneselawtranslation.go.jp/en/laws/view/3356/en)). Organisers need tickets that stay with the person who won, which is why our winner’s Ticket can’t be transferred and pickup needs World ID again.

## The story in five beats

1. **The pain.** Fans lose again and again, and every ballot forgets them. Organisers fight bots with crude rules, chase winners who don’t pay, and field “it’s rigged” complaints.
2. **The insight.** Gacha games fixed losing streaks years ago with 天井, the pity ceiling. Nintendo rebuilt it by hand for Switch 2.
3. **The product.** One real person, one entry, and every loss adds a chance in the same series, up to six. Pay a deposit to enter; lose, and it comes straight back.
4. **Why it needs both networks.** World ID stops one fan becoming fifty accounts that farm losses. Sui makes the draw, the money and the loss counts impossible for anyone, including us, to fiddle.
5. **Why organisers switch.** It’s a bot filter without collecting IDs, wins that are paid the moment they’re drawn, a draw anyone can verify, and fans who lose but come back.

## Lines that land

- “Lose a ballot, gain a chance.”
- “Gacha’s pity, without gacha’s price. A losing deposit comes back in full, so you can’t lose money on Tenjō.”
- “World ID checks who enters. Sui decides who wins.”
- “We can’t rig this demo. Sui picked who lost.”
- “Nintendo already built a pity rule by hand. We made it a primitive.”

## Don’t say

- “Partnered with”, “working with” or “used by” any real company. We have no pilots or users yet.
- “Fair”, unqualified. Say “every loss counts” and “provably random”.
- “KYC” or “identity” for World ID. It’s proof of personhood: no name, email or document is stored.
- “On mainnet”, “live payments” or “no fees”. It runs on Sui testnet with test SUI.
- Guaranteed wins. More chances mean better odds, never a promise.

## Four-minute live demo

It runs on the local app, which is configured with World staging, against Sui testnet. There are two prepared drops (see [staging](#staging-before-you-go-on)). The live entry uses a **real World ID simulator proof**. The live draw uses a shop drop entered by labelled **test identities with real Sui transactions**.

| Time      | Click                                                                                              | Say                                                                                                                                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:25 | Landing hero                                                                                       | “2.2 million people applied for the first Switch 2 lottery in Japan. Nintendo was so worried about scalpers it only let in accounts with 50 hours of play. By the fifth lottery it added a rule: only people who’d entered before and never won. That’s a pity system, built by hand. Gacha games call it 天井, tenjō: the ceiling.”        |
| 0:25–0:40 | Scroll to the capsule machine                                                                      | “Tenjō is that ceiling for any ballot. One real person, one entry, and every loss adds a chance in the same series, up to six. World ID checks who enters. Sui holds the deposits, runs the draw and remembers every loss.”                                                                                                                 |
| 0:40–1:35 | **Tokyo Dome · Night 2** → Connect Slush → **Enter with World ID + 0.01 SUI** → simulator → wallet | “This is Yui’s ballot for Night 2. World ID checks she’s one unique human: no name, no email. The server signs a permit for her wallet, and her wallet locks the deposit in this drop’s escrow on Sui.” Point at the receipt: chances with their breakdown, plus the Suiscan link.                                                          |
| 1:35–1:50 | Click enter again                                                                                  | “Try again: refused. One human, one entry. A second wallet doesn’t help either, because the permit is bound to hers.”                                                                                                                                                                                                                       |
| 1:50–2:45 | **Capsule Shop · Limited console lottery** (closed) → **Run draw** → Suiscan settlement tab        | “Same engine, a shop’s console restock. Anyone can press Run draw. First, Sui commits a random seed from `sui::random`, which nobody can predict or retry. Then one transaction settles everything: the shop is paid for its two consoles, and all four losers get their deposits back in that same transaction.” Show the balance changes. |
| 2:45–3:10 | Back on the drop page: evidence panel, then a loser’s code history                                 | “Your browser just re-ran the draw from the seed: same winners. We can’t rig this demo; Sui picked who lost. This fan starts the next restock with two chances instead of one, and the counter lives on Sui, where nobody can edit it.”                                                                                                     |
| 3:10–3:45 | How it’s built → the map                                                                           | “For the organiser, Tenjō replaces three hacks: play-hour rules to stop bots, chasing winners who don’t pay, and ‘it’s rigged’ complaints. Winners hold a ticket they can’t transfer, which matters in Japan, where resale above face value is illegal. And because deposits are refunded in full, fans can’t lose money.”                  |
| 3:45–4:00 | Landing hero                                                                                       | “World ID for who enters. Sui for who wins. Tenjō: lose a ballot, gain a chance.”                                                                                                                                                                                                                                                           |

At normal pace this runs about 4:10, so trim 0:25–0:40 first if rehearsal runs long. Keep one hand on the mouse and say what you click before you click it.

If the network is slow, the walkthrough on the landing page (**See how it works**) runs entirely in the browser, and a screen recording of a rehearsal draw is the backup. Say “this is our rehearsal from an hour ago” if you use it.

## Staging: before you go on

1. **Sui:** the organiser address is funded; `npm run sui:publish` has run; the `SUI_*` variables are in `.env.local`.
2. **Drops:** `npm run sui:demo-drop -- --live-drop` creates:
   - the Capsule Shop series, with a settled restock whose test fans picked up real losses;
   - the console lottery, closing a few minutes later and left unsettled for the live draw;
   - the open, real **Tokyo Dome · Night 2**.

   Rerun with `--fresh` for each rehearsal.

3. **Yui’s history (optional):** enter a Night 1 drop in rehearsal with your simulator identity and a few other simulator identities, then draw it. If Yui wins, the story still works (“she won, so she’s back to one chance”), or start a fresh series.
4. **Wallet:** Slush is on testnet with ≥ 0.05 SUI. Simulator tab open. Suiscan tabs pre-loaded for the package and the settlement.
5. **Screen:** browser zoom 110%, bookmarks bar hidden, notifications off, the local server already warm (visit every page once).
6. **Timing:** the chain closes entries 30 seconds after the page does, so the last deposits can land. Pressing **Run draw** inside that window returns “try again in a few seconds”. Stage the console lottery so it closed at least a minute before you go on.
7. **Rehearsal:** two clean runs, timed. Record one as the fallback video.

## Q&A cheat sheet

**Technical**

- _Why not a database?_ The operator is the party most tempted to cheat. On Sui, the randomness, refunds and loss counts can be checked by anyone and edited by no one.
- _Can the organiser rig the draw?_ No. `draw` is permissionless after close and its gas doesn’t depend on the outcome, so an unlucky result can’t be aborted and retried. `settle` is deterministic, and the page re-runs it from the seed.
- _Why two transactions?_ Commit, then use. It’s Sui’s recommended pattern for randomness, so a result can’t be seen and then rejected.
- _What stops bots?_ Entry needs a World ID proof verified on our server, and the nullifier becomes an anonymous code. The Move contract also refuses a repeat code, so a second wallet can’t enter the same human twice.
- _Two passports?_ It’s a known limit of document credentials, and we disclose it. Orb Proof of Human is the configured fallback.
- _Scalping?_ The winner’s `Ticket` has `key` but not `store`, so only our module could move it, and it has no transfer function. Pickup also needs a fresh World ID proof from the winner.
- _Does it scale?_ The demo caps a drop at 300 entrants. Settlement is one atomic transaction, and Sui batches up to 1,024 payments in one. Big ballots would shard into several drops, or refunds would become claimable instead of pushed.

**Business**

- _Who pays?_ The plan is for organisers to pay per drop while fans enter free and deposits refund in full. Pricing is untested.
- _Why would an organiser give losers better odds?_ The seats sell either way. What changes is who gets them: repeat fans instead of bots, which means fewer complaints and fans who stay.
- _Have you talked to organisers?_ Answer honestly. The evidence we have is public: Nintendo’s lottery rules show the demand. The first pilot to look for is small: a venue, fan club, merch drop or conference with more applicants than seats.
- _Isn’t this gambling?_ Chances can’t be bought: only losses add them, and there’s one entry per person. The deposit is the item’s price, fully refunded on a loss, so nothing is staked or lost.
- _What about fans without wallets?_ Free drops need no wallet at all today. The roadmap is a web wallet with social sign-in, sponsored gas and stablecoin deposits.
- _Mainnet in Japan?_ `Drop<T>` takes any coin, so deposits would move to a regulated stablecoin through a licensed partner. Alternatively, the organiser keeps its normal checkout and Sui runs only the draw and ledger (a free drop).

## Partner booths: the 60-second versions

**World (Best use of IDKit):**

- **Trust moment:** fair access to a scarce benefit.
- **Credential:** passport, because we need uniqueness, not identity. Orb is the fallback.
- **Verification:** server-side, byte for byte, with nullifier, action, environment, nonce and signal all checked.
- **Alternative paths:** duplicate, cancelled, missing credential, outage and wrong collector are all refused without saving anything.
- **Close:** show the duplicate refusal live, then the debrief in `docs/OPERATIONS.md`.

**Sui (DeFi & Payments):**

- **Payment flow:** a per-drop escrow vault, deposits gated by a World ID permit, and one settlement that pays the organiser and refunds every loser.
- **Allocation:** decided by `sui::random` plus an on-chain pity ledger.
- **Generic coin:** `Drop<T>` is ready for USDsui or USDC.
- **Close:** open the settlement on Suiscan, then `move/tenjo/sources/ballot.move`.

## Submission video (2–4 minutes)

1. **0:00–0:15.** Face or voice over the landing hero: who you are and the one-liner.
2. **0:15–2:30.** The live demo from above, recorded in one take on the desktop: entry, refusal, draw, Suiscan and the loser’s next chance.
3. **2:30–3:15.** How it’s built: the map, `draw`/`settle` in `ballot.move`, the World verify boundary in `src/lib/world.ts`.
4. **3:15–3:30.** An end card with the site, repo and package ID, at most four bullets.

Record at 1080p from the desktop, not a phone. Use your own voice, no speed-ups, and no music under text.
