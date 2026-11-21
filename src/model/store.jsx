import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { buildModel } from './logic.js'
import { sharedMemoryBackend } from './memory.js'
import { supabaseBackend } from './supabase.js'

/**
 * The tab's data: one snapshot (state) + the model built from it and
 * NeatSystem's people. `act(fn, args, okText)` runs one server action, reloads,
 * and reports the result with NeatSystem's toast.
 */
const Ctx = createContext(null)

export function TrainingsProvider({ host, children }) {
  const backend = useMemo(() => (host.mode === 'mock' ? sharedMemoryBackend() : supabaseBackend(host.supabase)), [host.mode, host.supabase])
  if (backend.use) backend.use(host)
  const [S, setS] = useState(null)
  const [error, setError] = useState(null)
  const last = useRef(0)
  const reload = useCallback(async () => {
    try { setS(await backend.load()); setError(null); last.current = Date.now() } catch (e) { setError(e) }
  }, [backend])
  useEffect(() => { void reload() }, [reload, host.me.id])
  useEffect(() => {
    const f = () => { if (Date.now() - last.current > 30_000) void reload() }
    window.addEventListener('focus', f)
    return () => window.removeEventListener('focus', f)
  }, [reload])
  const M = useMemo(() => (S ? buildModel(S, host.people, host.me.id) : null), [S, host.people, host.me.id])
  const act = useCallback(async (fn, args, ok) => {
    try {
      const r = await backend.call(fn, args)
      await reload()
      host.invalidate()
      if (ok) host.toast(ok)
      return r ?? true
    } catch (e) {
      host.toast(e?.message || 'משהו השתבש', { bad: true })
      return false
    }
  }, [backend, reload, host])
  const value = useMemo(() => ({ M, S, host, act, reload, error, me: host.me, to: host.to }), [M, S, host, act, reload, error])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useTr = () => useContext(Ctx)
