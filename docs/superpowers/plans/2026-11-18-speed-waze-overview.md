# Instant Screens, Waze, Office Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Screens show last-known data instantly, addresses open Waze, admin home becomes an overview.

**Architecture:** A cache inside `useLoad` (memory + one `localStorage` entry) gives stale-while-refresh to every screen. Waze is a link. The overview is client-side over existing list endpoints.

**Tech Stack:** React 18, react-router 6, vitest + jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-speed-waze-overview-design.md`

## Global Constraints

- Hebrew RTL copy, components from `src/ui`.
- No new endpoints, no new dependencies.
- `localStorage` access wrapped in try/catch; app works without it.
- Commits authored and committed as `younann <younan.n@gmail.com>`; no AI mention. Push only with the user's approval.
- Code comments: a few words, one line.

## Review Focus

1. Logout then login as another user → no data from the first user shown, even briefly. Test in Task 1.
2. Cached data present and refresh fails (offline) → cached data stays, no error screen. Test in Task 1.
3. `localStorage` full or throwing → screens still load. Test in Task 1.
4. Two screens with the same generic key (`'open'`) → never share data; keys renamed. Task 1.
5. Job planned yesterday, still open → counted as באיחור; job planned today → not late, counted in השבוע. Test in Task 3.

---

### Task 1: Cache in useLoad

**Files:**
- Modify: `src/lib/useLoad.ts`, `src/lib/auth.tsx` (clear on user change), `src/components/ReassignCard.tsx:30`, `src/pages/JobView.tsx:215` (key `'open'` → `'inspectors'`, idle key `'inspectors:off'`)
- Test: `tests/unit/use-load.test.tsx`

**Interfaces:**
- Produces: `useLoad<T>(fn, key): Load<T>` unchanged signature; `clearLoadCache(): void` exported from `src/lib/useLoad.ts`.

- [ ] **Step 1: Tests** (renderHook, fake fetch fns):
  - `shows cached data on remount before the fetch resolves` → second mount with same key has `data` on first render.
  - `keeps cached data when refresh fails` → `data` stays, `error` set.
  - `clearLoadCache empties memory and storage` → after clear, remount has `data === null`; `localStorage.getItem('load-cache')` is null.
  - `survives a throwing localStorage` → `setItem` throws, hook still returns fetched data.
- [ ] **Step 2:** Run `npx vitest run tests/unit/use-load.test.tsx` → FAIL.
- [ ] **Step 3:** Implement. Module `Map<string, unknown>` seeded once from `localStorage['load-cache']` (JSON object). Initial state and key change read the map (`setData(cache.get(key) ?? null)`). On success: set map, write whole map back (skip if JSON > 200_000 chars). `clearLoadCache()` clears map and removes the entry. In `auth.tsx`, call `clearLoadCache()` where the user cache is written whenever the new user is null or has a different id than the cached one.
- [ ] **Step 4:** Run unit tests → PASS; `npx tsc -b` clean.
- [ ] **Step 5:** Commit `feat: instant screens from cached data`.

### Task 2: Waze link

**Files:**
- Create: `src/lib/waze.ts`
- Modify: `src/pages/JobView.tsx:78`, `src/components/JobCard.tsx:21`
- Test: `tests/unit/waze.test.ts`

**Interfaces:**
- Produces: `wazeLink(address: string): string`.

- [ ] **Step 1: Test** `wazeLink('הרצל 12, חיפה')` === `'https://waze.com/ul?q=' + encodeURIComponent('הרצל 12, חיפה') + '&navigate=yes'`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; address rendered as `<a href={wazeLink(..)} target="_blank" rel="noopener" data-testid="waze">` with an accent underline style matching the tel link. In `JobCard` (whole card is a link) place the Waze link outside the card's `<Link>` or use a sibling element, never a nested `<a>`.
- [ ] **Step 4:** Unit tests PASS; tsc clean.
- [ ] **Step 5:** Commit `feat: open site address in Waze`.

### Task 3: Office overview

**Files:**
- Create: `src/pages/admin/Overview.tsx`, `shared/overview.ts`
- Modify: `src/pages/Home.tsx` (admin branch renders `<Overview />`)
- Test: `tests/unit/overview.test.ts`, update `tests/unit/home-admin.test.tsx`

**Interfaces:**
- Consumes: `listJobs()`, `listSubmissions()`, `JobRow`, `QueueList`, `useLoad`.
- Produces: `overview(jobs: JobSummary[], subs: { status: string }[], today: string): { late: JobSummary[]; week: JobSummary[]; waiting: number; returned: number }`.

- [ ] **Step 1: Tests** with `today='2026-11-18'`: open job planned `2026-11-17` → in `late`; open job `2026-11-18` and `2026-11-24` → in `week`, `2026-11-25` not; done or cancelled jobs in neither; `waiting` counts `submitted`, `returned` counts `returned`; `week` sorted by date.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `overview` (dates compared as `YYYY-MM-DD` strings; week end = today + 6 days). `Overview` page: greeting, 2×2 / 4-column counter grid (ממתינים לאישור → `#queue`, עבודות השבוע → `#week`, באיחור → `#late`, הוחזרו לבודק → `/admin/submissions?status=returned` if that filter exists, else `/admin/submissions`), then sections באיחור, השבוע (by `JobRow`), ממתינים לאישור (`QueueList`). Sections with nothing are hidden except the queue. Today from Asia/Jerusalem as in `JobNew`.
- [ ] **Step 4:** Unit tests PASS; tsc clean; build.
- [ ] **Step 5:** e2e suite green locally on port 8888.
- [ ] **Step 6:** Commit `feat: office overview`.
