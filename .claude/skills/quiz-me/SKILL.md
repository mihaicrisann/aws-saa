---
name: quiz-me
description: Run a live conversational quiz in the terminal on an AWS SAA topic, one question at a time, with reasoning after each answer. Use when Mihai says "quiz me", "test me on X", "grill me on VPC", or wants to be questioned rather than read.
---

# Quiz me

Terminal quizzing — for when Mihai wants to be *asked*, not to click through the app.

## Rules

- **One question at a time.** Never print a list. Wait for the answer before continuing.
- Write real SAA-style questions: a scenario, a complication, an ask, and a qualifier (`MOST cost-effective`, `LEAST operational overhead`, `MOST secure`, `HIGHEST availability`). Four options, or five when it is a "choose TWO".
- Do **not** reveal the answer in the question, and do not hint.
- After Mihai answers: say right or wrong, give the reasoning, and **say why each wrong option is wrong**. Then ask the next one.
- Escalate difficulty while he is getting them right. Drop back a level after two misses in a row.
- Prefer questions that probe the confusion pairs in `content/cheatsheet.json` — that is where marks are actually lost.

## Sourcing

Draw roughly half from `content/questions.json` (filter by the requested domain or lecture, prefer ones not in the store's attempt history if he pastes an export) and write the rest fresh.

## Ending

Default to 10 questions unless told otherwise. Finish with:
- score,
- the two or three specific confusions behind the misses,
- one concrete next action (a lecture to re-read, a drill to run).

Offer `add-question` for any fresh question that was good, and `add-card` for anything he did not know.
