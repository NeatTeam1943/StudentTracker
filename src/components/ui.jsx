import { Link } from 'react-router-dom'

export const badgeSrc = (badge) => `${import.meta.env.BASE_URL}assets/badges/${badge}.png`
export const wordmarkSrc = (rankId) => `${import.meta.env.BASE_URL}assets/wordmarks/${rankId}.png`
const teachIcon = `${import.meta.env.BASE_URL}assets/teach.png`

export function RankBadge({ rank, size = 108 }) {
  if (!rank) return <div style={{ width: size, height: size }} />
  return (
    <img src={badgeSrc(rank.badge)} alt={rank.name} width={size} height={size} style={{ objectFit: 'contain' }} />
  )
}

/**
 * One tool. Guests see only what the person holds, exactly as the deck shows it.
 * Mentors also see the tools they don't hold, as dashed outlines they can tap.
 */
export function ToolChip({ tool, held, canEdit, onToggleHeld, onToggleTeach }) {
  if (!held) {
    if (!canEdit) return null
    return (
      <button className="chip ghost editable" onClick={onToggleHeld} title={`הסמכה ל${tool}`}>
        <span className="name">{tool}</span>
      </button>
    )
  }

  const canTeach = held.canTeach
  const when = held.at ? new Date(held.at).toLocaleDateString('he-IL') : null

  return (
    <div className={`chip${canEdit ? ' editable' : ''}`} title={when ? `הוסמך ${when}` : tool}>
      {(canTeach || canEdit) && (
        <button
          type="button"
          className={`teach-btn ${canTeach ? 'on' : 'off'}`}
          disabled={!canEdit}
          onClick={onToggleTeach}
          aria-pressed={canTeach}
          aria-label={`${tool} — מלמד אחרים`}
        >
          <img className="teach" src={teachIcon} alt="" />
        </button>
      )}
      <span className="name">{tool}</span>
      {canEdit && (
        <button
          type="button"
          className="drop-btn"
          // A stray tap here would erase a certification, so it asks first.
          onClick={() => confirm(`לבטל את ההסמכה ל${tool}?`) && onToggleHeld()}
          aria-label={`בטל הסמכה ל${tool}`}
        >
          ✕
        </button>
      )}
    </div>
  )
}

export function ToolColumns({ membership, categories, order, canEdit, onToggleHeld, onToggleTeach }) {
  const held = (t) => membership?.items?.[t]
  const count = (id) => (categories[id].items ?? []).filter(held).length

  return (
    <>
      {/* On a phone the five categories stack, so this is how you reach
          HEAVY MACHINERY without scrolling past thirty tools. */}
      {/* Buttons, not anchors. Under HashRouter the URL hash IS the route, so an
          href="#cat-x" navigates to a route that doesn't exist and blanks the
          page. scrollIntoView does the same job without touching the URL. */}
      <nav className="jump" aria-label="קטגוריות">
        {order.map((id) => (
          <button
            key={id}
            type="button"
            style={{ background: categories[id].header }}
            onClick={() =>
              document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            {categories[id].he} · {count(id)}/{(categories[id].items ?? []).length}
          </button>
        ))}
      </nav>
      <div className="columns">
      {order.map((id) => {
        const cat = categories[id]
        return (
          <section
            key={id}
            id={`cat-${id}`}
            className="column"
            style={{ '--tint': cat.tint, '--hdr': cat.header }}
            aria-label={cat.he}
          >
            <h3>{cat.label}</h3>
            <div className="rule" />
            <div className="tool-list">
              {(cat.items ?? []).map((tool) => (
                <ToolChip
                  key={tool}
                  tool={tool}
                  held={held(tool)}
                  canEdit={canEdit}
                  onToggleHeld={() => onToggleHeld(tool, Boolean(held(tool)))}
                  onToggleTeach={() => onToggleTeach(tool, !held(tool)?.canTeach)}
                />
              ))}
            </div>
          </section>
        )
      })}
      </div>
    </>
  )
}

export function IdCard({ person, rank }) {
  return (
    <aside className="id-card">
      <div className="card-top">
        <div className="who">
          <h2>{person.name}</h2>
          <div className="role">{person.role}</div>
        </div>
        {rank && (
          <div className="badge-slot">
            <img className="wordmark" src={wordmarkSrc(rank.id)} alt="" />
            <img className="badge" src={badgeSrc(rank.badge)} alt={rank.name} />
          </div>
        )}
      </div>
      <hr />
      {person.phone && (
        <div className="field">
          <span className="ico">☎</span>
          <span className="lbl">טלפון:</span>
          <a className="val" href={`tel:${person.phone.replace(/-/g, '')}`}>
            {person.phone}
          </a>
        </div>
      )}
      <div className="field">
        <span className="ico">🎓</span>
        <span className="lbl">שכבה:</span>
        <span className="val">{person.grade}</span>
      </div>
      {person.favoriteTool && (
        <div className="field">
          <span className="ico">🛠</span>
          <span className="lbl">כלי אהוב:</span>
          <span className="val">{person.favoriteTool}</span>
        </div>
      )}
      {person.nickname && (
        <div className="field">
          <span className="ico">🏷</span>
          <span className="lbl">כינוי:</span>
          <span className="val">"{person.nickname}"</span>
        </div>
      )}
    </aside>
  )
}

export function PersonCard({ person, rank, membership }) {
  const items = membership?.items ?? {}
  const teaches = Object.values(items).filter((t) => t?.canTeach).length
  return (
    <Link to={`/p/${person.id}`} className="card">
      <RankBadge rank={rank} size={58} />
      <div>
        <div className="nm">{person.name}</div>
        {rank && (
          <div className="rk" style={{ color: rank.color }}>
            {rank.name}
          </div>
        )}
        <div className="meta">
          {person.role} · {Object.keys(items).length} הסמכות
        </div>
      </div>
      {teaches > 0 && <span className="flag">מלמד {teaches}</span>}
    </Link>
  )
}
