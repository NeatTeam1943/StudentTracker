import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, GraduationCap, Heart, History, Lock, Pencil, Phone, Plus, Presentation, Shield, X } from 'lucide-react'
import { Button, Card, Empty, Field, Input, PageHead, Select, Tabs, cx } from '@neatsystem/kit'
import { useTr } from '../model/store.jsx'
import { GATE_HE } from '../model/logic.js'
import { Confirm, Progress, RankMark, Teach, brand, badgeOf, fmtShort, roleLine, useGrant, wordmarkOf } from './common.jsx'

/* one held item as a chip (list view) */
function Chip({ uid, item, edit }) {
  const { M } = useTr()
  const r = M.rec(uid, item.id), g = useGrant(), state = M.stateOf(uid, item)
  if (!r) return edit ? (
    <button type="button" className="tchip ghost" onClick={() => g.grant(uid, item)} title={state === 'locked' ? 'עוד לא עמד/ה בדרישות — הסמכה תפתח את זה מוקדם' : 'הסמכה'}>
      {state === 'locked' && <Lock size={12} aria-hidden />}<span className="nm">{item.name}</span><Plus size={14} aria-hidden />
    </button>
  ) : null
  return (
    <div className={cx('tchip', edit && 'edit')} title={`הוסמך/ה ${fmtShort(r.at)}${r.by ? ` · ${M.nameOf(r.by)}` : ''}`}>
      {edit && <button type="button" className="tx" aria-label={`ביטול ההסמכה ל${item.name}`} onClick={() => g.revoke(uid, item)}><X size={14} /></button>}
      <span className="nm">{item.name}</span>
      <Teach on={r.teach} edit={edit} onChange={() => g.teach(uid, item, !r.teach)} label={`${item.name} — מלמד/ת אחרים`} />
    </div>
  )
}

/** List view: one column per category column (StudentTracker's tool columns). */
function Columns({ uid, catId, edit }) {
  const { M } = useTr()
  const cols = M.columnsOf(catId)
  return (
    <div>
      <nav className="chips" style={{ marginBottom: 12 }}>{cols.map((c) => {
        const its = M.itemsInColumn(catId, c.id)
        return <button type="button" key={c.id} className="chip" style={{ background: c.header, color: '#fff', borderColor: 'transparent' }} onClick={() => document.getElementById(`col-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{c.he} · {its.filter((m) => M.isHeld(uid, m.id)).length}/{its.length}</button>
      })}</nav>
      <div className="tcols">{cols.map((c) => (
        <section key={c.id} id={`col-${c.id}`} className="tcol" style={{ '--hdr': c.header }}>
          <h3>{c.label}</h3>
          <div className="tlist">
            {M.itemsInColumn(catId, c.id).map((m) => <Chip key={m.id} uid={uid} item={m} edit={edit} />)}
            {!edit && !M.itemsInColumn(catId, c.id).some((m) => M.isHeld(uid, m.id)) && <div className="cap cm" style={{ textAlign: 'center', padding: 8 }}>עוד אין</div>}
          </div>
        </section>
      ))}</div>
    </div>
  )
}

/* ---------------- deck view: the original slide, in the system's design ---------------- */
const SW = 1456, SH = 819
function Deck({ uid, catId, edit }) {
  const { M, me, act } = useTr()
  const ref = useRef(null)
  const [scale, setScale] = useState(0.5)
  const [note, setNote] = useState('')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / SW))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const u = M.person(uid), c = M.category(catId), cols = M.columnsOf(catId), rk = M.rankIn(uid, catId), g = useGrant()
  const n = Math.max(1, cols.length), colW = (912 - 9 * (n - 1)) / n
  const log = M.events({ user: uid, cat: catId })
  return (
    <div ref={ref} className="deckbox" style={{ height: SH * scale }}>
      <div className="deck" style={{ width: SW, height: SH, transform: `scale(${scale})` }}>
        <img src={brand.logo} alt="" className="dk-logo" />
        <div className="dk-title">פרופיל הסמכות והרשאות · {c.name}</div>
        {cols.map((col, i) => {
          const items = M.itemsInColumn(catId, col.id), shown = edit ? items : items.filter((m) => M.isHeld(uid, m.id))
          const step = Math.min(51.6, (640 - 90) / Math.max(1, shown.length)), h = Math.min(40, step - 6)
          const x = 22 + (n - 1 - i) * (colW + 9)
          return (
            <div key={col.id} className="dk-col" style={{ left: x, width: colW, '--hdr': col.header }}>
              <div className="dk-head" style={{ fontSize: Math.max(10, Math.min(14, colW / 13)) }}>{col.label}</div>
              {shown.map((m, k) => {
                const r = M.rec(uid, m.id)
                return (
                  <div key={m.id} className={cx('dk-chip', !r && 'ghost', edit && 'edit')} style={{ top: 70 + k * step, height: h, fontSize: Math.max(11, Math.min(16, colW / 11)) }}
                    onClick={edit ? () => (r ? g.revoke(uid, m) : g.grant(uid, m)) : undefined}>
                    {r && (edit || r.teach) && <button type="button" className={cx('teach', r.teach && 'on')} disabled={!edit} onClick={(e) => { e.stopPropagation(); g.teach(uid, m, !r.teach) }} aria-label="מלמד/ת"><img src={brand.teach} alt="" /></button>}
                    <span>{m.name}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
        <div className="dk-card">
          <div className="dk-name">{u.full_name}</div>
          <div className="dk-role">{roleLine(M, u)}</div>
          {rk && <><img className="dk-wm" src={wordmarkOf(rk)} alt="" /><img className="dk-badge" src={badgeOf(rk)} alt={rk.name} /></>}
          <div className="dk-div" />
          {u.phone && <div className="dk-f"><Phone size={22} aria-hidden /><b>טלפון:</b><span dir="ltr">{u.phone}</span></div>}
          <div className="dk-f"><GraduationCap size={22} aria-hidden /><b>שכבה:</b><span>{M.gradeLabel(u) || '—'}</span></div>
          <div className="dk-f"><Heart size={22} aria-hidden /><b>{c.favorite_label}:</b><span>{M.favoriteOf(uid, catId) || '—'}</span></div>
        </div>
        <div className="dk-log">
          <div className="row" style={{ marginBottom: 8 }}><b className="grow">יומן</b><span className="cm">{log.length} רשומות</span></div>
          {log.slice(0, edit ? 5 : 7).map((e) => <div key={e.id} className="dk-lr"><time>{fmtShort(e.at)}</time><span>{M.describe(e, false)}</span></div>)}
          {!log.length && <div className="cm">אין עדיין רישומים.</div>}
          {edit && M.canGrant(me, catId) && (
            <form className="row dk-note" onSubmit={async (e) => { e.preventDefault(); if (await act('add_note', { p_user: uid, p_cat: catId, p_text: note }, 'נוסף ליומן')) setNote('') }}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הערה…" /><Button type="submit" size="sm" variant="primary" disabled={!note.trim()}>הוספה</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- ranks on the person page ---------------- */
function Suggestion({ uid, catId }) {
  const { M, me, act } = useTr()
  const s = M.canGrant(me, catId) && M.suggestion(uid, catId)
  if (!s) return null
  return (
    <div className="notice"><RankMark rank={s.to} size={28} /><span className="grow">השלים/ה את כל הדרישות ל<b>{s.to.name}</b>.</span>
      <Button size="sm" variant="primary" onClick={() => act('set_rank', { p_user: uid, p_cat: catId, p_rank: s.to.id }, `קודם/ה ל${s.to.name}`)}>קידום ל{s.to.name}</Button></div>
  )
}
function NextRank({ uid, catId }) {
  const { M } = useTr()
  const nx = M.next(uid, catId)
  if (!nx) return null
  return (
    <Card>
      <div className="row"><RankMark rank={nx.rank} size={32} /><div className="w5 grow">הדרגה הבאה: {nx.rank.name}</div><span className="foot c2 tnum">{nx.have}/{nx.total}</span></div>
      <Progress value={nx.have} max={nx.total} warn={!nx.gradeOk} />
      {!nx.gradeOk && <div className="foot" style={{ color: 'var(--warning-text)' }}>{nx.missing.length ? 'הדרגה דורשת גם שכבה גבוהה יותר' : `הכל הושלם — נשאר רק לעלות לשכבה ${GATE_HE[nx.gradeNeeded]}`}</div>}
      {nx.missing.length > 0 && <div className="foot c2">חסר: {nx.missing.map((id) => M.item(id)?.name).join(', ')}</div>}
    </Card>
  )
}
function RankAdmin({ uid, catId }) {
  const { M, act } = useTr()
  const manual = M.isManual(uid, catId), cur = M.rankIn(uid, catId)
  return (
    <div>
      <div className="row wrap">
        <span className="w5">דרגה</span>
        <Tabs label="מצב דרגה" value={manual ? 'manual' : 'auto'} onChange={(x) => (x === 'auto' ? act('set_auto', { p_user: uid, p_cat: catId }, 'חזר לאוטומטי') : act('set_rank', { p_user: uid, p_cat: catId, p_rank: cur?.id ?? null }, 'מעכשיו ידני'))} items={[{ id: 'auto', label: 'אוטומטי' }, { id: 'manual', label: 'ידני' }]} />
        <Select style={{ maxWidth: 200 }} disabled={!manual} value={cur?.id ?? ''} onChange={(e) => act('set_rank', { p_user: uid, p_cat: catId, p_rank: e.target.value || null }, 'הדרגה נקבעה')} aria-label="דרגה">
          <option value="">ללא דרגה</option>
          {M.ranks().filter((r) => r.id !== 'nitmentor').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </div>
    </div>
  )
}

/* ---------------- the person page (StudentTracker profile) ---------------- */
export function PersonPage() {
  const { id } = useParams()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const { M, me, act, to } = useTr()
  const u = M.person(id)
  const cats = u ? M.categoriesOf(id) : []
  const catId = (sp.get('cat') && M.category(sp.get('cat')) ? sp.get('cat') : null) ?? M.teamCategory(u?.team)?.id ?? cats[0]?.id
  const [view, setView] = useState(() => (window.innerWidth < 760 ? 'list' : 'deck'))
  const [edit, setEdit] = useState(false)
  const [note, setNote] = useState('')
  const [clear, setClear] = useState(false)
  const [joinTo, setJoinTo] = useState('')
  const [linkTo, setLinkTo] = useState('')
  if (!u) return <div className="page"><PageHead title="לא נמצא" back={{ fallback: to('/'), label: 'הכשרות' }} /><Empty icon={Shield} title="אין כאן אף אחד">ייתכן שהחשבון בארכיון או שאין לך הרשאה לראות אותו.</Empty></div>
  const c = catId && M.category(catId), mem = c && M.membership(id, catId), can = c && M.canGrant(me, catId) && me.id !== id
  return (
    <div className="page">
      <PageHead title={u.full_name} back={{ fallback: to(`/?cat=${catId ?? ''}&view=roster`), label: 'הכשרות' }}
        sub={<>{c?.name ?? 'ללא קטגוריה'} · {roleLine(M, u)}{!u.legacy && <> · <Link to={`/people/${id}`}>לפרופיל המלא</Link></>}</>} />
      {u.legacy && (
        <div className="notice info" style={{ marginBottom: 12 }}>
          <span className="grow">מ-StudentTracker, עוד לא משויך/ת ל-NeatSystem</span>
          {M.canManage() && <>
            <Select aria-label="שיוך ל" style={{ maxWidth: 220, minHeight: 36 }} value={linkTo} onChange={(e) => setLinkTo(e.target.value)}>
              <option value="">שיוך ל…</option>
              {M.people().filter((p) => p.status === 'active').map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </Select>
            <Button size="sm" variant="primary" disabled={!linkTo} onClick={async () => { if (await act('link_legacy', { p_legacy: id, p_user: linkTo }, 'שויך/ה')) nav(to(`/p/${linkTo}`)) }}>שיוך</Button>
          </>}
        </div>
      )}
      {cats.length > 1 && (
        <div className="chips" style={{ marginBottom: 12 }}>{cats.map((x) => {
          const r = M.rankIn(id, x.id), off = !M.isMember(id, x.id)
          return <button type="button" key={x.id} className={cx('chip', x.id === catId && 'on')} style={{ opacity: off ? 0.6 : 1 }} onClick={() => setSp({ cat: x.id })}><RankMark rank={r} size={20} />{x.name}{r ? ` · ${r.name}` : ''}{off ? ' (לא פעיל)' : ''}</button>
        })}</div>
      )}
      {!c || !mem ? (
        <Card><Empty icon={Shield} title={c ? `לא חבר/ה ב${c.name}` : 'עוד לא שויך/ה לאף קטגוריה'}>
          {can && c && c.kind === 'team' && <Button variant="primary" onClick={() => act('join', { p_user: id, p_cat: catId }, 'צורף/ה')}>צירוף ל{c.name}</Button>}
        </Empty></Card>
      ) : <>
        {!mem.active && (
          <div className="notice warn"><span className="grow">לא פעיל/ה ב{c.name}. הדרגה וההסמכות נשמרו, ועדיין אפשר ללמד את מה שהוסמך/ה ללמד.</span>
            {can && mem.kind !== 'former' && <Button size="sm" onClick={() => act('set_active', { p_user: id, p_cat: catId, p_active: true }, 'חזר/ה לפעילות')}>החזרה לפעילות</Button>}</div>
        )}
        <Suggestion uid={id} catId={catId} />
        <div className="row wrap" style={{ margin: '12px 0' }}>
          <Tabs label="תצוגה" value={view} onChange={setView} items={[{ id: 'deck', label: 'כרטיס' }, { id: 'list', label: 'רשימה' }]} />
          {can && mem.active && <Button size="sm" variant={edit ? 'primary' : 'tint'} icon={edit ? Check : Pencil} onClick={() => setEdit(!edit)}>{edit ? 'סיום עריכה' : 'עריכת הסמכות'}</Button>}
          {edit && <span className="foot c2"><img src={brand.teach} alt="" width={14} style={{ verticalAlign: 'middle' }} /> = מלמד/ת אחרים · <Lock size={12} /> = לפני הדרישות</span>}
        </div>
        {view === 'deck' ? <Deck uid={id} catId={catId} edit={edit} /> : (
          <div className="tpgrid">
            <div className="stack">
              <Card className="idcard">
                <div className="row top">
                  <div className="grow"><div className="h2">{u.full_name}</div><div className="c2">{roleLine(M, u)}</div></div>
                  {M.rankIn(id, catId) && <div style={{ textAlign: 'center' }}><RankMark rank={M.rankIn(id, catId)} size={64} /><img src={wordmarkOf(M.rankIn(id, catId))} alt="" style={{ height: 22, display: 'block', margin: '4px auto 0' }} /></div>}
                </div>
                <div className="list" style={{ marginTop: 8 }}>
                  {u.phone && <div className="lrow"><Phone size={18} aria-hidden /><span className="c2">טלפון</span><span className="grow" dir="ltr" style={{ textAlign: 'end' }}>{u.phone}</span></div>}
                  <div className="lrow"><Heart size={18} aria-hidden /><span className="c2">{c.favorite_label}</span><span className="grow" style={{ textAlign: 'end' }}>{M.favoriteOf(id, catId) || '—'}</span></div>
                  <div className="lrow"><Presentation size={18} aria-hidden /><span className="c2">מלמד/ת</span><span className="grow" style={{ textAlign: 'end' }}>{M.teachCount(id, catId)} {c.item_noun}</span></div>
                </div>
              </Card>
              <NextRank uid={id} catId={catId} />
            </div>
            <Columns uid={id} catId={catId} edit={edit} />
          </div>
        )}
        {can && (
          <Card title={<span className="row"><Shield size={18} aria-hidden />ניהול</span>} className="b" style={{ marginTop: 16 }}>
            <div className="stack">
              <RankAdmin uid={id} catId={catId} />
              <Field label={c.favorite_label}>{(fid) => <Input id={fid} key={id + catId} defaultValue={M.favoriteOf(id, catId)} maxLength={40}
                onBlur={(e) => e.target.value.trim() !== M.favoriteOf(id, catId) && act('set_favorite', { p_user: id, p_cat: catId, p_text: e.target.value.trim() }, 'נשמר')} />}</Field>
              <Field label="הערה ליומן">{(fid) => (
                <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await act('add_note', { p_user: id, p_cat: catId, p_text: note }, 'נוסף ליומן')) setNote('') }}>
                  <Input id={fid} value={note} onChange={(e) => setNote(e.target.value)} placeholder="מה קרה, מה לזכור…" /><Button type="submit" variant="primary" disabled={!note.trim()}>הוספה</Button>
                </form>
              )}</Field>
              <Field label="קטגוריות נוספות">{(fid) => (
                <div className="row wrap">
                  <Select id={fid} style={{ maxWidth: 220 }} value={joinTo} onChange={(e) => setJoinTo(e.target.value)}>
                    <option value="">בחירה…</option>
                    {M.categories().filter((x) => x.id !== catId && M.canGrant(me, x.id) && !M.isMember(id, x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </Select>
                  <Button disabled={!joinTo} onClick={async () => {
                    const x = M.category(joinTo)
                    if (await act(x.kind === 'special' ? 'set_access' : 'join', x.kind === 'special' ? { p_cat: joinTo, p_user: id, p_on: true } : { p_user: id, p_cat: joinTo }, 'צורף/ה בנוסף')) { setSp({ cat: joinTo }); setJoinTo('') }
                  }}>צירוף בנוסף</Button>
                  {mem.active && <Button variant="ghost" onClick={() => act('set_active', { p_user: id, p_cat: catId, p_active: false }, `סומן/ה כלא פעיל/ה ב${c.name}`)}>סימון כלא פעיל/ה כאן</Button>}
                </div>
              )}</Field>
              <div className="row wrap">
                <Button size="sm" variant="ghost" icon={History} onClick={() => nav(to(`/?cat=${catId}&view=log&person=${id}`))}>היסטוריה</Button>
                {M.canManage() && <Button size="sm" variant="danger" onClick={() => setClear(true)}>ניקוי יומן</Button>}
              </div>
            </div>
          </Card>
        )}
      </>}
      {clear && <Confirm danger title={`לנקות את היומן של ${u.full_name}?`} text="ההסמכות והדרגה לא ישתנו, אבל ההיסטוריה וההערות יימחקו לצמיתות." ok="ניקוי" onOk={() => act('clear_log', { p_user: id }, 'היומן נוקה')} onClose={() => setClear(false)} />}
    </div>
  )
}
