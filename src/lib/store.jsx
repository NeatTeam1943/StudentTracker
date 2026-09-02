import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDoc,
  serverTimestamp,
  deleteField,
  FieldPath,
} from 'firebase/firestore'
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth'
import { db, auth, googleProvider } from './firebase.js'
import { CATEGORIES, CATEGORY_ORDER, RANKS, SEED_PEOPLE } from '../data/seed.js'

/*
 * Every read and write in the app goes through this module.
 *
 * Shape in Firestore:
 *   people/{id}    one document per person, tools as a map inside it
 *   meta/catalog   categories, their order, and the rank ladder
 *   mentors/{uid}  existence means this signed-in user can write
 *   events/{id}    append-only log; rules forbid update and delete
 *
 * Tools live inside the person document on purpose: the roster reads every
 * person once, so it costs one read per person rather than one per certification.
 */

const Ctx = createContext(null)
const stamp = () => new Date().toISOString()

export function StoreProvider({ children }) {
  const [people, setPeople] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [events, setEvents] = useState([])
  const [user, setUser] = useState(null)
  const [isMentor, setIsMentor] = useState(false)
  const [error, setError] = useState(null)

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'people'),
        (snap) => setPeople(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        setError,
      ),
    [],
  )

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'meta', 'catalog'),
        (snap) =>
          setCatalog(
            snap.exists() ? snap.data() : { categories: CATEGORIES, order: CATEGORY_ORDER, ranks: RANKS },
          ),
        setError,
      ),
    [],
  )

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'events'), orderBy('at', 'desc'), limit(300)), (snap) =>
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
    [],
  )

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u)
        if (!u) return setIsMentor(false)
        const m = await getDoc(doc(db, 'mentors', u.uid))
        setIsMentor(m.exists())
      }),
    [],
  )

  const api = useMemo(() => {
    const list = people ?? []
    const categories = catalog?.categories ?? CATEGORIES
    const personRef = (id) => doc(db, 'people', id)
    const find = (id) => list.find((p) => p.id === id)

    const log = (entry) =>
      addDoc(collection(db, 'events'), {
        at: serverTimestamp(),
        by: user?.displayName ?? user?.email ?? '—',
        byUid: user?.uid ?? null,
        ...entry,
      })

    const saveCatalog = (next, entry) =>
      setDoc(doc(db, 'meta', 'catalog'), next, { merge: true }).then(() => entry && log(entry))

    return {
      people: list,
      events,
      categories,
      order: catalog?.order ?? CATEGORY_ORDER,
      ranks: catalog?.ranks ?? RANKS,
      loading: people === null || catalog === null,
      error,
      user,
      isMentor,
      person: find,

      signIn: () => signInWithPopup(auth, googleProvider),
      signOut: () => fbSignOut(auth),

      async grantTool(id, tool) {
        await updateDoc(personRef(id), new FieldPath('tools', tool), {
          at: stamp(),
          by: user?.displayName ?? '—',
          canTeach: false,
          teachAt: null,
        })
        await log({ type: 'tool_granted', personId: id, tool })
      },

      async revokeTool(id, tool) {
        await updateDoc(personRef(id), new FieldPath('tools', tool), deleteField())
        await log({ type: 'tool_revoked', personId: id, tool })
      },

      async setCanTeach(id, tool, value) {
        const current = find(id)?.tools?.[tool] ?? {}
        await updateDoc(personRef(id), new FieldPath('tools', tool), {
          ...current,
          canTeach: value,
          teachAt: value ? stamp() : null,
        })
        await log({ type: value ? 'teach_granted' : 'teach_revoked', personId: id, tool })
      },

      async setRank(id, rankId, manual) {
        const p = find(id)
        if (!p || p.rankId === rankId) return
        await updateDoc(personRef(id), { rankId })
        await log({ type: manual ? 'rank_set' : 'promoted', personId: id, from: p.rankId ?? null, to: rankId })
      },

      async savePerson(person) {
        const exists = list.some((p) => p.id === person.id)
        const { id, ...rest } = person
        await setDoc(personRef(id), rest, { merge: true })
        await log({ type: exists ? 'person_updated' : 'person_added', personId: id, name: person.name })
      },

      async removePerson(id) {
        const name = find(id)?.name
        await deleteDoc(personRef(id))
        await log({ type: 'person_removed', personId: id, name })
      },

      async addTool(categoryId, tool) {
        if (categories[categoryId].tools.includes(tool)) return
        const cats = structuredClone(categories)
        cats[categoryId].tools.push(tool)
        await saveCatalog({ categories: cats }, { type: 'tool_created', tool, category: categoryId })
      },

      async renameTool(categoryId, from, to) {
        const cats = structuredClone(categories)
        cats[categoryId].tools = cats[categoryId].tools.map((t) => (t === from ? to : t))
        await saveCatalog({ categories: cats }, { type: 'tool_renamed', tool: to, from })
        await Promise.all(
          list
            .filter((p) => p.tools?.[from])
            .map(async (p) => {
              await updateDoc(personRef(p.id), new FieldPath('tools', to), p.tools[from])
              await updateDoc(personRef(p.id), new FieldPath('tools', from), deleteField())
            }),
        )
      },

      async moveTool(tool, toCategory) {
        const cats = structuredClone(categories)
        for (const [id, c] of Object.entries(cats)) {
          c.tools = c.tools.filter((t) => t !== tool)
          if (id === toCategory) c.tools.push(tool)
        }
        await saveCatalog({ categories: cats }, { type: 'tool_moved', tool, category: toCategory })
      },

      async deleteTool(tool) {
        const cats = structuredClone(categories)
        for (const c of Object.values(cats)) c.tools = c.tools.filter((t) => t !== tool)
        await saveCatalog({ categories: cats }, { type: 'tool_deleted', tool })
        await Promise.all(
          list
            .filter((p) => p.tools?.[tool])
            .map((p) => updateDoc(personRef(p.id), new FieldPath('tools', tool), deleteField())),
        )
      },

      saveRanks: (ranks) => saveCatalog({ ranks }, { type: 'ladder_updated' }),

      /*
       * One-time import of the data extracted from the source deck. Runs as the
       * signed-in mentor through the normal rules — no admin credentials.
       * The button that calls this only appears while the roster is empty.
       */
      async importFromDeck() {
        const at = new Date().toISOString()
        await saveCatalog({ categories: CATEGORIES, order: CATEGORY_ORDER, ranks: RANKS })
        for (const person of SEED_PEOPLE) {
          const { id, tools, ...rest } = person
          // The deck records that someone holds a tool and whether they teach it,
          // but not when. Import date is the honest placeholder; every date after
          // this one is real.
          const withDates = Object.fromEntries(
            Object.entries(tools).map(([tool, canTeach]) => [
              tool,
              { at, by: 'ייבוא מהמצגת', canTeach, teachAt: canTeach ? at : null },
            ]),
          )
          await setDoc(doc(db, 'people', id), { ...rest, tools: withDates })
        }
        await log({ type: 'deck_imported', count: SEED_PEOPLE.length })
      },
    }
  }, [people, catalog, events, user, isMentor, error])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
