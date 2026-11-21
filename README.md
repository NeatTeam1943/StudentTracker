# הכשרות (StudentTracker · רישיון בנאי)

מערכת ההסמכות והדרגות של Neat Team 1943 — **טאב בתוך NeatSystem**.
הריפו הזה הוא ה-submodule `systems/trainings` של [NeatSystem](https://github.com/NeatTeam1943/NeatSystem): אין לו אתר, התחברות או טבלת משתמשים משלו.

## מה יש כאן

| מה | איפה |
|---|---|
| הייצוא של הטאב (חוזה 1) | `neatsystem/tab.jsx` |
| המסכים: שלי, חברי הצוות, מפה, סולם הדרגות, יומן, כרטיס אישי, פריט, ניהול | `src/ui/` |
| מודל הקריאה (חישוב מצב, דרגות, מי מסמיך) | `src/model/logic.js` |
| גישה לנתונים: Supabase / זיכרון (מצב mock של NeatSystem) | `src/model/supabase.js`, `src/model/memory.js` |
| הטבלאות והפונקציות | `supabase/migrations/0001_trainings.sql` |
| בדיקות SQL (רצות ב-CI של NeatSystem) | `supabase/tests/` |
| בדיקות לוגיקה | `tests/` (`npm test`) |
| מעבר חד-פעמי מ-Firestore | `scripts/firestore-import.mjs` |

## איך זה מתחבר ל-NeatSystem

- **משתמשים והתחברות** — של NeatSystem (`hub`). הטאב מקבל מ-NeatSystem את האנשים, את המשתמש המחובר ואת לקוח ה-Supabase.
- **נתונים** — בפרויקט ה-Supabase של NeatSystem, בסכימות משלנו:
  - `trainings` — הטבלאות. סגורות לגמרי ללקוח ולמערכות אחרות.
  - `trainings_api` — החוזה: `state()` לקריאה, פונקציה לכל פעולה (בודקת הרשאה ורושמת ליומן), ו-`profile_v1(user)` שממנה NeatSystem מציג את החלק שלנו בפרופיל (בקריאה בלבד).
- **הרשאות** — שלוש הרשאות שנרשמות בטבלה של NeatSystem (`trainings.certify_all`, `trainings.edit_catalog`, `trainings.manage`). מנטורים משנים אותן בטבלת ההרשאות. רש"צ מסמיך ועורך את הצוות שלו, אלא אם מנטור נעל אותו.
- **עיצוב** — רק דרך `@neatsystem/kit`. ה-CSS של הטאב (`src/ui/trainings.css`) מוגבל לטאב אוטומטית.

מותר לייבא בקוד הטאב רק: `react`, `react-router-dom`, `lucide-react`, `@neatsystem/kit` וקבצים מהריפו הזה.

## עבודה על הטאב

מפתחים מתוך NeatSystem, שם הטאב רץ:

```bash
git clone --recurse-submodules https://github.com/NeatTeam1943/NeatSystem.git
cd NeatSystem && npm install
npm run dev:mock          # בלי Supabase — נתונים מומצאים, בורר "צפייה בתור"
cd systems/trainings      # כאן עורכים, עושים commit ו-push לריפו הזה
```

אחרי push כאן, ב-NeatSystem מעדכנים את המצביע: `git add systems/trainings && git commit`.

## הקמה (פעם אחת)

1. ב-Supabase של NeatSystem, **אחרי** המיגרציות של NeatSystem: להריץ את `supabase/migrations/0001_trainings.sql`.
2. Settings → API → Exposed schemas: להוסיף `trainings_api`.
3. העברת הנתונים מ-Firestore (ההוראות בראש `scripts/firestore-import.mjs`):
   1. `export` — מושך את הנתונים מהפרויקט הישן.
   2. `mapping` — יוצר טבלה לשיוך כל אדם למייל שלו ב-NeatSystem.
   3. `sql` — יוצר קובץ SQL לקריאה ואז להרצה.

   מי שעוד לא הצטרף ל-NeatSystem מדלגים עליו, ומריצים שוב כשהצטרף.

האתר הישן על Firebase ממשיך לעבוד כמו שהוא עד שמכבים אותו. הריפו כבר לא מפרסם אותו.

## שינויים מול StudentTracker הישן

- אין יותר כניסה בלי התחברות. אלה שמות של קטינים, ועכשיו רואים אותם רק חברי קבוצה פעילים.
- אנשים לא נוצרים כאן. כל אחד מצטרף ל-NeatSystem, וכאן רק משייכים לקטגוריה.
- הוצאה מהקבוצה נעשית ב-NeatSystem. ההסמכות נשמרות, והגישה נחסמת.
- תלמידים לא מבקשים הסמכה. רש"צ מסמיך, גם פריט נעול ("פתיחה מוקדמת").
