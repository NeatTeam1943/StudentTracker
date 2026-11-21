/**
 * Reading StudentTracker's old Firestore and turning it into one payload for
 * trainings.import_firestore() (supabase/migrations/0002_firestore_import.sql).
 * Used by NeatSystem's scripts/import-firebase.mjs, run once on a mentor's
 * machine. The old collections are public-read, so the web config is enough.
 * Pure apart from readFirestore(); tested in tests/firestore.test.js.
 */
export const COLLECTIONS = ['people', 'teams', 'events', 'leads']

function val(v) {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(val)
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, val(x)]))
  return null
}
export const fromDoc = (d) => ({ id: d.name.split('/').pop(), ...val({ mapValue: { fields: d.fields ?? {} } }) })

/** All documents of the collections, through the Firestore REST API. */
export async function readFirestore(projectId, apiKey, collections = COLLECTIONS, fetchFn = fetch) {
  const out = {}
  for (const c of collections) {
    out[c] = []
    let token = ''
    do {
      const u = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${c}?pageSize=300&key=${encodeURIComponent(apiKey)}${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`
      const r = await fetchFn(u)
      if (!r.ok) {
        const t = await r.text()
        throw new Error(r.status === 403 || r.status === 404 ? `אין גישה ל-${c} (בדקו את ה-project id וה-API key)` : `Firestore ${c}: ${r.status} ${t.slice(0, 120)}`)
      }
      const j = await r.json()
      for (const d of j.documents ?? []) out[c].push(fromDoc(d))
      token = j.nextPageToken ?? ''
    } while (token)
  }
  return out
}

const RANK_GATE = { nitprime: 10, nitelite: 11, nitmaster: 12, nitmentor: 99 }
const EVENT = {
  tool_granted: 'granted', tool_revoked: 'revoked', teach_granted: 'teach_granted', teach_revoked: 'teach_revoked', note: 'note',
  promoted: 'promoted', rank_set: 'rank_set', rank_auto: 'rank_auto', auto_rank_on: 'auto_rank_on',
  team_joined: 'joined', team_transferred: 'joined', team_deactivated: 'deactivated', team_reactivated: 'reactivated',
}
const itemName = (s) => String(s ?? '').trim().slice(0, 60) // trainings.items.name: 1..60
const norm = (s) => String(s ?? '').normalize('NFKC').replace(/["'״׳`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
export function slugId(s) {
  let x = String(s ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  if (!/^[a-z]/.test(x)) x = 'x' + x
  return x.length > 1 ? x.slice(0, 40) : 'x' + Math.abs([...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)
}

// NeatSystem's main teams (hub.teams, a static catalog set by its migration)
export const HUB_TEAMS = [{ id: 'cad', name: 'שרטוט' }, { id: 'build', name: 'בנייה' }, { id: 'software', name: 'תוכנה' }]

/**
 * fs = { people, teams, events, leads } as read above.
 * Returns { payload, counts } for trainings.import_firestore(). People are
 * matched to NeatSystem members by the SQL itself (name, then phone).
 */
export function buildImport(fs, hubTeams = HUB_TEAMS) {
  const catOf = new Map()
  const categories = [], items = [], rules = []
  for (const t of fs.teams ?? []) {
    const team = hubTeams.find((h) => h.id === t.id || norm(h.name) === norm(t.name))
    const id = team ? team.id : slugId(t.id)
    catOf.set(t.id, id)
    const order = (t.order?.length ? t.order : Object.keys(t.categories ?? {})).filter((k) => t.categories?.[k])
    const columns = order.map((k) => ({ id: slugId(k), he: t.categories[k].he ?? k, label: t.categories[k].label ?? t.categories[k].he ?? k, header: t.categories[k].header ?? '#6D6D6D' }))
    let n = 0
    for (const k of order) for (const name of (t.categories[k].items ?? []).map(itemName).filter(Boolean)) items.push({ category: id, name, column: slugId(k), sort: n++ })
    categories.push({
      id, name: String(team?.name ?? t.name ?? id).trim().slice(0, 40) || id, kind: team ? 'team' : 'special', team: team?.id ?? null, sort: Number(t.sort ?? 50),
      item_noun: t.itemNoun ?? 'הכשרות', item_noun_singular: t.itemNounSingular ?? 'הכשרה', favorite_label: t.favoriteLabel ?? 'דבר אהוב',
      columns: columns.length ? columns : [{ id: 's0', he: 'שלב א׳', label: 'שלב א׳', header: '#6D6D6D' }], items: n,
    })
    for (const [rank, req] of Object.entries(t.requirements ?? {})) {
      rules.push({ category: id, rank, items: (req?.items ?? []).map(itemName), min_grade: req?.minGrade === undefined ? RANK_GATE[rank] ?? null : req.minGrade })
    }
  }
  const cat = (teamId) => catOf.get(teamId) ?? (teamId ? slugId(teamId) : null)

  const people = (fs.people ?? []).map((p) => ({ fs_id: p.id, name: p.name ?? p.id, phone: p.phone ?? '' }))
  const certs = [], current = [], favorites = [], paused = [], memberOf = []
  for (const p of fs.people ?? []) {
    // very old records: a flat `tools` map before teams existed = בנייה
    const ms = p.memberships ?? (p.tools ? { build: { items: p.tools, rankId: p.rankId ?? null, active: true } } : {})
    for (const [teamId, m] of Object.entries(ms)) {
      const c = cat(teamId)
      if (!c) continue
      for (const [name, r] of Object.entries(m?.items ?? {})) {
        const rec = r && typeof r === 'object' ? r : { canTeach: !!r }
        certs.push({ fs_id: p.id, category: c, item: itemName(name), at: rec.at ?? null, by_name: rec.by ?? null, teach: !!rec.canTeach, teach_at: rec.teachAt ?? null })
      }
      if (m?.rankId || m?.autoRank === false) current.push({ fs_id: p.id, category: c, rank: m.rankId ?? null, manual: m.autoRank === false })
      const fav = m?.favorite ?? (teamId === 'build' ? p.favoriteTool : null)
      if (fav) favorites.push({ fs_id: p.id, category: c, text: String(fav).slice(0, 40) })
      if (m?.active === false) paused.push({ fs_id: p.id, category: c })
      else memberOf.push({ fs_id: p.id, category: c })
    }
  }
  const events = []
  for (const e of fs.events ?? []) {
    const type = EVENT[e.type]
    if (!type || (!e.personId && type !== 'note')) continue
    const rank = type === 'promoted' || type === 'rank_set' || type === 'rank_auto' ? e.to ?? null : null
    events.push({ key: e.id, fs_id: e.personId ?? null, category: cat(e.teamId), type, item: rank || !e.tool ? null : itemName(e.tool), rank, text: type === 'note' ? e.text ?? '' : rank ? e.from ?? null : null, at: e.at ?? null, by_name: e.by ?? null })
  }
  // a lead whose editing was locked in StudentTracker stays locked in their team (matched by name in SQL)
  const leads = (fs.leads ?? []).filter((l) => l.canEdit === false && l.name).map((l) => ({ name: l.name }))
  return {
    payload: { categories: categories.map(({ items: _i, ...c }) => c), items, rules, people, certs, current, favorites, paused, member_of: memberOf, events, locked_leads: leads },
    counts: { people: people.length, categories: categories.length, items: items.length, certs: certs.length, events: events.length },
  }
}
