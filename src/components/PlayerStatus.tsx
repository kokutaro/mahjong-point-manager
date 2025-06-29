"use client"

import { memo, useMemo, useCallback } from "react"
import { getPositionName } from "@/lib/utils"

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
  gamePhase: "waiting" | "playing" | "finished"
}

interface PlayerStatusProps {
  gameState: GameState
  currentPlayer?: GamePlayer
  onReach: (playerId: string) => void
  canDeclareReach: (player: GamePlayer) => boolean
}

const PlayerStatus = memo(function PlayerStatus({
  gameState,
  currentPlayer,
  onReach,
  canDeclareReach,
}: PlayerStatusProps) {
  // Memoized color calculation functions
  const getPositionColor = useCallback((position: number) => {
    const colors = [
      "bg-red-100 text-red-800", // 東
      "bg-green-100 text-green-800", // 南
      "bg-blue-100 text-blue-800", // 西
      "bg-yellow-100 text-yellow-800", // 北
    ]
    return colors[position] || "bg-gray-100 text-gray-800"
  }, [])

  const getRankColor = useCallback((rank: number) => {
    const colors = [
      "border-yellow-400 bg-yellow-50", // 1位
      "border-gray-400 bg-gray-50", // 2位
      "border-orange-400 bg-orange-50", // 3位
      "border-red-400 bg-red-50", // 4位
    ]
    return colors[rank - 1] || "border-gray-300 bg-white"
  }, [])

  // Memoized player processing for performance
  const orderedPlayers = useMemo(() => {
    // プレイヤーを点数順でソート
    const sortedPlayers = [...gameState.players].sort(
      (a, b) => b.points - a.points
    )

    // 順位を計算
    const playersWithRank = sortedPlayers.map((player, index) => ({
      ...player,
      rank: index + 1,
    }))

    // 元の座席順に戻す
    return playersWithRank.sort((a, b) => a.position - b.position)
  }, [gameState.players])

  return (
    <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">
        プレイヤー状態
      </h2>

      {/* モバイル用: 2x2グリッド、タブレット・PC用: 1列 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4">
        {orderedPlayers.map((player) => {
          const isCurrentPlayer = player.playerId === currentPlayer?.playerId
          const isDealer = player.position === gameState.currentOya
          const canReach = canDeclareReach(player)

          return (
            <div
              key={player.playerId}
              className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                isCurrentPlayer
                  ? "border-blue-400 bg-blue-50"
                  : getRankColor(player.rank)
              }`}
            >
              {/* モバイル用レイアウト */}
              <div className="block sm:hidden">
                {/* 上段: 座席・順位・名前・親マーク */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs ${getPositionColor(player.position)}`}
                    >
                      {getPositionName(player.position, gameState.currentOya)}
                    </div>
                    <span className="font-semibold text-gray-800 text-sm">
                      {player.name}
                    </span>
                    {isDealer && (
                      <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-xs font-medium">
                        親
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {player.rank}位
                  </div>
                </div>

                {/* 中段: 点数 */}
                <div className="text-center mb-2">
                  <div className="text-lg font-bold text-gray-900">
                    {player.points.toLocaleString()}点
                  </div>
                </div>

                {/* 下段: 状態・アクション */}
                <div className="flex items-center justify-center space-x-2 flex-wrap gap-1">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      player.isConnected ? "bg-green-400" : "bg-red-400"
                    }`}
                  />

                  {isCurrentPlayer && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                      あなた
                    </span>
                  )}

                  {player.isReach && (
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                      リーチ
                    </span>
                  )}

                  {isCurrentPlayer && canReach && !player.isReach && (
                    <button
                      onClick={() => onReach(player.playerId)}
                      className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-yellow-600 transition-colors"
                    >
                      リーチ
                    </button>
                  )}

                  {player.points < 1000 && (
                    <span className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-xs">
                      リーチ不可
                    </span>
                  )}

                  {player.points <= 0 && (
                    <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-xs font-medium">
                      トビ
                    </span>
                  )}
                </div>
              </div>

              {/* タブレット・PC用レイアウト */}
              <div className="hidden sm:block">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {/* 座席・順位表示 */}
                    <div className="flex flex-col items-center space-y-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${getPositionColor(player.position)}`}
                      >
                        {getPositionName(player.position, gameState.currentOya)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.rank}位
                      </div>
                    </div>

                    {/* プレイヤー情報 */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-semibold text-gray-800">
                          {player.name}
                        </span>
                        {isDealer && (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                            親
                          </span>
                        )}
                        {isCurrentPlayer && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                            あなた
                          </span>
                        )}
                      </div>

                      <div className="text-lg font-bold text-gray-900 mt-1">
                        {player.points.toLocaleString()}点
                      </div>

                      {/* 前回からの変動（TODO: 実装） */}
                      <div className="text-sm text-gray-500">前回比: ±0</div>
                    </div>
                  </div>

                  {/* 状態・アクション */}
                  <div className="flex items-center space-x-2 flex-wrap">
                    {/* 接続状態 */}
                    <div
                      className={`w-3 h-3 rounded-full ${
                        player.isConnected ? "bg-green-400" : "bg-red-400"
                      }`}
                      title={player.isConnected ? "接続中" : "切断"}
                    />

                    {/* リーチ状態 */}
                    {player.isReach && (
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                        リーチ
                      </span>
                    )}

                    {/* リーチボタン（自分のターンかつ条件を満たす場合） */}
                    {isCurrentPlayer && canReach && !player.isReach && (
                      <button
                        onClick={() => onReach(player.playerId)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded text-sm font-medium hover:bg-yellow-600 transition-colors"
                      >
                        リーチ
                      </button>
                    )}

                    {/* 点数不足警告 */}
                    {player.points < 1000 && (
                      <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                        リーチ不可
                      </span>
                    )}

                    {/* トビ警告 */}
                    {player.points <= 0 && (
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                        トビ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 詳細情報（展開可能にする場合） - モバイルでは非表示 */}
              {isCurrentPlayer && (
                <div className="hidden lg:block mt-3 pt-3 border-t border-blue-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">リーチ可能:</span>
                      <span
                        className={`ml-2 ${canReach ? "text-green-600" : "text-red-600"}`}
                      >
                        {canReach ? "はい" : "いいえ"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">状態:</span>
                      <span className="ml-2 text-gray-800">
                        {player.isReach ? "リーチ中" : "通常"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 統計情報 */}
      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
          <div className="text-center">
            <div className="text-gray-600">平均点</div>
            <div className="font-semibold text-gray-800">
              {Math.round(
                gameState.players.reduce((sum, p) => sum + p.points, 0) /
                  gameState.players.length
              ).toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-600">トップ</div>
            <div className="font-semibold text-green-600">
              {Math.max(
                ...gameState.players.map((p) => p.points)
              ).toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-600">ラス</div>
            <div className="font-semibold text-red-600">
              {Math.min(
                ...gameState.players.map((p) => p.points)
              ).toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-600">点差</div>
            <div className="font-semibold text-gray-800">
              {(
                Math.max(...gameState.players.map((p) => p.points)) -
                Math.min(...gameState.players.map((p) => p.points))
              ).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default PlayerStatus
