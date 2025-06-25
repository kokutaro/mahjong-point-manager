'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SoloGameState, SoloPlayerState } from '@/lib/solo/score-manager'
import { getPlayerWind } from '@/schemas/solo'

interface SoloGamePageProps {
  params: { gameId: string }
}

export default function SoloGamePage({ params }: SoloGamePageProps) {
  const { gameId } = params
  const router = useRouter()
  const [gameState, setGameState] = useState<SoloGameState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  // ゲーム状態を取得
  const fetchGameState = useCallback(async () => {
    try {
      const response = await fetch(`/api/solo/${gameId}`, {
        credentials: 'include'
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'ゲーム状態の取得に失敗しました')
      }

      if (result.success) {
        setGameState(result.data)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'エラーが発生しました')
    }
  }, [gameId])

  // ゲーム開始
  const startGame = async () => {
    try {
      setIsStarting(true)
      const response = await fetch(`/api/solo/${gameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'start' }),
        credentials: 'include'
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'ゲーム開始に失敗しました')
      }

      if (result.success) {
        setGameState(result.data)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ゲーム開始に失敗しました')
    } finally {
      setIsStarting(false)
    }
  }

  // 初期データ取得
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await fetchGameState()
      setIsLoading(false)
    }
    
    if (gameId) {
      loadData()
    }
  }, [gameId, fetchGameState])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-4">エラー</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
            >
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">ゲームデータが見つかりません</div>
      </div>
    )
  }

  // ゲーム開始前の画面
  if (gameState.status === 'WAITING') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                一人プレイゲーム
              </h1>
              <p className="text-gray-600">
                ゲームを開始する準備ができました
              </p>
            </div>

            {/* プレイヤー一覧 */}
            <div className="space-y-4 mb-8">
              <h2 className="text-xl font-semibold text-gray-800">プレイヤー</h2>
              <div className="grid grid-cols-2 gap-4">
                {gameState.players.map((player) => (
                  <div key={player.position} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-semibold">
                        {getPlayerWind(player.position as 0 | 1 | 2 | 3, gameState.currentOya as 0 | 1 | 2 | 3)}
                      </div>
                      <div>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-sm text-gray-500">
                          {player.points.toLocaleString()}点
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => router.push('/')}
                className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                ホームに戻る
              </button>
              <button
                onClick={startGame}
                disabled={isStarting}
                className="flex-1 bg-orange-600 text-white py-3 px-4 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isStarting ? 'ゲーム開始中...' : 'ゲーム開始'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // メインゲーム画面
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ゲーム情報 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">一人プレイゲーム</h1>
              <p className="text-gray-600">
                {gameState.currentRound}局 {gameState.honba}本場
                {gameState.kyotaku > 0 && ` 供託${gameState.kyotaku}`}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-orange-600">
                {getPlayerWind(gameState.currentOya as 0 | 1 | 2 | 3, gameState.currentOya as 0 | 1 | 2 | 3)}親
              </div>
              <div className="text-sm text-gray-500">
                {gameState.players[gameState.currentOya]?.name}
              </div>
            </div>
          </div>
        </div>

        {/* プレイヤー点数表示 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {gameState.players.map((player) => (
            <PlayerCard 
              key={player.position} 
              player={player} 
              isOya={player.position === gameState.currentOya}
              gameState={gameState}
              onStateUpdate={setGameState}
            />
          ))}
        </div>

        {/* ゲームアクション */}
        <GameActions 
          gameState={gameState} 
          onStateUpdate={setGameState}
          onError={setError}
        />
      </div>
    </div>
  )
}

// プレイヤーカードコンポーネント
interface PlayerCardProps {
  player: SoloPlayerState
  isOya: boolean
  gameState: SoloGameState
  onStateUpdate: (state: SoloGameState) => void
}

function PlayerCard({ player, isOya, gameState, onStateUpdate }: PlayerCardProps) {
  const [isReaching, setIsReaching] = useState(false)

  const handleReach = async () => {
    try {
      setIsReaching(true)
      const response = await fetch(`/api/solo/${gameState.gameId}/reach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          position: player.position,
          round: gameState.currentRound
        }),
        credentials: 'include'
      })

      const result = await response.json()

      if (response.ok && result.success) {
        onStateUpdate(result.data.gameState)
      }
    } catch (error) {
      console.error('Reach error:', error)
    } finally {
      setIsReaching(false)
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${isOya ? 'ring-2 ring-orange-400' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
            isOya ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {getPlayerWind(player.position as 0 | 1 | 2 | 3, gameState.currentOya as 0 | 1 | 2 | 3)}
          </div>
          {player.isReach && (
            <div className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
              リーチ
            </div>
          )}
        </div>
        {isOya && (
          <div className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
            親
          </div>
        )}
      </div>
      
      <div className="mb-3">
        <div className="font-medium text-gray-800">{player.name}</div>
        <div className={`text-xl font-bold ${
          player.points >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {player.points.toLocaleString()}
        </div>
      </div>

      {!player.isReach && player.points >= 1000 && (
        <button
          onClick={handleReach}
          disabled={isReaching}
          className="w-full bg-red-500 text-white py-1 px-2 rounded text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {isReaching ? 'リーチ中...' : 'リーチ'}
        </button>
      )}
    </div>
  )
}

// ゲームアクションコンポーネント
interface GameActionsProps {
  gameState: SoloGameState
  onStateUpdate: (state: SoloGameState) => void
  onError: (error: string) => void
}

function GameActions({ gameState, onStateUpdate, onError }: GameActionsProps) {
  const [showScoreForm, setShowScoreForm] = useState(false)
  const [showRyukyokuForm, setShowRyukyokuForm] = useState(false)

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">ゲームアクション</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setShowScoreForm(true)}
          className="bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors"
        >
          和了
        </button>
        
        <button
          onClick={() => setShowRyukyokuForm(true)}
          className="bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          流局
        </button>
        
        <button
          onClick={() => {/* TODO: 強制終了処理 */}}
          className="bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition-colors"
        >
          強制終了
        </button>
        
        <button
          onClick={() => {/* TODO: ゲーム終了処理 */}}
          className="bg-purple-600 text-white py-3 px-4 rounded-md hover:bg-purple-700 transition-colors"
        >
          ゲーム終了
        </button>
      </div>

      {/* TODO: スコア入力フォーム */}
      {showScoreForm && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">和了点数入力</h3>
            <button
              onClick={() => setShowScoreForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          <p className="text-gray-600">和了点数入力フォームは次のバージョンで実装予定です</p>
        </div>
      )}

      {/* TODO: 流局フォーム */}
      {showRyukyokuForm && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">流局処理</h3>
            <button
              onClick={() => setShowRyukyokuForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          <p className="text-gray-600">流局処理フォームは次のバージョンで実装予定です</p>
        </div>
      )}
    </div>
  )
}