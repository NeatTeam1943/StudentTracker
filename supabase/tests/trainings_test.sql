-- Trainings SQL tests. Run by NeatSystem's scripts/test-db.sh (needs hub + t.*).
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;

create or replace function t.tid(p text) returns uuid language sql immutable as $$
  select ('10000000-0000-0000-0000-' || lpad(case p
    when 'mentor' then '1' when 'lead' then '2' when 'lead2' then '3' when 'a' then '4' when 'b' then '5'
    when 'sw' then '6' when 'cap' then '7' when 'gone' then '8' end, 12, '0'))::uuid $$;
grant execute on function t.tid(text) to public;
-- trainings.* is closed to clients, so tests reach item ids through this
create or replace function t.item(p_name text, p_cat text default 'build') returns text language sql stable security definer as $$ select trainings.item_id(p_cat, p_name) $$;
grant execute on function t.item(text, text) to public;

insert into auth.users (id, email) select t.tid(x), x || '@tr.test' from unnest(array['mentor','lead','lead2','a','b','sw','cap','gone']) x on conflict do nothing;
insert into hub.profiles (id, email, full_name, position, status, team, grad_year) values
  (t.tid('mentor'), 'mentor@tr.test', 'מנטור הכשרות', 'mentor', 'active', null, null),
  (t.tid('lead'),   'lead@tr.test',   'רש"צית בנייה', 'team_lead', 'active', 'build', 2027),
  (t.tid('lead2'),  'lead2@tr.test',  'רש"צ נעול', 'team_lead', 'active', 'build', 2027),
  (t.tid('a'),      'a@tr.test',      'חבר בנייה', 'member', 'active', 'build', 2028),
  (t.tid('b'),      'b@tr.test',      'רוקי בנייה', 'rookie', 'active', 'build', 2030),
  (t.tid('sw'),     'sw@tr.test',     'חברת תוכנה', 'member', 'active', 'software', 2028),
  (t.tid('cap'),    'cap@tr.test',    'קפטן תוכנה', 'captain', 'active', 'software', 2027),
  (t.tid('gone'),   'gone@tr.test',   'עזב', 'member', 'active', 'build', 2027)
on conflict (id) do nothing;
insert into trainings.locks values ('build', t.tid('lead2')) on conflict do nothing;

set role authenticated;
select t.login(null);
select t.eq(t.err($$select trainings_api.state()$$), '42501', 'signed-out cannot read');
select t.eq(t.err($$select * from trainings.certs$$), '42501', 'tables are closed');

-- ---------- certify ----------
select t.login(t.tid('a'));
select t.eq((select jsonb_array_length(trainings_api.state() -> 'categories') >= 3), true, 'member reads the state');
select t.eq(t.err($$select trainings_api.grant(t.tid('b'), t.item('ברגים'))$$), '42501', 'member cannot certify');
select t.login(t.tid('lead2'));
select t.eq(t.err($$select trainings_api.grant(t.tid('b'), t.item('ברגים'))$$), '42501', 'locked lead cannot certify');
select t.login(t.tid('lead'));
select t.eq(t.err($$select trainings_api.grant(t.tid('lead'), t.item('ברגים'))$$), '42501', 'nobody certifies themselves');
select t.eq(t.err($$select trainings_api.grant(t.tid('sw'), t.item('ברגים'))$$), '22023', 'only members of the category');
reset role;
create temp table nit_items as select unnest(items) as id from trainings.rank_rules where category = 'build' and rank = 'nit';
grant select on nit_items to public;
set role authenticated;
select t.login(t.tid('lead'));
select trainings_api.grant(t.tid('a'), id) from nit_items;
reset role;
select t.eq((select rank from trainings.rank_current where user_id = t.tid('a') and category = 'build'), 'nit', 'all nit items -> automatic rank nit');
set role authenticated;
select t.login(t.tid('lead'));
select trainings_api.revoke(t.tid('a'), t.item('ברגים'));
reset role;
select t.eq((select rank from trainings.rank_current where user_id = t.tid('a') and category = 'build'), null::text, 'revoking drops the automatic rank');
set role authenticated;
select t.login(t.tid('lead'));
select trainings_api.grant(t.tid('a'), t.item('ברגים'));
select trainings_api.set_teach(t.tid('a'), t.item('ברגים'), true);
select t.eq(t.err($$select trainings_api.set_teach(t.tid('b'), t.item('ברגים'), true)$$), '22023', 'teach needs the certification');

-- ---------- early unlock ----------
select t.login(t.tid('mentor'));
select trainings_api.update_item(t.item('מקדחה'), jsonb_build_object('after', t.item('ברגים')));
select t.login(t.tid('lead'));
select trainings_api.grant(t.tid('b'), t.item('מקדחה'));
reset role;
select t.eq((select early from trainings.certs where user_id = t.tid('b') and item = t.item('מקדחה')), true, 'certified before prerequisites = early');
select t.eq((select early from trainings.certs where user_id = t.tid('a') and item = t.item('ברגים')), false, 'normal certification is not early');
set role authenticated;

-- ---------- manual rank, grade gate ----------
select t.login(t.tid('lead'));
select trainings_api.set_rank(t.tid('b'), 'build', 'niter');
select trainings_api.grant(t.tid('b'), t.item('ברגים'));
reset role;
select t.eq((select rank || '/' || manual from trainings.rank_current where user_id = t.tid('b') and category = 'build'), 'niter/true', 'manual rank is not overwritten');
select t.eq(trainings.grade_of('member', 2030) between 7 and 10, true, 'grade from graduation year');
select t.eq(trainings.grade_of('mentor', null), 99, 'mentors count as 99');
set role authenticated;

-- ---------- catalog ----------
select t.login(t.tid('a'));
select t.eq(t.err($$select trainings_api.add_item('build', 'basic_tools', 'פטיש')$$), '42501', 'member cannot edit the catalog');
select t.login(t.tid('lead'));
select t.eq(trainings_api.add_item('build', 'basic_tools', 'פטיש') like 'i_%', true, 'lead adds an item to own team');
select t.eq(t.err($$select trainings_api.add_item('software', 's0', 'X')$$), '42501', 'lead cannot edit another team');
select t.eq(t.err($$select trainings_api.add_item('build', 'nope', 'Y')$$), '22023', 'column must exist');
select t.login(t.tid('cap'));
select trainings_api.add_item('software', 's0', 'Java basics');
select t.eq(t.err($$select trainings_api.create_category('CNC')$$), '42501', 'only managers create categories');
select t.login(t.tid('mentor'));
select t.eq(length(trainings_api.create_category('CNC')) > 0, true, 'mentor creates a special category');

-- delete an item that someone holds and that a rank requires
select trainings_api.delete_item(t.item('ברגים'));
reset role;
select t.eq((select count(*) from trainings.certs where item = t.item('ברגים')), 0::bigint, 'certifications go with the item');
select t.eq((select t.item('ברגים') = any(items) from trainings.rank_rules where category = 'build' and rank = 'nit'), false, 'item leaves the ladder');
select t.eq((select jsonb_array_length(groups) from trainings.items where id = t.item('מקדחה')), 0, 'item leaves prerequisites');
select t.eq((select rank from trainings.rank_current where user_id = t.tid('a') and category = 'build'), 'nit', 'ranks recomputed after a delete');
set role authenticated;

-- ---------- notes & log ----------
select t.login(t.tid('lead'));
select trainings_api.add_note(t.tid('a'), 'build', 'עבד יפה');
select t.eq(t.err($$select trainings_api.clear_log(t.tid('a'))$$), '42501', 'only managers clear a log');
select t.login(t.tid('mentor'));
select t.eq(trainings_api.clear_log(t.tid('a')) > 0, true, 'mentor clears a log');
reset role;
select t.eq((select count(*) from trainings.events where user_id = t.tid('a') and type = 'log_cleared'), 1::bigint, 'the clearing itself is logged');
set role authenticated;

-- ---------- profile blocks (what NeatSystem reads) ----------
select t.login(t.tid('sw'));
select t.eq((trainings_api.profile_v1(t.tid('a')) ->> 'contract')::int, 1, 'profile contract 1');
select t.eq((select b ->> 'kind' from jsonb_array_elements(trainings_api.profile_v1(t.tid('a')) -> 'blocks') b limit 1), 'stats', 'profile starts with stats');
select t.eq(jsonb_array_length(trainings_api.profile_v1(t.tid('cap')) -> 'blocks'), 0, 'nothing to show = empty blocks');
select t.eq((select provolatile from pg_proc where oid = 'trainings_api.profile_v1(uuid)'::regprocedure)::text, 's', 'profile_v1 is STABLE (read-only)');

-- ---------- leaving the team (NeatSystem archive) ----------
select t.login(t.tid('lead'));
select trainings_api.grant(t.tid('gone'), t.item('מקדחה'));
reset role;
update hub.profiles set status = 'archived' where id = t.tid('gone');
set role authenticated;
select t.login(t.tid('gone'));
select t.eq(t.err($$select trainings_api.state()$$), '42501', 'archived person is locked out');
select t.login(t.tid('lead'));
select t.eq(t.err($$select trainings_api.grant(t.tid('gone'), t.item('שופין'))$$), '22023', 'archived person cannot be certified');
reset role;
select t.eq((select count(*) from trainings.certs where user_id = t.tid('gone')), 1::bigint, 'records stay after leaving');

reset role;
\echo TRAININGS TESTS PASSED
