import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Route as RouteIcon } from 'lucide-react'
import { Card } from '@neatsystem/kit'
import { useTr } from '../model/store.jsx'
import { Node, RankMark } from './common.jsx'

/** NeatSystem home: what I can learn next, and how far my next rank is. */
export function HomeCard() {
  const { M, me, to } = useTr()
  const nav = useNavigate()
  if (!M || M.isMentor(me)) return null
  const next = M.nextToLearn(me.id).slice(0, 3)
  const own = M.teamCategory(me.team), nx = own && M.next(me.id, own.id)
  if (!next.length && !nx) return null
  return (
    <Card title={<span className="row"><RouteIcon size={18} aria-hidden />ההכשרות הבאות שלי</span>}>
      {next.length ? <div className="list">{next.map((i) => {
        const t = M.teachersOf(i.id).filter((x) => x.id !== me.id)[0]
        return (
          <button type="button" key={i.id} className="lrow click" onClick={() => nav(to(`/m/${i.id}`))}>
            <Node item={i} state="open" size={36} label={false} />
            <div className="main2" style={{ textAlign: 'start' }}><div className="ttl">{i.name}</div><div className="meta">{M.category(i.category)?.name}{t ? ` · מלמד/ת: ${t.full_name}` : ''}</div></div>
            <ChevronLeft size={20} className="cm" aria-hidden />
          </button>
        )
      })}</div> : <div className="foot c2">אין כרגע פריטים פתוחים</div>}
      {nx && <div className="row foot c2" style={{ marginTop: 10, gap: 6 }}><RankMark rank={M.rankIn(me.id, own.id)} size={18} />{M.rankIn(me.id, own.id)?.name ?? 'ללא דרגה'} · עוד {nx.missing.length} {own.item_noun} ל{nx.rank.name}</div>}
    </Card>
  )
}
