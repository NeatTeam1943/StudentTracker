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
import { CATEGORIES, CATEGORY_ORDER, RANKS, BUILD_REQUIREMENTS, SEED_PEOPLE } from '../data/seed.js'

/*
 * Every read and write in the app goes through this module.
 *
 * Firestore layout:
 *   teams/{id}     one sub-team: its categories, its items, its requirements
 *   meta/catalog   the eight ranks — global, shared by every team
 *   people/{id}    a person, with one membership per team they belong to
 *   mentors/{uid}  existence means this signed-in user can write
 *   mentorRequests pending access requests, one per uid
 *   events/{id}    append-only log; rules forbid update and delete
 *
 * Ranks are global; what a rank *requires* is per team, because בנייה is
 * measured in tools and תוכנה in הכשרות. A person's rank and record live inside
 * their membership, so the same person can be ניטמאסטר on one team and ניט on
 * another. Items live inside the person document so the roster costs one read
 * per person rather than one per certification.
 */

const Ctx = createContext(null)
const stamp = () => new Date().toISOString()
const TEAM_KEY = 'neat-tools:team'

// Used to seed the first team from the deck, and as a fallback before load.
export const BUILD_TEAM = {
  id: 'build',
  name: 'בנייה',
  itemNoun: 'כלים',
  itemNounSingular: 'כלי',
  sort: 0,
  categories: CATEGORIES,
  order: CATEGORY_ORDER,
  requirements: BUILD_REQUIREMENTS,
}

export function StoreProvider({ children }) {
  const [people, setPeople] = useState(null)
  const [teams, setTeams] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [events, setEvents] = useState([])
  const [mentors, setMentors] = useState([])
  const [requests, setRequests] = useState([])
  const [user, setUser] = useState(null)
  const [isMentor, setIsMentor] = useState(false)
  const [error, setError] = useState(null)
  const [teamId, setTeamId] = useState(() => {
    try {
      return localStorage.getItem(TEAM_KEY) || 'build'
    } catch {
      return 'build'
    }
  })

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
        collection(db, 'teams'),
        (snap) =>
          setTeams(
            snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
          ),
        setError,
      ),
    [],
  )

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'meta', 'catalog'),
        (snap) => setCatalog(snap.exists() ? snap.data() : { ranks: RANKS }),
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
    () => onSnapshot(collection(db, 'mentors'), (snap) => setMentors(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))),
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

  // Pending requests are a mentor-only read, so only subscribe once approved.
  useEffect(() => {
    if (!isMentor) return setRequests([])
    return onSnapshot(collection(db, 'mentorRequests'), (snap) =>
      setRequests(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    )
  }, [isMentor])

  const api = useMemo(() => {
    const list = people ?? []
    const teamList = teams?.length ? teams : [BUILD_TEAM]
    const team = teamList.find((t) => t.id === teamId) ?? teamList[0]
    const categories = team.categories ?? {}

    const personRef = (id) => doc(db, 'people', id)
    const find = (id) => list.find((p) => p.id === id)

    const log = (entry) =>
      addDoc(collection(db, 'events'), {
        at: serverTimestamp(),
        by: user?.displayName ?? user?.email ?? '—',
        byUid: user?.uid ?? null,
        ...entry,
      })

    const saveTeam = (id, next, entry) =>
      setDoc(doc(db, 'teams', id), next, { merge: true }).then(() => entry && log(entry))

    return {
      people: list,
      events,
      teams: teamList,
      team,
      teamId: team.id,
      categories,
      order: team.order ?? [],
      ranks: catalog?.ranks ?? RANKS,
      loading: people === null || teams === null || catalog === null,
      error,
      user,
      isMentor,
      mentors,
      requests,
      person: find,

      // Active members of the team being viewed. An inactive membership keeps
      // its full record but drops off the roster.
      roster: list.filter((p) => p.memberships?.[team.id]?.active !== false && p.memberships?.[team.id]),
      alumni: list.filter((p) => p.memberships?.[team.id]?.active === false),

      setTeam(id) {
        setTeamId(id)
        try {
          localStorage.setItem(TEAM_KEY, id)
        } catch {
          /* private browsing — the choice just won't persist */
        }
      },

      signIn: () => signInWithPopup(auth, googleProvider),
      signOut: () => fbSignOut(auth),

      // --- certifications, scoped to the active team ------------------------

      async grantTool(id, item) {
        await updateDoc(personRef(id), new FieldPath('memberships', team.id, 'items', item), {
          at: stamp(),
          by: user?.displayName ?? '—',
          canTeach: false,
          teachAt: null,
        })
        await log({ type: 'tool_granted', personId: id, tool: item, teamId: team.id })
      },

      async revokeTool(id, item) {
        await updateDoc(personRef(id), new FieldPath('memberships', team.id, 'items', item), deleteField())
        await log({ type: 'tool_revoked', personId: id, tool: item, teamId: team.id })
      },

      async setCanTeach(id, item, value) {
        const current = find(id)?.memberships?.[team.id]?.items?.[item] ?? {}
        await updateDoc(personRef(id), new FieldPath('memberships', team.id, 'items', item), {
          ...current,
          canTeach: value,
          teachAt: value ? stamp() : null,
        })
        await log({ type: value ? 'teach_granted' : 'teach_revoked', personId: id, tool: item, teamId: team.id })
      },

      async setRank(id, rankId, manual) {
        const before = find(id)?.memberships?.[team.id]?.rankId ?? null
        if (before === rankId) return
        await updateDoc(personRef(id), new FieldPath('memberships', team.id, 'rankId'), rankId)
        await log({
          type: manual ? 'rank_set' : 'promoted',
          personId: id,
          from: before,
          to: rankId,
          teamId: team.id,
        })
      },

      // --- team membership --------------------------------------------------

      async joinTeam(id, targetTeamId) {
        const existing = find(id)?.memberships?.[targetTeamId]
        if (existing) {
          // Rejoining: the old rank and record are still there, just reactivated.
          await updateDoc(personRef(id), new FieldPath('memberships', targetTeamId, 'active'), true)
        } else {
          await updateDoc(personRef(id), new FieldPath('memberships', targetTeamId), {
            rankId: null,
            items: {},
            active: true,
            joinedAt: stamp(),
          })
        }
        await log({ type: 'team_joined', personId: id, teamId: targetTeamId })
      },

      /* Going inactive is not leaving. The rank freezes where it is, every
         certification stays, and they still count as able to teach what they
         could teach — they didn't forget how. They just stop earning new ranks
         here and drop off this roster. */
      async setTeamActive(id, targetTeamId, active) {
        await updateDoc(personRef(id), new FieldPath('memberships', targetTeamId, 'active'), active)
        await log({ type: active ? 'team_reactivated' : 'team_deactivated', personId: id, teamId: targetTeamId })
      },

      /* Transfer = join the new team, go inactive on the old one. Nothing is
         deleted, and the two ranks are independent of each other. */
      async transfer(id, fromTeamId, targetTeamId) {
        await this.joinTeam(id, targetTeamId)
        await updateDoc(personRef(id), new FieldPath('memberships', fromTeamId, 'active'), false)
        await log({ type: 'team_transferred', personId: id, from: fromTeamId, teamId: targetTeamId })
      },

      // Drops the membership outright. Only for correcting a mistake.
      async removeMembership(id, targetTeamId) {
        await updateDoc(personRef(id), new FieldPath('memberships', targetTeamId), deleteField())
        await log({ type: 'team_left', personId: id, teamId: targetTeamId })
      },

      // --- people -----------------------------------------------------------

      async savePerson(person) {
        const exists = list.some((p) => p.id === person.id)
        const { id, ...rest } = person
        await setDoc(personRef(id), rest, { merge: true })
        await log({ type: exists ? 'person_updated' : 'person_added', personId: id, name: person.name })
      },

      /* Archiving, not deleting, is the normal way someone leaves the team —
         graduating seniors, mentors who move on. The profile and its whole
         history stay intact and can come back at any time. */
      async setArchived(id, archived) {
        await updateDoc(personRef(id), { archived })
        await log({ type: archived ? 'person_archived' : 'person_restored', personId: id, name: find(id)?.name })
      },

      async removePerson(id) {
        const name = find(id)?.name
        await deleteDoc(personRef(id))
        await log({ type: 'person_removed', personId: id, name })
      },

      // --- the active team's items ------------------------------------------

      async addTool(categoryId, item) {
        if (categories[categoryId].items.includes(item)) return
        const cats = structuredClone(categories)
        cats[categoryId].items.push(item)
        await saveTeam(team.id, { categories: cats }, { type: 'tool_created', tool: item, teamId: team.id })
      },

      async renameTool(categoryId, from, to) {
        const cats = structuredClone(categories)
        cats[categoryId].items = cats[categoryId].items.map((t) => (t === from ? to : t))
        const reqs = structuredClone(team.requirements ?? {})
        for (const r of Object.values(reqs)) r.items = (r.items ?? []).map((t) => (t === from ? to : t))
        await saveTeam(team.id, { categories: cats, requirements: reqs }, { type: 'tool_renamed', tool: to, from })
        await Promise.all(
          list
            .filter((p) => p.memberships?.[team.id]?.items?.[from])
            .map(async (p) => {
              const held = p.memberships[team.id].items[from]
              await updateDoc(personRef(p.id), new FieldPath('memberships', team.id, 'items', to), held)
              await updateDoc(personRef(p.id), new FieldPath('memberships', team.id, 'items', from), deleteField())
            }),
        )
      },

      async moveTool(item, toCategory) {
        const cats = structuredClone(categories)
        for (const [id, c] of Object.entries(cats)) {
          c.items = c.items.filter((t) => t !== item)
          if (id === toCategory) c.items.push(item)
        }
        await saveTeam(team.id, { categories: cats }, { type: 'tool_moved', tool: item, category: toCategory })
      },

      async deleteTool(item) {
        const cats = structuredClone(categories)
        for (const c of Object.values(cats)) c.items = c.items.filter((t) => t !== item)
        const reqs = structuredClone(team.requirements ?? {})
        for (const r of Object.values(reqs)) r.items = (r.items ?? []).filter((t) => t !== item)
        await saveTeam(team.id, { categories: cats, requirements: reqs }, { type: 'tool_deleted', tool: item })
        await Promise.all(
          list
            .filter((p) => p.memberships?.[team.id]?.items?.[item])
            .map((p) =>
              updateDoc(personRef(p.id), new FieldPath('memberships', team.id, 'items', item), deleteField()),
            ),
        )
      },

      // --- the active team's categories -------------------------------------

      addCategory: (id, cat) =>
        saveTeam(
          team.id,
          { categories: { ...categories, [id]: { ...cat, items: [] } }, order: [...(team.order ?? []), id] },
          { type: 'category_created', category: cat.he, teamId: team.id },
        ),

      updateCategory: (id, patch) =>
        saveTeam(
          team.id,
          { categories: { ...categories, [id]: { ...categories[id], ...patch } } },
          { type: 'category_updated', category: patch.he ?? categories[id]?.he },
        ),

      async deleteCategory(id) {
        const cats = structuredClone(categories)
        const name = cats[id]?.he
        delete cats[id]
        await saveTeam(
          team.id,
          { categories: cats, order: (team.order ?? []).filter((x) => x !== id) },
          { type: 'category_deleted', category: name },
        )
      },

      moveCategory(id, delta) {
        const order = [...(team.order ?? [])]
        const i = order.indexOf(id)
        const j = i + delta
        if (i < 0 || j < 0 || j >= order.length) return Promise.resolve()
        ;[order[i], order[j]] = [order[j], order[i]]
        return saveTeam(team.id, { order })
      },

      // --- the active team's ladder -----------------------------------------

      setRequirement: (rankId, patch) =>
        saveTeam(
          team.id,
          {
            requirements: {
              ...(team.requirements ?? {}),
              [rankId]: { ...(team.requirements?.[rankId] ?? { items: [] }), ...patch },
            },
          },
          { type: 'ladder_updated', teamId: team.id },
        ),

      // --- teams ------------------------------------------------------------

      createTeam: (id, name, itemNoun, itemNounSingular) =>
        saveTeam(
          id,
          { name, itemNoun, itemNounSingular, sort: teamList.length, categories: {}, order: [], requirements: {} },
          { type: 'team_created', name },
        ),

      updateTeam: (id, patch) => saveTeam(id, patch, { type: 'team_updated', name: patch.name ?? id }),

      async deleteTeam(id) {
        const name = teamList.find((t) => t.id === id)?.name
        await deleteDoc(doc(db, 'teams', id))
        await log({ type: 'team_deleted', name })
      },

      // --- mentors ----------------------------------------------------------

      requestMentorAccess: () =>
        setDoc(doc(db, 'mentorRequests', user.uid), {
          name: user.displayName ?? '',
          email: user.email ?? '',
          at: stamp(),
        }),

      async approveMentor(uid, name) {
        await setDoc(doc(db, 'mentors', uid), { name, addedBy: user?.displayName ?? '—', at: stamp() })
        await deleteDoc(doc(db, 'mentorRequests', uid)).catch(() => {})
        await log({ type: 'mentor_added', name })
      },

      denyMentor: (uid) => deleteDoc(doc(db, 'mentorRequests', uid)),

      async revokeMentor(uid, name) {
        await deleteDoc(doc(db, 'mentors', uid))
        await log({ type: 'mentor_removed', name })
      },

      // --- one-time setup ---------------------------------------------------

      /* Data written before sub-teams existed: a flat `tools` map and a single
         `rankId` on each person, with categories and requirements in
         meta/catalog. This folds all of it into a בנייה team without losing
         anything. Safe to re-run — it skips anyone already migrated. */
      needsMigration: list.some((p) => !p.memberships && Object.keys(p.tools ?? {}).length > 0),

      async migrateToTeams() {
        const old = catalog ?? {}
        const oldRanks = old.ranks?.length ? old.ranks : RANKS

        // Requirements used to hang off each rank; categories called their list
        // `tools` where teams call it `items`.
        const requirements = Object.fromEntries(
          oldRanks.map((r) => [
            r.id,
            { items: r.tools ?? BUILD_REQUIREMENTS[r.id]?.items ?? [], minGrade: r.minGrade ?? null },
          ]),
        )
        const source = old.categories ?? CATEGORIES
        const cats = Object.fromEntries(
          Object.entries(source).map(([id, c]) => {
            const { tools, ...rest } = c
            return [id, { ...rest, items: c.items ?? tools ?? [] }]
          }),
        )

        await setDoc(
          doc(db, 'teams', 'build'),
          {
            name: BUILD_TEAM.name,
            itemNoun: BUILD_TEAM.itemNoun,
            itemNounSingular: BUILD_TEAM.itemNounSingular,
            sort: 0,
            categories: cats,
            order: old.order ?? CATEGORY_ORDER,
            requirements,
          },
          { merge: true },
        )

        // Ranks stay global, but without their per-team tool lists.
        await setDoc(
          doc(db, 'meta', 'catalog'),
          {
            ranks: oldRanks.map(({ tools, ...r }) => r),
            categories: deleteField(),
            order: deleteField(),
          },
          { merge: true },
        )

        let moved = 0
        for (const p of list) {
          if (p.memberships) continue
          await setDoc(
            personRef(p.id),
            {
              memberships: {
                build: {
                  rankId: p.rankId ?? null,
                  items: p.tools ?? {},
                  active: true,
                  joinedAt: p.joinedAt ?? stamp(),
                },
              },
              tools: deleteField(),
              rankId: deleteField(),
            },
            { merge: true },
          )
          moved++
        }
        await log({ type: 'migrated_to_teams', count: moved })
      },

      async importFromDeck() {
        const at = stamp()
        await setDoc(doc(db, 'meta', 'catalog'), { ranks: RANKS }, { merge: true })
        await setDoc(doc(db, 'teams', 'build'), { ...BUILD_TEAM, id: deleteField() }, { merge: true })
        for (const person of SEED_PEOPLE) {
          const { id, tools, rankId, ...rest } = person
          // The deck records that someone holds a tool and whether they teach it,
          // but not when. Import date is the honest placeholder.
          const items = Object.fromEntries(
            Object.entries(tools).map(([item, canTeach]) => [
              item,
              { at, by: 'ייבוא מהמצגת', canTeach, teachAt: canTeach ? at : null },
            ]),
          )
          await setDoc(doc(db, 'people', id), {
            ...rest,
            memberships: { build: { rankId, items, active: true, joinedAt: at } },
          })
        }
        await log({ type: 'deck_imported', count: SEED_PEOPLE.length })
      },
    }
  }, [people, teams, catalog, teamId, events, user, isMentor, mentors, requests, error])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
