'use client'

import WebSocketDebug, { useWebSocketDebug } from '@/components/WebSocketDebug'
import { useAuth } from '@/contexts/AuthContext'
import { useSessionStore, useUIStore, type GameSession } from '@/store/useAppStore'
import { Button, Paper, Text, TextInput, Title } from '@mantine/core'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

function HomePageContent() {
  const { user, isAuthenticated, login, isLoading } = useAuth()
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [activeSessions, setActiveSessions] = useState<GameSession[]>([])
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const { showDebug } = useWebSocketDebug()
  
  // Zustand ストア
  const { setSessionMode } = useSessionStore()
  const { setError: setGlobalError } = useUIStore()

  // アクティブセッション取得
  useEffect(() => {
    if (isAuthenticated) {
      fetchActiveSessions()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && redirectTo) {
      router.replace(redirectTo)
    }
  }, [isAuthenticated, redirectTo, router])

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch('/api/sessions?status=ACTIVE', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        setActiveSessions(data.data.sessions || [])
      }
    } catch (error) {
      console.error('Failed to fetch active sessions:', error)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playerName.trim()) {
      setError('プレイヤー名を入力してください')
      return
    }

    try {
      await login(playerName.trim())
      setError('')
      if (redirectTo) {
        router.replace(redirectTo)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ログインに失敗しました')
    }
  }

  const handleCreateRoom = () => {
    // セッションモードを保存してルーム作成画面へ
    setSessionMode(true)
    router.push('/room/create')
  }

  const handleResumeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/active-game`, {
        credentials: 'include'
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'セッション再開に失敗しました')
      }
      const { gameId, roomCode, status } = data.data
      if (status === 'WAITING') {
        router.push(`/room/${roomCode}`)
      } else {
        router.push(`/game/${gameId}`)
      }
    } catch (err) {
      setGlobalError(
        err instanceof Error ? err.message : 'セッション再開に失敗しました'
      )
    }
  }


  const handleCreateSoloGame = () => {
    // 一人プレイモードの画面へ
    router.push('/solo/create')
  }

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomCode.trim()) {
      setError('ルームコードを入力してください')
      return
    }

    try {
      setIsJoining(true)
      setError('')
      
      const response = await fetch('/api/room/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomCode: roomCode.trim().toUpperCase(),
          playerName: user?.name
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'ルーム参加に失敗しました')
      }

      if (data.success) {
        router.push(`/room/${roomCode.trim().toUpperCase()}`)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ルーム参加に失敗しました')
    } finally {
      setIsJoining(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Paper shadow="md" p="lg" w="100%" maw={400}>
          <Title order={1} ta="center" mb="lg">
            麻雀点数管理
          </Title>
          <form onSubmit={handleLogin}>
            <TextInput
              label="プレイヤー名"
              value={playerName}
              onChange={(e) => setPlayerName(e.currentTarget.value)}
              placeholder="お名前を入力"
              maxLength={20}
              required
            />
            {error && (
              <Text c="red" size="sm" ta="center" mt="sm">
                {error}
              </Text>
            )}
            <Button type="submit" fullWidth mt="md" loading={isLoading}>
              {isLoading ? '読み込み中...' : 'ゲームに参加'}
            </Button>
          </form>
        </Paper>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              麻雀点数管理
            </h1>
            <p className="text-gray-600">
              ようこそ、{user?.name}さん
            </p>
          </div>

          {/* アクティブセッション表示 */}
          {activeSessions.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                継続可能なセッション
              </h2>
              <div className="grid gap-4">
                {activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <h3 className="font-medium text-yellow-800">
                        {session.name || `セッション #${session.sessionCode}`}
                      </h3>
                      <p className="text-sm text-yellow-600">
                        {session.totalGames}局完了 · ホスト: {session.hostPlayerId}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResumeSession(session.id)}
                        className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                      >
                        再入室
                      </button>
                      <button
                        onClick={() => router.push(`/sessions/${session.id}`)}
                        className="bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 transition-colors"
                      >
                        セッション詳細
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6">
            {/* 対局タイプ選択 */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* 連続対局セッション */}
              <div className="bg-green-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-green-800 mb-4">
                  連続対局セッション
                </h2>
                <p className="text-green-600 mb-4">
                  複数局を連続で楽しめるセッションを作成します
                </p>
                <button
                  onClick={handleCreateRoom}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                >
                  セッション作成
                </button>
              </div>

              {/* 一人プレイモード */}
              <div className="bg-orange-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-orange-800 mb-4">
                  一人プレイモード
                </h2>
                <p className="text-orange-600 mb-4">
                  一人で4人分の点数を管理できるモードです
                </p>
                <button
                  onClick={handleCreateSoloGame}
                  className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
                >
                  一人プレイ開始
                </button>
              </div>
            </div>

            {/* ルーム参加 */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-blue-800 mb-4">
                ルームに参加
              </h2>
              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div>
                  <label htmlFor="roomCode" className="block text-sm font-medium text-blue-700 mb-2">
                    ルームコード
                  </label>
                  <input
                    type="text"
                    id="roomCode"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="6文字のコード"
                    maxLength={6}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                {error && (
                  <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isJoining}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isJoining ? '参加中...' : 'ルーム参加'}
                </button>
              </form>
            </div>
          </div>

          {/* 履歴・統計 */}
          <div className="mt-6 grid md:grid-cols-1 gap-6">
            {/* セッション履歴 */}
            <div className="bg-purple-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-purple-800 mb-4">
                セッション履歴
              </h2>
              <p className="text-purple-600 mb-4">
                連続対局セッションの履歴と統計を確認
              </p>
              <button
                onClick={() => router.push('/sessions')}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
              >
                セッション履歴
              </button>
            </div>

          </div>

          {/* ログアウト */}
          <div className="mt-8 text-center">
            <button
              onClick={() => window.location.href = '/api/auth/logout'}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
      
      {/* WebSocketデバッグ (Ctrl+Shift+W で表示) */}
      <WebSocketDebug show={showDebug} />
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
      <div className="text-xl text-gray-600">読み込み中...</div>
    </div>}>
      <HomePageContent />
    </Suspense>
  )
}