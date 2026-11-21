-- =============================================================================
-- Trainings (StudentTracker, "רישיון בנאי") — a NeatSystem sub-system.
--
-- Lives in NeatSystem's Supabase project, next to NeatSystem's `hub` schema:
--   trainings      tables. Private: no client and no other system reads them.
--   trainings_api  the contract: functions only (state, actions, profile_v1).
-- People, login, teams and positions are NeatSystem's (hub). This system never
-- writes hub; it reads people only through hub.people / hub.has_perm /
-- hub.is_active, inside its functions. Run after NeatSystem's migrations.
-- Re-runnable.
--
-- Supabase dashboard: add `trainings_api` to Settings -> API -> Exposed schemas.
-- =============================================================================

create schema if not exists trainings;
create schema if not exists trainings_api;
revoke all on schema trainings from public, anon, authenticated;
grant usage on schema trainings_api to authenticated;

-- -----------------------------------------------------------------------------
-- Catalog: categories (a team's trainings, or a special certification like CNC),
-- their columns, their items. Ranks are global; what a rank needs is per category.
-- -----------------------------------------------------------------------------
create table if not exists trainings.categories (
  id                 text primary key check (id ~ '^[a-z][a-z0-9_]{0,40}$'),
  name               text not null check (char_length(btrim(name)) between 1 and 40),
  kind               text not null check (kind in ('team', 'special')),
  team               text,                     -- hub.teams.id for kind = team
  icon               text not null default 'award',
  sort               int  not null default 50,
  item_noun          text not null default 'הכשרות',
  item_noun_singular text not null default 'הכשרה',
  favorite_label     text not null default 'דבר אהוב',
  columns            jsonb not null default '[]'::jsonb,  -- [{id, he, label, header}]
  created_at         timestamptz not null default now(),
  constraint team_has_team check (kind <> 'team' or team is not null)
);
create unique index if not exists categories_team_idx on trainings.categories (team) where kind = 'team';

create table if not exists trainings.items (
  id        text primary key,
  category  text not null references trainings.categories (id) on delete cascade,
  name      text not null check (char_length(btrim(name)) between 1 and 60),
  column_id text not null,
  icon      text,
  descr     text not null default '' check (char_length(descr) <= 2000),
  -- prerequisites: [{ "mode": "all" | "at_least", "n": 1, "ids": [item ids] }]
  groups    jsonb not null default '[]'::jsonb,
  sort      int  not null default 0,
  created_at timestamptz not null default now(),
  unique (category, name)
);
create index if not exists items_category_idx on trainings.items (category);

-- stable id for an item from its category + original name (the import uses it too)
create or replace function trainings.item_id(p_cat text, p_name text) returns text
language sql immutable as $$ select 'i_' || substr(md5(p_cat || '|' || p_name), 1, 12) $$;

-- who may see / join a special category; who certifies; whose editing is locked
create table if not exists trainings.access    (category text references trainings.categories (id) on delete cascade, user_id uuid, primary key (category, user_id));
create table if not exists trainings.approvers (category text references trainings.categories (id) on delete cascade, user_id uuid, primary key (category, user_id));
create table if not exists trainings.locks     (category text references trainings.categories (id) on delete cascade, user_id uuid, primary key (category, user_id));

-- -----------------------------------------------------------------------------
-- People's records. user_id = hub.profiles.id (no FK across systems on purpose:
-- NeatSystem archives, never deletes, so records always keep their owner).
-- -----------------------------------------------------------------------------
create table if not exists trainings.certs (
  user_id  uuid not null,
  item     text not null references trainings.items (id) on delete cascade,
  at       timestamptz not null default now(),
  by       uuid,
  teach    boolean not null default false,
  teach_at timestamptz,
  early    boolean not null default false,   -- certified before meeting the prerequisites
  primary key (user_id, item)
);
-- the team category is implicit (from hub team); rows here are the exceptions
create table if not exists trainings.memberships (
  user_id   uuid not null,
  category  text not null references trainings.categories (id) on delete cascade,
  kind      text not null check (kind in ('extra', 'paused')),
  active    boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (user_id, category)
);
create table if not exists trainings.favorites (
  user_id uuid not null, category text not null references trainings.categories (id) on delete cascade,
  text text not null check (char_length(text) <= 40), primary key (user_id, category)
);
-- append-only history + mentors' notes
create table if not exists trainings.events (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  by       uuid,
  type     text not null,
  user_id  uuid,
  category text,
  item     text,
  text     text check (text is null or char_length(text) <= 1000),
  early    boolean not null default false
);
create index if not exists events_user_idx on trainings.events (user_id, at desc);
create index if not exists events_cat_idx on trainings.events (category, at desc);

-- -----------------------------------------------------------------------------
-- Ranks (the eight badges) and each category's ladder.
-- -----------------------------------------------------------------------------
create table if not exists trainings.ranks (
  id text primary key, name text not null, color text not null, min_grade int, sort int not null, badge text not null, wordmark text not null
);
create table if not exists trainings.rank_rules (
  category  text not null references trainings.categories (id) on delete cascade,
  rank      text not null references trainings.ranks (id) on delete cascade,
  items     text[] not null default '{}',
  min_grade int,                          -- null = no grade gate
  primary key (category, rank)
);
create table if not exists trainings.rank_current (
  user_id  uuid not null,
  category text not null references trainings.categories (id) on delete cascade,
  rank     text references trainings.ranks (id),
  manual   boolean not null default false,
  primary key (user_id, category)
);

alter table trainings.categories enable row level security;
alter table trainings.items enable row level security;
alter table trainings.access enable row level security;
alter table trainings.approvers enable row level security;
alter table trainings.locks enable row level security;
alter table trainings.certs enable row level security;
alter table trainings.memberships enable row level security;
alter table trainings.favorites enable row level security;
alter table trainings.events enable row level security;
alter table trainings.ranks enable row level security;
alter table trainings.rank_rules enable row level security;
alter table trainings.rank_current enable row level security;

-- -----------------------------------------------------------------------------
-- Seed: the eight ranks, and the בנייה catalog from the original deck.
-- Other teams' catalogs come from the Firestore import (scripts/).
-- -----------------------------------------------------------------------------
insert into trainings.ranks (id, name, color, min_grade, sort, badge, wordmark) values
  ('nit',       'ניט',      '#8C5A3C', null, 0, 'bronze-shield', 'nit'),
  ('niter',     'ניטר',     '#8E949C', null, 1, 'silver-shield', 'niter'),
  ('nitolog',   'ניטולוג',  '#C9A200', null, 2, 'gold-gear',     'nitolog'),
  ('nitpro',    'ניטפרו',   '#2D7FC1', null, 3, 'steel-gear',    'nitpro'),
  ('nitprime',  'ניטפריים', '#00A88E', 10,   4, 'frost',         'nitprime'),
  ('nitelite',  'ניטאליט',  '#A05BE0', 11,   5, 'arcane',        'nitelite'),
  ('nitmaster', 'ניטמאסטר', '#E2445C', 12,   6, 'flame',         'nitmaster'),
  ('nitmentor', 'ניטמנטור', '#6B7280', 99,   7, 'mentor',        'nitmentor')
on conflict (id) do update set name = excluded.name, color = excluded.color, sort = excluded.sort, badge = excluded.badge, wordmark = excluded.wordmark;

insert into trainings.categories (id, name, kind, team, icon, sort, item_noun, item_noun_singular, favorite_label, columns) values
  ('build', 'בנייה', 'team', 'build', 'hammer', 2, 'כלים', 'כלי', 'כלי אהוב', '[
    {"id":"basic_training","he":"הכשרה בסיסית","label":"BASIC TRAINING","header":"#747474"},
    {"id":"basic_tools","he":"כלים בסיסיים","label":"BASIC TOOLS","header":"#002060"},
    {"id":"power_tools","he":"כלי כוח","label":"POWER TOOLS","header":"#12501B"},
    {"id":"bench_tools","he":"כלי שולחן","label":"BENCH TOOLS","header":"#7F340D"},
    {"id":"heavy_machinery","he":"מכונות כבדות","label":"HEAVY MACHINERY","header":"#5E0202"}]'),
  ('cad', 'שרטוט', 'team', 'cad', 'pencil-ruler', 1, 'הכשרות', 'הכשרה', 'פיצ׳ר אהוב', '[{"id":"s0","he":"שלב א׳","label":"שלב א׳","header":"#6D6D6D"}]'),
  ('software', 'תוכנה', 'team', 'software', 'code', 3, 'הכשרות', 'הכשרה', 'שפה אהובה', '[{"id":"s0","he":"שלב א׳","label":"שלב א׳","header":"#04255A"}]')
on conflict (id) do nothing;

insert into trainings.items (id, category, name, column_id, sort)
select trainings.item_id('build', x.name), 'build', x.name, c.col, c.k * 100 + x.n
from (values
  (1, 'basic_training', array['ברגים','אומים','חומרים','לקיחת מידות','מקדחים','זוויות','מפתחות','ניטים','מנועים','תמסורות']),
  (2, 'basic_tools',    array['מקדחה','מברגה','ניטר פנאומטי','מסור ידני','שופין','שואב אבק','ניטר']),
  (3, 'power_tools',    array['ג''יגסו','דיסק ידני','דרמל (שיוף)','דרמל (חיתוך)','מולטי-טול','משייף חשמלי']),
  (4, 'bench_tools',    array['מסור שולחן','רצועת שיוף','מקדחת עמוד','דיסק שולחן','גריינדר']),
  (5, 'heavy_machinery',array['מסור סרט','ZK','מחרטה'])
) as c(k, col, names), unnest(c.names) with ordinality as x(name, n)
on conflict (id) do nothing;

insert into trainings.rank_rules (category, rank, items, min_grade)
select 'build', r.rank, array(select trainings.item_id('build', n) from unnest(r.names) n), r.min_grade
from (values
  ('nit',       array['ברגים','אומים','חומרים','לקיחת מידות','מקדחים','זוויות','מפתחות','ניטים'], null::int),
  ('niter',     array['מקדחה','מברגה','מסור ידני','שופין','ניטר','שואב אבק','רצועת שיוף','מנועים','תמסורות'], null),
  ('nitolog',   array['מקדחת עמוד','משייף חשמלי','ניטר פנאומטי','דיסק ידני','ג''יגסו','מסור שולחן'], null),
  ('nitpro',    array['דרמל (שיוף)','דרמל (חיתוך)','מולטי-טול','מסור סרט','גריינדר'], null),
  ('nitprime',  array['דיסק שולחן'], 10),
  ('nitelite',  array['ZK'], 11),
  ('nitmaster', array[]::text[], 12),
  ('nitmentor', array[]::text[], 99)
) as r(rank, names, min_grade)
on conflict (category, rank) do nothing;

-- -----------------------------------------------------------------------------
-- Permissions (added to NeatSystem's table; mentors change them in its matrix)
-- -----------------------------------------------------------------------------
select hub.register_permissions('trainings', '[
  {"key": "trainings.certify_all",  "label": "הסמכה בכל קטגוריות ההכשרות", "grp": "הכשרות", "sort": 1, "roles": ["captain", "mentor", "admin"]},
  {"key": "trainings.edit_catalog", "label": "עריכת פריטים, עמודות וסולמות בכל הקטגוריות", "grp": "הכשרות", "sort": 2, "roles": ["captain", "mentor", "admin"]},
  {"key": "trainings.manage",       "label": "ניהול הכשרות: מאשרים, נעילת רש\"צים, הסמכות מיוחדות, ניקוי יומן", "grp": "הכשרות", "sort": 3, "roles": ["mentor"]}
]'::jsonb);
select hub.register_subsystem('trainings', 'הכשרות', 'trainings_api', 'profile_v1', 20);

-- -----------------------------------------------------------------------------
-- Internal helpers
-- -----------------------------------------------------------------------------
-- A person as the caller may see them (NeatSystem's view decides what's visible).
create or replace function trainings.person(p_uid uuid)
returns table (id uuid, full_name text, team text, pos text, is_admin boolean, status text, grad_year int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.team, p.position::text, p.is_admin, p.status::text, p.grad_year from hub.people p where p.id = p_uid
$$;

-- Israeli school grade (7..12) from graduation year; mentors count as 99, graduates 13.
create or replace function trainings.grade_of(p_pos text, p_grad int) returns int
language sql stable as $$
  select case when p_pos = 'mentor' then 99 when p_grad is null then 0 else
    greatest(0, 12 - (p_grad - (extract(year from now())::int + case when extract(month from now()) >= 9 then 1 else 0 end))) end
$$;

-- (kind, active) of a person in a category, or no row. Mentors are not members.
create or replace function trainings.membership(p_uid uuid, p_cat text)
returns table (kind text, active boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  c trainings.categories;
  p record;
  m trainings.memberships;
begin
  select * into c from trainings.categories where id = p_cat;
  select * into p from trainings.person(p_uid);
  if c.id is null or p.id is null or p.pos = 'mentor' then return; end if;
  select * into m from trainings.memberships where user_id = p_uid and category = p_cat;
  if m.kind = 'paused' or (m.kind is not null and not m.active) then
    kind := m.kind; active := false; return next; return;
  end if;
  if c.kind = 'team' and p.team = c.team then kind := 'team'; active := p.status = 'active'; return next; return; end if;
  if c.kind = 'special' and exists (select 1 from trainings.access a where a.category = p_cat and a.user_id = p_uid) then
    kind := 'special'; active := p.status = 'active'; return next; return;
  end if;
  if m.kind = 'extra' then kind := 'extra'; active := p.status = 'active'; return next; return; end if;
  -- left the team (or the access list) but holds certifications here: record kept, rank frozen
  if exists (select 1 from trainings.certs ce join trainings.items i on i.id = ce.item where ce.user_id = p_uid and i.category = p_cat) then
    kind := 'former'; active := false; return next;
  end if;
end $$;

create or replace function trainings.is_member(p_uid uuid, p_cat text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select m.active from trainings.membership(p_uid, p_cat) m), false)
$$;

create or replace function trainings.is_approver(p_uid uuid, p_cat text) returns boolean
language sql stable security definer set search_path = '' as $$
  select hub.has_perm('trainings.certify_all', p_uid)
    or exists (select 1 from trainings.approvers a where a.category = p_cat and a.user_id = p_uid and hub.is_active(p_uid))
    or exists (select 1 from trainings.categories c join hub.people p on p.id = p_uid
               where c.id = p_cat and c.kind = 'team' and p.position = 'team_lead' and p.team = c.team and p.status = 'active')
$$;

create or replace function trainings.can_grant(p_uid uuid, p_cat text) returns boolean
language sql stable security definer set search_path = '' as $$
  select trainings.is_approver(p_uid, p_cat)
     and not exists (select 1 from trainings.locks l where l.category = p_cat and l.user_id = p_uid)
$$;

create or replace function trainings.can_edit_catalog(p_uid uuid, p_cat text) returns boolean
language sql stable security definer set search_path = '' as $$
  select hub.has_perm('trainings.edit_catalog', p_uid)
    or (exists (select 1 from trainings.categories c join hub.people p on p.id = p_uid
                where c.id = p_cat and c.kind = 'team' and p.position = 'team_lead' and p.team = c.team and p.status = 'active')
        and not exists (select 1 from trainings.locks l where l.category = p_cat and l.user_id = p_uid))
$$;

create or replace function trainings.deny(p_msg text default 'אין לך הרשאה לפעולה הזו') returns void
language plpgsql as $$ begin raise exception '%', p_msg using errcode = '42501'; end $$;

create or replace function trainings.require_active() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not hub.is_active() then raise exception 'צריך להיות חבר/ה פעיל/ה' using errcode = '42501'; end if;
end $$;

create or replace function trainings.log(p_type text, p_user uuid, p_cat text, p_item text default null, p_text text default null, p_early boolean default false)
returns void language sql security definer set search_path = '' as $$
  insert into trainings.events (by, type, user_id, category, item, text, early) values (auth.uid(), p_type, p_user, p_cat, p_item, p_text, p_early)
$$;

-- prerequisites met? (every group satisfied by what the person holds)
create or replace function trainings.prereqs_met(p_uid uuid, p_item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(bool_and(g.ok), true) from (
    select case
      when cardinality(ids) = 0 then true
      when grp ->> 'mode' = 'all' then held = cardinality(ids)
      else held >= least(coalesce((grp ->> 'n')::int, 1), cardinality(ids)) end as ok
    from trainings.items i,
      lateral jsonb_array_elements(i.groups) grp,
      lateral (select array(select x from jsonb_array_elements_text(grp -> 'ids') x where exists (select 1 from trainings.items i2 where i2.id = x)) as ids) a,
      lateral (select count(*) as held from trainings.certs c where c.user_id = p_uid and c.item = any(a.ids)) h
    where i.id = p_item
  ) g
$$;

-- Highest rank earned in a category: walk the ladder, stop at the first gap.
create or replace function trainings.earned_rank(p_uid uuid, p_cat text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  r record;
  p record;
  v_earned text;
  v_need text[] := '{}';
  v_grade int;
begin
  select * into p from trainings.person(p_uid);
  if p.id is null then return null; end if;
  v_grade := trainings.grade_of(p.pos, p.grad_year);
  for r in select k.id, rr.items, rr.min_grade from trainings.ranks k left join trainings.rank_rules rr on rr.rank = k.id and rr.category = p_cat order by k.sort loop
    if coalesce(cardinality(r.items), 0) = 0 and r.min_grade is null then exit; end if;   -- not configured
    v_need := v_need || array(select x from unnest(coalesce(r.items, '{}')) x where exists (select 1 from trainings.items i where i.id = x));
    if exists (select 1 from unnest(v_need) x where not exists (select 1 from trainings.certs c where c.user_id = p_uid and c.item = x)) then exit; end if;
    if r.min_grade is not null and v_grade < r.min_grade then exit; end if;
    v_earned := r.id;
  end loop;
  return v_earned;
end $$;

-- Keep an automatic rank in step with the certifications. A manual rank stays.
create or replace function trainings.sync_rank(p_uid uuid, p_cat text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  cur trainings.rank_current;
  v_new text;
begin
  select * into cur from trainings.rank_current where user_id = p_uid and category = p_cat;
  if cur.manual then return; end if;
  if not trainings.is_member(p_uid, p_cat) then return; end if;  -- inactive: rank frozen
  v_new := trainings.earned_rank(p_uid, p_cat);
  if v_new is not distinct from cur.rank and cur.user_id is not null then return; end if;
  insert into trainings.rank_current (user_id, category, rank, manual) values (p_uid, p_cat, v_new, false)
  on conflict (user_id, category) do update set rank = excluded.rank;
  if v_new is distinct from cur.rank then
    perform trainings.log('rank_auto', p_uid, p_cat, v_new, cur.rank);
  end if;
end $$;

create or replace function trainings.sync_category(p_cat text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  for u in select distinct ce.user_id from trainings.certs ce join trainings.items i on i.id = ce.item where i.category = p_cat
           union select rc.user_id from trainings.rank_current rc where rc.category = p_cat loop
    perform trainings.sync_rank(u, p_cat);
  end loop;
end $$;

create or replace function trainings.item_cat(p_item text) returns text
language sql stable security definer set search_path = '' as $$ select category from trainings.items where id = p_item $$;

create or replace function trainings.new_id(p_prefix text) returns text
language sql volatile as $$ select p_prefix || substr(md5(random()::text || clock_timestamp()::text), 1, 12) $$;

-- -----------------------------------------------------------------------------
-- trainings_api: reads
-- -----------------------------------------------------------------------------
-- Everything the tab needs in one call. Any active member sees the whole
-- picture (as StudentTracker always showed it); writes are checked one by one.
create or replace function trainings_api.state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
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
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'at', e.at, 'by', e.by, 'type', e.type, 'user', e.user_id, 'category', e.category,
                'item', e.item, 'text', e.text, 'early', e.early) order by e.at desc, e.id desc), '[]')
               from (select * from trainings.events order by at desc, id desc limit 600) e),
    'perms', jsonb_build_object('certifyAll', hub.has_perm('trainings.certify_all'), 'editCatalog', hub.has_perm('trainings.edit_catalog'), 'manage', hub.has_perm('trainings.manage'))
  );
end $$;

-- What NeatSystem shows on a profile (profile blocks, contract 1). STABLE:
-- NeatSystem calls it with GET (read-only) and when archiving someone.
create or replace function trainings_api.profile_v1(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p record;
  v_team text;
  v_rank record;
  v_next record;
  v_blocks jsonb := '[]'::jsonb;
  v_held int;
  v_teach int;
  v_need int;
  v_have int;
begin
  if not hub.is_active() then return jsonb_build_object('contract', 1, 'blocks', '[]'::jsonb); end if;
  select * into p from trainings.person(p_user);
  if p.id is null then return jsonb_build_object('contract', 1, 'blocks', '[]'::jsonb); end if;
  select count(*), count(*) filter (where teach) into v_held, v_teach from trainings.certs where user_id = p_user;
  select c.id into v_team from trainings.categories c where c.kind = 'team' and c.team = p.team;

  if p.pos = 'mentor' then
    select * into v_rank from trainings.ranks where id = 'nitmentor';
  elsif v_team is not null then
    select k.* into v_rank from trainings.rank_current rc join trainings.ranks k on k.id = rc.rank where rc.user_id = p_user and rc.category = v_team;
  end if;
  if v_held = 0 and v_rank.id is null then return jsonb_build_object('contract', 1, 'title', 'הכשרות', 'blocks', '[]'::jsonb); end if;

  v_blocks := v_blocks || jsonb_build_array(jsonb_build_object('kind', 'stats', 'items', jsonb_build_array(
    jsonb_build_object('label', 'דרגה', 'value', coalesce(v_rank.name, 'עוד אין')),
    jsonb_build_object('label', 'הסמכות', 'value', v_held),
    jsonb_build_object('label', 'מלמד/ת', 'value', v_teach))));

  -- next rank in the team category
  if v_team is not null and p.pos <> 'mentor' then
    select k.* into v_next from trainings.ranks k where k.sort > coalesce(v_rank.sort, -1) order by k.sort limit 1;
    if v_next.id is not null and exists (select 1 from trainings.rank_rules rr where rr.category = v_team and rr.rank = v_next.id and (cardinality(rr.items) > 0 or rr.min_grade is not null)) then
      select count(*), count(c.item) into v_need, v_have
      from trainings.rank_rules rr join trainings.ranks k on k.id = rr.rank, unnest(rr.items) x
      join trainings.items i on i.id = x
      left join trainings.certs c on c.user_id = p_user and c.item = x
      where rr.category = v_team and k.sort <= v_next.sort;
      if v_need > 0 then
        v_blocks := v_blocks || jsonb_build_array(jsonb_build_object('kind', 'progress', 'label', 'ל' || v_next.name, 'value', v_have, 'max', v_need,
          'hint', case when v_have = v_need then 'כל הפריטים הושלמו' else 'עוד ' || (v_need - v_have) || ' פריטים' end));
      end if;
    end if;
  end if;

  -- every category they have a record in, with its rank
  v_blocks := v_blocks || coalesce((
    select jsonb_build_array(jsonb_build_object('kind', 'chips', 'title', 'קטגוריות', 'items', jsonb_agg(jsonb_build_object(
      'label', c.name || coalesce(' · ' || k.name, ''), 'tone', case when trainings.is_member(p_user, c.id) then 'brand' else 'muted' end) order by c.sort)))
    from trainings.categories c
    left join trainings.rank_current rc on rc.user_id = p_user and rc.category = c.id
    left join trainings.ranks k on k.id = rc.rank
    where exists (select 1 from trainings.certs ce join trainings.items i on i.id = ce.item where ce.user_id = p_user and i.category = c.id)
       or trainings.is_member(p_user, c.id)
    having count(*) > 0), '[]'::jsonb);

  v_blocks := v_blocks || coalesce((
    select jsonb_build_array(jsonb_build_object('kind', 'list', 'title', 'הסמכות אחרונות', 'items', jsonb_agg(jsonb_build_object(
      'title', x.name, 'meta', x.cat || case when x.teach then ' · מלמד/ת' else '' end, 'at', x.at) order by x.at desc)))
    from (select i.name, c.name as cat, ce.teach, ce.at from trainings.certs ce join trainings.items i on i.id = ce.item
          join trainings.categories c on c.id = i.category where ce.user_id = p_user order by ce.at desc limit 5) x
    having count(*) > 0), '[]'::jsonb);

  return jsonb_build_object('contract', 1, 'title', 'הכשרות', 'link', '/trainings/p/' || p_user, 'blocks', v_blocks);
end $$;

-- -----------------------------------------------------------------------------
-- trainings_api: actions. Each one checks permissions, writes, and logs.
-- -----------------------------------------------------------------------------
-- A lead certifies someone — any item, even a locked one (= early unlock).
create or replace function trainings_api.grant(p_user uuid, p_item text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cat text := trainings.item_cat(p_item);
  v_early boolean;
begin
  perform trainings.require_active();
  if v_cat is null then raise exception 'הפריט לא קיים' using errcode = 'P0002'; end if;
  if not trainings.can_grant(auth.uid(), v_cat) then perform trainings.deny(); end if;
  if p_user = auth.uid() then perform trainings.deny('אי אפשר להסמיך את עצמך'); end if;
  if not trainings.is_member(p_user, v_cat) then raise exception 'לא חבר/ה פעיל/ה בקטגוריה הזו' using errcode = '22023'; end if;
  if exists (select 1 from trainings.certs where user_id = p_user and item = p_item) then return; end if;
  v_early := not trainings.prereqs_met(p_user, p_item);
  insert into trainings.certs (user_id, item, by, early) values (p_user, p_item, auth.uid(), v_early);
  perform trainings.log('granted', p_user, v_cat, p_item, null, v_early);
  perform trainings.sync_rank(p_user, v_cat);
end $$;

create or replace function trainings_api.revoke(p_user uuid, p_item text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cat text := trainings.item_cat(p_item);
begin
  perform trainings.require_active();
  if v_cat is null or not trainings.can_grant(auth.uid(), v_cat) then perform trainings.deny(); end if;
  delete from trainings.certs where user_id = p_user and item = p_item;
  if not found then return; end if;
  perform trainings.log('revoked', p_user, v_cat, p_item);
  perform trainings.sync_rank(p_user, v_cat);
end $$;

create or replace function trainings_api.set_teach(p_user uuid, p_item text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cat text := trainings.item_cat(p_item);
begin
  perform trainings.require_active();
  if v_cat is null or not trainings.can_grant(auth.uid(), v_cat) then perform trainings.deny(); end if;
  update trainings.certs set teach = p_on, teach_at = now() where user_id = p_user and item = p_item and teach <> p_on;
  if not found then
    if not exists (select 1 from trainings.certs where user_id = p_user and item = p_item) then
      raise exception 'קודם צריך להיות מוסמך/ת' using errcode = '22023';
    end if;
    return;
  end if;
  perform trainings.log(case when p_on then 'teach_granted' else 'teach_revoked' end, p_user, v_cat, p_item);
end $$;

create or replace function trainings_api.add_note(p_user uuid, p_cat text, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform trainings.require_active();
  if not trainings.can_grant(auth.uid(), p_cat) then perform trainings.deny(); end if;
  if nullif(btrim(p_text), '') is null then raise exception 'צריך טקסט' using errcode = '22023'; end if;
  perform trainings.log('note', p_user, p_cat, null, btrim(p_text));
end $$;

-- Mentor-only, and the clearing itself is logged right after.
create or replace function trainings_api.clear_log(p_user uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform trainings.require_active();
  if not hub.has_perm('trainings.manage') then perform trainings.deny('רק מנטור מנקה יומן'); end if;
  delete from trainings.events where user_id = p_user;
  get diagnostics n = row_count;
  perform trainings.log('log_cleared', p_user, null, null, n::text);
  return n;
end $$;

create or replace function trainings_api.set_favorite(p_user uuid, p_cat text, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform trainings.require_active();
  if p_user <> auth.uid() and not trainings.can_grant(auth.uid(), p_cat) then perform trainings.deny(); end if;
  if nullif(btrim(p_text), '') is null then delete from trainings.favorites where user_id = p_user and category = p_cat;
  else insert into trainings.favorites values (p_user, p_cat, left(btrim(p_text), 40)) on conflict (user_id, category) do update set text = excluded.text;
  end if;
end $$;

-- "צירוף בנוסף": someone works in another category too.
create or replace function trainings_api.join(p_user uuid, p_cat text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform trainings.require_active();
  if not trainings.can_grant(auth.uid(), p_cat) then perform trainings.deny(); end if;
  if not hub.is_active(p_user) then raise exception 'המשתמש לא פעיל' using errcode = '22023'; end if;
  if trainings.is_member(p_user, p_cat) then return; end if;
  if (select pos from trainings.person(p_user)) = 'mentor' then raise exception 'מנטורים לא חברים בקטגוריות' using errcode = '22023'; end if;
  insert into trainings.memberships (user_id, category, kind, active) values (p_user, p_cat, 'extra', true)
  on conflict (user_id, category) do update set kind = 'extra', active = true;
  perform trainings.log('joined', p_user, p_cat);
  perform trainings.sync_rank(p_user, p_cat);
end $$;

-- Not active here any more: rank freezes, record stays, can still teach.
create or replace function trainings_api.set_active(p_user uuid, p_cat text, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare m trainings.memberships;
begin
  perform trainings.require_active();
  if not trainings.can_grant(auth.uid(), p_cat) then perform trainings.deny(); end if;
  select * into m from trainings.memberships where user_id = p_user and category = p_cat;
  if not p_active then
    insert into trainings.memberships (user_id, category, kind, active) values (p_user, p_cat, coalesce(m.kind, 'paused'), false)
    on conflict (user_id, category) do update set active = false;
  elsif m.kind = 'paused' then
    delete from trainings.memberships where user_id = p_user and category = p_cat;
  else
    update trainings.memberships set active = true where user_id = p_user and category = p_cat;
  end if;
  perform trainings.log(case when p_active then 'reactivated' else 'deactivated' end, p_user, p_cat);
  if p_active then perform trainings.sync_rank(p_user, p_cat); end if;
end $$;

-- ---- ranks ----
-- A lead pins a rank by hand (an exception) — or puts it back on automatic.
create or replace function trainings_api.set_rank(p_user uuid, p_cat text, p_rank text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform trainings.require_active();
  if not trainings.can_grant(auth.uid(), p_cat) then perform trainings.deny(); end if;
  if p_rank is not null and not exists (select 1 from trainings.ranks where id = p_rank) then raise exception 'דרגה לא קיימת' using errcode = '22023'; end if;
  select rank into v_old from trainings.rank_current where user_id = p_user and category = p_cat;
  insert into trainings.rank_current (user_id, category, rank, manual) values (p_user, p_cat, p_rank, true)
  on conflict (user_id, category) do update set rank = excluded.rank, manual = true;
  perform trainings.log('rank_set', p_user, p_cat, p_rank, v_old);
end $$;

create or replace function trainings_api.set_auto(p_user uuid, p_cat text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform trainings.require_active();
  if not trainings.can_grant(auth.uid(), p_cat) then perform trainings.deny(); end if;
  update trainings.rank_current set manual = false where user_id = p_user and category = p_cat;
  perform trainings.log('auto_rank_on', p_user, p_cat);
  perform trainings.sync_rank(p_user, p_cat);
end $$;

create or replace function trainings_api.set_requirement(p_cat text, p_rank text, p_items text[], p_min_grade int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform trainings.require_active();
  if not trainings.can_edit_catalog(auth.uid(), p_cat) then perform trainings.deny(); end if;
  -- an item belongs to one rank only
  update trainings.rank_rules set items = array(select x from unnest(items) x where x <> all(coalesce(p_items, '{}')))
  where category = p_cat and rank <> p_rank;
  insert into trainings.rank_rules (category, rank, items, min_grade)
  values (p_cat, p_rank, array(select x from unnest(coalesce(p_items, '{}')) x where exists (select 1 from trainings.items i where i.id = x and i.category = p_cat)), p_min_grade)
  on conflict (category, rank) do update set items = excluded.items, min_grade = excluded.min_grade;
  perform trainings.log('ladder_updated', null, p_cat, p_rank);
  perform trainings.sync_category(p_cat);
end $$;

-- ---- catalog ----
create or replace function trainings_api.add_item(p_cat text, p_column text, p_name text, p_after text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  perform trainings.require_active();
  if not trainings.can_edit_catalog(auth.uid(), p_cat) then perform trainings.deny(); end if;
  if nullif(btrim(p_name), '') is null then raise exception 'צריך שם' using errcode = '22023'; end if;
  if exists (select 1 from trainings.items where category = p_cat and name = btrim(p_name)) then raise exception 'כבר קיים' using errcode = '23505'; end if;
  if not exists (select 1 from trainings.categories c, jsonb_array_elements(c.columns) col where c.id = p_cat and col ->> 'id' = p_column) then
    raise exception 'עמודה לא קיימת' using errcode = '22023';
  end if;
  v_id := trainings.item_id(p_cat, btrim(p_name));
  if exists (select 1 from trainings.items where id = v_id) then v_id := trainings.new_id('i_'); end if;
  insert into trainings.items (id, category, name, column_id, groups, sort)
  values (v_id, p_cat, btrim(p_name), p_column,
          case when p_after is not null and trainings.item_cat(p_after) = p_cat then jsonb_build_array(jsonb_build_object('mode', 'all', 'n', 1, 'ids', jsonb_build_array(p_after))) else '[]'::jsonb end,
          coalesce((select max(sort) + 1 from trainings.items where category = p_cat), 0));
  perform trainings.log('item_created', null, p_cat, v_id);
  return v_id;
end $$;

-- name / column / description / prerequisites. p_patch keys: name, column, desc, after (item id or null)
create or replace function trainings_api.update_item(p_item text, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cat text := trainings.item_cat(p_item);
  v_old trainings.items;
begin
  perform trainings.require_active();
  if v_cat is null or not trainings.can_edit_catalog(auth.uid(), v_cat) then perform trainings.deny(); end if;
  select * into v_old from trainings.items where id = p_item;
  if p_patch ? 'column' and not exists (select 1 from trainings.categories c, jsonb_array_elements(c.columns) col where c.id = v_cat and col ->> 'id' = p_patch ->> 'column') then
    raise exception 'עמודה לא קיימת' using errcode = '22023';
  end if;
  update trainings.items set
    name = coalesce(nullif(btrim(p_patch ->> 'name'), ''), name),
    column_id = coalesce(p_patch ->> 'column', column_id),
    descr = coalesce(p_patch ->> 'desc', descr),
    groups = case when not (p_patch ? 'after') then groups
                  when p_patch ->> 'after' is null or p_patch ->> 'after' = p_item or trainings.item_cat(p_patch ->> 'after') <> v_cat then '[]'::jsonb
                  else jsonb_build_array(jsonb_build_object('mode', 'all', 'n', 1, 'ids', jsonb_build_array(p_patch ->> 'after'))) end
  where id = p_item;
  if p_patch ? 'name' and v_old.name <> btrim(p_patch ->> 'name') then
    perform trainings.log('item_renamed', null, v_cat, p_item, v_old.name);
  end if;
end $$;

create or replace function trainings_api.delete_item(p_item text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cat text := trainings.item_cat(p_item);
  v_name text;
begin
  perform trainings.require_active();
  if v_cat is null or not trainings.can_edit_catalog(auth.uid(), v_cat) then perform trainings.deny(); end if;
  select name into v_name from trainings.items where id = p_item;
  delete from trainings.items where id = p_item;     -- certs go with it (cascade)
  update trainings.rank_rules set items = array_remove(items, p_item) where category = v_cat;
  update trainings.items set groups = coalesce((
      select jsonb_agg(jsonb_set(g, '{ids}', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(g -> 'ids') x where x #>> '{}' <> p_item)))
      from jsonb_array_elements(groups) g), '[]')
    where category = v_cat and groups::text like '%' || p_item || '%';
  update trainings.items set groups = coalesce((select jsonb_agg(g) from jsonb_array_elements(groups) g where jsonb_array_length(g -> 'ids') > 0), '[]')
    where category = v_cat;
  perform trainings.log('item_deleted', null, v_cat, null, v_name);
  perform trainings.sync_category(v_cat);
end $$;

-- category settings and columns. p_patch keys: name, item_noun, item_noun_singular, favorite_label, columns
create or replace function trainings_api.update_category(p_cat text, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cols jsonb := p_patch -> 'columns';
begin
  perform trainings.require_active();
  if not trainings.can_edit_catalog(auth.uid(), p_cat) then perform trainings.deny(); end if;
  if v_cols is not null then
    if jsonb_typeof(v_cols) <> 'array' or jsonb_array_length(v_cols) = 0
       or exists (select 1 from jsonb_array_elements(v_cols) c where coalesce(c ->> 'id', '') = '' or coalesce(btrim(c ->> 'he'), '') = '') then
      raise exception 'עמודות לא תקינות' using errcode = '22023';
    end if;
    -- a removed column takes its items (and their certifications) with it
    perform trainings_api.delete_item(i.id) from trainings.items i
    where i.category = p_cat and not exists (select 1 from jsonb_array_elements(v_cols) c where c ->> 'id' = i.column_id);
  end if;
  update trainings.categories set
    name = coalesce(nullif(btrim(p_patch ->> 'name'), ''), name),
    item_noun = coalesce(nullif(btrim(p_patch ->> 'item_noun'), ''), item_noun),
    item_noun_singular = coalesce(nullif(btrim(p_patch ->> 'item_noun_singular'), ''), item_noun_singular),
    favorite_label = coalesce(nullif(btrim(p_patch ->> 'favorite_label'), ''), favorite_label),
    columns = coalesce(v_cols, columns)
  where id = p_cat;
  perform trainings.log('category_updated', null, p_cat);
end $$;

-- A category for a team that has none yet (a new team in NeatSystem), or a special one like CNC.
create or replace function trainings_api.create_category(p_name text, p_team text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  perform trainings.require_active();
  if not hub.has_perm('trainings.manage') then perform trainings.deny('רק מנטור יוצר קטגוריה'); end if;
  if nullif(btrim(p_name), '') is null then raise exception 'צריך שם' using errcode = '22023'; end if;
  if p_team is not null then
    if not exists (select 1 from hub.teams t where t.id = p_team and t.kind = 'team') then raise exception 'צוות לא קיים' using errcode = '22023'; end if;
    if exists (select 1 from trainings.categories where kind = 'team' and team = p_team) then raise exception 'לצוות כבר יש קטגוריה' using errcode = '23505'; end if;
    v_id := p_team;
  else
    v_id := 'x' || substr(md5(random()::text), 1, 8);
  end if;
  insert into trainings.categories (id, name, kind, team, sort, columns)
  values (v_id, btrim(p_name), case when p_team is null then 'special' else 'team' end, p_team, case when p_team is null then 20 else 5 end,
          '[{"id":"s0","he":"שלב א׳","label":"שלב א׳","header":"#6D6D6D"}]');
  perform trainings.log('category_created', null, v_id, null, btrim(p_name));
  return v_id;
end $$;

-- ---- who certifies, locks, access lists (mentors) ----
create or replace function trainings_api.set_approver(p_cat text, p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform trainings.require_active();
  if not hub.has_perm('trainings.manage') then perform trainings.deny('רק מנטור ממנה מאשרים'); end if;
  if p_on then insert into trainings.approvers values (p_cat, p_user) on conflict do nothing;
  else delete from trainings.approvers where category = p_cat and user_id = p_user; end if;
  perform trainings.log(case when p_on then 'approver_added' else 'approver_removed' end, p_user, p_cat);
end $$;

-- The lock switch: a locked lead sees everything and changes nothing here.
create or replace function trainings_api.set_locked(p_cat text, p_user uuid, p_locked boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform trainings.require_active();
  if not hub.has_perm('trainings.manage') then perform trainings.deny('רק מנטור נועל ופותח'); end if;
  if p_locked then insert into trainings.locks values (p_cat, p_user) on conflict do nothing;
  else delete from trainings.locks where category = p_cat and user_id = p_user; end if;
  perform trainings.log(case when p_locked then 'lead_locked' else 'lead_unlocked' end, p_user, p_cat);
end $$;

create or replace function trainings_api.set_access(p_cat text, p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform trainings.require_active();
  if not (hub.has_perm('trainings.manage') or trainings.can_grant(auth.uid(), p_cat)) then perform trainings.deny(); end if;
  if (select kind from trainings.categories where id = p_cat) <> 'special' then raise exception 'רק להסמכה מיוחדת יש רשימת גישה' using errcode = '22023'; end if;
  if p_on then insert into trainings.access values (p_cat, p_user) on conflict do nothing;
  else delete from trainings.access where category = p_cat and user_id = p_user; end if;
  perform trainings.log(case when p_on then 'joined' else 'deactivated' end, p_user, p_cat);
  if p_on then perform trainings.sync_rank(p_user, p_cat); end if;
end $$;

-- -----------------------------------------------------------------------------
-- Privileges: only trainings_api is callable, and only by signed-in users.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema trainings from public, anon, authenticated;
revoke all on all functions in schema trainings from public, anon, authenticated;
revoke all on all functions in schema trainings_api from public, anon;
grant execute on all functions in schema trainings_api to authenticated;
