import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Award, Columns3, Trash2, UserCheck, Wrench } from 'lucide-react'
import { Avatar, Button, Card, Chips, Empty, Field, IconButton, Input, PageHead, Select, Switch, Tabs, cx } from '@neatsystem/kit'
import { useTr } from '../model/store.jsx'
import { GATE_HE } from '../model/logic.js'
import { Confirm, RankMark, wordmarkOf } from './common.jsx'

const SWATCHES = ['#747474', '#002060', '#12501B', '#7F340D', '#5E0202', '#3B2A6B', '#0E7490', '#6D6D6D']
const blurSave = (cur, save) => (e) => { const v = e.target.value.trim(); if (v && v !== cur) save(v) }

function useEditable() {
  const { M, me } = useTr()
  return M.categories().filter((c) => M.canEditCatalog(me, c.id))
}

/* ---------------- items (StudentTracker "ניהול כלים") ---------------- */
function Items() {
  const { M, act } = useTr()
  const cats = useEditable()
  const [cat, setCat] = useState(cats[0]?.id)
  const [draft, setDraft] = useState({ column: '', name: '', after: '' })
  const [del, setDel] = useState(null)
  if (!cat) return <Empty icon={Wrench} title="אין קטגוריות שאת/ה עורך/ת" />
  const c = M.category(cat), cols = M.columnsOf(cat), col = draft.column || cols[0]?.id
  const items = M.itemsOf(cat)
  return (
    <div className="stack">
      <Chips label="קטגוריה" value={cat} onChange={(x) => { setCat(x); setDraft({ column: '', name: '', after: '' }) }} items={cats.map((x) => ({ id: x.id, label: x.name }))} />
      <Card className="b" title={`הוספת ${c.item_noun_singular}`}>
        <form className="row wrap" onSubmit={async (e) => { e.preventDefault(); if (await act('add_item', { p_cat: cat, p_column: col, p_name: draft.name, p_after: draft.after || null }, 'נוסף')) setDraft({ ...draft, name: '' }) }}>
          <Select style={{ maxWidth: 180 }} value={col} onChange={(e) => setDraft({ ...draft, column: e.target.value })} aria-label="עמודה">{cols.map((x) => <option key={x.id} value={x.id}>{x.he}</option>)}</Select>
          <Input style={{ maxWidth: 220 }} placeholder={`שם ה${c.item_noun_singular}`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Select style={{ maxWidth: 220 }} value={draft.after} onChange={(e) => setDraft({ ...draft, after: e.target.value })} aria-label="דרישה קודמת">
            <option value="">בלי דרישה קודמת</option>{items.map((m) => <option key={m.id} value={m.id}>נפתח אחרי {m.name}</option>)}
          </Select>
          <Button type="submit" variant="primary" disabled={!draft.name.trim()}>הוספה</Button>
        </form>
      </Card>
      {cols.map((x) => (
        <Card className="b" key={x.id} title={<span className="row"><span className="swatch" style={{ background: x.header }} />{x.he}</span>}>
          <div className="tablewrap"><table className="table"><thead><tr><th>{c.item_noun_singular}</th><th>מוסמכים</th><th>עמודה</th><th>נפתח אחרי</th><th /></tr></thead><tbody>
            {M.itemsInColumn(cat, x.id).map((m) => (
              <tr key={m.id} style={{ cursor: 'default' }}>
                <td><Input style={{ minHeight: 36 }} key={m.id + m.name} defaultValue={m.name} aria-label="שם" onBlur={blurSave(m.name, (v) => act('update_item', { p_item: m.id, p_patch: { name: v } }, 'השם שונה'))} /></td>
                <td className="tnum">{M.holdersOf(m.id).length}</td>
                <td><Select style={{ minHeight: 36, maxWidth: 170 }} value={m.column} aria-label="עמודה" onChange={(e) => act('update_item', { p_item: m.id, p_patch: { column: e.target.value } }, 'הועבר')}>{cols.map((y) => <option key={y.id} value={y.id}>{y.he}</option>)}</Select></td>
                <td><Select style={{ minHeight: 36, maxWidth: 190 }} aria-label="דרישה קודמת" value={m.groups?.length === 1 && m.groups[0].ids.length === 1 && m.groups[0].mode === 'all' ? m.groups[0].ids[0] : m.groups?.length ? '__complex' : ''}
                  onChange={(e) => e.target.value !== '__complex' && act('update_item', { p_item: m.id, p_patch: { after: e.target.value || null } }, 'עודכן')}>
                  <option value="">—</option>{m.groups?.length > 1 || (m.groups?.[0] && (m.groups[0].ids.length > 1 || m.groups[0].mode !== 'all')) ? <option value="__complex">כמה דרישות</option> : null}
                  {items.filter((o) => o.id !== m.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select></td>
                <td><IconButton icon={Trash2} label="מחיקה" onClick={() => setDel(m)} /></td>
              </tr>
            ))}
          </tbody></table></div>
        </Card>
      ))}
      {del && <Confirm danger title={`למחוק את ${del.name}?`} text={M.holdersOf(del.id).length ? `${del.name} מוסמך אצל ${M.holdersOf(del.id).length} אנשים. המחיקה תסיר את ההסמכה מכולם ומסולם הדרגות.` : 'אין מוסמכים. הפריט יוסר גם מסולם הדרגות.'} ok="מחיקה" onOk={() => act('delete_item', { p_item: del.id }, 'נמחק')} onClose={() => setDel(null)} />}
    </div>
  )
}

/* ---------------- categories & columns (StudentTracker "צוותים") ---------------- */
function Categories() {
  const { M, me, host, act } = useTr()
  const cats = useEditable()
  const [cat, setCat] = useState(cats[0]?.id)
  const [col, setCol] = useState('')
  const [del, setDel] = useState(null)
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const c = M.category(cat)
  const save = (patch, ok = 'נשמר') => act('update_category', { p_cat: cat, p_patch: patch }, ok)
  const cols = c?.columns ?? []
  const setCols = (next, ok) => save({ columns: next }, ok)
  const missingTeams = host.teams.filter((t) => t.kind === 'team' && !M.teamCategory(t.id))
  return (
    <div className="stack">
      {c ? <>
        <Chips label="קטגוריה" value={cat} onChange={setCat} items={cats.map((x) => ({ id: x.id, label: x.name }))} />
        <Card className="b" title={`${c.name} — הגדרות`}>
          <div className="formgrid two">
            {[['name', 'שם'], ['item_noun', 'איך קוראים לפריטים (רבים)'], ['item_noun_singular', 'יחיד'], ['favorite_label', 'שורת ה"אהוב" בכרטיס']].map(([k, label]) => (
              <Field key={k} label={label}>{(fid) => <Input id={fid} key={cat + k + c[k]} defaultValue={c[k]} onBlur={blurSave(c[k], (v) => save({ [k]: v }))} />}</Field>
            ))}
          </div>
        </Card>
        <Card className="b" title="עמודות">
          <div className="list">{cols.map((x, i) => (
            <div key={x.id} className="lrow">
              <Select aria-label="צבע" value={x.header} onChange={(e) => setCols(cols.map((y) => (y.id === x.id ? { ...y, header: e.target.value } : y)))} style={{ width: 56, minHeight: 36, background: x.header, color: 'transparent' }}>
                {SWATCHES.map((s) => <option key={s} value={s} style={{ background: s, color: '#fff' }}>{s}</option>)}
              </Select>
              <Input style={{ maxWidth: 220, minHeight: 36 }} key={x.id + x.he} defaultValue={x.he} aria-label="שם העמודה"
                onBlur={blurSave(x.he, (v) => setCols(cols.map((y) => (y.id === x.id ? { ...y, he: v, label: /[a-z]/i.test(v) ? v.toUpperCase() : v } : y))))} />
              <span className="grow cap cm">{M.itemsInColumn(cat, x.id).length} פריטים</span>
              <IconButton icon={ArrowUp} label="למעלה" disabled={i === 0} onClick={() => { const n = [...cols]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setCols(n) }} />
              <IconButton icon={ArrowDown} label="למטה" disabled={i === cols.length - 1} onClick={() => { const n = [...cols]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setCols(n) }} />
              <IconButton icon={Trash2} label="מחיקה" disabled={cols.length === 1} onClick={() => setDel(x)} />
            </div>
          ))}</div>
          <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (col.trim()) setCols([...cols, { id: `c${Date.now().toString(36)}`, he: col.trim(), label: col.trim(), header: SWATCHES[cols.length % SWATCHES.length] }], 'נוספה'); setCol('') }}>
            <Input style={{ maxWidth: 240 }} value={col} onChange={(e) => setCol(e.target.value)} placeholder="עמודה חדשה" /><Button type="submit">הוספה</Button>
          </form>
        </Card>
      </> : <Empty icon={Columns3} title="אין קטגוריות שאת/ה עורך/ת" />}
      {M.canManage() && (
        <Card className="b" title="קטגוריה חדשה">
          <div className="row wrap">
            <Input style={{ maxWidth: 220 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="שם" />
            <Select style={{ maxWidth: 220 }} value={team} onChange={(e) => setTeam(e.target.value)} aria-label="סוג">
              <option value="">הסמכה מיוחדת</option>{missingTeams.map((t) => <option key={t.id} value={t.id}>צוות {t.name}</option>)}
            </Select>
            <Button disabled={!name.trim()} onClick={async () => { const r = await act('create_category', { p_name: name, p_team: team || null }, 'נוצרה'); if (r) { setName(''); setTeam(''); if (typeof r === 'string') setCat(r) } }}>יצירה</Button>
          </div>
        </Card>
      )}
      {del && <Confirm danger title={`למחוק את העמודה ${del.he}?`} text={`${M.itemsInColumn(cat, del.id).length} הפריטים שבה יימחקו גם הם, כולל ההסמכות עליהם.`} ok="מחיקה" onOk={() => setCols(cols.filter((x) => x.id !== del.id), 'נמחקה')} onClose={() => setDel(null)} />}
      {!me && null}
    </div>
  )
}

/* ---------------- the ladder's requirements ---------------- */
function Rules() {
  const { M, act } = useTr()
  const cats = useEditable()
  const [cat, setCat] = useState(cats[0]?.id)
  const [open, setOpen] = useState('nit')
  const [pending, setPending] = useState(null)
  if (!cat) return <Empty icon={Award} title="אין קטגוריות שאת/ה עורך/ת" />
  const items = M.itemsOf(cat), cols = M.columnsOf(cat)
  const unassigned = items.filter((m) => !M.ownerOf(cat, m.id)).length
  const apply = (rankId, patch, msg) => {
    const req = M.requirement(cat, rankId)
    setPending({ rankId, items: patch.items ?? req.items, minGrade: 'minGrade' in patch ? patch.minGrade : req.minGrade, msg })
  }
  return (
    <div className="stack">
      <Chips label="קטגוריה" value={cat} onChange={setCat} items={cats.map((c) => ({ id: c.id, label: c.name }))} />
      {unassigned > 0 && <div className="foot" style={{ color: 'var(--warning-text)' }}>{unassigned} פריטים לא משויכים לאף דרגה</div>}
      {M.ranks().map((r) => {
        const req = M.requirement(cat, r.id)
        const holders = M.membersOf(cat).filter((x) => M.rankIn(x.id, cat)?.id === r.id).length
        return (
          <Card className="b" key={r.id}>
            <button type="button" className="row ruleshead" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
              <RankMark rank={r} size={36} /><img src={wordmarkOf(r)} alt={r.name} style={{ height: 22 }} /><span className="grow" />
              <span className="foot c2">{req.items.length} פריטים · {req.minGrade ? `שכבה ${GATE_HE[req.minGrade]}` : 'בלי שכבה'} · {holders} מחזיקים</span>
            </button>
            {open === r.id && (
              <div className="stack" style={{ marginTop: 12 }}>
                <div className="row wrap"><span className="w5">שכבה מינימלית</span>
                  <Select style={{ maxWidth: 220 }} value={req.minGrade ?? ''} onChange={(e) => apply(r.id, { minGrade: e.target.value ? +e.target.value : null }, 'השכבה עודכנה')} aria-label="שכבה מינימלית">
                    <option value="">ללא דרישת שכבה</option><option value="10">שכבה י' ומעלה</option><option value="11">שכבה יא' ומעלה</option><option value="12">שכבה יב'</option><option value="99">מנטורים בלבד</option>
                  </Select></div>
                {cols.map((col) => (
                  <div key={col.id}>
                    <div className="cap c2" style={{ marginBottom: 4 }}>{col.he}</div>
                    <div className="row wrap" style={{ gap: 6 }}>{M.itemsInColumn(cat, col.id).map((m) => {
                      const o = M.ownerOf(cat, m.id), mine = o === r.id
                      return (
                        <button type="button" key={m.id} className={cx('chip', mine && 'on')} disabled={o && !mine} title={o && !mine ? `שייך ל${M.rank(o).name}` : ''} style={o && !mine ? { opacity: 0.45 } : undefined}
                          onClick={() => apply(r.id, { items: mine ? req.items.filter((x) => x !== m.id) : [...req.items, m.id] }, mine ? `${m.name} הוסר מ${r.name}` : `${m.name} נוסף ל${r.name}`)}>
                          {m.name}{o && !mine ? ` · ${M.rank(o).name}` : ''}
                        </button>
                      )
                    })}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}
      {pending && <Confirm title="לעדכן את הסולם?" text="כל מי שבמצב אוטומטי יחושב מחדש. מי שיורד — לא מקבל התראה." ok="עדכון"
        onOk={() => act('set_requirement', { p_cat: cat, p_rank: pending.rankId, p_items: pending.items, p_min_grade: pending.minGrade }, pending.msg)} onClose={() => setPending(null)} />}
    </div>
  )
}

/* ---------------- who certifies (StudentTracker "הרשאות") ---------------- */
function Approvers() {
  const { M, act } = useTr()
  const [add, setAdd] = useState({})
  const [acc, setAcc] = useState({})
  const manage = M.canManage()
  const pos = { team_lead: 'רש"צ', captain: 'קפטן/ית', member: 'חבר/ת צוות' }
  return (
    <div className="stack">
      {M.categories().map((c) => (
        <Card className="b" key={c.id} title={c.name}>
          <div className="list">{M.approversOf(c.id).filter((x) => !M.isMentor(x) && !x.is_admin && x.position !== 'captain').map((x) => {
            const appointed = M.isAppointed(x, c.id), lead = x.position === 'team_lead' && x.team === c.team
            return (
              <div key={x.id} className="lrow">
                <Avatar name={x.full_name} src={x.avatar_url} size={32} />
                <div className="main2"><div className="ttl">{x.full_name}</div><div className="meta">{appointed ? 'מונה/תה' : pos[x.position]}{M.isLocked(x, c.id) ? ' · נעול/ה' : ''}</div></div>
                {manage && <><span className="foot c2">עריכה</span><Switch label={`עריכה — ${x.full_name}`} on={!M.isLocked(x, c.id)} onChange={(on) => act('set_locked', { p_cat: c.id, p_user: x.id, p_locked: !on }, on ? 'נפתח' : 'ננעל')} /></>}
                {manage && appointed && !lead && <Button size="sm" variant="ghost" onClick={() => act('set_approver', { p_cat: c.id, p_user: x.id, p_on: false }, 'הוסר')}>הסרה</Button>}
              </div>
            )
          })}</div>
          <div className="foot cm" style={{ margin: '6px 0' }}>+ כל המנטורים, הקפטנים והאדמינים</div>
          {manage && (
            <div className="row">
              <Select style={{ maxWidth: 240 }} value={add[c.id] ?? ''} onChange={(e) => setAdd({ ...add, [c.id]: e.target.value })} aria-label="מינוי">
                <option value="">מינוי מאשר/ת…</option>
                {M.people().filter((x) => x.status === 'active' && !M.isApprover(x, c.id)).map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
              </Select>
              <Button size="sm" disabled={!add[c.id]} onClick={async () => { if (await act('set_approver', { p_cat: c.id, p_user: add[c.id], p_on: true }, 'מונה/תה')) setAdd({ ...add, [c.id]: '' }) }}>מינוי</Button>
            </div>
          )}
          {c.kind === 'special' && (
            <div style={{ marginTop: 12 }}>
              <div className="w5">גישה להסמכה המיוחדת</div>
              <div className="row wrap" style={{ gap: 6, margin: '6px 0' }}>{M.people().filter((x) => M.hasAccess(x.id, c.id)).map((x) => (
                <span key={x.id} className="selchip">{x.full_name}{manage && <button type="button" aria-label={`הסרת ${x.full_name}`} onClick={() => act('set_access', { p_cat: c.id, p_user: x.id, p_on: false }, 'הוסר/ה')}>×</button>}</span>
              ))}</div>
              {manage && <div className="row">
                <Select style={{ maxWidth: 240 }} value={acc[c.id] ?? ''} onChange={(e) => setAcc({ ...acc, [c.id]: e.target.value })} aria-label="הוספת גישה">
                  <option value="">הוספת גישה…</option>
                  {M.people().filter((x) => x.status === 'active' && !M.isMentor(x) && !M.hasAccess(x.id, c.id)).map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
                </Select>
                <Button size="sm" disabled={!acc[c.id]} onClick={async () => { if (await act('set_access', { p_cat: c.id, p_user: acc[c.id], p_on: true }, 'נוסף/ה')) setAcc({ ...acc, [c.id]: '' }) }}>הוספה</Button>
              </div>}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

export function ManagePage() {
  const { to } = useTr()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('t') ?? 'items'
  return (
    <div className="page">
      <PageHead title="ניהול הכשרות" back={{ fallback: to('/'), label: 'הכשרות' }} />
      <Tabs label="ניהול" value={tab} onChange={(t) => setSp({ t })} items={[
        { id: 'items', label: 'פריטים', icon: Wrench },
        { id: 'cats', label: 'קטגוריות ועמודות', icon: Columns3 },
        { id: 'rules', label: 'סולם דרגות', icon: Award },
        { id: 'approvers', label: 'מאשרים והרשאות', icon: UserCheck },
      ]} />
      {tab === 'items' && <Items />}
      {tab === 'cats' && <Categories />}
      {tab === 'rules' && <Rules />}
      {tab === 'approvers' && <Approvers />}
    </div>
  )
}
