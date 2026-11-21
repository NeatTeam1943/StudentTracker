import { useParams } from 'react-router-dom'
import { BadgeCheck, Sparkles } from 'lucide-react'
import { Avatar, Badge, Button, Card, Empty, PageHead, Switch } from '@neatsystem/kit'
import { useTr } from '../model/store.jsx'
import { STATE_HE } from '../model/logic.js'
import { Node, fmtShort, useGrant } from './common.jsx'
import { reqLine } from './Main.jsx'

/** One item: what it is, what it needs, who teaches it, and (for leads) certify from here. */
export function ItemPage() {
  const { id } = useParams()
  const { M, me, to } = useTr()
  const g = useGrant()
  const m = M.item(id)
  if (!m) return <div className="page"><PageHead title="לא נמצא" back={{ fallback: to('/'), label: 'הכשרות' }} /><Empty icon={Sparkles} title="הפריט לא נמצא" /></div>
  const c = M.category(m.category), member = M.isMember(me.id, c.id), st = member ? M.stateOf(me.id, m) : null
  const canG = M.canGrant(me, c.id)
  const holders = M.holdersOf(m.id), teachers = M.teachersOf(m.id)
  const pool = M.membersOf(c.id).filter((x) => M.isMember(x.id, c.id) && !M.isHeld(x.id, m.id) && x.id !== me.id)
  return (
    <div className="page treading">
      <PageHead back={{ fallback: to(`/?cat=${c.id}&view=map`), label: c.name }}
        title={<span className="row" style={{ gap: 12 }}><Node item={m} state={st ?? 'open'} size={48} label={false} />{m.name}</span>}
        sub={`${c.name} · ${M.columnsOf(c.id).find((x) => x.id === m.column)?.he ?? ''}`}
        actions={st && <Badge tone={st === 'held' ? 'ok' : st === 'open' ? 'blue' : undefined}>{STATE_HE[st]}</Badge>} />
      <div className="stack">
        {m.desc && <p className="c2" style={{ margin: 0 }}>{m.desc}</p>}
        {member && !!m.groups?.length && <Card className="b"><div className="w5" style={{ marginBottom: 6 }}>דרישות</div>{m.groups.map((gr, i) => <div key={i} className="foot c2">{reqLine(M, me.id, gr)}</div>)}</Card>}
        <Card>
          <div className="w5">מי מלמד/ת את זה</div>
          {teachers.length ? <div className="row wrap" style={{ marginTop: 8, gap: 12 }}>{teachers.map((x) => <span key={x.id} className="row" style={{ gap: 6 }}><Avatar name={x.full_name} src={x.avatar_url} size={28} />{x.full_name}</span>)}</div>
            : <div className="foot c2">עוד אין מי שמוסמך/ת ללמד — הרש"צ ילמד.</div>}
          <div className="foot cm" style={{ marginTop: 8 }}>{holders.length} מוסמכים בסך הכל</div>
        </Card>
        {canG && (
          <Card className="b" title={<span className="row"><BadgeCheck size={18} aria-hidden />הסמכה</span>}>
            <div className="foot c2" style={{ marginBottom: 8 }}>מסמיכים אחרי שראיתם בסדנה. אפשר להסמיך גם מי שעוד לא עמד/ה בדרישות (פתיחה מוקדמת).</div>
            {pool.length ? <div className="list">{pool.map((x) => (
              <div key={x.id} className="lrow">
                <Avatar name={x.full_name} src={x.avatar_url} size={32} />
                <div className="main2"><div className="ttl">{x.full_name}</div><div className="meta">{STATE_HE[M.stateOf(x.id, m)]}</div></div>
                <Button size="sm" variant={M.stateOf(x.id, m) === 'locked' ? 'tint' : 'primary'} onClick={() => g.grant(x.id, m)}>{M.stateOf(x.id, m) === 'locked' ? 'פתיחה מוקדמת' : 'הסמכה'}</Button>
              </div>
            ))}</div> : <div className="c2">כל החברים כבר מוסמכים.</div>}
            {holders.length > 0 && <>
              <div className="w5" style={{ marginTop: 16 }}>מוסמכים · מי מלמד</div>
              <div className="list">{holders.map((x) => (
                <div key={x.id} className="lrow">
                  <Avatar name={x.full_name} src={x.avatar_url} size={32} />
                  <div className="main2"><div className="ttl">{x.full_name}</div><div className="meta">{fmtShort(M.rec(x.id, m.id).at)}{M.rec(x.id, m.id).by ? ` · ${M.nameOf(M.rec(x.id, m.id).by)}` : ''}{M.rec(x.id, m.id).early ? ' · פתיחה מוקדמת' : ''}</div></div>
                  <span className="foot c2">מלמד/ת</span>
                  <Switch label="מלמד/ת" on={!!M.rec(x.id, m.id).teach} onChange={(on) => g.teach(x.id, m, on)} disabled={x.id === me.id || !M.isActive(x)} />
                </div>
              ))}</div>
            </>}
          </Card>
        )}
        {!canG && !member && <Button variant="ghost" onClick={() => history.back()}>חזרה</Button>}
      </div>
    </div>
  )
}
