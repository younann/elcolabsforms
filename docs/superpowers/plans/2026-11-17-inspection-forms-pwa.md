# Inspection Forms PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Hebrew RTL installable PWA where inspectors fill five fire-safety checklists, admins review/approve, and a signed PDF is emailed to one configured address.

**Architecture:** Vite + React SPA served by Netlify; Netlify Functions (v2, TypeScript) as the API, talking to Neon Postgres via Drizzle; files in Netlify Blobs. Form definitions live once in `shared/forms` and are rendered by both the app (fill UI) and the PDF template (React → static HTML → headless Chromium).

**Tech Stack:** React 18, TypeScript, Vite, React Router, Tailwind CSS v4, vite-plugin-pwa (Workbox, prompt mode), Netlify Functions v2, @netlify/blobs, @neondatabase/serverless + drizzle-orm + drizzle-kit, bcryptjs, zod, nodemailer (Gmail SMTP), puppeteer-core + @sparticuz/chromium, signature_pad, perfect-freehand, browser-image-compression, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-inspection-forms-pwa-design.md`

## Global Constraints

- UI language Hebrew only; `<html lang="he" dir="rtl">`; layout uses logical CSS properties (start/end), never left/right.
- Must work on iOS Safari (browser + installed PWA) and Android Chrome; phone, tablet (both orientations), desktop.
- Inputs ≥16px font (no iOS zoom); tap targets ≥44px; safe-area insets respected; `viewport-fit=cover`.
- Roles: `admin`, `inspector`. No self sign-up. Every API function enforces auth + role server-side.
- Status flow: `draft → submitted → (returned → draft)* → approved → sending → emailed | send_failed`; `emailed → (reopen) → new revision`.
- Only approved PDFs are emailed to the recipient. A "waiting for review" notice goes to the recipient address on submit.
- Test number typed by the inspector; duplicate clears it; revision suffix `Rev N` in PDF/email.
- Submit requires: date, test number, site name, site address, customer name, every `check` answered, inspector signature.
- Email via Gmail SMTP with app password; env vars `GMAIL_USER`, `GMAIL_APP_PASSWORD`. `MAIL_MODE=log` logs instead of sending (tests/dev).
- Other env vars: `DATABASE_URL`, `APP_URL`, `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`, optional `CHROME_PATH` (local PDF).
- Commits follow the user's global git rules (author, no AI mention); code comments short, one line. Commit only with the user's go-ahead; never push, deploy or create cloud resources without explicit approval.
- Design: load `emil-design-eng`, `design-taste-frontend` and `mobile-native` skills before any UI task (Tasks 9–12).

## Review Focus

1. Mixed Hebrew + digits + Latin in one line (e.g. `גלאי עשן דגם SD-851 כמות 12`) must render in correct order in app and PDF → bidi test in Task 8.
2. Session expiry or network error during autosave must not lose input → localStorage mirror + retry test in Task 10.
3. Update banner tapped mid-form must save the draft before reload → test in Task 12.
4. Double-tap on Approve must not send two emails → transition test + parallel request check in Task 6.
5. iPhone photos (HEIC, 4000px+) must upload and appear in the PDF → compression test in Task 10.

---

## File Structure

```
package.json, vite.config.ts, tsconfig.json, netlify.toml, drizzle.config.ts, playwright.config.ts, index.html
shared/
  forms/types.ts, header.ts, f1220.ts, f536.ts, detectors.ts, aerosol.ts, gas.ts, index.ts, validate.ts
  status.ts
  pdf/Report.tsx, pdf/print.css
server/
  db/schema.ts, db/client.ts
  auth.ts, http.ts, blobs.ts, mail.ts, pdf.ts, submissions.ts
netlify/functions/
  auth-login.mts, auth-logout.mts, auth-me.mts, users.mts, settings.mts, profile.mts,
  submissions.mts, submission-action.mts, report-background.mts, files.mts
scripts/seed-admin.ts, scripts/render-sample.ts
src/
  main.tsx, App.tsx, routes.tsx
  styles/tokens.css, styles/app.css
  lib/api.ts, lib/auth.tsx, lib/autosave.ts, lib/image.ts
  ui/*                       primitives
  fill/FormFiller.tsx, fill/SectionNav.tsx, fill/fields/*.tsx
  pages/Login.tsx, Home.tsx, NewForm.tsx, Fill.tsx, SubmissionView.tsx, Profile.tsx
  pages/admin/Queue.tsx, Review.tsx, AllSubmissions.tsx, Users.tsx, Settings.tsx
  pwa/InstallBanner.tsx, pwa/UpdateBanner.tsx, pwa/platform.ts
public/icons/*, public/apple-touch-icon.png
tests/unit/*.test.ts, tests/e2e/*.spec.ts
```

---

### Task 1: Scaffold, tooling, RTL shell

**Files:** root config files, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/*`, `tests/unit/smoke.test.ts`.

- [ ] **Step 1:** `git init` (local only); Vite React-TS app in place; deps from Tech Stack; `.gitignore` (node_modules, dist, .env, .netlify, out).
- [ ] **Step 2:** `index.html`: `lang="he" dir="rtl"`, viewport with `viewport-fit=cover`, `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`.
- [ ] **Step 3:** `netlify.toml`: build `npm run build`, publish `dist`, functions `netlify/functions`, `node_bundler="esbuild"`, `external_node_modules=["@sparticuz/chromium"]`, SPA redirect `/* /index.html 200`.
- [ ] **Step 4:** Vitest; smoke test. `npx vitest run` → PASS; `npm run build` → succeeds.
- [ ] **Step 5:** Commit `chore: scaffold app`.

### Task 2: Database schema, client, seed

**Files:** `server/db/schema.ts`, `server/db/client.ts`, `drizzle.config.ts`, `scripts/seed-admin.ts`, `drizzle/`.

**Produces:**
- `users(id uuid pk, username text unique, displayName text, passwordHash text, role 'admin'|'inspector', active bool default true, signatureKey text null, createdAt)`
- `sessions(id text pk (32 random bytes hex), userId fk, expiresAt timestamptz, createdAt)` — 30 days, sliding.
- `loginAttempts(username text, ip text, ok bool, at timestamptz)`
- `settings(id int pk = 1, recipientEmail text, companyName text, companyDetails text, stampKey text null)`
- `submissions(id uuid pk, formId text, formVersion int, status text, inspectorId fk, data jsonb, revision int default 0, parentId uuid null, testNumber text null, siteName text null, reviewNote text null, approvedBy fk null, approvedAt, submittedAt, emailedAt, pdfKey text null, sendError text null, createdAt, updatedAt)` — `testNumber`/`siteName` mirrored from `data` on save for listing.
- `attachments(id uuid pk, submissionId fk, fieldId text, kind 'photo'|'signature'|'drawing', blobKey text, createdAt)`
- `auditLog(id serial, submissionId fk, userId fk, action text, fieldId text null, oldValue jsonb, newValue jsonb, note text null, at timestamptz)`
- `db` from `client.ts`: `drizzle(neon(process.env.DATABASE_URL))` (neon-http).

- [ ] **Step 1:** Schema + config; `npx drizzle-kit generate` produces a migration.
- [ ] **Step 2:** `seed-admin.ts`: create admin from env if absent + settings row; idempotent.
- [ ] **Step 3:** (After user approves creating the Neon project) create it, `DATABASE_URL` → `.env`, `npx drizzle-kit migrate`, run seed twice → second run prints `exists`.
- [ ] **Step 4:** Commit `feat: database schema and seed`.

### Task 3: Auth

**Files:** `server/auth.ts`, `server/http.ts`, `netlify/functions/auth-*.mts`, `tests/unit/auth.test.ts`.

**Produces:**
- `hashPassword(p): Promise<string>`, `verifyPassword(p, hash): Promise<boolean>` (bcryptjs, cost 10)
- `isRateLimited(failedTimes: Date[], now: Date): boolean` — true for ≥5 failures in last 15 min
- `createSession(userId): Promise<{id, expiresAt}>`, `sessionCookie(id, expiresAt): string` (`sid`, HttpOnly, Secure, SameSite=Lax, Path=/)
- `requireUser(req: Request, role?: 'admin'): Promise<User>` — throws `HttpError(401|403)`; extends session when <15 days left
- `http.ts`: `json(data, status?)`, `class HttpError(status, message, body?)`, `handle(fn)` mapping errors → `{error}`, `parseBody(req, zodSchema)`
- Routes: `POST /api/auth/login {username,password}` → `{user}` + cookie; `POST /api/auth/logout`; `GET /api/auth/me` → `{user}` | 401.

- [ ] **Step 1: Tests:** hash/verify round-trip true, wrong password false; `isRateLimited` 5 failures within 15 min → true, 4 → false, 5 spread over 20 min → false.
- [ ] **Step 2:** FAIL → implement → PASS. Login error for wrong/inactive/limited: `שם משתמש או סיסמה שגויים` (limited: `יותר מדי ניסיונות, נסה שוב בעוד מספר דקות`).
- [ ] **Step 3:** Commit `feat: auth`.

### Task 4: Users, settings, profile, files APIs

**Files:** `netlify/functions/users.mts`, `settings.mts`, `profile.mts`, `files.mts`, `server/blobs.ts`.

**Produces:**
- `GET/POST /api/users` (admin) — create `{username, displayName, password(min 6), role}`; `PATCH /api/users/:id {displayName?, role?, active?, password?}`; admin cannot deactivate or demote self.
- `GET /api/settings` (any user); `PUT /api/settings {recipientEmail, companyName, companyDetails}` (admin); `PUT /api/settings/stamp` (admin, image).
- `GET /api/profile`; `PUT /api/profile/signature` (PNG) — any user.
- `POST /api/files` multipart `{submissionId, fieldId, kind, file}` → `{id, url}`; `GET /api/files/:id` streams if owner or admin; `DELETE /api/files/:id` (owner while editable, or admin).
- `blobs.ts`: `putBlob(key, data: ArrayBuffer|Buffer, contentType)`, `getBlob(key): Promise<{data, contentType}|null>`, `deleteBlob(key)`; store `files`.

- [ ] **Step 1:** Implement; `netlify dev` + curl: admin creates inspector → 200; inspector calls `POST /api/users` → 403; inspector reads another inspector's file → 403.
- [ ] **Step 2:** Commit `feat: users settings files api`.

### Task 5: Form model, validation, five definitions

**Files:** `shared/forms/*.ts`, `tests/unit/forms.test.ts`, `tests/unit/validate.test.ts`.

**Produces (`types.ts`):**
```ts
type AnswerSet = 'yesNoNA' | 'fitNotfitNA' | 'existsActive' | 'conclusion';
// yesNoNA: כן/לא/ב"י · fitNotfitNA: מתאים/לא מתאים/ל"ר · existsActive: קיים|לא קיים × פעיל|לא פעיל · conclusion: מתאים/לא מתאים + text
type Field =
 | {type:'text'|'textarea'|'number'|'date'|'time'; id: string; label: string; required?: boolean}
 | {type:'choice'; id: string; label: string; options: string[]; required?: boolean}
 | {type:'check'; id: string; clause?: string; topic?: string; text: string; answers: AnswerSet; inline?: {id: string; label: string}[]}
 | {type:'equipmentTable'; id: string; rows: string[]}              // cols יצרן, דגם, כמות
 | {type:'repeatTable'; id: string; label: string; columns: {id: string; label: string; type:'text'|'number'|'choice'; options?: string[]}[]; minRows?: number}
 | {type:'systemsGrid'; id: string; systems: string[]; allowOther: boolean}
 | {type:'contactAck'; id: string; label: string}                   // name, role, phone, time, signature
 | {type:'signature'; id: string; label: string; role:'inspector'|'approver'}
 | {type:'photos'; id: string; label: string}
 | {type:'drawing'; id: string; label: string}
 | {type:'scenarioMatrix'; id: string; actions: string[]; values: string[]}   // values + / למ / - / לח
 | {type:'note'; id: string; text: string};
type Section = {id: string; title: string; fields: Field[]};
type FormDef = {id: 'f1220'|'f536'|'detectors'|'aerosol'|'gas'; docNumber: string; title: string; version: number; sections: Section[]};
```
- `header.ts`: `headerSection(opts: {gushHelkaMigrash?: boolean; owner?: boolean; installer?: boolean; times?: boolean}): Section`; ids `date, testNumber, orderNumber, startTime, endTime, siteName, siteAddress, buildingPurpose, gush, helka, migrash, ownerName, ownerMobile, ownerOffice, customerName, customerAddress, customerPhone, customerEmail, installerName, installerAddress, installerPhone, installerId`.
- `index.ts`: `FORMS: FormDef[]`, `getForm(id: string, version?: number): FormDef`.
- `validate.ts`: `validateForSubmit(def, data, attachments): {ok: boolean; missing: {sectionId: string; fieldId: string; label: string}[]}`; `markSectionNA(def, sectionId, data): data` — fills only unanswered checks with the set's NA value (`existsActive` → `לא קיים`).
- `docNumber`: f1220 `T-20001-1`, f536 `T-20004-5`; others `''` (PDF shows title only).

- [ ] **Step 1: Tests (`forms.test.ts`):** for every form — field ids unique; header section first; has inspector and approver `signature`; ends with `photos`; every `check.text` non-empty. f1220 ≥125 checks; aerosol exactly 23 checks and 1 `drawing`; gas 2 `drawing`; f536 has `scenarioMatrix`; detectors has `repeatTable` with column labels `קומה`, `מס' דירה`, `כמות גלאים`, `מיקום גלאים`.
- [ ] **Step 2: Tests (`validate.test.ts`):** empty data → `missing` includes `date, testNumber, siteName, siteAddress, customerName`, the inspector signature and every check; after `markSectionNA` on all sections + those fields + signature → `ok: true`; an answered check keeps its value after `markSectionNA`.
- [ ] **Step 3:** FAIL → implement types/header/validate.
- [ ] **Step 4:** Transcribe the five forms from `files/*.docx` (view tables with `textutil -convert html -stdout <file>`). Hebrew text and clause numbers verbatim. Approver signature maps to `שם המאשר` (detectors), `ראש תחום` (f536), added block elsewhere. Each "פירוט ליקויים והערות" → `textarea`.
- [ ] **Step 5:** PASS. Commit `feat: form definitions`.

### Task 6: Submissions API, status machine, audit

**Files:** `shared/status.ts`, `server/submissions.ts`, `netlify/functions/submissions.mts`, `submission-action.mts`, `tests/unit/status.test.ts`.

**Produces:**
- `type Status = 'draft'|'submitted'|'returned'|'approved'|'sending'|'emailed'|'send_failed'`; `canTransition(from: Status, action: 'submit'|'return'|'approve'|'reopen'|'retry'|'edit', role: Role): Status | null`.
- `GET /api/submissions?status&formId&inspectorId` (inspector: own only) → summaries.
- `POST /api/submissions {formId}` → draft; `POST /api/submissions/:id/duplicate` → draft copy without `testNumber`, `date`, signatures, photos, drawings.
- `GET /api/submissions/:id` → submission + attachments (+ audit for admin).
- `PATCH /api/submissions/:id {data, updatedAt}` — inspector in `draft|returned`, admin in `submitted`; 409 if `updatedAt` stale; admin edits write one `auditLog` row per changed field id.
- `POST /api/submissions/:id/action {action, note?}`: `submit` → `validateForSubmit` (422 `{missing}`) then notice email (Task 7); `return` requires note; `approve` → approvedBy/At, status `sending`, triggers `report-background`; `retry` from `send_failed`; `reopen` from `emailed` → new row `parentId`, `revision+1`, status `submitted`, same data.
- Transitions use `UPDATE … WHERE id=$1 AND status=$expected RETURNING`; no row → 409.

- [ ] **Step 1: Tests:** `('draft','submit','inspector')→'submitted'`; `('submitted','approve','inspector')→null`; `('submitted','approve','admin')→'sending'`; `('sending','approve','admin')→null`; `('emailed','reopen','admin')→'submitted'`; `('send_failed','retry','admin')→'sending'`; `('returned','edit','inspector')` non-null; `('submitted','edit','inspector')→null`; `('returned','submit','inspector')→'submitted'`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Two parallel approve requests → one 200, one 409.
- [ ] **Step 4:** Commit `feat: submissions api`.

### Task 7: Email

**Files:** `server/mail.ts`; wire into Task 6 `submit`.

**Produces:** `sendMail({to, subject, html, attachments?: {filename: string; content: Buffer}[]}): Promise<void>` (nodemailer `service:'gmail'`; `MAIL_MODE=log` → console). `notifySubmitted(submission, def, inspectorName)` → to `settings.recipientEmail`, subject `טופס ממתין לאישור – {title} – {siteName}`, link `${APP_URL}/admin/review/{id}`. Notice failure is logged, never fails the submit.

- [ ] **Step 1:** Implement; real send once the user provides Gmail credentials. Commit `feat: email`.

### Task 8: PDF

**Files:** `shared/pdf/Report.tsx`, `shared/pdf/print.css`, `server/pdf.ts`, `netlify/functions/report-background.mts`, `scripts/render-sample.ts`, `tests/unit/pdf-html.test.ts`, `tests/fixtures/*.json`.

**Produces:**
- `<Report def data images settings approver revision />` — A4, RTL, company header, doc number + revision, check tables (סעיף | דרישה | תוצאה | הערה), tables, signatures as images, approver block (name/date/signature), stamp at end, photo appendix (2 per page).
- `renderReportHtml(props): string` — react-dom/server; CSS, font and images inlined (data URLs).
- `htmlToPdf(html): Promise<Buffer>` — puppeteer-core + @sparticuz/chromium (`CHROME_PATH` locally); `format:'A4'`, `printBackground:true`, footer `עמוד X מתוך Y`.
- Background function: load → render → `putBlob('pdf/{id}-r{revision}.pdf')` → email recipient with PDF, subject `{title} – {siteName} – {testNumber}` + ` Rev {n} (תיקון)` when revision>0 → `emailed`; on error `send_failed` + `sendError`.

- [ ] **Step 1: Test:** `renderReportHtml` for a fixture of each form contains `dir="rtl"`, the doc number, every check text, the approver name, and every user-entered value wrapped in `<bdi>`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** `render-sample.ts` writes `out/<form>.pdf` for all five fixtures (fixtures include `גלאי עשן דגם SD-851 כמות 12`); visually confirm order; show the user.
- [ ] **Step 4:** Check Netlify plan limits; if background functions unavailable, use a regular function with the same status flow. Commit `feat: pdf report`.

### Task 9: Design system and app shell

Load `emil-design-eng`, `design-taste-frontend`, `mobile-native` first.

**Files:** `src/styles/tokens.css`, `src/ui/*`, `src/lib/api.ts`, `src/lib/auth.tsx`, `src/routes.tsx`, `src/pages/Login.tsx`, `playwright.config.ts`, `tests/e2e/login.spec.ts`.

**Produces:** `api<T>(path, init?): Promise<T>` (JSON, `credentials:'include'`, throws `ApiError{status, body}`; on 401 flushes registered autosave then routes to `/login`); `AuthProvider`, `useAuth(): {user, login(u,p), logout()}`; `<RequireRole role?>`. Primitives: `Button`, `Segmented` (≥44px), `TextField`, `Sheet` (bottom sheet <768px, dialog ≥768px), `Banner`, `StatusBadge`, `EmptyState`, `toast`. Hebrew font chosen per the skills.

- [ ] **Step 1:** Implement; login works against `netlify dev`.
- [ ] **Step 2:** e2e on projects `iPhone 14`, `iPad (gen 7)`, `Desktop Chrome`: wrong password shows error; correct lands on home.
- [ ] **Step 3:** Commit `feat: app shell and login`.

### Task 10: Form filling

**Files:** `src/fill/*`, `src/lib/autosave.ts`, `src/lib/image.ts`, `src/pages/NewForm.tsx`, `src/pages/Fill.tsx`, `tests/unit/autosave.test.ts`, `tests/e2e/fill.spec.ts`.

**Produces:**
- `FieldRenderer` + one component per field type in `src/fill/fields/`.
- `SectionNav`: answered/total per section; bottom sheet on phone, side column ≥1024px; per-section `סמן את השאר כ-ב"י` → `markSectionNA`.
- `createAutosave({save: (data) => Promise<{updatedAt}>, storageKey, delay?: 1500}): {update(data): void; flush(): Promise<void>; subscribe(fn: (s: 'saved'|'saving'|'offline'|'error') => void)}` — localStorage write on every update, debounced server save, retry with backoff, local copy cleared after server confirms; on load prefer local copy if newer than server `updatedAt`.
- `compressImage(file: File): Promise<Blob>` — JPEG, long edge ≤1600, quality 0.8.
- Signature via `signature_pad` in a `Sheet`, with "use my saved signature"; drawing via `perfect-freehand` with undo/clear and "photo instead".
- Submit → action `submit`; 422 → list of missing items, tap jumps to field.

- [ ] **Step 1: Tests:** `update` writes localStorage synchronously; save rejecting twice then resolving ends `saved` with localStorage cleared; `flush` resolves after pending save completes.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** e2e (iPhone 14, iPad): new aerosol form, fill required header, mark all NA, sign, upload a 4000×3000 JPEG fixture (stored upload ≤1600px), submit → `submitted`; reload mid-fill keeps values.
- [ ] **Step 4:** Commit `feat: form filling`.

### Task 11: Inspector home, history, admin screens

**Files:** `src/pages/Home.tsx`, `SubmissionView.tsx`, `Profile.tsx`, `src/pages/admin/*`, `tests/e2e/review.spec.ts`.

- Inspector home: `טופס חדש` (5 cards), drafts, returned (note highlighted), sent/approved; duplicate.
- Admin: Queue; Review (filler in admin edit mode + audit list + return-with-note + Approve); AllSubmissions (filters form/inspector/status/date, PDF download, retry on `send_failed`, reopen on `emailed`); Users (create, reset password, activate/deactivate); Settings (recipient email, company name/details, stamp upload); Profile (saved signature, all roles).
- Phone: bottom tab bar; ≥1024px: side navigation.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** e2e (Desktop, iPad, `MAIL_MODE=log`): admin returns with note → inspector sees note, resubmits → admin approves → status reaches `emailed`; Approve button disabled while pending.
- [ ] **Step 3:** Commit `feat: history and admin`.

### Task 12: PWA install and update banners

**Files:** `vite.config.ts`, `public/icons/*`, `public/apple-touch-icon.png`, `src/pwa/*`, `tests/unit/platform.test.ts`, `tests/unit/update-banner.test.tsx`.

**Produces:**
- Manifest: `name`/`short_name` (company name from user), `lang:'he'`, `dir:'rtl'`, `display:'standalone'`, `start_url:'/'`, icons 192/512/maskable; apple-touch-icon 180. API routes excluded from SW caching.
- `getInstallMode(ua: string, standalone: boolean): 'installed'|'android-prompt'|'ios-safari'|'ios-other'|'unsupported'`.
- `InstallBanner`: after login when mode not `installed`/`unsupported` and not dismissed in last 3 days (localStorage in try/catch). Android: button → saved `beforeinstallprompt.prompt()`. iOS: sheet with Share → "הוסף למסך הבית" steps and illustration.
- `UpdateBanner`: `useRegisterSW` (prompt mode); `registration.update()` on `visibilitychange` and every 30 min; button awaits active autosave `flush()` then `updateServiceWorker(true)`.

- [ ] **Step 1: Tests:** iPhone Safari UA → `ios-safari`; iPhone CriOS UA → `ios-other`; Android Chrome UA → `android-prompt`; standalone true → `installed`. Update button calls `flush` before `updateServiceWorker` (mocks, call order asserted).
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Lighthouse installability on `npm run preview`. Commit `feat: pwa banners`.

### Task 13: Deploy

- [ ] **Step 1:** (User approval) create Netlify site, set env vars, deploy; migrate + seed production Neon.
- [ ] **Step 2:** Production smoke with Playwright: login → create → submit → approve → email received.
- [ ] **Step 3:** Give the user a real-device checklist: iPhone Safari + installed, Android install prompt, camera, signature, update banner after a redeploy.
