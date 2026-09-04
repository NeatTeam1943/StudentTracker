import { useStore } from '../lib/store.jsx'

export default function Mentors() {
  const store = useStore()
  const { user, isMentor, mentors, requests } = store

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
              <button className="btn primary sm" onClick={() => store.approveMentor(r.uid, r.name || r.email)}>
                אישור
              </button>
              <button className="btn sm ghost" onClick={() => store.denyMentor(r.uid)}>
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
                  confirm(`להסיר את ההרשאה של ${m.name || m.uid}?`) && store.revokeMentor(m.uid, m.name)
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
