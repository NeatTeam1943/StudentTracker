# רישיון בנאי — Neat Team #1943

Tool certification tracker for the build team. Guests see every profile; mentors
sign in with Google to grant tools, toggle who can teach what, and promote people
up the ladder. Static site on GitHub Pages, data in Firestore.

Everything visible came out of the source deck (`רישיון בנאי.pptx`) — the profile
layout, the five tool categories, all 31 tools, the eight rank badges, and the
advancement ladder from the hidden slide at the end.

## Setup

**1. Firebase project**

Create one at console.firebase.google.com. You want:

- **Firestore Database** → create in production mode, pick a region near you
- **Authentication** → Sign-in method → enable Google
- **Authentication → Settings → Authorized domains** → add your `*.github.io` domain

Stay on the Spark plan. No card needed, and it doesn't pause for inactivity.

**2. Rules**

Paste `firestore.rules` into Firestore → Rules → Publish.

**3. Web config**

Project settings → Your apps → Web app. Copy the config values into `.env`
(see `.env.example`).

That file is committed on purpose. A Firebase web API key identifies the project
rather than granting access — it ships in the bundle of every Firebase web app,
and `firestore.rules` is what protects the data. Committing it means the Actions
build gets the config straight from the repo with nothing to configure.

**4. Make yourself a mentor**

Run `npm install && npm run dev`, click כניסת מנטורים and sign in. You'll see
"אין הרשאת מנטור" — expected, it just creates your user record.

Now Authentication → Users → copy your UID. In Firestore create a collection
`mentors`, document ID = your UID, with any field in it.

Adding a mentor is deliberately a console action. The app can never grant mentor
access to anyone, so a compromised mentor account can't mint more mentors.

**5. Import the deck data**

Refresh the app. On the empty roster you'll get a **ייבוא נתונים מהמצגת** button.
Press it once. That writes the thirteen people, the tool catalog and the ladder,
running as you through the normal security rules — no admin credentials anywhere.

**6. Deploy**

Settings → Pages → Source: **GitHub Actions**. Then push to `main` — the workflow
in `.github/workflows/deploy.yml` builds and publishes. No secrets or variables
to set up.

Local: `npm run dev`.

## How ranks work

Two separate things, which the deck keeps separate too:

- **Role** — free text on the card: חדש, בנאי, ראש"צ בנייה, מנטור קבוצה
- **Rank** — the badge: ניט → ניטר → ניטולוג → ניטפרו → ניטפריים → ניטאליט → ניטמאסטר → ניטמנטור

Note ניטולוג comes before ניטפרו. That's the deck's order, not a typo.

A rank is earned when someone holds every tool at that rank *and* every rank
below it, plus the grade gate where there is one (ניטפריים needs י', ניטאליט
needs יא', ניטמאסטר needs יב', ניטמנטור is mentors only).

Running these rules against the thirteen people in the deck reproduces the badge
each of them was actually wearing, thirteen for thirteen. `node scripts/…` isn't
needed to check — `src/lib/ranks.js` has no side effects and can be tested directly.

**Promotion is never automatic.** When someone clears a rank, mentors get a
suggestion on the roster and on that person's profile with a button. Nothing
moves until a mentor presses it. Mentors can also set any rank by hand from the
profile, ignoring the requirements entirely.

Students never see suggestions. They see their own progress bar and what's
missing, on their profile and on the ladder page.

## Leaving the team

Mentors archive rather than delete. An archived person drops off the roster and
the advancement picker, but the profile, every certification and the whole log
stay intact, and one button brings them back. That's what graduating יב' should
get every June.

Permanent deletion is only offered from an already-archived profile, so a live
one can't be wiped by a stray tap.

Mentor *access* is separate from this. Someone can be archived as a team member
while still holding mentor rights, or lose mentor rights while staying on the
roster — revoke access on the מנטורים page.

## Sub-teams

Each team owns its own scale. בנייה is measured in כלים; another team can be
measured in הכשרות, or anything else — the noun is a per-team setting. Categories,
items and rank requirements all belong to the team.

The eight ranks are shared. ניט through ניטמנטור mean the same thing everywhere;
only what you must do to earn them differs.

A person holds one membership per team, each with its own rank and its own
record. Someone can be ניטמאסטר in בנייה and ניט in a new team at the same time —
the badge you see is always the badge for the team you're viewing.

**Transfer keeps everything.** Moving someone to another team marks the old
membership inactive rather than deleting it: their rank freezes where it is,
every certification stays, and they still count as able to teach what they could
teach. They just stop earning new ranks there and drop off that roster. Reactivating
restores them exactly. "צירוף בנוסף" adds a team without leaving the old one, for
people who genuinely work in both.

A rank with no requirements and no grade gate is treated as unconfigured and can
never be earned. Without that, everyone on a brand new team would instantly
qualify for the top badge.

## Data shape

```
teams/{id}     { name, itemNoun, itemNounSingular, sort,
                 categories: { <id>: { he, label, header, tint, items: [...] } },
                 order: [...],
                 requirements: { <rankId>: { items: [...], minGrade } } }
meta/catalog   { ranks }                    -- global, shared by every team
people/{id}    { name, role, phone, grade, gradeNum, favoriteTool, nickname,
                 isMentor, archived,
                 memberships: { <teamId>: { rankId, active, joinedAt,
                   items: { "מקדחה": { at, by, canTeach, teachAt } } } } }
mentors/{uid}  existence = can write
events/{id}    { at, by, byUid, type, personId, tool, from, to }
```

Items live inside the person document so the roster costs one read per person
instead of one per certification. Thirteen people is thirteen reads against a
daily free quota of fifty thousand.

`events` is append-only — the rules forbid update and delete for everyone,
mentors included. Grants, revocations, promotions, teaching permissions and
roster changes all land there with a timestamp and who did it.

Requirements live in the team document as data, so the ladder can change from the
צוותים page without a deploy.

## Notes

- The import stamps every existing certification with the import date, since the
  deck records *that* someone is certified but not *when*. Everything after the
  import is a real timestamp.
- There is no service account key anywhere in this project. The one-time import
  runs in the browser as a signed-in mentor.
- מחרטה is in the catalog but belongs to no rank tier. It was that way in the deck.
- Rank badges and wordmarks in `public/assets/` are the deck's own artwork.
