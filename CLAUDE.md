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
| `.claude/skills/` | Eight small study skills, plus `emil-design-eng` and `apple-design` for UI work |

## Rules

- **Run `npm run check` after touching anything in `content/`.** It validates ids, domains, lecture references, section anchors, option indices, distractor coverage, per-lecture minimums and multi-answer stems. `npm run test:ui` runs the browser smoke test after app changes.
- **Run `npm run lectures` after touching anything in `lectures/_src/` or `content/curriculum.json`.**
- Lecture fragments use a fixed component vocabulary (`note gotcha` / `note exam` / `note nuance`, `table-wrap`, `decisions`, `check`, `takeaways`). Match the existing files rather than inventing markup — see the `write-lecture` skill.
- Don't invent AWS limits, prices or figures. If a number is uncertain, check it or say so. A wrong number here becomes a wrong answer in the exam.
- `mise.toml` pins node and mirrors every npm script as a task (`mise run dev`, `mise run check`, …). Either form works.
- Content is written for the current SAA exam, SAA-C03 (no C04 has been announced; check aws.amazon.com/certification/coming-soon before assuming otherwise). Ignore anything that only applied to older versions, notably S3 eventual consistency.

## Writing voice

Direct, second person, no filler. Lead with the distinction that earns marks, not with what the service is for. Bold the deciding word. Tables for anything comparative. Concise beats complete — the whole point of this workspace is that Mihai is not buried in material.

## Design

Linear-level polish on a basement.studio editorial skeleton, built on [coss.com ui](https://coss.com/ui) (Base UI under the hood). Two surfaces: the body (`--canvas`, holds the sidebar) and the content panel that floats on it (`--background`, inset with a hairline border). Greys everywhere, colour only where it carries meaning — one hue per exam domain (`--domain-*`), `--good` / `--bad` for right and wrong. Borders come in two strengths (`border`, `border-strong`); text in three (`foreground`, `muted-foreground`, `faint-foreground`).

Type: Inter for UI and prose, Geist Mono for everything that is a label, a number or a key. The utilities in `app/src/index.css` are the vocabulary: `eyebrow` (mono, uppercase, tracked), `mono`, `display` / `display-lg` (tight negative tracking), `pressable` (scale on press). Every page opens with a `PageHeader`; stats live in one `StatRow` tray; lists are hairline `Rows`; grouped content is a `Panel`. All of these are in `app/src/components/parts.tsx`; primitives live in `app/src/components/ui/` (add more with `npx shadcn@latest add @coss/<name>` from `app/` — the `@coss` registry is wired up in `components.json`). The lectures use the same tokens in `lectures/_assets/lecture.css` — keep the two in sync.

Motion follows the `emil-design-eng` and `apple-design` skills in `.claude/skills/`: only transform and opacity, `--ease-out` for anything entering, under 300 ms, nothing on keyboard-driven actions, `stagger` only for lists that appear once, and `prefers-reduced-motion` drops movement but keeps fades.

Base UI is not Radix: composition is `render={<Comp />}`, not `asChild`; `ToggleGroup` takes an array `value` (`parts.tsx` exports `Choice` for the single-select case); `Dialog`/`AlertDialog` use `*Popup`; `Command` is built on `Autocomplete`, so items select via `onClick`. Light is the default; dark is the `.dark` class in the app and `data-theme="dark"` in lectures, both keyed off `localStorage["saa.theme"]`. Keyboard shortcuts go through `useHotkeys` and must be listed in the `?` dialog in `Shell.tsx`.

## Verifying app changes

```bash
npm run build && npm run preview   # then check it actually renders
```
