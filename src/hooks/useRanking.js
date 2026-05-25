import { useState, useEffect } from 'react'
import { rankingService } from '../lib/supabase'

export function useRanking() {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    rankingService.getAll().then(({ data }) => {
      setRanking(data || [])
      setLoading(false)
    })
  }, [])

  return { ranking, loading }
}

export function useTournamentRanking(tournamentId) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!tournamentId) return
    setLoading(true)
    rankingService.getByTournament(tournamentId).then(({ data }) => {
      if (!data) { setLoading(false); return }

      // Aggregate by referee
      const map = {}
      data.forEach((e) => {
        const ref = e.referees
        if (!ref) return
        if (!map[ref.id]) {
          map[ref.id] = {
            ...ref,
            scores: [],
            repeat_count: 0,
          }
        }
        map[ref.id].scores.push(e.overall_score)
        map[ref.id].repeat_count += [
          e.repeat_positioning,
          e.repeat_signals,
          e.repeat_attitude,
          e.repeat_captain_comm,
          e.repeat_presentation,
        ].filter(Boolean).length
      })

      const result = Object.values(map)
        .map((r) => ({
          ...r,
          total_evaluations: r.scores.length,
          avg_score:
            r.scores.length > 0
              ? Math.round(
                  (r.scores.reduce((a, b) => a + b, 0) / r.scores.length) * 100
                ) / 100
              : null,
        }))
        .sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0))

      setRanking(result)
      setLoading(false)
    })
  }, [tournamentId])

  return { ranking, loading }
}
