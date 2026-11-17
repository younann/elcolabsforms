# Clients and jobs

Date: 2026-11-17
Status: draft for approval (builder check done)

## Why

Today inspectors decide which forms to fill and type every client and site detail by hand. The admin wants to run the work instead: keep a client list, and for each inspection send an inspector a job with the forms already chosen and already filled with the client's and site's details. The inspector should hear about it at once (app notification plus a WhatsApp message from the admin's own number) and see the job as a card on their home screen.

## Goals

- Admin keeps a list of clients, each with several sites.
- Inspector accounts carry full name, email and phone.
- Admin creates a job: client, site, forms, inspector, planned date, note. The job creates one draft per form, pre-filled.
- Inspector is told: web push (built in, no third-party service) and a WhatsApp message the admin sends from their own phone with one tap.
- Inspector home shows one card per open job with its forms and their status.
- Forms are created only through admin jobs.

## Non-goals

- Automatic WhatsApp sending (Business API). The admin presses send in their own WhatsApp.
- Inspector details on the reports. The report keeps showing the inspector's name and signature as today.
- Scheduling, calendars, reminders, travel or billing.
- Client logins or client-facing pages.
- Changing the forms, the review flow, PDF/Word output or the report email.

## Anti-goals

- A sent report must never change because client or site details were edited later.
- Inspectors must not lose existing drafts or history when this ships.
- No inspector or client data sent to any third party (push goes through the browser vendors' standard push services only, payload encrypted per the Web Push standard).

## Approaches considered

- **A. Job record (picked).** New `clients`, `client_sites`, `jobs` tables; `submissions.job_id`. Client and site details are copied into each draft when the job is created. Clear home for planned date, note, job cards, completion and future job features.
- **B. Tags on forms only.** `submissions.client_id` / `site_id`, cards grouped by client+site+date. Less up front, but nowhere to keep the date and note once, and two jobs at one site on one day merge. Rejected.
- **Push: built in (picked)** using the standard Web Push protocol (`web-push` npm on the server, VAPID keys) vs a third-party service (OneSignal). The user ruled out third parties.
- **WhatsApp: one-tap `wa.me` link (picked)** vs WhatsApp Business API. Picked for zero cost, works today, really sent from the admin's number.

## Data

New tables (drizzle, one migration):

- `clients`: `id` uuid, `name` (company or person, required), `contact_person`, `phone`, `email`, `active` boolean default true, `created_at`.
- `client_sites`: `id`, `client_id` → clients (cascade), `name` (required), `address` (required), `active` default true, `created_at`.
- `jobs`: `id`, `client_id` → clients, `site_id` → client_sites, `inspector_id` → users, `planned_date` date (required), `note` text, `created_by` → users, `created_at`, `cancelled_at` nullable.
- `push_subscriptions`: `id`, `user_id` → users (cascade), `endpoint` unique, `p256dh`, `auth`, `created_at`.

Changed:

- `users`: add `email`, `phone` (both nullable text). `display_name` is the full name (label it "שם מלא" in the UI).
- `submissions`: add `job_id` nullable → jobs, indexed, `touched_at` nullable timestamp, and `job_copy` nullable integer (see Jobs: rules). Existing rows keep `null` / are treated as touched. Reopen copies `job_id` to the new revision.

Clients and sites are never hard-deleted once used; "delete" in the UI sets `active = false` and hides them from pickers. Unused ones may be hard-deleted.

## Pre-fill

When a job is created, each draft's `data` starts with:

| Form field | From |
|---|---|
| `date` | job planned date |
| `siteName` | site name |
| `siteAddress` | site address |
| `customerName` | client name |
| `customerPhone` | client phone |
| `customerEmail` | client email |

Values are copied (snapshot), so later edits to the client or site do not touch existing forms. Fields not in a form's definition are skipped. The inspector can still edit every pre-filled field. `testNumber`, `orderNumber` and everything else stay for the inspector. The contact person is not mapped to a form field; it shows on the job card and in the WhatsApp message. `mirror()` must run on the pre-filled data so `site_name` / `test_number` columns are set as for a normal save.

## Jobs: rules

- Only admins create, edit or cancel jobs. `POST /api/submissions` (inspector create) is removed; drafts are created only by the job endpoint, all-or-nothing with the job row. The DB driver (`drizzle-orm/neon-http`) has no interactive transactions, so use `db.batch` (builder's call how).
- Inspector "duplicate" (שכפול) is removed with it, since it is inspector-side form creation.
- Admin can, on an open job: change planned date and note; add forms (new pre-filled drafts); change the inspector (moves every form in the job that is still `draft` or `returned`, through the same rules as today's reassign; `submitted` and later forms stay with whoever filled them); cancel the job.
- *(my call)* Per-form reassign (the existing ReassignCard) is hidden for forms that belong to a job and the API refuses it for them; the job-level "change inspector" is the one way to move job forms, so the job and its open forms never disagree.
- *(my call)* An inspector can see a job when they own at least one of its forms; the card and job page show only their own forms. A form returned to the old inspector after a job change therefore still shows in that inspector's job card.
- *(my call)* A revision created by admin "reopen" keeps the parent's `job_id`. The job page lists the latest revision of each form (older revisions reachable from it as today). If that revision is later returned, the job counts as open again.
- Cancelling sets `cancelled_at` and deletes the job's forms that are still untouched drafts (`draft` and never saved by the inspector, i.e. `updated_at = created_at`). Any form with inspector work, or already submitted, stays and stays linked. Cancel asks for confirmation.
- *(decided)* Forms that survive a cancel stay fully usable: the inspector can still fill and send them. Their job shows on the inspector's home as a card marked "בוטלה" until none of its forms is `draft` or `returned`; the admin's job page shows the cancelled state and the surviving forms.
- *(my call)* "Untouched" is decided by an explicit marker, not timestamps: `submissions.touched_at` (nullable) set on the first inspector save (PATCH) or file upload. `updated_at = created_at` does not work here (different clocks, and uploads do not change `updated_at`).
- A job is **open** while any of its forms is `draft` or `returned`, and not cancelled. Otherwise it is **done**. This is derived, not stored. A cancelled job with forms still `draft`/`returned` shows to the inspector as a "בוטלה" card (above); to the admin it lists as cancelled.
- *(decided)* A job may include the same form more than once (e.g. two gas checks at one site). The job form takes a quantity per form (0–9), and "add forms" can add more copies. Copies are labeled by a stable `submissions.job_copy` number (1, 2, …, per form within the job; shown only when a form has more than one copy, e.g. "גז 1", "גז 2") on the card, job page, fill screen line and WhatsApp text.
- Changing the date or note after creation does not re-fill forms.

## Notifications

**Push.**

- Switch `vite-plugin-pwa` from `generateSW` to `injectManifest` with a small `src/sw.ts` that keeps today's precache and navigation fallback and adds `push` (show notification) and `notificationclick` (focus or open the app at `/jobs/:id`).
- Server: `web-push` with `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` env vars (production context on Netlify, plus `local.env`). Public key exposed to the client via an endpoint.
- Inspector home shows a one-time prompt card "הפעלת התראות" when push is supported and permission is `default`. The permission request runs from that tap. On iPhone the card only appears in the installed app (Safari tabs do not support push); in the browser it points to the install banner instead.
- Subscriptions saved per device in `push_subscriptions`; removed on logout for that device and when the push service answers 404/410.
- Sent on job created, inspector changed (to the new inspector), forms added, and job cancelled (to every inspector who still has a form in it). Payload: title "עבודה חדשה" (or the change), body client + site + date. Failures are logged and never block the admin's action.

**WhatsApp.**

- After creating a job (and on the job page any time), the admin sees "שליחה בוואטסאפ". It opens `https://wa.me/<phone>?text=<message>` in a new tab/app.
- Phone normalization for Israeli numbers: strip non-digits; `05XXXXXXXX` → `9725XXXXXXXX`; numbers already starting with `972` kept. Without a valid inspector phone the button is disabled with a hint to add the phone in "משתמשים".
- Message (Hebrew): greeting with inspector name, client name, site name and address, planned date, list of form titles, contact person and phone, the note, and a link to the job in the app (`APP_URL/jobs/:id`).

## Screens

**Admin**

- **לקוחות** (new): searchable list; add/edit client; client page shows its sites (add/edit/deactivate) and its jobs.
- **עבודות** (new): open jobs first, then done; filter by inspector and client. "עבודה חדשה" opens the job form: client picker (type-ahead like the inspector picker), site picker for that client with "אתר חדש" inline, a quantity stepper per form (the five forms, default 0), inspector picker, planned date, note. After save: job page with the WhatsApp button.
- **Job page**: details, its forms with status (links to review/view as today), edit date/note, add forms, change inspector, cancel, WhatsApp button.
- **משתמשים**: inspector create/edit gains full name label, email, phone.
- Phone bottom bar for admins becomes: לאישור · עבודות · טפסים · לקוחות · עוד. "עוד" holds משתמשים, הגדרות, פרופיל. Desktop side nav lists all.

**Inspector**

- Home: "עבודות פתוחות" first, one card per open job (client, site and address, date, contact person with tap-to-call, note, and its forms with status; each form opens the fill screen). Then returned forms not in a job, drafts not in a job (legacy), then "נשלחו" as today.
- Bottom bar: הבית · פרופיל ("טופס חדש" removed; `/new` redirects home).
- Job page `/jobs/:id` (target of push and WhatsApp link): same card content, full screen, with back.
- Fill screen shows a small line under the title: client · site, linking back to the job.

## Access

- Clients, sites, jobs endpoints: admin only, except `GET /api/jobs` and `GET /api/jobs/:id` which inspectors may call for their own jobs (job card data without other inspectors' info).
- Existing per-form access rules unchanged.

## Testing

- Unit: pre-fill mapping per form, phone normalization, WhatsApp text, open/done derivation, cancel keeps touched forms.
- API: job create is atomic (forms and job or nothing), inspector cannot create submissions or jobs, inspector sees only own jobs.
- e2e (iPhone and desktop): admin creates client and site, creates a job with two forms for an inspector; inspector sees the card, opens a form and finds the header pre-filled; WhatsApp link has the right number and text.
- Push: unit-test payload building and subscription cleanup; manual check on a real Android phone and an installed iPhone app.

## Rollout

- Apply the migration to the Neon `production` branch before pushing code (deploys on push to `main`).
- Set the three VAPID env vars on Netlify (production) before the push code ships.
- Existing inspector drafts and history stay as they are and keep working; they appear in the non-job sections.

## Left to the builder

- Endpoint shapes and file layout, following the existing `netlify/functions` and `src/pages` patterns.
- Exact copy of buttons, empty states and the WhatsApp message, in the app's existing tone.
- Whether the admin job form is a page or a sheet on phones.
- Order of building, provided the migration ships first.
