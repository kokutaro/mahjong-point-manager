'use client'

import { useState, useEffect } from 'react'

interface PlayerResult {
  playerId: string
  name: string
  finalPoints: number
  rank: number
  uma: number
  oka: number
  settlement: number
}

interface GameResultData {
  gameId: string
  results: PlayerResult[]
  gameType: 'TONPUU' | 'HANCHAN'
  endReason: string
  endedAt: string
}

interface GameResultProps {
  gameId: string
  onBack: () => void
}

export default function GameResult({ gameId, onBack }: GameResultProps) {
  const [resultData, setResultData] = useState<GameResultData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchGameResult()
  }, [gameId])

  const fetchGameResult = async () => {
    try {
      setIsLoading(true)
      setError('')

      const response = await fetch(`/api/game/${gameId}/result`, {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()
      console.log('GameResult API Response:', { status: response.status, data })

      if (!response.ok) {
        throw new Error(data.error?.message || '結果の取得に失敗しました')
      }

      if (data.success) {
        console.log('Setting result data:', data.data)
        setResultData(data.data)
      } else {
        throw new Error(data.error?.message || '結果の取得に失敗しました')
      }
    } catch (error) {
      console.error('fetchGameResult error:', error)
      setError(error instanceof Error ? error.message : '結果の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
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

  const formatPoints = (points: number) => {
    return points >= 0 ? `+${points.toLocaleString()}` : points.toLocaleString()
  }

  const formatSettlement = (settlement: number) => {
    return settlement >= 0 ? `+${settlement.toLocaleString()}` : settlement.toLocaleString()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">結果を読み込み中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={onBack}
            className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  if (!resultData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-gray-600 mb-4">結果が見つかりません</div>
          <div className="text-xs text-gray-400 mb-4">Debug: resultData is {JSON.stringify(resultData)}</div>
          <button
            onClick={onBack}
            className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">対局結果</h1>
            <div className="text-gray-600">
              <div className="mb-1">
                {resultData.gameType === 'TONPUU' ? '東風戦' : '半荘戦'}
              </div>
              <div className="text-sm">
                終了理由: {resultData.endReason}
              </div>
              <div className="text-sm">
                終了時刻: {new Date(resultData.endedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* 順位表 */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-gray-50 px-6 py-3 border-b">
            <h2 className="text-xl font-semibold text-gray-800">最終順位</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    順位
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    プレイヤー
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最終点数
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ウマ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    オカ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    精算
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {resultData.results.map((result) => (
                  <tr key={result.playerId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRankColor(result.rank)}`}>
                        <span className="mr-2">{getRankEmoji(result.rank)}</span>
                        {result.rank}位
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {result.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-mono text-gray-900">
                        {result.finalPoints.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-sm font-mono ${result.uma >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPoints(result.uma)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-sm font-mono ${result.oka >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPoints(result.oka)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-lg font-bold font-mono ${result.settlement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatSettlement(result.settlement)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 点数詳細 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">精算詳細</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {resultData.results.map((result) => (
              <div key={result.playerId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium text-gray-900">{result.name}</div>
                  <div className={`px-2 py-1 rounded text-sm font-medium ${getRankColor(result.rank)}`}>
                    {result.rank}位
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">最終点数:</span>
                    <span className="font-mono">{result.finalPoints.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">基準点差分:</span>
                    <span className="font-mono">
                      {formatPoints(result.finalPoints - 30000)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">精算点数:</span>
                    <span className="font-mono">
                      {(() => {
                        if (result.rank === 1) {
                          // 1位の場合は、他のプレイヤーの精算点数の合計の符号反転
                          const othersTotal = resultData.results
                            .filter(r => r.rank !== 1)
                            .reduce((sum, r) => {
                              const diff = r.finalPoints - 30000
                              return sum + (diff >= 0 ? Math.floor(diff / 1000) : Math.ceil(diff / 1000))
                            }, 0)
                          return othersTotal > 0 ? `+${-othersTotal}` : `${-othersTotal}`
                        } else {
                          // 1位以外の場合は通常計算
                          const diff = result.finalPoints - 30000
                          if (diff >= 0) {
                            return `+${Math.floor(diff / 1000)}`
                          } else {
                            return `${Math.ceil(diff / 1000)}`
                          }
                        }
                      })()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">ウマ:</span>
                    <span className={`font-mono ${result.uma >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPoints(result.uma)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">オカ:</span>
                    <span className={`font-mono ${result.oka >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPoints(result.oka)}
                    </span>
                  </div>
                  
                  <hr className="my-2" />
                  
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>計算式:</span>
                    <span className="font-mono">
                      {(() => {
                        let roundedDiff: number
                        if (result.rank === 1) {
                          // 1位の場合は、他のプレイヤーの精算点数の合計の符号反転
                          const othersTotal = resultData.results
                            .filter(r => r.rank !== 1)
                            .reduce((sum, r) => {
                              const diff = r.finalPoints - 30000
                              return sum + (diff >= 0 ? Math.floor(diff / 1000) : Math.ceil(diff / 1000))
                            }, 0)
                          roundedDiff = -othersTotal
                        } else {
                          // 1位以外の場合は通常計算
                          const diff = result.finalPoints - 30000
                          roundedDiff = diff >= 0 ? Math.floor(diff / 1000) : Math.ceil(diff / 1000)
                        }
                        
                        const uma = result.uma
                        const oka = result.oka
                        return `${roundedDiff > 0 ? '+' : ''}${roundedDiff} + ${uma > 0 ? '+' : ''}${uma} + ${oka > 0 ? '+' : ''}${oka}`
                      })()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-800">精算:</span>
                    <span className={`font-mono text-lg ${result.settlement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatSettlement(result.settlement)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="text-center space-x-4">
          <button
            onClick={onBack}
            className="bg-gray-500 text-white py-3 px-6 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            ゲームに戻る
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    </div>
  )
}