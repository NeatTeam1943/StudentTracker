/**
 * In-memory backend for NeatSystem's mock mode (dev:mock, tests, preview).
 * Same calls as the SQL functions, same permission rules, made-up progress for
 * NeatSystem's invented mock people. The SQL is the source of truth.
 */
import { buildModel, profileBlocks } from './logic.js'

const COLS = (pairs) => pairs.map(([id, he, label, header]) => ({ id, he, label: label ?? he, header }))
const STAGE = ['שלב א׳', 'שלב ב׳', 'שלב ג׳', 'שלב ד׳', 'שלב ה׳', 'שלב ו׳', 'שלב ז׳']
const SW = ['#6D6D6D', '#04255A', '#1B4922', '#653A27', '#7A1220', '#3B2A6B', '#0E7490']
const BUILD = [
  ['basic_training', 'הכשרה בסיסית', 'BASIC TRAINING', '#747474', ['ברגים', 'אומים', 'חומרים', 'לקיחת מידות', 'מקדחים', 'זוויות', 'מפתחות', 'ניטים', 'מנועים', 'תמסורות']],
  ['basic_tools', 'כלים בסיסיים', 'BASIC TOOLS', '#002060', ['מקדחה', 'מברגה', 'ניטר פנאומטי', 'מסור ידני', 'שופין', 'שואב אבק', 'ניטר']],
  ['power_tools', 'כלי כוח', 'POWER TOOLS', '#12501B', ["ג'יגסו", 'דיסק ידני', 'דרמל (שיוף)', 'דרמל (חיתוך)', 'מולטי-טול', 'משייף חשמלי']],
  ['bench_tools', 'כלי שולחן', 'BENCH TOOLS', '#7F340D', ['מסור שולחן', 'רצועת שיוף', 'מקדחת עמוד', 'דיסק שולחן', 'גריינדר']],
  ['heavy_machinery', 'מכונות כבדות', 'HEAVY MACHINERY', '#5E0202', ['מסור סרט', 'ZK', 'מחרטה']],
]
const BUILD_RULES = [
  ['nit', ['ברגים', 'אומים', 'חומרים', 'לקיחת מידות', 'מקדחים', 'זוויות', 'מפתחות', 'ניטים'], null],
  ['niter', ['מקדחה', 'מברגה', 'מסור ידני', 'שופין', 'ניטר', 'שואב אבק', 'רצועת שיוף', 'מנועים', 'תמסורות'], null],
  ['nitolog', ['מקדחת עמוד', 'משייף חשמלי', 'ניטר פנאומטי', 'דיסק ידני', "ג'יגסו", 'מסור שולחן'], null],
  ['nitpro', ['דרמל (שיוף)', 'דרמל (חיתוך)', 'מולטי-טול', 'מסור סרט', 'גריינדר'], null],
  ['nitprime', ['דיסק שולחן'], 10], ['nitelite', ['ZK'], 11], ['nitmaster', [], 12], ['nitmentor', [], 99],
]
const STAGED = {
  software: [['Dog', 'Java basics', 'OOP', 'Git', 'Cool For The Summer'], ['אלקטרוניקה 101', 'הלחמה', 'הרובוט הראשון שלי'], ['SOLID', 'Clean Code', 'Conventions'],
    ['Command Based', 'Unit testing'], ['Autonomous Routines', 'PIDF'], ['Vision', 'Code Reviewing'], ['Swerve']],
  cad: [['Basic entities', 'Smart dimension', 'Extrude boss', 'Relations', 'Extrude Cut'], ['Revolve', 'Fillet & Chamfer', 'Basic Mates', 'Mirror feature'],
    ['Shell', 'Configurations', 'Patterns', '3D Printing'], ['Measure', 'Tolerances', 'Equations'], ['Drawing', 'Gears', 'Pulleys & Belts'], ['Master Sketch'], ['Fully Master Assembly']],
  cnc: [['שרטוט בסיסי', 'Setup תוכנתי'], ['איפוס', 'קיבוע חלק', 'הפעלת מכונה'], ['אירועי בטיחות'], ['שחזור הרצה שנכשלה']],
}
const RANKS = [['nit', 'ניט', '#8C5A3C', null, 'bronze-shield'], ['niter', 'ניטר', '#8E949C', null, 'silver-shield'], ['nitolog', 'ניטולוג', '#C9A200', null, 'gold-gear'],
  ['nitpro', 'ניטפרו', '#2D7FC1', null, 'steel-gear'], ['nitprime', 'ניטפריים', '#00A88E', 10, 'frost'], ['nitelite', 'ניטאליט', '#A05BE0', 11, 'arcane'],
  ['nitmaster', 'ניטמאסטר', '#E2445C', 12, 'flame'], ['nitmentor', 'ניטמנטור', '#6B7280', 99, 'mentor']]

let n = 0
const id = (p) => `${p}${(++n).toString(36)}${Math.random().toString(36).slice(2, 6)}`
const now = () => new Date().toISOString()
const hash = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h }

function seed(people) {
  const S = { categories: [], items: [], certs: [], memberships: [], favorites: [], access: [], approvers: [], locks: [], ranks: [], rules: [], current: [], events: [] }
  S.ranks = RANKS.map(([rid, name, color, minGrade, badge], sort) => ({ id: rid, name, color, min_grade: minGrade, sort, badge, wordmark: rid }))
  S.categories.push({ id: 'build', name: 'בנייה', kind: 'team', team: 'build', icon: 'hammer', sort: 2, item_noun: 'כלים', item_noun_singular: 'כלי', favorite_label: 'כלי אהוב', columns: COLS(BUILD) })
  let s = 0
  for (const [col, , , , names] of BUILD) for (const nm of names) S.items.push({ id: `build:${nm}`, category: 'build', name: nm, column: col, icon: null, desc: '', groups: [], sort: s++ })
  for (const [rk, names, mg] of BUILD_RULES) S.rules.push({ category: 'build', rank: rk, items: names.map((x) => `build:${x}`), minGrade: mg })
  const staged = (cid, name, kind, team, icon, sort, extra) => {
    const lv = STAGED[cid]
    S.categories.push({ id: cid, name, kind, team, icon, sort, item_noun: 'הכשרות', item_noun_singular: 'הכשרה', favorite_label: extra, columns: lv.map((_, i) => ({ id: `${cid}_s${i}`, he: STAGE[i], label: STAGE[i], header: SW[i % SW.length] })) })
    let prev = []
    lv.forEach((names, l) => {
      const ids = names.map((nm, i) => {
        const iid = `${cid}:${nm}`
        S.items.push({ id: iid, category: cid, name: nm, column: `${cid}_s${l}`, icon: null, desc: '', groups: prev.length ? [{ mode: i % 3 === 2 && prev.length > 1 ? 'at_least' : 'all', n: 1, ids: i % 3 === 2 && prev.length > 1 ? prev : [prev[i % prev.length]] }] : [], sort: s++ })
        return iid
      })
      if (l < RANKS.length) S.rules.push({ category: cid, rank: RANKS[l][0], items: ids, minGrade: RANKS[l][3] })
      prev = ids
    })
  }
  staged('cad', 'שרטוט', 'team', 'cad', 'pencil-ruler', 1, 'פיצ׳ר אהוב')
  staged('software', 'תוכנה', 'team', 'software', 'code', 3, 'שפה אהובה')
  staged('cnc', 'CNC', 'special', null, 'factory', 20, 'דבר אהוב')
  // a believable spread of progress for the mock people (all invented)
  const t0 = Date.UTC(2026, 8, 6)
  const leadOf = (team) => people.find((p) => p.position === 'team_lead' && p.team === team && p.status === 'active')?.id ?? people.find((p) => p.position === 'mentor')?.id
  for (const p of people) {
    if (p.position === 'mentor' || !p.team || p.status === 'pending' || p.status === 'rejected') continue
    const list = S.items.filter((i) => i.category === p.team)
    const share = { team_lead: 0.85, captain: 0.9, member: 0.45, rookie: 0.15 }[p.position] ?? 0.3
    const k = Math.round(list.length * share * (0.7 + (hash(p.id) % 30) / 100))
    list.slice(0, k).forEach((i, j) => {
      const at = new Date(t0 + (j * 3 + (hash(p.id) % 5)) * 864e5).toISOString()
      S.certs.push({ user: p.id, item: i.id, at, by: leadOf(p.team) === p.id ? people.find((x) => x.position === 'mentor')?.id : leadOf(p.team), teach: (p.position === 'team_lead' || p.position === 'captain') && j % 2 === 0, teachAt: at, early: false })
      if (j >= k - 2) S.events.push({ id: id('e'), at, by: leadOf(p.team), type: 'granted', user: p.id, category: p.team, item: i.id, text: null, early: false })
    })
    if (hash(p.id) % 3 === 0) S.favorites.push({ user: p.id, category: p.team, text: list[Math.min(2, list.length - 1)]?.name ?? '' })
  }
  const cnc = people.filter((p) => p.status === 'active' && p.team === 'build' && p.position !== 'rookie').slice(0, 3)
  cnc.forEach((p, j) => { S.access.push({ user: p.id, category: 'cnc' }); S.items.filter((i) => i.category === 'cnc').slice(0, 2 + j).forEach((i) => S.certs.push({ user: p.id, item: i.id, at: new Date(t0 + j * 864e5).toISOString(), by: null, teach: false, teachAt: null, early: false })) })
  const note = people.find((p) => p.team === 'build' && p.position === 'member' && p.status === 'active')
  if (note) S.events.push({ id: id('e'), at: '2026-11-12T16:40:00Z', by: leadOf('build'), type: 'note', user: note.id, category: 'build', item: null, text: 'עבד/ה יפה על השלדה. מוכן/ה להתחיל ללמוד מסור סרט.', early: false })
  S.events.sort((a, b) => b.at.localeCompare(a.at))
  return S
}

/**
 * One shared instance per page, so the tab and NeatSystem's profile page see
 * the same mock data. `ctx` = { me, people, can } of whoever is asking.
 */
let shared = null
export const sharedMemoryBackend = () => (shared ??= memoryBackend())

export function memoryBackend() {
  let S = null
  let ctx = null
  const host = () => { if (!ctx) throw new Error('mock backend used before any host'); return ctx }
  const people = () => host().people
  const M = () => buildModel({ ...S, perms: permsOf(host().me.id) }, people(), host().me.id)
  const permsOf = () => { const h = host(); return { certifyAll: h.can('trainings.certify_all'), editCatalog: h.can('trainings.edit_catalog'), manage: h.can('trainings.manage') } }
  const deny = (m = 'אין לך הרשאה לפעולה הזו') => { throw new Error(m) }
  const me = () => host().me
  const ev = (type, user, category, item = null, text = null, early = false) => S.events.unshift({ id: id('e'), at: now(), by: me().id, type, user, category, item, text, early })
  const itemCat = (iid) => S.items.find((i) => i.id === iid)?.category
  const needGrant = (cat) => { if (!M().canGrant(me(), cat)) deny() }
  const needCatalog = (cat) => { if (!M().canEditCatalog(me(), cat)) deny() }
  const needManage = (msg) => { if (!host().can('trainings.manage')) deny(msg) }
  const cur = (u, c) => S.current.find((r) => r.user === u && r.category === c)
  const syncRank = (u, c) => {
    const m = M(), r = cur(u, c)
    if (r?.manual || !m.isMember(u, c)) return
    const e = m.earned(m.person(u), c)?.id ?? null
    if (r && r.rank === e) return
    if (r) r.rank = e; else S.current.push({ user: u, category: c, rank: e, manual: false })
    if ((r?.rank ?? null) !== e || !r) ev('rank_auto', u, c, e)
  }
  const syncCat = (c) => { for (const u of new Set(S.certs.filter((x) => itemCat(x.item) === c).map((x) => x.user))) syncRank(u, c) }

  const fns = {
    grant({ p_user, p_item }) {
      const c = itemCat(p_item); if (!c) deny('הפריט לא קיים'); needGrant(c)
      if (p_user === me().id) deny('אי אפשר להסמיך את עצמך')
      if (!M().isMember(p_user, c)) deny('לא חבר/ה פעיל/ה בקטגוריה הזו')
      if (M().isHeld(p_user, p_item)) return
      const early = M().stateOf(p_user, M().item(p_item)) === 'locked'
      S.certs.push({ user: p_user, item: p_item, at: now(), by: me().id, teach: false, teachAt: null, early })
      ev('granted', p_user, c, p_item, null, early); syncRank(p_user, c)
    },
    revoke({ p_user, p_item }) {
      const c = itemCat(p_item); needGrant(c)
      const before = S.certs.length
      S.certs = S.certs.filter((x) => !(x.user === p_user && x.item === p_item))
      if (S.certs.length === before) return
      ev('revoked', p_user, c, p_item); syncRank(p_user, c)
    },
    set_teach({ p_user, p_item, p_on }) {
      const c = itemCat(p_item); needGrant(c)
      const r = S.certs.find((x) => x.user === p_user && x.item === p_item); if (!r) deny('קודם צריך להיות מוסמך/ת')
      if (r.teach === p_on) return
      r.teach = p_on; r.teachAt = now(); ev(p_on ? 'teach_granted' : 'teach_revoked', p_user, c, p_item)
    },
    add_note({ p_user, p_cat, p_text }) { needGrant(p_cat); if (!p_text?.trim()) deny('צריך טקסט'); ev('note', p_user, p_cat, null, p_text.trim()) },
    clear_log({ p_user }) { needManage('רק מנטור מנקה יומן'); const k = S.events.filter((e) => e.user === p_user).length; S.events = S.events.filter((e) => e.user !== p_user); ev('log_cleared', p_user, null, null, String(k)); return k },
    set_favorite({ p_user, p_cat, p_text }) {
      if (p_user !== me().id) needGrant(p_cat)
      S.favorites = S.favorites.filter((f) => !(f.user === p_user && f.category === p_cat))
      if (p_text?.trim()) S.favorites.push({ user: p_user, category: p_cat, text: p_text.trim().slice(0, 40) })
    },
    join({ p_user, p_cat }) {
      needGrant(p_cat)
      if (M().isMember(p_user, p_cat)) return
      if (M().person(p_user)?.position === 'mentor') deny('מנטורים לא חברים בקטגוריות')
      S.memberships = S.memberships.filter((m) => !(m.user === p_user && m.category === p_cat))
      S.memberships.push({ user: p_user, category: p_cat, kind: 'extra', active: true, joinedAt: now() })
      ev('joined', p_user, p_cat); syncRank(p_user, p_cat)
    },
    set_active({ p_user, p_cat, p_active }) {
      needGrant(p_cat)
      const m = S.memberships.find((x) => x.user === p_user && x.category === p_cat)
      if (!p_active) { if (m) m.active = false; else S.memberships.push({ user: p_user, category: p_cat, kind: 'paused', active: false, joinedAt: now() }) }
      else if (m?.kind === 'paused') S.memberships = S.memberships.filter((x) => x !== m)
      else if (m) m.active = true
      ev(p_active ? 'reactivated' : 'deactivated', p_user, p_cat)
      if (p_active) syncRank(p_user, p_cat)
    },
    set_rank({ p_user, p_cat, p_rank }) {
      needGrant(p_cat)
      const r = cur(p_user, p_cat), old = r?.rank ?? null
      if (r) Object.assign(r, { rank: p_rank, manual: true }); else S.current.push({ user: p_user, category: p_cat, rank: p_rank, manual: true })
      ev('rank_set', p_user, p_cat, p_rank, old)
    },
    set_auto({ p_user, p_cat }) { needGrant(p_cat); const r = cur(p_user, p_cat); if (r) r.manual = false; ev('auto_rank_on', p_user, p_cat); syncRank(p_user, p_cat) },
    set_requirement({ p_cat, p_rank, p_items, p_min_grade }) {
      needCatalog(p_cat)
      for (const r of S.rules) if (r.category === p_cat && r.rank !== p_rank) r.items = r.items.filter((x) => !p_items.includes(x))
      const r = S.rules.find((x) => x.category === p_cat && x.rank === p_rank)
      if (r) Object.assign(r, { items: [...p_items], minGrade: p_min_grade }); else S.rules.push({ category: p_cat, rank: p_rank, items: [...p_items], minGrade: p_min_grade })
      ev('ladder_updated', null, p_cat, p_rank); syncCat(p_cat)
    },
    add_item({ p_cat, p_column, p_name, p_after }) {
      needCatalog(p_cat)
      const nm = p_name?.trim(); if (!nm) deny('צריך שם')
      if (S.items.some((i) => i.category === p_cat && i.name === nm)) deny('כבר קיים')
      if (!M().columnsOf(p_cat).some((c) => c.id === p_column)) deny('עמודה לא קיימת')
      const iid = id('i_')
      S.items.push({ id: iid, category: p_cat, name: nm, column: p_column, icon: null, desc: '', groups: p_after ? [{ mode: 'all', n: 1, ids: [p_after] }] : [], sort: Math.max(0, ...S.items.map((i) => i.sort)) + 1 })
      ev('item_created', null, p_cat, iid); return iid
    },
    update_item({ p_item, p_patch }) {
      const c = itemCat(p_item); needCatalog(c)
      const i = S.items.find((x) => x.id === p_item), old = i.name
      if (p_patch.column && !M().columnsOf(c).some((x) => x.id === p_patch.column)) deny('עמודה לא קיימת')
      if (p_patch.name?.trim()) i.name = p_patch.name.trim()
      if (p_patch.column) i.column = p_patch.column
      if (p_patch.desc !== undefined) i.desc = p_patch.desc
      if ('after' in p_patch) i.groups = p_patch.after && p_patch.after !== p_item && itemCat(p_patch.after) === c ? [{ mode: 'all', n: 1, ids: [p_patch.after] }] : []
      if (p_patch.name && old !== i.name) ev('item_renamed', null, c, p_item, old)
    },
    delete_item({ p_item }) {
      const c = itemCat(p_item); needCatalog(c)
      const nm = S.items.find((x) => x.id === p_item)?.name
      S.items = S.items.filter((x) => x.id !== p_item)
      S.certs = S.certs.filter((x) => x.item !== p_item)
      for (const r of S.rules) if (r.category === c) r.items = r.items.filter((x) => x !== p_item)
      for (const i of S.items) i.groups = i.groups.map((g) => ({ ...g, ids: g.ids.filter((x) => x !== p_item) })).filter((g) => g.ids.length)
      ev('item_deleted', null, c, null, nm); syncCat(c)
    },
    update_category({ p_cat, p_patch }) {
      needCatalog(p_cat)
      const c = S.categories.find((x) => x.id === p_cat)
      if (p_patch.columns) {
        if (!p_patch.columns.length || p_patch.columns.some((x) => !x.id || !x.he?.trim())) deny('עמודות לא תקינות')
        for (const i of S.items.filter((x) => x.category === p_cat && !p_patch.columns.some((col) => col.id === x.column))) fns.delete_item({ p_item: i.id })
        c.columns = p_patch.columns
      }
      for (const k of ['name', 'item_noun', 'item_noun_singular', 'favorite_label']) if (p_patch[k]?.trim()) c[k] = p_patch[k].trim()
      ev('category_updated', null, p_cat)
    },
    create_category({ p_name, p_team }) {
      needManage('רק מנטור יוצר קטגוריה')
      if (!p_name?.trim()) deny('צריך שם')
      const cid = p_team ?? id('x')
      if (S.categories.some((c) => c.id === cid)) deny('לצוות כבר יש קטגוריה')
      S.categories.push({ id: cid, name: p_name.trim(), kind: p_team ? 'team' : 'special', team: p_team ?? null, icon: 'award', sort: p_team ? 5 : 20, item_noun: 'הכשרות', item_noun_singular: 'הכשרה', favorite_label: 'דבר אהוב', columns: [{ id: 's0', he: STAGE[0], label: STAGE[0], header: SW[0] }] })
      ev('category_created', null, cid, null, p_name.trim()); return cid
    },
    set_approver({ p_cat, p_user, p_on }) {
      needManage('רק מנטור ממנה מאשרים')
      S.approvers = S.approvers.filter((a) => !(a.user === p_user && a.category === p_cat))
      if (p_on) S.approvers.push({ user: p_user, category: p_cat })
      ev(p_on ? 'approver_added' : 'approver_removed', p_user, p_cat)
    },
    set_locked({ p_cat, p_user, p_locked }) {
      needManage('רק מנטור נועל ופותח')
      S.locks = S.locks.filter((a) => !(a.user === p_user && a.category === p_cat))
      if (p_locked) S.locks.push({ user: p_user, category: p_cat })
      ev(p_locked ? 'lead_locked' : 'lead_unlocked', p_user, p_cat)
    },
    set_access({ p_cat, p_user, p_on }) {
      if (!host().can('trainings.manage') && !M().canGrant(me(), p_cat)) deny()
      if (S.categories.find((c) => c.id === p_cat)?.kind !== 'special') deny('רק להסמכה מיוחדת יש רשימת גישה')
      S.access = S.access.filter((a) => !(a.user === p_user && a.category === p_cat))
      if (p_on) S.access.push({ user: p_user, category: p_cat })
      ev(p_on ? 'joined' : 'deactivated', p_user, p_cat)
      if (p_on) syncRank(p_user, p_cat)
    },
  }

  const ensure = () => {
    if (S) return
    S = seed(people())
    for (const c of S.categories) for (const p of people()) if (p.status === 'active') syncRankQuiet(p.id, c.id)
  }
  // initial ranks without log noise
  const syncRankQuiet = (u, c) => { const m = M(); if (!m.isMember(u, c)) return; const e = m.earned(m.person(u), c)?.id ?? null; if (e) S.current.push({ user: u, category: c, rank: e, manual: false }) }

  return {
    mode: 'mock',
    use(c) { ctx = c; return this },
    async load() { ensure(); return structuredClone({ ...S, perms: permsOf() }) },
    async call(fn, args) {
      ensure()
      if (!fns[fn]) throw new Error(`unknown action ${fn}`)
      const before = structuredClone(S)
      try { return fns[fn](args) } catch (e) { S = before; throw e }
    },
    profile(uid, c) { if (c) ctx = c; ensure(); return profileBlocks(M(), uid) },
  }
}
