import {
  AppError,
  createSuccessResponse,
  validateNotAlreadyReach,
  validatePlayerExists,
  validatePlayerPosition,
  validateSchema,
  validateSufficientPoints,
  withErrorHandler,
} from "@/lib/error-handler"
import { PointManager } from "@/lib/point-manager"
import { prisma } from "@/lib/prisma"
import { declareSoloReach } from "@/lib/solo/score-manager"
import { PlayerIdentifierSchema } from "@/schemas/common"
import type { SoloGame, SoloPlayer } from "@prisma/client"
import { NextRequest } from "next/server"
import { z } from "zod"

// WebSocket 型定義
interface SocketIOInstance {
  to(room: string): {
    emit(event: string, data: unknown): void
  }
}

// リーチデータ型
type RiichiData = {
  playerId: string | number
  position?: number
  round?: number
}

type SoloGameWithPlayers = SoloGame & {
  players: SoloPlayer[]
}

// プロセスの型拡張
declare global {
  interface Process {
    __socketio?: SocketIOInstance
  }
}

// WebSocketインスタンスを直接プロセスから取得
function getIO(): SocketIOInstance | null {
  if (process.__socketio) {
    console.log("🔌 API: Found WebSocket instance in process")
    return process.__socketio
  }
  console.log("🔌 API: No WebSocket instance found in process")
  return null
}

// 統合版リーチスキーマ
const unifiedRiichiRequestSchema = z.object({
  playerId: PlayerIdentifierSchema,
  position: z.number().int().min(0).max(3).optional(), // 後方互換性のため
  round: z.number().int().positive().optional(), // ソロプレイ用
})

/**
 * 統合版リーチ宣言エンドポイント
 * マルチプレイとソロプレイの両方に対応
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
  ) => {
    const body = await request.json()
    const validatedData = validateSchema(unifiedRiichiRequestSchema, body)
    const { gameId } = await params

    console.log("Processing unified riichi declaration for gameId:", gameId)

    // まずマルチプレイゲームかどうか確認
    const multiGame = await prisma.game.findUnique({
      where: { id: gameId },
    })

    if (multiGame) {
      console.log("Processing as multiplayer riichi")
      return await processMultiplayerRiichi(gameId, validatedData)
    }

    // ソロプレイゲームかどうか確認
    const soloGame = await prisma.soloGame.findUnique({
      where: { id: gameId },
      include: { players: true },
    })

    if (soloGame) {
      console.log("Processing as solo riichi")
      return await processSoloRiichi(gameId, validatedData, soloGame)
    }

    throw new AppError("GAME_NOT_FOUND", "ゲームが見つかりません", {}, 404)
  },
  "リーチ宣言に失敗しました"
)

/**
 * マルチプレイゲームのリーチ宣言処理
 */
async function processMultiplayerRiichi(
  gameId: string,
  validatedData: RiichiData
) {
  // プレイヤーIDが文字列であることを確認
  const playerId = validatedData.playerId
  if (typeof playerId !== "string") {
    throw new AppError(
      "VALIDATION_ERROR",
      "マルチプレイゲームではプレイヤーIDは文字列である必要があります",
      {},
      400
    )
  }

  const pointManager = new PointManager(gameId)

  // リーチ宣言処理
  await pointManager.declareReach(playerId)

  // 更新されたゲーム状態
  const updatedGameState = await pointManager.getGameState()

  // ルームコードを取得してWebSocket通知
  const game = await pointManager.getGameInfo()

  const io = getIO()

  if (io && game?.roomCode) {
    console.log(`🔌 Server: Emitting riichi_declared to room ${game.roomCode}`)
    io.to(game.roomCode).emit("riichi_declared", {
      gameState: updatedGameState,
      playerId,
    })
    console.log("🔌 Server: riichi_declared event sent")
  } else {
    console.log(
      "🔌 Server: Cannot emit riichi_declared - IO or roomCode missing:",
      {
        io: !!io,
        roomCode: game?.roomCode,
      }
    )
  }

  return createSuccessResponse({
    gameMode: "MULTIPLAYER",
    gameState: updatedGameState,
    message: `${playerId} がリーチしました`,
  })
}

/**
 * ソロプレイゲームのリーチ宣言処理
 */
async function processSoloRiichi(
  gameId: string,
  validatedData: RiichiData,
  soloGame: SoloGameWithPlayers
) {
  // プレイヤーIDが数値（位置）であることを確認
  let position: number
  if (typeof validatedData.playerId === "number") {
    position = validatedData.playerId
  } else if (validatedData.position !== undefined) {
    position = validatedData.position
  } else {
    throw new AppError(
      "VALIDATION_ERROR",
      "ソロプレイゲームではプレイヤー位置（数値）が必要です",
      {},
      400
    )
  }

  // プレイヤー位置の妥当性チェック
  validatePlayerPosition(position)

  // ゲーム状態を事前チェック
  if (soloGame.status !== "PLAYING") {
    throw new AppError(
      "GAME_NOT_PLAYING",
      `ゲーム状態が無効です。期待: PLAYING, 現在: ${soloGame.status}`,
      {},
      400
    )
  }

  const player = soloGame.players.find((p) => p.position === position)
  validatePlayerExists(player, position.toString())

  // リーチ関連のチェック
  validateNotAlreadyReach(player.isReach, position.toString())
  validateSufficientPoints(player.currentPoints, 1000, position.toString())

  // リーチ宣言処理
  const round = validatedData.round || soloGame.currentRound
  const gameState = await declareSoloReach(gameId, position, round)

  return createSuccessResponse({
    gameMode: "SOLO",
    gameState,
    message: `${player.name}がリーチしました`,
  })
}
