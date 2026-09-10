#!/usr/bin/env node
/* Validates the harder v2 drill bank. Run: npm run check:v2 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sectionsOf } from '../lectures/_assets/sections.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const problems = []
const fail = (m) => problems.push(m)

const cur = read('content/curriculum.json')
const questions = read('content/questions-v2.json')

// the bank is authored to this shape; the app selects "hard mode" by these counts
const WANT_DOMAIN = { secure: 30, resilient: 26, perf: 24, cost: 20 }
const WANT_MULTI = 20
// "the longest option is the answer" must be no better than guessing. With four
// options chance is 25%, so anything at or below that carries no signal; we fail
// above it and print the full length ranking so a reviewer can see the shape.
const MAX_LONGEST_CUE = 0.25

const lectureIds = new Set(cur.lectures.map((l) => l.id))
const sectionIds = Object.fromEntries(
  cur.lectures.map((l) => {
    const p = join(root, 'lectures', '_src', `${l.id}.html`)
    return [l.id, new Set(existsSync(p) ? sectionsOf(readFileSync(p, 'utf8')).map((s) => s.id) : [])]
  }),
)
const domainIds = new Set(cur.domains.map((d) => d.id))

if (!Array.isArray(questions)) fail('content/questions-v2.json must be an array')

const seen = new Set()
for (const q of questions) {
  const id = q.id ?? '(no id)'
  if (!/^v2-\d{3}$/.test(q.id ?? '')) fail(`question ${id}: id must look like v2-081`)
  if (seen.has(q.id)) fail(`question ${id}: duplicate id`)
  seen.add(q.id)

  if (q.bank !== 'v2') fail(`question ${id}: bank must be "v2"`)
  if (!Number.isInteger(q.version)) fail(`question ${id}: version must be an integer`)
  if (!domainIds.has(q.domain)) fail(`question ${id}: unknown domain ${q.domain}`)
  if (!lectureIds.has(q.lecture)) fail(`question ${id}: unknown lecture ${q.lecture}`)
  if (!q.anchor) fail(`question ${id}: needs an anchor`)
  else if (!sectionIds[q.lecture]?.has(q.anchor))
    fail(`question ${id}: anchor "${q.anchor}" is not a section of ${q.lecture}`)

  if (!Array.isArray(q.options)) {
    fail(`question ${id}: needs options`)
    continue
  }
  if (q.options.some((o) => !o?.trim())) fail(`question ${id}: has an empty option`)
  if (new Set(q.options).size !== q.options.length) fail(`question ${id}: duplicate options`)

  if (!Array.isArray(q.correct) || !q.correct.length) {
    fail(`question ${id}: no correct answer`)
    continue
  }
  q.correct.forEach((i) => {
    if (!Number.isInteger(i) || i < 0 || i >= q.options.length)
      fail(`question ${id}: correct index ${i} out of range`)
  })
  if (new Set(q.correct).size !== q.correct.length) fail(`question ${id}: duplicate correct index`)
  if (q.correct.length === 1 && q.options.length !== 4)
    fail(`question ${id}: single-answer questions have exactly 4 options, found ${q.options.length}`)
  if (q.correct.length > 1 && q.options.length < 5)
    fail(`question ${id}: multi-answer questions have 5 or more options, found ${q.options.length}`)

  const said = /choose\s+(two|three)/i.exec(q.stem ?? '')?.[1]?.toLowerCase()
  const wanted = { 2: 'two', 3: 'three' }[q.correct.length]
  if (q.correct.length > 1 && !wanted) fail(`question ${id}: ${q.correct.length} correct answers is not a supported shape`)
  else if (wanted && said !== wanted) fail(`question ${id}: ${q.correct.length} correct answers but the stem says "${said ?? 'nothing'}"`)
  else if (q.correct.length === 1 && said) fail(`question ${id}: stem says "choose ${said}" but only one option is correct`)

  if (!Array.isArray(q.distractors) || q.distractors.length !== q.options.length)
    fail(`question ${id}: distractors length must match options`)
  else
    q.options.forEach((_, i) => {
      const note = q.distractors[i]
      if (q.correct.includes(i) && note !== '') fail(`question ${id}: option ${i} is correct and must have an empty distractor note`)
      if (!q.correct.includes(i) && !note?.trim()) fail(`question ${id}: option ${i} is wrong but has no distractor note`)
    })

  if (!q.stem?.trim()) fail(`question ${id}: missing stem`)
  else if (q.stem.length < 60) fail(`question ${id}: stem too short to be a scenario`)
  if (!q.explanation?.trim()) fail(`question ${id}: missing explanation`)
  else if (q.explanation.length < 80) fail(`question ${id}: explanation too short`)

  if (!Array.isArray(q.sources) || !q.sources.length) fail(`question ${id}: needs at least one source`)
  else
    q.sources.forEach((s, i) => {
      if (!/^https:\/\/(docs\.aws\.amazon\.com|aws\.amazon\.com)\//.test(s?.url ?? ''))
        fail(`question ${id}: source ${i} must be an official AWS URL`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s?.checkedAt ?? '')) fail(`question ${id}: source ${i} needs a checkedAt date`)
    })

  if (q.review?.status !== 'author-reviewed') fail(`question ${id}: review.status must be author-reviewed`)
  if (!['pending', 'passed'].includes(q.review?.independentReview))
    fail(`question ${id}: review.independentReview must be pending or passed`)
  if (!Array.isArray(q.review?.rubric) || !q.review.rubric.length) fail(`question ${id}: review.rubric is empty`)
}

const perDomain = cur.domains.map((d) => [d.id, questions.filter((q) => q.domain === d.id).length])
for (const [id, n] of perDomain) if (n !== WANT_DOMAIN[id]) fail(`domain ${id}: ${n} questions, want ${WANT_DOMAIN[id]}`)

const multi = questions.filter((q) => q.correct?.length > 1)
if (multi.length !== WANT_MULTI) fail(`${multi.length} multi-select questions, want ${WANT_MULTI}`)

// answer-shape cue: where does the correct option sit when the options are ranked
// longest to shortest? Rank 1 means a reader could pick it without reading.
const single = questions.filter((q) => q.correct?.length === 1 && Array.isArray(q.options))
const rankOf = (q) => {
  const n = q.options[q.correct[0]].length
  return 1 + q.options.filter((o, i) => i !== q.correct[0] && o.length > n).length
}
const ranks = [1, 2, 3, 4].map((r) => single.filter((q) => rankOf(q) === r).length)
const longest = single.filter((q) => {
  const max = Math.max(...q.options.map((o) => o.length))
  return q.options.filter((o) => o.length === max).length === 1 && q.options[q.correct[0]].length === max
})
const rate = single.length ? longest.length / single.length : 0
if (rate > MAX_LONGEST_CUE)
  fail(
    `answer-length cue: ${longest.length}/${single.length} single-answer questions have a uniquely longest correct option ` +
      `(${(rate * 100).toFixed(1)}%, limit ${(MAX_LONGEST_CUE * 100).toFixed(0)}%): ${longest.map((q) => q.id).join(', ')}`,
  )

const multiTopK = multi.filter((q) => {
  const order = q.options.map((o, i) => i).sort((a, b) => q.options[b].length - q.options[a].length)
  return order.slice(0, q.correct.length).every((i) => q.correct.includes(i))
})

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):\n` + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log(
  `✓ v2 bank ok — ${questions.length} questions (${perDomain.map(([id, n]) => `${id} ${n}`).join(' · ')}), ` +
    `${multi.length} multi-select, all anchored\n` +
    `  answer-length cue — correct option ranked by length (1 = longest): ` +
    `${ranks.map((n, i) => `#${i + 1} ${n}`).join(' · ')}; ` +
    `uniquely longest ${longest.length}/${single.length} (${(rate * 100).toFixed(1)}%, limit ${(MAX_LONGEST_CUE * 100).toFixed(0)}%); ` +
    `multi-select longest-pair ${multiTopK.length}/${multi.length}`,
)
