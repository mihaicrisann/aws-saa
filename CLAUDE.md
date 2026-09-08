# AWS SAA study workspace

Mihai is preparing for the AWS Certified Solutions Architect – Associate exam. He is an experienced developer and new to AWS certification. This repo is his study environment.

## What this repo is

| Path | What it holds |
| --- | --- |
| `lectures/_src/*.html` | Lecture **body fragments** — the source you edit |
| `lectures/*.html` | Generated standalone pages. **Never edit these**; run `npm run lectures` |
| `content/*.json` | Curriculum, question bank, flashcards, cheat sheet — the app's only data source |
| `app/` | Vite + React 19 + Tailwind 4 study app. No backend; state is in local storage |
| `notes/` | Mihai's: `concepts/`, `journal/`, `mistakes.md`, and `progress.json` (the app's store, mirrored by the dev server). Write here when a skill says to |
| `.claude/skills/` | Eight small composable skills |

## Rules

- **Run `npm run check` after touching anything in `content/`.** It validates ids, domains, lecture references, section anchors, option indices, distractor coverage, per-lecture minimums and multi-answer stems. `npm run test:ui` runs the browser smoke test after app changes.
- **Run `npm run lectures` after touching anything in `lectures/_src/` or `content/curriculum.json`.**
- Lecture fragments use a fixed component vocabulary (`note gotcha` / `note exam` / `note nuance`, `table-wrap`, `decisions`, `check`, `takeaways`). Match the existing files rather than inventing markup — see the `write-lecture` skill.
- Don't invent AWS limits, prices or figures. If a number is uncertain, check it or say so. A wrong number here becomes a wrong answer in the exam.
- `mise.toml` pins node and mirrors every npm script as a task (`mise run dev`, `mise run check`, …). Either form works.
- Content is written for the current SAA exam (C03/C04 — identical domain weights). Ignore anything that only applied to older versions, notably S3 eventual consistency.

## Writing voice

Direct, second person, no filler. Lead with the distinction that earns marks, not with what the service is for. Bold the deciding word. Tables for anything comparative. Concise beats complete — the whole point of this workspace is that Mihai is not buried in material.

## Design

Minimal, [coss.com ui](https://coss.com/ui) (Base UI under the hood, neutral palette, Inter only). Less is more: greys everywhere, colour only where it carries meaning — one hue per exam domain (`--domain-*`), `--good` / `--bad` for right and wrong. Primitives live in `app/src/components/ui/` (add more with `npx shadcn@latest add @coss/<name>` from `app/` — the `@coss` registry is wired up in `components.json`); shared bits in `app/src/components/parts.tsx`. The lectures use the same tokens in `lectures/_assets/lecture.css` — keep the two in sync.

Base UI is not Radix: composition is `render={<Comp />}`, not `asChild`; `ToggleGroup` takes an array `value` (`parts.tsx` exports `Choice` for the single-select case); `Dialog`/`AlertDialog` use `*Popup`; `Command` is built on `Autocomplete`, so items select via `onClick`. `Frame` / `FramePanel` is the house container — a muted tray holding one or more panels; `parts.tsx` wraps it as `StatRow` and `Rows`. Light is the default; dark is the `.dark` class in the app and `data-theme="dark"` in lectures, both keyed off `localStorage["saa.theme"]`. Animation only where it reveals information; respect `prefers-reduced-motion`. Keyboard shortcuts go through `useHotkeys` and must be listed in the `?` dialog in `Shell.tsx`.

## Verifying app changes

```bash
npm run build && npm run preview   # then check it actually renders
```
