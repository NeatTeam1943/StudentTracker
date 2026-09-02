import { Link, useParams } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { IdCard, ToolColumns } from '../components/ui.jsx'
import { displayRank, promotionSuggestion, nextRankProgress } from '../lib/ranks.js'

export default function Profile() {
  const { id } = useParams()
  const store = useStore()
  const { ranks, isMentor } = store

  if (store.loading) return <p className="empty">טוען…</p>

  const person = store.person(id)
  if (!person)
    return (
      <div className="panel">
        <h3>הפרופיל לא נמצא</h3>
        <p className="empty">ייתכן שהוא נמחק.</p>
        <Link className="btn" to="/">
          חזרה לרשימה
        </Link>
      </div>
    )

  const rank = displayRank(ranks, person)
  const suggestion = isMentor ? promotionSuggestion(ranks, person) : null
  const progress = nextRankProgress(ranks, person)

  const toggleHeld = (tool, held) =>
    held ? store.revokeTool(person.id, tool) : store.grantTool(person.id, tool)

  return (
    <>
      <div className="page-title">
        <div>
          <h1>פרופיל הסמכות והרשאות</h1>
          <div className="sub">
            <Link to="/">כל חברי הצוות</Link> · {person.name}
          </div>
        </div>
      </div>

      {suggestion && (
        <div className="suggestion">
          <span>
            {person.name} השלים את כל הדרישות ל<strong>{suggestion.to.name}</strong>.
          </span>
          <button className="btn primary sm" onClick={() => store.setRank(person.id, suggestion.to.id, false)}>
            קדם ל{suggestion.to.name}
          </button>
        </div>
      )}

      <div className="profile">
        <div>
          <IdCard person={person} rank={rank} />

          {progress && (
            <div className="panel" style={{ marginTop: 14 }}>
              <h3>הדרגה הבאה: {progress.next.name}</h3>
              <div className="progress">
                <i style={{ width: `${Math.round((progress.have / progress.total) * 100)}%` }} />
              </div>
              <div className="empty" style={{ padding: 0 }}>
                {progress.have} מתוך {progress.total} כלים
                {!progress.gradeOk && progress.next.minGrade !== 99 && ' · דורש שכבה גבוהה יותר'}
              </div>
              {progress.missingTools.length > 0 && (
                <p style={{ fontSize: 14, marginBottom: 0 }}>חסר: {progress.missingTools.join(', ')}</p>
              )}
            </div>
          )}

          {isMentor && (
            <div className="panel" style={{ marginTop: 14 }}>
              <h3>ניהול</h3>
              <label className="f" htmlFor="rank">
                קביעת דרגה ידנית
              </label>
              <select
                id="rank"
                value={person.rankId ?? ''}
                onChange={(e) => store.setRank(person.id, e.target.value || null, true)}
              >
                <option value="">ללא דרגה</option>
                {ranks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <p style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
                <Link className="btn sm" to={`/edit/${person.id}`}>
                  עריכת פרטים
                </Link>
                <Link className="btn sm ghost" to={`/logs?person=${person.id}`}>
                  היסטוריה
                </Link>
              </p>
            </div>
          )}
        </div>

        <ToolColumns
          person={person}
          categories={store.categories}
          order={store.order}
          canEdit={isMentor}
          onToggleHeld={toggleHeld}
          onToggleTeach={(tool, value) => store.setCanTeach(person.id, tool, value)}
        />
      </div>
    </>
  )
}
