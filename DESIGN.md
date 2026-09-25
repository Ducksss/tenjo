---
version: alpha
name: Tenjō
description: A human-first drop lottery with visible loss history and ticket-shaped receipts.
colors:
  primary: "#3851F5"
  background: "#F6F8FF"
  surface: "#FFFFFF"
  ink: "#101637"
  muted: "#545D78"
  accent: "#DBE4FF"
  border: "#DCE2F1"
  danger: "#AD3535"
typography:
  sans:
    fontFamily: "Manrope, sans-serif"
  display:
    fontFamily: "Manrope, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  DEFAULT: "0.75rem"
  sm: "0.375rem"
  lg: "1.5rem"
spacing:
  section-gap: "3rem"
  page-max: "80rem"
components:
  button: {}
  field: {}
  status: {}
  ticket: {}
  table: {}
---

# Tenjō Design System

## Overview

A lottery entry should feel like a ticket you can keep and inspect. Signature: a layered cobalt ticket with a perforated stub and a prominent, meaningful ticket count. Deep navy type, ice-white space, geometric sans headlines and pill actions. Discovery borrows the openness of a brand site; operational pages keep their established product controls. Avoid casino visuals, speculative wealth claims, neon web3 dashboards and decorative Japanese stereotypes.

Audience: hackathon judges and fans of scarce Japan-market drops; English demo UI, Japanese product name, all times explicitly JST. Desktop stage demo and narrow mobile layouts. No real-money use. Evidence: docs/PRD.md. The September 2026 refresh applies the user-selected Invstor reference to the existing product without changing lottery behavior.

Runtime ownership is Model B: src/app/globals.css is canonical; this file mirrors accepted semantic tokens. Mapping: colors.primary → --primary; background → --background; surface → --surface; ink → --ink; muted → --muted; accent → --accent; border → --border; danger → --danger. CSS consumers are shared .button, .field, .notice, .ticket, .data-table. No independent theme adapter. Privacy follows R14; global code follows R4 until the open series-hashing decision is resolved.

## Colors

Cobalt is the brand/action color; pale blue (--tint: #EDF1FF) is ticket paper, white is an operational surface. Blue is not itself a claim of successful verification. Errors use danger and text, never color alone. Light theme only. Focus uses primary; forced colors defer to system colors. Global scrollbars use muted thumb and background track.

## Typography

Manrope variable font: 43–68px display with 500 weight, 16px body with 1.55 line-height; system mono for anonymous codes and numerical records. The SIL-licensed font is bundled in src/app/fonts and self-hosted through next/font/local, with adjusted fallback metrics. --font-manrope supplies both --font-body and --font-display. Japanese name uses system Japanese fallback. No full Japanese locale claimed.

## Layout

80rem maximum content, 3rem sections, 18–46px responsive gutters. Shared horizontal navigation wraps below 900px; at 450px the four destinations form a two-column grid. The discovery hero splits copy and original ticket artwork, stacking below 700px. Ticket and information columns stack below 700px. Document owns vertical scrolling; tables own horizontal overflow only. Minimum 44px action targets. Forms stay natural height.

## Elevation & Depth

Quiet cool borders on operational cards; layered ticket artwork uses a restrained cobalt gradient and shadow. No blurred backgrounds or fixed-height page traps.

## Shapes

12px inputs, pill buttons, 24–32px feature panels, dashed ticket perforation. The asymmetric discovery art corner echoes the rounded architectural forms of the reference. Circular weight markers represent actual tickets, not decoration.

## Components

Shared controls in src/components/ui.tsx own button, field and inline status. Busy controls remain stable and disabled; statuses use aria-live. Native links navigate; buttons mutate. Organiser forms use native date/time inputs with an explicit JST wall-time contract. The platform owns the picker; src/lib/date-input.ts converts to UTC independently of the browser timezone. Group details, scheduling and publishing with field-level errors and first-error focus. Native selects are allowed with platform popup behavior. Tables are semantic with labelled overflow and URL pagination. IDKit owns its verification modal. No app modal is needed for reversible entry; draw has an inline review/confirm step because settlement is final.

Lucide outlined icons at 18–22px always have text labels or accessible names. Motion is limited to small hover feedback and a pending spinner; reduced-motion disables animation. Copy names actions: Enter drop, Run draw, Collect item, Look up code. Always state demo/setup/server status accurately. No invented live odds or Sui transactions. The /demo walkthrough is a separately labelled, browser-only teaching example with scripted outcomes and arithmetic odds; it never creates database entries. Public empty states lead visitors to this walkthrough, with organiser actions secondary.

## Do's and Don'ts

- Do make every recorded weight and winner inspectable.
- Do give failures a persistent explanation and a retry path.
- Don't claim verified identity or liveness before the server confirms it.
- Don't display demo history as real participation.

## Reference taste: Invstor X

Reference: [Invstor X](https://invstortemplate.webflow.io/) and its [Home V1](https://invstortemplate.webflow.io/home-pages/home-v1), reviewed 26 September 2026. The reference uses Thicccboi sans type, oversized medium-weight headlines, deep navy on icy white, electric-blue actions, generous negative space, pill controls and a large abstract sculptural hero. Its confidence comes from scale and restraint rather than dense decoration.

Tenjō translates those qualities into self-hosted Manrope, a spacious top navigation, a split discovery hero and layered ticket forms. The blue ticket explains the actual arithmetic instead of borrowing the template's investment imagery. No template code, images, logos or font files are reused. The 天 mark, project name, pity rules, field behavior, refusal states and public-record access remain Tenjō's own.

Asset palette and typography follow these runtime tokens. Original editable SVGs and raster exports are in docs/assets; real screenshots document both the hosted-style walkthrough and local test-identity drop. The application icon and Open Graph card match the same direction.
