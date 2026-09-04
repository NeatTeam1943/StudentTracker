import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { PersonCard } from '../components/ui.jsx'
import { displayRank, promotionSuggestion, membershipIn, catalogItems } from '../lib/ranks.js'

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
  const [showArchive, setShowArchive] = useState(false)
  const [migrating, setMigrating] = useState(false)

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

  // Data from before sub-teams existed. Nobody has a membership yet, so every
  // roster would look empty until this runs.
  if (store.needsMigration)
    return (
      <div className="panel">
        <h3>יש לעדכן את מבנה הנתונים</h3>
        {isMentor ? (
          <>
            <p className="empty">
              הנתונים הקיימים נשמרו לפני שהמערכת תמכה בכמה צוותים. העדכון משייך את כל
              חברי הצוות הקיימים לצוות בנייה יחד עם ההסמכות והדרגות שלהם. שום דבר לא נמחק.
            </p>
            <button
              className="btn primary"
              disabled={migrating}
              onClick={async () => {
                setMigrating(true)
                try {
                  await store.migrateToTeams()
                } catch {
                  setMigrating(false)
                }
              }}
            >
              {migrating ? 'מעדכן…' : 'עדכון הנתונים'}
            </button>
          </>
        ) : (
          <p className="empty">המערכת בתחזוקה. נסו שוב בקרוב.</p>
        )}
      </div>
    )

  const active = store.roster.filter((p) => !p.archived)
  // Archived outright, or still on record here but no longer active.
  const archive = [...store.roster.filter((p) => p.archived), ...store.alumni]

  const suggestions = isMentor
    ? active
        .filter((p) => p.memberships?.[team.id]?.autoRank === false)
        .map((p) => [p, promotionSuggestion(team, ranks, p)])
        .filter(([, s]) => s)
    : []

  const valid = catalogItems(team)
  const card = (p) => (
    <PersonCard
      key={p.id}
      person={p}
      rank={displayRank(ranks, p, team.id)}
      membership={membershipIn(p, team.id)}
      validItems={valid}
    />
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

      {/* One archive per team view: people who moved to another team and people
          archived outright. Both mean the same thing to a mentor — kept for the
          record, not active here. */}
      {archive.length > 0 && (
        <section>
          <div className="group-head">
            <h2>ארכיון</h2>
            <span>{archive.length}</span>
            <button className="btn sm ghost" onClick={() => setShowArchive((v) => !v)}>
              {showArchive ? 'הסתרה' : 'הצגה'}
            </button>
          </div>
          {showArchive && (
            <>
              <p className="empty" style={{ marginTop: 0 }}>
                ההסמכות והדרגה שלהם כאן נשמרו, והם עדיין יכולים ללמד את מה שהוסמכו ללמד.
              </p>
              <div className="roster">
                {archive.sort((a, b) => a.name.localeCompare(b.name, 'he')).map(card)}
              </div>
            </>
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
