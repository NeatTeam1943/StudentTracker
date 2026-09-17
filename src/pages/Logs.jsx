import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { describeEvent, EVENT_TONE } from '../lib/events.js'

export default function Logs() {
  const [params, setParams] = useSearchParams()
  const store = useStore()
  const filter = params.get('person')
  const [note, setNote] = useState('')

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
        {store.canEdit && filter && (
          <form
            className="note-form"
            onSubmit={(e) => {
              e.preventDefault()
              store.addNote(filter, note).then(() => setNote(''))
            }}
          >
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`הערה על ${store.person(filter)?.name ?? ''}…`}
            />
            <button className="btn primary" disabled={!note.trim()}>
              הוספה ליומן
            </button>
          </form>
        )}
        {store.isMentor && filter && (
          <p style={{ marginTop: 0 }}>
            <button
              className="btn sm danger"
              onClick={() =>
                confirm(
                  `לנקות את כל היומן של ${store.person(filter)?.name ?? ''}? ההסמכות והדרגה לא ישתנו, אבל ההיסטוריה וההערות יימחקו לצמיתות.`,
                ) && store.clearPersonLog(filter)
              }
            >
              ניקוי היומן של חבר הצוות
            </button>
          </p>
        )}
        {store.canEdit && !filter && (
          <p className="empty" style={{ marginTop: 0 }}>
            בחרו חבר צוות כדי להוסיף לו הערה.
          </p>
        )}
        {rows.length === 0 && <p className="empty">אין עדיין רישומים. כל שינוי שמנטור יבצע יופיע כאן.</p>}
        {rows.map((e) => (
          <div className={`log-row${e.type === 'note' ? ' is-note' : ''}`} key={e.id}>
            <span className={`dot ${EVENT_TONE[e.type] ?? ''}`} />
            <time>{e.at?.toDate ? e.at.toDate().toLocaleString('he-IL') : '…'}</time>
            <span>{describeEvent(e, nameOf, rankName)}</span>
            <span className="who">{e.by}</span>
          </div>
        ))}
      </div>
    </>
  )
}
