import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { badgeSrc, wordmarkSrc } from './ui.jsx'

/*
 * The profile exactly as the source deck draws it.
 *
 * Every number below is measured from רישיון בנאי.pptx, scaled onto a fixed
 * 1456 x 819 canvas (the slide is 12192000 x 6858000 EMU). The canvas is then
 * scaled with a CSS transform to fit whatever space it's given, so the layout
 * never reflows and the proportions stay exactly as designed.
 */

export const SLIDE_W = 1456
export const SLIDE_H = 819

// Column panels, left to right, as they sit on the slide.
const COLUMN_X = [22.2, 206.5, 390.8, 575.2, 759.0]
const COLUMN_W = 175
const COLUMN_Y = 109.3
const COLUMN_H = 663.9
const HEADER_Y = 127
const HEADER_W = 148
const HEADER_H = 36.1
const CHIP_W = 156
const CHIP_H = 40.3
const CHIP_Y0 = 192.2
const CHIP_STEP = 51.6

const CARD = { x: 982.5, y: 108.1, w: 431.6, h: 347.1 }
const LOGBOX = { x: 1005.5, y: 479.5, w: 385.7, h: 301.7 }

const FIELD_Y = { phone: 261.8, grade: 306.6, tool: 346.9, nick: 391.5 }

/**
 * Scale the fixed canvas into whatever room is actually available.
 *
 * The height is measured from the element's own position rather than assumed,
 * because the header is a different height on every phone once the nav wraps,
 * and 100vh lies on mobile browsers while the URL bar is showing.
 */
function useFitScale(mode, zoom) {
  const ref = useRef(null)
  const [base, setBase] = useState(0.25)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const box = el.getBoundingClientRect()
      const vh = window.visualViewport?.height ?? window.innerHeight
      const avail = Math.max(220, vh - box.top - 12)
      const width = box.width || window.innerWidth
      const b = mode === 'fill' ? avail / SLIDE_H : Math.min(width / SLIDE_W, avail / SLIDE_H)
      setBase(b)
      // Only claim the height the slide actually needs, so an unzoomed portrait
      // view doesn't leave a screenful of empty space under it.
      el.style.height = `${Math.min(avail, SLIDE_H * b * zoom + 4)}px`
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [mode, zoom])

  return { ref, scale: base * zoom }
}

function LogPanel({ events, personId, ranks }) {
  const rows = events.filter((e) => e.personId === personId).slice(0, 8)
  const rankName = (id) => ranks.find((r) => r.id === id)?.name ?? '—'

  const line = (e) => {
    switch (e.type) {
      case 'tool_granted':
        return `הוסמך ל${e.tool}`
      case 'tool_revoked':
        return `בוטלה ההסמכה ל${e.tool}`
      case 'teach_granted':
        return `הוסמך ללמד ${e.tool}`
      case 'teach_revoked':
        return `הפסיק ללמד ${e.tool}`
      case 'promoted':
        return `קודם ל${rankName(e.to)}`
      case 'rank_set':
        return `דרגה נקבעה ל${rankName(e.to)}`
      case 'team_joined':
        return 'צורף לצוות'
      case 'team_transferred':
        return 'הועבר לצוות אחר'
      case 'person_added':
        return 'נוסף לצוות'
      case 'person_updated':
        return 'עודכנו הפרטים'
      default:
        return e.type
    }
  }

  return (
    <div className="deck-log" style={{ left: LOGBOX.x, top: LOGBOX.y, width: LOGBOX.w, height: LOGBOX.h }}>
      <div className="deck-log-head">
        <span>יומן</span>
        <Link to={`/logs?person=${personId}`}>הכל ←</Link>
      </div>
      {rows.length === 0 && <p className="deck-log-empty">אין עדיין רישומים.</p>}
      {rows.map((e) => (
        <div className="deck-log-row" key={e.id}>
          <time>{e.at?.toDate ? e.at.toDate().toLocaleDateString('he-IL') : '…'}</time>
          <span>{line(e)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DeckSlide({ person, membership, rank, categories, order, mode, events, ranks }) {
  // Fitting a 1456px slide onto a phone makes the text tiny, so it can be
  // zoomed and dragged rather than only squinted at.
  const [zoom, setZoom] = useState(1)
  const { ref, scale } = useFitScale(mode, zoom)

  useEffect(() => setZoom(1), [mode])

  return (
    <>
      <div className="deck-zoom">
        <button className="btn sm" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(2)))} disabled={zoom <= 1}>
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="btn sm" onClick={() => setZoom((z) => Math.min(6, +(z + 0.5).toFixed(2)))} disabled={zoom >= 6}>
          +
        </button>
      </div>
      <div
        className={`deck-view ${mode}`}
        ref={ref}
        onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))}
      >
      <div
        className="deck-canvas-box"
        style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}
      >
        <div
          className="deck-canvas"
          style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}
        >
          <img className="deck-logo" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="Neat Team" />
          <h1 className="deck-title">פרופיל הסמכות והרשאות</h1>

          {order.map((id, i) => {
            const cat = categories[id]
            if (!cat || i >= COLUMN_X.length) return null
            const held = (cat.items ?? []).filter((t) => membership?.items?.[t])
            return (
              // A Fragment, not a div: a wrapper element here becomes the
              // positioned child and every column collapses onto one spot.
              <Fragment key={id}>
                <div
                  className="deck-col"
                  style={{
                    left: COLUMN_X[i],
                    top: COLUMN_Y,
                    width: COLUMN_W,
                    height: COLUMN_H,
                    '--tint': cat.tint,
                  }}
                />
                <div
                  className="deck-col-head"
                  style={{
                    left: COLUMN_X[i] + (COLUMN_W - HEADER_W) / 2,
                    top: HEADER_Y,
                    width: HEADER_W,
                    height: HEADER_H,
                    background: cat.header,
                  }}
                >
                  {cat.label}
                </div>
                <div
                  className="deck-rule"
                  style={{ left: COLUMN_X[i] + 8, top: HEADER_Y + HEADER_H + 14, width: COLUMN_W - 16 }}
                />
                {/* The deck shows only what someone holds — never the gaps. */}
                {held.map((tool, n) => (
                  <div
                    key={tool}
                    className="deck-chip"
                    style={{
                      left: COLUMN_X[i] + (COLUMN_W - CHIP_W) / 2,
                      top: CHIP_Y0 + n * CHIP_STEP,
                      width: CHIP_W,
                      height: CHIP_H,
                    }}
                  >
                    {membership.items[tool]?.canTeach && (
                      <img className="deck-teach" src={`${import.meta.env.BASE_URL}assets/teach.png`} alt="" />
                    )}
                    <span>{tool}</span>
                  </div>
                ))}
              </Fragment>
            )
          })}

          <div className="deck-card" style={{ left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h }} />
          {rank && (
            <>
              <img className="deck-wordmark" src={wordmarkSrc(rank.id)} alt="" />
              <img className="deck-badge" src={badgeSrc(rank.badge)} alt={rank.name} />
            </>
          )}
          <div className="deck-name">{person.name}</div>
          <div className="deck-role">{person.role}</div>
          <div className="deck-divider" />

          <div className="deck-field" style={{ top: FIELD_Y.phone }}>
            <span className="lbl">טלפון:</span>
            <span className="val">{person.phone}</span>
          </div>
          <div className="deck-field" style={{ top: FIELD_Y.grade }}>
            <span className="lbl">שכבת לימודים:</span>
            <span className="val">{person.grade}</span>
          </div>
          <div className="deck-field" style={{ top: FIELD_Y.tool }}>
            <span className="lbl">כלי אהוב:</span>
            <span className="val">{person.favoriteTool}</span>
          </div>
          <div className="deck-field" style={{ top: FIELD_Y.nick }}>
            <span className="lbl">כינוי:</span>
            <span className="val">{person.nickname ? `"${person.nickname}"` : ''}</span>
          </div>

          <LogPanel events={events} personId={person.id} ranks={ranks} />
        </div>
        </div>
      </div>
    </>
  )
}

/** True while the device is wider than it is tall. */
export function useLandscape() {
  const [landscape, setLandscape] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight,
  )
  useEffect(() => {
    const on = () => setLandscape(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
    }
  }, [])
  return landscape
}
