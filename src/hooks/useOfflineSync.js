import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { useEvaluations } from './useEvaluations'
import { toast } from '../components/ui/Toast'

/**
 * Monitors connection state and automatically syncs offline evaluation drafts
 * when the network returns (navigator.onLine → true).
 *
 * Logic:
 * - Listens for the browser 'online' event
 * - On reconnect: iterates evaluationDrafts and attempts to sync each one
 * - Success: removes the draft from local store
 * - Failure: keeps the draft and shows an error toast
 * - Status toasts: "Syncing…" → "N evaluations synced" or "Sync failed"
 */
export function useOfflineSync() {
  const { evaluationDrafts, removeDraft } = useAppStore()
  const { create } = useEvaluations()
  const isSyncingRef = useRef(false)

  useEffect(() => {
    async function syncDrafts() {
      if (isSyncingRef.current) return          // prevent concurrent syncs
      if (!navigator.onLine) return             // guard: still offline
      const drafts = Object.entries(evaluationDrafts)
      if (drafts.length === 0) return           // nothing to sync

      isSyncingRef.current = true
      toast('Syncing evaluations…', 'info', 5000)

      let synced = 0
      let failed = 0

      for (const [key, payload] of drafts) {
        try {
          await create(payload)
          removeDraft(key)
          synced++
        } catch (err) {
          console.error('[OfflineSync] Failed to sync draft', key, err)
          failed++
        }
      }

      isSyncingRef.current = false

      if (failed === 0) {
        toast.success(synced === 1 ? '1 evaluation synced' : `${synced} evaluations synced`, 4000)
      } else if (synced === 0) {
        toast.error(`Sync failed — ${failed} evaluation${failed > 1 ? 's' : ''} still offline`, 4000)
      } else {
        toast.warning(`Synced ${synced}, failed ${failed} — will retry when reconnected`, 4000)
      }
    }

    window.addEventListener('online', syncDrafts)
    return () => window.removeEventListener('online', syncDrafts)
  }, [evaluationDrafts, removeDraft, create])
}
