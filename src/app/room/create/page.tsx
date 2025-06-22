'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function CreateRoomPage() {
  const { user, isAuthenticated, refreshAuth } = useAuth()
  const [gameType, setGameType] = useState<'TONPUU' | 'HANCHAN'>('HANCHAN')
  const [initialPoints, setInitialPoints] = useState(25000)
  const [basePoints, setBasePoints] = useState(30000)
  const [hasTobi, setHasTobi] = useState(true)
  const [uma, setUma] = useState([20, 10, -10, -20])
  const [umaPreset, setUmaPreset] = useState('ワンツー')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      setError('ログインが必要です')
      return
    }

    try {
      setIsCreating(true)
      setError('')

      const response = await fetch('/api/room/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hostPlayerName: user.name,
          gameType,
          initialPoints,
          basePoints,
          hasTobi,
          uma
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'ルーム作成に失敗しました')
      }

      if (data.success) {
        // Refresh auth so the new player_id cookie is reflected in context
        await refreshAuth()
        router.push(`/room/${data.data.roomCode}` as any)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ルーム作成に失敗しました')
    } finally {
      setIsCreating(false)
    }
  }

  const umaPresets = {
    'ゴットー': [10, 5, -5, -10],
    'ワンツー': [20, 10, -10, -20],
    'ワンスリー': [30, 10, -10, -30]
  }

  const handleUmaPresetChange = (preset: string) => {
    setUmaPreset(preset)
    if (preset !== 'カスタム') {
      setUma(umaPresets[preset as keyof typeof umaPresets])
    }
  }

  const handleUmaChange = (index: number, value: number) => {
    const newUma = [...uma]
    newUma[index] = value
    setUma(newUma)
    setUmaPreset('カスタム') // 手動変更時はカスタムに切り替え
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">ログインが必要です</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              ルーム作成
            </h1>
            <p className="text-gray-600">
              ホスト: {user?.name}
            </p>
          </div>

          <form onSubmit={handleCreateRoom} className="space-y-6">
            {/* ゲームタイプ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                ゲームタイプ
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setGameType('TONPUU')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    gameType === 'TONPUU'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">東風戦</div>
                  <div className="text-sm text-gray-500">東場のみ</div>
                </button>
                <button
                  type="button"
                  onClick={() => setGameType('HANCHAN')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    gameType === 'HANCHAN'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">半荘戦</div>
                  <div className="text-sm text-gray-500">東場・南場</div>
                </button>
              </div>
            </div>

            {/* 初期点数 */}
            <div>
              <label htmlFor="initialPoints" className="block text-sm font-medium text-gray-700 mb-2">
                初期点数
              </label>
              <select
                id="initialPoints"
                value={initialPoints}
                onChange={(e) => setInitialPoints(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value={25000}>25,000点</option>
                <option value={30000}>30,000点</option>
                <option value={35000}>35,000点</option>
              </select>
            </div>

            {/* 返し点 */}
            <div>
              <label htmlFor="basePoints" className="block text-sm font-medium text-gray-700 mb-2">
                返し点（基準点）
              </label>
              <select
                id="basePoints"
                value={basePoints}
                onChange={(e) => setBasePoints(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value={25000}>25,000点</option>
                <option value={30000}>30,000点</option>
                <option value={35000}>35,000点</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                精算計算の基準となる点数
              </p>
            </div>

            {/* ウマ設定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                ウマ設定
              </label>
              
              {/* プリセット選択 */}
              <div className="mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.keys(umaPresets).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleUmaPresetChange(preset)}
                      className={`p-3 rounded-lg border-2 text-sm transition-colors ${
                        umaPreset === preset
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold">{preset}</div>
                      <div className="text-xs text-gray-500">
                        {umaPresets[preset as keyof typeof umaPresets].join(',')}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleUmaPresetChange('カスタム')}
                    className={`p-3 rounded-lg border-2 text-sm transition-colors ${
                      umaPreset === 'カスタム'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">カスタム</div>
                    <div className="text-xs text-gray-500">手動設定</div>
                  </button>
                </div>
              </div>

              {/* 詳細設定 */}
              <div className="grid grid-cols-4 gap-2">
                {['1位', '2位', '3位', '4位'].map((rank, index) => (
                  <div key={rank}>
                    <label className="block text-xs text-gray-500 mb-1">{rank}</label>
                    <input
                      type="number"
                      value={uma[index]}
                      onChange={(e) => handleUmaChange(index, Number(e.target.value))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                ))}
              </div>
            </div>


            {/* 特殊ルール */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                特殊ルール
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={hasTobi}
                    onChange={(e) => setHasTobi(e.target.checked)}
                    className="mr-2 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">トビあり</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            {/* ボタン */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? '作成中...' : 'ルーム作成'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}