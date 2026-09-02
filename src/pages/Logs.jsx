import { useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'

const TONE = {
  tool_revoked: 'bad',
  teach_revoked: 'warn',
  person_removed: 'bad',
  tool_deleted: 'bad',
  rank_set: 'warn',
}

function describe(e, nameOf, rankName) {
  const who = nameOf(e.personId) ?? e.name ?? '—'
  switch (e.type) {
    case 'tool_granted':
      return `${who} הוסמך ל${e.tool}`
    case 'tool_revoked':
      return `בוטלה ההסמכה של ${who} ל${e.tool}`
    case 'teach_granted':
      return `${who} הוסמך ללמד ${e.tool}`
    case 'teach_revoked':
      return `${who} כבר לא מלמד ${e.tool}`
    case 'promoted':
      return `${who} קודם ל${rankName(e.to)}${e.from ? ` (מ${rankName(e.from)})` : ''}`
    case 'rank_set':
      return `הדרגה של ${who} נקבעה ידנית ל${rankName(e.to)}`
    case 'person_added':
      return `${e.name ?? who} נוסף לצוות`
    case 'person_updated':
      return `עודכנו הפרטים של ${who}`
    case 'person_removed':
      return `${e.name ?? who} הוסר מהצוות`
    case 'tool_created':
      return `נוסף כלי חדש: ${e.tool}`
    case 'tool_renamed':
      return `${e.from} שונה ל${e.tool}`
    case 'tool_moved':
      return `${e.tool} הועבר לקטגוריה אחרת`
    case 'tool_deleted':
      return `הכלי ${e.tool} נמחק`
    case 'ladder_updated':
      return 'סולם ההתקדמות עודכן'
    default:
      return e.type
  }
}

export default function Logs() {
  const [params, setParams] = useSearchParams()
  const store = useStore()
  const filter = params.get('person')

  const nameOf = (id) => store.person(id)?.name
  const rankName = (id) => store.ranks.find((r) => r.id === id)?.name ?? '—'
  const rows = filter ? store.events.filter((e) => e.personId === filter) : store.events

  return (
    <>
      <div className="page-title">
        <div>
          <h1>יומן שינויים</h1>
          <div className="sub">כל הסמכה, קידום והרשאת לימוד — לפי סדר כרונולוגי</div>
        </div>
      </div>

      <div className="panel">
        <label className="f" htmlFor="who">
          סינון
        </label>
        <select
          id="who"
          value={filter ?? ''}
          onChange={(e) => setParams(e.target.value ? { person: e.target.value } : {})}
          style={{ maxWidth: 280 }}
        >
          <option value="">כל חברי הצוות</option>
          {store.people
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'he'))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </div>

      <div className="panel">
        {rows.length === 0 && <p className="empty">אין עדיין רישומים. כל שינוי שמנטור יבצע יופיע כאן.</p>}
        {rows.map((e) => (
          <div className="log-row" key={e.id}>
            <span className={`dot ${TONE[e.type] ?? ''}`} />
            <time>{e.at?.toDate ? e.at.toDate().toLocaleString('he-IL') : '…'}</time>
            <span>{describe(e, nameOf, rankName)}</span>
            <span className="who">{e.by}</span>
          </div>
        ))}
      </div>
    </>
  )
}
