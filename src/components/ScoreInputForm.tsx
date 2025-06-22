'use client'

import { useState, useEffect } from 'react'

interface GamePlayer {
  playerId: string
  name: string
  position: number
  points: number
  isReach: boolean
  isConnected: boolean
}

interface GameState {
  gameId: string
  players: GamePlayer[]
  currentRound: number
  currentOya: number
  honba: number
  kyotaku: number
  gamePhase: 'waiting' | 'playing' | 'finished'
}

interface ScoreInputFormProps {
  gameState: GameState
  currentPlayer?: GamePlayer
  actionType: 'tsumo' | 'ron'
  preselectedWinnerId?: string
  preselectedLoserId?: string
  onSubmit: (scoreData: {
    winnerId: string
    han: number
    fu: number
    isTsumo: boolean
    loserId?: string
  }) => void
  onCancel: () => void
}

export default function ScoreInputForm({
  gameState,
  currentPlayer,
  actionType,
  preselectedWinnerId,
  preselectedLoserId,
  onSubmit,
  onCancel
}: ScoreInputFormProps) {
  const [winnerId, setWinnerId] = useState(
    preselectedWinnerId || currentPlayer?.playerId || ''
  )
  const [loserId, setLoserId] = useState(preselectedLoserId || '')
  const [han, setHan] = useState(1)
  const [fu, setFu] = useState(30)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Update state if preselected player changes
  useEffect(() => {
    if (preselectedWinnerId) setWinnerId(preselectedWinnerId)
  }, [preselectedWinnerId])

  useEffect(() => {
    if (preselectedLoserId) setLoserId(preselectedLoserId)
  }, [preselectedLoserId])

  const hanOptions = [
    { value: 1, label: '1翻' },
    { value: 2, label: '2翻' },
    { value: 3, label: '3翻' },
    { value: 4, label: '4翻' },
    { value: 5, label: '満貫' },
    { value: 6, label: '跳満' },
    { value: 8, label: '倍満' },
    { value: 11, label: '三倍満' },
    { value: 13, label: '役満' }
  ]

  const fuOptions = [
    { value: 20, label: '20符' },
    { value: 25, label: '25符' },
    { value: 30, label: '30符' },
    { value: 40, label: '40符' },
    { value: 50, label: '50符' },
    { value: 60, label: '60符' },
    { value: 70, label: '70符' },
    { value: 80, label: '80符' },
    { value: 90, label: '90符' },
    { value: 100, label: '100符' },
    { value: 110, label: '110符' }
  ]

  const getPositionName = (position: number) => {
    const positions = ['東', '南', '西', '北']
    return positions[position] || '?'
  }

  const getPlayerDisplay = (player: GamePlayer) => {
    const position = getPositionName(player.position)
    const isDealerMark = player.position === gameState.currentOya ? ' (親)' : ''
    return `${position} ${player.name}${isDealerMark}`
  }

  // バリデーション関数
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // 和了者チェック
    if (!winnerId) {
      errors.winnerId = '和了者を選択してください'
    }

    // 放銃者チェック（ロンの場合）
    if (actionType === 'ron') {
      if (!loserId) {
        errors.loserId = '放銃者を選択してください'
      } else if (winnerId === loserId) {
        errors.loserId = '和了者と放銃者は異なるプレイヤーを選択してください'
      }
    }

    // 翻数チェック
    if (han < 1 || han > 13) {
      errors.han = '翻数は1〜13の範囲で選択してください'
    }

    // 符数チェック（満貫未満の場合）
    if (han < 5) {
      if (fu < 20 || fu > 110) {
        errors.fu = '符数は20〜110の範囲で選択してください'
      }
      
      // 符数の妥当性チェック（5の倍数または20,25,30など）
      const validFu = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110]
      if (!validFu.includes(fu)) {
        errors.fu = '無効な符数です'
      }
    }

    // 点数計算の妥当性チェック
    const winner = gameState.players.find(p => p.playerId === winnerId)
    if (winner && winner.points <= 0) {
      errors.winnerId = 'トビ状態のプレイヤーは和了できません'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // バリデーション実行
    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)
      setValidationErrors({})
      
      await onSubmit({
        winnerId,
        han,
        fu,
        isTsumo: actionType === 'tsumo',
        loserId: actionType === 'ron' ? loserId : undefined
      })
    } catch (error) {
      console.error('Score submission failed:', error)
      setValidationErrors({
        submit: error instanceof Error ? error.message : '点数計算に失敗しました'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // リアルタイムバリデーション
  const handleWinnerChange = (value: string) => {
    setWinnerId(value)
    if (validationErrors.winnerId) {
      const newErrors = { ...validationErrors }
      delete newErrors.winnerId
      setValidationErrors(newErrors)
    }
  }

  const handleLoserChange = (value: string) => {
    setLoserId(value)
    if (validationErrors.loserId) {
      const newErrors = { ...validationErrors }
      delete newErrors.loserId
      setValidationErrors(newErrors)
    }
  }

  const isManganOrAbove = han >= 5

  return (
    <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
          点数入力 - {actionType === 'tsumo' ? 'ツモ' : 'ロン'}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl p-2 sm:p-0"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* 和了者選択 (プリセットがない場合のみ) */}
        {!preselectedWinnerId ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              和了者
            </label>
            <select
              value={winnerId}
              onChange={(e) => handleWinnerChange(e.target.value)}
              className={`w-full px-3 py-3 sm:py-2 border rounded-md focus:outline-none focus:ring-2 text-base transition-colors ${
                validationErrors.winnerId
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
              }`}
              required
            >
              <option value="">選択してください</option>
              {gameState.players.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {getPlayerDisplay(player)}
                </option>
              ))}
            </select>
            {validationErrors.winnerId && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.winnerId}</p>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-700">
            和了者: {gameState.players.find(p => p.playerId === preselectedWinnerId)?.name}
          </div>
        )}

        {/* 放銃者選択（ロンの場合のみ） */}
        {actionType === 'ron' && (!preselectedLoserId ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              放銃者
            </label>
            <select
              value={loserId}
              onChange={(e) => handleLoserChange(e.target.value)}
              className={`w-full px-3 py-3 sm:py-2 border rounded-md focus:outline-none focus:ring-2 text-base transition-colors ${
                validationErrors.loserId
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
              }`}
              required
            >
              <option value="">選択してください</option>
              {gameState.players
                .filter(player => player.playerId !== winnerId)
                .map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {getPlayerDisplay(player)}
                  </option>
                ))}
            </select>
            {validationErrors.loserId && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.loserId}</p>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-700">
            放銃者: {gameState.players.find(p => p.playerId === preselectedLoserId)?.name}
          </div>
        ))}

        {/* 翻数選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            翻数
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {hanOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setHan(option.value)}
                className={`p-3 sm:p-3 rounded-md border-2 transition-colors ${
                  han === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-sm sm:text-base">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 符数選択（満貫未満の場合のみ） */}
        {!isManganOrAbove && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              符数
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {fuOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFu(option.value)}
                  className={`p-2 sm:p-2 rounded-md border-2 transition-colors ${
                    fu === option.value
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-xs sm:text-sm">{option.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 現在の選択内容表示 */}
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">選択内容</h3>
          <div className="space-y-1 text-xs sm:text-sm text-gray-600">
            <div>和了: {actionType === 'tsumo' ? 'ツモ' : 'ロン'}</div>
            <div>
              翻数: {hanOptions.find(opt => opt.value === han)?.label}
              {!isManganOrAbove && ` ${fu}符`}
            </div>
            {winnerId && (
              <div>
                和了者: {gameState.players.find(p => p.playerId === winnerId)?.name}
              </div>
            )}
            {actionType === 'ron' && loserId && (
              <div>
                放銃者: {gameState.players.find(p => p.playerId === loserId)?.name}
              </div>
            )}
            <div>本場: {gameState.honba}本場</div>
            <div>供託: {gameState.kyotaku}本</div>
          </div>
        </div>

        {/* エラー表示 */}
        {validationErrors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-red-800">
                {validationErrors.submit}
              </div>
            </div>
          </div>
        )}

        {/* 送信ボタン */}
        <div className="flex gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-500 text-white py-4 px-3 sm:py-3 sm:px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors text-base font-medium"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !winnerId || (actionType === 'ron' && !loserId)}
            className="flex-1 bg-blue-600 text-white py-4 px-3 sm:py-3 sm:px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base font-medium"
          >
            {isSubmitting ? '計算中...' : '点数計算'}
          </button>
        </div>
      </form>
    </div>
  )
}