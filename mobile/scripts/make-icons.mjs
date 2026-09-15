#!/usr/bin/env node
/**
 * Regenerates the app icon and the splash mark: a dark square with "SAA" in white.
 * Run with `node scripts/make-icons.mjs`; needs network the first time for sharp-cli.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const assets = resolve(import.meta.dirname, '../assets')
const tmp = mkdtempSync(join(tmpdir(), 'saa-icons-'))

const DARK = '#0b0b0b'
const WHITE = '#ffffff'

const svg = ({ background, fill, size = 1024, scale = 1 }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  ${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ''}
  <text x="512" y="532" fill="${fill}" font-family="Helvetica, Arial, sans-serif" font-weight="bold"
    font-size="${Math.round(300 * scale)}" letter-spacing="${Math.round(-8 * scale)}"
    text-anchor="middle" dominant-baseline="central">SAA</text>
</svg>`

const targets = [
  { name: 'icon.png', svg: svg({ background: DARK, fill: WHITE }) },
  { name: 'favicon.png', svg: svg({ background: DARK, fill: WHITE, size: 64 }) },
  { name: 'splash-icon.png', svg: svg({ fill: WHITE, scale: 0.72 }) },
  { name: 'android-icon-background.png', svg: svg({ background: DARK, fill: DARK }) },
  // Adaptive icons crop to a circle, so the mark sits inside the safe zone.
  { name: 'android-icon-foreground.png', svg: svg({ fill: WHITE, scale: 0.62 }) },
  { name: 'android-icon-monochrome.png', svg: svg({ fill: WHITE, scale: 0.62 }) },
]

for (const target of targets) {
  const from = join(tmp, `${target.name}.svg`)
  writeFileSync(from, target.svg)
  execFileSync('npx', ['--yes', 'sharp-cli', '-i', from, '-o', join(assets, target.name), '--format', 'png'], {
    stdio: 'inherit',
  })
  console.log(`wrote assets/${target.name}`)
}
