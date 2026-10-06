# BU1 Weekly Plan — notes for Claude Code

Static web app (no build step): `index.html` + `css/` + `js/` (plain scripts, loaded in the order listed at the bottom of `index.html`).

## Backend: central Supabase project `myvwibwbwktskmfqjoez` (shared with BU2, Safety, GA)

Source documents: the BU2 hand-off package (`CLAUDE-HANDOFF.md`, `DB-CONTRACT.md`, `REQUEST-TO-BU2.md`, 5 Oct 2026). Its `files/reference/` folder was not supplied; formats below were read from the old BU1 app's public bundle (bu1-weekly-plan.vercel.app, v2.8.0).

- Real BU1 data lives in `public.bookings / people / cranes / equipment / scopes / tags / leaves / user_roles / root_causes / app_settings / cal_records / cal_roster`, rows `{id, dept_id:'BU1', [week], data:{id, …}}`, PK `(dept_id, id)`.
- **The old BU1 app is still live and writes the same rows.** Never change the JSON shape; map in `js/data/backend.js`. Keep unknown fields on save (`{...old, ...changes}`), especially `gaCar` (written by GA, read-only for us).
- Formats: `week` = Monday `YYYY-MM-DD` (local time), `day` = `mon…sun`, `session` = `morning|afternoon` (none = full day), `jobType` = `routine|fine_more|pm_internal|training|site_survey`, `status` = `planned|done|issue` (+ `problem`), customers stored by id (`L1`=Lab A, `L2`=Lab B).
- Fields only this app has go under `data.bu1wp` (detail, request, contact, sale, guests, prep checklist, precise status, timeNote, transport text, createdAt/updatedAt/By).
- Every select/delete `.eq('dept_id','BU1')`; every upsert sets `dept_id`; `bookings` and `leaves` must also write the `week` column. Page selects with `order('id').range()` (1,000-row cap).
- Roles: `public.user_roles.data.level` = `admin|planer|engineer|sale|ga|viewer`. RLS only checks department membership, so level rules are enforced in `js/features/roles.js`.
- ⚠ The old app's "sync" deletes rows it does not hold locally (`delete … where id not in local list`). Rows written by this app could be deleted by a stale old-app tab — check with the owner before switching writes on.

## Rules (from the hand-off)

1. Never run SQL / change RLS / create migrations. Draft a request with `REQUEST-TO-BU2.md` instead.
2. Never touch rows whose `dept_id` is not `BU1`; never delete without a where.
3. Production database for every department: test data must be removed afterwards.
4. Dates: Thai local time; never `toISOString().slice(0,10)`.
5. Ask the user before every deploy, and before starting each stage.

## Scope (user, 6 Oct 2026)

This app stays a **Weekly Plan only**. Keep this app's own job types (`DEFAULT_TYPES`) and manpower setup (positions, staff list).
Do **not** copy BU2 features: no Master Plan, no PM plan.
Added on request: **Safety Training** page (js/views/safety-pages.js + js/features/safety-forms.js, css/safety.css), modelled on BU2's Safety pages in the old BU1 bundle: Dashboard พื้นที่ (+ person's certificates & ID-card photos), คำขอของฉัน (5-step status from 0042, cancel / edit people / delete, history), ขออบรม form (area docs with per-request / stored / fresh attachments, add_area main-card check, draft when the area was requested before), บันทึกย้อนหลัง (completed request + certificates + photos), เอกสาร / ใบรับรอง (download as blob, rights mirror `safety.planner_can_read_file`). All Safety writes are refused while `readOnly` is on. Shown only on the central database (`body.central`).
Added later on request: **Booking Plan** page (js/views/booking.js) = BU2's read-only overview of every booking in every week, in this app's model (filters: customer chips, status, date range, vehicle, search; row opens the plan card).
From Safety, only the **area-card check when picking the team** (js/features/safety.js loads data, read only; rules in js/features/cert-status.js = **exactly BU2's certStatus** (user, 6 Oct 2026): first active area rule by cert_type_id, cards of that type with area_id = area or empty, latest expiry, compared with today; badges only ใกล้หมด / หมดอายุ / ไม่มีบัตร):
`people.id → core.person_id_map → safety.certificates`, area chosen per plan (`task.areaId` = `Booking.areaId`, auto-matched from Location by exact name / id / `match_terms`). Unlinked person = no badge (not "ไม่มีบัตร"); badges are warnings, never block; Safety failing to load must not stop planning; re-read on tab focus and every 60 s.
Sale may add/edit plans (same rights as Engineer, like BU2's `canEditPlan`).
**ใช้ทีมร่วมกับงานอื่นในพื้นที่เดียวกัน** (task.sharedTeam ↔ BU2's `data.allowSharedTeam`): same people on two plans of the same day/period are not a clash only when BOTH plans have it on and share the area (Safety area if both set, else the same Location, spaces/case ignored); leave never shares; vehicles still clash (`teamShared()` in js/data/conflicts.js).
Version: v4.0.0 (6 Oct 2026) in js/features/about.js covers everything since 3.8.0.
**Staff ↔ HR link** (js/features/staff-link.js, Safety tab "จับคู่พนักงาน"): writes `core.person_id_map` (dept_id, people_id, emp_code, verified_by, verified_at), admin/planer only. Suggests by name (exact, or first name) but every link is a person's choice (0022: no automatic name matching); one bulk button for letter-for-letter matches after a confirm listing them. The plan picker has "เฉพาะคนที่มีบัตรพื้นที่นี้" (card ok or warn today) and the team summary links to this tab when people are unlinked.

## Stages

1. Login + roles — done (`planer` level added; no `user_roles` row → "ยังไม่มีสิทธิ์" screen).
2. Read only — done (`BU1_CONFIG.readOnly:true` still switches every write off: plans, master data, Safety, user roles, prefs).
3. **Writes — switched on 6 Oct 2026** (user approved; user says the old BU1 app has never been used). `js/data/backend.js`:
   plans → `bookings` merged with the stored row (`{...old, ...mapped}`; gaCar / tag / scope / equipment / NCR fields kept; crane ids kept when the transport text is unchanged), `week` column + `data.week/day`, `session`/`craneSlot` from the period, our job type in `bu1wp.jobType` (data.jobType stays the old app's), cancelled → `needsGACar:false`;
   leave plans → `leaves` (one row per person, extra people as `<id>~<personId>`); moving between work and leave writes first, then deletes the old row;
   staff → `people`, vehicles → `cranes` (merged), config (job types, positions, **Sale list**) → `app_settings` id `bu1wp_config`, **NCR** → `app_settings` ids `bu1wp_ncr:<id>` (no new table: DDL is BU2's; the old app reads only the `targets` row);
   projects / photos / files → refused (`unsupported`). A failed write shows a red banner until a later write succeeds (`S.writeFail`, js/data/supabase.js).
   Tested only against an in-memory stand-in (49 checks); first real test = one test plan, then delete it.
4. Realtime both ways — auto refresh in place (`supaDb` in js/data/supabase.js): Supabase realtime if the tables publish it, plus a quiet re-read every 20 s, on tab focus and on `online`; callbacks fire only when rows changed. Loading UI: `loading(kind)` skeletons and the top bar `netTrack()` / `quietly()` in js/ui/render.js (background reads stay silent) · 5. GA car badge (`gaCar`) · 6. REQUEST-TO-BU2 for photo/file storage, projects, and (optional) proper NCR / settings tables.

## User decisions (6 Oct 2026)

- ใบเตรียมงาน: keep this app's per-plan checklist, stored as an extra field (`data.bu1wp.prep`), not BU2's Tag-based model.
- Transport: stays free text (also pick from the vehicle list); not limited to registered vehicles.
- Photos / file attachments: switched back on (user, 6 Oct 2026) as a stopgap in `app_settings` rows `bu1wp_photo:<id>` (resized JPEG data URL) and `bu1wp_file:<fileId>_<n>` (180 kB base64 chunks); the plan lists them in `data.bu1wp.photoIds/fileIds/files`. Move them to a Storage bucket once BU2 creates one (REQUEST-TO-BU2).
- Projects: still hidden (`body.central`), no storage.
- Phone bottom bar: 5 slots (แผนงาน · Booking · Safety · รายคน · เพิ่มเติม); "เพิ่มเติม" opens `#bnSheet` with the other pages.

`supabase/schema.sql` and `supabase/HANDOFF.md` describe an own-schema design (`bu1wp`) that the central project does not use — obsolete, kept for history only.
