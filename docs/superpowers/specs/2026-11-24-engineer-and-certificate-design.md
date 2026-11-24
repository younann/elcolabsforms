# Engineer Approval and Inspection Certificate

## Why

The lab's real process has a second sign-off. After the office approves an inspection, a certified engineer (ראש תחום) must approve it, and only then does the office issue a signed certificate (תעודת בדיקה) to the client. Today the app stops at office approval and emails the report to one fixed address. This change adds the engineer step and the certificate, so the whole process runs in the app, with an email at each hand-off.

## Flow (decided)

1. Admin opens a job for a client and assigns an inspector. Unchanged.
2. Inspector fills the form and submits. **The admin gets an email.**
3. Admin reviews: returns to the inspector (unchanged) or approves. **Approving builds the report PDF and emails it to the engineer(s).**
4. Engineer, logged into the app with their own account, reviews the report: approves (signs with their saved signature) or returns it to the admin with a note. **On approval the admin gets an email.**
5. Admin opens "issue certificate": a short form pre-filled from the inspection, edits/completes it, and issues. **The certificate PDF is built and emailed to the client.**

## Goals

- New role `engineer` with own login, a list of forms waiting for them, approve / return.
- Certificate PDF matching the approved 1220 example (`files/FD260666-…pdf`, example rendered in this session): ELCO logo, ISRAC logo, header box (edition, page x of 2), number, all data tables, conclusion, defects, fixed legal text, inspector + engineer names and signatures, company stamp.
- Emails at each hand-off (steps 2, 3, 4, 5).
- Status of every form always visible as today (badge, lists, overview).

## Non-goals

- Certificates for 536, detectors, aerosol, gas: the user will provide samples later. The design must make adding one a matter of a new template + field mapping, no flow change.
- Reissuing / correcting a certificate after it was sent.
- Engineer approval by email link without login.
- Prices, invoices.

## Anti-goals

- An engineer approval without the engineer's signature.
- Two certificates with the same number.
- A certificate sent to the wrong client, or sent without the engineer's approval.
- Breaking forms already in the old flow (`sending` / `emailed` / `send_failed` from before this change).

## Constraints

- Hebrew RTL, components from `src/ui`, phone first (engineer will likely use a phone).
- PDF via the existing `htmlToPdf` (puppeteer + chromium) pipeline; mail via existing `sendMail` (respects `MAIL_MODE`).
- No new dependencies. DB changes via a drizzle migration.
- Commits as `younann <younan.n@gmail.com>`, no AI mention.

## Approaches

- **A (chosen): extend the form status + a `certificates` table.** New statuses on `submissions` keep one visible state per form; the certificate is its own record (unique number, fields, PDF, sent-to), leaving room for reissue later.
- B: same statuses, certificate fields as columns on `submissions`. Rejected: locks one certificate per form, reissue awkward.
- C: a generic configurable approvals table. Rejected: much more to build for one fixed flow.

## Design

### Roles

- `users.role` gains `'engineer'` (`shared/status.ts` `Role`, the TypeScript enum on the schema, users admin screen role picker, zod on user create/update). `role` is a plain text column, so no migration for this. The self-demotion guard in `users.mts` (admin cannot change own role) must cover `engineer` too.
- Engineer sees: home = "ממתינים לאישורי" list + recently approved by them; can open a waiting form read-only (existing `SubmissionView` / review view) and its report PDF; profile (saved signature, as every role has today). Engineer cannot see clients, jobs, users, settings, export, or forms not in their queue or already approved by them.
- Any engineer can approve any waiting form (my call: the lab has one or few engineers; no per-form assignment).

### Statuses

Old flow kept as is for existing rows. New chain:

```
draft → submitted ─(admin approve)→ sending ─(report built, mailed to engineers)→ engineer_review
                                              └─(mail/pdf fails)→ send_failed ─(admin retry)→ sending
engineer_review ─(engineer approve)→ engineer_approved
engineer_review ─(engineer return + note)→ submitted   (note shown to admin; audit records who)
engineer_approved ─(admin issue certificate)→ cert_sending → certified
                                                          └→ cert_failed ─(admin retry)→ cert_sending
```

- `submitted` keeps meaning "waiting for the admin". An engineer return lands there with the note in `reviewNote` and an audit row `engineer_return`, so the admin sees why (my call: no extra status).
- Admin approve sets `approvedBy`/`approvedAt` (the report's "מאשר" stays the admin, as today). `approvedAt` is set only when empty, so a re-approval after an engineer return keeps the first date and the monthly export does not move the form to another month.
- **Old rows:** new boolean column `needsEngineer` (default false), set true by the new approve. The report job branches on it: false → old path (mail the office, end `emailed`), true → new path. Rows approved before the deploy (`sending`, `send_failed`, `emailed` retry) finish the old way (my call).
- **Report access:** today a non-admin can download the report only at `emailed`. New rule: the inspector who owns it may download from `engineer_review` onward (and at `emailed` as now); an engineer may view/download forms in `engineer_review` and ones they approved. The inspector may also download the issued certificate (my call).
- New columns on `submissions`: `engineerId`, `engineerApprovedAt`.
- `emailed` (old flow end) stays a valid final state and `reopen` keeps working from it. Reopen is not offered for new-flow rows (`engineer_review` onward) in this change.
- `StatusBadge` labels: `engineer_review` "אצל המהנדס", `engineer_approved` "אושר ע"י מהנדס", `cert_sending` "שולח תעודה", `certified` "תעודה נשלחה", `cert_failed` "שליחת התעודה נכשלה".
- `jobState` treats the new states as not pending for the inspector (job is done once the admin approved), unchanged rule.

### Emails

| When | To | Content |
|---|---|---|
| Inspector submits | settings `recipientEmail` (the office) | **already exists** (`notifySubmitted` in `server/mail.ts`, link to review, no PDF). No change. |
| Admin approves | every active engineer's `users.email` | report PDF (+ docx as today), link to approve in the app |
| Engineer approves | settings `recipientEmail` | "אושר ע"י המהנדס, ניתן להפיק תעודה", link |
| Engineer returns | settings `recipientEmail` | the note, link |
| Certificate issued | client email (see below) | certificate PDF; cc settings `recipientEmail` |

- The report job (`report-background`) changes its recipient and its end state: mail to engineers, set `engineer_review`. If no active engineer has an email → `send_failed` with a clear error.
- Notification emails (submit, engineer approve/return) are best effort: a mail failure is logged and audited, never blocks the action.

### Certificate

**Table `certificates`:** `id`, `submissionId` (unique for now), `number` (unique), `issueDate`, `data` (jsonb: every printed field), `pdfKey`, `sentTo`, `sentAt`, `status` (`sending` | `sent` | `failed`), `error`, `createdBy`, `createdAt`.

**Number:** independent of the form's test number. Format of the sample: prefix + two-digit year + four-digit running number (`FD260666`). The prefix belongs to the certificate template (`FD` for 1220; others set when their samples arrive). Suggested automatically as the next number after the highest issued with that prefix and year; the admin may edit it, e.g. for the first one (the lab is already at 0666); `number` unique in the DB (409 → "המספר כבר בשימוש"). My call.

**Issue screen (admin, on an `engineer_approved` form):** "הפקת תעודה" page with the certificate fields, pre-filled from the form and job, all editable:
- From the form: test date, site name/address, building use, description, protected / unprotected spaces, fire-dept shown, גוש/חלקה/מגרש, area, height, risk level, panel location, dialer phone, equipment rows, electrical boards (description and cutoff; the sample's "מוגן ע"י גלאים" column has no form field and is typed by the admin), defects (from the defects field, one per line).
- From job/client: client email.
- Typed by the admin: number (suggested), issue date (today), agreement no., fire-dept file / reference no., panel type, designer name/phone, contractor name/phone, escort name/ID/phone (pre-filled from the installer / contact fields where the form has them), conclusion (מתאימה / אינה מתאימה, default from the form's conclusion check where one exists), recipient email.
- Buttons: preview PDF, issue and send.
- Exact field → form-id mapping lives per form type in `shared/certificates/<form>.ts`; the builder derives it from `shared/forms/f1220.ts` and `header.ts`.

**PDF:** `shared/pdf/Certificate.tsx` rendered like `Report.tsx`, layout as the approved example (2 A4 pages, blue frame, header on both pages, footer address/phones). Signatures (as in the approved example): inspector's from the form's inspector signature attachment; engineer's from `engineerId`'s saved signature at issue time; company stamp from Settings. Fixed legal text per form type in the template. Logos: bundled images under `shared/pdf/` (cropped from the sample for now; replace when the user sends originals).

**Sending:** background job like the report: builds PDF, stores blob, mails client (cc office), sets certificate `sent` and form `certified`; failure → `cert_failed` + error, admin can retry.

**Forms without a certificate template yet** (536, detectors, aerosol, gas): after engineer approval the admin sees "אין עדיין תבנית תעודה לטופס זה" and can "סיים ללא תעודה", which sends the approved report PDF (as built at admin approval, admin as "מאשר") to the client and marks the form `certified` (decided: option 1). It goes through the same certificate job and retry: a `certificates` row with `number` null and `pdfKey` pointing at the report, so `sentTo`/`sentAt` and failures are recorded the same way.

## Testing

- Unit: status transitions incl. role checks (engineer can only approve/return `engineer_review`; admin cannot engineer-approve); next certificate number (year rollover, gaps, edited numbers); certificate prefill mapping for 1220 from the fixture; certificate HTML render (all sections present, number, signatures).
- Server: engineer cannot read clients/jobs/other submissions; issue certificate only from `engineer_approved`; duplicate number → 409.
- e2e (local DB): full flow submit → approve → engineer approve → issue → `certified`, mail mode log.
- Manual: certificate PDF next to the sample; engineer flow on a phone.

## Left to the builder

- Exact engineer home layout, using existing list components.
- Email HTML wording beyond the subjects above.
- Field-by-field mapping details for 1220, following the example render.
