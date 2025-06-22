'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import ErrorDisplay from '@/components/ErrorDisplay'

interface PlayerStats {
  playerId: string
  playerName: string
  totalGames: number
  winRate: number
  averageRank: number
  averagePoints: number
  totalSettlement: number
  rankDistribution: { 1: number; 2: number; 3: number; 4: number }
  gameTypeStats: Record<string, {
    totalGames: number
    winRate: number
    averageRank: number
    totalSettlement: number
    rankDistribution: { 1: number; 2: number; 3: number; 4: number }
  }>
  recentGames: Array<{
    gameId: string
    endedAt: string
    gameType: string
    rank: number
    points: number
    settlement: number
  }>
  monthlyStats: Record<string, {
    games: number
    wins: number
    totalSettlement: number
  }>
}

export default function StatsPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [gameTypeFilter, setGameTypeFilter] = useState<string>('')

  const fetchStats = async (gameType: string = '') => {
    if (!user) return

    try {
      setIsLoading(true)
      setError('')

      const params = new URLSearchParams()
      if (gameType) {
        params.append('gameType', gameType)
      }

      const response = await fetch(`/api/stats/${user.playerId}?${params}`, {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || '統計の取得に失敗しました')
      }

      if (data.success) {
        setStats(data.data)
      } else {
        throw new Error(data.error?.message || '統計の取得に失敗しました')
      }
    } catch (error) {
      console.error('Stats fetch error:', error)
      setError(error instanceof Error ? error.message : '統計の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchStats(gameTypeFilter)
    }
  }, [isAuthenticated, user, gameTypeFilter])

  const handleGameTypeChange = (type: string) => {
    setGameTypeFilter(type)
  }

  const exportToCsv = () => {
    if (!stats) return

    const csvData = [
      ['項目', '値'],
      ['プレイヤー名', stats.playerName],
      ['総対局数', stats.totalGames.toString()],
      ['勝率', `${stats.winRate.toFixed(2)}%`],
      ['平均順位', stats.averageRank.toFixed(2)],
      ['平均点数', stats.averagePoints.toString()],
      ['総精算', stats.totalSettlement.toString()],
      ['1位回数', stats.rankDistribution[1].toString()],
      ['2位回数', stats.rankDistribution[2].toString()],
      ['3位回数', stats.rankDistribution[3].toString()],
      ['4位回数', stats.rankDistribution[4].toString()]
    ]

    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `stats_${stats.playerName}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-600 bg-yellow-50'
      case 2: return 'text-gray-600 bg-gray-50'
      case 3: return 'text-orange-600 bg-orange-50'
      case 4: return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      case 4: return '4位'
      default: return rank.toString()
    }
  }

  const getMonthlyChartData = () => {
    if (!stats) return []
    
    const months = Object.keys(stats.monthlyStats).sort()
    return months.map(month => ({
      month,
      games: stats.monthlyStats[month].games,
      wins: stats.monthlyStats[month].wins,
      winRate: stats.monthlyStats[month].games > 0 
        ? (stats.monthlyStats[month].wins / stats.monthlyStats[month].games) * 100 
        : 0,
      settlement: stats.monthlyStats[month].totalSettlement
    }))
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">ログインが必要です</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">統計を読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">統計ダッシュボード</h1>
              <p className="text-gray-600 mt-1">
                {stats?.playerName && `${stats.playerName}さんの対局統計`}
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={exportToCsv}
                disabled={!stats || stats.totalGames === 0}
                className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                CSV出力
              </button>
              <button
                onClick={() => router.push('/')}
                className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors text-sm"
              >
                ホームに戻る
              </button>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <ErrorDisplay
            error={{ type: 'general', message: error, isRetryable: true }}
            onRetry={() => fetchStats(gameTypeFilter)}
            onDismiss={() => setError('')}
          />
        )}

        {stats && (
          <>
            {/* フィルター */}
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <label className="text-sm font-medium text-gray-700">
                  ゲームタイプ:
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGameTypeChange('')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      gameTypeFilter === ''
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    すべて
                  </button>
                  <button
                    onClick={() => handleGameTypeChange('TONPUU')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      gameTypeFilter === 'TONPUU'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    東風戦
                  </button>
                  <button
                    onClick={() => handleGameTypeChange('HANCHAN')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      gameTypeFilter === 'HANCHAN'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    半荘戦
                  </button>
                </div>
              </div>
            </div>

            {/* 基本統計 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
                <div className="text-gray-600 text-sm mb-2">総対局数</div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {stats.totalGames}局
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
                <div className="text-gray-600 text-sm mb-2">勝率</div>
                <div className="text-2xl sm:text-3xl font-bold text-yellow-600">
                  {stats.winRate.toFixed(1)}%
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
                <div className="text-gray-600 text-sm mb-2">平均順位</div>
                <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                  {stats.averageRank.toFixed(2)}位
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
                <div className="text-gray-600 text-sm mb-2">総精算</div>
                <div className={`text-2xl sm:text-3xl font-bold ${
                  stats.totalSettlement >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stats.totalSettlement >= 0 ? '+' : ''}{stats.totalSettlement}
                </div>
              </div>
            </div>

            {/* 順位分布 */}
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">順位分布</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(stats.rankDistribution).map(([rank, count]) => {
                  const percentage = stats.totalGames > 0 ? (count / stats.totalGames) * 100 : 0
                  return (
                    <div key={rank} className="text-center">
                      <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center text-lg font-semibold mb-2 ${getRankColor(Number(rank))}`}>
                        {getRankEmoji(Number(rank))}
                      </div>
                      <div className="text-sm text-gray-600">{rank}位</div>
                      <div className="text-lg font-bold text-gray-800">{count}回</div>
                      <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ゲームタイプ別統計 */}
            {Object.keys(stats.gameTypeStats).length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">ゲームタイプ別統計</h2>
                <div className="space-y-4">
                  {Object.entries(stats.gameTypeStats).map(([type, typeStats]) => (
                    <div key={type} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-3">
                        {type === 'TONPUU' ? '東風戦' : '半荘戦'}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">対局数</div>
                          <div className="font-semibold">{typeStats.totalGames}局</div>
                        </div>
                        <div>
                          <div className="text-gray-600">勝率</div>
                          <div className="font-semibold text-yellow-600">{typeStats.winRate.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-gray-600">平均順位</div>
                          <div className="font-semibold text-blue-600">{typeStats.averageRank.toFixed(2)}位</div>
                        </div>
                        <div>
                          <div className="text-gray-600">精算</div>
                          <div className={`font-semibold ${
                            typeStats.totalSettlement >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {typeStats.totalSettlement >= 0 ? '+' : ''}{typeStats.totalSettlement}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 最近の対局 */}
            {stats.recentGames.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">最近の対局</h2>
                <div className="space-y-3">
                  {stats.recentGames.map((game, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${getRankColor(game.rank)}`}>
                          {getRankEmoji(game.rank)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">
                            {game.gameType === 'TONPUU' ? '東風戦' : '半荘戦'}
                          </div>
                          <div className="text-sm text-gray-600">
                            {new Date(game.endedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${
                          game.settlement >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {game.settlement >= 0 ? '+' : ''}{game.settlement}
                        </div>
                        <div className="text-sm text-gray-600">
                          {game.points.toLocaleString()}点
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 月別統計 */}
            {Object.keys(stats.monthlyStats).length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">月別統計（過去12ヶ月）</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">月</th>
                        <th className="text-right py-2">対局数</th>
                        <th className="text-right py-2">勝数</th>
                        <th className="text-right py-2">勝率</th>
                        <th className="text-right py-2">精算</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getMonthlyChartData().map((data) => (
                        <tr key={data.month} className="border-b">
                          <td className="py-2">{data.month}</td>
                          <td className="text-right py-2">{data.games}</td>
                          <td className="text-right py-2">{data.wins}</td>
                          <td className="text-right py-2">{data.winRate.toFixed(1)}%</td>
                          <td className={`text-right py-2 font-medium ${
                            data.settlement >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {data.settlement >= 0 ? '+' : ''}{data.settlement}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* 空状態 */}
        {!isLoading && stats && stats.totalGames === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">統計データがありません</h3>
            <p className="text-gray-600 mb-4">まだ完了した対局がありません。</p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              対局を開始する
            </button>
          </div>
        )}
      </div>
    </div>
  )
}