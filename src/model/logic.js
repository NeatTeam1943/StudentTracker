/**
 * Trainings — read model. Pure functions over one snapshot of the state
 * (trainings_api.state() in Supabase mode, the in-memory store in mock mode)
 * plus NeatSystem's people. Mirrors the SQL in supabase/migrations: the SQL
 * decides, this only shows (and hides buttons the server would refuse).
 *
 * Words: a category is a team's trainings (בנייה, תוכנה…) or a special
 * certification (CNC). It has columns, columns have items. A person holds an
 * item (certified), may teach it, and has a rank per category.
 */
/** Israeli school grade (7..12) from graduation year — same as NeatSystem's labels.ts and trainings.grade_of(). */
export function gradeOf(gradYear, today = new Date()) {
  if (!gradYear) return null
  const yearEnd = today.getMonth() >= 8 ? today.getFullYear() + 1 : today.getFullYear()
  const g = 12 - (gradYear - yearEnd)
  return g >= 7 && g <= 12 ? g : null
}

export const STATE_HE = { locked: 'נעול', open: 'פתוח ללמידה', held: 'מוסמך/ת' }
export const GATE_HE = { 9: "ט'", 10: "י'", 11: "יא'", 12: "יב'", 99: 'מנטורים' }
export const ROLE_HE = { rookie: 'רוקי', member: 'חבר/ת צוות', team_lead: 'רש"צ', captain: 'קפטן/ית', mentor: 'מנטור/ית' }
const GRADE_HE = { 7: "ז'", 8: "ח'", 9: "ט'", 10: "י'", 11: "יא'", 12: "יב'" }

const by = (k) => (a, b) => (a[k] ?? 0) - (b[k] ?? 0)
const key = (u, x) => `${u}|${x}`

export function buildModel(S, hostPeople, meId) {
  // people imported from StudentTracker who haven't joined NeatSystem yet: regular
  // active members (same as trainings.person() in SQL) until a mentor links them (trainings.link_legacy)
  const legacy = (S.legacy ?? []).map((l) => ({ id: l.id, full_name: l.name, status: 'active', position: 'member', team: null, grad_year: null, is_admin: false, legacy: true }))
  const people = [...hostPeople, ...legacy]
  const P = new Map(people.map((p) => [p.id, p]))
  const cats = [...S.categories].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'he'))
  const catBy = new Map(cats.map((c) => [c.id, c]))
  const items = [...S.items].sort(by('sort'))
  const itemBy = new Map(items.map((i) => [i.id, i]))
  const certs = new Map(S.certs.map((c) => [key(c.user, c.item), c]))
  const mships = new Map(S.memberships.map((m) => [key(m.user, m.category), m]))
  const favs = new Map(S.favorites.map((f) => [key(f.user, f.category), f.text]))
  const access = new Set(S.access.map((a) => key(a.user, a.category)))
  const appointed = new Set(S.approvers.map((a) => key(a.user, a.category)))
  const locks = new Set(S.locks.map((a) => key(a.user, a.category)))
  const ranks = [...S.ranks].sort(by('sort'))
  const rankBy = new Map(ranks.map((r) => [r.id, r]))
  const rules = new Map(S.rules.map((r) => [key(r.category, r.rank), r]))
  const current = new Map(S.current.map((r) => [key(r.user, r.category), r]))
  const perms = S.perms ?? {}

  const person = (id) => P.get(id) ?? null
  const isMentor = (u) => u?.position === 'mentor'
  const isActive = (u) => u?.status === 'active'
  const nameOf = (id) => P.get(id)?.full_name ?? 'לא ידוע'
  const grade = (u) => (isMentor(u) ? 99 : u?.legacy ? 12 : gradeOf(u?.grad_year ?? null) ?? (u?.grad_year ? 13 : 0))
  const gradeLabel = (u) => (isMentor(u) ? 'מנטור/ית' : GRADE_HE[gradeOf(u?.grad_year ?? null)] ?? (u?.grad_year ? 'בוגר/ת' : ''))
  const me = P.get(meId) ?? null

  const M = {
    S, me, person, nameOf, isMentor, isActive, grade, gradeLabel, perms,
    legacy: () => legacy,
    people: () => hostPeople.filter((p) => p.status === 'active' || p.status === 'archived'),
    categories: () => cats,
    category: (id) => catBy.get(id) ?? null,
    teamCategory: (team) => cats.find((c) => c.kind === 'team' && c.team === team) ?? null,
    columnsOf: (catId) => catBy.get(catId)?.columns ?? [],
    item: (id) => itemBy.get(id) ?? null,
    itemsOf: (catId) => items.filter((i) => i.category === catId),
    itemsInColumn: (catId, col) => items.filter((i) => i.category === catId && i.column === col),
    rec: (u, i) => certs.get(key(u, i)) ?? null,
    isHeld: (u, i) => certs.has(key(u, i)),
    favoriteOf: (u, c) => favs.get(key(u, c)) ?? '',
    events: ({ user, cat } = {}) => S.events.filter((e) => (!user || e.user === user) && (!cat || e.category === cat)),
    rank: (id) => rankBy.get(id) ?? null,
    ranks: () => ranks,
  }
  M.heldIn = (u, catId) => M.itemsOf(catId).filter((i) => M.isHeld(u, i.id))
  M.heldCount = (u) => S.certs.filter((c) => c.user === u && itemBy.has(c.item)).length
  M.teachCount = (u, catId) => M.heldIn(u, catId).filter((i) => M.rec(u, i.id).teach).length
  M.holdersOf = (i) => S.certs.filter((c) => c.item === i).map((c) => P.get(c.user)).filter(Boolean)
  M.teachersOf = (i) => S.certs.filter((c) => c.item === i && c.teach).map((c) => P.get(c.user)).filter((u) => u && isActive(u))

  /** Same rules as trainings.membership() in SQL. */
  M.membership = (uid, catId) => {
    const u = P.get(uid), c = catBy.get(catId)
    if (!u || !c || isMentor(u)) return null
    const m = mships.get(key(uid, catId))
    if (m?.kind === 'paused' || (m && !m.active)) return { kind: m.kind, active: false }
    if (c.kind === 'team' && u.team === c.team) return { kind: 'team', active: isActive(u) }
    if (c.kind === 'special' && access.has(key(uid, catId))) return { kind: 'special', active: isActive(u) }
    if (m?.kind === 'extra') return { kind: 'extra', active: isActive(u) }
    if (M.heldIn(uid, catId).length) return { kind: 'former', active: false }
    return null
  }
  M.isMember = (uid, catId) => !!M.membership(uid, catId)?.active
  M.membersOf = (catId) => people.filter((u) => M.membership(u.id, catId))
  M.categoriesOf = (uid) => cats.filter((c) => M.membership(uid, c.id))
  M.hasAccess = (uid, catId) => access.has(key(uid, catId))

  /** Who certifies (SQL trainings.is_approver). For other people we only know position, not extra permissions. */
  const certifyAll = (u) => (u?.id === meId ? !!perms.certifyAll : isMentor(u) || u?.position === 'captain' || u?.is_admin)
  M.isApprover = (u, catId) => {
    const c = catBy.get(catId)
    if (!u || !c || !isActive(u)) return false
    return certifyAll(u) || appointed.has(key(u.id, catId)) || (c.kind === 'team' && u.position === 'team_lead' && u.team === c.team)
  }
  M.isAppointed = (u, catId) => appointed.has(key(u?.id, catId))
  M.approversOf = (catId) => people.filter((u) => M.isApprover(u, catId))
  M.isLocked = (u, catId) => !!u && locks.has(key(u.id, catId))
  M.canGrant = (u, catId) => M.isApprover(u, catId) && !M.isLocked(u, catId)
  M.canEditCatalog = (u, catId) => {
    const c = catBy.get(catId)
    if (!u || !c || !isActive(u)) return false
    if (u.id === meId && perms.editCatalog) return true
    return c.kind === 'team' && u.position === 'team_lead' && u.team === c.team && !M.isLocked(u, catId)
  }
  M.canManage = () => !!perms.manage
  M.visibleCategories = (u) => cats.filter((c) => c.kind === 'team' || M.canManage() || perms.certifyAll || M.membership(u?.id, c.id) || M.isApprover(u, c.id))

  /* prerequisites: held · open (met) · locked — a lead may still certify a locked item (early unlock) */
  const groupMet = (uid, g) => {
    const ids = (g.ids ?? []).filter((id) => itemBy.has(id))
    if (!ids.length) return true
    const met = ids.filter((id) => M.isHeld(uid, id)).length
    return g.mode === 'all' ? met === ids.length : met >= Math.min(g.n ?? 1, ids.length)
  }
  M.stateOf = (uid, i) => (M.isHeld(uid, i.id) ? 'held' : (i.groups ?? []).every((g) => groupMet(uid, g)) ? 'open' : 'locked')
  M.groupStatus = (uid, g) => ({ met: (g.ids ?? []).filter((id) => M.isHeld(uid, id)).length, need: g.mode === 'all' ? g.ids.length : Math.min(g.n ?? 1, g.ids.length), ...g })
  M.nextToLearn = (uid) => {
    const u = P.get(uid), own = M.teamCategory(u?.team)?.id, out = []
    for (const c of M.categoriesOf(uid)) if (M.isMember(uid, c.id)) for (const i of M.itemsOf(c.id)) if (M.stateOf(uid, i) === 'open') out.push(i)
    return out.sort((a, b) => (a.category === own ? 0 : 1) - (b.category === own ? 0 : 1) || M.levelOf(a) - M.levelOf(b) || a.sort - b.sort)
  }

  /* ranks — same walk as trainings.earned_rank() */
  M.requirement = (catId, rankId) => {
    const r = rules.get(key(catId, rankId))
    return { items: (r?.items ?? []).filter((id) => itemBy.has(id)), minGrade: r ? r.minGrade : null }
  }
  M.isConfigured = (catId, rankId) => { const r = M.requirement(catId, rankId); return r.items.length > 0 || r.minGrade != null }
  M.cumulative = (catId, rankId) => {
    const i = ranks.findIndex((r) => r.id === rankId)
    return i < 0 ? [] : ranks.slice(0, i + 1).flatMap((r) => M.requirement(catId, r.id).items)
  }
  M.ownerOf = (catId, itemId) => ranks.find((r) => M.requirement(catId, r.id).items.includes(itemId))?.id ?? null
  M.levelOf = (i) => { const o = M.ownerOf(i.category, i.id); return o ? ranks.findIndex((r) => r.id === o) : ranks.length }
  M.gap = (u, catId, rankId) => {
    const missing = M.cumulative(catId, rankId).filter((id) => !M.isHeld(u.id, id))
    const { minGrade } = M.requirement(catId, rankId)
    const gradeOk = minGrade == null || grade(u) >= minGrade
    const configured = M.isConfigured(catId, rankId)
    return { missing, gradeOk, configured, eligible: !missing.length && gradeOk && configured }
  }
  M.earned = (u, catId) => { let e = null; for (const r of ranks) { if (!M.gap(u, catId, r.id).eligible) break; e = r } return e }
  M.rankIn = (uid, catId) => (isMentor(P.get(uid)) ? rankBy.get('nitmentor') ?? null : rankBy.get(current.get(key(uid, catId))?.rank) ?? null)
  M.isManual = (uid, catId) => !!current.get(key(uid, catId))?.manual
  M.suggestion = (uid, catId) => {
    const u = P.get(uid)
    if (!u || !M.isManual(uid, catId) || !M.isMember(uid, catId)) return null
    const e = M.earned(u, catId), cur = M.rankIn(uid, catId)
    return e && ranks.indexOf(e) > (cur ? ranks.indexOf(cur) : -1) ? { from: cur, to: e } : null
  }
  M.suggestionsIn = (catId) => M.membersOf(catId).map((u) => [u, M.suggestion(u.id, catId)]).filter(([, s]) => s)
  M.next = (uid, catId) => {
    const u = P.get(uid), cur = M.rankIn(uid, catId)
    const nx = ranks[cur ? ranks.indexOf(cur) + 1 : 0]
    if (!u || !nx || !M.isConfigured(catId, nx.id) || isMentor(u)) return null
    const g = M.gap(u, catId, nx.id), req = M.cumulative(catId, nx.id)
    return { rank: nx, missing: g.missing, gradeOk: g.gradeOk, gradeNeeded: M.requirement(catId, nx.id).minGrade, have: req.length - g.missing.length, total: req.length }
  }
  M.teamRank = (uid) => { const u = P.get(uid); if (isMentor(u)) return rankBy.get('nitmentor'); const c = M.teamCategory(u?.team); return c ? M.rankIn(uid, c.id) : null }

  /** One log event as Hebrew. */
  M.describe = (e, withName = true) => {
    const who = withName && e.user ? nameOf(e.user) : ''
    const item = itemBy.get(e.item)?.name ?? e.text ?? ''
    const rk = (id) => rankBy.get(id)?.name ?? 'ללא דרגה'
    switch (e.type) {
      case 'note': return e.text
      case 'granted': return `${who} הוסמך/ה ל${item}${e.early ? ' (פתיחה מוקדמת)' : ''}`.trim()
      case 'revoked': return `בוטלה ההסמכה ${who ? `של ${who} ` : ''}ל${item}`
      case 'teach_granted': return `${who} מלמד/ת מעכשיו ${item}`.trim()
      case 'teach_revoked': return `${who} כבר לא מלמד/ת ${item}`.trim()
      case 'joined': return `${who} צורף/ה ל${catBy.get(e.category)?.name ?? ''}`.trim()
      case 'deactivated': return `${who} סומן/ה כלא פעיל/ה`.trim()
      case 'reactivated': return `${who} חזר/ה לפעילות`.trim()
      case 'rank_auto': return e.item ? `${who} עודכן/ה אוטומטית ל${rk(e.item)}`.trim() : `הדרגה של ${who} בוטלה אוטומטית`
      case 'rank_set': return `הדרגה של ${who} נקבעה ידנית ל${rk(e.item)}`
      case 'auto_rank_on': return `${who} — דרגה אוטומטית`.trim()
      case 'item_created': return `נוסף פריט: ${item}`
      case 'item_renamed': return `${e.text} שונה ל${item}`
      case 'item_deleted': return `נמחק הפריט ${e.text}`
      case 'ladder_updated': return 'סולם הדרגות עודכן'
      case 'category_updated': return 'הגדרות הקטגוריה עודכנו'
      case 'category_created': return `נוצרה קטגוריה: ${e.text}`
      case 'approver_added': return `${who} מונה/תה למאשר/ת`.trim()
      case 'approver_removed': return `${who} הוסר/ה מהמאשרים`.trim()
      case 'lead_locked': return `העריכה של ${who} ננעלה`
      case 'lead_unlocked': return `העריכה של ${who} נפתחה`
      case 'log_cleared': return `היומן של ${who} נוקה (${e.text} רשומות)`
      case 'imported_firestore': return 'יובאו הנתונים מ-StudentTracker'
      case 'legacy_linked': return `הרשומות של ${e.text} מ-StudentTracker שויכו ל${who}`
      case 'promoted': return `${who} קודם/ה ל${rk(e.item)}`
      case 'team_joined': return `${who} צורף/ה לצוות`.trim()
      default: return String(e.type ?? '').replace(/_/g, ' ')
    }
  }
  return M
}

/** The profile blocks NeatSystem shows (same shape as trainings_api.profile_v1). */
export function profileBlocks(M, uid) {
  const u = M.person(uid)
  if (!u) return { contract: 1, blocks: [] }
  const all = M.S.certs.filter((c) => c.user === uid && M.item(c.item))
  const team = M.teamCategory(u.team)
  const rank = M.isMentor(u) ? M.rank('nitmentor') : team ? M.rankIn(uid, team.id) : null
  if (!all.length && !rank) return { contract: 1, title: 'הכשרות', blocks: [] }
  const blocks = [{ kind: 'stats', items: [
    { label: 'דרגה', value: rank?.name ?? 'עוד אין' },
    { label: 'הסמכות', value: all.length },
    { label: 'מלמד/ת', value: all.filter((c) => c.teach).length },
  ] }]
  const nx = team && M.next(uid, team.id)
  if (nx && nx.total) blocks.push({ kind: 'progress', label: `ל${nx.rank.name}`, value: nx.have, max: nx.total, hint: nx.missing.length ? `עוד ${nx.missing.length} פריטים` : 'כל הפריטים הושלמו' })
  const cats = M.categoriesOf(uid)
  if (cats.length) blocks.push({ kind: 'chips', title: 'קטגוריות', items: cats.map((c) => ({ label: c.name + (M.rankIn(uid, c.id) ? ` · ${M.rankIn(uid, c.id).name}` : ''), tone: M.isMember(uid, c.id) ? 'brand' : 'muted' })) })
  const recent = [...all].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)
  if (recent.length) blocks.push({ kind: 'list', title: 'הסמכות אחרונות', items: recent.map((c) => ({ title: M.item(c.item).name, meta: M.category(M.item(c.item).category)?.name + (c.teach ? ' · מלמד/ת' : ''), at: c.at })) })
  return { contract: 1, title: 'הכשרות', link: `/trainings/p/${uid}`, blocks }
}
