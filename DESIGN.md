---
version: beta
name: Tenjō · Capsule
description: A warm capsule-toy shop for ticket ballots. Every chance is a capsule; the dome holds six, and that ceiling is the tenjō.
colors:
  plum: "#481427"
  tangerine: "#EF5E36"
  lime: "#D2DD5C"
  periwinkle: "#D1DCFA"
  forest: "#2B6D36"
  oat: "#EFEAE0"
  cream: "#F9EDE2"
  peach: "#F7D0BD"
  paper: "#F8F3EB"
  mauve: "#734455"
  danger: "#B42318"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
  sans:
    fontFamily: "Geist, sans-serif"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
  japanese:
    fontFamily: "Hiragino Maru Gothic ProN, Yu Gothic, sans-serif"
rounded:
  pill: "999px"
  card: "1.5rem"
  panel: "2.25rem"
  field: "0.875rem"
spacing:
  section-gap: "4.5rem"
  page-max: "80rem"
components:
  button: {}
  chip: {}
  capsule: {}
  machine: {}
  panel: {}
  evidence: {}
---

# Tenjō design system: Capsule

## Overview

Tenjō is gacha's pity ceiling (天井) brought to ticket ballots, so the product should feel like the capsule-toy corner of a Tokyo station: warm, tactile, a little playful, and completely honest about what's inside. The signature is the **capsule machine**. Each chance in a draw is one two-tone capsule in its glass dome. A first entry drops in one capsule, and every loss in the same series adds another. The dome holds six, and that full dome is the tenjō. The same capsule marks chances everywhere: the hero, drop pages, receipts, the walkthrough and code history.

The September 2026 rebrand replaces the earlier cool navy and cobalt brand, which read as a generic fintech dashboard. The new look keeps the product's rules, states and accessibility contract. It changes the mood from "trust us, we're a bank" to "come and have a go, we'll show you the maths". The trust story is carried by evidence (World ID checks, Sui transactions, public records), not by coldness.

Audience: ETHGlobal Tokyo judges (World, Sui, finalists) and fans of Japan-market ticket ballots. The UI is in English; the product name is Japanese; all times are JST. It has to work for a desktop stage demo and a 390px phone.

Runtime ownership is Model B: `src/app/globals.css` is canonical, and this file mirrors its accepted semantic tokens. Legacy token names stay mapped so every existing component re-themes without a fork: `--primary` → plum, `--primary-hover` → berry `#661E38`, `--background` → paper, `--surface` → white, `--ink` → plum, `--muted` → mauve, `--accent` → peach, `--tint` → cream, `--border` → `#E6D9CC`, `--danger` → danger. Shared consumers remain `.button`, `.field`, `.notice`, `.ticket`, `.data-table`, plus the new `.chip`, `.capsule`, `.panel` and `.evidence`.

## Colors

Six named colours, taken from the Kidrise (Nurtiva) palette and tuned for contrast:

| Token      | Hex       | Job                                                                                     |
| ---------- | --------- | --------------------------------------------------------------------------------------- |
| Plum       | `#481427` | All text, primary buttons, dark panels (Why Sui, footer). Never pure black.             |
| Tangerine  | `#EF5E36` | Capsule tops, arrow badges, the logo tile. Graphic only; tangerine text uses `#B3401C`. |
| Lime       | `#D2DD5C` | The one "pull" CTA per view, hand-drawn squiggles, won highlights on dark panels.       |
| Periwinkle | `#D1DCFA` | Calm technical panels: the machine's backdrop, the World + Sui map. Sui is water (水).  |
| Forest     | `#2B6D36` | The hero panel and "live" / "won" states.                                               |
| Oat/cream  | `#EFEAE0` | Warm grounds. Paper `#F8F3EB` is the page; cream `#F9EDE2` tints soft cards.            |

Supporting: peach `#F7D0BD` and pink `#FBECF1` for tilted stat cards, mauve `#734455` for secondary text (6.9:1 on paper), and danger `#B42318` for errors (never colour alone; always text + icon).

Contrast rules: plum on paper is 14:1. Cream `#FBF4EC` on forest is 5.7:1 and on plum 15:1. Plum on lime is 10:1. White on tangerine is 3.3:1, so tangerine never carries body text; it carries icons and large numerals only. Status: live is forest, pending is amber `#B7791F`, planned is an outline ring. Light theme only. Focus is a 3px plum ring with a 3px offset; forced colours defer to system colours.

## Typography

- **Display: Space Grotesk** (500, tracking −0.04em) for headlines and big numerals. The template's friendly quirk: squared terminals and the open "g". Hero 44–76px, section heads 30–48px, card titles 20–28px.
- **Body: Geist** 400/500/600 at 16px/1.6. Small print never goes below 12px.
- **Evidence: Geist Mono** for anonymous codes, object IDs, transaction digests and formulas. On-chain things always appear in mono, truncated in the middle (`0x3f2a…9c1d`), with the full value in the link and title.
- **Japanese: system rounded gothic** (Hiragino Maru Gothic ProN, then Yu Gothic) for 天井 and 水, set larger than surrounding text, like a shop stamp.

Labels are sentence case. The old uppercase, letter-spaced eyebrows are gone: section labels are `.chip` pills with a small capsule dot, as in the reference's "What to expect" tags.

## Layout

The page is 80rem at most, with 18–46px responsive gutters. Discovery is a stack of rounded colour panels rather than hairline-ruled sections:

1. **Hero:** a split panel, forest copy on the left and the periwinkle capsule machine on the right, with floating fact pills. It stacks below 900px.
2. **Problem:** three tilted pastel stat cards (peach, lime, periwinkle), sourced.
3. **Under the hood:** the World + Sui map on a periwinkle panel. It gives way to step cards below 1100px.
4. **How it works:** four real sequential steps, so they are numbered.
5. **Why Sui:** a plum panel with four reasons and a sourced "Sui right now" strip.
6. **Drops:** the featured drop card, then the list.
7. **Lookup:** on a lime panel.

Panels use `.panel` with `--panel-bg`. The document owns vertical scrolling; tables and the detailed map own their own horizontal overflow. Action targets are at least 44px. Nothing may cause horizontal page scroll at 390px.

## Elevation & depth

Mostly flat, warm and paper-like. Cards sit on 1px warm borders. The machine and floating pills get one soft plum-tinted shadow (`0 18px 40px #48142722`). No glassmorphism, neon glows or dark-mode dashboards.

## Shapes

Pills (999px) for buttons, chips and status. Cards are 24px, panels 36px, fields 14px. Capsules are circles split at the equator: the top half is a colour, the bottom is cream, with a 2.5px plum outline and a seam. Stat cards tilt ±2–3°. Hand-drawn squiggles (lime, 3px, round caps) underline at most one phrase per view. Dashed outlines mean "empty slot" or "not built yet", never decoration.

## Components

- **Buttons:** a plum pill with a round tangerine arrow badge (`.button`). Secondary is a white pill with a cream badge. `.button.pop` is the lime pill with a plum badge, for the single most important action on a view. Buttons mutate and links navigate. Busy buttons stay the same width and show a spinner.
- **Chip:** a sentence-case label pill with a capsule dot; it replaces eyebrows on marketing sections.
- **Capsule / chance row** (`.capsules`): n filled capsules plus dashed empty slots up to six. It always has a text equivalent ("4 of 6").
- **Capsule machine** (`CapsuleMachine`): an SVG with a dome of six slots, a body plate, crank, coin slot and chute. It's decorative, but has an accessible label stating the arithmetic.
- **Evidence row** (`.evidence`): a mono ID with a link to Suiscan or the public record and a status dot. It is only rendered for real IDs and digests from the server; there are no placeholders.
- **Forms, tables and notices:** unchanged behaviour (see UX-CONTRACT.md), re-themed. Native selects and date inputs stay platform-owned. IDKit owns its modal; the Sui wallet owns its approval prompt.

Lucide outlined icons at 16–22px always have text labels or accessible names.

## Motion

One orchestrated moment: on first paint the hero's capsules drop into the dome one after another, 90ms apart, with a small settle. Buttons get small hover feedback (the arrow nudges). There's a pending spinner. That's all. `prefers-reduced-motion` renders everything already settled.

## Voice and vocabulary

Warm, plain and specific. Talk to the fan ("you lost Night 1, so Night 2 starts with one more chance"), never about the system ("weight incremented").

- An **entry** is one person's application to a drop.
- **Chances** are how many times their name is in the draw: 1 + past losses in the series, six at most. The capsule is the picture of a chance, not a second word for it.
- **Losses** are the pity counter.
- A **deposit** is money held for an entry and **refund** is its return.
- **Tickets** only ever means real event tickets. Code, database and API names keep `tickets` for draw weight.

Name the network doing each job: World ID checks who can enter; Sui holds deposits, draws and remembers losses. Say "on Sui testnet" and link the transaction, or say it isn't live. Never "on-chain" with no link.

## Do's and don'ts

- Do show the maths: every chance count comes with its breakdown.
- Do link every on-chain claim to a real object or transaction.
- Do keep failures persistent, with a retry path.
- Don't use casino imagery: no slot machines, coins raining, jackpots or countdown pressure. The machine is a toy, not a casino.
- Don't claim verified identity, liveness or a Sui transaction before the server confirms it.
- Don't present demo history as real participation.
- Don't use decorative Japanese stereotypes (no torii, samurai or sakura filler). The only Japanese on screen is the product's own words, 天井 and 水.

## Reference taste: Kidrise (Nurtiva)

Reference: [Kidrise, now published as Nurtiva by LioWeb](https://webflow.com/templates/html/kidrise-website-template), live preview [nurtiva.webflow.io](https://nurtiva.webflow.io/), reviewed 26 September 2026. The reference is a kindergarten site with these traits:

- colour-blocked full-width sections: forest hero, oat, periwinkle, plum and lime;
- plum `#481427` instead of black, with tangerine `#EF5E36` as the accent;
- Space Grotesk headlines at weight 500 with tight tracking, over Geist body text;
- pill buttons with a circular arrow badge;
- sentence-case tag chips;
- tilted pastel feature cards, hand-drawn squiggle underlines, and floating stat pills over imagery.

Its warmth comes from colour and softness rather than decoration density.

**What we took:** the palette, the type pairing, colour-blocked panels, badge buttons, chips, tilted cards, one squiggle and floating fact pills.

**What we changed:**

- The photos become the capsule machine.
- "Rated 4.9 by families" style social proof becomes sourced ballot statistics and live chain evidence.
- The kindergarten tone becomes gacha-shop playfulness.
- The panels are rounded to echo capsules.

No template code, images, icons, logos or copy are reused; the 天 mark, machine illustration and all copy are Tenjō's own. The previous reference (Invstor X, navy and cobalt) is retired.
