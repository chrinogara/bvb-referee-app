import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { useEvaluations } from './useEvaluations'
import { toast } from '../components/ui/Toast'

/**
 * Monitora lo stato di connessione e sincronizza automaticamente i draft offline
 * quando la rete ritorna (navigator.onLine → true).
 * 
 * Logica:
 * - Ascolta l'evento 'online' del browser
 * - Al ritorno online: itera evaluationDrafts e tenta di sincronizzare ognuno
 * - Se successo: rimuove il draft
 * - Se fallisce: lascia il draft e mostra errore
 * - Toast di stato: "Syncing..." → "X evaluations synced" o "Sync failed"
 */
export function useOfflineSync() {
  const { evaluationDrafts, removeDraft } = useAppStore()
  const { create } = useEvaluations()
  const isSyncingRef = useRef(false)

  useEffect(() => {
    async function syncDrafts() {
      if (isSyncingRef.current) return // Evita sync concorrenti
      if (navigator.onLine === false) return // Non sincronizzare se offline

      const drafts = Object.entries(evaluationDrafts)
      if (drafts.length === 0) return // Niente da sincronizzare

      isSyncingRef.current = true
      const toastId = toast.info('Syncing evaluations...', 5000)

      let syncedCount = 0
      let failedCount = 0
      const failedDrafts = []

      for (const [key, payload] of drafts) {
        try {
          await create(payload)
          removeDraft(key)
          syncedCount++
        } catch (err) {
          console.error(`[Offline Sync] Failed to sync draft ${key}:`, err)
          failedCount++
          failedDrafts.push(key)
        }
      }

      isSyncingRef.current = false

      // Mostra risultato
      if (failedCount === 0) {
        toast.success(
          syncedCount === 1
            ? '1 evaluation synced'
            : `${syncedCount} evaluations synced`,
          4000
        )
      } else if (syncedCount === 0) {
        toast.error(
          `Sync failed: ${failedCount} evaluation${failedCount > 1 ? 's' : ''} still offline`,
          4000
        )
      } else {
        toast.warning(
          `Synced ${syncedCount}, failed ${failedCount} — retry later`,
          4000
        )
      }
    }

    // Listener per evento 'online'
    const handleOnline = () => {
      syncDrafts()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [evaluationDrafts, removeDraft, create])
}
