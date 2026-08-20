# Notes

Your zone. Four things live here.

| File / folder | What goes in it | Written by |
| --- | --- | --- |
| `concepts/` | One file per thing you asked about. Grows into a personal reference. | `/explain` |
| `journal/YYYY-MM.md` | Five lines per session: covered, score, stuck on, landed, next. | `/session-log` |
| `mistakes.md` | Confusions worth writing down by hand, beyond what the app logs. | you, or `/session-log` |
| `progress.json` | The app's progress store, mirrored here automatically while `npm run dev` runs (same shape as a Progress → Export file). `/study-plan` reads it directly. | the app |

The app already logs every wrong answer at `/mistakes` with a reason tag and a retry. This folder is for the things that don't fit in a question — the mental models, the "oh, *that's* why" moments.
