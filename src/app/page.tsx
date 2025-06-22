'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, TextInput, Paper, Title, Text } from '@mantine/core'

function HomePageContent() {
  const { user, isAuthenticated, login, isLoading } = useAuth()
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')

  useEffect(() => {
    if (isAuthenticated && redirectTo) {
      router.replace(redirectTo as any)
    }
  }, [isAuthenticated, redirectTo, router])

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
        router.replace(redirectTo as any)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ログインに失敗しました')
    }
  }

  const handleCreateRoom = () => {
    router.push('/room/create' as any)
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
        router.push(`/room/${roomCode.trim().toUpperCase()}` as any)
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

          <div className="grid md:grid-cols-2 gap-6">
            {/* ルーム作成 */}
            <div className="bg-green-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-800 mb-4">
                新しいルームを作成
              </h2>
              <p className="text-green-600 mb-4">
                新しい対局ルームを作成してホストになります
              </p>
              <button
                onClick={handleCreateRoom}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                ルーム作成
              </button>
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
          <div className="mt-6 grid md:grid-cols-2 gap-6">
            {/* 対局履歴 */}
            <div className="bg-purple-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-purple-800 mb-4">
                対局履歴
              </h2>
              <p className="text-purple-600 mb-4">
                過去の対局結果を確認できます
              </p>
              <button
                onClick={() => router.push('/history')}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
              >
                履歴を見る
              </button>
            </div>

            {/* 統計 */}
            <div className="bg-orange-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-orange-800 mb-4">
                統計ダッシュボード
              </h2>
              <p className="text-orange-600 mb-4">
                あなたの成績と統計を確認できます
              </p>
              <button
                onClick={() => router.push('/stats')}
                className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
              >
                統計を見る
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