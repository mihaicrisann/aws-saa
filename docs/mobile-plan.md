# Mobile app plan — offline SAA study app

Started 2026-09-14. Scope: **lectures, drills, cards, mock exams**. Nothing else from the web app (no auth, no sync, no maps, no cheat sheet, no mistakes screen).

## Decision: Expo (React Native), dev builds, local Xcode

**Why Expo over Swift**

- `progress.ts` (zod schema + merge), `srs.ts`, `game.ts`, `content.ts` and the exam scoring port verbatim. Swift would mean rewriting all of it plus the tests.
- Lectures are HTML with CSS-drawn diagrams (`.diagram / .node / .arrow / .flow`). Rendering those natively is a rewrite of 21 lectures. Both stacks would use a WebView anyway; in Expo that is `react-native-webview` with inline HTML.
- One codebase also gives an Android APK for free, which never expires.

**How long a build stays on the phone** — this is about Apple signing, not the framework. Same answer for Swift and React Native.

| Apple account | Install method | Expires |
| --- | --- | --- |
| Free Apple ID (what the current signing identity looks like) | `npx expo run:ios --device --configuration Release` from Xcode | **7 days**, re-plug the phone and rerun |
| Paid Developer Program ($99/yr) | EAS Build internal distribution → install link on the phone | **1 year**, rebuild from a browser, no laptop |
| Paid, TestFlight | EAS Submit → TestFlight app | 90 days per build |
| Android, any account | sideload the APK | never |

Recommendation: pay for the Developer Program if this needs to live on an iPhone for the months until the exam. Until then the free path works and the app is identical.

Fallback not chosen: a PWA (add to home screen, service worker) also never expires and needs no account, but it is not a native app and iOS storage eviction makes progress less safe.

## Architecture

```
mobile/
  app/                 expo-router routes (tabs: Home, Learn, Drill, Cards, Exam)
  src/lib/             progress.ts, srs.ts, game.ts, content.ts  ← ported from app/src/lib
  src/lib/store.ts     same Progress shape, persisted to expo-sqlite kv-store (sync API), no server
  src/generated/       lectures.ts: { [id]: { html, sections } } built from lectures/_src + lecture.css
  src/theme/           tokens mirroring app/src/index.css (canvas, background, border, domain colours)
  scripts/build-lectures.mjs   run via `npm run lectures` from the repo root as well
  assets/fonts/        Inter + Geist Mono (bundled, no network)
```

- **Content** is imported from `../content/*.json` at build time and lives in the JS bundle (~760 KB). No fetching, ever.
- **Lectures** are self-contained HTML strings: fragment + inline `lecture.css` + theme attribute, no Google Fonts link. Displayed in `WebView` with `source={{ html }}`. Section anchors from `sections.mjs` drive "mark read" and the drill "read this section" link.
- **Progress** keeps the web `Progress` schema so the web export JSON imports unchanged (bring the 87 attempts over). Import via document picker, export via share sheet.
- **Store** is `useSyncExternalStore` over one in-memory object, written through to kv-store on every update. Same `update(fn)` API as the web store so screens port cleanly.
- **Active exam / active drill** persist like on the web so backgrounding the app never loses a mock.

## Phases

1. **Foundation** — scaffold Expo SDK 57 app in `mobile/`, tokens, fonts, tab shell, kv-store-backed store, ported libs with their vitest tests passing, lecture HTML generator, `tsc` clean, boots on the iOS simulator.
2. **Screens**, in parallel on top of phase 1:
   - Learn: lecture list grouped by module, reader (WebView, theme, prev/next, mark read, progress).
   - Drill + Cards: setup (domain / lecture / count / bank / unseen), question view with multi-select, reveal, distractor notes, confidence, session summary; cards due queue with four grades and interval preview.
   - Exam: 65-question timed mock from the weighted draw, flagging, navigator, resume, results with scaled score and per-domain breakdown, review wrong answers.
3. **Integration** — Home screen (streak, XP, due cards, last exam), import/export, dark mode, simulator smoke run with screenshots, device build instructions in `mobile/README.md`, EAS config for the paid path, Android APK build.

Every agent: Opus model, must run `npx tsc --noEmit` and `npm test` inside `mobile/` before reporting, and must not touch `app/`, `content/` or `lectures/`.

## Phase 4 — server login and sync (added 2026-09-15)

The server needs no new endpoints. better-auth email sign-in plus `GET`/`PUT /api/progress` already carry a revision, an idempotent operation id and a 409 on conflict. One addition: the progress responses now also return the row's `updatedAt`, so the phone can tell which side is newer.

Mobile engine (`mobile/src/lib/sync/`):

- Signed out: purely local, as before.
- Signed in: every local update becomes a queued operation (`changesBetween`), flushed in order when online. Pull on launch, on foreground, on reconnect, after each local edit and every 5 minutes while active.
- Conflict (both sides changed the same key while offline): **latest wins**, decided by local last-edit time against the server's `updatedAt`. Attempts and exams are always unioned, so history is never lost. Resolution is automatic; no dialog.
- First sign-in on a phone with local progress merges it into the account with `mergeImport`.
