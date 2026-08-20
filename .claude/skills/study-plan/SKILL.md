---
name: study-plan
description: Turn measured progress into a concrete plan for the next sessions. Use when Mihai asks what to study next, wants a study plan or schedule, asks if he is ready for the exam, or shares an exported progress file.
---

# Study plan

## Get the data

While the dev server runs, the app mirrors its store to **`notes/progress.json`** — read that first (`node -e` over it is fine; it is the same shape as a Progress → Export file). If it is missing or stale, ask Mihai to open **Progress → Export** and give you the file. Failing both, work from `notes/mistakes.md`, `notes/journal/`, and which lectures exist.

Read from it:
- `attempts` — accuracy per `domain` and per `lecture`; each has `confidence` (`sure` / `unsure` / `guess`) and `seconds`. **"sure" + wrong is the most important slice** — list those questions by lecture.
- `mistakes` — `reason` tags: `knowledge` / `misread` / `distractor` / `guess`
- `exams` — score trend
- `cards` — how many are actually scheduled
- pace: mean `seconds` in exam mode vs the 120 s the real exam allows

## Diagnose before prescribing

The `reason` tags decide the treatment, and they are not interchangeable:

| Dominant reason | What to do |
| --- | --- |
| `knowledge` | Re-read the lecture. More questions will not help. |
| `misread` | Practice reading the qualifier first. Drill in timed mode. |
| `distractor` | Study the confusion pairs in `content/cheatsheet.json`. |
| `guess` | Genuine gap in a narrow area — target one lecture, then drill it alone. |

## Output

A plan for the **next three sessions**, no further. For each: the one thing to read, the specific drill to run (`/drill?domain=…` or `?lecture=…`), how many cards, and roughly how long. Name the single biggest lever first.

State readiness honestly. Below 75% across two full mocks on different draws is not ready — say so plainly rather than encouragingly.
