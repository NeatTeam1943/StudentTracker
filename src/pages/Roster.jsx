import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { PersonCard } from '../components/ui.jsx'
import { displayRank, promotionSuggestion } from '../lib/ranks.js'

const GROUPS = [
  { key: 10, title: "שכבה י'" },
  { key: 11, title: "שכבה יא'" },
  { key: 12, title: "שכבה יב'" },
  { key: 99, title: 'מנטורים' },
]

export default function Roster() {
  const store = useStore()
  const { people, ranks, isMentor } = store
  const [importing, setImporting] = useState(false)

  if (store.loading) return <p className="empty">טוען…</p>

  // Empty database. Guests get an explanation, mentors get the import button.
  if (people.length === 0)
    return (
      <div className="panel">
        <h3>אין עדיין חברי צוות</h3>
        {isMentor ? (
          <>
            <p className="empty">
              ניתן לייבא את הנתונים מהמצגת המקורית — 13 חברי צוות, רשימת הכלים
              וסולם ההתקדמות. פעולה חד-פעמית.
            </p>
            <button
              className="btn primary"
              disabled={importing}
              onClick={async () => {
                setImporting(true)
                try {
                  await store.importFromDeck()
                } catch {
                  setImporting(false)
                }
              }}
            >
              {importing ? 'מייבא…' : 'ייבוא נתונים מהמצגת'}
            </button>
          </>
        ) : (
          <p className="empty">המערכת עדיין לא אוישה. חזרו מאוחר יותר.</p>
        )}
      </div>
    )

  const suggestions = isMentor
    ? people.map((p) => [p, promotionSuggestion(ranks, p)]).filter(([, s]) => s)
    : []

  return (
    <>
      <div className="page-title">
        <div>
          <h1>פרופיל הסמכות והרשאות</h1>
          <div className="sub">
            {people.length} חברי צוות · לחצו על שם לצפייה בפרופיל המלא
          </div>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="panel">
          <h3>מוכנים לקידום</h3>
          {suggestions.map(([p, s]) => (
            <div className="suggestion" key={p.id}>
              <Link to={`/p/${p.id}`} style={{ fontWeight: 800 }}>
                {p.name}
              </Link>
              <span>
                השלים את כל הדרישות ל<strong>{s.to.name}</strong>
                {s.from ? ` (כעת ${s.from.name})` : ''}
              </span>
              <button className="btn primary sm" onClick={() => store.setRank(p.id, s.to.id, false)}>
                קדם ל{s.to.name}
              </button>
            </div>
          ))}
        </div>
      )}

      {GROUPS.map(({ key, title }) => {
        const group = people
          .filter((p) => (p.gradeNum ?? 99) === key)
          .sort((a, b) => a.name.localeCompare(b.name, 'he'))
        if (!group.length) return null
        return (
          <section key={key}>
            <div className="group-head">
              <h2>{title}</h2>
              <span>{group.length}</span>
            </div>
            <div className="roster">
              {group.map((p) => (
                <PersonCard key={p.id} person={p} rank={displayRank(ranks, p)} />
              ))}
            </div>
          </section>
        )
      })}

      {isMentor && (
        <p style={{ marginTop: 28 }}>
          <Link className="btn primary" to="/new">
            הוספת חבר צוות
          </Link>
        </p>
      )}
    </>
  )
}
