import { useEffect, useState } from 'react'

export interface PlayerScore {
  playerId: string
  name: string
  points: number
}

export interface MatchResult {
  gameId: string
  scores: PlayerScore[]
}

const STORAGE_KEY = 'match_history'

export function useMatchHistory() {
  const [history, setHistory] = useState<MatchResult[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          setHistory(JSON.parse(stored))
        }
      } catch (err) {
        console.error('Failed to load match history:', err)
      }
    }
  }, [])

  const addResult = (result: MatchResult) => {
    setHistory(prev => {
      const updated = [...prev, result]
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        } catch (err) {
          console.error('Failed to save match history:', err)
        }
      }
      return updated
    })
  }

  const clearHistory = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
    setHistory([])
  }

  return { history, addResult, clearHistory }
}
