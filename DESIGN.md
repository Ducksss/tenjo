---
version: alpha
name: Tenjō
description: A human-first drop lottery with visible loss history and ticket-shaped receipts.
colors:
  primary: "#245B48"
  background: "#F6F7F4"
  surface: "#FFFFFF"
  ink: "#202B27"
  muted: "#64716A"
  accent: "#D8E9B0"
  border: "#DDE3DC"
  danger: "#AD3535"
typography:
  sans:
    fontFamily: "Arial, Helvetica, sans-serif"
  display:
    fontFamily: "Georgia, serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  DEFAULT: "0.75rem"
  sm: "0.375rem"
  lg: "1.5rem"
spacing:
  section-gap: "3rem"
  page-max: "76rem"
components:
  button: {}
  field: {}
  status: {}
  ticket: {}
  table: {}
---

# Tenjō Design System

## Overview

A lottery entry should feel like a ticket you can keep and inspect. Signature: a large sage ticket with a perforated stub and six explicit weight marks. Quiet white navigation, forest-green actions, generous air, and restrained serif headlines. Product UI, not a marketing landing page. Avoid casino visuals, speculative wealth claims, neon web3 dashboards and decorative Japanese stereotypes.

Audience: hackathon judges and fans of scarce Japan-market drops; English demo UI, Japanese product name, all times explicitly JST. Desktop stage demo and narrow mobile layouts. No real-money use. Evidence: docs/PRD.md. There is no previous app design or sibling workflow beyond the Next starter.

Runtime ownership is Model B: src/app/globals.css is canonical; this file mirrors accepted semantic tokens. Mapping: colors.primary → --primary; background → --background; surface → --surface; ink → --ink; muted → --muted; accent → --accent; border → --border; danger → --danger. CSS consumers are shared .button, .field, .notice, .ticket, .data-table. No independent theme adapter. Privacy follows R14; global code follows R4 until the open series-hashing decision is resolved.

## Colors

Green is entry/positive action, muted sage is ticket paper, white is an operational surface. Errors use danger and text, never color alone. Light theme only. Focus uses primary; forced colors defer to system colors. Global scrollbars use muted thumb and background track.

## Typography

Georgia display headlines at 40–64px; Arial/Helvetica body 16px with 1.55 line-height; system mono for anonymous codes and numerical records. System fonts avoid network/font-loading shifts. Japanese name uses system Japanese fallback. No full Japanese locale claimed.

## Layout

76rem maximum content, 3rem sections, 24px gutters; sidebar becomes a wrapping top navigation below 900px. Ticket and information columns stack below 700px. Document owns vertical scrolling; tables own horizontal overflow only. Minimum 44px action targets. Forms stay natural height.

## Elevation & Depth

Quiet borders on cards, slight ticket shadow only. No blurred backgrounds or fixed-height page traps.

## Shapes

12px control/card radius, 24px main ticket, dashed ticket perforation. Circular weight markers represent actual tickets, not decoration.

## Components

Shared controls in src/components/ui.tsx own button, field and inline status. Busy controls remain stable and disabled; statuses use aria-live. Native links navigate; buttons mutate. Organiser forms use native date/time inputs with an explicit JST wall-time contract. The platform owns the picker; src/lib/date-input.ts converts to UTC independently of the browser timezone. Group details, scheduling and publishing with field-level errors and first-error focus. Native selects are allowed with platform popup behavior. Tables are semantic with labelled overflow and URL pagination. IDKit owns its verification modal. No app modal is needed for reversible entry; draw has an inline review/confirm step because settlement is final.

Lucide outlined icons at 18–22px always have text labels or accessible names. Motion is limited to small hover feedback and a pending spinner; reduced-motion disables animation. Copy names actions: Enter drop, Run draw, Collect item, Look up code. Always state demo/setup/server status accurately. No invented live odds or Sui transactions. The /demo walkthrough is a separately labelled, browser-only teaching example with scripted outcomes and arithmetic odds; it never creates database entries. Public empty states lead visitors to this walkthrough, with organiser actions secondary.

## Do's and Don'ts

- Do make every recorded weight and winner inspectable.
- Do give failures a persistent explanation and a retry path.
- Don't claim verified identity or liveness before the server confirms it.
- Don't display demo history as real participation.
