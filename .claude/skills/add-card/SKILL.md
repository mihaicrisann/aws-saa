---
name: add-card
description: Add flashcards to content/flashcards.json for the spaced-repetition deck. Use when Mihai asks to add cards, turn a concept or a mistake into a flashcard, or make something memorable.
---

# Add card

Appends to `content/flashcards.json`, which drives the app's Cards page.

## Schema

```json
{
  "id": "f151",
  "domain": "secure | resilient | perf | cost",
  "lecture": "<id from content/curriculum.json>",
  "front": "The prompt — a question or a bare comparison.",
  "back": "The answer. Terse. Use CAPS for the one word that decides it.",
  "note": "Optional: the exam cue or the trap. Rendered as a highlighted footnote."
}
```

## Quality bar

- **One fact per card.** If the back has two unrelated ideas, it is two cards.
- Fronts that work: `"Multi-AZ vs read replica"`, `"Lambda's hard limits"`, `"When is Spot the answer?"`. Fronts that don't: anything answerable with yes or no.
- Backs should be recallable in about ten seconds. Long backs mean the card is too big.
- Put the *decision cue* in `note` — that is the part that earns the mark.

## After writing

```bash
node -e "const c=require('./content/flashcards.json');const s=new Set();c.forEach(x=>{if(s.has(x.id))throw new Error('dup '+x.id);s.add(x.id);if(!x.front||!x.back)throw new Error('empty '+x.id)});console.log('ok',c.length,'cards')"
```
