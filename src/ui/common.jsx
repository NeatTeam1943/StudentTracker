import { useState } from 'react'
import {
  Award, BadgeCheck, Box, Braces, Check, Code, Cog, Cpu, Factory, Hammer, Layers, Lock, PencilRuler, Rocket, Shapes, Star, Wrench, Zap,
} from 'lucide-react'
import { Button, Sheet } from '@neatsystem/kit'
import { useTr } from '../model/store.jsx'
import teachPng from '../assets/teach.png'
import logoPng from '../assets/logo.png'

const badges = import.meta.glob('../assets/badges/*.png', { eager: true, query: '?url', import: 'default' })
const wordmarks = import.meta.glob('../assets/wordmarks/*.png', { eager: true, query: '?url', import: 'default' })
export const badgeOf = (r) => (r ? badges[`../assets/badges/${r.badge}.png`] : null)
export const wordmarkOf = (r) => (r ? wordmarks[`../assets/wordmarks/${r.wordmark}.png`] : null)
export const brand = { teach: teachPng, logo: logoPng }

/** A rank's badge (or an empty circle). */
export function RankMark({ rank, size = 40 }) {
  return rank ? <img src={badgeOf(rank)} alt={rank.name} title={rank.name} width={size} height={size} style={{ objectFit: 'contain', flex: 'none' }} />
    : <span style={{ width: size, height: size, flex: 'none', borderRadius: '50%', background: 'var(--bg-subtle)', display: 'inline-block' }} />
}

export const PASTELS = [['#CDEFE0', '#1E6B4A'], ['#CBEEEC', '#12675F'], ['#D3E9F8', '#1F5F8B'], ['#D8DEFF', '#2E3AA8'], ['#E3DBFF', '#4B2BB8'], ['#EED8F7', '#6E2390'],
  ['#F9D9E8', '#9A2A5E'], ['#F9D6DC', '#9E2338'], ['#FBE0D0', '#8F3F12'], ['#FBEFC4', '#7A5A00'], ['#F1F3C2', '#5E6400'], ['#E2F2C8', '#3F6B12'], ['#F1E7D3', '#6B4F1D']]
const CAT_COLOR = { build: 12, software: 1, cad: 4 }
const ICONS = { hammer: Hammer, wrench: Wrench, zap: Zap, factory: Factory, code: Code, cpu: Cpu, braces: Braces, rocket: Rocket, 'pencil-ruler': PencilRuler, shapes: Shapes, box: Box, layers: Layers, cog: Cog, award: Award, star: Star }
const LEVEL_ICONS = { build: ['wrench', 'hammer', 'zap', 'cog', 'factory', 'star'], software: ['code', 'cpu', 'braces', 'layers', 'rocket', 'star'], cad: ['pencil-ruler', 'shapes', 'box', 'layers', 'cog', 'star'] }
export const colorOf = (catId) => PASTELS[CAT_COLOR[catId] ?? 9]
export function iconOf(M, item) {
  const name = item.icon ?? (LEVEL_ICONS[item.category] ?? ['award', 'star', 'cog', 'zap', 'rocket', 'star'])[Math.min(5, M.levelOf(item))]
  return ICONS[name] ?? Award
}

/** An item as a round node (map, lists). */
export function Node({ item, state = 'open', size = 64, label = true, early, onClick }) {
  const { M } = useTr()
  const [p0, p1] = colorOf(item.category)
  const I = state === 'locked' ? Lock : iconOf(M, item)
  return (
    <button type="button" className="nodewrap" onClick={onClick} style={{ width: size + 32 }} aria-label={`${item.name} · ${({ locked: 'נעול', open: 'פתוח ללמידה', held: 'מוסמך/ת' })[state]}`}>
      <span className={`node ${state}`} style={{ width: size, height: size, '--p0': p0, '--p1': p1 }}>
        <I size={Math.round(size * 0.44)} aria-hidden />
        {state === 'held' && <span className={`nbadge ${early ? 'early' : ''}`}>{early ? <Zap size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}</span>}
      </span>
      {label && <span className="nlabel">{item.name}</span>}
    </button>
  )
}

export function Progress({ value, max, warn }) {
  return <div className={`tprog${warn ? ' warn' : ''}`} role="progressbar" aria-valuenow={value} aria-valuemax={max}><i style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%` }} /></div>
}

/** "Are you sure?" in the kit's sheet. */
export function Confirm({ title, text, ok = 'אישור', danger, onOk, onClose }) {
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title={title} onClose={onClose} footer={<>
      <Button onClick={onClose}>ביטול</Button>
      <Button variant={danger ? 'danger' : 'primary'} busy={busy} onClick={async () => { setBusy(true); await onOk(); setBusy(false); onClose() }}>{ok}</Button>
    </>}>
      <p className="c2" style={{ margin: 0 }}>{text}</p>
    </Sheet>
  )
}

/** The "teaches others" toggle (the deck's light-bulb icon). */
export function Teach({ on, edit, onChange, label }) {
  if (!on && !edit) return <span className="teach" style={{ visibility: 'hidden' }} aria-hidden><img src={brand.teach} alt="" /></span>
  return <button type="button" className={`teach${on ? ' on' : ''}`} disabled={!edit} onClick={onChange} aria-pressed={!!on} aria-label={label} title={on ? 'מלמד/ת אחרים' : 'לא מלמד/ת'}><img src={brand.teach} alt="" /></button>
}

/** grant / revoke / teach with the right toast */
export function useGrant() {
  const { M, act } = useTr()
  return {
    grant: (uid, item) => act('grant', { p_user: uid, p_item: item.id }, M.stateOf(uid, item) === 'locked' ? `${M.nameOf(uid)} הוסמך/ה ל${item.name} (פתיחה מוקדמת)` : `${M.nameOf(uid)} הוסמך/ה ל${item.name}`),
    revoke: (uid, item) => act('revoke', { p_user: uid, p_item: item.id }, `ההסמכה ל${item.name} בוטלה`),
    teach: (uid, item, on) => act('set_teach', { p_user: uid, p_item: item.id, p_on: on }, on ? `${M.nameOf(uid)} מלמד/ת ${item.name}` : null),
  }
}

export const roleLine = (M, u) => [u.status === 'archived' ? 'עזב/ה את הקבוצה' : ({ rookie: 'רוקי', member: 'חבר/ת צוות', team_lead: 'רש"צ', captain: 'קפטן/ית', mentor: 'מנטור/ית' })[u.position], M.gradeLabel(u)].filter(Boolean).join(' · ')
export const fmtShort = (d) => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
export { BadgeCheck }
