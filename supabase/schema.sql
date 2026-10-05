-- BU1 Weekly Plan · tables on the central Supabase project
-- ⚠ ส่งไฟล์นี้ให้เจ้าของระบบกลางตรวจก่อนรัน (DB นี้มีแอปอื่นใช้งานจริงอยู่) · รันซ้ำได้ (สร้างเฉพาะที่ยังไม่มี และแทนที่ policy)
-- Follows "ต่อ DB เข้ากับ Supabase กลาง" (1 Oct 2026):
--   * own schema "bu1wp" (add it to Supabase → Project Settings → Data API → Exposed schemas); no table in public
--   * one table per entity, the whole object in data jsonb (same pattern as public.bookings / public.user_roles)
--   * primary key (id, dept_id); id is a string made by the app; every row has dept_id ('BU1')
--   * read: departments from core.my_depts() (setof text, so it is wrapped in a sub-select inside policies)
--   * write: by role = data->>'level' of the person's public.user_roles row for that department
--       admin    → everything
--       engineer → plans (tasks), projects, photos, attachment chunks, NCR · no master data, no deleting plans or NCR
--       ga       → may update plans (the app lets GA change only the car fields)
--       sale, viewer → read only
-- Entities: tasks · staff · resources · projects · config · photos · filechunks · ncr   (see supabase/HANDOFF.md)
-- v3.7.0 adds bu1wp.ncr (งานไม่เสร็จ / NCR). If the other tables already exist, re-running this file only creates ncr
-- and re-applies the same policies.

create schema if not exists bu1wp;
grant usage on schema bu1wp to authenticated;

-- updated_at on every write
create or replace function bu1wp.touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- role of the signed-in e-mail in one department (public.user_roles: id = e-mail in lower case, data.level)
create or replace function bu1wp.my_level(p_dept text) returns text
language sql stable security definer set search_path = public, core as $$
  select r.data->>'level' from public.user_roles r
  where r.id = lower(core.current_email()) and r.dept_id = p_dept
  limit 1
$$;
revoke all on function bu1wp.my_level(text) from public;
grant execute on function bu1wp.my_level(text) to authenticated;

do $$
declare
  t text; ins text[]; upd text[]; del text[];
  -- table | levels that may insert | update | delete
  spec text[][] := array[
    ['tasks',      'admin,engineer', 'admin,engineer,ga', 'admin'],
    ['projects',   'admin,engineer', 'admin,engineer',    'admin,engineer'],
    ['photos',     'admin,engineer', 'admin,engineer',    'admin,engineer'],
    ['filechunks', 'admin,engineer', 'admin,engineer',    'admin,engineer'],
    ['ncr',        'admin,engineer', 'admin,engineer',    'admin'],
    ['staff',     'admin',          'admin',             'admin'],
    ['resources',  'admin',          'admin',             'admin'],
    ['config',     'admin',          'admin',             'admin']
  ];
  i int;
  rd constant text := 'dept_id in (select core.my_depts())';
begin
  for i in 1 .. array_length(spec, 1) loop
    t := spec[i][1]; ins := string_to_array(spec[i][2], ','); upd := string_to_array(spec[i][3], ','); del := string_to_array(spec[i][4], ',');
    execute format($f$
      create table if not exists bu1wp.%1$I (
        id          text        not null,
        dept_id     text        not null,
        data        jsonb       not null default '{}'::jsonb,
        updated_at  timestamptz not null default now(),
        updated_by  text,                       -- e-mail (lower case) of the last writer, set by the app
        primary key (id, dept_id)
      )$f$, t);
    execute format('alter table bu1wp.%I enable row level security', t);
    execute format('grant select, insert, update, delete on bu1wp.%I to authenticated', t);

    execute format('drop policy if exists "dept read"   on bu1wp.%I', t);
    execute format('drop policy if exists "dept insert" on bu1wp.%I', t);
    execute format('drop policy if exists "dept update" on bu1wp.%I', t);
    execute format('drop policy if exists "dept delete" on bu1wp.%I', t);
    execute format('create policy "dept read" on bu1wp.%I for select to authenticated using (%s)', t, rd);
    execute format('create policy "dept insert" on bu1wp.%I for insert to authenticated with check (%s and bu1wp.my_level(dept_id) = any (%L::text[]))', t, rd, ins);
    execute format('create policy "dept update" on bu1wp.%I for update to authenticated using (%s and bu1wp.my_level(dept_id) = any (%L::text[])) with check (%s and bu1wp.my_level(dept_id) = any (%L::text[]))', t, rd, upd, rd, upd);
    execute format('create policy "dept delete" on bu1wp.%I for delete to authenticated using (%s and bu1wp.my_level(dept_id) = any (%L::text[]))', t, rd, del);

    execute format('drop trigger if exists touch on bu1wp.%I', t);
    execute format('create trigger touch before insert or update on bu1wp.%I for each row execute function bu1wp.touch()', t);
  end loop;
end $$ language plpgsql;

-- indexes for the queries the app makes (week / month by date, attachment chunks by file)
create index if not exists tasks_dept_date  on bu1wp.tasks ((dept_id), (data->>'date'));
create index if not exists tasks_plan_no    on bu1wp.tasks ((dept_id), (data->>'planNo'));
create index if not exists chunks_file      on bu1wp.filechunks ((dept_id), (data->>'fileId'));
create index if not exists ncr_task         on bu1wp.ncr ((dept_id), (data->>'taskId'));

-- realtime (team sees changes live). DELETE payloads carry the primary key, which includes dept_id,
-- so the app filters dept_id on the client and no replica identity change is needed.
-- One table per statement, so a table that is already in the publication does not stop the others.
do $$ declare t text; begin
  foreach t in array array['tasks','staff','resources','projects','config','ncr'] loop
    begin execute format('alter publication supabase_realtime add table bu1wp.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- people and roles of BU1 are rows in public.user_roles: id = e-mail (lower case), dept_id = 'BU1',
-- data = {"id": e-mail, "email": e-mail, "level": admin|engineer|sale|ga|viewer, "name": optional}.
-- An admin can manage them in the app (จัดการข้อมูล › ผู้ใช้งานระบบ) if public.user_roles RLS allows dept admins to write.
