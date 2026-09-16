import { useState } from 'react'
import { useStore } from '../lib/store.jsx'

export default function Mentors() {
  const store = useStore()
  const { user, isMentor, isLead, lead, mentors, leads, requests } = store
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // A rejected write used to fail silently, so pressing אישור looked like
  // nothing happening at all.
  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(
        e?.code === 'permission-denied'
          ? 'ההרשאות ב-Firestore חוסמות את הפעולה. יש לפרסם מחדש את firestore.rules.'
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
          <h1>הרשאות</h1>
          <div className="sub">מנטורים וראשי צוות — מי יכול לערוך הסמכות, לקדם ולנהל כלים</div>
        </div>
      </div>

      {error && (
        <div className="panel" style={{ borderColor: '#ff6b5e' }}>
          <h3 style={{ color: '#ff9d94' }}>הפעולה לא בוצעה</h3>
          <p className="empty" style={{ marginBottom: 0 }}>
            {error}
          </p>
        </div>
      )}

      {!user && (
        <div className="panel">
          <h3>כניסה</h3>
          <p className="empty">התחברו עם חשבון Google כדי לבקש הרשאת עריכה.</p>
          <button className="btn primary" onClick={store.signIn}>
            כניסה עם Google
          </button>
        </div>
      )}

      {user && !isMentor && !isLead && (
        <div className="panel">
          <h3>אין לך עדיין הרשאת עריכה</h3>
          {alreadyRequested ? (
            <p className="empty">הבקשה נשלחה. מנטור צריך לאשר אותה.</p>
          ) : (
            <>
              <p className="empty">מחוברים כ־{user.displayName ?? user.email}.</p>
              <button className="btn primary" onClick={() => run(store.requestMentorAccess)}>
                בקשת הרשאה
              </button>
            </>
          )}
        </div>
      )}

      {/* A ראש"צ sees their own state but can never change it. */}
      {isLead && !isMentor && (
        <div className="panel">
          <h3>ראש"צ</h3>
          <p className="empty" style={{ marginBottom: 0 }}>
            {lead?.canEdit
              ? 'העריכה פתוחה — אפשר לערוך הסמכות, לקדם ולנהל כלים, בדיוק כמו מנטור.'
              : 'העריכה נעולה כרגע. אפשר לצפות בהכל, אבל לא לשנות. מנטור יכול לפתוח.'}
          </p>
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
                מנטור
              </button>
              <button
                className="btn sm"
                disabled={busy}
                onClick={() => run(() => store.approveLead(r.uid, r.name || r.email))}
              >
                ראש"צ
              </button>
              <button className="btn sm ghost" disabled={busy} onClick={() => run(() => store.denyMentor(r.uid))}>
                דחייה
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h3>ראשי צוות {leads.length > 0 && `(${leads.length})`}</h3>
        {leads.length === 0 && <p className="empty">אין עדיין ראשי צוות.</p>}
        {isMentor && leads.length > 0 && (
          <p className="empty" style={{ marginTop: 0 }}>
            עריכה פתוחה = אותן הרשאות כמו מנטור. נעולה = צפייה בלבד, כמו כל תלמיד.
          </p>
        )}
        {leads.map((l) => (
          <div className="log-row" key={l.uid}>
            <span className={`dot ${l.canEdit ? '' : 'warn'}`} />
            <span>{l.name || l.uid}</span>
            <span className="who">{l.canEdit ? 'עריכה פתוחה' : 'עריכה נעולה'}</span>
            {isMentor && (
              <>
                <button
                  className="btn sm"
                  disabled={busy}
                  onClick={() => run(() => store.setLeadEdit(l.uid, !l.canEdit, l.name))}
                >
                  {l.canEdit ? 'נעילה' : 'פתיחה'}
                </button>
                <button
                  className="btn danger sm"
                  disabled={busy}
                  onClick={() =>
                    confirm(`להסיר את ${l.name || l.uid} מרשימת ראשי הצוות?`) &&
                    run(() => store.revokeLead(l.uid, l.name))
                  }
                >
                  הסרה
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>מנטורים</h3>
        {mentors.length === 0 && <p className="empty">אין עדיין מנטורים.</p>}
        {mentors.map((m) => (
          <div className="log-row" key={m.uid}>
            <span className="dot" />
            <span>{m.name || m.uid}</span>
            {isMentor && m.uid !== user?.uid && (
              <button
                className="btn danger sm"
                style={{ marginInlineStart: 'auto' }}
                disabled={busy}
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

      <p className="empty" style={{ fontSize: 12, textAlign: 'center' }}>
        גרסה: {__BUILD_TIME__}
      </p>
    </>
  )
}
