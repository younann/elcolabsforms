# Site forms, required fields, inspector-opened work

## Why

The office wants less manual setup and more control. Each site falls under certain standards (תקן), so it always needs the same forms. The admin wants to decide which form fields are mandatory without a code change. Inspectors in the field meet clients that are not on their schedule and need to start work on the spot, and the office still needs to know about it and bill it.

## Goals

1. **Cancel notifications reach everyone.** Cancelling a job notifies every inspector who had forms on it, including the main inspector whose forms were all untouched (and so deleted).
2. **One copy of each form per job.** New jobs and "add forms" allow at most one copy of each form. The UI shows a checkbox per form, not a 0–9 stepper.
3. **Forms per site.** Each site stores the list of forms it needs (from its standards). Picking the site pre-checks those forms in new work, and the user can still change them for that job.
4. **Client and site filters** on the admin submissions list (`AllSubmissions`).
5. **Admin controls required fields.** Settings has a screen for each form where every field, check question and signature can be set to required or optional. It applies to all jobs.
6. **Inspector-opened work.** An inspector can open a job for themselves: pick or create a client and site, pick a date (default today) and forms (site forms pre-checked). It opens immediately. Every admin gets a push notification. The job carries an "opened by inspector" tag in the UI, and the monthly export says who opened it.

## Non-goals

- Per-site required-field settings (option B, rejected).
- Versioned history of required-field changes.
- Admin approval before inspector-opened work starts.
- Merging duplicate clients created by inspectors.
- Changing old jobs that already have several copies of a form. They keep working and display as they do today.

## Anti-goals

- A required-field change must never make an already submitted or approved report invalid, or block review or approval. Required rules apply only at submit time.
- Inspectors must not be able to edit or see other inspectors' jobs, or edit existing clients, through the new paths.
- Until the admin changes anything, behavior must be exactly as it is today.

## Approaches (required fields)

- **A. Admin overrides stored in the DB, applied on top of the code form definitions (picked).** One shared function patches the form def. The phone and the server run the same validator on the patched def.
- **B. A new form version per change.** It gives history, but every change needs a code edit, so the admin has no real control. Rejected.

## Design

### 1. Cancel notification fix
`netlify/functions/jobs.mts` cancel handler: the batch deletes untouched drafts before it selects the inspectors to notify. Notify inspectors with pending forms (as today) plus `job.inspectorId`, deduped. Inspectors whose forms are all approved still get nothing. Unit or e2e test: cancelling a job whose forms are all untouched notifies the main inspector.

### 2. One copy per form
- `shared/jobs.ts`: change `forms` in `JobCreate` / `JobAddForms` from a quantity record to a non-empty array of unique form ids (`z.array(formId).min(1)`, rejecting duplicates). Remove `expandQuantities` / `JOB_QTY_MAX` if nothing else uses them. Every new row gets `jobCopy = 1`.
- "Add forms": reject (409 with a Hebrew message) any form id the job already has a submission for (there are no soft deletes). The UI only offers missing forms.
- `JobNew.tsx` and the add-forms UI: replace `QtyStepper` with checkboxes (house `ui` components). Update `src/lib/jobs.ts` (`Qty` type → `string[]`).
- `copyLabel` stays so old multi-copy jobs still render.
- Server check only, with no unique DB index, because legacy jobs have duplicates.

### 3. Site forms
- Schema: `client_sites.form_ids text[] not null default '{}'`. Drizzle migration. Per memory, migrate the Neon `production` branch separately from `main`.
- `netlify/functions/clients.mts` site create/patch accept `formIds` (validated against `FORMS` ids). `ClientDetail.tsx` site editor gets a checkbox per form.
- New work (admin and inspector): selecting a site sets the form checkboxes to `site.formIds`. The user may change them. An empty list means nothing is pre-checked.

### 4. Client / site filter
`AllSubmissions.tsx` gets client and then site selects, next to the existing filters. Filtering by the job's client/site needs the client/site id on the list rows. Add `clientId`/`siteId` (from the job) to the submissions list response if they aren't there yet, and filter locally like the other filters. Forms without a job (free-filled, if any) fall under "no client".

### 5. Required fields
- Types (`shared/forms/types.ts`): add optional `required?: boolean` to the switchable variants. Switchable fields and what "filled" means (decided here):
  - text, textarea, number, date, time, choice: not blank.
  - check: answered (and `active` set for `existsActive` unless the answer is לא קיים).
  - signature with `role: 'inspector'`: a signature attachment exists.
  - photos / drawing: at least one attachment of that field.
  - repeatTable: at least `minRows` rows, or 1 row if `minRows` is unset.
  - contactAck: name filled.
  - Not switchable (hidden on the screen, never required): notes, approver signatures (filled after submit), equipmentTable, systemsGrid, scenarioMatrix. They have no checks today, and a wrong rule would block submits in the field.
- An optional check left unanswered stays blank in the PDF and report, so no output change is needed. The builder confirms the PDF renders a blank check without crashing.
- Defaults are today's behavior: plain fields use their code `required`; checks are required; the inspector signature is required; everything else is optional.
- Storage: `settings.required_overrides jsonb not null default '{}'`, shaped `{ [formId]: { [fieldId]: boolean } }`. Only explicit admin choices are stored.
- `shared/forms/required.ts`: `applyRequired(def, overrides): FormDef` returns a copy with `required` resolved on every field. `validateForSubmit` reads `f.required` for every type (the check-answered and signature-present logic stays and runs only when the field is required). Unit tests cover the defaults, an override turning a check optional, and an override turning a text field required.
- Every caller uses the patched def: `submission-action.mts` (submit), `FormFiller.tsx` (live missing + required marks), `src/fill/progress.ts`, and the field components' required marks (`SimpleField`, `Media`, check field).
- Settings API: `GET /api/settings` returns `requiredOverrides` to all logged-in users. Add a separate admin-only `PUT /api/settings/required`, body `{ formId, overrides }`, validated against known form and switchable field ids. The existing `Put` schema needs all company fields, so it stays untouched.
- Client: the fill screens don't fetch settings today. Add a settings query (`useQuery`, cached like the other queries for offline) used by `Fill` / `FormFiller`. A phone that never fetched it uses the code defaults. The server's submit check is the authority and returns the missing list as it does today.
- Admin UI: `Settings.tsx` gets a "שדות חובה" section: pick a form, then a list grouped by section with a required switch per field, showing the label, or the clause + text for checks. Save sends the whole map for that form. A "reset to default" action clears that form's overrides.

### 6. Inspector-opened work
- API `POST /api/jobs`: inspectors are allowed, but `inspectorId` is forced to `me.id` (any other value → 403). `createdBy = me.id` already records the author.
- Notification: add `JobEvent 'inspectorOpened'` (title "עבודה נפתחה ע"י בודק") sent to all active admins. The inspector gets no "new job" push for their own job.
- Clients: `clients.mts` currently starts with `requireUser(req, 'admin')`. Relax it to any user, keep admin-only on PATCH and DELETE, and allow inspectors to `POST` a client and a site. Inspector read access: `GET` returns only client `id` + `name` and, per client, site `id` + `name` (needed to pick a site). No phone, email, contact or address. The prefill reads the full details on the server. The admin response is unchanged.
- Editing their own jobs: on jobs an inspector opened (`created_by = me`), they may do everything an admin can: change the date and note, add forms, reassign, cancel. Admin-created jobs stay admin-only for these actions. Replace `admin()` on the job sub-routes with `canManage(job) = admin || job.createdBy === me.id`. When an inspector cancels or reassigns their own job, admins get the matching push too (my call, so the office keeps track).
- "Opened by inspector" is derived: `JobView.openedByInspector = creator.role === 'inspector'` (join `users` on `jobs.created_by`). Only inspectors can open jobs (not engineers). Shortcut: if a user's role changes later, their old jobs flip. That's acceptable because role changes are rare; add a stored column if it ever matters. Shown as a tag on `JobCard` and `JobPage`.
- Export: `ExportRow.openedBy: 'בודק' | 'מנהל'`, from the job creator's role; forms without a job count as מנהל. New column "נפתח ע"י" on the details sheet. The per-inspector and per-client sheets are unchanged.
- UI: an "פתיחת עבודה" button on the inspector `Home`, opening a screen with a client picker plus "new client" (name, contact, phone), a site picker plus "new site" (name, address, forms), the date, the form checkboxes (site forms pre-checked) and a note. On save it goes to the new job page. Reuse `JobNew.tsx` pieces where possible, minus the inspector picker.

## Order

1 → 2 + 3 + 4 → 5 → 6. Each piece is shippable on its own with its own tests (unit with vitest, e2e with Playwright, as the repo already does).

## Left to the builder

- Exact component split and reuse between admin `JobNew` and the inspector screen.
- Migration file names and drizzle commands, as the repo already does them.
- Visual layout of the required-fields screen, following the existing `Settings.tsx` style.
