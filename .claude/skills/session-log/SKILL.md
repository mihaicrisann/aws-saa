---
name: session-log
description: Record what happened in a study session to notes/journal/. Use when Mihai says he has finished studying, asks to log a session, or wants to note what he learned or struggled with today.
---

# Session log

Append to `notes/journal/YYYY-MM.md` (create the month file if it is missing).

## Format

```markdown
## YYYY-MM-DD

**Covered:** lecture 08 VPC, 30-question drill (networking)
**Score:** 22/30
**Stuck on:** gateway vs interface endpoints — kept picking gateway for on-prem access
**Landed:** NACLs are the only place you can DENY
**Next:** re-read lecture 09, then drill it alone
```

Keep it to those five lines. This is a log, not an essay — its value is that it is short enough to actually skim later.

## Rules

- Ask only for what you cannot infer from the conversation. Do not interrogate.
- If a specific confusion came up, also append a line to `notes/mistakes.md`.
- If something is worth remembering long-term, offer `add-card`.
