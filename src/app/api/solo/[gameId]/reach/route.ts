import { NextRequest } from "next/server"
import { declareSoloReach } from "@/lib/solo/score-manager"
import { SoloRiichiSchema } from "@/schemas/solo"
import {
  withErrorHandler,
  createSuccessResponse,
  validateSchema,
  validatePlayerExists,
  validatePlayerPosition,
  validateSufficientPoints,
  validateNotAlreadyReach,
} from "@/lib/error-handler"

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
  ) => {
    const { gameId } = await params
    const body = await request.json()

    // バリデーション
    const { position, round } = validateSchema(SoloRiichiSchema, body)

    // プレイヤー位置の妥当性チェック
    validatePlayerPosition(position)

    // ゲーム状態を事前チェック
    const { prisma } = await import("@/lib/prisma")
    const game = await prisma.soloGame.findUnique({
      where: { id: gameId },
      include: {
        players: {
          where: { position },
        },
      },
    })

    // ゲーム存在・状態チェック
    if (!game) {
      throw new Error("ゲームが見つかりません")
    }

    if (game.status !== "PLAYING") {
      throw new Error(
        `ゲーム状態が無効です。期待: PLAYING, 現在: ${game.status}`
      )
    }

    const player = game.players[0]
    validatePlayerExists(player, position.toString())

    // リーチ関連のチェック
    validateNotAlreadyReach(player.isReach, position.toString())
    validateSufficientPoints(player.currentPoints, 1000, position.toString())

    // リーチ宣言処理
    const gameState = await declareSoloReach(gameId, position, round)

    return createSuccessResponse({
      gameState,
      message: `${player.name}がリーチしました`,
    })
  },
  "ソロリーチ宣言に失敗しました"
)
