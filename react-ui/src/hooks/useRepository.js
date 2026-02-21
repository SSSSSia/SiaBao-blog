import { useState, useEffect, useCallback, useRef } from 'react'

const DEFAULT_TIMEOUT_MS = 10000

const timeoutPromise = (ms) =>
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)
  })

export const useRepository = (
  repositoryFn,
  immediate = true,
  options = {},
) => {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS
  const [state, setState] = useState({
    data: null,
    loading: immediate,
    error: null,
  })

  const repositoryRef = useRef(repositoryFn)
  const hasExecutedRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    repositoryRef.current = repositoryFn
  }, [repositoryFn])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const execute = useCallback(
    async (...args) => {
      if (!mountedRef.current) return null
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const response = await Promise.race([
          repositoryRef.current(...args),
          timeoutPromise(timeoutMs),
        ])

        if (!mountedRef.current) return response

        setState({
          data: response?.data ?? null,
          loading: false,
          error: response?.error ?? null,
        })
        return response
      } catch (error) {
        if (!mountedRef.current) return null
        setState({
          data: null,
          loading: false,
          error,
        })
        return { data: null, loading: false, error }
      }
    },
    [timeoutMs],
  )

  const reset = useCallback(() => {
    if (!mountedRef.current) return
    setState({
      data: null,
      loading: false,
      error: null,
    })
    hasExecutedRef.current = false
  }, [])

  useEffect(() => {
    if (immediate && !hasExecutedRef.current) {
      hasExecutedRef.current = true
      const timer = setTimeout(() => {
        execute()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [immediate, execute])

  return {
    ...state,
    execute,
    reset,
  }
}

export default useRepository
