import { useState } from 'react'
import { useStore } from '../lib/store.jsx'

export default function ToolAdmin() {
  const store = useStore()
  const { categories, order, people } = store
  const [draft, setDraft] = useState({ category: order[0], name: '' })
  const [renaming, setRenaming] = useState(null)

  if (!store.isMentor)
    return (
      <div className="panel">
        <h3>נדרשת הרשאת מנטור</h3>
        <p className="empty">התחברו כמנטור כדי לנהל את רשימת הכלים.</p>
      </div>
    )

  const holders = (tool) => people.filter((p) => p.tools?.[tool]).length

  const add = (e) => {
    e.preventDefault()
    if (!draft.name.trim()) return
    store.addTool(draft.category, draft.name.trim())
    setDraft({ ...draft, name: '' })
  }

  const remove = (tool) => {
    const n = holders(tool)
    const warning = n
      ? `${tool} מוסמך אצל ${n} חברי צוות. מחיקה תסיר את ההסמכה מכולם.`
      : `למחוק את ${tool}?`
    if (confirm(warning)) store.deleteTool(tool)
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>ניהול כלים</h1>
          <div className="sub">שינוי כאן משפיע על כל הפרופילים ועל סולם ההתקדמות</div>
        </div>
      </div>

      <form className="panel" onSubmit={add}>
        <h3>הוספת כלי</h3>
        <div className="form-grid">
          <div>
            <label className="f" htmlFor="cat">
              קטגוריה
            </label>
            <select id="cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {order.map((id) => (
                <option key={id} value={id}>
                  {categories[id].he}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f" htmlFor="tool">
              שם הכלי
            </label>
            <input id="tool" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn primary">הוספה</button>
          </div>
        </div>
      </form>

      {order.map((catId) => (
        <div className="panel" key={catId}>
          <h3>
            {categories[catId].he} <span style={{ color: 'var(--muted)', fontSize: 14 }}>{categories[catId].label}</span>
          </h3>
          <table>
            <thead>
              <tr>
                <th>כלי</th>
                <th>מוסמכים</th>
                <th>העברה לקטגוריה</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories[catId].tools.map((tool) => (
                <tr key={tool}>
                  <td>
                    {renaming === tool ? (
                      <input
                        autoFocus
                        defaultValue={tool}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v && v !== tool) store.renameTool(catId, tool, v)
                          setRenaming(null)
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                      />
                    ) : (
                      <button className="btn ghost sm" onClick={() => setRenaming(tool)}>
                        {tool}
                      </button>
                    )}
                  </td>
                  <td>{holders(tool)}</td>
                  <td>
                    <select value={catId} onChange={(e) => store.moveTool(tool, e.target.value)}>
                      {order.map((id) => (
                        <option key={id} value={id}>
                          {categories[id].he}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="btn danger sm" onClick={() => remove(tool)}>
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
