/*
 * The ladder from the deck, as rules.
 *
 * A rank is earned when the person holds every tool listed at that rank AND at
 * every rank below it, and meets the rank's grade gate. Verified against all
 * thirteen people in the source deck: the computed rank matched the badge they
 * were actually wearing in every case.
 *
 * Nothing here ever writes. Promotion is always a mentor's decision.
 */

export const rankIndex = (ranks, id) => ranks.findIndex((r) => r.id === id)

/** Every tool required at this rank and all ranks below it. */
export function cumulativeTools(ranks, rankId) {
  const i = rankIndex(ranks, rankId)
  return i < 0 ? [] : ranks.slice(0, i + 1).flatMap((r) => r.tools)
}

const holds = (person, tool) => Boolean(person.tools?.[tool])

/** What stands between this person and a given rank. */
export function gapFor(ranks, person, rank) {
  const missingTools = cumulativeTools(ranks, rank.id).filter((t) => !holds(person, t))
  const gradeOk =
    rank.minGrade == null
      ? true
      : rank.minGrade === 99
        ? Boolean(person.isMentor)
        : (person.gradeNum ?? 0) >= rank.minGrade
  return { missingTools, gradeOk, eligible: missingTools.length === 0 && gradeOk }
}

/** Highest rank the person qualifies for, walking the ladder in order. */
export function earnedRank(ranks, person) {
  let earned = null
  for (const rank of ranks) {
    if (!gapFor(ranks, person, rank).eligible) break
    earned = rank
  }
  return earned
}

/** The rank on the profile — whatever a mentor last set. */
export const displayRank = (ranks, person) => ranks.find((r) => r.id === person.rankId) ?? null

/**
 * What to offer a mentor. Only fires on exact eligibility: a student who is two
 * tools short shows up on their own advancement page as progress, not here.
 */
export function promotionSuggestion(ranks, person) {
  const current = displayRank(ranks, person)
  const earned = earnedRank(ranks, person)
  if (!earned) return null
  const from = current ? rankIndex(ranks, current.id) : -1
  return rankIndex(ranks, earned.id) > from ? { from: current, to: earned } : null
}

/** Progress toward the next rank up, for the student-facing advancement page. */
export function nextRankProgress(ranks, person) {
  const current = displayRank(ranks, person)
  const next = ranks[current ? rankIndex(ranks, current.id) + 1 : 0]
  if (!next) return null
  const { missingTools, gradeOk } = gapFor(ranks, person, next)
  const required = cumulativeTools(ranks, next.id)
  return { next, missingTools, gradeOk, have: required.length - missingTools.length, total: required.length }
}
