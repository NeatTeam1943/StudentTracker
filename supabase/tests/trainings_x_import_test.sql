-- Firestore import tests. Runs after trainings_test.sql (named to sort after it; reuses its people).
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
update hub.profiles set phone = '052-7654321' where id = t.tid('sw');

create temp table imp_payload as select '{
  "categories": [{"id": "build", "name": "בנייה", "kind": "team", "team": "build", "sort": 2, "item_noun": "כלים", "item_noun_singular": "כלי", "favorite_label": "כלי אהוב",
                  "columns": [{"id": "basic_training", "he": "הכשרה בסיסית", "label": "BASIC TRAINING", "header": "#747474"}, {"id": "basic_tools", "he": "כלים בסיסיים", "label": "BASIC TOOLS", "header": "#002060"}]},
                 {"id": "x3d", "name": "הדפסה", "kind": "special", "team": null, "sort": 20, "columns": [{"id": "s0", "he": "שלב א׳", "label": "שלב א׳", "header": "#6D6D6D"}]}],
  "items": [{"category": "build", "name": "אומים", "column": "basic_training", "sort": 1}, {"category": "x3d", "name": "מדפסת", "column": "s0", "sort": 0}],
  "rules": [{"category": "x3d", "rank": "nit", "items": ["מדפסת"], "min_grade": null}],
  "people": [{"fs_id": "p1", "name": "חבר  בנייה", "phone": ""}, {"fs_id": "p2", "name": "מישהו חדש", "phone": ""},
             {"fs_id": "p3", "name": "שם אחר לגמרי", "phone": "+972 52 765 4321"}],
  "certs": [{"fs_id": "p1", "category": "build", "item": "אומים", "at": "2025-10-01T10:00:00Z", "by_name": "מנטור ישן", "teach": true},
            {"fs_id": "p2", "category": "build", "item": "אומים", "at": "2025-10-02T10:00:00Z", "teach": false},
            {"fs_id": "p2", "category": "x3d", "item": "מדפסת", "at": "2025-10-03T10:00:00Z"},
            {"fs_id": "p3", "category": "x3d", "item": "מדפסת", "at": "2025-10-03T10:00:00Z"}],
  "current": [{"fs_id": "p2", "category": "x3d", "rank": "nit", "manual": true}],
  "favorites": [{"fs_id": "p1", "category": "build", "text": "מקדחה"}],
  "paused": [],
  "events": [{"key": "e1", "fs_id": "p1", "category": "build", "type": "granted", "item": "אומים", "at": "2025-10-01T10:00:00Z", "by_name": "מנטור ישן"},
             {"key": "e2", "fs_id": "p2", "category": "build", "type": "note", "text": "הערה ישנה", "at": "2025-10-04T10:00:00Z"}],
  "locked_leads": [{"name": "רש\"צ נעול"}]
}'::jsonb as j;

select trainings.import_firestore(j) from imp_payload;
select t.eq((select (trainings.import_firestore(j) -> 'matched')::int from imp_payload), 2, 're-run: name + phone matched');
select t.eq((select count(*) from trainings.events where source_key in ('fs:e1', 'fs:e2')), 2::bigint, 're-run did not duplicate events');
select t.eq((select teach from trainings.certs where user_id = t.tid('a') and item = trainings.item_id('build', 'אומים')), true, 'matched by name (extra spaces ignored)');
select t.eq((select count(*) from trainings.certs where user_id = t.tid('sw') and item = trainings.item_id('x3d', 'מדפסת')), 1::bigint, 'matched by phone');
select t.eq((select count(*) from trainings.legacy_people where name = 'מישהו חדש' and claimed_by is null), 1::bigint, 'unmatched person kept as legacy');
select t.eq((select count(*) from trainings.certs c join trainings.legacy_people l on l.id = c.user_id where l.name = 'מישהו חדש'), 2::bigint, 'legacy person holds their records');
select t.eq((select count(*) from trainings.locks where user_id = t.tid('lead2') and category = 'build'), 1::bigint, 'locked lead stays locked');
select t.eq((select by_name from trainings.events where source_key = 'fs:e1'), 'מנטור ישן', 'who did it is kept by name');

set role authenticated;
select t.login(t.tid('a'));
select t.eq(t.err($$select trainings.import_firestore('{}')$$), '42501', 'clients cannot import');
select t.eq(jsonb_array_length(trainings_api.state() -> 'legacy'), 1, 'state lists legacy people');
reset role;

select trainings.link_legacy('מישהו חדש', 'b@tr.test');
select t.eq((select count(*) from trainings.certs c where c.user_id = t.tid('b') and c.item = trainings.item_id('x3d', 'מדפסת')), 1::bigint, 'linking moves the certifications');
select t.eq((select rank || '/' || manual from trainings.rank_current where user_id = t.tid('b') and category = 'x3d'), 'nit/true', 'and the ranks');
select t.eq((select count(*) from trainings.events where user_id = t.tid('b') and source_key = 'fs:e2'), 1::bigint, 'and the history');
select t.eq((select count(*) from trainings.legacy_people where claimed_by = t.tid('b')), 1::bigint, 'legacy marked as claimed');
select t.eq((select (trainings.import_firestore(j) -> 'matched')::int from imp_payload), 3, 'a re-run after linking goes to the linked member');
select t.eq((select count(*) from trainings.certs c join trainings.legacy_people l on l.id = c.user_id), 0::bigint, 'nothing left on legacy ids');
\echo TRAININGS IMPORT TESTS PASSED
