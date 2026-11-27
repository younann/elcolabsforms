# Site forms, required fields, inspector-opened work: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the six features in the spec, in the agreed order.

**Architecture:** Extend the existing Netlify functions (`jobs.mts`, `clients.mts`, `settings.mts`), shared zod schemas and form defs. Make one DB migration (0006) for `client_sites.form_ids` and `settings.required_overrides`. Required rules live in one shared function used by the phone and the server.

**Tech Stack:** React 18 + react-router, Netlify functions, Drizzle + Neon Postgres, zod 4, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-site-forms-required-fields-inspector-jobs-design.md`

## Global Constraints

- All UI copy is Hebrew, and new UI uses house `src/ui` components.
- Default behavior is unchanged until the admin edits required fields.
- Old multi-copy jobs keep rendering (`copyLabel` stays).
- The migration must also run on the Neon `production` branch, and only after the user says yes.
- Comments are short and one line, with no ticket ids. No AI mentions anywhere.

## Review Focus

- An inspector POSTs a job with another inspector's id → 403. Covered in Task 6.
- An inspector cancels or edits an admin-created job → 403. Covered in Task 6.
- An inspector calls GET `/api/clients` → no phone, email or address in the response. Covered in Task 6.
- An override makes a check optional, then the form is submitted with it blank → submit is accepted. Covered in Task 4.
- Add forms with a form the job already has → 409. Covered in Task 2.

---

### Task 1: Cancel notifies the main inspector

**Files:** Modify `netlify/functions/jobs.mts` (cancel handler).

- [ ] Recipients = `[job.inspectorId, ...pending inspectors]`, deduped. Pending inspectors are read *before* the untouched drafts are deleted (they are still pending after, but the main inspector may have none left).
- [ ] `npx tsc -b`, `npm test` pass.

### Task 2: One copy per form

**Files:** `shared/jobs.ts`, `netlify/functions/jobs.mts`, `src/lib/jobs.ts`, `src/pages/admin/JobNew.tsx`, `src/pages/JobView.tsx` (FormsSheet), `tests/unit/jobs.test.ts`, `tests/e2e/jobs-helper.ts` and specs using `forms:`.

**Interfaces:**
- Produces: `JobForms = z.array(formId).min(1, 'יש לבחור לפחות טופס אחד').refine(unique)`. `JobCreate.forms` / `JobAddForms.forms` are `string[]`. `src/lib/jobs.ts` `createJob({... forms: string[]})`, `addJobForms(id, forms: string[])`. `FormChecks({ value: string[], onChange, disabled?: string[] })` in `src/components/FormChecks.tsx`.
- Removes: `expandQuantities`, `JOB_QTY_MAX`, `Qty`.

- [ ] Test: `JobCreate` rejects `forms: ['gas','gas']` and `[]`, and accepts `['gas','f536']`.
- [ ] Server: rows built with `copy: 1`. In add-forms, if any id is already in the job → `HttpError(409, 'הטופס כבר קיים בעבודה')`.
- [ ] UI: `FormChecks` renders a checkbox per `FORMS` entry. FormsSheet passes the job's existing form ids as `disabled`.

### Task 3: Site forms + client/site filter

**Files:** `server/db/schema.ts`, `drizzle/0006_*.sql`, `shared/clients.ts`, `netlify/functions/clients.mts`, `src/pages/admin/ClientDetail.tsx`, `src/pages/admin/JobNew.tsx`, `netlify/functions/submissions.mts` + `src/lib/*` Summary, `src/pages/admin/AllSubmissions.tsx`.

**Interfaces:**
- Produces: `clientSites.formIds: string[]`. `SiteInput.formIds` (optional array of form ids, default `[]`). `SiteRow.formIds: string[]`. Summary rows carry `clientId: string | null`, `siteId: string | null`.

- [ ] Migration adds `client_sites.form_ids text[] not null default '{}'` and `settings.required_overrides jsonb not null default '{}'::jsonb`. Run on `main` (local.env).
- [ ] Test: `SiteInput.parse({name,address,formIds:['nope']})` throws.
- [ ] Site editor: `FormChecks` for formIds. JobNew: picking a site sets the checks to `site.formIds`.
- [ ] AllSubmissions: client select (from the clients list) and site select (sites of the chosen client), filtering locally on `clientId`/`siteId`.

### Task 4: Required fields

**Files:** Create `shared/forms/required.ts`. Modify `shared/forms/types.ts`, `shared/forms/validate.ts`, `netlify/functions/settings.mts`, `netlify/functions/submission-action.mts`, `src/fill/*` callers, `src/pages/admin/Settings.tsx`. Test `tests/unit/required.test.ts`.

**Interfaces:**
- Produces: `type RequiredOverrides = Record<string, Record<string, boolean>>`. `isSwitchable(f: Field): boolean`. `defaultRequired(f: Field): boolean`. `applyRequired(def: FormDef, o?: RequiredOverrides): FormDef` (sets `required` on every switchable field; others get `required: false`). `RequiredPut = z.object({ formId, overrides: z.record(z.string(), z.boolean()) })` validated against switchable ids. `GET /api/settings` → `settings.requiredOverrides`. `PUT /api/settings/required`. Client `useRequiredOverrides()` hook.

- [ ] Tests: the default on f1220 equals today's `validateForSubmit` result on empty data. An override `{c1:false}` drops c1 from missing. Override text `true` adds it. Photos required + no attachment → missing. Approver signature is not switchable.
- [ ] `validateForSubmit` gates every rule on `f.required ?? defaultRequired(f)`, so unpatched defs behave like today. Callers pass the patched def.
- [ ] Server submit uses `applyRequired(def, settings.requiredOverrides)`.
- [ ] Settings screen: form select, then a switch per switchable field grouped by section, Save, and "ברירת מחדל".

### Task 5: (merged into 4)

### Task 6: Inspector-opened work

**Files:** `netlify/functions/jobs.mts`, `netlify/functions/clients.mts`, `server/jobs.ts`, `server/push.ts`, `shared/jobs.ts` (JobView), `server/export.ts`, `src/pages/Home.tsx`, new `src/pages/JobOpen.tsx`, router, `JobCard`, `JobView.tsx`.

**Interfaces:**
- Produces: `JobEvent` gains `'opened'` (title `עבודה נפתחה ע"י בודק`). `JobView.openedByInspector: boolean`. `ExportRow.openedBy: 'בודק' | 'מנהל'`. Route `/jobs/new` (inspector).

- [ ] Jobs API: inspector POST is allowed only with `inspectorId === me.id` (else 403). Notify all active admins with `'opened'`. Sub-routes: `canManage = admin || job.createdBy === me.id`. Inspector-made cancel/reassign also notify admins.
- [ ] Clients API: any logged-in user. Inspector GET list → `{id,name,sites:[{id,name,formIds}]}` (active only). Inspector POST client/site allowed. PATCH/DELETE and client detail are admin only.
- [ ] Export: `openedBy` column "נפתח ע"י", from the creator role joined via the job.
- [ ] UI: a Home button for inspectors, `JobOpen` (client pick / new, site pick / new, date, forms, note), and a tag on JobCard/JobView.
- [ ] Tests: export sheet has the column. Unit-level role helper `canManageJob(me, job)`.

### Final: `npx tsc -b && npm test`, then e2e jobs spec. Show the diff and ask before committing.
