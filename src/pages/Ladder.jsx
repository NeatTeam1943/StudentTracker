import { useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { badgeSrc, wordmarkSrc } from '../components/ui.jsx'
import { gapFor, displayRank, rankIndex, requirement } from '../lib/ranks.js'

const GATE = { 10: "שכבה י'", 11: "שכבה יא'", 12: "שכבה יב'", 99: 'מנטורים' }

export default function Ladder() {
  const [params, setParams] = useSearchParams()
  const store = useStore()
  const { ranks, people, team } = store

  if (store.loading) return <p className="empty">טוען…</p>

  const viewing = params.get('person')
  const person = viewing ? store.person(viewing) : null
  const current = person ? displayRank(ranks, person, team.id) : null

  return (
    <>
      <div className="page-title">
        <div>
          <h1>סולם ההתקדמות · {team.name}</h1>
          <div className="sub">כל דרגה דורשת את שלה ואת כל מה שלפניה</div>
        </div>
      </div>

      <div className="panel">
        <label className="f" htmlFor="who">
          הצגת ההתקדמות של
        </label>
        <select
          id="who"
          value={viewing ?? ''}
          onChange={(e) => setParams(e.target.value ? { person: e.target.value } : {})}
          style={{ maxWidth: 280 }}
        >
          <option value="">הסולם בלבד</option>
          {people
            .filter((p) => !p.archived && p.memberships?.[team.id])
            .sort((a, b) => a.name.localeCompare(b.name, 'he'))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </div>

      <div className="ladder">
        {ranks.map((rank) => {
          const gap = person ? gapFor(team, ranks, person, rank) : null
          const reached = current && rankIndex(ranks, rank.id) <= rankIndex(ranks, current.id)
          const req = requirement(team, ranks, rank.id)
          const cls = person ? (reached ? 'tier reached' : gap.eligible ? 'tier reached' : 'tier locked') : 'tier'
          return (
            <div key={rank.id} className={cls} style={{ color: rank.color }}>
              <div className="gate">{req.minGrade ? GATE[req.minGrade] : ''}</div>
              <img className="wordmark" src={wordmarkSrc(rank.id)} alt={rank.name} />
              <img src={badgeSrc(rank.badge)} alt="" />
              <div className="reqs">
                {req.items.map((tool) => {
                  const missing = gap?.missingItems.includes(tool)
                  return (
                    <div key={tool} className={`chip${missing ? ' ghost' : ''}`}>
                      <span className="name">{tool}</span>
                    </div>
                  )
                })}
                {req.items.length === 0 && (
                  <div className="empty" style={{ fontSize: 13 }}>
                    {req.minGrade ? 'ותק ושכבה' : 'טרם הוגדר'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
