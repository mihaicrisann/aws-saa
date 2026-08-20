---
name: whiteboard
description: Draw an AWS architecture as an ASCII diagram to reason about a design or a question. Use when Mihai asks to draw, sketch, or diagram an architecture, or asks how the pieces of a scenario fit together.
---

# Whiteboard

Draw it. A picture settles arguments about where things sit far faster than prose.

## Conventions used throughout this workspace

```
Region boundary   ┌──────────────┐ with AZs as columns
AZ                labelled AZ-a / AZ-b, always at least two
Subnets           "public" / "private" spelled out
Resource          [ ALB ]  [ EC2 ]  [ RDS primary ]
Flow              │ ▼ → ⇄
Annotation        ← trailing, explaining WHY not what
```

Always draw:
- **two Availability Zones**, so the resilience story is visible
- the **route** that makes a subnet public or private
- where **state** lives, separately from compute

## After the drawing

Three lines, no more:
1. What makes this resilient (or does not).
2. Where the money goes.
3. The one thing an exam question would change to make a different answer correct.

Wrap the diagram in a fenced code block. If it belongs in a lecture, hand it to `write-lecture` as a `<pre><code>` block.
