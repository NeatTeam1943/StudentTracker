import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { IdCard, ToolColumns, RankBadge } from '../components/ui.jsx'
import DeckSlide, { useLandscape } from '../components/DeckSlide.jsx'
import { displayRank, promotionSuggestion, nextRankProgress, membershipIn, favoriteOf } from '../lib/ranks.js'

export default function Profile() {
  const { id } = useParams()
  const store = useStore()
  const { ranks, isMentor, teams, team } = store
  const [target, setTarget] = useState('')
  const landscape = useLandscape()
  // Deck layout is the default; scroll mode is the comfortable one for editing.
  // Landscape has the room for the deck, so it switches there on its own.
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('neat-tools:view') || 'deck'
    } catch {
      return 'deck'
    }
  })
  const [userChose, setUserChose] = useState(false)

  useEffect(() => {
    if (!userChose) setView(landscape ? 'deck' : (localStorage.getItem('neat-tools:view') || 'deck'))
  }, [landscape, userChose])

  const pickView = (v) => {
    setView(v)
    setUserChose(true)
    try {
      localStorage.setItem('neat-tools:view', v)
    } catch {
      /* private browsing */
    }
  }

  if (store.loading) return <p className="empty">טוען…</p>

  const person = store.person(id)
  if (!person)
    return (
      <div className="panel">
        <h3>הפרופיל לא נמצא</h3>
        <Link className="btn" to="/">
          חזרה לרשימה
        </Link>
      </div>
    )

  const membership = membershipIn(person, team.id)
  const rank = displayRank(ranks, person, team.id)
  const suggestion = isMentor && membership ? promotionSuggestion(team, ranks, person) : null
  const progress = membership ? nextRankProgress(team, ranks, person) : null
  const otherTeams = teams.filter((t) => t.id !== team.id)
  const inactiveHere = membership && membership.active === false

  return (
    <>
      <div className="page-title">
        <div>
          <h1>{person.name}</h1>
          <div className="sub">
            <Link to="/">{team.name}</Link> · {person.role}
          </div>
        </div>
      </div>

      {/* One badge per team they belong to — the ranks are independent. */}
      {Object.keys(person.memberships ?? {}).length > 1 && (
        <div className="jump" style={{ marginBottom: 14 }}>
          {teams
            .filter((t) => person.memberships?.[t.id])
            .map((t) => {
              const r = displayRank(ranks, person, t.id)
              const off = person.memberships[t.id].active === false
              return (
                <button
                  key={t.id}
                  onClick={() => store.setTeam(t.id)}
                  className="btn sm"
                  style={{
                    borderColor: t.id === team.id ? 'var(--chip)' : undefined,
                    opacity: off ? 0.6 : 1,
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <RankBadge rank={r} size={22} />
                  {t.name}
                  {r ? ` · ${r.name}` : ''}
                  {off ? ' (לא פעיל)' : ''}
                </button>
              )
            })}
        </div>
      )}

      {person.archived && (
        <div className="suggestion" style={{ borderColor: '#ffb020', background: 'rgba(255,176,32,0.1)' }}>
          <span>הפרופיל בארכיון ואינו מופיע ברשימת הצוות.</span>
          {isMentor && (
            <button className="btn sm" onClick={() => store.setArchived(person.id, false)}>
              החזרה מהארכיון
            </button>
          )}
        </div>
      )}

      {inactiveHere && (
        <div className="suggestion" style={{ borderColor: '#ffb020', background: 'rgba(255,176,32,0.1)' }}>
          <span>
            לא פעיל ב{team.name}. הדרגה וההסמכות נשמרו, והוא עדיין יכול ללמד את מה שהוסמך ללמד.
          </span>
          {isMentor && (
            <button className="btn sm" onClick={() => store.setTeamActive(person.id, team.id, true)}>
              החזרה לפעילות
            </button>
          )}
        </div>
      )}

      {suggestion && !person.archived && !inactiveHere && (
        <div className="suggestion">
          <span>
            השלים את כל הדרישות ל<strong>{suggestion.to.name}</strong>.
          </span>
          <button className="btn primary sm" onClick={() => store.setRank(person.id, suggestion.to.id, false)}>
            קדם ל{suggestion.to.name}
          </button>
        </div>
      )}

      {membership && (
        <div className="view-toggle">
          <button
            className={`team-pill${view === 'deck' ? ' on' : ''}`}
            onClick={() => pickView('deck')}
          >
            תצוגת מצגת
          </button>
          <button
            className={`team-pill${view === 'scroll' ? ' on' : ''}`}
            onClick={() => pickView('scroll')}
          >
            תצוגת גלילה
          </button>
          {view === 'deck' && <span className="deck-hint">הקישו פעמיים להגדלה</span>}
        </div>
      )}

      {membership && view === 'deck' && (
        <DeckSlide
          person={person}
          membership={membership}
          rank={rank}
          categories={store.categories}
          order={store.order}
          events={store.events}
          ranks={ranks}
          favoriteLabel={team.favoriteLabel ?? 'כלי אהוב'}
          favorite={favoriteOf(person, team.id)}
          mode={landscape && window.innerHeight < 600 ? 'fill' : 'fit'}
        />
      )}

      <div className="profile">
        <div>
          {view !== 'deck' && (
            <IdCard
              person={person}
              rank={rank}
              favoriteLabel={team.favoriteLabel ?? 'כלי אהוב'}
              favorite={favoriteOf(person, team.id)}
            />
          )}

          {progress && view !== 'deck' && (
            <div className="panel" style={{ marginTop: 14 }}>
              <h3>הדרגה הבאה: {progress.next.name}</h3>
              <div className="progress">
                <i
                  style={{
                    width: `${progress.total ? Math.round((progress.have / progress.total) * 100) : 100}%`,
                    background: progress.gradeOk ? undefined : '#ffb020',
                  }}
                />
              </div>
              <div className="empty" style={{ padding: 0 }}>
                {progress.have} מתוך {progress.total}
              </div>
              {!progress.gradeOk && (
                <p style={{ fontSize: 14, color: '#ffb020', marginBottom: 0 }}>
                  {progress.missingItems.length === 0
                    ? 'הכל הושלם — נותר רק המעבר לשכבה הבאה'
                    : 'הדרגה דורשת גם שכבה גבוהה יותר'}
                </p>
              )}
              {progress.missingItems.length > 0 && (
                <p style={{ fontSize: 14, marginBottom: 0 }}>חסר: {progress.missingItems.join(', ')}</p>
              )}
            </div>
          )}

          {isMentor && (
            <div className="panel" style={{ marginTop: 14 }}>
              <h3>ניהול</h3>

              {membership && (
                <>
                  <label className="f" htmlFor="rank">
                    קביעת דרגה ידנית ב{team.name}
                  </label>
                  <select
                    id="rank"
                    value={membership.rankId ?? ''}
                    onChange={(e) => store.setRank(person.id, e.target.value || null, true)}
                  >
                    <option value="">ללא דרגה</option>
                    {ranks.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {otherTeams.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <label className="f" htmlFor="target">
                    צוות אחר
                  </label>
                  <select id="target" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">בחרו צוות…</option>
                    {otherTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {person.memberships?.[t.id] ? ' (כבר חבר)' : ''}
                      </option>
                    ))}
                  </select>
                  <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 0 }}>
                    <button
                      className="btn sm"
                      disabled={!target}
                      onClick={() => store.joinTeam(person.id, target)}
                      title="מצטרף לצוות החדש ונשאר פעיל כאן"
                    >
                      צירוף בנוסף
                    </button>
                    <button
                      className="btn sm primary"
                      disabled={!target || !membership}
                      onClick={() => store.transfer(person.id, team.id, target)}
                      title="מצטרף לצוות החדש ומפסיק להיות פעיל כאן"
                    >
                      העברה
                    </button>
                  </p>
                </div>
              )}

              {membership && !inactiveHere && (
                <button
                  className="btn sm"
                  onClick={() => store.setTeamActive(person.id, team.id, false)}
                  style={{ marginTop: 10 }}
                >
                  סימון כלא פעיל ב{team.name}
                </button>
              )}

              {!membership && (
                <button className="btn sm primary" onClick={() => store.joinTeam(person.id, team.id)}>
                  צירוף ל{team.name}
                </button>
              )}

              <p style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 0, flexWrap: 'wrap' }}>
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

        {membership && view !== 'deck' ? (
          <ToolColumns
            membership={membership}
            categories={store.categories}
            order={store.order}
            canEdit={isMentor && !inactiveHere}
            onToggleHeld={(tool, held) =>
              held ? store.revokeTool(person.id, tool) : store.grantTool(person.id, tool)
            }
            onToggleTeach={(tool, value) => store.setCanTeach(person.id, tool, value)}
          />
        ) : membership ? null : (
          <div className="panel">
            <h3>לא חבר בצוות {team.name}</h3>
            <p className="empty">
              {Object.keys(person.memberships ?? {}).length
                ? 'בחרו צוות אחר למעלה כדי לראות את ההסמכות שלו.'
                : 'עדיין לא שויך לאף צוות.'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
