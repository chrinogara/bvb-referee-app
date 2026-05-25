import { useState, useEffect, useCallback } from 'react'
import { refereeService } from '../lib/supabase'

export function useReferees() {
  const [referees, setReferees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await refereeService.getAll()
    if (error) setError(error.message)
    else setReferees(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (data) => {
    const { data: created, error } = await refereeService.create(data)
    if (error) throw new Error(error.message)
    setReferees((prev) => [...prev, created].sort((a, b) => a.last_name.localeCompare(b.last_name)))
    return created
  }

  const update = async (id, data) => {
    const { data: updated, error } = await refereeService.update(id, data)
    if (error) throw new Error(error.message)
    setReferees((prev) => prev.map((r) => (r.id === id ? updated : r)))
    return updated
  }

  const remove = async (id) => {
    const { error } = await refereeService.delete(id)
    if (error) throw new Error(error.message)
    setReferees((prev) => prev.filter((r) => r.id !== id))
  }

  return { referees, loading, error, refetch: fetch, create, update, remove }
}

export function useReferee(id) {
  const [referee, setReferee] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    refereeService.getById(id).then(({ data }) => {
      setReferee(data)
      setLoading(false)
    })
  }, [id])

  return { referee, loading }
}
