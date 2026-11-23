# Faster Work: All OK, My Day, Calendar, Monthly Export

## Why

Make daily work faster for inspectors in the field and for the office. Every inspection is done once (no repeat or yearly visits), so nothing here relies on earlier reports of the same site.

## Goals

1. **All OK** – inspector marks every empty check in a section as the positive answer in one tap, then fixes the exceptions.
2. **My day** – inspector home shows open jobs as today / tomorrow / later, with Waze on the first job of today.
3. **Calendar** – office sees a week of jobs per inspector, both to see what everyone is doing and to find who is free to take a new job.
4. **Monthly export** – office downloads one .xlsx per month counting work done per inspector and per client, for billing.

## Non-goals

- Defect quick-pick phrases (dropped for now).
- Prices or amounts in the export: counts only.
- Visit times or route order inside a day.
- Drag-and-drop in the calendar (reassign already exists on the job page).
- Copy from a previous visit, recurring jobs, due dates.

## Anti-goals

- All OK must never overwrite an answer the inspector already gave or one set by the auto N/A rules.
- The export must never count a form twice (revisions, reopen) or count work that is not approved.

## Constraints

- Hebrew RTL copy, components from `src/ui`, phone first.
- No new dependencies. The .xlsx is built with `fflate` (already installed).
- Dates in Asia/Jerusalem, as elsewhere in the app.
- Admin-only server endpoint for the export.

## Approaches

**Export.** (A, chosen) New admin endpoint `GET /api/export?month=YYYY-MM` queries the DB and returns the .xlsx. (B) Build it in the browser from the existing list endpoints: rejected, those lists lack approval dates and client details for every form, and would download every form just to count.

**Calendar.** (A, chosen) New admin page "יומן" using the existing `listJobs()` and filtering the week in the browser. (B) A list/calendar toggle on the עבודות page: rejected, that page's inspector and client filters do not fit a grid.

**All OK, My day.** One sensible way each, client side only, inside the existing components.

## Design

### 1. All OK (inspector, form filling)

- New shared helper next to `markSectionNACount` in `shared/forms/validate.ts`: `markSectionOKCount(def, sectionId, data) → { data, changed }`.
  - For each `check` field in the section whose `answer` is blank: set the positive answer. `yesNoNA` → `כן`, `fitNotfitNA` → `מתאים`, `existsActive` → `קיים` with `active: 'פעיל'`.
  - Skips any check that already has an answer (including `auto: true` ones from the N/A rules).
  - Skips `conclusion` checks (my call): they are the report's overall verdict and must be a deliberate choice.
  - Skips every check listed in the form's auto N/A rules (`shared/forms/rules.ts`, e.g. f1220 c16, c117, c118, c98–c102) (my call). Rules only fill blank checks, so a "כן" set before `riskLevel` or the equipment table is filled would block a required N/A forever. Those few checks stay for the inspector or the rules. `rules.ts` exports the set of rule-controlled check ids per form.
- Button "סמן את השאר כתקין" shown wherever the "סמן את השאר כ-…" N/A button shows today: the section card header (`SectionCard` in `FormFiller.tsx`) and `SectionNav`. Same visibility rules: not read-only, section not complete, section has checks.
- After the tap: toast `N סעיפים סומנו כתקין`, or `כל הסעיפים כבר סומנו` when nothing changed. Same flow as `markNA` (updates `dataRef` and state, autosave picks it up).
- No undo (my call): the existing N/A button has none, toasts have no action button, and each answer can be changed by tapping it.

### 2. My day (inspector home)

In `InspectorHome` (`src/pages/Home.tsx`), the open-jobs group (`state` open or cancelled-open) splits into:

- **היום** – planned today or earlier. Earlier ones are late: shown first, with a "באיחור" tag on the card.
- **מחר** – planned tomorrow.
- **בהמשך** – everything later.

Empty groups are hidden. Inside a group: by date, then site name. `cancelled-open` jobs (cancelled, forms still open) keep their existing card look and go last in their group. The first `open` card of היום gets a large Waze button (existing `WazeButton`, full width). "Today" uses the same Asia/Jerusalem date helper as the office overview. A small shared pure function does the split, so it is unit tested.

### 3. Calendar (office)

New page `src/pages/admin/Calendar.tsx`, route `/admin/calendar`, nav item "יומן" in `AppShell` after עבודות.

```
            א׳ 23   ב׳ 24   ג׳ 25   ד׳ 26   ה׳ 27   ו׳ 28
יוסי      [כהן·מגדל]   +    [לוי·מחסן]    +   ...
דנה          +    [ABC·משרד]   +     ...
     ‹ שבוע קודם      השבוע      שבוע הבא ›
```

- Week runs Sunday to Friday (6 days). Header shows day name and date; today's column is highlighted.
- Rows: every active inspector (from `listInspectors`), even with no jobs, so free days are visible.
- Cell: each job as a small chip "לקוח · אתר", linking to `/jobs/:id`. Done jobs dimmed; `cancelled` jobs hidden; `cancelled-open` shown dimmed with a "בוטלה" tag (forms still need closing). Open jobs from past days stay where they are (no moving).
- Empty cell (and a "+" in a cell with jobs): opens `/admin/jobs/new?inspectorId=…&date=…`; `JobNew` reads those two query params as initial values.
- Phone width: one inspector at a time with an inspector picker above, days as a vertical list. Wider screens: the grid.
- Data: `listJobs()` once (cached by `useLoad`), filtered to the week in the browser.
  `shortcut: loads all jobs, add a from/to filter to /api/jobs when jobs reach the thousands.`

### 4. Monthly export (office)

- **Where:** a card "ייצוא חודשי" on the admin Settings page: month picker (default: last month) and a download button.
- **Endpoint:** `GET /api/export?month=YYYY-MM`, admin only, returns `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with filename `elco-YYYY-MM.xlsx`. Invalid month → 400.
- **What counts:** one approved form = one unit, counted once, at its **first approval** (decided). Reopen leaves the approved row as is (keeps `approvedAt`) and inserts a child revision with `parentId` set, so the query counts only original rows: `parentId IS NULL AND approvedAt` in the month (Asia/Jerusalem). Revisions are never counted, so a month already exported never changes. Forms without a job count too.
- **Inspector credited:** the form's own `inspectorId` (who filled it), not the job's, since forms can be reassigned one by one (my call).
- **Client and site:** from the job when the form has one; else from the form's own data (`customerName`, `siteName`, `siteAddress`).
- **Sheets (RTL, Hebrew headers, bold header row, columns sized to content):**
  1. **פירוט** – one row per form: תאריך אישור, לקוח, אתר, כתובת, בודק, סוג טופס (short title), מס' בדיקה. Sorted by date.
  2. **לפי בודק** – one row per inspector: a column per form type with counts, then סה"כ. Last row: סה"כ.
  3. **לפי לקוח** – same, one row per client (rows sorted by name).
- **Building the file:** a small `server/xlsx.ts` that writes the minimal SpreadsheetML parts (content types, workbook, sheets as inline strings, a style for bold and RTL view) and zips them with `fflate`. Unit test: unzip the result and check sheet names, a header and a count.
- An empty month still returns a valid file with headers only.

## Testing

- Unit: `markSectionOKCount` (each answer set, skips answered and auto, existsActive sets active); My day split (late, today, tomorrow, later, timezone edge at midnight); export counting (approved in month, not other months, a reopened and re-approved form counted once in its first month, form without job uses its own data, credited to the form's inspector); xlsx writer round-trip.
- Manual on a phone: All OK in a 1220 section then the N/A rules; home on a day with late and today jobs; calendar at phone width; open the exported file in Excel and Numbers.

## Left to the builder

- Exact styling of chips, tags and buttons within the existing design.
- Name and file of the "today" date helper if one already exists (reuse it).
- How the Settings page lays out the export card.
