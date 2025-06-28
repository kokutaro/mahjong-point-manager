'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { getPositionName } from '@/lib/utils'
import { Modal, Stepper, Button as MantineButton } from '@mantine/core'
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
  onSubmit: (scoreData: {
    winnerId: string
    han: number
    fu: number
    isTsumo: boolean
    loserId?: string
  }) => void
  onCancel: () => void
}

const ScoreInputForm = memo(function ScoreInputForm({
  gameState,
  currentPlayer,
  actionType,
  preselectedWinnerId,
  onSubmit,
  onCancel
}: ScoreInputFormProps) {
  const [winnerId, setWinnerId] = useState(
    preselectedWinnerId || currentPlayer?.playerId || ''
  )
  const [loserId, setLoserId] = useState('')
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


  // Memoized score preview fetch with debouncing
  const fetchPreview = useCallback(async () => {
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
  }, [step, han, fu, winnerId, actionType, gameState.players, gameState.currentOya, gameState.honba, gameState.kyotaku])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  // Memoized options arrays to prevent recreation on every render
  const hanOptions = useMemo(() => [
    { value: 1, label: '1翻' },
    { value: 2, label: '2翻' },
    { value: 3, label: '3翻' },
    { value: 4, label: '4翻' },
    { value: 5, label: '満貫' },
    { value: 6, label: '跳満' },
    { value: 8, label: '倍満' },
    { value: 11, label: '三倍満' },
    { value: 13, label: '役満' }
  ], [])

  const fuOptions = useMemo(() => [
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
  ], [])

  // Memoized player display function
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getPlayerDisplay = useCallback((player: GamePlayer) => {
    const position = getPositionName(player.position, gameState.currentOya)
    const isDealerMark = player.position === gameState.currentOya ? ' (親)' : ''
    return `${position} ${player.name}${isDealerMark}`
  }, [gameState.currentOya])

  // Memoized validation function
  const validateForm = useCallback((): boolean => {
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
  }, [winnerId, loserId, han, fu, actionType, gameState.players])

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    setStep(nextStepAfterLoser)
  }

  const isManganOrAbove = han >= 5

  const confirmStep = actionType === 'ron' ? 3 : 2
  const fuStep = actionType === 'ron' ? 2 : 1
  const nextStepAfterLoser = 1

  const handleHanSelect = (value: number) => {
    setHan(value)
    if (value >= 5) {
      setStep(confirmStep)
    } else {
      setStep(fuStep)
    }
  }

  const handleFuSelect = (value: number) => {
    setFu(value)
    setStep(confirmStep)
  }

  const handleBack = () => {
    if (step === confirmStep) {
      if (isManganOrAbove) {
        setStep(actionType === 'ron' ? 1 : 0)
      } else {
        setStep(fuStep)
      }
    } else {
      setStep(Math.max(0, step - 1))
    }
  }

  return (
    <Modal opened onClose={onCancel} withCloseButton={false} centered>
      <h2 className="text-lg font-semibold mb-4">
        点数入力 - {actionType === 'tsumo' ? 'ツモ' : 'ロン'}
      </h2>
      <form onSubmit={handleSubmit}>
        <Stepper active={step} allowNextStepsSelect={false} orientation="vertical">
          {actionType === 'ron' && (
            <Stepper.Step label="放銃者">
              <div className="grid grid-cols-2 gap-2 mt-4">
                {gameState.players
                  .filter(p => p.playerId !== winnerId)
                  .map(player => (
                    <MantineButton
                      key={player.playerId}
                      fullWidth
                      color={loserId === player.playerId ? 'red' : 'gray'}
                      onClick={() => handleLoserChange(player.playerId)}
                    >
                      {player.name}
                    </MantineButton>
                  ))}
              </div>
            </Stepper.Step>
          )}
          <Stepper.Step label="翻数">
            <div className="grid grid-cols-3 gap-2 mt-4">
              {hanOptions.map(option => (
                <MantineButton
                  key={option.value}
                  fullWidth
                  color="blue"
                  variant={han === option.value ? 'filled' : 'light'}
                  onClick={() => handleHanSelect(option.value)}
                >
                  {option.label}
                </MantineButton>
              ))}
            </div>
          </Stepper.Step>
          <Stepper.Step label="符数">
            {han < 5 && (
              <>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {fuOptions
                    .filter(opt => validateHanFu(han, opt.value))
                    .map(option => (
                      <MantineButton
                        key={option.value}
                        fullWidth
                        color="green"
                        variant={fu === option.value ? 'filled' : 'light'}
                        onClick={() => handleFuSelect(option.value)}
                      >
                        {option.label}
                      </MantineButton>
                    ))}
                </div>
                <MantineButton className="mt-4" onClick={handleBack} variant="default">
                  戻る
                </MantineButton>
              </>
            )}
          </Stepper.Step>
          <Stepper.Step label="確認">
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm text-gray-700 mt-4">
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
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-4">
                <div className="text-sm text-red-800">{validationErrors.submit}</div>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <MantineButton variant="default" onClick={handleBack} fullWidth>
                戻る
              </MantineButton>
              <MantineButton
                type="submit"
                loading={isSubmitting}
                disabled={!winnerId || (actionType === 'ron' && !loserId)}
                fullWidth
              >
                支払い
              </MantineButton>
            </div>
          </Stepper.Step>
        </Stepper>
      </form>
    </Modal>
  )
})

export default ScoreInputForm