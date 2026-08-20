---
name: add-question
description: Author new exam-style questions into content/questions.json for the drill and mock exam app. Use when Mihai asks to add questions, expand the question bank, or turn a mistake or topic into practice questions.
---

# Add question

Appends to `content/questions.json`, which drives the app's Drill and Exam pages.

## Schema (all fields required except `distractors`)

```json
{
  "id": "q141",
  "domain": "secure | resilient | perf | cost",
  "lecture": "<id from content/curriculum.json>",
  "anchor": "<section id — the slug of the lecture h2 that answers it; list them with node -e "import('./lectures/_assets/sections.mjs').then(m=>console.log(m.sectionsOf(require('fs').readFileSync('lectures/_src/<id>.html','utf8'))))">",
  "difficulty": 1,
  "stem": "Scenario, complication, ask, qualifier.",
  "options": ["...", "...", "...", "..."],
  "correct": [2],
  "explanation": "Why the correct answer is correct.",
  "distractors": ["why A is wrong", "why B is wrong", "", "why D is wrong"]
}
```

- `correct` holds **zero-based indices**. More than one index makes it a multi-response question — say "(Choose TWO.)" in the stem.
- `distractors` is parallel to `options`; leave `""` for correct ones.
- `id` continues the sequence — check the last id in the file.
- `anchor` is required — the app deep-links every miss to that section, and `npm run check` rejects unknown anchors.
- **Vary the position of the correct option.** Never default to index 0; a bank where the answer is always A is useless as practice.

## Quality bar

- Every stem needs a **qualifier**. Without one there is no defensible single answer.
- Distractors must be *plausible*: a service that solves a neighbouring problem, or the right service with one detail wrong. Never filler.
- No option should be wrong purely because it is absurd.
- Explanations state the mechanism, not just the name.

## After writing

Validate and report the new count:

```bash
npm run check
```
