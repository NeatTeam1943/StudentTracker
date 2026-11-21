import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildModel, profileBlocks, gradeOf } from '../src/model/logic.js'

const yearEnd = new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear()
const people = [
  { id: 'm', full_name: 'מנטורית', position: 'mentor', status: 'active', team: null, grad_year: null },
  { id: 'l', full_name: 'רש"צ', position: 'team_lead', status: 'active', team: 'build', grad_year: yearEnd },
  { id: 'a', full_name: 'חבר', position: 'member', status: 'active', team: 'build', grad_year: yearEnd + 2 },
  { id: 's', full_name: 'תוכנה', position: 'member', status: 'active', team: 'software', grad_year: yearEnd + 1 },
]
const S = {
  categories: [{ id: 'build', name: 'בנייה', kind: 'team', team: 'build', sort: 1, columns: [{ id: 'c', he: 'א' }] }, { id: 'cnc', name: 'CNC', kind: 'special', team: null, sort: 9, columns: [] }],
  items: [{ id: 'x', category: 'build', name: 'X', column: 'c', groups: [], sort: 0 }, { id: 'y', category: 'build', name: 'Y', column: 'c', groups: [{ mode: 'all', n: 1, ids: ['x'] }], sort: 1 },
    { id: 'z', category: 'build', name: 'Z', column: 'c', groups: [], sort: 2 }],
  certs: [{ user: 'a', item: 'x', at: '2026-10-01T00:00:00Z' }, { user: 's', item: 'z', at: '2026-10-01T00:00:00Z' }],
  memberships: [], favorites: [], access: [], approvers: [], locks: [{ user: 'l', category: 'build' }],
  ranks: [{ id: 'nit', name: 'ניט', sort: 0 }, { id: 'niter', name: 'ניטר', sort: 1 }, { id: 'nitmentor', name: 'ניטמנטור', sort: 7 }],
  rules: [{ category: 'build', rank: 'nit', items: ['x'], minGrade: null }, { category: 'build', rank: 'niter', items: ['y'], minGrade: 12 }],
  current: [{ user: 'a', category: 'build', rank: 'nit', manual: false }], events: [], perms: {},
}

test('membership: team, former, mentors in every team', () => {
  const M = buildModel(S, people, 'a')
  assert.equal(M.membership('a', 'build').kind, 'team')
  assert.equal(M.membership('s', 'build').kind, 'former')
  assert.equal(M.isMember('s', 'build'), false)
  assert.equal(M.membership('m', 'build').kind, 'team', 'a mentor with no team belongs to every team category')
  assert.equal(M.membership('m', 'cnc'), null)
  assert.equal(M.membership('a', 'cnc'), null)
})

test('prerequisites, locked lead, ranks with a grade gate', () => {
  const M = buildModel(S, people, 'l')
  assert.equal(M.stateOf('a', M.item('y')), 'open')
  assert.equal(M.stateOf('l', M.item('y')), 'locked')
  assert.equal(M.canGrant(M.person('l'), 'build'), false, 'locked lead')
  assert.equal(M.earned(M.person('a'), 'build').id, 'nit')
  const S2 = { ...S, certs: [...S.certs, { user: 'a', item: 'y', at: '2026-10-02T00:00:00Z' }] }
  const M2 = buildModel(S2, people, 'l')
  assert.equal(M2.earned(M2.person('a'), 'build').id, 'nit', 'niter needs grade 12')
  assert.equal(M2.next('a', 'build').gradeOk, false)
  assert.equal(M.rankIn('m', 'build').id, 'nitmentor')
})

test('profile blocks follow contract 1', () => {
  const M = buildModel(S, people, 'a')
  const p = profileBlocks(M, 'a')
  assert.equal(p.contract, 1)
  assert.equal(p.blocks[0].kind, 'stats')
  assert.deepEqual(profileBlocks(M, 'm').blocks.length > 0, true)
  assert.equal(profileBlocks(M, 'nobody').blocks.length, 0)
  assert.equal(gradeOf(yearEnd), 12)
})
