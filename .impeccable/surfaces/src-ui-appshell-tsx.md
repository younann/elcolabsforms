---
version: 1
slug: "src-ui-appshell-tsx"
primary_target: "src/ui/AppShell.tsx"
related_targets: []
---

# App shell and all screens

Mode: operate. Audience: inspectors on phones in the field (sun, basements, one hand) and admins at a desk.

## Direction contract

THESIS: ELCO feels like an app Apple could have shipped: system type, grouped inset lists, frosted bars, sheets and push transitions. It refuses the "website in a frame" look (stacked bordered cards, web fonts, flat header).

OWN-WORLD: iOS grouped palette (light #f2f2f7 ground, white groups, hairline separators; dark true-black ground, #1c1c1e groups). ELCO crimson #c8102e is the tint: active tab, links, primary buttons. ELCO gold appears only in the shield mark and login. Status colours keep meaning only.

STORY: The inspector opens the app, sees today's jobs as native lists, taps in and the page pushes in from the side, navigates with Waze, fills, sends. The admin sees what needs attention in grouped sections.

FIRST VIEWPORT: Frosted nav bar with the ELCO shield mark; large bold page title; grouped inset list sections; frosted bottom tab bar with filled icons in crimson when active.

FORM: canon (standing exit, taken after the third hand), at the craft of Apple's own apps, Wolt and Linear. seed:607c3b7ab7c888f5

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: push transition on task pages (slide from the leading side, exponential ease-out) and row highlight on press inside grouped lists, instead of whole-card scaling.
