import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildImport, slugId } from '../src/model/firestore.js'

const fs = {
  teams: [
    { id: 'build', name: 'בנייה', order: ['basic_training'], categories: { basic_training: { he: 'הכשרה בסיסית', label: 'BASIC TRAINING', header: '#747474', items: ['אומים'] } }, requirements: { nit: { items: ['אומים'] }, nitprime: { items: [] } } },
    { id: 'Kx9', name: 'תוכנה', categories: { a: { he: 'שלב א', items: ['Git'] } } },
    { id: '3D', name: 'הדפסה', categories: {} },
  ],
  people: [
    { id: 'p1', name: 'א', memberships: { build: { rankId: 'nit', items: { 'אומים': { at: '2025-01-01T00:00:00Z', canTeach: true } }, active: false, favorite: 'x' } } },
    { id: 'p2', name: 'ב', tools: { 'אומים': true } },
  ],
  events: [{ id: 'e1', type: 'tool_granted', personId: 'p1', teamId: 'build', tool: 'אומים' }, { id: 'e2', type: 'person_added', personId: 'p1' }, { id: 'e3', type: 'promoted', personId: 'p1', teamId: 'build', to: 'nit', from: null }],
  leads: [{ name: 'ג', canEdit: false }, { name: 'ד', canEdit: true }],
}

test('teams map onto NeatSystem teams by id or name; others become special', () => {
  const { payload } = buildImport(fs)
  assert.deepEqual(payload.categories.map((c) => [c.id, c.kind]), [['build', 'team'], ['software', 'team'], ['x3d', 'special']])
  assert.equal(payload.items.find((i) => i.name === 'Git').category, 'software')
  assert.equal(payload.rules.find((r) => r.rank === 'nitprime').min_grade, 10, 'missing minGrade = the rank\'s own gate')
})

test('records, the oldest flat format, and events', () => {
  const { payload, counts } = buildImport(fs)
  assert.equal(counts.certs, 2)
  assert.equal(payload.certs.find((c) => c.fs_id === 'p2').category, 'build', 'flat tools = בנייה')
  assert.deepEqual(payload.paused, [{ fs_id: 'p1', category: 'build' }])
  assert.equal(payload.events.length, 2, 'admin-only events are skipped')
  assert.equal(payload.events.find((e) => e.key === 'e3').rank, 'nit')
  assert.deepEqual(payload.locked_leads, [{ name: 'ג' }])
  assert.equal(slugId('3D'), 'x3d')
})
