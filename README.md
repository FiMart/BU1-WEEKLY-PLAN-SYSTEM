# BU1 Lab Weekly Plan

This is the BU1 Lab's weekly planning system: daily job plans (at most 20 per day), a per-person summary, person and vehicle conflict warnings, a long-project manpower plan, history search, a dashboard and A3 print/export.

## Where the data lives

The same `index.html` picks its backend when it starts:

| Opened on | Backend | Login |
|---|---|---|
| The claude.ai link https://claude.ai/artifact/ACj2AoCxEjqpApU6672Vmz | the claude.ai shared database | claude.ai account |
| Your own website, with `js/config.js` filled in | **central Supabase project** (shared with Weekly Plan BU2 and Safety Training Record), rows with `dept_id = 'BU1'` | the shared company account (Supabase Auth e-mail + password) |
| Anything else, e.g. double-clicking `index.html` | offline sample data (nothing is saved) | none |

Pages on claude.ai cannot call other websites, so the Supabase mode only works when the files are hosted as a normal website.

## Connecting to the central Supabase project

The code follows the central-DB guide "ต่อ DB เข้ากับ Supabase กลาง" (1 Oct 2026). The system owner does the connection; this repository never holds a URL or key.

- Data layer: `js/data/backend.js` with `list / upsert / remove` (pages of 1,000 rows, deletes in chunks of 200, errors thrown) and realtime filtered by `dept_id` on the client. `js/data/supabase.js` adapts it to the Store; the views are unchanged.
- Every row has `dept_id`; the primary key is `(id, dept_id)`; ids are client-made strings; users are e-mails in lower case; dates are local `YYYY-MM-DD`.
- No sign-up or approval inside the app: one company account works for every app, and access to BU1 comes from `public.user_roles` (`core.my_depts()`), enforced by row level security.
- `supabase/schema.sql`: tables in the app's own schema `bu1wp` with RLS and realtime. **Do not run it yourself**: send it to the system owner to review and run.
- `supabase/HANDOFF.md`: the 7 items the owner asked for (entities with JSON examples, data layer, users, volume, realtime, uploads).
- After the owner runs the SQL, adds `bu1wp` to Exposed schemas and gives the first `user_roles` rows, they fill `supabaseUrl` and `supabaseAnonKey` (anon key only, never service_role) in `js/config.js`, and the files are hosted as a static website (no build step).
### Moving the data from claude.ai to Supabase

1. On the claude.ai link: **จัดการข้อมูล → สำรอง / ย้ายข้อมูล → ดาวน์โหลดไฟล์สำรอง**.
2. On the Supabase website, signed in with an account that may edit BU1: **จัดการข้อมูล → สำรอง / ย้ายข้อมูล → เลือกไฟล์สำรอง → นำเข้าข้อมูล**.

Records with the same id are overwritten; nothing else is deleted. The same export works as a monthly backup.

## Folder layout

```
index.html              entry point: markup, then loads CSS and JS in order
assets/favicon.svg      browser tab icon (vector, modern browsers)
assets/favicon-32.png   tab icon fallback (Safari / older browsers)
assets/apple-touch-icon.png  180px home-screen icon for iPhone / iPad
assets/help/*.jpg       frames of the help clips (js/views/help-clips.js); rebuilt by tools/help-clips/gen.ps1
supabase/schema.sql     tables in schema bu1wp, RLS by dept_id, realtime (for the system owner to review and run)
supabase/HANDOFF.md     hand-off to the central Supabase owner (entities, data layer, volume, realtime)
css/                    loaded in this order (later files override earlier ones)
  base.css              tokens, form controls, buttons, dialogs, keyframes
  views.css             people summary, manpower, search, dashboard basics, help
  shell.css             sidebar, page head, week board, plan card, side drawer, worker picker
  theme.css             "Field Ops" palette and typography
  attachments.css       file attachments, transport field
  sidebar.css           blue → sky sidebar
  dashboard.css         dashboard tiles, daily chart, tables
  master-data.css       master data topic list
  auth.css              sign-in screen, backup
  account.css           account card in the sidebar, "บัญชีของฉัน" window, การตั้งค่า (preferences) lists
  available.css         ว่าง (Available) row and free-count badges on the weekly board
  plan-day.css          daily Weekly Plan view (default on tablet and phone)
  responsive.css        tablet (761–1180px) and phone (≤760px) proportions
  scale.css             fluid UI scale: zoom by window width (base 1680px, 0.8–1.12×); screen-sized lengths use --vh / --vw
  motion.css            motion tuning (keep last)
js/                     classic scripts sharing one global scope, loaded in this order
  config.js             central Supabase URL / anon key (left empty), deptId, schema (loads first)
  core/constants.js     job types, periods, statuses, calendar names
  core/utils.js         DOM/date/text helpers, master data lookups
  core/state.js         app state, per-viewer preferences
  data/store.js         shared db or in-memory store, cached range reads, week helpers
  data/conflicts.js     people/vehicle lookups, conflict detection
  data/backend.js       data layer for the central Supabase: list / upsert / remove / watch by dept_id
  data/supabase.js      db adapter on the backend, sign-in (shared account), department access check
  ui/render.js          render loop, sidebar, filter bar, banners, week bar
  views/plan.js         Weekly Plan board (rows × days)
  features/share.js     copy for LINE, screenshot, dark mode
  views/people.js       per-person daily summary
  views/projects.js     long-project manpower plan
  views/search.js       history search
  views/dashboard.js    dashboard
  views/settings.js     master data
  views/help.js         help page
  dialog/picker.js      plan drawer: Team Service picker
  dialog/fields.js      plan drawer: transport, Sale, job type options
  dialog/attachments.js plan drawer: photos, files, lightbox
  dialog/task-form.js   plan drawer: view/edit, validation, save, delete, copy
  features/master-actions.js  master data actions
  features/backup.js    export / import all data as JSON (move to Supabase, backups)
  features/account.js   signed-in account: name, photo, access level, device preferences
  features/about.js     APP_VERSION, build date and change log (จัดการข้อมูล › เกี่ยวกับระบบ)
  features/export.js    Excel and A3 print exports
  app/events.js         global event handlers
  app/boot.js           picks the backend, wires live data, starts the app (must load last)
archive/weekly-plan.single-file.html   the old single-file version (reference only)
tools/split-single-file.ps1            one-time script that produced this layout (do not rerun)
```

## Rules when editing

- The JS files are plain `<script>` files, not ES modules. They share one global scope, so a file can use anything declared in a file loaded **before** it. Code that runs at load time must not call something declared in a later file. `js/app/boot.js` calls `init()` last, after everything else has loaded.
- If you add a file, add its `<script>` or `<link>` tag to `index.html` in the right order.
- Views and the Store talk to `db` through one interface (`collection / doc / where / get / set / update / delete / onSnapshot`). `js/data/supabase.js` implements that interface on Supabase, so new features work on both backends without extra code.
- Use the words "แผน" / "แผนงาน" in the UI, not "การ์ด". Never write "แผนที่…", because it reads as "map".
