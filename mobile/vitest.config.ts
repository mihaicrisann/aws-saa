import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // No native modules under vitest; the store's storage is stubbed in memory.
      'expo-sqlite/kv-store': fileURLToPath(new URL('./src/test/kv-store.ts', import.meta.url)),
      'expo-secure-store': fileURLToPath(new URL('./src/test/secure-store.ts', import.meta.url)),
    },
  },
})
