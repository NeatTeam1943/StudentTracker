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
  const canTeach = held?.canTeach

  if (!held) {
    if (!canEdit) return null
    return (
      <button className="chip ghost editable" onClick={onToggleHeld} title={`הסמכה ל${tool}`}>
        <span className="name">{tool}</span>
      </button>
    )
  }

  const title = held.at ? `הוסמך ${new Date(held.at).toLocaleDateString('he-IL')}` : tool

  return (
    <div className={`chip${canEdit ? ' editable' : ''}`} title={title}>
      {(canTeach || canEdit) && (
        <button
          type="button"
          className={`teach-btn${canTeach ? '' : ' off'}`}
          disabled={!canEdit}
          onClick={onToggleTeach}
          aria-label={canTeach ? `${tool}: מלמד אחרים` : `${tool}: סמן כמלמד אחרים`}
        >
          <img className="teach" src={teachIcon} alt="" />
        </button>
      )}
      <span className="name">{tool}</span>
      {canEdit && (
        <button type="button" className="teach-btn" onClick={onToggleHeld} aria-label={`בטל הסמכה ל${tool}`}>
          ✕
        </button>
      )}
    </div>
  )
}

export function ToolColumns({ person, categories, order, canEdit, onToggleHeld, onToggleTeach }) {
  return (
    <div className="columns">
      {order.map((id) => {
        const cat = categories[id]
        return (
          <section
            key={id}
            className="column"
            style={{ '--tint': cat.tint, '--hdr': cat.header }}
            aria-label={cat.he}
          >
            <h3>{cat.label}</h3>
            <div className="rule" />
            {cat.tools.map((tool) => (
              <ToolChip
                key={tool}
                tool={tool}
                held={person.tools?.[tool]}
                canEdit={canEdit}
                onToggleHeld={() => onToggleHeld(tool, Boolean(person.tools?.[tool]))}
                onToggleTeach={() => onToggleTeach(tool, !person.tools?.[tool]?.canTeach)}
              />
            ))}
          </section>
        )
      })}
    </div>
  )
}

export function IdCard({ person, rank }) {
  return (
    <aside className="id-card">
      <div className="badge-slot">
        {rank && <img className="wordmark" src={wordmarkSrc(rank.id)} alt={rank.name} />}
        <RankBadge rank={rank} />
      </div>
      <h2>{person.name}</h2>
      <div className="role">{person.role}</div>
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
        <span className="lbl">שכבת לימודים:</span>
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

export function PersonCard({ person, rank }) {
  const teaches = Object.values(person.tools ?? {}).filter((t) => t?.canTeach).length
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
          {person.role} · {Object.keys(person.tools ?? {}).length} כלים
        </div>
      </div>
      {teaches > 0 && <span className="flag">מלמד {teaches}</span>}
    </Link>
  )
}
