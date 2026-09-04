/*
 * One place that turns a log event into Hebrew.
 *
 * There used to be two of these — one in the log page, one in the deck's log
 * box — and they drifted, so newer event types rendered as raw names like
 * "auto_rank_off" in the deck. Both now call this.
 */

export const EVENT_TONE = {
  tool_revoked: 'bad',
  teach_revoked: 'warn',
  person_removed: 'bad',
  person_archived: 'warn',
  tool_deleted: 'bad',
  rank_set: 'warn',
  mentor_removed: 'bad',
  team_deactivated: 'warn',
  team_deleted: 'bad',
  team_left: 'bad',
  category_deleted: 'bad',
  auto_rank_off: 'warn',
  note: 'note',
}

export function describeEvent(e, nameOf, rankName) {
  const who = nameOf?.(e.personId) ?? e.name ?? '—'
  const rank = (id) => rankName?.(id) ?? '—'

  switch (e.type) {
    case 'note':
      return e.text ?? ''
    case 'tool_granted':
      return `${who} הוסמך ל${e.tool}`
    case 'tool_revoked':
      return `בוטלה ההסמכה של ${who} ל${e.tool}`
    case 'teach_granted':
      return `${who} הוסמך ללמד ${e.tool}`
    case 'teach_revoked':
      return `${who} כבר לא מלמד ${e.tool}`
    case 'promoted':
      return `${who} קודם ל${rank(e.to)}${e.from ? ` (מ${rank(e.from)})` : ''}`
    case 'rank_auto':
      return e.to ? `${who} עודכן אוטומטית ל${rank(e.to)}` : `הדרגה של ${who} בוטלה אוטומטית`
    case 'auto_rank_on':
      return `${who} — עדכון דרגה אוטומטי הופעל`
    case 'auto_rank_off':
      return `${who} — הדרגה נקבעת ידנית מעכשיו`
    case 'rank_set':
      return `הדרגה של ${who} נקבעה ידנית ל${rank(e.to)}`
    case 'person_added':
      return `${e.name ?? who} נוסף לצוות`
    case 'person_updated':
      return `עודכנו הפרטים של ${who}`
    case 'person_archived':
      return `${e.name ?? who} הועבר לארכיון`
    case 'person_restored':
      return `${e.name ?? who} הוחזר מהארכיון`
    case 'person_removed':
      return `${e.name ?? who} נמחק לצמיתות`
    case 'team_created':
      return `נוצר צוות ${e.name}`
    case 'team_updated':
      return `עודכנו הגדרות הצוות ${e.name}`
    case 'team_deleted':
      return `הצוות ${e.name} נמחק`
    case 'team_joined':
      return `${who} צורף לצוות`
    case 'team_transferred':
      return `${who} הועבר לצוות אחר`
    case 'team_deactivated':
      return `${who} סומן כלא פעיל בצוות`
    case 'team_reactivated':
      return `${who} חזר לפעילות בצוות`
    case 'team_left':
      return `${who} הוסר מהצוות`
    case 'tool_created':
      return `נוסף פריט חדש: ${e.tool}`
    case 'tool_renamed':
      return `${e.from} שונה ל${e.tool}`
    case 'tool_moved':
      return `${e.tool} הועבר לקטגוריה אחרת`
    case 'tool_deleted':
      return `הפריט ${e.tool} נמחק`
    case 'category_created':
      return `נוספה קטגוריה: ${e.category}`
    case 'category_updated':
      return `עודכנה הקטגוריה ${e.category}`
    case 'category_deleted':
      return `הקטגוריה ${e.category} נמחקה`
    case 'ladder_updated':
      return 'סולם ההתקדמות עודכן'
    case 'ranks_updated':
      return 'הדרגות עודכנו'
    case 'mentor_added':
      return `${e.name} קיבל הרשאת מנטור`
    case 'mentor_removed':
      return `הרשאת המנטור של ${e.name} הוסרה`
    case 'deck_imported':
      return `יובאו ${e.count} חברי צוות מהמצגת`
    case 'orphans_cleaned':
      return `נוקו ${e.count} הסמכות לפריטים שנמחקו`
    case 'migrated_to_teams':
      return `${e.count} חברי צוות שויכו לצוות בנייה`
    default:
      // Anything unrecognised still reads as words rather than a raw key.
      return String(e.type ?? '').replace(/_/g, ' ')
  }
}
