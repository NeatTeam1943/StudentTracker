import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { PersonCard } from '../components/ui.jsx'
import { displayRank, promotionSuggestion, membershipIn } from '../lib/ranks.js'

const GROUPS = [
  { key: 10, title: "שכבה י'" },
  { key: 11, title: "שכבה יא'" },
  { key: 12, title: "שכבה יב'" },
  { key: 99, title: 'מנטורים' },
]

export default function Roster() {
  const store = useStore()
  const { team, ranks, isMentor } = store
  const [importing, setImporting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showAlumni, setShowAlumni] = useState(false)

  if (store.loading) return <p className="empty">טוען…</p>

  // Nothing at all yet. Guests get an explanation, mentors get the import.
  if (store.people.length === 0)
    return (
      <div className="panel">
        <h3>אין עדיין חברי צוות</h3>
        {isMentor ? (
          <>
            <p className="empty">
              ניתן לייבא את נתוני צוות הבנייה מהמצגת המקורית — 13 חברי צוות, רשימת
              הכלים וסולם ההתקדמות. פעולה חד-פעמית.
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

  const active = store.roster.filter((p) => !p.archived)
  const archived = store.roster.filter((p) => p.archived)
  const alumni = store.alumni

  const suggestions = isMentor
    ? active.map((p) => [p, promotionSuggestion(team, ranks, p)]).filter(([, s]) => s)
    : []

  const card = (p) => (
    <PersonCard key={p.id} person={p} rank={displayRank(ranks, p, team.id)} membership={membershipIn(p, team.id)} />
  )

  return (
    <>
      <div className="page-title">
        <div>
          <h1>{team.name}</h1>
          <div className="sub">{active.length} חברי צוות · לחצו על שם לפרופיל המלא</div>
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
                השלים את הדרישות ל<strong>{s.to.name}</strong>
                {s.from ? ` (כעת ${s.from.name})` : ''}
              </span>
              <button className="btn primary sm" onClick={() => store.setRank(p.id, s.to.id, false)}>
                קדם
              </button>
            </div>
          ))}
        </div>
      )}

      {active.length === 0 && (
        <div className="panel">
          <h3>אין עדיין חברים בצוות {team.name}</h3>
          <p className="empty">
            {isMentor
              ? 'צרפו חברי צוות מהפרופיל שלהם, או הוסיפו חבר צוות חדש.'
              : 'הצוות עדיין לא אויש.'}
          </p>
        </div>
      )}

      {GROUPS.map(({ key, title }) => {
        const group = active
          .filter((p) => (p.gradeNum ?? 99) === key)
          .sort((a, b) => a.name.localeCompare(b.name, 'he'))
        if (!group.length) return null
        return (
          <section key={key}>
            <div className="group-head">
              <h2>{title}</h2>
              <span>{group.length}</span>
            </div>
            <div className="roster">{group.map(card)}</div>
          </section>
        )
      })}

      {alumni.length > 0 && (
        <section>
          <div className="group-head">
            <h2>עברו לצוות אחר</h2>
            <span>{alumni.length}</span>
            <button className="btn sm ghost" onClick={() => setShowAlumni((v) => !v)}>
              {showAlumni ? 'הסתרה' : 'הצגה'}
            </button>
          </div>
          {showAlumni && (
            <>
              <p className="empty" style={{ marginTop: 0 }}>
                ההסמכות והדרגה שלהם כאן נשמרו, והם עדיין יכולים ללמד את מה שהוסמכו ללמד.
              </p>
              <div className="roster">
                {alumni.sort((a, b) => a.name.localeCompare(b.name, 'he')).map(card)}
              </div>
            </>
          )}
        </section>
      )}

      {isMentor && archived.length > 0 && (
        <section>
          <div className="group-head">
            <h2>ארכיון</h2>
            <span>{archived.length}</span>
            <button className="btn sm ghost" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'הסתרה' : 'הצגה'}
            </button>
          </div>
          {showArchived && (
            <div className="roster">
              {archived.sort((a, b) => a.name.localeCompare(b.name, 'he')).map(card)}
            </div>
          )}
        </section>
      )}

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
