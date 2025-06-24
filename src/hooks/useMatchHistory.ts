import { useCallback, useEffect, useState } from 'react'

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
const MAX_HISTORY_SIZE = 50 // 履歴の最大保存数

export function useMatchHistory() {
  const [history, setHistory] = useState<MatchResult[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          // 履歴が多すぎる場合は制限する
          if (Array.isArray(parsed) && parsed.length > MAX_HISTORY_SIZE) {
            const trimmed = parsed.slice(-MAX_HISTORY_SIZE)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
            setHistory(trimmed)
          } else {
            setHistory(parsed)
          }
        }
      } catch (err) {
        console.error('Failed to load match history:', err)
        // エラーの場合はLocalStorageをクリア
        localStorage.removeItem(STORAGE_KEY)
        setHistory([])
      }
    }
  }, [])

  const addResult = useCallback((result: MatchResult) => {
    setHistory(prev => {
      // 既に同じgameIdが存在する場合は追加しない
      if (prev.some(item => item.gameId === result.gameId)) {
        return prev
      }
      
      const updated = [...prev, result]
      // 履歴サイズを制限
      const trimmed = updated.slice(-MAX_HISTORY_SIZE)
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
        } catch (err) {
          console.error('Failed to save match history:', err)
          // 容量エラーの場合は古いデータを削除して再試行
          if (err instanceof Error && err.name === 'QuotaExceededError') {
            try {
              // 履歴を半分に削る
              const halfSize = Math.floor(MAX_HISTORY_SIZE / 2)
              const reduced = trimmed.slice(-halfSize)
              localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced))
              return reduced
            } catch (retryErr) {
              console.error('Failed to save reduced match history:', retryErr)
              // それでも失敗する場合は履歴をクリア
              localStorage.removeItem(STORAGE_KEY)
              return [result] // 現在の結果のみ保持
            }
          }
        }
      }
      return trimmed
    })
  }, [])

  const clearHistory = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
    setHistory([])
  }, [])

  return { history, addResult, clearHistory }
}
