import { useAppStore } from '../store/appStore'

// Wrap any async save so the global "All saved / Saving… / Save error" indicator
// reflects what is happening. Usage: await trackSave(() => someSupabaseWrite())
export async function trackSave(fn) {
  const { beginSave, endSave } = useAppStore.getState()
  beginSave()
  try {
    const res = await fn()
    endSave(true)
    return res
  } catch (e) {
    endSave(false, e?.message || 'Save failed')
    throw e
  }
}
