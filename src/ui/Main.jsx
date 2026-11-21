import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, IdCard, Sparkles, TrendingUp, UserPlus } from 'lucide-react'
import { Badge, Button, Card, Chips, Empty, PageHead, Select, Sheet, Switch, Tabs, Input, cx } from '@neatsystem/kit'
import { useTr } from '../model/store.jsx'
import { GATE_HE, STATE_HE } from '../model/logic.js'
import { Confirm, Node, Progress, RankMark, roleLine, useGrant, wordmarkOf, badgeOf } from './common.jsx'

/* ---------------- top of "שלי": my rank in this category ---------------- */
function Strip({ catId }) {
  const { M, me } = useTr()
  const [, setSp] = useSearchParams()
  if (M.isMentor(me) || !M.isMember(me.id, catId)) return null
  const r = M.rankIn(me.id, catId), nx = M.next(me.id, catId), c = M.category(catId)
  return (
    <button type="button" className="rankstrip" onClick={() => setSp({ cat: catId, view: 'ladder' })}>
      <RankMark rank={r ?? M.rank('nit')} size={56} />
      <div className="grow" style={{ textAlign: 'start' }}>
        <div className="row"><span className="h3">{r?.name ?? 'עוד אין דרגה'}</span>{r && <img src={wordmarkOf(r)} alt="" style={{ height: 20 }} />}</div>
        {nx ? <>
          <div className="foot c2">{nx.missing.length ? `חסרים ${nx.missing.length} ${c.item_noun} ל${nx.rank.name}` : `סיימת הכל ל${nx.rank.name} — נשאר רק לעלות שכבה (${GATE_HE[nx.gradeNeeded]})`}</div>
          <Progress value={nx.have} max={nx.total} />
        </> : <div className="foot c2">הדרגה הגבוהה ביותר בסולם הזה</div>}
      </div>
      <ChevronLeft size={22} className="cm" aria-hidden />
    </button>
  )
}

function Mine({ catId }) {
  const { M, me, to } = useTr()
  const nav = useNavigate()
  const next = M.nextToLearn(me.id).filter((i) => i.category === catId).slice(0, 6)
  return (
    <div className="stack">
      <Strip catId={catId} />
      <Card title={<span className="row"><Sparkles size={18} aria-hidden />מה אפשר ללמוד עכשיו</span>} more={<span className="foot c2">ההסמכה ניתנת ע״י הרש״צ בסדנה</span>}>
        {next.length ? <div className="list">{next.map((i) => {
          const t = M.teachersOf(i.id).filter((x) => x.id !== me.id)
          return (
            <button type="button" key={i.id} className="lrow click" onClick={() => nav(to(`/m/${i.id}`))}>
              <Node item={i} state="open" size={36} label={false} />
              <div className="main2" style={{ textAlign: 'start' }}><div className="ttl">{i.name}</div><div className="meta">{t.length ? `מלמדים: ${t.slice(0, 3).map((x) => x.full_name).join(', ')}` : 'עוד אין מי שמלמד — לשאול את הרש"צ'}</div></div>
              <ChevronLeft size={18} className="cm" aria-hidden />
            </button>
          )
        })}</div> : <div className="c2">אין כרגע פריטים פתוחים — כל הכבוד!</div>}
      </Card>
      <div><Button variant="tint" icon={IdCard} onClick={() => nav(to(`/p/${me.id}?cat=${catId}`))}>כרטיס ההסמכות שלי</Button></div>
    </div>
  )
}

/* ---------------- roster ---------------- */
function Suggestions({ catId }) {
  const { M, me, act, to } = useTr()
  const nav = useNavigate()
  if (!M.canGrant(me, catId)) return null
  const list = M.suggestionsIn(catId)
  if (!list.length) return null
  return (
    <Card title={<span className="row"><TrendingUp size={18} aria-hidden />מוכנים לקידום</span>}>
      <div className="foot c2" style={{ marginTop: -6, marginBottom: 6 }}>אנשים בדרגה ידנית שעמדו בדרישות. שום דבר לא זז עד שמישהו לוחץ.</div>
      <div className="list">{list.map(([u, s]) => (
        <div key={u.id} className="lrow">
          <RankMark rank={s.to} size={32} />
          <div className="main2"><button type="button" className="linkish ttl" onClick={() => nav(to(`/p/${u.id}?cat=${catId}`))}>{u.full_name}</button><div className="meta">השלים/ה את הדרישות ל{s.to.name}{s.from ? ` (כעת ${s.from.name})` : ''}</div></div>
          <Button size="sm" variant="primary" onClick={() => act('set_rank', { p_user: u.id, p_cat: catId, p_rank: s.to.id }, `${u.full_name} קודם/ה ל${s.to.name}`)}>קידום</Button>
        </div>
      ))}</div>
    </Card>
  )
}

const GROUPS = [[12, "שכבה יב'"], [11, "שכבה יא'"], [10, "שכבה י'"], [9, "שכבה ט'"], [8, "שכבה ח'"], [7, "שכבה ז'"], [13, 'בוגרים פעילים'], [0, 'בלי שנתון']]
function Roster({ catId }) {
  const { M, me, act, to } = useTr()
  const nav = useNavigate()
  const c = M.category(catId)
  const [arch, setArch] = useState(false)
  const [add, setAdd] = useState('')
  const all = M.membersOf(catId)
  const active = all.filter((u) => M.isMember(u.id, catId))
  const archive = all.filter((u) => !M.isMember(u.id, catId))
  const card = (u) => {
    const r = M.rankIn(u.id, catId), t = M.teachCount(u.id, catId)
    return (
      <button type="button" key={u.id} className="rcard" style={r ? { '--rc': r.color } : undefined} onClick={() => nav(to(`/p/${u.id}?cat=${catId}`))}>
        <RankMark rank={r} size={52} />
        <div className="grow" style={{ textAlign: 'start' }}>
          <div className="w5">{u.full_name}</div>
          {r && <div className="cap w7" style={{ color: r.color }}>{r.name}</div>}
          <div className="cap cm">{roleLine(M, u)} · {M.heldIn(u.id, catId).length} {c.item_noun}</div>
        </div>
        {t > 0 && <Badge tone="blue">מלמד/ת {t}</Badge>}
      </button>
    )
  }
  const g = (u) => { const x = M.grade(u); return x >= 7 && x <= 13 ? x : 0 }
  const addable = M.people().filter((u) => u.status === 'active' && !M.isMentor(u) && !M.membership(u.id, catId))
  return (
    <div className="stack">
      <div className="c2">{active.length} חברים · לחיצה על שם פותחת את כרטיס ההסמכות</div>
      <Suggestions catId={catId} />
      {GROUPS.map(([k, title]) => {
        const list = active.filter((u) => g(u) === k).sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'))
        return list.length ? <section key={k}><div className="ghead2"><span className="h3">{title}</span><span className="cap cm">{list.length}</span></div><div className="rgrid">{list.map(card)}</div></section> : null
      })}
      {!active.length && <Empty icon={UserPlus} title={`עוד אין חברים ב${c.name}`} />}
      {archive.length > 0 && (
        <section>
          <div className="ghead2"><span className="h3">ארכיון</span><span className="cap cm">{archive.length}</span><Button size="sm" variant="ghost" onClick={() => setArch(!arch)}>{arch ? 'הסתרה' : 'הצגה'}</Button></div>
          {arch && <><div className="foot c2" style={{ marginBottom: 8 }}>עברו צוות, סומנו כלא פעילים או עזבו. ההסמכות והדרגה שלהם כאן נשמרו.</div><div className="rgrid">{archive.map(card)}</div></>}
        </section>
      )}
      {M.canGrant(me, catId) && addable.length > 0 && (
        <div className="row wrap">
          <Select style={{ maxWidth: 280 }} value={add} onChange={(e) => setAdd(e.target.value)} aria-label="צירוף">
            <option value="">צירוף חבר/ה ל{c.name}…</option>
            {addable.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </Select>
          <Button disabled={!add} icon={UserPlus} onClick={async () => { if (await act(c.kind === 'special' ? 'set_access' : 'join', c.kind === 'special' ? { p_cat: catId, p_user: add, p_on: true } : { p_user: add, p_cat: catId }, 'צורף/ה')) setAdd('') }}>צירוף</Button>
        </div>
      )}
    </div>
  )
}

/* ---------------- map ---------------- */
function layout(M, items) {
  const by = new Map(items.map((m) => [m.id, m]))
  const hasGroups = items.some((m) => m.groups?.length)
  const depth = new Map()
  const d = (m) => {
    if (depth.has(m.id)) return depth.get(m.id)
    depth.set(m.id, 0)
    const v = !hasGroups ? M.levelOf(m) : m.groups.length ? 1 + Math.max(0, ...m.groups.flatMap((g) => g.ids).filter((i) => by.has(i)).map((i) => d(by.get(i)))) : 0
    depth.set(m.id, v)
    return v
  }
  items.forEach(d)
  const rows = []
  items.forEach((m) => (rows[depth.get(m.id)] ??= []).push(m))
  const dense = rows.filter(Boolean)
  const W = Math.max(...dense.map((r) => r.length), 1) * 104 + 40, pos = new Map()
  dense.forEach((r, y) => r.forEach((m, i) => pos.set(m.id, { x: W - (W - r.length * 104) / 2 - i * 104 - 52, y: 28 + y * 132 })))
  return { W, H: dense.length * 132 + 28, pos }
}
function Graph({ items, uid, onPick }) {
  const { M } = useTr()
  const { W, H, pos } = useMemo(() => layout(M, items), [M, items])
  const ref = useRef(null)
  useEffect(() => { const el = ref.current; if (el) el.scrollLeft = -(el.scrollWidth - el.clientWidth) / 2 }, [W])
  return (
    <div className="graph" ref={ref}><div style={{ width: W, height: H, position: 'relative', margin: '0 auto' }}>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
        {items.flatMap((m) => (m.groups ?? []).flatMap((g, gi) => g.ids.filter((i) => pos.has(i)).map((i) => {
          const a = pos.get(i), b = pos.get(m.id), y1 = a.y + 66, y2 = b.y - 2, my = (y1 + y2) / 2
          return <path key={m.id + gi + i} d={`M${a.x},${y1} C${a.x},${my} ${b.x},${my} ${b.x},${y2}`} fill="none" stroke={uid && M.isHeld(uid, i) ? 'var(--blue-300)' : 'var(--border-strong)'} strokeWidth="2" />
        })))}
      </svg>
      {items.map((m) => {
        const p = pos.get(m.id), g = m.groups?.find((x) => x.mode === 'at_least')
        return (
          <div key={m.id} style={{ position: 'absolute', left: p.x - 48, top: p.y }}>
            {g && <span className="atleast">{Math.min(g.n, g.ids.length)} מתוך {g.ids.length}</span>}
            <Node item={m} state={uid ? M.stateOf(uid, m) : 'open'} early={uid && M.rec(uid, m.id)?.early} onClick={() => onPick(m)} />
          </div>
        )
      })}
    </div></div>
  )
}
export const reqLine = (M, uid, g) => {
  const s = M.groupStatus(uid, g)
  return g.mode === 'all' ? `דרוש: ${g.ids.map((id) => `${M.item(id)?.name} ${M.isHeld(uid, id) ? '✓' : '✗'}`).join(' · ')}` : `לפחות ${s.need} מתוך ${g.ids.length}: ${s.met}/${s.need}`
}
function MapView({ catId }) {
  const { M, me, to } = useTr()
  const nav = useNavigate()
  const g = useGrant()
  const canG = M.canGrant(me, catId)
  const [who, setWho] = useState(M.isMember(me.id, catId) ? me.id : '')
  const [pick, setPick] = useState(null)
  const [list, setList] = useState(false)
  const items = M.itemsOf(catId)
  if (!items.length) return <Empty icon={Sparkles} title="אין עדיין פריטים בקטגוריה הזו" />
  const st = pick && who ? M.stateOf(who, pick) : null
  return (
    <div className="stack">
      <div className="row wrap">
        <span className="c2">המפה של</span>
        <Select style={{ maxWidth: 240 }} value={who} onChange={(e) => setWho(e.target.value)} aria-label="של מי המפה">
          <option value="">— בלי אדם (רק המבנה)</option>
          {M.membersOf(catId).filter((u) => M.isMember(u.id, catId)).map((u) => <option key={u.id} value={u.id}>{u.full_name}{u.id === me.id ? ' (אני)' : ''}</option>)}
        </Select>
        <span className="grow" /><span className="foot c2">רשימה</span><Switch label="רשימה" on={list} onChange={setList} />
      </div>
      <div className="foot c2">{who ? `${M.heldIn(who, catId).length}/${items.length} מוסמך/ת · ` : ''}{canG ? 'רש"צ יכול להסמיך גם פריט נעול — ככה פותחים משהו מוקדם.' : 'את ההסמכה נותן הרש"צ בסדנה.'}</div>
      {list ? (
        <div className="card list" style={{ padding: 8 }}>{items.map((m) => (
          <button type="button" key={m.id} className="lrow click" style={{ paddingInlineStart: 8 + Math.min(6, M.levelOf(m)) * 16 }} onClick={() => setPick(m)}>
            <Node item={m} state={who ? M.stateOf(who, m) : 'open'} size={36} label={false} />
            <div className="main2" style={{ textAlign: 'start' }}><div className="ttl">{m.name}</div><div className="meta">{who ? STATE_HE[M.stateOf(who, m)] : M.columnsOf(catId).find((c) => c.id === m.column)?.he}</div></div>
          </button>
        ))}</div>
      ) : <Graph items={items} uid={who} onPick={setPick} />}
      {pick && (
        <Sheet title={pick.name} sub={who ? `${M.nameOf(who)} · ${STATE_HE[st]}` : M.columnsOf(catId).find((c) => c.id === pick.column)?.he} onClose={() => setPick(null)}
          footer={<>
            {canG && who && who !== me.id && (st === 'held'
              ? <Button variant="danger" onClick={() => { g.revoke(who, pick); setPick(null) }}>ביטול הסמכה</Button>
              : <Button variant="primary" onClick={() => { g.grant(who, pick); setPick(null) }}>{st === 'locked' ? 'הסמכה (פתיחה מוקדמת)' : 'הסמכה'}</Button>)}
            <Button onClick={() => nav(to(`/m/${pick.id}`))}>פתיחה</Button>
          </>}>
          <div className="stack">
            <div className="row"><Node item={pick} state={st ?? 'open'} label={false} /><div className="grow c2">{pick.desc || 'עוד אין תיאור קצר.'}</div></div>
            {who && (pick.groups ?? []).map((gr, i) => <div key={i} className="foot c2">{reqLine(M, who, gr)}</div>)}
            {!(pick.groups ?? []).length && <div className="foot c2">פתוח לכולם — בלי דרישות קודמות</div>}
            <div className="foot c2">{M.holdersOf(pick.id).length} מוסמכים{M.teachersOf(pick.id).length ? ` · מלמדים: ${M.teachersOf(pick.id).map((x) => x.full_name).join(', ')}` : ''}</div>
          </div>
        </Sheet>
      )}
    </div>
  )
}

/* ---------------- ladder ---------------- */
function Ladder({ catId }) {
  const { M } = useTr()
  const [who, setWho] = useState('')
  const person = who && M.person(who)
  const cur = person && M.rankIn(who, catId)
  const R = M.ranks()
  return (
    <div className="stack">
      <div className="row wrap">
        <span className="c2">כל דרגה דורשת את שלה ואת כל מה שלפניה. הצגת ההתקדמות של</span>
        <Select style={{ maxWidth: 240 }} value={who} onChange={(e) => setWho(e.target.value)} aria-label="של מי">
          <option value="">הסולם בלבד</option>
          {M.membersOf(catId).filter((u) => M.isMember(u.id, catId)).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </Select>
      </div>
      <div className="ladder">{R.map((r) => {
        const req = M.requirement(catId, r.id), g = person && M.gap(person, catId, r.id)
        const reached = person && ((cur && R.indexOf(r) <= R.indexOf(cur)) || g.eligible)
        return (
          <div key={r.id} className={cx('tier', person && (reached ? 'reached' : 'locked'))} style={{ '--rc': r.color }}>
            <div className="gate cap">{req.minGrade ? `שכבה ${GATE_HE[req.minGrade]}` : ''}</div>
            <img src={wordmarkOf(r)} alt={r.name} className="twm" />
            <img src={badgeOf(r)} alt="" className="tbadge" />
            <div className="treqs">
              {req.items.map((id) => <span key={id} className={cx('rchip', person && !M.isHeld(who, id) && 'miss')}>{M.item(id)?.name}</span>)}
              {!req.items.length && <span className="cap cm">{req.minGrade ? (req.minGrade === 99 ? 'מנטורים בלבד' : 'ותק ושכבה') : 'טרם הוגדר'}</span>}
            </div>
          </div>
        )
      })}</div>
    </div>
  )
}

/* ---------------- log ---------------- */
const TONE = { revoked: 'danger', teach_revoked: 'warning', deactivated: 'warning', item_deleted: 'danger', note: 'brand', lead_locked: 'warning', log_cleared: 'danger' }
function LogView({ catId }) {
  const { M, me, act } = useTr()
  const [sp, setSp] = useSearchParams()
  const person = sp.get('person') ?? ''
  const [note, setNote] = useState('')
  const [clear, setClear] = useState(false)
  const rows = M.events({ cat: catId, user: person || undefined })
  return (
    <div className="stack">
      <div className="row wrap">
        <Select style={{ maxWidth: 260 }} value={person} onChange={(e) => setSp({ cat: catId, view: 'log', ...(e.target.value ? { person: e.target.value } : {}) })} aria-label="של מי">
          <option value="">כל חברי הקטגוריה</option>
          {M.membersOf(catId).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </Select>
        {person && M.canManage() && <Button size="sm" variant="danger" onClick={() => setClear(true)}>ניקוי היומן של {M.nameOf(person)}</Button>}
      </div>
      {person && M.canGrant(me, catId) && (
        <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await act('add_note', { p_user: person, p_cat: catId, p_text: note }, 'נוסף ליומן')) setNote('') }}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={`הערה על ${M.nameOf(person)}…`} />
          <Button type="submit" variant="primary" disabled={!note.trim()}>הוספה ליומן</Button>
        </form>
      )}
      <div className="card list" style={{ padding: 8 }}>
        {rows.length ? rows.slice(0, 150).map((e) => (
          <div key={e.id} className={cx('lrow', e.type === 'note' && 'isnote')}>
            <span className={`ldot ${TONE[e.type] ?? ''}`} />
            <div className="main2">
              <div className="ttl" style={{ fontWeight: e.type === 'note' ? 400 : 500 }}>{e.type === 'note' && <b>{M.nameOf(e.user)}: </b>}{M.describe(e)}</div>
              <div className="meta">{new Date(e.at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}{e.by ? ` · ${M.nameOf(e.by)}` : ''}</div>
            </div>
          </div>
        )) : <Empty icon={Sparkles} title="אין עדיין רישומים">כל הסמכה, הרשאת לימוד והערה יופיעו כאן</Empty>}
      </div>
      {clear && <Confirm danger title={`לנקות את היומן של ${M.nameOf(person)}?`} text="ההסמכות והדרגה לא ישתנו; ההיסטוריה וההערות יימחקו לצמיתות." ok="ניקוי" onOk={() => act('clear_log', { p_user: person }, 'נוקה')} onClose={() => setClear(false)} />}
    </div>
  )
}

/* ---------------- the tab's main screen ---------------- */
export function Main() {
  const { M, me, to } = useTr()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const cats = M.visibleCategories(me)
  const own = M.teamCategory(me.team)?.id
  const sorted = [...cats.filter((c) => c.id === own), ...cats.filter((c) => c.id !== own && c.kind === 'team'), ...cats.filter((c) => c.kind === 'special')]
  const cat = sp.get('cat') && M.category(sp.get('cat')) ? sp.get('cat') : sorted[0]?.id
  if (!cat) return <div className="page"><PageHead title="הכשרות" /><Empty icon={Sparkles} title="אין הכשרות שזמינות לך" /></div>
  const mine = M.isMember(me.id, cat)
  const view = sp.get('view') ?? (mine ? 'mine' : 'roster')
  const canManage = M.categories().some((c) => M.canEditCatalog(me, c.id)) || M.canManage()
  const sug = M.canGrant(me, cat) ? M.suggestionsIn(cat).length : 0
  return (
    <div className="page">
      <PageHead title="הכשרות" sub="הסמכות, דרגות והיסטוריה לכל צוות" actions={canManage && <Button variant="tint" onClick={() => nav(to('/manage'))}>ניהול</Button>} />
      <Chips label="קטגוריה" value={cat} onChange={(c) => setSp({ cat: c })} items={sorted.map((c) => ({ id: c.id, label: c.kind === 'special' ? `${c.name} · מיוחדת` : c.name }))} />
      <div style={{ height: 12 }} />
      <Tabs label="תצוגה" value={view} onChange={(v) => setSp({ cat, view: v })} items={[
        ...(mine ? [{ id: 'mine', label: 'שלי' }] : []),
        { id: 'roster', label: 'חברי הצוות', count: sug },
        { id: 'map', label: 'מפה' },
        { id: 'ladder', label: 'סולם הדרגות' },
        { id: 'log', label: 'יומן' },
      ]} />
      {view === 'mine' && <Mine catId={cat} />}
      {view === 'roster' && <Roster catId={cat} key={cat} />}
      {view === 'map' && <MapView catId={cat} key={cat} />}
      {view === 'ladder' && <Ladder catId={cat} key={cat} />}
      {view === 'log' && <LogView catId={cat} key={cat} />}
    </div>
  )
}
