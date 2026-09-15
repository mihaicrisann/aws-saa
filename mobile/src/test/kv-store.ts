/* Stands in for expo-sqlite/kv-store under vitest, which has no native module. */
const items = new Map<string, string>()

export default {
  getItemSync: (key: string) => items.get(key) ?? null,
  setItemSync: (key: string, value: string) => {
    items.set(key, value)
  },
  removeItemSync: (key: string) => {
    items.delete(key)
  },
}
