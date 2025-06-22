'use client'

import { useState, useEffect } from 'react'
import { ScoreCalculationResult, validateHanFu } from '@/lib/score'

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
  const [step, setStep] = useState(0)
  const [scorePreview, setScorePreview] = useState<ScoreCalculationResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Update state if preselected player changes
  useEffect(() => {
    if (preselectedWinnerId) setWinnerId(preselectedWinnerId)
  }, [preselectedWinnerId])

  useEffect(() => {
    if (preselectedLoserId) setLoserId(preselectedLoserId)
  }, [preselectedLoserId])

  useEffect(() => {
    const fetchPreview = async () => {
      if (step !== 2) return
      try {
        const winner = gameState.players.find(p => p.playerId === winnerId)
        if (!winner) return
        const response = await fetch('/api/score/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            han,
            fu,
            isOya: winner.position === gameState.currentOya,
            isTsumo: actionType === 'tsumo',
            honba: gameState.honba,
            kyotaku: gameState.kyotaku
          })
        })
        if (response.ok) {
          const data = await response.json()
          setScorePreview(data.data.result)
        }
      } catch (e) {
        console.error('Preview fetch failed', e)
        setScorePreview(null)
      }
    }
    fetchPreview()
  }, [step, han, fu, winnerId, actionType, gameState])

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

  const handleHanSelect = (value: number) => {
    setHan(value)
    if (value >= 5) {
      setStep(2)
    } else {
      setStep(1)
    }
  }

  const handleFuSelect = (value: number) => {
    setFu(value)
    setStep(2)
  }

  const handleBack = () => {
    setStep(Math.max(0, step - 1))
  }

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

      <div className="flex justify-between mb-4">
        {['翻数', '符数', '確認'].map((label, idx) => (
          <div key={label} className="flex-1 text-center">
            <div
              className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-sm ${
                step >= idx ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}
            >
              {idx + 1}
            </div>
            <div className="mt-1 text-xs">{label}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {step === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {hanOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleHanSelect(option.value)}
                className={`p-3 rounded-md border-2 transition-colors ${
                  han === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {fuOptions
                .filter(opt => validateHanFu(han, opt.value))
                .map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleFuSelect(option.value)}
                    className={`p-2 rounded-md border-2 transition-colors ${
                      fu === option.value
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="mt-4 bg-gray-500 text-white py-2 px-4 rounded-md"
              >
                戻る
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm text-gray-700">
              <div>和了: {actionType === 'tsumo' ? 'ツモ' : 'ロン'}</div>
              <div>
                翻数: {hanOptions.find(opt => opt.value === han)?.label}
                {!isManganOrAbove && ` ${fu}符`}
              </div>
              {winnerId && (
                <div>和了者: {gameState.players.find(p => p.playerId === winnerId)?.name}</div>
              )}
              {actionType === 'ron' && loserId && (
                <div>放銃者: {gameState.players.find(p => p.playerId === loserId)?.name}</div>
              )}
              <div>本場: {gameState.honba}本場</div>
              <div>供託: {gameState.kyotaku}本</div>
              {scorePreview && (
                <div>
                  支払い: {actionType === 'tsumo'
                    ? scorePreview.payments.fromOya
                      ? `親 ${scorePreview.payments.fromOya}点 / 子 ${scorePreview.payments.fromKo}点`
                      : `子 ${scorePreview.payments.fromKo}点`
                    : `${scorePreview.payments.fromLoser}点`}
                </div>
              )}
            </div>

            {validationErrors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-sm text-red-800">{validationErrors.submit}</div>
              </div>
            )}

            <div className="flex gap-3 sm:gap-4">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 bg-gray-500 text-white py-2 rounded-md"
              >
                戻る
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !winnerId || (actionType === 'ron' && !loserId)}
                className="flex-1 bg-blue-600 text-white py-2 rounded-md disabled:opacity-50"
              >
                {isSubmitting ? '計算中...' : '支払い'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}