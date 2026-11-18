# Instant screens, Waze link, office overview — Design

Date: 2026-11-18
Status: approved in conversation

## Why

The app should feel instant: today every screen shows a skeleton on each visit. Inspectors need one-tap navigation to the site. The office needs one screen that says what needs attention.

## Approaches (speed)

- **A. Remember the last result in `useLoad` (picked).** Show cached data at once, refresh in the background, persist to `localStorage`, clear on logout. One file, all 18 screens benefit.
- B. Service worker API cache. Rejected: survives logout, app can't tell stale from fresh.
- C. Local-first sync store. Rejected: weeks of work and conflicts; that is the offline project.

## Design

1. **Cache in `useLoad`.** Module map `key → data`, mirrored in `localStorage` under one entry (`load-cache:<userId>`). On mount: show cached data (no skeleton), then fetch and replace. `loading` stays true during the refresh. Keys must be unique per data: rename generic `'open'`/`'closed'` keys. Logout and user change clear the cache. Size guard: skip persisting values over ~200 KB. Errors keep cached data and show existing error UI only when there is no data.
2. **Waze.** Site address on `JobPage` and `JobCard` becomes a link to `https://waze.com/ul?q=<address>&navigate=yes` (new tab). Tapping the card elsewhere still opens the job.
3. **Office overview** (admin home). Four tappable counters: ממתינים לאישור, עבודות השבוע, באיחור (open jobs with planned date before today), הוחזרו לבודק (returned forms). Below: באיחור list, השבוע list (JobRow), then the existing queue list. Data from `listJobs()` and `listSubmissions()`; no new endpoint. Week = today to today+6 (Asia/Jerusalem).

## Non-goals

Offline editing, new APIs, charts, inspector overview.

## Anti-goals

- One user ever seeing another user's cached data.
- A save showing old data afterwards (mutations already call `reload`).
