import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  CreateSoloGameSchema,
  validatePlayerNames,
  validatePlayerPositions,
} from "@/schemas/solo"
import { authenticatePlayer } from "@/lib/solo/auth"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // バリデーション
    const validation = CreateSoloGameSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "入力データが無効です",
            details: validation.error.errors,
          },
        },
        { status: 400 }
      )
    }

    const { gameType, initialPoints, basePoints, uma, players } =
      validation.data

    // プレイヤー名の重複チェック
    if (!validatePlayerNames(players)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_NAMES",
            message: "プレイヤー名が重複しています",
          },
        },
        { status: 400 }
      )
    }

    // プレイヤー位置の妥当性チェック
    if (!validatePlayerPositions(players.map((p) => p.position))) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_POSITIONS",
            message: "プレイヤーの位置が無効です",
          },
        },
        { status: 400 }
      )
    }

    // プレイヤー認証
    const authResult = await authenticatePlayer(request)
    if (!authResult.success) {
      const statusCode =
        authResult.error?.code === "UNAUTHORIZED"
          ? 401
          : authResult.error?.code === "PLAYER_NOT_FOUND"
            ? 404
            : 500
      return NextResponse.json(
        {
          success: false,
          error: authResult.error,
        },
        { status: statusCode }
      )
    }

    const hostPlayerId = authResult.playerId!

    // データベーストランザクション
    const result = await prisma.$transaction(async (tx) => {
      // ソロゲーム作成
      const soloGame = await tx.soloGame.create({
        data: {
          hostPlayerId,
          gameType,
          initialPoints,
          basePoints,
          uma: uma,
          status: "WAITING",
        },
      })

      // ソロプレイヤー作成
      const soloPlayers = await Promise.all(
        players.map((player) =>
          tx.soloPlayer.create({
            data: {
              soloGameId: soloGame.id,
              position: player.position,
              name: player.name,
              currentPoints: initialPoints,
            },
          })
        )
      )

      // ゲーム開始イベントを記録
      await tx.soloGameEvent.create({
        data: {
          soloGameId: soloGame.id,
          eventType: "GAME_START",
          round: 1,
          honba: 0,
          eventData: {
            gameType,
            initialPoints,
            players: soloPlayers.map((p) => ({
              position: p.position,
              name: p.name,
              initialPoints: p.currentPoints,
            })),
          },
        },
      })

      return {
        soloGame,
        soloPlayers,
      }
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          gameId: result.soloGame.id,
          gameType: result.soloGame.gameType,
          initialPoints: result.soloGame.initialPoints,
          basePoints: result.soloGame.basePoints,
          uma: result.soloGame.uma,
          players: result.soloPlayers.map((p) => ({
            position: p.position,
            name: p.name,
            currentPoints: p.currentPoints,
            isReach: p.isReach,
          })),
          status: result.soloGame.status,
          currentOya: result.soloGame.currentOya,
          currentRound: result.soloGame.currentRound,
          honba: result.soloGame.honba,
          kyotaku: result.soloGame.kyotaku,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Solo game creation error:", error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "ソロゲーム作成に失敗しました",
        },
      },
      { status: 500 }
    )
  }
}
