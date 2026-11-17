# Clients and Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin keeps clients with sites and dispatches jobs (client, site, forms with quantities, inspector, date, note) that create pre-filled drafts; inspectors see job cards, get web push, and the admin sends a one-tap WhatsApp message.

**Architecture:** New drizzle tables (`clients`, `client_sites`, `jobs`, `push_subscriptions`) and columns on `users` and `submissions`. Pure rules live in `shared/jobs.ts` and `shared/whatsapp.ts` and are unit-tested; Netlify functions `clients.mts`, `jobs.mts`, `push.mts` follow the existing `handle/requireUser/parseBody` pattern. The service worker moves to `injectManifest` so it can handle push.

**Tech Stack:** React 18 + react-router 6 data router, Tailwind 4, Netlify Functions (`.mts`), drizzle-orm on `neon-http`, zod 4, vitest, Playwright, `vite-plugin-pwa`, new dep `web-push`.

**Spec:** `docs/superpowers/specs/2026-11-17-clients-and-jobs-design.md`

## Global Constraints

- All UI copy in Hebrew, RTL, matching existing tone; components from `src/ui` (`Button`, `Sheet`, `TextField`, `Select`, `InspectorPicker`, `Banner`, `EmptyState`, `toast`).
- Every new endpoint: `requireUser(req, 'admin')` unless the spec allows inspectors (only `GET /api/jobs`, `GET /api/jobs/:id`, push subscribe/unsubscribe, VAPID key).
- `neon-http` has no interactive transactions: multi-row writes that must be all-or-nothing use `db.batch([...])`.
- Pre-fill copies values (snapshot); `mirror()` runs on pre-filled data.
- Quantity per form 0–9; a job needs at least one form.
- Copy label shown only when a form has more than one copy in the job: `${shortTitle} ${copy}`.
- Clients/sites are soft-deleted (`active=false`) once used by a job.
- Phones: Israeli normalization to `972…` digits for `wa.me`.
- Push is best effort: failures are logged and never fail the admin's request.
- Commits: author and committer `younann <younan.n@gmail.com>`; no AI mention anywhere. Do not push or touch production without the user's approval.
- Code comments: a few words, one line.

## Review Focus

1. Inspector phone in odd formats (`050-123 4567`, `+972 50 123 4567`, `04-8123456`, `123`) → normalized or the WhatsApp button disabled, never a broken link. Test in Task 2.
2. A client with empty phone/email → those form fields stay absent (not `""`), so "required" checks behave as for a blank form. Test in Task 2.
3. Job create where a form insert fails → no job row and no orphan drafts. Test in Task 5 (batch rollback via invalid formId rejected before write).
4. Push service answers 410 for a dead device → subscription deleted, job create still 201. Test in Task 8.
5. Inspector who is moved off a job but still owns a returned form in it → still sees that job card with only that form. Test in Task 5.

---

### Task 1: Schema and migration

**Files:**
- Modify: `server/db/schema.ts`
- Create: `drizzle/0004_*.sql` (generated) and its snapshot

**Interfaces:**
- Produces tables/columns: `clients(id uuid pk, name text not null, contactPerson text, phone text, email text, active bool default true, createdAt)`; `clientSites(id, clientId → clients cascade, name not null, address not null, active, createdAt)`; `jobs(id, clientId → clients, siteId → clientSites, inspectorId → users, plannedDate date not null (mode 'string'), note text, createdBy → users, createdAt, cancelledAt nullable)`; `pushSubscriptions(id, userId → users cascade, endpoint text unique, p256dh, auth, createdAt)`; `users.email`, `users.phone` (nullable text); `submissions.jobId → jobs` (nullable, index `submissions_job`), `submissions.touchedAt` (nullable timestamptz), `submissions.jobCopy` (nullable int). Export `Client`, `ClientSite`, `Job` select types.

- [ ] **Step 1:** Add the tables and columns above to `server/db/schema.ts`.
- [ ] **Step 2:** Run `npm run db:generate`. Expected: one new `drizzle/0004_*.sql` with only `CREATE TABLE`/`ALTER TABLE ADD COLUMN`/index statements, no drops.
- [ ] **Step 3:** Run `npm run db:migrate` (dev Neon branch via `local.env`). Expected: applies cleanly.
- [ ] **Step 4:** Run `npx tsc -b && npx vitest run`. Expected: green.
- [ ] **Step 5:** Commit `feat: clients, sites, jobs and push tables`.

### Task 2: Shared job and WhatsApp rules

**Files:**
- Create: `shared/jobs.ts`, `shared/whatsapp.ts`
- Test: `tests/unit/jobs.test.ts`, `tests/unit/whatsapp.test.ts`

**Interfaces:**
- Produces (`shared/jobs.ts`):
  - `type PrefillCtx = { plannedDate: string; siteName: string; siteAddress: string; clientName: string; clientPhone?: string | null; clientEmail?: string | null }`
  - `prefillData(def: FormDef, ctx: PrefillCtx): FormData` — maps `date, siteName, siteAddress, customerName, customerPhone, customerEmail`; skips ids not in `def`; skips empty/null values.
  - `type JobFormLite = { status: Status }`; `jobState(forms: JobFormLite[], cancelledAt: string | Date | null): 'open' | 'done' | 'cancelled' | 'cancelled-open'` — `open` if not cancelled and any `draft|returned`; `cancelled-open` if cancelled and any `draft|returned`.
  - `copyLabel(shortTitle: string, copy: number | null, copiesOfForm: number): string`
  - `expandQuantities(q: Record<string, number>, existing?: Record<string, number>): { formId: string; copy: number }[]` — copies continue after `existing[formId]`.
  - `isUntouched(s: { status: Status; touchedAt: Date | string | null }): boolean` — `status === 'draft' && !touchedAt`.
  - `JOB_QTY_MAX = 9`.
- Produces (`shared/whatsapp.ts`):
  - `normalizeIlPhone(raw: string | null | undefined): string | null` — strip non-digits; leading `0` → `972`; keep `972…`; valid only if result matches `/^972\d{8,9}$/`.
  - `jobMessage(j: { inspectorName: string; clientName: string; contactPerson?: string | null; contactPhone?: string | null; siteName: string; siteAddress: string; plannedDate: string; forms: string[]; note?: string | null; link: string }): string` — Hebrew lines, date formatted `he-IL` `Asia/Jerusalem`, empty parts omitted.
  - `waLink(phone: string, text: string): string` → `https://wa.me/${phone}?text=${encodeURIComponent(text)}`.

- [ ] **Step 1: Write the failing tests**

```ts
// jobs.test.ts
const f1220 = getForm('f1220');
expect(prefillData(f1220, { plannedDate: '2026-11-24', siteName: 'בניין A', siteAddress: 'הרצל 12, חיפה', clientName: 'מגדלי הים', clientPhone: '', clientEmail: null }))
  .toEqual({ date: '2026-11-24', siteName: 'בניין A', siteAddress: 'הרצל 12, חיפה', customerName: 'מגדלי הים' });
expect(jobState([{ status: 'submitted' }, { status: 'returned' }], null)).toBe('open');
expect(jobState([{ status: 'emailed' }], null)).toBe('done');
expect(jobState([{ status: 'draft' }], '2026-11-17')).toBe('cancelled-open');
expect(jobState([{ status: 'submitted' }], '2026-11-17')).toBe('cancelled');
expect(copyLabel('גז', 2, 2)).toBe('גז 2');
expect(copyLabel('גז', 1, 1)).toBe('גז');
expect(expandQuantities({ gas: 2, aerosol: 0, f536: 1 })).toEqual([{ formId: 'gas', copy: 1 }, { formId: 'gas', copy: 2 }, { formId: 'f536', copy: 1 }]);
expect(expandQuantities({ gas: 1 }, { gas: 2 })).toEqual([{ formId: 'gas', copy: 3 }]);
expect(isUntouched({ status: 'draft', touchedAt: null })).toBe(true);
expect(isUntouched({ status: 'draft', touchedAt: new Date() })).toBe(false);
// whatsapp.test.ts
expect(normalizeIlPhone('050-123 4567')).toBe('972501234567');
expect(normalizeIlPhone('+972 50 123 4567')).toBe('972501234567');
expect(normalizeIlPhone('04-8123456')).toBe('97248123456');
expect(normalizeIlPhone('123')).toBeNull();
expect(normalizeIlPhone(null)).toBeNull();
expect(waLink('972501234567', 'שלום & היי')).toBe('https://wa.me/972501234567?text=%D7%A9%D7%9C%D7%95%D7%9D%20%26%20%D7%94%D7%99%D7%99');
const m = jobMessage({ inspectorName: 'דנה', clientName: 'מגדלי הים', contactPerson: 'יוסי', contactPhone: '0501112222', siteName: 'בניין A', siteAddress: 'הרצל 12', plannedDate: '2026-11-24', forms: ['גז 1', 'גז 2'], note: null, link: 'https://x/jobs/1' });
for (const s of ['דנה', 'מגדלי הים', 'יוסי', '0501112222', 'בניין A', 'הרצל 12', 'גז 1', 'גז 2', 'https://x/jobs/1']) expect(m).toContain(s);
expect(m).not.toContain('null');
```

- [ ] **Step 2:** `npx vitest run tests/unit/jobs.test.ts tests/unit/whatsapp.test.ts` → FAIL (modules missing).
- [ ] **Step 3:** Implement both modules with the signatures above.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat: job and whatsapp rules`.

### Task 3: Inspector contact details

**Files:**
- Modify: `netlify/functions/users.mts`, `src/pages/admin/Users.tsx`
- Test: `tests/unit/users-contact.test.ts` (zod schema test)

**Interfaces:**
- Produces: `users.mts` `Create` and `Patch` accept `email?: string` (zod `email()` or `''`) and `phone?: string` (max 30); `view()` returns `email`, `phone`; `GET /api/users?inspectors=1` items gain `phone`. Export the zod schemas as `UserCreate`, `UserPatch` from a new `shared/users.ts` so the test imports them.
- `Inspector` type in `shared/inspector-rank.ts` gains optional `phone?: string | null`.

- [ ] **Step 1:** Test: `UserPatch.parse({ email: 'a@b.co', phone: '050-1234567' })` ok; `UserPatch.safeParse({ email: 'nope' }).success === false`; `UserPatch.parse({ email: '' })` ok and maps to `null`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement schemas, endpoint fields, and in `Users.tsx` relabel name to "שם מלא" and add "דוא״ל" (`type="email"`) and "טלפון" (`type="tel"`, `inputMode="tel"`) to the create and edit sheets.
- [ ] **Step 4:** `npx vitest run && npx tsc -b` → PASS.
- [ ] **Step 5:** Commit `feat: inspector email and phone`.

### Task 4: Clients and sites

**Files:**
- Create: `netlify/functions/clients.mts`, `src/pages/admin/Clients.tsx`, `src/pages/admin/ClientDetail.tsx`, `src/lib/clients.ts`, `shared/clients.ts`
- Modify: `src/routes.tsx`
- Test: `tests/unit/clients.test.ts`

**Interfaces:**
- Routes `config.path`: `['/api/clients', '/api/clients/:id', '/api/clients/:id/sites', '/api/clients/:id/sites/:siteId']`, admin only.
  - `GET /api/clients?q=` → `{ clients: ClientRow[] }` (active first, `name` asc). `ClientRow = { id, name, contactPerson, phone, email, active, siteCount }`.
  - `POST /api/clients` `ClientInput` → 201 `{ client }`; `PATCH /api/clients/:id` partial `ClientInput & { active?: boolean }`; `DELETE /api/clients/:id` → hard delete if no job uses it, else 409 `'הלקוח בשימוש. אפשר להסתיר אותו'`.
  - `GET /api/clients/:id` → `{ client, sites: SiteRow[], jobs: JobSummary[] }` (jobs from Task 5; return `[]` until then).
  - `POST /api/clients/:id/sites` `SiteInput` → 201 `{ site }`; `PATCH …/sites/:siteId` partial `SiteInput & { active?: boolean }`; `DELETE` same rule as clients.
- `shared/clients.ts`: zod `ClientInput = { name: 1..120, contactPerson?: ≤80, phone?: ≤30, email?: email | '' }`, `SiteInput = { name: 1..120, address: 1..200 }`.
- `src/lib/clients.ts`: `listClients(q?)`, `getClient(id)`, `saveClient(input, id?)`, `saveSite(clientId, input, siteId?)`.
- Routes: `/admin/clients`, `/admin/clients/:id` under the admin `RequireRole`.

- [ ] **Step 1:** Test zod: `ClientInput` rejects empty name and bad email; `SiteInput` requires address.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement endpoint, lib and screens: list with search and "לקוח חדש" sheet; detail with client edit sheet, sites list with add/edit sheet and "הסתרה", and a jobs section.
- [ ] **Step 4:** `npx vitest run && npx tsc -b` → PASS.
- [ ] **Step 5:** Commit `feat: clients and sites`.

### Task 5: Jobs API and submission rules

**Files:**
- Create: `netlify/functions/jobs.mts`, `server/jobs.ts`
- Modify: `netlify/functions/submissions.mts` (remove inspector `POST`, remove `/duplicate`, add `jobId`, `jobCopy` to list rows, set `touchedAt` on PATCH, refuse reassign for job forms with 409 `'הטופס שייך לעבודה. שנה בודק מתוך העבודה'`), `netlify/functions/files.mts` (set `touchedAt` on upload), `netlify/functions/submission-action.mts` (reopen copies `jobId`, `jobCopy`), `src/lib/submissions.ts` (`Summary.jobId`, `Summary.jobCopy`; drop `duplicate`)
- Test: `tests/unit/jobs-server.test.ts`

**Interfaces:**
- Consumes: Task 2 `prefillData`, `expandQuantities`, `jobState`, `isUntouched`; Task 1 tables; `reassignCheck`.
- `shared/jobs.ts` adds zod: `JobCreate = { clientId: uuid, siteId: uuid, inspectorId: uuid, plannedDate: YYYY-MM-DD, note?: ≤1000, forms: Record<formId, int 0..9> }` (refine: sum ≥ 1), `JobPatch = { plannedDate?, note? }`, `JobAddForms = { forms }`, `JobInspector = { inspectorId }`.
- `server/jobs.ts`: `buildJobRows(job: { id; clientId; siteId; inspectorId; plannedDate }, ctx: PrefillCtx, items: { formId; copy }[]): (typeof schema.submissions.$inferInsert)[]` (pure: getForm, prefillData, mirror, `status:'draft'`, `jobId`, `jobCopy`, `formVersion`); `loadJobView(id, me)` returning `JobView`.
- `JobView = { id, client: { id, name, contactPerson, phone }, site: { id, name, address }, inspector: { id, displayName, phone }, plannedDate, note, cancelledAt, state, forms: { id, formId, jobCopy, status, inspectorId, label }[] }` — inspectors get only their own forms and 404 if they own none; forms list shows the latest revision per `parentId` chain.
- `jobs.mts` paths `['/api/jobs', '/api/jobs/:id', '/api/jobs/:id/forms', '/api/jobs/:id/inspector', '/api/jobs/:id/cancel']`:
  - `GET /api/jobs?inspectorId&clientId&state` → `{ jobs: JobSummary[] }` where `JobSummary = Omit<JobView,'forms'> & { forms: { formId; jobCopy; status }[] }`; inspector: only jobs where they own a form.
  - `POST /api/jobs` (admin) → validates client/site active and site belongs to client, inspector active inspector, then `db.batch([insert job, insert drafts])` with app-generated job id; audit `create` per draft; returns 201 `{ job: JobView }`.
  - `PATCH /api/jobs/:id` (admin) `JobPatch`; `POST …/forms` `JobAddForms` (copies continue numbering); `POST …/inspector` moves job's `draft|returned` forms owned by anyone to the new inspector and sets `jobs.inspector_id`, audit `reassign`; `POST …/cancel` sets `cancelledAt`, deletes `isUntouched` forms (and their attachments) in one `db.batch`. Cancelled job refuses PATCH/forms/inspector with 409.
- Push hooks: call `notifyJob(event, jobId, inspectorIds)` from Task 8; until Task 8 lands it is a no-op exported from `server/push.ts`.

- [ ] **Step 1: Write the failing tests** (pure parts)

```ts
const rows = buildJobRows({ id: 'j', clientId: 'c', siteId: 's', inspectorId: 'i', plannedDate: '2026-11-24' },
  { plannedDate: '2026-11-24', siteName: 'בניין A', siteAddress: 'הרצל 12', clientName: 'מגדלי הים' },
  [{ formId: 'gas', copy: 1 }, { formId: 'gas', copy: 2 }]);
expect(rows).toHaveLength(2);
expect(rows[1]).toMatchObject({ formId: 'gas', jobId: 'j', jobCopy: 2, inspectorId: 'i', status: 'draft', siteName: 'בניין A' });
expect((rows[0].data as FormData).customerName).toBe('מגדלי הים');
expect(JobCreate.safeParse({ ...valid, forms: { gas: 0 } }).success).toBe(false);
expect(JobCreate.safeParse({ ...valid, forms: { gas: 10 } }).success).toBe(false);
expect(JobCreate.safeParse({ ...valid, forms: { nope: 1 } }).success).toBe(false);
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `server/jobs.ts`, `jobs.mts`, and the submissions/files/action changes listed above; fill `GET /api/clients/:id` `jobs` with that client's `JobSummary[]` (newest first).
- [ ] **Step 4:** `npx vitest run && npx tsc -b` → PASS (update existing tests that used `duplicate` or inspector `POST /api/submissions`).
- [ ] **Step 5:** API check against dev: start `netlify dev --offline`; as admin create client, site, job `{ gas: 2, f536: 1 }` → 201 with 3 forms labelled `גז 1`, `גז 2`, `משטח…`; as inspector `POST /api/submissions` → 403/405; inspector `GET /api/jobs/:id` → own forms only; change inspector, then return a form submitted by the old inspector → old inspector's `GET /api/jobs` still lists the job with that one form (Review Focus 5); cancel → untouched drafts gone, touched draft kept.
- [ ] **Step 6:** Commit `feat: jobs api`.

### Task 6: Admin job screens and navigation

**Files:**
- Create: `src/pages/admin/Jobs.tsx`, `src/pages/admin/JobNew.tsx`, `src/pages/JobView.tsx` (shared admin/inspector page), `src/lib/jobs.ts`, `src/ui/QtyStepper.tsx`, `src/components/WhatsAppButton.tsx`
- Modify: `src/routes.tsx`, `src/ui/AppShell.tsx`, `src/components/ReassignCard.tsx` (hidden when `jobId`), `src/pages/admin/Review.tsx`, `src/pages/SubmissionView.tsx`
- Test: `tests/unit/job-screens.test.tsx`

**Interfaces:**
- Consumes: Task 5 endpoints and `JobView`/`JobSummary`; Task 2 `normalizeIlPhone`, `jobMessage`, `waLink`, `copyLabel`.
- `src/lib/jobs.ts`: `listJobs(q)`, `getJob(id)`, `createJob(body)`, `patchJob(id, body)`, `addJobForms(id, forms)`, `setJobInspector(id, inspectorId)`, `cancelJob(id)`.
- `WhatsAppButton({ job }: { job: JobView })` — disabled with hint "חסר טלפון לבודק. הוסף אותו במשתמשים" when `normalizeIlPhone(job.inspector.phone)` is null; else an `<a target="_blank" rel="noopener">` to `waLink(...)` with `link = location.origin + '/jobs/' + id`.
- Routes: `/admin/jobs`, `/admin/jobs/new`, `/jobs/:id` (any logged-in user). `/jobs/` joins the `TASK` regex in AppShell; back target for `/jobs/` is `/admin/jobs` for admins, `/` for inspectors.
- Admin tabs: `לאישור /`, `עבודות /admin/jobs`, `טפסים /admin/submissions`, `לקוחות /admin/clients`, `עוד` → a sheet listing משתמשים, הגדרות, פרופיל (desktop side nav lists every item; no `עוד` there).

- [ ] **Step 1:** Tests (jsdom, mocked fetch as in `home-admin.test.tsx`): WhatsApp button is disabled for `phone: null` and its `href` starts with `https://wa.me/972501234567?text=` for `0501234567`; admin bottom nav labels equal `['לאישור','עבודות','טפסים','לקוחות','עוד']`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement screens: jobs list (open, cancelled-open, done; filter by inspector/client); new job (client picker with type-ahead reusing `rankInspectors`-style matching on name, site picker with inline "אתר חדש", `QtyStepper` per form 0–9, inspector picker, date, note; submit → navigate to `/jobs/:id` with WhatsApp button prominent); job page (details, forms with labels and status links, edit date/note sheet, add forms sheet, change inspector sheet, cancel confirm listing what stays and what is removed).
- [ ] **Step 4:** `npx vitest run && npx tsc -b` → PASS.
- [ ] **Step 5:** Commit `feat: admin job screens`.

### Task 7: Inspector job cards

**Files:**
- Create: `src/components/JobCard.tsx`
- Modify: `src/pages/Home.tsx`, `src/ui/AppShell.tsx` (inspector tabs `הבית`, `פרופיל`), `src/routes.tsx` (`/new` → `<Navigate to="/" replace />`), `src/fill/FormFiller.tsx` (subtitle line), `src/pages/Fill.tsx`; delete `src/components/FormPicker.tsx`, `src/components/DuplicateButton.tsx`, `src/pages/NewForm.tsx` and their uses
- Test: `tests/unit/home-admin.test.tsx` (extend), `tests/e2e/jobs.spec.ts`; update `tests/e2e/fill.spec.ts`, `review.spec.ts`, `mobile-nav.spec.ts` to create forms through `POST /api/jobs` as admin

**Interfaces:**
- Consumes: `listJobs()` for the inspector, `JobSummary`, `copyLabel`, `jobState`.
- `JobCard({ job }: { job: JobSummary })` — client, site name and address, date, contact person with `tel:` link, note, forms with label + `StatusBadge` linking `rowHref`; "בוטלה" badge for `cancelled-open`.
- `FormFiller` gains optional prop `context?: { jobId: string; text: string }` rendered as a link line under the title.

- [ ] **Step 1:** Unit test: inspector home renders a job card with `גז 1`, `גז 2` and no "טופס חדש" heading; a returned form without `jobId` still renders under "הוחזרו לתיקון".
- [ ] **Step 2:** e2e `jobs.spec.ts`: admin (API) creates client, site, job `{ aerosol: 1 }` for a fresh inspector with phone `050-1234567`; inspector opens `/`, taps the card's form, sees `שם המזמין` = client name and `שם האתר` = site name; admin on `/jobs/:id` sees WhatsApp link with `972501234567`.
- [ ] **Step 3:** Run both → FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** `npx vitest run && npx tsc -b`; build and run e2e against `netlify dev --offline --dir dist --port 8899` with `E2E_BASE_URL=http://localhost:8899 npx playwright test` → PASS.
- [ ] **Step 6:** Commit `feat: inspector job cards`.

### Task 8: Web push

**Files:**
- Create: `src/sw.ts`, `netlify/functions/push.mts`, `server/push.ts` (replace Task 5 no-op), `src/pwa/push.ts`, `src/pwa/PushCard.tsx`
- Modify: `vite.config.ts` (`strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`, keep manifest; move `navigateFallback` denylist into `sw.ts` via `NavigationRoute`), `src/lib/auth.tsx` (unsubscribe before logout), `src/pages/Home.tsx` (PushCard for inspectors), `package.json` (`web-push`, `@types/web-push`, `workbox-precaching`, `workbox-routing`)
- Test: `tests/unit/push.test.ts`

**Interfaces:**
- `push.mts` paths `['/api/push/key', '/api/push/subscribe']`: `GET key` → `{ key: VAPID_PUBLIC_KEY }`; `POST subscribe` `{ endpoint, keys: { p256dh, auth } }` → upsert on endpoint for `me`; `DELETE subscribe` `{ endpoint }` → delete own row.
- `server/push.ts`: `pushPayload(event: 'created' | 'inspector' | 'forms' | 'cancelled', j: { id; clientName; siteName; plannedDate }): { title: string; body: string; url: string }` (titles: `עבודה חדשה`, `עבודה הועברה אליך`, `נוספו טפסים לעבודה`, `עבודה בוטלה`; `url: '/jobs/' + id`); `notifyJob(event, jobId, userIds: string[]): Promise<void>` — loads subs, `webpush.sendNotification` each, deletes on 404/410, catches everything. Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; missing env → log and return.
- `sw.ts`: `precacheAndRoute(self.__WB_MANIFEST)`, `cleanupOutdatedCaches()`, navigation fallback to `index.html` excluding `/api/` and `/.netlify/`; `push` → `showNotification(title, { body, data: { url }, icon: '/icons/icon-192.png', dir: 'rtl', lang: 'he' })`; `notificationclick` → focus an open client and navigate, else `openWindow(url)`. Keep the update-prompt flow (`registerType: 'prompt'`, `skipWaiting` on message).
- `src/pwa/push.ts`: `pushSupport(): 'ok' | 'needs-install' | 'unsupported'` (iOS not standalone → `needs-install`), `enablePush(): Promise<boolean>`, `disablePush(): Promise<void>`.
- `PushCard`: shown when support is `ok` and `Notification.permission === 'default'` and not dismissed (localStorage key `push-card-dismissed`); on iOS browser shows the install hint instead.

- [ ] **Step 1:** Tests: `pushPayload('created', { id: 'j', clientName: 'מגדלי הים', siteName: 'בניין A', plannedDate: '2026-11-24' })` → title `עבודה חדשה`, body contains both names, `url === '/jobs/j'`; `notifyJob` with mocked `web-push` rejecting `{ statusCode: 410 }` deletes that subscription and resolves (Review Focus 4).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; generate dev VAPID keys with `npx web-push generate-vapid-keys` into `local.env` only (never committed).
- [ ] **Step 4:** `npx vitest run && npx tsc -b && npx vite build` → PASS; `dist/sw.js` contains `push` handler.
- [ ] **Step 5:** e2e smoke still green (Task 7 command).
- [ ] **Step 6:** Commit `feat: web push for jobs`.

### Task 9: Release (needs the user's go-ahead at each step)

- [ ] **Step 1:** Show the user the `0004` migration SQL; on approval apply it to the Neon `production` branch (`br-billowing-mud-behwo37y`) before any push.
- [ ] **Step 2:** Generate production VAPID keys; on approval set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:elcolabsforms@gmail.com` on Netlify production context.
- [ ] **Step 3:** On approval push `main`; wait for the deploy to be `ready`; confirm `/api/push/key` answers and `/admin/jobs` loads.
- [ ] **Step 4:** Ask the user to test on a real Android phone and an installed iPhone: enable notifications, receive a job push, open the job from the notification, send the WhatsApp message.
