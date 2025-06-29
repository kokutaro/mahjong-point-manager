"use client"

import { useCallback } from "react"
import { BaseScoreInputForm } from "@/components/common"
import type {
  SoloGameState,
  SoloGamePlayer,
  ScoreSubmissionData,
} from "@/components/common"

interface SoloScoreFormProps {
  gameState: SoloGameState
  actionType: "tsumo" | "ron"
  onSubmit: (scoreData: ScoreSubmissionData) => Promise<void>
  onCancel: () => void
}

export default function SoloScoreForm({
  gameState,
  actionType,
  onSubmit,
  onCancel,
}: SoloScoreFormProps) {
  // 一人プレイ用の点数プレビュー計算（必要に応じてカスタマイズ）
  const calculateScorePreview = useCallback(
    async (data: {
      han: number
      fu: number
      isOya: boolean
      isTsumo: boolean
      honba: number
      kyotaku: number
    }) => {
      // 一人プレイでも既存の点数計算APIを使用
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

  return (
    <BaseScoreInputForm<SoloGameState, SoloGamePlayer>
      gameState={gameState}
      actionType={actionType}
      mode="solo"
      onSubmit={onSubmit}
      onCancel={onCancel}
      calculateScorePreview={calculateScorePreview}
    />
  )
}
