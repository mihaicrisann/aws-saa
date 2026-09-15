/* Stands in for expo-secure-store under vitest, which has no native keychain. */
const items = new Map<string, string>()

export const getItemAsync = async (key: string) => items.get(key) ?? null
export const setItemAsync = async (key: string, value: string) => {
  items.set(key, value)
}
export const deleteItemAsync = async (key: string) => {
  items.delete(key)
}
