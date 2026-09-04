import { useState } from 'react'
import { useStore } from '../lib/store.jsx'

export default function Mentors() {
  const store = useStore()
  const { user, isMentor, mentors, requests } = store
  // A rejected write used to fail silently, so pressing אישור looked like
  // nothing happening at all.
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(
        e?.code === 'permission-denied'
          ? 'ההרשאות ב-Firestore חוסמות את הפעולה. יש לפרסם מחדש את firestore.rules — הכלל של mentors צריך להיות allow create, delete: if isMentor().'
          : `הפעולה נכשלה: ${e?.message ?? e}`,
      )
    }
    setBusy(false)
  }

  const alreadyRequested = user && requests.some((r) => r.uid === user.uid)

  return (
    <>
      <div className="page-title">
        <div>
          <h1>מנטורים</h1>
          <div className="sub">רק מנטורים יכולים לערוך הסמכות, לקדם ולנהל כלים</div>
        </div>
      </div>

      {!user && (
        <div className="panel">
          <h3>בקשת הרשאת מנטור</h3>
          <p className="empty">התחברו עם חשבון Google כדי לבקש הרשאה ממנטור קיים.</p>
          <button className="btn primary" onClick={store.signIn}>
            כניסה עם Google
          </button>
        </div>
      )}

      {user && !isMentor && (
        <div className="panel">
          <h3>אין לך עדיין הרשאת מנטור</h3>
          {alreadyRequested ? (
            <p className="empty">הבקשה נשלחה. מנטור קיים צריך לאשר אותה.</p>
          ) : (
            <>
              <p className="empty">
                מחוברים כ־{user.displayName ?? user.email}. שלחו בקשה ומנטור קיים יאשר אותה.
              </p>
              <button className="btn primary" onClick={store.requestMentorAccess}>
                בקשת הרשאה
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="panel" style={{ borderColor: '#ff6b5e' }}>
          <h3 style={{ color: '#ff9d94' }}>הפעולה לא בוצעה</h3>
          <p className="empty" style={{ marginBottom: 0 }}>{error}</p>
        </div>
      )}

      {isMentor && (
        <div className="panel">
          <h3>בקשות ממתינות {requests.length > 0 && `(${requests.length})`}</h3>
          {requests.length === 0 && <p className="empty">אין בקשות ממתינות.</p>}
          {requests.map((r) => (
            <div className="suggestion" key={r.uid}>
              <span>
                <strong>{r.name || r.email}</strong>
                {r.name && r.email ? ` · ${r.email}` : ''}
              </span>
              <button
                className="btn primary sm"
                disabled={busy}
                onClick={() => run(() => store.approveMentor(r.uid, r.name || r.email))}
              >
                אישור
              </button>
              <button className="btn sm ghost" disabled={busy} onClick={() => run(() => store.denyMentor(r.uid))}>
                דחייה
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h3>מנטורים מאושרים</h3>
        {mentors.length === 0 && <p className="empty">אין עדיין מנטורים.</p>}
        {mentors.map((m) => (
          <div className="log-row" key={m.uid}>
            <span className="dot" />
            <span>{m.name || m.uid}</span>
            {isMentor && m.uid !== user?.uid && (
              <button
                className="btn danger sm"
                style={{ marginInlineStart: 'auto' }}
                onClick={() =>
                  confirm(`להסיר את ההרשאה של ${m.name || m.uid}?`) &&
                  run(() => store.revokeMentor(m.uid, m.name))
                }
              >
                הסרה
              </button>
            )}
            {m.uid === user?.uid && <span className="who">זה אתם</span>}
          </div>
        ))}
      </div>
    </>
  )
}
