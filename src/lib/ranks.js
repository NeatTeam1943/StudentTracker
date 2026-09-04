/*
 * Ranks are global — the same eight badges everywhere. What each rank *requires*
 * is per team, because בנייה is measured in tools and תכנות in הכשרות.
 *
 * A person holds one membership per team: their own rank and their own record of
 * what they've unlocked there. Moving to another team never erases the old one.
 */

export const rankIndex = (ranks, id) => ranks.findIndex((r) => r.id === id)

export const emptyMembership = () => ({ rankId: null, items: {}, joinedAt: new Date().toISOString() })

export const membershipIn = (person, teamId) => person?.memberships?.[teamId] ?? null

export const teamsOf = (person) => Object.keys(person?.memberships ?? {})

/** Requirements for a rank on a given team, plus its grade gate. */
export function requirement(team, ranks, rankId) {
  const req = team?.requirements?.[rankId]
  const rank = ranks.find((r) => r.id === rankId)
  return {
    items: req?.items ?? [],
    // A team may override the global grade gate; null means "use the rank's own".
    minGrade: req?.minGrade === undefined ? (rank?.minGrade ?? null) : req.minGrade,
  }
}

/** Everything required at this rank and every rank below it, on this team. */
export function cumulativeItems(team, ranks, rankId) {
  const i = rankIndex(ranks, rankId)
  return i < 0 ? [] : ranks.slice(0, i + 1).flatMap((r) => requirement(team, ranks, r.id).items)
}

const holds = (membership, item) => Boolean(membership?.items?.[item])

/**
 * A rank counts as configured on this team once it has requirements of its own —
 * items, a grade gate, or both. An unconfigured rank is never earned: on a brand
 * new team every rank starts empty, and without this check everyone would
 * instantly qualify for the top badge.
 */
export const isConfigured = (team, ranks, rankId) => {
  const req = requirement(team, ranks, rankId)
  return req.items.length > 0 || req.minGrade != null
}

/** What stands between this person and a rank on this team. */
export function gapFor(team, ranks, person, rank) {
  const m = membershipIn(person, team.id)
  const missingItems = cumulativeItems(team, ranks, rank.id).filter((t) => !holds(m, t))
  const { minGrade } = requirement(team, ranks, rank.id)
  const gradeOk =
    minGrade == null ? true : minGrade === 99 ? Boolean(person.isMentor) : (person.gradeNum ?? 0) >= minGrade
  return {
    missingItems,
    gradeOk,
    configured: isConfigured(team, ranks, rank.id),
    eligible: missingItems.length === 0 && gradeOk && isConfigured(team, ranks, rank.id),
  }
}

/** Highest rank earned on this team, walking the ladder in order. */
export function earnedRank(team, ranks, person) {
  let earned = null
  for (const rank of ranks) {
    if (!gapFor(team, ranks, person, rank).eligible) break
    earned = rank
  }
  return earned
}

/** The rank shown for this team — whatever a mentor last set there. */
export const displayRank = (ranks, person, teamId) =>
  ranks.find((r) => r.id === membershipIn(person, teamId)?.rankId) ?? null

/** Only fires on exact eligibility. Promotion is always a mentor's decision. */
export function promotionSuggestion(team, ranks, person) {
  const current = displayRank(ranks, person, team.id)
  const earned = earnedRank(team, ranks, person)
  if (!earned) return null
  const from = current ? rankIndex(ranks, current.id) : -1
  return rankIndex(ranks, earned.id) > from ? { from: current, to: earned } : null
}

/** Progress toward the next rank up, for the person's own advancement view. */
export function nextRankProgress(team, ranks, person) {
  const current = displayRank(ranks, person, team.id)
  const next = ranks[current ? rankIndex(ranks, current.id) + 1 : 0]
  if (!next || !isConfigured(team, ranks, next.id)) return null
  const { missingItems, gradeOk } = gapFor(team, ranks, person, next)
  const required = cumulativeItems(team, ranks, next.id)
  return { next, missingItems, gradeOk, have: required.length - missingItems.length, total: required.length }
}
