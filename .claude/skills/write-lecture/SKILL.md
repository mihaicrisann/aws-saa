---
name: write-lecture
description: Write a new HTML lecture for the study workspace, register it in the curriculum, and rebuild the standalone pages. Use when Mihai asks for a lecture on a topic, wants a gap covered, or asks to expand the curriculum.
---

# Write lecture

Lectures are **body fragments** in `lectures/_src/<id>.html`. A build script wraps them with the masthead, nav and assets, so never write a full HTML document.

## Steps

1. **Register it** in `content/curriculum.json` under `lectures`:
   ```json
   { "id": "20-my-topic", "n": 20, "module": "m5", "title": "...", "standfirst": "One or two sentences that say why this matters.", "minutes": 15, "domains": ["secure"], "tags": ["Service", "Concept"] }
   ```
2. **Write** `lectures/_src/20-my-topic.html` — the fragment only.
3. **Build**: `node lectures/_assets/build.mjs`
4. Add questions (`add-question`) and cards (`add-card`) for the new material.

## House style

Match the existing lectures exactly. Available components:

| Markup | Use |
| --- | --- |
| `<h2 data-mark="01">` | Section heading; `data-mark` renders in the left margin |
| `<div class="note">` | Neutral aside. Variants: `note gotcha`, `note exam`, `note nuance` — each needs `<span class="label">` |
| `<div class="table-wrap"><table>` | Every table must be wrapped, for horizontal scroll |
| `<div class="decisions">` + `<div class="decision">` with `.cue` / `.arrow` / `.ans` | "If you see X → answer Y" lists |
| `<details class="check"><summary>Q</summary><div class="answer">A</div></details>` | Self-check |
| `<div class="takeaways"><h2>Take away</h2><ol>` | Always the last block, five or six items |
| `<figure class="diagram">` | Architecture diagram — see below. Every lecture has 2–3; they go where the reader would otherwise build the picture in their head |
| `<pre><code>` | Config or CLI snippets only, not diagrams |

### Diagrams

Built from `.flow` (row) / `.stack` (column) / `.cols` (side by side), `.node` boxes (`.user` pill, `.hl` subject, `.dim` optional, `.store` data, `.bad`/`.good`/`.warn`/`.info`), `.arrow` connectors (`.both`, `.back`, `.dashed`, `.x`; text inside = label) and `.group` containers with `data-label` (`.az` filled, `.col`, `.bad`/`.good`/`.info`). Always end with a `<figcaption>` stating the point. No SVG, no inline styles. Full spec with an example lives at the top of the diagram section in `lectures/_assets/lecture.css`; copy an existing figure from `lectures/_src/08-vpc.html` as a template.

## Voice

Direct, second person, no filler openings. Say what the exam does with the topic, not just what the service does. Lead with the distinction that earns marks. Bold the deciding word. Concise beats complete — this workspace exists so Mihai is not buried.
