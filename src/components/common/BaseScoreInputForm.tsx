"use client"

import { useState, useEffect, useCallback, useMemo, memo } from "react"
import { getPositionName } from "@/lib/utils"
import { Modal, Stepper, Button as MantineButton } from "@mantine/core"
import { ScoreCalculationResult, validateHanFu } from "@/lib/score"
import {
  BaseGameState,
  BasePlayerState,
  BaseScoreInputFormProps,
  ScoreSubmissionData,
  HanOption,
  FuOption,
} from "./types"

// 汎用化されたScoreInputForm
function BaseScoreInputForm<
  TGameState extends BaseGameState,
  TPlayer extends BasePlayerState,
>({
  gameState,
  currentPlayer,
  actionType,
  preselectedWinnerId,
  mode,
  onSubmit,
  onCancel,
  calculateScorePreview,
}: BaseScoreInputFormProps<TGameState, TPlayer>) {
  const [winnerId, setWinnerId] = useState(
    preselectedWinnerId || currentPlayer?.id || ""
  )
  const [loserId, setLoserId] = useState("")
  const [han, setHan] = useState(1)
  const [fu, setFu] = useState(30)
  const [step, setStep] = useState(0)
  const [scorePreview, setScorePreview] =
    useState<ScoreCalculationResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({})

  // Update state if preselected player changes
  useEffect(() => {
    if (preselectedWinnerId) setWinnerId(preselectedWinnerId)
  }, [preselectedWinnerId])

  // Default score preview calculation (for multi mode)
  const defaultCalculateScorePreview = useCallback(
    async (data: {
      han: number
      fu: number
      isOya: boolean
      isTsumo: boolean
      honba: number
      kyotaku: number
    }) => {
      const response = await fetch("/api/score/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (response.ok) {
        const result = await response.json()
        return result.data.result
      }
      return null
    },
    []
  )

  // Memoized score preview fetch with debouncing
  const fetchPreview = useCallback(async () => {
    if (step !== (actionType === "ron" ? 3 : 2)) return
    try {
      const winner = gameState.players.find((p) => p.id === winnerId)
      if (!winner) return

      const previewCalculator =
        calculateScorePreview || defaultCalculateScorePreview
      const result = await previewCalculator({
        han,
        fu,
        isOya: winner.position === gameState.currentOya,
        isTsumo: actionType === "tsumo",
        honba: gameState.honba,
        kyotaku: gameState.kyotaku,
      })

      setScorePreview(result)
    } catch (e) {
      console.error("Preview fetch failed", e)
      setScorePreview(null)
    }
  }, [
    step,
    han,
    fu,
    winnerId,
    actionType,
    gameState.players,
    gameState.currentOya,
    gameState.honba,
    gameState.kyotaku,
    calculateScorePreview,
    defaultCalculateScorePreview,
  ])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  // Memoized options arrays to prevent recreation on every render
  const hanOptions = useMemo(
    (): HanOption[] => [
      { value: 1, label: "1翻" },
      { value: 2, label: "2翻" },
      { value: 3, label: "3翻" },
      { value: 4, label: "4翻" },
      { value: 5, label: "満貫" },
      { value: 6, label: "跳満" },
      { value: 8, label: "倍満" },
      { value: 11, label: "三倍満" },
      { value: 13, label: "役満" },
    ],
    []
  )

  const fuOptions = useMemo(
    (): FuOption[] => [
      { value: 20, label: "20符" },
      { value: 25, label: "25符" },
      { value: 30, label: "30符" },
      { value: 40, label: "40符" },
      { value: 50, label: "50符" },
      { value: 60, label: "60符" },
      { value: 70, label: "70符" },
      { value: 80, label: "80符" },
      { value: 90, label: "90符" },
      { value: 100, label: "100符" },
      { value: 110, label: "110符" },
    ],
    []
  )

  // Memoized player display function
  const getPlayerDisplay = useCallback(
    (player: TPlayer) => {
      const position = getPositionName(player.position, gameState.currentOya)
      const isDealerMark =
        player.position === gameState.currentOya ? " (親)" : ""
      return `${position} ${player.name}${isDealerMark}`
    },
    [gameState.currentOya]
  )

  // Memoized validation function
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {}

    // 和了者チェック
    if (!winnerId) {
      errors.winnerId = "和了者を選択してください"
    }

    // 放銃者チェック（ロンの場合）
    if (actionType === "ron") {
      if (!loserId) {
        errors.loserId = "放銃者を選択してください"
      } else if (winnerId === loserId) {
        errors.loserId = "和了者と放銃者は異なるプレイヤーを選択してください"
      }
    }

    // 翻数チェック
    if (han < 1 || han > 13) {
      errors.han = "翻数は1〜13の範囲で選択してください"
    }

    // 符数チェック（満貫未満の場合）
    if (han < 5) {
      if (fu < 20 || fu > 110) {
        errors.fu = "符数は20〜110の範囲で選択してください"
      }

      // 符数の妥当性チェック（5の倍数または20,25,30など）
      const validFu = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110]
      if (!validFu.includes(fu)) {
        errors.fu = "無効な符数です"
      }
    }

    // 点数計算の妥当性チェック
    const winner = gameState.players.find((p) => p.id === winnerId)
    if (winner && winner.points <= 0) {
      errors.winnerId = "トビ状態のプレイヤーは和了できません"
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

      const scoreData: ScoreSubmissionData = {
        winnerId,
        han,
        fu,
        isTsumo: actionType === "tsumo",
        loserId: actionType === "ron" ? loserId : undefined,
      }

      await onSubmit(scoreData)
    } catch (error) {
      console.error("Score submission failed:", error)
      setValidationErrors({
        submit:
          error instanceof Error ? error.message : "点数計算に失敗しました",
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
    setStep(nextStepAfterLoser)
  }

  const isManganOrAbove = han >= 5

  // ステップ計算の修正（soloモードを考慮）
  const confirmStep =
    mode === "solo"
      ? actionType === "ron"
        ? 4
        : 3
      : actionType === "ron"
        ? 3
        : 2
  const fuStep =
    mode === "solo"
      ? actionType === "ron"
        ? 3
        : 2
      : actionType === "ron"
        ? 2
        : 1
  const nextStepAfterLoser = mode === "solo" ? 2 : 1

  // ソロモード用の和了者選択ステップ
  const renderWinnerStep = () => (
    <Stepper.Step label="和了者">
      <div className="grid grid-cols-2 gap-2 mt-4">
        {gameState.players.map((player) => (
          <MantineButton
            key={player.id}
            fullWidth
            color={winnerId === player.id ? "green" : "gray"}
            onClick={() => {
              handleWinnerChange(player.id)
              setStep(actionType === "ron" ? 1 : 1)
            }}
          >
            {getPlayerDisplay(player)}
          </MantineButton>
        ))}
      </div>
    </Stepper.Step>
  )

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
        setStep(actionType === "ron" ? 1 : mode === "solo" ? 1 : 0)
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
        点数入力 - {actionType === "tsumo" ? "ツモ" : "ロン"}
      </h2>
      <form onSubmit={handleSubmit}>
        <Stepper
          active={step}
          allowNextStepsSelect={false}
          orientation="vertical"
        >
          {/* ソロモードの場合、最初に和了者選択 */}
          {mode === "solo" && renderWinnerStep()}

          {actionType === "ron" && (
            <Stepper.Step label="放銃者">
              <div className="grid grid-cols-2 gap-2 mt-4">
                {gameState.players
                  .filter((p) => p.id !== winnerId)
                  .map((player) => (
                    <MantineButton
                      key={player.id}
                      fullWidth
                      color={loserId === player.id ? "red" : "gray"}
                      onClick={() => handleLoserChange(player.id)}
                    >
                      {getPlayerDisplay(player)}
                    </MantineButton>
                  ))}
              </div>
            </Stepper.Step>
          )}

          <Stepper.Step label="翻数">
            <div className="grid grid-cols-3 gap-2 mt-4">
              {hanOptions.map((option) => (
                <MantineButton
                  key={option.value}
                  fullWidth
                  color="blue"
                  variant={han === option.value ? "filled" : "light"}
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
                    .filter((opt) => validateHanFu(han, opt.value))
                    .map((option) => (
                      <MantineButton
                        key={option.value}
                        fullWidth
                        color="green"
                        variant={fu === option.value ? "filled" : "light"}
                        onClick={() => handleFuSelect(option.value)}
                      >
                        {option.label}
                      </MantineButton>
                    ))}
                </div>
                <MantineButton
                  className="mt-4"
                  onClick={handleBack}
                  variant="default"
                >
                  戻る
                </MantineButton>
              </>
            )}
          </Stepper.Step>

          <Stepper.Step label="確認">
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm text-gray-700 mt-4">
              <div>和了: {actionType === "tsumo" ? "ツモ" : "ロン"}</div>
              <div>
                翻数: {hanOptions.find((opt) => opt.value === han)?.label}
                {!isManganOrAbove && ` ${fu}符`}
              </div>
              {winnerId && (
                <div>
                  和了者:{" "}
                  {gameState.players.find((p) => p.id === winnerId)?.name}
                </div>
              )}
              {actionType === "ron" && loserId && (
                <div>
                  放銃者:{" "}
                  {gameState.players.find((p) => p.id === loserId)?.name}
                </div>
              )}
              <div>本場: {gameState.honba}本場</div>
              <div>供託: {gameState.kyotaku}本</div>
              {scorePreview && (
                <div>
                  支払い:{" "}
                  {actionType === "tsumo"
                    ? scorePreview.payments.fromOya
                      ? `親 ${scorePreview.payments.fromOya}点 / 子 ${scorePreview.payments.fromKo}点`
                      : `子 ${scorePreview.payments.fromKo}点`
                    : `${scorePreview.payments.fromLoser}点`}
                </div>
              )}
            </div>

            {validationErrors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-4">
                <div className="text-sm text-red-800">
                  {validationErrors.submit}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <MantineButton variant="default" onClick={handleBack} fullWidth>
                戻る
              </MantineButton>
              <MantineButton
                type="submit"
                loading={isSubmitting}
                disabled={!winnerId || (actionType === "ron" && !loserId)}
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
}

export default memo(BaseScoreInputForm) as typeof BaseScoreInputForm
