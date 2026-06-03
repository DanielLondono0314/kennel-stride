---
name: KennelOps
description: Warm-but-professional operations software for dog boarding and daycare.
colors:
  primary: "#1b2b4d"
  primary-foreground: "#f7fafc"
  accent: "#f59e0b"
  accent-foreground: "#41200a"
  background: "#f8fafc"
  foreground: "#0f172a"
  card: "#ffffff"
  muted: "#f3f4f6"
  muted-foreground: "#6b7280"
  border: "#e5e7eb"
  destructive: "#ef4444"
  success: "#16a34a"
  warning: "#f59e0b"
  info: "#0ea5e9"
  sidebar-bg: "#0f172a"
  status-scheduled: "#0ea5e9"
  status-checked-in: "#16a34a"
  status-in-progress: "#f59e0b"
  status-ready: "#8159e6"
  status-completed: "#6b7280"
  status-requested: "#b45fd9"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "16px"
  status-badge:
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

# Design System: KennelOps

## 1. Overview

**Creative North Star: "The Warm Operations Desk"**

KennelOps is the front desk of a serious small business that genuinely cares about animals. The surface reads like a calm, well-run reception counter: a deep slate backbone for structure and trust, with a single warm amber as the color of action. It is dense enough to run a floor of dogs at speed, but never cold or clinical. Warmth comes from light, generous neutrals and a careful semantic color language, not from mascots or cartoon color.

Three roles share this desk: owner, care staff, and pet owner. The system serves all three by staying legible under quick, distracted, sometimes one-handed use, while keeping critical data (medication, allergies, aggression, billing) impossible to overlook. Depth is conveyed through tonal layering and hairline borders, not heavy shadow.

This system explicitly rejects four things: the **generic AI SaaS dashboard** (identical card grids, hero-metric template, random gradients), **dated veterinary software** (dense gray tables, 2000s UX), **childish pet apps** (emoji noise, cartoon palettes), and **cold corporate banking** (navy with no warmth). KennelOps sits in the narrow band between all four.

**Key Characteristics:**
- Slate structure, amber action: one warm accent carries intent.
- Operational density without clutter; speed is a feature.
- Semantic status colors are a first-class language, not decoration.
- Warm neutrals and light surfaces; humane, not cute.
- Flat by default; depth from layering and 1px borders.

## 2. Colors

A restrained palette: deep slate neutrals, one amber accent, and a disciplined set of semantic colors reserved for status and flags.

### Primary
- **Slate Ink** (`#1b2b4d`, `--primary: 222 47% 20%`): Primary actions, active nav, headings on light surfaces. The structural, trustworthy backbone.

### Secondary
- **Warm Amber** (`#f59e0b`, `--accent: 38 92% 50%`): The single action accent: primary CTAs, highlights, in-progress status, the sidebar's active marker. Its scarcity is what makes it read as "act here."

### Tertiary (semantic status, used only for state)
- **Scheduled Sky** (`#0ea5e9`): reservation scheduled / info.
- **Checked-in Green** (`#16a34a`): success, dog checked in.
- **Ready Violet** (`#8159e6`): ready for pickup.
- **Requested Orchid** (`#b45fd9`): pending request.
- **Completed Gray** (`#6b7280`): done, archived.

### Neutral
- **Canvas** (`#f8fafc`, `--background: 210 20% 98%`): app background; a cool-tinted off-white, never pure white.
- **Card White** (`#ffffff`, `--card`): elevated surfaces and panels.
- **Ink** (`#0f172a`, `--foreground`): primary text.
- **Muted Surface** (`#f3f4f6`) / **Muted Text** (`#6b7280`): secondary backgrounds and supporting text.
- **Hairline** (`#e5e7eb`, `--border`): borders, inputs, dividers.
- **Sidebar Night** (`#0f172a`, `--sidebar-background`): the dark navigation rail anchoring the app shell.

### Named Rules
**The One Amber Rule.** Amber is the only attention color. If two things on a screen are amber, one of them is wrong. Status colors are reserved for status; never borrow them for decoration.

**The No Pure White Rule.** The canvas is `#f8fafc`, never `#ffffff`. White is reserved for cards lifting off that canvas. (Note: the canvas tint is currently cool; PRODUCT.md's "warm but professional" target may warrant a faint warm shift, tracked as a finding.)

## 3. Typography

**Display Font:** Inter (with system-ui, -apple-system fallback)
**Body Font:** Inter
**Label Font:** Inter

**Character:** A single, humanist sans across the whole system. Inter is neutral, highly legible at small sizes, and carries operational density without feeling sterile. Hierarchy comes from weight and scale, not from a second family. OpenType `rlig` and `calt` are enabled for clean rendering.

### Hierarchy
- **Display** (700, 1.875rem / 30px, tracking -0.02em): page titles (`h1`). Tight tracking keeps big slate text confident.
- **Headline** (600, 1.5rem / 24px): section headers (`h2`).
- **Title** (600, 1.125rem / 18px): card and group titles (`h3`).
- **Body** (400, 1rem / 16px, line-height 1.5): default reading text. Cap measure at 65–75ch.
- **Label** (500, 0.75rem / 12px): status badges, metadata, form labels. Used uppercase or sentence case, never both on one screen.

### Named Rules
**The Weight-Not-Family Rule.** Hierarchy is expressed through Inter's weights (400/500/600/700) and scale, never by introducing a second typeface.

## 4. Elevation

Flat by default. Surfaces rest on the canvas with a 1px hairline border (`#e5e7eb`) and, at most, a soft `shadow-sm`. Depth is primarily tonal: cards are white on the `#f8fafc` canvas, the sidebar is near-black. Shadow is a response to state, not a decoration at rest.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 1px 2px rgba(15,23,42,0.05)` / `shadow-sm`): default elevated surface.
- **Hover lift** (`shadow-md` + `border-primary/20`): KPI cards and interactive cards on hover only.

### Named Rules
**The Flat-At-Rest Rule.** Surfaces are flat with a hairline border at rest. Shadow appears only on hover, focus, or for floating layers (popover, dropdown, dialog). If it looks like a 2014 app, the shadow is too dark and the blur is too tight.

## 5. Components

### Buttons
- **Shape:** gently rounded (8px, `rounded-md`).
- **Primary:** Slate Ink (`#1b2b4d`) background, near-white text, 8px 16px padding. The default confident action.
- **Accent:** Warm Amber (`#f59e0b`) for the single most important CTA on a view (e.g. "Check in", "New reservation").
- **Hover / Focus:** subtle background darken; visible focus ring using `--ring`. Never remove the focus outline.
- **Secondary / Ghost:** warm-gray (`--secondary`) or transparent with hairline border for low-emphasis actions.

### Chips / Status Badges
- **Style:** pill (`rounded-full`), 12px medium label, tinted background at ~10% of the status hue with the full-strength hue as text (`.status-*` pattern). Signature component of the system.
- **State:** one badge = one status. Color maps to the workflow stage (scheduled → checked-in → in-progress → ready → completed; requested for pending).

### Cards / Containers
- **Corner Style:** 10px (`rounded-lg`).
- **Background:** Card White on Canvas.
- **Shadow Strategy:** `shadow-sm` at rest, `shadow-md` on hover for interactive cards (see Elevation).
- **Border:** 1px Hairline (`#e5e7eb`), shifting to `primary/20` on hover.
- **Internal Padding:** 16px (`md`).
- **Never nest cards.** A card inside a card is always wrong; use spacing or a hairline divider instead.

### Inputs / Fields
- **Style:** Card White background, 1px Hairline border, `rounded-md`.
- **Focus:** border shifts to `--ring` (Slate Ink) with a focus ring. Always keyboard-visible.
- **Error:** `--destructive` border and message; pair color with text, never color alone.

### Navigation
- **Style:** dark Sidebar Night rail. Items in muted slate text; active item marked with Warm Amber. Hover lifts to `--sidebar-accent`.
- **Mobile:** rail collapses; preserve the amber active marker and keyboard order.

### Flag Indicators (signature)
- Small dots / badges for **critical** (red), **warning** (amber), **info** (sky), **success** (green). Used to surface medication, allergies, and aggression on dog records. These are safety-critical; pair the dot with a text label, never rely on color alone.

## 6. Do's and Don'ts

### Do:
- **Do** keep the canvas off-white (`#f8fafc`) and reserve `#ffffff` for cards.
- **Do** use Warm Amber (`#f59e0b`) for exactly one primary action per view.
- **Do** pair every status/flag color with a text label (WCAG AA, color-blind safe).
- **Do** keep surfaces flat at rest; add shadow only on hover/focus/floating layers.
- **Do** express type hierarchy with Inter weights and scale.
- **Do** keep critical dog data (medication, allergies, aggression) visually unmissable.

### Don't:
- **Don't** build the **generic AI SaaS dashboard**: identical card grids, the hero-metric template (big number + small label + gradient), or random gradients.
- **Don't** regress to **dated veterinary software**: dense gray tables, hairline-only data dumps, 2000s form layouts.
- **Don't** go **childish**: no pet emoji noise, cartoon palettes, or playful colors that undercut the business.
- **Don't** go **cold corporate**: slate is structure, not the whole mood; keep warm neutrals and amber present.
- **Don't** use a colored `border-left`/`border-right` greater than 1px as an accent stripe. Use full borders, tints, or leading icons.
- **Don't** use gradient text (`background-clip: text`) or decorative glassmorphism.
- **Don't** nest cards, or reach for a modal before exhausting inline/progressive options.
