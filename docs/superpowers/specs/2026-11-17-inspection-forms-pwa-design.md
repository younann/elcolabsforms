# Inspection Forms PWA — Design

Date: 2026-11-17
Status: draft, builder check done, awaiting approval

## 1. Intent and why

The lab runs fire-safety inspections using five Word checklists (in `files/`). Today they are
printed, handed to inspectors, filled by hand, and returned to the office late. The goal is a
fast, automated path from site to signed report: the inspector fills the form on their phone or
tablet, sends it, an admin reviews and approves it, and a company-signed PDF is emailed
automatically.

Success: forms reach the office the same day they are filled, no retyping, and every emailed
report has been reviewed and carries the company signature.

## 2. Users

| Role | Who | Count |
|---|---|---|
| Admin | the developer and the business owner | 2 |
| Inspector | field inspectors | up to 4 |

No self sign-up. Admins create inspector (and admin) accounts with a username and password.

## 3. Goals

- Hebrew, right-to-left web app, installable as a PWA on iOS and Android.
- Works and looks right on phones, tablets and desktop (admin review is often on desktop).
- Username/password login; accounts managed by admins.
- The five forms from `files/`, fixed in code:
  1. `T-20001-1` — fire detection checklist, ת"י 1220 part 3
  2. `T-20004-5` — emergency systems operation regime, מכ"ר 536
  3. Standalone smoke detectors (גלאים עצמאיים)
  4. Aerosol fire suppression (כיבוי אש בארוסול)
  5. Gas fire suppression (כיבוי אש בגז)
- Inspector can: fill a form, sign with finger, attach photos, draw a sketch (where the form has
  a drawing area), save as draft, send for review.
- Review flow (decided: option B — admin approves first):
  `draft → submitted → (returned → draft → submitted)* → approved → emailed`
  - On submit: admins get a short "new form waiting for review" email with a link.
  - Admin reviews, may edit fields, may return it to the inspector with a note, or approves.
  - On approve: PDF generated with the company signature/stamp image, emailed to the single
    configured recipient address. Only the approved PDF is sent to the recipient.
- History: inspectors see their own submissions; admins see all. Any submission can be
  duplicated into a new draft (same site, next inspection).
- Admin settings: recipient email, company stamp image (uploaded once, printable),
  company name/header details shown on the PDF.
- Signatures (decided):
  - Inspector signs each form with a finger in the form's inspector box; may reuse a saved
    personal signature instead of redrawing.
  - Each admin uploads their own signature once (profile).
  - On approval, the approving admin's name, signature and date fill the approver box
    (שם המאשר / ראש תחום, or an added approver block on forms that have none), and the company
    stamp is placed at the bottom of the last page.
- Test number (מס' בדיקה) is typed by the inspector, as on paper. No server-side sequence.
  Duplicating a submission clears it.
- Corrections (decided): an admin can reopen an emailed report as a revision. It keeps the same
  test number with a suffix (`Rev 1`, `Rev 2`…), goes through review/approve again, and the new
  PDF is emailed marked as a correction. Earlier PDFs are kept and viewable.
- Admin edits are recorded per field (who, field, old → new, when). The inspector does not
  re-sign after admin edits.
- Send-for-review validation: every check row answered (ב"י/ל"ר always available, with a
  "mark rest of section as ב"י" button), core header fields filled (date, test number, site
  name, site address, customer name), inspector signature present.
- Install banner: shown after first successful login when the app is not installed.
  - Android/Chromium: captures `beforeinstallprompt`; the banner's button triggers the native
    install prompt (one tap).
  - iOS: no programmatic install exists. The banner shows a short visual guide
    (Share → "Add to Home Screen"). This limitation was explained and accepted.
  - Dismissible; re-shown after a few days if still not installed; never shown in standalone mode.
- Update banner: when a new service worker is waiting, show "גרסה חדשה זמינה" with a refresh
  button. Before reloading, the current draft is saved. Check for updates on app focus and
  periodically.

## 4. Non-goals (this phase)

- Offline submission / background sync. (Drafts are saved to the server while online; a local
  copy in the browser is kept only as a crash/refresh safety net.)
- Admin-editable form builder. Forms change only through code.
- Multiple recipients, per-form recipients, or customer email addresses.
- The separate scenarios document T-20004-5.1 referenced by form 536 (skipped for now).
  The scenario tables in 536 §7.2 are built as inspector-added matrix tables
  (action rows × device columns, values + / למ / - / לח, with table number and location).
- Native app store apps.
- Push notifications.

## 5. Anti-goals

- Hebrew/number text that renders reversed or scrambled in the PDF.
- Losing an inspector's half-filled form (refresh, update, logout, timeout).
- A report leaving the company without admin approval.
- A UI that feels like a desktop web form squeezed onto a phone (tiny radio buttons, zooming
  inputs, content under the notch).

## 6. Constraints

- Hosting: Netlify. Database: Neon Postgres. (Given.)
- Language: Hebrew only, `dir="rtl"`, `lang="he"`.
- Must work on iOS Safari (incl. installed PWA) and Android Chrome; tablets in both orientations.
- Design guided by the `emil-design-eng` and `design-taste-frontend` skills; mobile polish per
  the `mobile-native` skill.

## 7. Approaches considered

| # | Approach | Trade-off | Outcome |
|---|---|---|---|
| 1 | React SPA (Vite) + Netlify Functions + Neon; PDF rendered from HTML by headless Chromium in a function | Perfect Hebrew/RTL and identical look to the app's print view; a few seconds per PDF | **Chosen** |
| 2 | Next.js on Netlify; PDF drawn with react-pdf | Weak RTL/bidi support in react-pdf; SSR gives no benefit to a logged-in app | Rejected |
| 3 | Either stack, output .docx instead of PDF | Native Hebrew in Word, but layout shifts across viewers and editable file is weaker as a signed report | Rejected (could add .docx alongside later) |

## 8. Architecture (decided parts)

- **Frontend:** React + TypeScript, Vite, `vite-plugin-pwa` (prompt-style updates), React Router.
- **Backend:** Netlify Functions (TypeScript). PDF generation + email run after approval,
  ideally in a Netlify **background function** so approval returns immediately; submission status
  shows `approved → sending → emailed` or `send_failed` with a retry button. The Netlify plan is
  not yet known: the builder verifies whether background functions and the Chromium bundle fit
  the account's limits, and if not, runs generation in a regular function with the same status
  tracking.
- **PDF:** `puppeteer-core` + `@sparticuz/chromium`, rendering a print-specific HTML template
  with an embedded Hebrew font (e.g. Heebo/Rubik), A4, page numbers, form document number and
  revision (e.g. `T-20001-1`, `T-20004-5`) and company header in the page header/footer.
  Clean consistent layout, not a pixel copy of the Word files (agreed). Sketches render in place;
  photos go in an appendix at the end, scaled to keep the PDF email-sized.
- **Database (Neon):** users, sessions, settings, submissions (form answers as `jsonb` +
  `form_id` + `form_version`), attachment records, audit of status changes.
- **Files:** Netlify Blobs for photos, signatures, drawings, generated PDFs, company stamp.
  Served only through an authorised function.
- **Email:** no company domain exists, so mail is sent through a dedicated Gmail account via
  SMTP (Nodemailer) with a Google app password (requires 2-step verification on that account).
  Credentials live in Netlify environment variables. Gmail's daily sending limit is far above
  this volume.
- **Auth:** passwords hashed (argon2/bcrypt), server-side sessions in Postgres, httpOnly
  Secure SameSite cookie, login rate-limiting, role checks on every function. First admin created
  by a seed script using env vars.

## 9. Forms model

Each form is a TypeScript definition (sections → fields) rendered by one generic renderer in
the app and one generic renderer in the PDF template. Field types needed (from reading the docs):

- `text`, `textarea`, `number`, `date`, `time`
- `check` — a row with clause number (סעיף), topic, requirement text and an answer from a
  per-form answer set, plus an optional note:
  - כן / לא / ב"י (1220, aerosol, gas)
  - מתאים / לא מתאים / ל"ר (536)
  - קיים / לא קיים + פעיל / לא פעיל (536 firefighter panel)
  - conclusion column (standalone detectors)
  - some checks embed small inline inputs (e.g. "discharge delay ___ seconds", lab name +
    certificate number)
- `single-choice` — e.g. risk level 1/2, new building / periodic inspection, main/secondary panel
- `equipment-table` — fixed device-type rows × (manufacturer, model, quantity)
- `repeating-table` — inspector adds rows (apartments: floor/apt/qty/location; protected spaces:
  description/location/risk/dimensions/volume/agent weight; electrical panels; participants;
  documents list; 536 scenario tables)
- `connected-systems` — system × yes/no grid (1220 §8.1)
- `contact-ack` — name/role/phone/time + signature (fire-service notification acknowledgements)
- `signature` — finger-drawn on canvas
- `photos` — multiple, compressed client-side before upload
- `drawing` — freehand sketch canvas, optional photo instead (aerosol: one installation diagram;
  gas: two "תרשים התקנה בפועל" areas)
- `scenario-matrix` — 536 §7.2: repeatable tables of action rows × device columns

The Word files in `files/` are the source of truth for every section, field label, check text and
clause number; the builder transcribes them into definitions. Each definition carries a
`version` so old submissions keep rendering correctly after a form changes.

Shared header block across forms (date, test number, order number, start/end time, site name and
address, building purpose, גוש/חלקה/מגרש, owner, customer, installer details) is defined once and
reused, with per-form differences.

## 10. Screens

- Login.
- Inspector home: "new form" (5 form cards), my drafts, sent/returned/approved list with status.
- Form fill: sticky section navigator with progress, large segmented answer buttons for checks,
  autosave indicator, "send for review" with validation of required fields.
- Submission view (read-only + duplicate).
- Admin: review queue, submission review/edit with approve / return-with-note, all submissions
  with filters (form, inspector, status, date), users (create, reset password, disable),
  settings (recipient email, company stamp, company header details); each user's profile holds
  their saved signature. On an emailed report: "reopen as revision".

## 11. Left to the builder

- Exact visual design within the named skills.
- Folder structure, ORM/query layer (e.g. Drizzle), validation library, test tooling.
- Exact install-banner re-show interval and update-check interval.
- Photo compression size, maximum photos per form.
- Whether to offer a "mark remaining in section as ב"י" shortcut (recommended for the 130-row
  1220 form).
- Session length (long, e.g. 30 days, so inspectors are not logged out in the field).

## 12. Verification expectations

- Unit tests for form definitions (every check has an id, clause and answer set) and status
  transitions/permissions.
- End-to-end tests on phone and tablet viewports: login, fill, sign, photo, submit, return,
  approve, PDF generated, email sent (email mocked).
- Visual check of each of the five PDFs with real Hebrew data mixing numbers and English.
- Manual check on a real iPhone (Safari + installed) and a real Android phone: install banner,
  update banner, signature, camera, safe areas.
