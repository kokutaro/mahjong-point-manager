import { NextRequest } from "next/server"
import { SoloPointManager } from "@/lib/solo/solo-point-manager"
import { SoloRyukyokuSchema } from "@/schemas/solo"
import {
  withErrorHandler,
  createSuccessResponse,
  validateSchema,
  validatePlayerPosition,
  AppError,
} from "@/lib/error-handler"

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
  ) => {
    const { gameId } = await params
    const body = await request.json()

    // バリデーション
    const { type, tenpaiPlayers = [] } = validateSchema(
      SoloRyukyokuSchema,
      body
    )

    // ゲーム状態を事前チェック
    const { prisma } = await import("@/lib/prisma")
    const game = await prisma.soloGame.findUnique({
      where: { id: gameId },
      include: { players: true },
    })

    if (!game) {
      throw new AppError("GAME_NOT_FOUND", "ゲームが見つかりません", {}, 404)
    }

    if (game.status !== "PLAYING") {
      throw new AppError(
        "GAME_NOT_PLAYING",
        "ゲームが進行中ではありません",
        {},
        400
      )
    }

    // テンパイ者数の妥当性チェック
    if (tenpaiPlayers.length > 4) {
      throw new AppError(
        "INVALID_TENPAI_COUNT",
        "テンパイ者数が無効です",
        { count: tenpaiPlayers.length },
        400
      )
    }

    // プレイヤー位置の妥当性チェック
    tenpaiPlayers.forEach((pos) => validatePlayerPosition(pos))

    // リーチ者がテンパイ者に含まれているかチェック
    const currentReachPlayers = game.players
      .filter((p) => p.isReach)
      .map((p) => p.position)

    const missingReachPlayers = currentReachPlayers.filter(
      (pos) => !tenpaiPlayers.includes(pos)
    )
    if (missingReachPlayers.length > 0) {
      throw new AppError(
        "REACH_PLAYER_NOT_TENPAI",
        "リーチしているプレイヤーはテンパイしている必要があります",
        { missingReachPlayers },
        400
      )
    }

    // 流局処理
    const pointManager = new SoloPointManager(gameId)

    // 流局の理由を生成
    let reason = "流局"
    if (type === "ABORTIVE_DRAW") {
      reason = "途中流局"
    } else {
      const tenpaiCount = tenpaiPlayers.length
      if (tenpaiCount === 0) {
        reason = "全員ノーテン流局"
      } else if (tenpaiCount === 4) {
        reason = "全員テンパイ流局"
      } else {
        reason = `${tenpaiCount}人テンパイ流局`
      }
    }

    // 流局処理（内部で親ローテーションとゲーム終了判定も実行）
    const gameEndResult = await pointManager.handleRyukyoku(
      reason,
      tenpaiPlayers
    )

    // 更新されたゲーム状態
    const updatedGameState = await pointManager.getGameState()

    return createSuccessResponse({
      gameState: updatedGameState,
      tenpaiPlayers,
      reachPlayers: currentReachPlayers,
      message: reason,
      gameEnded: gameEndResult.gameEnded,
      reason: gameEndResult.reason,
    })
  },
  "ソロ流局処理に失敗しました"
)
