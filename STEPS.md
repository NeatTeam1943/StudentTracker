# שלב 1 מתוך 3 — StudentTracker

1. מחלצים את ה-zip הזה. ב-Terminal עוברים לתיקייה של הריפו StudentTracker.
2. מריצים (במקום `PATH` שמים את התיקייה שחילצת):
```bash
git checkout main && git pull
git checkout -b neatsystem-tab
git apply --binary PATH/2-StudentTracker.patch
git rm .env
git add -A
git commit -m "Trainings as a NeatSystem tab"
git push -u origin neatsystem-tab
```
3. ב-GitHub: פותחים Pull Request מ-`neatsystem-tab` ועושים Merge ל-`main`.

כרגע לא עושים כלום עם `0001_trainings.sql`, הוא נכנס לשימוש בשלב 3.

זהו. עוברים לשלב 2 (NeatHub).
