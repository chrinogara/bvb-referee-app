import { useState, useEffect, useCallback } from 'react'
import { tournamentService } from '../lib/supabase'

export function useTournaments() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await tournamentService.getAll()
    if (error) setError(error.message)
    else setTournaments(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (data) => {
    const { data: created, error } = await tournamentService.create(data)
    if (error) throw new Error(error.message)
    setTournaments((prev) =>
      [...prev, created].sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    )
    return created
  }

  const update = async (id, data) => {
    const { data: updated, error } = await tournamentService.update(id, data)
    if (error) throw new Error(error.message)
    setTournaments((prev) => prev.map((t) => (t.id === id ? updated : t)))
    return updated
  }

  return { tournaments, loading, error, refetch: fetch, create, update }
}

export function useTournamentReferees(tournamentId) {
  const [referees, setReferees] = useState([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!tournamentId) return
    setLoading(true)
    const { data } = await tournamentService.getReferees(tournamentId)
    setReferees((data || []).map((tr) => tr.referees))
    setLoading(false)
  }, [tournamentId])

  useEffect(() => { fetch() }, [fetch])

  const assign = async (refereeId) => {
    await tournamentService.assignReferee(tournamentId, refereeId)
    fetch()
  }

  const remove = async (refereeId) => {
    await tournamentService.removeReferee(tournamentId, refereeId)
    setReferees((prev) => prev.filter((r) => r.id !== refereeId))
  }

  return { referees, loading, assign, remove, refetch: fetch }
}
