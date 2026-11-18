# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Inspectors** (up to 4): fill fire-safety inspection forms on site, on a phone or tablet. Used outdoors in direct sun (rooftops, exteriors), in dim basements and plant rooms with weak signal, often one-handed while standing or holding a tool.
- **Admins** (2: the developer and the business owner): create clients and jobs, assign inspectors, review and approve forms. Mostly at an office desk, sometimes on a phone.

## Product Purpose

Replace printed Word checklists with a fast path from site to signed report: the office opens a job, the inspector gets it on the phone with forms pre-filled, fills and sends it the same day, an admin reviews and approves, and a company-signed PDF is emailed automatically. Success: forms reach the office the same day, no retyping, every emailed report reviewed.

## Positioning

Built around the lab's own five Israeli-standard forms (ת"י 1220 part 3, מכ"ר 536, smoke detectors, aerosol, gas) and its job flow, not a generic form builder.

## Operating Context

Installed as a PWA on iOS and Android home screens, also used in desktop browsers by admins. Hebrew, right-to-left. Jobs are sent to inspectors by WhatsApp and push notification; navigation to sites via Waze. Reports are PDF/Word generated from the forms.

## Capabilities and Constraints

- React 18 + Vite + Tailwind 4 PWA on Netlify, Neon Postgres.
- Roles: admin, inspector. No self sign-up, no client logins.
- Forms are fixed in code; answers include `ב"י` (N/A) values used by reports.
- Drafts must never be lost (autosave, local copy).
- A report never leaves the company without admin approval.

## Brand Commitments

- Name: **ELCO**. Tagline: **מעבדה לבדיקות גילוי וכיבוי אש**. Home-screen label "ELCO".
- Look: native iOS feel, the category standard at full craft (chosen 2026-11-18 over three rolled directions as "not premium enough / too flat"). Craft bar: Apple's own apps, Wolt/Gett, Linear/Things 3.
- Logo: gold shield with a check-mark tail, red lowercase "e" inside it, "ELCO" in gold. The supplied file is a glossy 3D render (`/private/tmp/.../images/5.png`, to be copied into the repo); the app uses a flat redrawn version of the same shapes and colours.

## Evidence on Hand

Real forms in `files/`. No testimonials, customer logos or metrics; none may be invented.

## Product Principles

1. Field first: every inspector screen works one-handed, in sun and in the dark.
2. Never lose work.
3. Office sees what needs attention without searching.
4. Nothing reaches a client unreviewed.

## Accessibility & Inclusion

High contrast for outdoor use, large touch targets, dark mode for dim rooms, full RTL.
