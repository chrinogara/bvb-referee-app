import { useState, useEffect, useCallback } from 'react'
import { evaluationService } from '../lib/supabase'
import { computeScore } from '../lib/scoring'

export function useEvaluations(filter = {}) {
  const [evaluations, setEvaluations] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let result

    if (filter.refereeId) {
      result = await evaluationService.getByReferee(filter.refereeId)
    } else if (filter.tournamentId) {
      result = await evaluationService.getByTournament(filter.tournamentId)
    } else {
      result = await evaluationService.getAll()
    }

    setEvaluations(result.data || [])
    setLoading(false)
  }, [filter.refereeId, filter.tournamentId])

  useEffect(() => { fetch() }, [fetch])

  const create = async (formData) => {
    const scores = {
      positioning:  formData.score_positioning,
      signals:      formData.score_signals,
      attitude:     formData.score_attitude,
      captain_comm: formData.score_captain_comm,
      presentation: formData.score_presentation,
    }
    const repeats = {
      positioning:  formData.repeat_positioning,
      signals:      formData.repeat_signals,
      attitude:     formData.repeat_attitude,
      captain_comm: formData.repeat_captain_comm,
      presentation: formData.repeat_presentation,
    }

    const { overall, penalty, grade } = computeScore(scores, repeats, formData.match_difficulty)

    const payload = {
      ...formData,
      overall_score: overall,
      repeat_penalty: penalty,
      grade: grade ? grade.grade : null,
    }

    const { data, error } = await evaluationService.create(payload)
    if (error) throw new Error(error.message)
    setEvaluations((prev) => [data, ...prev])
    return data
  }

  const remove = async (id) => {
    const { error } = await evaluationService.delete(id)
    if (error) throw new Error(error.message)
    setEvaluations((prev) => prev.filter((e) => e.id !== id))
  }

  const resetForReferee = async (refereeId) => {
    const { error } = await evaluationService.deleteByReferee(refereeId)
    if (error) throw new Error(error.message)
    setEvaluations((prev) => prev.filter((e) => e.referee_id !== refereeId))
  }

  return { evaluations, loading, refetch: fetch, create, remove, resetForReferee }
}
