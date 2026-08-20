# AWS Solutions Architect – Associate

A workspace for getting from zero to certified. Four zones: **read**, **recall**, **test**, **fix what you got wrong**.

```
lectures/     19 standalone HTML lectures — open in a browser, or read them in the app
app/          the study app: reader, flashcards, drills, mock exam, mistake log, progress
content/      the data behind all of it — curriculum, 313 questions, 150 cards, cheat sheet
notes/        yours: concepts you asked about, a mistake log, a session journal
.claude/      eight small skills that compose into whatever study flow you want
```

## Start

```bash
npm run setup     # installs the app and builds the lectures (once)
npm run dev       # http://localhost:5180
```

That is the whole setup. Everything is local — no backend, no account, no network calls except web fonts for the standalone lectures. The UI is shadcn/ui, neutral and minimal.

**Where progress lives:** in the browser's `localStorage`, and — while `npm run dev` runs — mirrored to `notes/progress.json` on every change and restored from there if the browser is empty. `/study-plan` reads that file directly.

---

## The zones

### 1. Learn — `/learn`
Nineteen lectures, about five hours of reading, ordered so each one only assumes the ones before it. Each has two or three architecture diagrams drawn in the design system, self-checks, and six takeaways.

They are **real HTML files**. Open `lectures/index.html` directly in a browser and they work standalone — light/dark toggle, scroll progress, the lot. The app reads the same files, so there is one copy of the truth.

Notes you take in the reader are saved per lecture.

### 2. Recall — `/cards`
150 flashcards with spaced repetition. Flip with **space**, rate with **1–4**. What you rate *Good* comes back in days rather than minutes, so the deck shrinks as things stick. Filter by domain or by lecture.

### 3. Test — `/drill` and `/exam`

**Drill** is testing *combined with* learning: 5 to 40 questions, filtered by domain or lecture, with the full reasoning — including why every wrong option is wrong — immediately after each answer. Before checking you say how sure you are (`s` / `u` / `g`); "sure and wrong" is tracked separately because it is the most dangerous kind of miss. Each question is timed, links to the exact lecture section that answers it, and has an "Ask Claude about this" button that copies a ready `/explain` prompt for the terminal.

**Mock exam** is testing under exam conditions: 65 questions in 130 minutes, a live countdown, a question navigator, flags, no feedback until you submit, then a full review pass. Questions are drawn to the **real exam's domain weights** (30/26/24/20), not the bank's own distribution. Half and quick modes exist for when you have less time.

Both feed the same progress store.

### 4. Fix — `/mistakes`
Every wrong answer lands here automatically. Tag *why* you missed it — knowledge gap, misread the qualifier, fell for a distractor, guessed — write one line about what to check next time, then retry it blind. Reviewing your own mistakes beats doing new questions, and the reason tags tell you which treatment you actually need.

### Supporting

- **`/cheatsheet`** — searchable: keyword→service map, the confusion pairs, hard numbers, and the answer shapes that are automatically wrong. Search it mid-drill.
- **`/progress`** — readiness by domain, accuracy per lecture worst-first (your re-reading order), calibration (accuracy when "sure" vs "guessing"), pace, exam history, a 12-week activity calendar. Export/import as JSON.
- **Search** — `/` or `⌘K` searches every lecture section and the cheat sheet, and jumps to the exact section.
- **`/`** — overview: one "next" action, the readiness gauge, and everything at a glance.

---

## Keyboard

Press **?** anywhere in the app for the full list. `[` hides or shows the sidebar (the toggle is also the first button on every page). Letters jump between pages (`l` learn, `c` cards, `d` drill, `e` exam, `m` mistakes, `k` cheat sheet, `p` progress, `t` theme). Drill: `1–5` pick, `Enter` check/next. Cards: `Space` flip, `1–4` rate. Exam: `1–5` pick, `←`/`→` move, `f` flag. Reader: `n` mark read and open the next lecture.

## The readiness gauge

The gauge on the overview is not decoration. Each arc is one exam domain; **arc length is that domain's real weight on the exam**, arc fill is your measured accuracy, and the tick on each arc is the 720 pass line. The number in the middle is your accuracy mapped onto the exam's own 100–1000 scale. It is only meaningful once `n` is large — it tells you so when it isn't.

---

## Skills

Small, single-purpose, composable. Type `/` in Claude Code to see them.

| Skill | For |
| --- | --- |
| `/explain` | Explain a service or a difference at exam depth, then file it in `notes/concepts/` |
| `/quiz-me` | Live conversational quizzing in the terminal, one question at a time |
| `/whiteboard` | Draw an architecture as ASCII to reason about a design |
| `/add-question` | Author new questions into the bank (validated) |
| `/add-card` | Author new flashcards |
| `/write-lecture` | Write and register a new lecture, then rebuild |
| `/study-plan` | Turn exported progress into a plan for the next three sessions |
| `/session-log` | Record what happened today in `notes/journal/` |

They combine. `/explain` → `/add-card` → `/quiz-me` is one flow. `/study-plan` → `/write-lecture` → `/add-question` is another.

---

## Tests

```bash
npm run check      # content: ids, references, anchors, distractor coverage, per-lecture minimums
npm run test:ui    # builds the app and drives every page + shortcut in headless Chromium
npm test           # both
```

## Commands

```bash
npm run dev        # study app on :5180
npm run lectures   # rebuild lectures/*.html from lectures/_src/
npm run check      # validate every content file
npm run build      # production build into app/dist/
```

## Adding content

Everything is data. `content/curriculum.json` defines the lectures and the domain weights; `content/questions.json` and `content/flashcards.json` are flat arrays; `content/cheatsheet.json` drives the reference page. Add to any of them and the app picks it up — `npm run check` will tell you if you got the shape wrong.

Lectures live as body fragments in `lectures/_src/`. `npm run lectures` wraps them into complete standalone pages with the masthead, navigation and index.

## Where your progress lives

Browser local storage, on this machine. **Progress → Export** writes a JSON file — do that before clearing site data, or to move to another machine, or to hand to `/study-plan`.

## The exam

65 questions, 130 minutes, $150. Only 50 are scored — 15 are invisible unscored pretest items. Scaled 100–1000, pass at **720**, which is roughly 72% correct. No penalty for a wrong answer, so never leave a blank.

Domains: Secure 30% · Resilient 26% · High-Performing 24% · Cost-Optimized 20%.

Six-week plan: `STUDY-PLAN.md`. Exam tactics: [lecture 19](lectures/19-exam-playbook.html).
