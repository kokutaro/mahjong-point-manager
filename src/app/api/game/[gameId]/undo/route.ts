import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { PointManager } from "@/lib/point-manager"
import { MultiUndoSchema } from "@/schemas/multi"
import {
  withErrorHandler,
  createSuccessResponse,
  GameNotFoundError,
  AppError,
} from "@/lib/error-handler"

/**
 * Undo操作 - 最後のゲームイベントを取り消し、1つ前の状態に戻す
 * ホストプレイヤーのみが実行可能
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
  ) => {
    const { gameId } = await params
    const body = await request.json()

    // リクエストデータの検証
    const validationResult = MultiUndoSchema.safeParse(body)
    if (!validationResult.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "リクエストデータが無効です",
        validationResult.error.errors,
        400
      )
    }

    const { hostPlayerId } = validationResult.data

    console.log(
      "Processing undo operation for gameId:",
      gameId,
      "hostPlayerId:",
      hostPlayerId
    )

    // ゲーム存在確認とホスト権限確認
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: "asc" },
        },
      },
    })

    if (!game) {
      throw new GameNotFoundError(gameId)
    }

    // ホスト権限チェック
    if (game.hostPlayerId !== hostPlayerId) {
      throw new AppError(
        "UNAUTHORIZED",
        "Undo操作はホストプレイヤーのみ実行できます",
        { hostPlayerId: game.hostPlayerId, requestedBy: hostPlayerId },
        403
      )
    }

    // ゲーム状態チェック
    if (game.status !== "PLAYING") {
      throw new AppError(
        "INVALID_GAME_STATE",
        "プレイ中のゲームでのみUndo操作が可能です",
        { currentStatus: game.status },
        400
      )
    }

    // PointManagerインスタンスを作成してUndo操作を実行
    const pointManager = new PointManager(gameId)
    const undoResult = await pointManager.undoLastEvent()

    // 更新されたゲーム状態を取得
    const updatedGameState = await pointManager.getGameState()

    console.log("Undo operation completed successfully")

    return createSuccessResponse({
      gameId,
      undoResult,
      gameState: updatedGameState,
      message: "Undo操作が完了しました",
    })
  },
  "Undo操作に失敗しました"
)
