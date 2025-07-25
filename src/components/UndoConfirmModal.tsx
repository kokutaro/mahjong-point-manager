"use client"

import { memo, useCallback } from "react"
import { Modal, Button, Group, Text, Stack, Alert } from "@mantine/core"
import { getPositionName } from "@/lib/utils"

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

interface UndoConfirmModalProps {
  opened: boolean
  gameState: GameState
  gameType: "TONPUU" | "HANCHAN"
  onConfirm: () => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  error?: string | null
}

const UndoConfirmModal = memo(function UndoConfirmModal({
  opened,
  gameState,
  gameType,
  onConfirm,
  onCancel,
  isLoading = false,
  error = null,
}: UndoConfirmModalProps) {
  // 現在の局名を計算
  const getCurrentRoundName = useCallback(() => {
    const round = gameState.currentRound
    if (round <= 4) {
      const roundNames = ["東一局", "東二局", "東三局", "東四局"]
      return roundNames[round - 1] || `東${round}局`
    } else if (round <= 8) {
      const roundNames = ["南一局", "南二局", "南三局", "南四局"]
      return roundNames[round - 5] || `南${round - 4}局`
    } else if (round <= 12) {
      const roundNames = ["西一局", "西二局", "西三局", "西四局"]
      return roundNames[round - 9] || `西${round - 8}局`
    } else {
      const roundNames = ["北一局", "北二局", "北三局", "北四局"]
      return roundNames[round - 13] || `北${round - 12}局`
    }
  }, [gameState.currentRound])

  // 親の情報を取得
  const getDealerInfo = useCallback(() => {
    const dealer = gameState.players.find(
      (p) => p.position === gameState.currentOya
    )
    return {
      name: dealer ? dealer.name : "不明",
      position: getPositionName(gameState.currentOya, gameState.currentOya),
    }
  }, [gameState.players, gameState.currentOya])

  // オーラス判定
  const isOorasu = useCallback(() => {
    return (
      (gameType === "TONPUU" && gameState.currentRound === 4) ||
      (gameType === "HANCHAN" && gameState.currentRound === 8)
    )
  }, [gameState.currentRound, gameType])

  const handleConfirm = useCallback(async () => {
    try {
      await onConfirm()
    } catch (error) {
      // エラーは親コンポーネントで処理される
      console.error("Undo operation failed:", error)
    }
  }, [onConfirm])

  const roundName = getCurrentRoundName()
  const dealerInfo = getDealerInfo()
  const isOorasuRound = isOorasu()

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={
        <Group gap="xs">
          <span style={{ fontSize: "20px" }}>↶</span>
          <Text fw={600}>Undo確認</Text>
        </Group>
      }
      centered
      withCloseButton={!isLoading}
      closeOnClickOutside={!isLoading}
      closeOnEscape={!isLoading}
    >
      <Stack gap="md">
        {/* 操作説明 */}
        <Alert icon={<span>⚠</span>} title="重要な操作です" color="orange">
          <Text size="sm">
            1つ前の局に戻り、直前の点数のやり取りをなかったことにします。
            <br />
            この操作は取り消すことができません。
          </Text>
        </Alert>

        {/* 現在の局情報 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <Text fw={600} size="sm" mb="xs" c="gray.7">
            現在の状況
          </Text>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Text size="sm" c="gray.6">
                局
              </Text>
              <Text size="sm" fw={500}>
                {roundName}
                {isOorasuRound && (
                  <span className="ml-1 text-red-600 font-semibold">
                    オーラス
                  </span>
                )}
              </Text>
            </div>
            <div className="flex justify-between">
              <Text size="sm" c="gray.6">
                親
              </Text>
              <Text size="sm" fw={500}>
                {dealerInfo.position} {dealerInfo.name}
              </Text>
            </div>
            <div className="flex justify-between">
              <Text size="sm" c="gray.6">
                本場
              </Text>
              <Text size="sm" fw={500}>
                {gameState.honba}本場
              </Text>
            </div>
            {gameState.kyotaku > 0 && (
              <div className="flex justify-between">
                <Text size="sm" c="gray.6">
                  供託
                </Text>
                <Text size="sm" fw={500}>
                  {gameState.kyotaku}本
                </Text>
              </div>
            )}
          </div>
        </div>

        {/* リーチ状況の表示 */}
        {gameState.players.some((p) => p.isReach) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <Text fw={600} size="sm" c="red.7" mb="xs">
              リーチ宣言中のプレイヤー
            </Text>
            <div className="flex flex-wrap gap-1">
              {gameState.players
                .filter((p) => p.isReach)
                .map((player) => (
                  <span
                    key={player.playerId}
                    className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs"
                  >
                    {getPositionName(player.position, gameState.currentOya)}{" "}
                    {player.name}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <Alert color="red" title="エラー">
            <Text size="sm">{error}</Text>
          </Alert>
        )}

        {/* 注意事項 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Text fw={600} size="sm" c="blue.7" mb="xs">
            注意事項
          </Text>
          <ul className="text-sm text-blue-700 space-y-1 ml-4">
            <li>• 直前のゲームイベント（点数計算、流局等）が取り消されます</li>
            <li>• リーチ状態も1つ前の状態に戻ります</li>
            <li>• この操作は不可逆です</li>
            <li>• 全てのプレイヤーに変更が通知されます</li>
          </ul>
        </div>

        {/* ボタン */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel} disabled={isLoading}>
            キャンセル
          </Button>
          <Button
            color="orange"
            onClick={handleConfirm}
            loading={isLoading}
            leftSection={<span>↶</span>}
          >
            Undoを実行
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
})

export default UndoConfirmModal
