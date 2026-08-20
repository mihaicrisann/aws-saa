#!/usr/bin/env node
/* Validates every content file the app depends on. Run: npm run check */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sectionsOf } from '../lectures/_assets/sections.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const problems = []
const fail = (m) => problems.push(m)

const cur = read('content/curriculum.json')
const questions = read('content/questions.json')
const cards = read('content/flashcards.json')
const cheat = read('content/cheatsheet.json')

const lectureIds = new Set(cur.lectures.map((l) => l.id))
const sectionIds = Object.fromEntries(
  cur.lectures.map((l) => {
    const p = join(root, 'lectures', '_src', `${l.id}.html`)
    return [l.id, new Set(existsSync(p) ? sectionsOf(readFileSync(p, 'utf8')).map((s) => s.id) : [])]
  }),
)
const domainIds = new Set(cur.domains.map((d) => d.id))
const moduleIds = new Set(cur.modules.map((m) => m.id))

if (cur.domains.reduce((a, d) => a + d.weight, 0) !== 100) fail('domain weights do not sum to 100')

for (const l of cur.lectures) {
  if (!moduleIds.has(l.module)) fail(`lecture ${l.id}: unknown module ${l.module}`)
  l.domains.forEach((d) => domainIds.has(d) || fail(`lecture ${l.id}: unknown domain ${d}`))
  if (!existsSync(join(root, 'lectures', '_src', `${l.id}.html`))) fail(`lecture ${l.id}: missing fragment`)
  if (!existsSync(join(root, 'lectures', `${l.id}.html`))) fail(`lecture ${l.id}: not built — run npm run lectures`)
}

const seenQ = new Set()
for (const q of questions) {
  if (seenQ.has(q.id)) fail(`question ${q.id}: duplicate id`)
  seenQ.add(q.id)
  if (!domainIds.has(q.domain)) fail(`question ${q.id}: unknown domain ${q.domain}`)
  if (!lectureIds.has(q.lecture)) fail(`question ${q.id}: unknown lecture ${q.lecture}`)
  if (!q.stem || !q.explanation) fail(`question ${q.id}: missing stem or explanation`)
  if (q.anchor && !sectionIds[q.lecture]?.has(q.anchor)) fail(`question ${q.id}: anchor "${q.anchor}" is not a section of ${q.lecture}`)
  if (new Set(q.options).size !== q.options?.length) fail(`question ${q.id}: duplicate options`)
  if (q.distractors) q.options.forEach((_, i) => q.correct.includes(i) || q.distractors[i] || fail(`question ${q.id}: option ${i} is wrong but has no distractor note`))
  if (q.explanation && q.explanation.length < 40) fail(`question ${q.id}: explanation too short`)
  if (!Array.isArray(q.options) || q.options.length < 3) fail(`question ${q.id}: needs at least 3 options`)
  if (!Array.isArray(q.correct) || !q.correct.length) fail(`question ${q.id}: no correct answer`)
  q.correct.forEach((i) => (i >= 0 && i < q.options.length) || fail(`question ${q.id}: correct index ${i} out of range`))
  if (q.distractors && q.distractors.length !== q.options.length)
    fail(`question ${q.id}: distractors length must match options`)
  if (q.correct.length > 1 && !/choose\s+(two|three)/i.test(q.stem))
    fail(`question ${q.id}: multi-answer but the stem does not say "Choose TWO/THREE"`)
}

const seenC = new Set()
for (const c of cards) {
  if (seenC.has(c.id)) fail(`card ${c.id}: duplicate id`)
  seenC.add(c.id)
  if (!domainIds.has(c.domain)) fail(`card ${c.id}: unknown domain ${c.domain}`)
  if (!lectureIds.has(c.lecture)) fail(`card ${c.id}: unknown lecture ${c.lecture}`)
  if (!c.front || !c.back) fail(`card ${c.id}: empty front or back`)
}

for (const s of cheat.sections) {
  if (!['pairs', 'triples', 'list'].includes(s.kind)) fail(`cheatsheet ${s.id}: unknown kind ${s.kind}`)
  const want = s.kind === 'pairs' ? 2 : s.kind === 'triples' ? 3 : null
  if (want)
    s.rows.forEach((r, i) => (Array.isArray(r) && r.length === want) || fail(`cheatsheet ${s.id} row ${i}: expected ${want} cells`))
}

for (const l of cur.lectures) {
  const nq = questions.filter((q) => q.lecture === l.id).length
  const nc = cards.filter((c) => c.lecture === l.id).length
  if (nq < 5) fail(`lecture ${l.id}: only ${nq} questions (want ≥5)`)
  if (nc < 5) fail(`lecture ${l.id}: only ${nc} cards (want ≥5)`)
}
const anchored = questions.filter((q) => q.anchor).length

const perDomain = cur.domains.map((d) => `${d.id} ${questions.filter((q) => q.domain === d.id).length}`).join(' · ')

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):\n` + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log(
  `✓ content ok — ${cur.lectures.length} lectures, ${questions.length} questions (${perDomain}, ${anchored} anchored), ${cards.length} cards, ${cheat.sections.length} cheat sections`,
)
