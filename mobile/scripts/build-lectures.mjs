#!/usr/bin/env node
/* Bundles every lecture fragment into one self-contained HTML document for the
   WebView: fragment + inline lecture.css + a phone override, no network at all.
   Writes mobile/src/generated/lectures.ts. Run: node scripts/build-lectures.mjs */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const { withIds, sectionsOf } = await import(
  join(root, 'lectures', '_assets', 'sections.mjs')
)

const cur = JSON.parse(readFileSync(join(root, 'content', 'curriculum.json'), 'utf8'))
const modules = Object.fromEntries(cur.modules.map((m) => [m.id, m.name]))
const domains = Object.fromEntries(cur.domains.map((d) => [d.id, d.name]))

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* The WebView cannot see fonts bundled into the native app, so the families fall
   back to the system ones, which are the closest match iOS already has. */
const css = readFileSync(join(root, 'lectures', '_assets', 'lecture.css'), 'utf8')
  .replace(/--font:[^;]+;/, '--font: -apple-system, system-ui, sans-serif;')
  .replace(/--mono:[^;]+;/, '--mono: ui-monospace, Menlo, monospace;')

const phone = `
/* phone overrides: the reader is the whole screen, the app draws the chrome */
/* surfaces match src/theme/tokens.ts so the WebView never flashes against the app */
:root { --bg: #ffffff; --card: #ffffff; --border: #e6e6e6; }
[data-theme="dark"] { --bg: #0e0e0e; --card: #141414; --muted: #1a1a1a; --border: rgba(255,255,255,0.08); }
html { background: var(--bg); }
/* the standalone pages reveal these on scroll with a script the reader does not ship */
.lecture .note, .lecture .table-wrap, .lecture .decisions, .lecture .takeaways { opacity: 1; transform: none; transition: none; }
.lecture { max-width: none; padding: 20px 18px 64px; }
body { font-size: 16px; -webkit-text-size-adjust: 100%; }
h1 { font-size: 28px; }
h2 { font-size: 20px; }
.table-wrap, .diagram { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.decision { grid-template-columns: 1fr; gap: 4px; }
* { -webkit-tap-highlight-color: transparent; }
`

/* Reports reading position and the section in view; the app injects the theme. */
const script = `
(function () {
  var post = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };
  window.setTheme = function (name) { document.documentElement.dataset.theme = name; };
  /* Re-run after the late reflows (web fonts, tables) so the anchor stays put. */
  window.goToSection = function (id) {
    var jump = function () {
      var el = document.getElementById(id);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 8, behavior: 'auto' });
    };
    [0, 250, 600].forEach(function (delay) { setTimeout(jump, delay); });
  };
  var heads = [].slice.call(document.querySelectorAll('h2[id]'));
  var lastSection = '';
  var ticking = false;
  var report = function () {
    ticking = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    post({ type: 'scroll', ratio: max > 0 ? Math.min(1, window.scrollY / max) : 1 });
    var current = '';
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top <= 80) current = heads[i].id;
    }
    if (current && current !== lastSection) {
      lastSection = current;
      post({ type: 'section', id: current });
    }
  };
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    setTimeout(report, 120);
  }, { passive: true });
  window.addEventListener('load', report);
})();
`

const page = (lec, body) => `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(lec.title)}</title>
<style>${css}${phone}</style>
</head>
<body>
<article class="lecture">
  <header class="masthead">
    <div class="crumbs">
      <span class="num">${String(lec.n).padStart(2, '0')}</span>
      <span class="dot">/</span>
      <span>${esc(modules[lec.module] || '')}</span>
      <span class="dot">·</span>
      <span>${lec.minutes} min read</span>
    </div>
    <h1>${esc(lec.title)}</h1>
    <p class="standfirst">${esc(lec.standfirst)}</p>
    <div class="meta-strip">
      ${lec.domains.map((d) => `<span class="chip on">${esc(domains[d] || d)}</span>`).join('\n      ')}
      ${lec.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('\n      ')}
    </div>
  </header>

${body.trim()}
</article>
<script>${script}</script>
</body>
</html>
`

const entries = []
const missing = []
for (const lec of cur.lectures) {
  const src = join(root, 'lectures', '_src', `${lec.id}.html`)
  if (!existsSync(src)) {
    missing.push(lec.id)
    continue
  }
  const body = withIds(readFileSync(src, 'utf8'))
  entries.push({ id: lec.id, html: page(lec, body), sections: sectionsOf(body) })
}

const out = `/* Generated by scripts/build-lectures.mjs. Do not edit. */

export interface LectureSection {
  id: string
  title: string
}

export interface LectureDoc {
  html: string
  sections: LectureSection[]
}

export const lectureHtml: Record<string, LectureDoc> = {
${entries
  .map(
    (e) => `  ${JSON.stringify(e.id)}: {
    html: ${JSON.stringify(e.html)},
    sections: ${JSON.stringify(e.sections)},
  },`,
  )
  .join('\n')}
}

export const lectureIds = Object.keys(lectureHtml)
`

mkdirSync(join(here, '..', 'src', 'generated'), { recursive: true })
writeFileSync(join(here, '..', 'src', 'generated', 'lectures.ts'), out)

console.log(`built ${entries.length}/${cur.lectures.length} mobile lectures`)
if (missing.length) console.log(`missing fragments: ${missing.join(', ')}`)
