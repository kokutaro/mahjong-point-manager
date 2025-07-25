"use client"

import { memo, useCallback } from "react"
import { Button } from "@mantine/core"

interface GameState {
  gameId: string
  players: Array<{
    playerId: string
    name: string
    position: number
    points: number
    isReach: boolean
    isConnected: boolean
  }>
  currentRound: number
  currentOya: number
  honba: number
  kyotaku: number
  gamePhase: "waiting" | "playing" | "finished"
}

interface UndoButtonProps {
  gameState: GameState
  hostPlayerId: string
  currentPlayerId: string
  onUndoClick: () => void
  disabled?: boolean
  isLoading?: boolean
}

const UndoButton = memo(function UndoButton({
  gameState,
  hostPlayerId,
  currentPlayerId,
  onUndoClick,
  disabled = false,
  isLoading = false,
}: UndoButtonProps) {
  // ホストプレイヤーかどうかを判定
  const isHost = currentPlayerId === hostPlayerId

  // Undoボタンを表示すべきかを判定
  const shouldShowUndo = isHost && gameState.gamePhase === "playing"

  // Undoボタンを無効化すべきかを判定
  const isUndoDisabled = useCallback(() => {
    // 基本的な無効化条件
    if (disabled || isLoading) {
      return true
    }

    // 最初の局ではUndoできない（実際にはバックエンドで制御されるが、UIでも判定）
    if (gameState.currentRound === 1 && gameState.honba === 0) {
      return true
    }

    return false
  }, [disabled, isLoading, gameState.currentRound, gameState.honba])

  const handleClick = useCallback(() => {
    if (!isUndoDisabled()) {
      onUndoClick()
    }
  }, [onUndoClick, isUndoDisabled])

  // ホストでない、または対局中でない場合は表示しない
  if (!shouldShowUndo) {
    return null
  }

  return (
    <Button
      variant="outline"
      color="orange"
      size="sm"
      leftSection={<span>↶</span>}
      onClick={handleClick}
      disabled={isUndoDisabled()}
      loading={isLoading}
      className="ml-2"
      aria-label="1つ前の局に戻る"
    >
      Undo
    </Button>
  )
})

export default UndoButton
