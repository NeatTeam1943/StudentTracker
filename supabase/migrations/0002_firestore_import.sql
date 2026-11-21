-- =============================================================================
-- Trainings: one-time (re-runnable) import from StudentTracker's Firestore.
--
-- NeatSystem's scripts/import-firebase.mjs reads Firestore on a mentor's
-- machine and writes firebase-import/1-trainings.sql = one call to
-- trainings.import_firestore('<json>'), run in the Supabase SQL editor.
-- Nothing is lost:
--   * each StudentTracker person is matched to a NeatSystem member by name
--     (or nickname), then by phone — only when exactly one member fits;
--   * whoever doesn't match yet (hasn't joined NeatSystem) becomes a "legacy"
--     person holding the records; trainings.link_legacy() hands them over later.
-- Re-running is safe: certifications / favorites / ranks are upserted and
-- events carry their Firestore id (source_key), so nothing is duplicated.
-- Run after 0001_trainings.sql.
-- =============================================================================

create table if not exists trainings.legacy_people (
  id          uuid primary key,                -- md5('fs:' || fs_id)::uuid, stable across re-runs
  fs_id       text not null unique,
  name        text not null,
  claimed_by  uuid,
  claimed_at  timestamptz,
  imported_at timestamptz not null default now()
);
alter table trainings.legacy_people enable row level security;

alter table trainings.events add column if not exists by_name text;      -- who did it, as Firestore recorded it
alter table trainings.events add column if not exists source_key text;   -- 'fs:<event id>' for imported events
create unique index if not exists events_source_idx on trainings.events (source_key);

-- Until linked, a legacy person is a regular active member of the categories they
-- were in (an 'extra' membership): they show in the team, can be certified and
-- climb ranks. Their grade is unknown, so it doesn't block a rank (counts as יב').
create or replace function trainings.person(p_uid uuid)
returns table (id uuid, full_name text, team text, pos text, is_admin boolean, status text, grad_year int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.team, p.position::text, p.is_admin, p.status::text, p.grad_year from hub.people p where p.id = p_uid
  union all
  select l.id, l.name, null, 'legacy', false, 'active', null from trainings.legacy_people l where l.id = p_uid and l.claimed_by is null
$$;

create or replace function trainings.grade_of(p_pos text, p_grad int) returns int
language sql stable as $$
  select case when p_pos = 'mentor' then 99 when p_pos = 'legacy' then 12 when p_grad is null then 0 else
    greatest(0, 12 - (p_grad - (extract(year from now())::int + case when extract(month from now()) >= 9 then 1 else 0 end))) end
$$;

-- legacy people join every category they hold something in (unless paused there)
create or replace function trainings.legacy_memberships() returns void
language sql security definer set search_path = '' as $$
  insert into trainings.memberships (user_id, category, kind, active)
  select distinct l.id, x.category, 'extra', true
  from trainings.legacy_people l
  join (select c.user_id, i.category from trainings.certs c join trainings.items i on i.id = c.item
        union select r.user_id, r.category from trainings.rank_current r) x on x.user_id = l.id
  where l.claimed_by is null
  on conflict (user_id, category) do nothing
$$;

-- state(): + unclaimed legacy people, + by_name on events
create or replace function trainings_api.state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform trainings.require_active();
  return jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(to_jsonb(c) order by c.sort, c.name), '[]') from trainings.categories c),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'category', i.category, 'name', i.name, 'column', i.column_id, 'icon', i.icon,
                'desc', i.descr, 'groups', i.groups, 'sort', i.sort) order by i.category, i.sort, i.name), '[]') from trainings.items i),
    'certs', (select coalesce(jsonb_agg(jsonb_build_object('user', c.user_id, 'item', c.item, 'at', c.at, 'by', c.by, 'teach', c.teach, 'teachAt', c.teach_at, 'early', c.early)), '[]') from trainings.certs c),
    'memberships', (select coalesce(jsonb_agg(jsonb_build_object('user', m.user_id, 'category', m.category, 'kind', m.kind, 'active', m.active, 'joinedAt', m.joined_at)), '[]') from trainings.memberships m),
    'favorites', (select coalesce(jsonb_agg(jsonb_build_object('user', f.user_id, 'category', f.category, 'text', f.text)), '[]') from trainings.favorites f),
    'access', (select coalesce(jsonb_agg(jsonb_build_object('user', a.user_id, 'category', a.category)), '[]') from trainings.access a),
    'approvers', (select coalesce(jsonb_agg(jsonb_build_object('user', a.user_id, 'category', a.category)), '[]') from trainings.approvers a),
    'locks', (select coalesce(jsonb_agg(jsonb_build_object('user', l.user_id, 'category', l.category)), '[]') from trainings.locks l),
    'ranks', (select coalesce(jsonb_agg(to_jsonb(r) order by r.sort), '[]') from trainings.ranks r),
    'rules', (select coalesce(jsonb_agg(jsonb_build_object('category', r.category, 'rank', r.rank, 'items', to_jsonb(r.items), 'minGrade', r.min_grade)), '[]') from trainings.rank_rules r),
    'current', (select coalesce(jsonb_agg(jsonb_build_object('user', r.user_id, 'category', r.category, 'rank', r.rank, 'manual', r.manual)), '[]') from trainings.rank_current r),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'at', e.at, 'by', e.by, 'byName', e.by_name, 'type', e.type, 'user', e.user_id, 'category', e.category,
                'item', e.item, 'text', e.text, 'early', e.early) order by e.at desc, e.id desc), '[]')
               from (select * from trainings.events order by at desc, id desc limit 600) e),
    'legacy', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name), '[]') from trainings.legacy_people l where l.claimed_by is null),
    'perms', jsonb_build_object('certifyAll', hub.has_perm('trainings.certify_all'), 'editCatalog', hub.has_perm('trainings.edit_catalog'), 'manage', hub.has_perm('trainings.manage'))
  );
end $$;

-- a name as people type it: no quotes/geresh, single spaces, lower case
create or replace function trainings.norm_name(p text) returns text language sql immutable as $$
  select lower(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '["''״׳`]', '', 'g'), '\s+', ' ', 'g')))
$$;

-- The import. Internal (SQL editor / migration owner only). p = the JSON the script builds:
--   categories: [{id, name, kind, team, sort, item_noun, item_noun_singular, favorite_label, columns}]
--   items:      [{category, name, column, sort}]
--   rules:      [{category, rank, items: [item names], min_grade}]
--   people:     [{fs_id, name, phone}]
--   certs:      [{fs_id, category, item, at, by_name, teach, teach_at}]
--   current:    [{fs_id, category, rank, manual}]
--   favorites:  [{fs_id, category, text}]
--   paused:     [{fs_id, category}]
--   events:     [{key, fs_id, category, type, item, rank, text, at, by_name}]
--   locked_leads: [{name}]
-- Returns counts plus the names that didn't match anyone (they are kept as legacy people).
create or replace function trainings.import_firestore(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_out jsonb := '{}'::jsonb;
  n int;
begin
  -- who is who
  create temp table if not exists imp_people (fs_id text primary key, uid uuid not null, matched text) on commit drop;
  delete from imp_people;
  insert into imp_people (fs_id, uid, matched)
  select x.fs_id,
    coalesce(
      (select l.claimed_by from trainings.legacy_people l where l.fs_id = x.fs_id and l.claimed_by is not null),
      (select min(hp.id::text)::uuid from hub.profiles hp where hp.status in ('active', 'archived')
         and (trainings.norm_name(hp.full_name) = trainings.norm_name(x.name) or trainings.norm_name(hp.nickname) = trainings.norm_name(x.name))
       having count(*) = 1),
      (select min(hp.id::text)::uuid from hub.profiles hp where hp.status in ('active', 'archived')
         and length(regexp_replace(coalesce(x.phone, ''), '\D', '', 'g')) >= 9
         and right(regexp_replace(coalesce(hp.phone, ''), '\D', '', 'g'), 9) = right(regexp_replace(x.phone, '\D', '', 'g'), 9)
       having count(*) = 1),
      md5('fs:' || x.fs_id)::uuid),
    null
  from jsonb_to_recordset(coalesce(p -> 'people', '[]')) as x(fs_id text, name text, phone text)
  on conflict do nothing;
  update imp_people set matched = 'yes' where exists (select 1 from hub.profiles hp where hp.id = imp_people.uid);
  -- the rest keep their records under a legacy person until linked
  insert into trainings.legacy_people (id, fs_id, name)
  select ip.uid, ip.fs_id, x.name from imp_people ip
  join jsonb_to_recordset(coalesce(p -> 'people', '[]')) as x(fs_id text, name text, phone text) on x.fs_id = ip.fs_id
  where ip.matched is null
  on conflict (fs_id) do update set name = excluded.name;
  v_out := v_out || jsonb_build_object(
    'matched', (select count(*) from imp_people where matched = 'yes'),
    'not_matched', (select coalesce(jsonb_agg(l.name order by l.name), '[]') from imp_people ip join trainings.legacy_people l on l.id = ip.uid where ip.matched is null));

  -- catalog
  insert into trainings.categories (id, name, kind, team, sort, item_noun, item_noun_singular, favorite_label, columns)
  select x.id, x.name, x.kind, case when x.kind = 'team' then x.team end, coalesce(x.sort, 50), coalesce(x.item_noun, 'הכשרות'),
         coalesce(x.item_noun_singular, 'הכשרה'), coalesce(x.favorite_label, 'דבר אהוב'), x.columns
  from jsonb_to_recordset(coalesce(p -> 'categories', '[]')) as x(id text, name text, kind text, team text, sort int, item_noun text, item_noun_singular text, favorite_label text, columns jsonb)
  where not exists (select 1 from trainings.categories c where c.kind = 'team' and c.team = x.team and c.id <> x.id and x.kind = 'team')
  on conflict (id) do update set name = excluded.name, item_noun = excluded.item_noun, item_noun_singular = excluded.item_noun_singular,
    favorite_label = excluded.favorite_label, columns = excluded.columns, sort = excluded.sort;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('categories', n);

  insert into trainings.items (id, category, name, column_id, sort)
  select trainings.item_id(x.category, x.name), x.category, x.name, x."column", coalesce(x.sort, 0)
  from jsonb_to_recordset(coalesce(p -> 'items', '[]')) as x(category text, name text, "column" text, sort int)
  where exists (select 1 from trainings.categories c where c.id = x.category) and char_length(btrim(x.name)) between 1 and 60
  on conflict (id) do update set column_id = excluded.column_id, sort = excluded.sort;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('items', n);

  insert into trainings.rank_rules (category, rank, items, min_grade)
  select x.category, x.rank, array(select trainings.item_id(x.category, nm) from jsonb_array_elements_text(x.items) nm
                                   where exists (select 1 from trainings.items i where i.id = trainings.item_id(x.category, nm))), x.min_grade
  from jsonb_to_recordset(coalesce(p -> 'rules', '[]')) as x(category text, rank text, items jsonb, min_grade int)
  where exists (select 1 from trainings.categories c where c.id = x.category) and exists (select 1 from trainings.ranks r where r.id = x.rank)
  on conflict (category, rank) do update set items = excluded.items, min_grade = excluded.min_grade;

  -- records
  insert into trainings.certs (user_id, item, at, teach, teach_at)
  select ip.uid, trainings.item_id(x.category, x.item), coalesce(x."at", now()), coalesce(x.teach, false), x.teach_at
  from jsonb_to_recordset(coalesce(p -> 'certs', '[]')) as x(fs_id text, category text, item text, "at" timestamptz, by_name text, teach boolean, teach_at timestamptz)
  join imp_people ip on ip.fs_id = x.fs_id
  where exists (select 1 from trainings.items i where i.id = trainings.item_id(x.category, x.item))
  on conflict (user_id, item) do update set teach = excluded.teach or trainings.certs.teach;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('certs', n);

  insert into trainings.rank_current (user_id, category, rank, manual)
  select ip.uid, x.category, x.rank, coalesce(x.manual, false)
  from jsonb_to_recordset(coalesce(p -> 'current', '[]')) as x(fs_id text, category text, rank text, manual boolean)
  join imp_people ip on ip.fs_id = x.fs_id
  where exists (select 1 from trainings.categories c where c.id = x.category) and (x.rank is null or exists (select 1 from trainings.ranks r where r.id = x.rank))
  on conflict (user_id, category) do update set rank = excluded.rank, manual = excluded.manual;

  insert into trainings.favorites (user_id, category, text)
  select ip.uid, x.category, left(x.text, 40)
  from jsonb_to_recordset(coalesce(p -> 'favorites', '[]')) as x(fs_id text, category text, text text)
  join imp_people ip on ip.fs_id = x.fs_id
  where nullif(btrim(x.text), '') is not null and exists (select 1 from trainings.categories c where c.id = x.category)
  on conflict (user_id, category) do update set text = excluded.text;

  insert into trainings.memberships (user_id, category, kind, active)
  select ip.uid, x.category, 'paused', false
  from jsonb_to_recordset(coalesce(p -> 'paused', '[]')) as x(fs_id text, category text)
  join imp_people ip on ip.fs_id = x.fs_id
  where exists (select 1 from trainings.categories c where c.id = x.category)
  on conflict do nothing;

  insert into trainings.events (at, type, user_id, category, item, text, by_name, source_key)
  select coalesce(x."at", now()), x.type, ip.uid, x.category,
         case when x.rank is not null then x.rank when x.item is not null then trainings.item_id(x.category, x.item) end,
         left(x.text, 1000), x.by_name, 'fs:' || x.key
  from jsonb_to_recordset(coalesce(p -> 'events', '[]')) as x(key text, fs_id text, category text, type text, item text, rank text, text text, "at" timestamptz, by_name text)
  left join imp_people ip on ip.fs_id = x.fs_id
  where x.key is not null
  on conflict (source_key) do nothing;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('events', n);

  insert into trainings.locks (category, user_id)
  select c.id, hp.id
  from jsonb_to_recordset(coalesce(p -> 'locked_leads', '[]')) as x(name text)
  join hub.profiles hp on trainings.norm_name(hp.full_name) = trainings.norm_name(x.name) and hp.position = 'team_lead'
  join trainings.categories c on c.kind = 'team' and c.team = hp.team
  on conflict do nothing;

  -- legacy people: members where StudentTracker had them (also with no records yet)
  insert into trainings.memberships (user_id, category, kind, active)
  select ip.uid, x.category, 'extra', true
  from jsonb_to_recordset(coalesce(p -> 'member_of', '[]')) as x(fs_id text, category text)
  join imp_people ip on ip.fs_id = x.fs_id and ip.matched is null
  where exists (select 1 from trainings.categories c where c.id = x.category)
  on conflict (user_id, category) do nothing;
  perform trainings.legacy_memberships();

  insert into trainings.events (type, text) values ('imported_firestore', left((v_out - 'not_matched')::text, 1000));
  return v_out;
end $$;

-- Someone from StudentTracker joined NeatSystem: their records become theirs.
-- In the SQL editor:  select trainings.link_legacy('השם כמו ב-StudentTracker', 'their.neatsystem@gmail.com');
create or replace function trainings.link_legacy(p_name text, p_email text) returns text
language plpgsql set search_path = '' as $$
declare
  l trainings.legacy_people;
  p_legacy uuid;
  p_user uuid;
begin
  select * into l from trainings.legacy_people where claimed_by is null and trainings.norm_name(name) = trainings.norm_name(p_name);
  if l.id is null then raise exception 'אין חבר/ה מ-StudentTracker שעוד לא שויך/ה בשם %', p_name; end if;
  select id into p_user from hub.profiles where lower(email) = lower(btrim(p_email));
  if p_user is null then raise exception 'אין משתמש ב-NeatSystem עם המייל %', p_email; end if;
  p_legacy := l.id;

  insert into trainings.certs (user_id, item, at, by, teach, teach_at, early)
  select p_user, item, at, by, teach, teach_at, early from trainings.certs where user_id = p_legacy on conflict do nothing;
  delete from trainings.certs where user_id = p_legacy;
  insert into trainings.memberships (user_id, category, kind, active, joined_at)
  select p_user, category, kind, active, joined_at from trainings.memberships where user_id = p_legacy on conflict do nothing;
  delete from trainings.memberships where user_id = p_legacy;
  insert into trainings.favorites (user_id, category, text)
  select p_user, category, text from trainings.favorites where user_id = p_legacy on conflict do nothing;
  delete from trainings.favorites where user_id = p_legacy;
  insert into trainings.rank_current (user_id, category, rank, manual)
  select p_user, category, rank, manual from trainings.rank_current where user_id = p_legacy on conflict do nothing;
  delete from trainings.rank_current where user_id = p_legacy;
  update trainings.events set user_id = p_user where user_id = p_legacy;
  update trainings.legacy_people set claimed_by = p_user, claimed_at = now() where id = p_legacy;
  insert into trainings.events (type, user_id, text) values ('legacy_linked', p_user, l.name);
  return l.name || ' שויך/ה';
end $$;

-- for data imported before this existed
select trainings.legacy_memberships();

revoke all on all tables in schema trainings from public, anon, authenticated;
revoke all on all functions in schema trainings from public, anon, authenticated;   -- import_firestore / link_legacy: SQL editor only
revoke all on all functions in schema trainings_api from public, anon;
grant execute on all functions in schema trainings_api to authenticated;
