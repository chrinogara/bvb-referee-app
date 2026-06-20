import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAppStore = create(
  persist(
    (set, get) => ({
      // ─── UI state ────────────────────────────────────────────────────────
      sidebarOpen: false,
      darkMode: false, // light theme is default now
      sandboxMode: false, // when ON, writes go with is_test=true
      activeTournamentId: null,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setDarkMode: (v) => set({ darkMode: v }),
      setSandboxMode: (v) => set({ sandboxMode: v }),
      setActiveTournamentId: (id) => set({ activeTournamentId: id }),

      // ─── Offline queue ───────────────────────────────────────────────────
      offlineQueue: [],

      addToQueue: (action) =>
        set((s) => ({ offlineQueue: [...s.offlineQueue, { ...action, id: Date.now() }] })),

      removeFromQueue: (id) =>
        set((s) => ({ offlineQueue: s.offlineQueue.filter((q) => q.id !== id) })),

      clearQueue: () => set({ offlineQueue: [] }),

      // ─── Local evaluation drafts (offline) ───────────────────────────────
      evaluationDrafts: {},

      saveDraft: (key, data) =>
        set((s) => ({
          evaluationDrafts: { ...s.evaluationDrafts, [key]: data },
        })),

      getDraft: (key) => get().evaluationDrafts[key],

      removeDraft: (key) =>
        set((s) => {
          const drafts = { ...s.evaluationDrafts }
          delete drafts[key]
          return { evaluationDrafts: drafts }
        }),

      // ─── Last used values (speed entry) ─────────────────────────────────
      lastTournamentId: null,
      lastDayNumber: 1,
      setLastTournamentId: (id) => set({ lastTournamentId: id }),
      setLastDayNumber: (n) => set({ lastDayNumber: n }),

      // ─── Save status (global "all saved" indicator) ─────────────────────
      saveStatus: 'idle',   // 'idle' | 'saving' | 'saved' | 'error'
      savePending: 0,       // number of writes currently in flight
      lastSavedAt: null,
      lastSaveError: null,
      beginSave: () =>
        set((s) => ({ savePending: s.savePending + 1, saveStatus: 'saving' })),
      endSave: (ok = true, errMsg = null) =>
        set((s) => {
          const pending = Math.max(0, s.savePending - 1)
          return {
            savePending: pending,
            saveStatus: pending > 0 ? 'saving' : ok ? 'saved' : 'error',
            lastSavedAt: ok ? Date.now() : s.lastSavedAt,
            lastSaveError: ok ? null : errMsg,
          }
        }),
    }),
    {
      name: 'bvb-rc-store',
      partialize: (s) => ({
        darkMode: s.darkMode,
        sandboxMode: s.sandboxMode,
        activeTournamentId: s.activeTournamentId,
        offlineQueue: s.offlineQueue,
        evaluationDrafts: s.evaluationDrafts,
        lastTournamentId: s.lastTournamentId,
        lastDayNumber: s.lastDayNumber,
      }),
    }
  )
)
