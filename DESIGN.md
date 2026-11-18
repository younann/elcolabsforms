---
name: ELCO
description: Native-iOS field app for a fire-safety lab, Hebrew RTL, crimson tint on grouped lists and frosted bars.
colors:
  ground: "#f2f2f7"
  group: "#ffffff"
  group-2: "#e9e9ef"
  border: "#d8d8de"
  border-strong: "#c2c2c9"
  ink: "#0b0b0d"
  ink-muted: "#63636a"
  crimson: "#c8102e"
  crimson-hover: "#ad0d27"
  crimson-soft: "#fbe6ea"
  crimson-fill: "#c8102e"
  gold: "#8f6c0e"
  success: "#1e7b3c"
  success-soft: "#e1f3e6"
  warning: "#9a5b00"
  warning-soft: "#fdf0d9"
  info: "#0a5bc4"
  info-soft: "#e3eefc"
  ground-dark: "#000000"
  group-dark: "#1c1c1e"
  group-2-dark: "#2c2c2e"
  border-dark: "#38383a"
  border-strong-dark: "#4a4a4e"
  ink-dark: "#f5f5f7"
  ink-muted-dark: "#a1a1a8"
  crimson-dark: "#ff4d63"
  crimson-hover-dark: "#ff6a7c"
  crimson-soft-dark: "#3b1219"
  gold-dark: "#e2bd52"
  success-dark: "#4cd27a"
  success-soft-dark: "#13301d"
  warning-dark: "#ffb340"
  warning-soft-dark: "#352510"
  info-dark: "#5aa7ff"
  info-soft-dark: "#102a47"
typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, 'Noto Sans Hebrew', 'Arial Hebrew', Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  row:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, 'Noto Sans Hebrew', 'Arial Hebrew', Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, 'Noto Sans Hebrew', 'Arial Hebrew', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  callout:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, 'Noto Sans Hebrew', 'Arial Hebrew', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, 'Noto Sans Hebrew', 'Arial Hebrew', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
  tab-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, 'Noto Sans Hebrew', 'Arial Hebrew', Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  ctl: "12px"
  box: "16px"
  segment: "7px"
  pill: "9999px"
spacing:
  gutter: "16px"
  row-min: "44px"
  tab-bar: "56px"
  nav-bar: "56px"
  action-tile: "56px"
components:
  button-primary:
    backgroundColor: "{colors.crimson-fill}"
    textColor: "#ffffff"
    rounded: "{rounded.ctl}"
    padding: "0 16px"
    height: "44px"
  button-primary-lg:
    backgroundColor: "{colors.crimson-fill}"
    textColor: "#ffffff"
    rounded: "{rounded.ctl}"
    padding: "0 20px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.group-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.crimson}"
    rounded: "{rounded.ctl}"
    height: "44px"
  group-list:
    backgroundColor: "{colors.group}"
    rounded: "{rounded.box}"
  segmented:
    backgroundColor: "{colors.group-2}"
    rounded: "{rounded.ctl}"
    padding: "4px"
  segmented-selected:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    rounded: "{rounded.segment}"
    height: "44px"
  status-badge-submitted:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  banner-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.box}"
    padding: "12px 16px"
  action-tile-waze:
    backgroundColor: "{colors.group}"
    textColor: "{colors.info}"
    rounded: "{rounded.ctl}"
    height: "56px"
  action-tile-whatsapp:
    backgroundColor: "{colors.group}"
    textColor: "{colors.success}"
    rounded: "{rounded.ctl}"
    height: "56px"
---

# Design System: ELCO

## Overview

**Creative North Star: "The Stock App"**

ELCO looks like an app Apple could have shipped, at the craft of Apple's own apps, Wolt and Linear. The ground is the iOS grouped palette; content sits in inset groups with hairline separators; bars are frosted; task pages push in; sheets rise from the bottom. The old web look (IBM Plex, signal-orange, bordered stacked cards, flat header) is gone and must not return.

It serves inspectors on phones in sun, basements and one-handed use, and admins at a desk. So: system type at 16-17px, 44px minimum targets, high contrast, true-black dark mode, full RTL (logical properties, `-ms`/`-me`, `inset-inline`).

**Key Characteristics:**
- System font stack only; Hebrew falls back to Noto Sans Hebrew / Arial Hebrew.
- One rounded group per list section, not a card per item.
- Crimson is the tint; gold exists only in the shield mark and the login wordmark.
- Frosted nav and tab bars (`.material`), 0.5px separators.
- Press feedback is a row highlight in lists, a 0.97 scale on standalone controls.

## Colors

A cool-grey iOS grouped palette with one crimson tint, status colours that carry meaning only, and a dark mode on true black.

### Primary
- **ELCO Crimson** (#c8102e light, #ff4d63 dark; `--accent`): text-level tint. Links, active tab, ghost buttons, focus ring, caret, selection, back chevron.
- **Crimson Fill** (#c8102e both modes; `--accent-fill`): the background of filled primary/accent buttons and selected accent segments. White label on it passes 4.5:1 in both modes.
- **Crimson Soft** (#fbe6ea / #3b1219): ghost hover wash, danger-soft surfaces.

### Secondary
- **Shield Gold** (#8f6c0e light, #e2bd52 dark; `--gold`): the "ELCO" wordmark beside the shield and on the login screen. Nowhere else.

### Neutral
- **Grouped Ground** (#f2f2f7 / #000000): page background.
- **Group White** (#ffffff / #1c1c1e): group-list and sheet surface.
- **Group Fill 2** (#e9e9ef / #2c2c2e): secondary buttons, segmented track, pressed row.
- **Ink** (#0b0b0d / #f5f5f7) and **Muted Ink** (#63636a / #a1a1a8): text. `--ink` also fills the default selected segment.
- **Hairline** (`rgb(60 60 67 / 0.2)` light, `rgb(84 84 88 / 0.6)` dark; `--separator`): row and bar dividers. `--border` #d8d8de / #38383a and `--border-strong` #c2c2c9 / #4a4a4e for inputs.
- **Material** (`rgb(249 249 252 / 0.78)` / `rgb(22 22 24 / 0.74)`) and **Scrim** (`rgb(0 0 0 / 0.36)` / 0.6): bars and sheet backdrop.

### Status (meaning only)
Success #1e7b3c / #4cd27a, Warning #9a5b00 / #ffb340, Info #0a5bc4 / #5aa7ff, each with a `-soft` tint (#e1f3e6, #fdf0d9, #e3eefc; dark #13301d, #352510, #102a47). Danger text is crimson (#c8102e / #ff4d63), danger buttons use `--danger-fill` #c8102e.

### Named Rules
**The Accent vs Accent-Fill Rule.** `--accent` is for text, icons and outlines on a surface; it brightens in dark mode (#ff4d63). `--accent-fill` is for any surface that carries a white label; it stays #c8102e in dark mode so contrast holds. Never put white text on `--accent`, never use `--accent-fill` as text colour on dark.

**The Gold-Only-In-The-Mark Rule.** `--gold` is for the shield wordmark and login. Never for buttons, badges, highlights or status.

**The Meaning-Only Status Rule.** Green, amber and blue appear only when they mean success, attention or in-progress/info. Decorative use is out.

## Typography

**Display / Body / Label Font:** system stack, `-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, 'Noto Sans Hebrew', 'Arial Hebrew', Arial, sans-serif`. No web fonts.

**Character:** native and quiet. Hierarchy comes from weight and size, never from a second family. `h1` tracks -0.02em; the ELCO wordmark tracks +0.08em (login +0.12em) in LTR.

### Hierarchy
- **Large title** (700, 28px, 1.25; 32px from `sm`): page title ("שלום, name").
- **Row / button lg** (400-600, 17px): list rows, large buttons, back link, sheet rows.
- **Body** (400, 16px, 1.5): default text; inputs are never below 16px (no iOS zoom).
- **Callout** (500, 15px): nav items, banners, secondary row text, counts.
- **Label** (600, 13px): badges, action-tile captions, role captions.
- **Tab label** (500, 11px, 12px when four or fewer tabs): bottom bar.

Numbers in counts use `tabular-nums`.

### Named Rules
**The System Face Rule.** The stack is the brand. Introducing a web font is a regression to the old look.

## Layout

Single column on phones inside `safe-x` padding (`max(1rem, safe inset)`), content capped at `max-w-5xl`. Below `lg` the shell is a frosted top bar (56px, safe-top aware) plus a frosted bottom tab bar (min 56px per tab, safe-bottom aware, "more" tab when over four); from `lg` a sidebar replaces both. Targets are at least 44px; action tiles 56px. Section rhythm is large title, then grouped sections separated by whitespace, with inset-from-leading separators at 1rem.

Page entrance is route-based. **Route-tab:** tab pages settle in place, 260ms, from opacity 0.4 and translateY(6px). **Route-push:** task pages slide in from the leading side, 380ms, from opacity 0.6 and translateX(-28%) (RTL leading edge), `cubic-bezier(0.23, 1, 0.32, 1)`. Both are disabled under reduced motion.

## Elevation & Depth

Depth is tonal plus a soft shadow on groups, and translucency on bars. Groups carry `--shadow-card` (in dark mode this collapses to a 0.5px white ring at 6%). Bars use the **material**: translucent fill, `saturate(180%) blur(20px)`, 0.5px separator on the content edge. Sheets use `--shadow-sheet`; desktop dialogs use `--shadow-pop`.

### Shadow Vocabulary
- **Card** (`0 1px 2px hsl(240 10% 20% / .06), 0 6px 20px -8px hsl(240 10% 20% / .14)`): group lists, action tiles.
- **Sheet** (`0 -1px 0 hsl(240 10% 20% / .05), 0 -16px 48px hsl(240 10% 20% / .16)`): bottom sheet.
- **Pop** (`0 1px 2px hsl(240 10% 20% / .08), 0 16px 40px hsl(240 10% 20% / .18)`): centered dialog from 768px.

### Named Rules
**The Frosted-Bars Rule.** Nav and tab bars always use `.material`, never an opaque flat fill.

## Shapes

Two radii carry everything: **ctl 12px** (buttons, segmented track, tiles, inputs) and **box 16px** (groups, banners, sheets top corners). Segment thumb 7px (12px track minus 4px padding, optically concentric); badges and dismiss targets are full pills/circles. Groups clip rows (`overflow: hidden`), so rows themselves have no radius, border or shadow.

## Components

### Group list (`.group-list`)
The signature container. One white rounded (16px) group; each `li` is a borderless row; a 0.5px `--separator` line runs between rows, inset from the leading edge by 1rem. Press = row background `--surface-2` (no scale). Hover (pointer devices) = 55% mix of surface-2 into surface.

### Buttons
- **Shape:** 12px radius, semibold, min-height 44px (md, 16px text) or 52px (lg, 17px).
- **Primary / Accent:** `--accent-fill` with white label; hover opacity .9.
- **Secondary:** `--surface-2` with ink label. **Ghost:** transparent, crimson label, crimson-soft hover. **Danger:** `--danger-fill`.
- **Press:** `active:scale-[0.97]`, 150ms `--motion-out`; disabled at 50% opacity; loading shows a spinner and `aria-busy`.

### Segmented control
Grid of equal cells in a `--surface-2` 12px track with 4px padding; selected cell is a 7px-radius fill (ink by default, tone-coloured success/danger/warning, or accent-fill). 44px (md) or 48px (lg). Roving tabindex, arrow keys follow RTL.

### Status badge
Full pill, 13px semibold, `-soft` background with its status colour as text (draft is surface-2 + muted). Seven states: draft, submitted, returned, approved, sending, emailed, send_failed.

### Banner
16px-radius box, soft tint with 25% border of the tone, filled 20px Phosphor icon, 15px text, optional 44px round dismiss.

### Action tiles (WhatsApp, Waze)
56px tiles on `--surface` with card shadow, icon over a 13px semibold label. WhatsApp uses success colour (filled Phosphor icon); Waze uses info colour. Press dims to 60% opacity instead of scaling. The compact Waze variant is a 44px row with `info-soft` fill. Waze arrow is mirrored for RTL.

### Sheet
Native `<dialog>`: bottom sheet on phones (top corners 16px, 420ms `--motion-drawer`, closes in 240ms, draggable, keyboard-aware via `--kb`), centered 560px dialog from 768px (scale .97 to 1, 200ms). Scrim `--scrim`.

### Navigation
Top bar: back link in crimson 17px with chevron, or the brand mark; large-title pages sit below. Bottom tabs: filled Phosphor icons, crimson when active, muted otherwise, 11-12px labels. Desktop sidebar rows: 15px medium, 44px, 12px radius.

### Toast
Drops in from the top on phones (320ms `--motion-out`), from the bottom on desktop.

### Brand mark
Flat shield (gold gradient #ecc95a to #b0861a, inner shade #7a5a0c at 35%) with a red (#d4132f) rounded-stroke "e". Wordmark "ELCO" in `--gold`, bold, +0.08em, LTR. File: `public/icons/logo.svg`.

## Motion

- **Out** `cubic-bezier(0.23, 1, 0.32, 1)` (`--motion-out`, utility `ease-snap`): press, route, toast, field flash.
- **Drawer** `cubic-bezier(0.32, 0.72, 0, 1)` (`--motion-drawer`): bottom sheet.
- **In-out** `cubic-bezier(0.77, 0, 0.175, 1)` (`--motion-in-out`): symmetric moves.
- Press 150ms; settle 260ms; push 380ms; sheet 420ms open, 240ms close. Reduced motion removes route animations, sheet and toast transforms and press scale.

## Do's and Don'ts

### Do:
- **Do** put list content in a `.group-list` with rows, not one bordered card per item.
- **Do** use `--accent-fill` for any filled surface with a white label and `--accent` for tinted text and icons.
- **Do** keep targets at 44px minimum and inputs at 16px minimum.
- **Do** use logical properties (`ms`, `me`, `inset-inline`, `border-s`) for RTL.
- **Do** use `.material` for bars, `route-push` for task pages and `route-tab` for tab pages.
- **Do** keep dark mode on true black with #1c1c1e groups.

### Don't:
- **Don't** reintroduce IBM Plex or any web font, signal-orange, or bordered stacked cards.
- **Don't** use `--gold` outside the shield wordmark and login.
- **Don't** scale whole rows or cards on press inside a group; highlight the row.
- **Don't** use status colours decoratively.
- **Don't** use an opaque flat header or tab bar.
