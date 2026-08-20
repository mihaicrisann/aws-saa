#!/usr/bin/env node
/* Wraps lectures/_src/<id>.html fragments into standalone pages in lectures/.
   Run: node lectures/_assets/build.mjs */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withIds, sectionsOf } from './sections.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const cur = JSON.parse(readFileSync(join(root, 'content', 'curriculum.json'), 'utf8'));
const modules = Object.fromEntries(cur.modules.map((m) => [m.id, m.name]));
const domains = Object.fromEntries(cur.domains.map((d) => [d.id, d.name]));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = (lec, prev, next, body) => `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(lec.title)} · AWS SAA</title>
<meta name="description" content="${esc(lec.standfirst)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="_assets/lecture.css">
</head>
<body>
<div class="progress-rail"><i></i></div>
<button class="theme-btn" type="button" aria-label="Toggle theme">☾</button>

<article class="lecture">
  <header class="masthead">
    <div class="crumbs">
      <span class="num">${String(lec.n).padStart(2, '0')}</span>
      <span class="dot">/</span>
      <span>${esc(modules[lec.module] || '')}</span>
      <span class="dot">·</span>
      <span>${lec.minutes} min read</span>
      <span class="dot">·</span>
      <a href="index.html">all lectures</a>
    </div>
    <h1>${esc(lec.title)}</h1>
    <p class="standfirst">${esc(lec.standfirst)}</p>
    <div class="meta-strip">
      ${lec.domains.map((d) => `<span class="chip on">${esc(domains[d] || d)}</span>`).join('\n      ')}
      ${lec.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('\n      ')}
    </div>
  </header>

${body.trim()}

  <nav class="lec-nav">
    ${prev ? `<a class="prev" href="${prev.id}.html">← ${esc(prev.title)}</a>` : '<span></span>'}
    ${next ? `<a class="next" href="${next.id}.html">${esc(next.title)} →</a>` : '<span></span>'}
  </nav>
</article>
<script src="_assets/lecture.js"></script>
</body>
</html>
`;

const indexPage = () => `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lectures · AWS SAA</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="_assets/lecture.css">
<style>
  .toc-mod { margin: 36px 0 0; }
  .toc-mod > h2 { margin: 0 0 2px; }
  .toc-mod > p.blurb { color: var(--muted-fg); margin: 0 0 12px; font-size: 14px; }
  .toc-list { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .toc-item {
    display: grid; grid-template-columns: 28px 1fr auto; gap: 12px; align-items: baseline;
    padding: 12px 16px; border-bottom: 1px solid var(--border); text-decoration: none; color: var(--fg);
  }
  .toc-item:last-child { border-bottom: 0; }
  .toc-item:hover { background: var(--muted); }
  .toc-item .n { font-size: 12px; color: var(--muted-fg); font-variant-numeric: tabular-nums; }
  .toc-item .t { font-weight: 500; font-size: 15px; }
  .toc-item .s { display: block; font-weight: 400; font-size: 14px; color: var(--muted-fg); margin-top: 2px; }
  .toc-item .m { font-size: 12px; color: var(--muted-fg); white-space: nowrap; }
</style>
</head>
<body>
<button class="theme-btn" type="button" aria-label="Toggle theme">☾</button>
<article class="lecture">
  <header class="masthead">
    <div class="crumbs"><span class="num">INDEX</span><span class="dot">/</span><span>${cur.exam.code}</span></div>
    <h1>Lectures</h1>
    <p class="standfirst">${cur.lectures.length} lectures, about ${cur.lectures.reduce((a, l) => a + l.minutes, 0)} minutes of reading, ordered so each one only assumes the ones before it.</p>
  </header>
${cur.modules
  .map((m) => {
    const ls = cur.lectures.filter((l) => l.module === m.id);
    if (!ls.length) return '';
    return `  <section class="toc-mod">
    <h2 data-mark="${m.id.toUpperCase()}">${esc(m.name)}</h2>
    <p class="blurb">${esc(m.blurb)}</p>
    <div class="toc-list">
${ls
  .map(
    (l) => `      <a class="toc-item" href="${l.id}.html">
        <span class="n">${String(l.n).padStart(2, '0')}</span>
        <span class="t">${esc(l.title)}<span class="s">${esc(l.standfirst)}</span></span>
        <span class="m">${l.minutes}m</span>
      </a>`,
  )
  .join('\n')}
    </div>
  </section>`;
  })
  .join('\n')}
</article>
<script src="_assets/lecture.js"></script>
</body>
</html>
`;

const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/* Search index: one entry per lecture section, with the section's text so the
   app's palette can find "object lock" without knowing which lecture it is in. */
const indexEntries = [];
const indexLecture = (lec, body) => {
  const parts = body.split(/(?=<h2[^>]*data-mark)/);
  for (const part of parts) {
    const secs = sectionsOf(part);
    if (!secs.length) continue;
    const text = strip(part.replace(/<h2[\s\S]*?<\/h2>/, ''));
    indexEntries.push({ lecture: lec.id, n: lec.n, lectureTitle: lec.title, id: secs[0].id, title: secs[0].title, text: text.slice(0, 600) });
  }
};

let built = 0;
const missing = [];
cur.lectures.forEach((lec, i) => {
  const src = join(root, 'lectures', '_src', `${lec.id}.html`);
  if (!existsSync(src)) { missing.push(lec.id); return; }
  const body = withIds(readFileSync(src, 'utf8'));
  indexLecture(lec, body);
  const out = page(lec, cur.lectures[i - 1], cur.lectures[i + 1], body);
  writeFileSync(join(root, 'lectures', `${lec.id}.html`), out);
  built++;
});
writeFileSync(join(root, 'lectures', 'index.html'), indexPage());
writeFileSync(join(root, 'lectures', 'search-index.json'), JSON.stringify(indexEntries));

console.log(`built ${built}/${cur.lectures.length} lectures + index.html`);
if (missing.length) console.log(`missing fragments: ${missing.join(', ')}`);
