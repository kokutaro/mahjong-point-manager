import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

// セッション情報の型定義
export interface GameSession {
  id: string
  sessionCode: string
  name?: string
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED' | 'CANCELLED'
  hostPlayerId: string
  totalGames: number
  createdAt: string
  endedAt?: string
}

// ゲーム状態の型定義
export interface GameState {
  gameId: string
  roomCode: string
  sessionId?: string
  sessionCode?: string
  sessionName?: string
  status: 'WAITING' | 'PLAYING' | 'FINISHED'
  players: Array<{
    playerId: string
    name: string
    position: number
    points: number
    isConnected: boolean
  }>
}

// アプリケーション状態の型定義
interface AppState {
  // セッション状態
  currentSession: GameSession | null
  sessionMode: boolean
  
  // ゲーム状態
  currentGame: GameState | null
  
  // UI状態
  isLoading: boolean
  error: string | null
  
  // アクション
  setSession: (session: GameSession | null) => void
  setSessionMode: (mode: boolean) => void
  setCurrentGame: (game: GameState | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearSession: () => void
  clearError: () => void
  reset: () => void
}

// 初期状態
const initialState = {
  currentSession: null,
  sessionMode: false,
  currentGame: null,
  isLoading: false,
  error: null,
}

// Zustandストア作成
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (set, get) => ({
        ...initialState,
        
        // セッション関連アクション
        setSession: (session) => {
          set(
            { currentSession: session },
            false,
            'setSession'
          )
        },
        
        setSessionMode: (mode) => {
          set(
            { sessionMode: mode },
            false,
            'setSessionMode'
          )
        },
        
        clearSession: () => {
          set(
            { 
              currentSession: null,
              sessionMode: false 
            },
            false,
            'clearSession'
          )
        },
        
        // ゲーム状態関連アクション
        setCurrentGame: (game) => {
          set(
            { currentGame: game },
            false,
            'setCurrentGame'
          )
        },
        
        // UI状態関連アクション
        setLoading: (loading) => {
          set(
            { isLoading: loading },
            false,
            'setLoading'
          )
        },
        
        setError: (error) => {
          set(
            { error },
            false,
            'setError'
          )
        },
        
        clearError: () => {
          set(
            { error: null },
            false,
            'clearError'
          )
        },
        
        // 全状態リセット
        reset: () => {
          set(
            initialState,
            false,
            'reset'
          )
        },
      }),
      {
        name: 'mahjong-app-store',
        partialize: (state) => ({
          // セッション情報のみを永続化
          currentSession: state.currentSession,
          sessionMode: state.sessionMode,
        }),
        // エラーハンドリングはZustandのデフォルトを使用
      }
    ),
    { name: 'mahjong-app' }
  )
)

// セレクター関数（パフォーマンス最適化）
export const useSessionStore = () => {
  const currentSession = useAppStore((state) => state.currentSession)
  const sessionMode = useAppStore((state) => state.sessionMode)
  const setSession = useAppStore((state) => state.setSession)
  const setSessionMode = useAppStore((state) => state.setSessionMode)
  const clearSession = useAppStore((state) => state.clearSession)
  
  return {
    currentSession,
    sessionMode,
    setSession,
    setSessionMode,
    clearSession,
  }
}

export const useGameStore = () => {
  const currentGame = useAppStore((state) => state.currentGame)
  const setCurrentGame = useAppStore((state) => state.setCurrentGame)
  
  return {
    currentGame,
    setCurrentGame,
  }
}

export const useUIStore = () => {
  const isLoading = useAppStore((state) => state.isLoading)
  const error = useAppStore((state) => state.error)
  const setLoading = useAppStore((state) => state.setLoading)
  const setError = useAppStore((state) => state.setError)
  const clearError = useAppStore((state) => state.clearError)
  
  return {
    isLoading,
    error,
    setLoading,
    setError,
    clearError,
  }
}