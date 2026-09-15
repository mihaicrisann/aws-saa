import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { exportStore, flush, importStore, today, type ImportResult } from './store'

export const exportName = (d = new Date()) => `saa-progress-${today(d)}.json`

/** Writes the export to the cache directory and hands the file to the share sheet. */
export async function shareProgress() {
  flush()
  const file = new File(Paths.cache, exportName())
  if (file.exists) file.delete()
  file.create()
  file.write(exportStore())
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available here.')
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Export progress',
  })
  return file.name
}

/** Picks a JSON export and merges it. Returns null when the picker was dismissed. */
export async function importProgress(): Promise<ImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json'],
    copyToCacheDirectory: true,
    multiple: false,
  })
  const asset = picked.canceled ? undefined : picked.assets?.[0]
  if (!asset) return null
  return importStore(new File(asset.uri).textSync())
}
