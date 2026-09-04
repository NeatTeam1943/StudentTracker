import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useStore } from '../lib/store.jsx'
import { ROLES } from '../data/seed.js'

const GRADES = [
  { label: "י'", num: 10 },
  { label: "יא'", num: 11 },
  { label: "יב'", num: 12 },
]

const blank = {
  id: '',
  name: '',
  role: 'חבר צוות',
  phone: '',
  grade: "י'",
  gradeNum: 10,
  favoriteTool: '',
  nickname: '',
  isMentor: false,
  rankId: '',
  tools: {},
}

const slugify = (name) =>
  name.trim().replace(/\s+/g, '-').replace(/["']/g, '').toLowerCase() || `p${Date.now()}`

export default function PersonForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const store = useStore()
  const existing = id ? store.person(id) : null
  const [form, setForm] = useState(() => ({ ...blank, ...(existing ?? {}) }))
  const [busy, setBusy] = useState(false)

  if (!store.isMentor)
    return (
      <div className="panel">
        <h3>נדרשת הרשאת מנטור</h3>
        <p className="empty">התחברו כמנטור כדי לערוך חברי צוות.</p>
      </div>
    )

  if (id && !existing && !store.loading)
    return (
      <div className="panel">
        <h3>הפרופיל לא נמצא</h3>
        <Link className="btn" to="/">
          חזרה לרשימה
        </Link>
      </div>
    )

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    const person = { ...form, id: form.id || slugify(form.name), rankId: form.rankId || null }
    await store.savePerson(person)
    navigate(`/p/${person.id}`)
  }

  const archive = async () => {
    if (!confirm(`להעביר את ${form.name} לארכיון? הפרופיל וההיסטוריה נשמרים וניתן להחזיר בכל רגע.`)) return
    setBusy(true)
    await store.setArchived(form.id, true)
    navigate('/')
  }

  const restore = async () => {
    setBusy(true)
    await store.setArchived(form.id, false)
    navigate(`/p/${form.id}`)
  }

  // Only offered from the archive, so nobody deletes a live profile by accident.
  const remove = async () => {
    if (!confirm(`למחוק לצמיתות את ${form.name}? כל ההסמכות יימחקו ולא ניתן לשחזר.`)) return
    setBusy(true)
    await store.removePerson(form.id)
    navigate('/')
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>{existing ? `עריכת ${existing.name}` : 'חבר צוות חדש'}</h1>
          <div className="sub">ההסמכות לכלים נקבעות בפרופיל עצמו, לא כאן</div>
        </div>
      </div>

      <form className="panel" onSubmit={save}>
        <div className="form-grid">
          <div>
            <label className="f" htmlFor="name">
              שם מלא
            </label>
            <input id="name" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </div>
          <div>
            <label className="f" htmlFor="role">
              תפקיד
            </label>
            <select id="role" value={form.role} onChange={(e) => set({ role: e.target.value })}>
              {/* People imported before the role list changed keep their old
                  value; showing it stops the field silently going blank. */}
              {!ROLES.includes(form.role) && form.role && <option>{form.role}</option>}
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="f" htmlFor="phone">
              טלפון
            </label>
            <input
              id="phone"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="050-0000000"
            />
          </div>
          <div>
            <label className="f" htmlFor="grade">
              שכבה
            </label>
            <select
              id="grade"
              value={form.isMentor ? 'mentor' : form.grade}
              onChange={(e) => {
                if (e.target.value === 'mentor') return set({ isMentor: true, gradeNum: 99, grade: 'מנטור' })
                const g = GRADES.find((x) => x.label === e.target.value)
                set({ isMentor: false, grade: g.label, gradeNum: g.num })
              }}
            >
              {GRADES.map((g) => (
                <option key={g.label} value={g.label}>
                  {g.label}
                </option>
              ))}
              <option value="mentor">מנטור</option>
            </select>
          </div>
          {form.isMentor && (
            <div>
              <label className="f" htmlFor="gradeText">
                ותק להצגה
              </label>
              <input
                id="gradeText"
                value={form.grade}
                onChange={(e) => set({ grade: e.target.value })}
                placeholder='כ"ה'
              />
            </div>
          )}
          <div>
            <label className="f" htmlFor="fav">
              כלי אהוב
            </label>
            <input id="fav" value={form.favoriteTool} onChange={(e) => set({ favoriteTool: e.target.value })} />
          </div>
          <div>
            <label className="f" htmlFor="nick">
              כינוי
            </label>
            <input id="nick" value={form.nickname} onChange={(e) => set({ nickname: e.target.value })} />
          </div>
          <div>
            <label className="f" htmlFor="rankId">
              דרגה
            </label>
            <select id="rankId" value={form.rankId ?? ''} onChange={(e) => set({ rankId: e.target.value })}>
              <option value="">ללא דרגה</option>
              {store.ranks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p style={{ display: 'flex', gap: 8, marginTop: 18, marginBottom: 0, flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={busy}>
            {existing ? 'שמירת שינויים' : 'הוספה לצוות'}
          </button>
          <Link className="btn ghost" to={existing ? `/p/${existing.id}` : '/'}>
            ביטול
          </Link>
          {existing && !existing.archived && (
            <button type="button" className="btn" onClick={archive} disabled={busy}>
              העברה לארכיון
            </button>
          )}
          {existing?.archived && (
            <>
              <button type="button" className="btn" onClick={restore} disabled={busy}>
                החזרה מהארכיון
              </button>
              <button type="button" className="btn danger" onClick={remove} disabled={busy}>
                מחיקה לצמיתות
              </button>
            </>
          )}
        </p>
      </form>
    </>
  )
}
