---
name: explain
description: Explain an AWS service, concept, or the difference between two things at exam depth, then file the answer in notes/concepts/. Use when Mihai asks "explain X", "how does X work", "what's the difference between X and Y", "why would I use X over Y", or asks any conceptual AWS question while studying.
---

# Explain

Answer at **SAA exam depth** — not shallower, not a documentation dump.

## Shape of the answer

1. **One sentence** that says what it actually is. No marketing.
2. **The mechanism** — how it works, only as deep as the exam requires.
3. **When it is the right answer**, and the exact phrasing in a question that selects it.
4. **What it is confused with**, and the single sentence that separates them.
5. **The trap** — the thing that makes a plausible option wrong.

Use a table whenever you are comparing two or more things. Keep it under 400 words unless asked to go deeper.

## Then file it

Write the answer to `notes/concepts/<kebab-slug>.md` with this frontmatter:

```markdown
---
topic: <name>
lecture: <matching lecture id from content/curriculum.json, or "none">
domain: secure | resilient | perf | cost
asked: YYYY-MM-DD
---
```

If the file already exists, extend it rather than overwriting — this is a growing personal reference.

## Compose

- If the concept has no lecture coverage, offer `write-lecture`.
- If Mihai got it wrong recently, offer `add-card` so it enters the spaced-repetition deck.
- Never invent AWS limits or figures. If unsure of a number, say so and check `content/cheatsheet.json` or the web.
