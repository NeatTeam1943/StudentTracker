import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { badgeSrc } from '../components/ui.jsx'
import { requirement } from '../lib/ranks.js'

const GRADES = [
  { value: '', label: 'ללא דרישת שכבה' },
  { value: '10', label: "שכבה י' ומעלה" },
  { value: '11', label: "שכבה יא' ומעלה" },
  { value: '12', label: "שכבה יב'" },
  { value: '99', label: 'מנטורים בלבד' },
]

const SWATCHES = [
  { header: '#6D6D6D', tint: '55,74,91' },
  { header: '#04255A', tint: '32,76,141' },
  { header: '#1B4922', tint: '11,89,101' },
  { header: '#653A27', tint: '142,81,62' },
  { header: '#7A1220', tint: '81,41,68' },
  { header: '#3B2A6B', tint: '78,64,140' },
]

// The exact header colours and panel tints used by the source deck.
const DECK_PALETTE = {
  basic_training: { header: '#747474', tint: '255,255,255' },
  basic_tools: { header: '#002060', tint: '59,130,246' },
  power_tools: { header: '#12501B', tint: '16,185,129' },
  bench_tools: { header: '#7F340D', tint: '249,115,22' },
  heavy_machinery: { header: '#5E0202', tint: '239,68,68' },
}

const slug = (s) =>
  s.trim().toLowerCase().replace(/[^\w\u0590-\u05FF]+/g, '-').replace(/^-|-$/g, '') || `t${Date.now()}`

export default function Teams() {
  const store = useStore()
  const { teams, team, ranks, categories, order, isMentor } = store
  const [draft, setDraft] = useState({ name: '', itemNoun: 'הכשרות', itemNounSingular: 'הכשרה' })
  const [cat, setCat] = useState('')

  if (store.loading) return <p className="empty">טוען…</p>

  if (!isMentor)
    return (
      <div className="panel">
        <h3>נדרשת הרשאת מנטור</h3>
        <p className="empty">התחברו כמנטור כדי לנהל צוותים.</p>
      </div>
    )

  // Never write on blur unless the text actually changed — a stray focus
  // shouldn't produce a log entry, let alone overwrite a name.
  const renameField = (e, field, current) => {
    const v = e.target.value.trim()
    if (!v || v === current) {
      e.target.value = current
      return
    }
    store.updateTeam(team.id, { [field]: v })
  }

  const createTeam = (e) => {
    e.preventDefault()
    if (!draft.name.trim()) return
    let id = slug(draft.name)
    if (teams.some((t) => t.id === id)) {
      let n = 2
      while (teams.some((t) => t.id === `${id}-${n}`)) n++
      id = `${id}-${n}`
    }
    store.createTeam(id, draft.name.trim(), draft.itemNoun.trim(), draft.itemNounSingular.trim())
    store.setTeam(id)
    setDraft({ name: '', itemNoun: 'הכשרות', itemNounSingular: 'הכשרה' })
  }

  const addCategory = (e) => {
    e.preventDefault()
    if (!cat.trim()) return
    const used = order.length
    store.addCategory(slug(cat), {
      he: cat.trim(),
      label: cat.trim(),
      ...SWATCHES[used % SWATCHES.length],
    })
    setCat('')
  }

  const allItems = order.flatMap((id) => categories[id]?.items ?? [])

  const toggleReq = (rankId, item) => {
    const current = requirement(team, ranks, rankId).items
    const next = current.includes(item) ? current.filter((t) => t !== item) : [...current, item]
    store.setRequirement(rankId, { items: next })
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>צוותים</h1>
          <div className="sub">לכל צוות קטגוריות, פריטים ודרישות משלו. הדרגות משותפות לכולם.</div>
        </div>
      </div>

      <div className="panel">
        <h3>הצוותים</h3>
        <div className="jump" style={{ marginBottom: 12 }}>
          {teams.map((t) => (
            <button
              key={t.id}
              className="btn sm"
              onClick={() => store.setTeam(t.id)}
              style={{ borderColor: t.id === team.id ? 'var(--chip)' : undefined }}
            >
              {t.name}
            </button>
          ))}
        </div>

        <form className="form-grid" onSubmit={createTeam}>
          <div>
            <label className="f" htmlFor="tname">
              צוות חדש
            </label>
            <input
              id="tname"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="תוכנה"
            />
          </div>
          <div>
            <label className="f" htmlFor="noun">
              איך קוראים לפריטים (רבים)
            </label>
            <input
              id="noun"
              value={draft.itemNoun}
              onChange={(e) => setDraft({ ...draft, itemNoun: e.target.value })}
            />
          </div>
          <div>
            <label className="f" htmlFor="noun1">
              יחיד
            </label>
            <input
              id="noun1"
              value={draft.itemNounSingular}
              onChange={(e) => setDraft({ ...draft, itemNounSingular: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn primary">יצירה</button>
          </div>
        </form>
        <p className="empty" style={{ marginBottom: 0 }}>
          הצוות נוצר ריק. הגדירו לו קטגוריות ופריטים כאן, ואז שייכו אליו חברי צוות מהפרופיל שלהם.
        </p>
      </div>

      {/* Keyed on team.id so the fields remount when the active team changes.
          Without the key React reuses the same inputs, defaultValue keeps the
          previous team's text, and the next blur writes that name onto the new
          team. */}
      <div className="panel" key={team.id}>
        <h3>{team.name} — הגדרות</h3>
        <div className="form-grid">
          <div>
            <label className="f" htmlFor="rename">
              שם
            </label>
            <input id="rename" defaultValue={team.name} onBlur={(e) => renameField(e, 'name', team.name)} />
          </div>
          <div>
            <label className="f" htmlFor="rnoun">
              פריטים (רבים)
            </label>
            <input id="rnoun" defaultValue={team.itemNoun} onBlur={(e) => renameField(e, 'itemNoun', team.itemNoun)} />
          </div>
          <div>
            <label className="f" htmlFor="rnoun1">
              יחיד
            </label>
            <input
              id="rnoun1"
              defaultValue={team.itemNounSingular}
              onBlur={(e) => renameField(e, 'itemNounSingular', team.itemNounSingular)}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>קטגוריות ב{team.name}</h3>
        {order.length === 0 && <p className="empty">אין עדיין קטגוריות.</p>}
        {order.map((id, i) => (
          <div className="log-row" key={id}>
            <span className="dot" style={{ background: categories[id].header }} />
            <input
              key={`${team.id}-${id}`}
              defaultValue={categories[id].he}
              style={{ maxWidth: 200 }}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (!v || v === categories[id].he) return (e.target.value = categories[id].he)
                store.updateCategory(id, { he: v, label: v })
              }}
            />
            <span className="who">{(categories[id].items ?? []).length}</span>
            <button className="btn sm ghost" disabled={i === 0} onClick={() => store.moveCategory(id, -1)}>
              ↑
            </button>
            <button className="btn sm ghost" disabled={i === order.length - 1} onClick={() => store.moveCategory(id, 1)}>
              ↓
            </button>
            <button
              className="btn danger sm"
              onClick={() =>
                confirm(`למחוק את הקטגוריה ${categories[id].he}? הפריטים שבה יימחקו גם הם.`) &&
                store.deleteCategory(id)
              }
            >
              מחיקה
            </button>
          </div>
        ))}

        {order.some((id) => DECK_PALETTE[id]) && (
          <button
            className="btn sm"
            style={{ marginTop: 10 }}
            onClick={() =>
              order.forEach((id) => DECK_PALETTE[id] && store.updateCategory(id, DECK_PALETTE[id]))
            }
          >
            החזרת צבעי המצגת
          </button>
        )}

        <form onSubmit={addCategory} style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <input
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            placeholder="קטגוריה חדשה"
            style={{ maxWidth: 240 }}
          />
          <button className="btn">הוספה</button>
        </form>
      </div>

      <div className="panel">
        <h3>סולם ההתקדמות ב{team.name}</h3>
        <p className="empty" style={{ marginTop: 0 }}>
          סמנו מה כל דרגה דורשת. דרגה כוללת תמיד גם את כל הדרישות שלפניה.
        </p>
        {allItems.length === 0 && <p className="empty">הוסיפו קודם {team.itemNoun} בעמוד הניהול.</p>}

        {allItems.length > 0 &&
          ranks.map((rank) => {
            const req = requirement(team, ranks, rank.id)
            return (
              <div key={rank.id} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <img src={badgeSrc(rank.badge)} alt="" width={34} height={34} />
                  <strong style={{ color: rank.color }}>{rank.name}</strong>
                  <select
                    value={req.minGrade ?? ''}
                    onChange={(e) =>
                      store.setRequirement(rank.id, {
                        minGrade: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    style={{ maxWidth: 190 }}
                  >
                    {GRADES.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tool-list" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px,100%),1fr))' }}>
                  {allItems.map((item) => {
                    const on = req.items.includes(item)
                    return (
                      <button
                        key={item}
                        className={`chip${on ? '' : ' ghost'}`}
                        onClick={() => toggleReq(rank.id, item)}
                      >
                        <span className="name">{item}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
      </div>

      {teams.length > 1 && (
        <div className="panel">
          <h3>מחיקת צוות</h3>
          <p className="empty">
            מחיקת {team.name} מסירה את הקטגוריות והדרישות שלו. ההסמכות של חברי הצוות נשמרות
            בפרופילים ואינן נמחקות.
          </p>
          <button
            className="btn danger"
            onClick={() => confirm(`למחוק את הצוות ${team.name}?`) && store.deleteTeam(team.id)}
          >
            מחיקת {team.name}
          </button>
        </div>
      )}
    </>
  )
}
