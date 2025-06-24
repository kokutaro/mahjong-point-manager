'use client'

import { useCallback } from 'react'

// 投票選択肢の型定義
export type VoteOption = 'continue' | 'end' | 'pause'

// 投票状態の型定義
export interface VoteState {
  [playerId: string]: VoteOption
}

// プレイヤー結果の型（GameResult.tsxから）
interface PlayerResult {
  playerId: string
  name: string
  finalPoints: number
  rank: number
  uma: number
  settlement: number
}

interface VotingProgressProps {
  votes: VoteState
  players: PlayerResult[]
  currentUser: { playerId: string; name: string } | null
  onCancelVote: () => void
  timeRemaining?: number // 残り時間（秒）
}

export default function VotingProgress({ 
  votes, 
  players, 
  currentUser, 
  onCancelVote,
  timeRemaining
}: VotingProgressProps) {
  const getVoteIcon = useCallback((vote: VoteOption | undefined) => {
    switch (vote) {
      case 'continue': return '🔄'
      case 'end': return '✋'
      case 'pause': return '⏸️'
      default: return '⏳'
    }
  }, [])

  const getVoteLabel = useCallback((vote: VoteOption | undefined) => {
    switch (vote) {
      case 'continue': return '継続'
      case 'end': return '終了'
      case 'pause': return '保留'
      default: return '投票中'
    }
  }, [])

  const getVoteColor = useCallback((vote: VoteOption | undefined) => {
    switch (vote) {
      case 'continue': return 'bg-green-100 text-green-800 border-green-200'
      case 'end': return 'bg-red-100 text-red-800 border-red-200'
      case 'pause': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }, [])

  // 投票集計
  const voteCount = Object.values(votes)
  const continueVotes = voteCount.filter(v => v === 'continue').length
  const endVotes = voteCount.filter(v => v === 'end').length
  const pauseVotes = voteCount.filter(v => v === 'pause').length
  const totalVotes = voteCount.length
  const totalPlayers = players.length

  // 残り時間のフォーマット
  const formatTimeRemaining = (seconds: number | undefined) => {
    if (seconds === undefined) return ''
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー情報 */}
      <div className="text-center">
        <div className="text-green-700 font-medium text-lg mb-2">
          全員の投票を待っています...
        </div>
        <div className="text-sm text-gray-600">
          投票状況: {totalVotes}/{totalPlayers}人
        </div>
        {timeRemaining !== undefined && timeRemaining > 0 && (
          <div className="text-sm text-orange-600 mt-1">
            ⏰ 残り時間: {formatTimeRemaining(timeRemaining)}
          </div>
        )}
      </div>
      
      {/* 投票状況の表示 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.map((player) => {
          const isMyself = currentUser?.playerId === player.playerId
          const vote = votes[player.playerId]
          
          return (
            <div key={player.playerId} className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-900">{player.name}</span>
                {isMyself && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full border border-blue-200">
                    あなた
                  </span>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full border text-sm font-medium transition-colors ${getVoteColor(vote)}`}>
                <span className="mr-1">{getVoteIcon(vote)}</span>
                {getVoteLabel(vote)}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* 投票集計サマリー */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="text-sm text-gray-700 font-medium mb-3">投票集計:</div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-2 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl">🔄</div>
            <div className="text-sm font-medium text-green-800">継続</div>
            <div className="text-lg font-bold text-green-600">{continueVotes}票</div>
          </div>
          <div className="p-2 bg-red-50 rounded-lg border border-red-200">
            <div className="text-2xl">✋</div>
            <div className="text-sm font-medium text-red-800">終了</div>
            <div className="text-lg font-bold text-red-600">{endVotes}票</div>
          </div>
          <div className="p-2 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-2xl">⏸️</div>
            <div className="text-sm font-medium text-yellow-800">保留</div>
            <div className="text-lg font-bold text-yellow-600">{pauseVotes}票</div>
          </div>
        </div>
      </div>
      
      {/* 判定結果の表示 */}
      {totalVotes === totalPlayers && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-sm font-medium text-blue-800 mb-2">
            投票結果:
          </div>
          <div className="text-sm text-blue-700">
            {endVotes === totalPlayers ? (
              <div className="flex items-center">
                <span className="text-green-600 font-medium">✅ 全員がセッション終了に合意しました</span>
              </div>
            ) : continueVotes > 0 ? (
              <div className="flex items-center">
                <span className="text-blue-600 font-medium">🔄 {continueVotes}名が継続を希望しています</span>
              </div>
            ) : (
              <div className="flex items-center">
                <span className="text-yellow-600 font-medium">⏸️ 全員が保留を選択しました</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* キャンセルボタン */}
      {currentUser && votes[currentUser.playerId] && (
        <div className="text-center">
          <button
            onClick={onCancelVote}
            className="bg-gray-500 text-white py-2 px-6 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            投票を取り消す
          </button>
        </div>
      )}
      
      {/* 説明文 */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <div className="font-medium mb-1">投票説明:</div>
        <div>• <strong>継続</strong>: セッションを続ける</div>
        <div>• <strong>終了</strong>: セッションを終了する</div>
        <div>• <strong>保留</strong>: 他の人の判断を待つ</div>
      </div>
    </div>
  )
}