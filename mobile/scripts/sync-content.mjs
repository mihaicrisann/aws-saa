#!/usr/bin/env node
/* Copies the curriculum JSON into the app so Metro only ever resolves files
   inside mobile/. Run by `npm run lectures` and by prestart/prebuild. */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const out = join(here, '..', 'src', 'content')

const files = ['curriculum.json', 'questions.json', 'questions-v2.json', 'flashcards.json']
mkdirSync(out, { recursive: true })
for (const f of files) copyFileSync(join(root, 'content', f), join(out, f))
console.log(`synced ${files.length} content files`)
