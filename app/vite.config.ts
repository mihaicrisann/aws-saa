import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const progressFile = path.resolve(here, '../notes/progress.json')

/** Mirrors the app's progress store to notes/progress.json while the dev server runs. */
function progressMirror(): Plugin {
  return {
    name: 'progress-mirror',
    configureServer(server) {
      server.middlewares.use('/api/progress', async (req, res) => {
        if (req.method === 'GET') {
          try {
            res.setHeader('content-type', 'application/json')
            res.end(await readFile(progressFile, 'utf8'))
          } catch {
            res.end('null')
          }
          return
        }
        if (req.method === 'PUT') {
          let body = ''
          for await (const chunk of req) body += chunk
          await mkdir(path.dirname(progressFile), { recursive: true })
          await writeFile(progressFile, body)
          res.statusCode = 204
          res.end()
          return
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), progressMirror()],
  resolve: {
    alias: {
      '@': path.resolve(here, 'src'),
      '@content': path.resolve(here, '../content'),
    },
  },
  server: {
    port: 5180,
    open: process.env.CI_SMOKE ? false : true,
    fs: { allow: [path.resolve(here, '..')] },
  },
})
