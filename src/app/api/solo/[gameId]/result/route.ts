import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  withErrorHandler,
  createSuccessResponse,
  AppError,
} from "@/lib/error-handler"

// イベントデータの型定義
type EventData = {
  reason?: string
}

export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
  ) => {
    const { gameId } = await params

    // ゲーム情報と結果を取得
    const game = await prisma.soloGame.findUnique({
      where: { id: gameId },
      include: {
        players: {
          orderBy: { position: "asc" },
        },
      },
    })

    console.log("Solo game result query:", {
      gameId,
      game: game
        ? {
            id: game.id,
            status: game.status,
            players: game.players.map((p) => ({
              position: p.position,
              name: p.name,
              currentPoints: p.currentPoints,
              finalPoints: p.finalPoints,
              finalRank: p.finalRank,
              uma: p.uma,
              settlement: p.settlement,
            })),
          }
        : null,
    })

    if (!game) {
      throw new AppError("GAME_NOT_FOUND", "ゲームが見つかりません", {}, 404)
    }

    if (game.status !== "FINISHED") {
      throw new AppError(
        "GAME_NOT_FINISHED",
        "ゲームが終了していません",
        { status: game.status },
        400
      )
    }

    // 結果データを整形
    // finalRankがnullの場合は現在の点数で順位を計算
    const basePoints = game.initialPoints || 25000
    const playersWithRank = game.players.map((player) => {
      if (player.finalRank !== null && player.finalPoints !== null) {
        return player
      } else {
        // finalRankがnullの場合は現在の点数をfinalPointsとして使用
        return {
          ...player,
          finalPoints: player.currentPoints,
          finalRank: 0, // 後で計算
          uma: 0,
          settlement: player.currentPoints - basePoints,
        }
      }
    })

    // 現在の点数で順位を計算
    const sortedByPoints = playersWithRank
      .sort(
        (a, b) =>
          (b.finalPoints || b.currentPoints) -
          (a.finalPoints || a.currentPoints)
      )
      .map((player, index) => ({
        ...player,
        calculatedRank: index + 1,
      }))

    // ウマ計算（簡易版）
    const uma = [15000, 5000, -5000, -15000] // +15/+5/-5/-15

    const results = sortedByPoints.map((player) => {
      const rank = player.finalRank || player.calculatedRank
      const finalPoints = player.finalPoints || player.currentPoints
      const umaValue = uma[rank - 1] || 0
      const settlement = finalPoints - basePoints + umaValue

      return {
        playerId: player.position.toString(),
        name: player.name,
        finalPoints,
        rank,
        uma: umaValue,
        settlement,
      }
    })

    console.log("Processed solo results:", results)

    // 終了理由を取得（最後のGAME_ENDイベントから）
    const endEvent = await prisma.soloGameEvent.findFirst({
      where: {
        soloGameId: gameId,
        eventType: "GAME_END",
      },
      orderBy: { createdAt: "desc" },
    })

    const endReason = endEvent?.eventData
      ? typeof endEvent.eventData === "object" &&
        endEvent.eventData !== null &&
        "reason" in endEvent.eventData
        ? (endEvent.eventData as EventData).reason || "終了"
        : "終了"
      : "終了"

    const resultData = {
      gameId: game.id,
      roomCode: `SOLO-${game.id}`, // ソロプレイ用の固定値
      results,
      gameType: "HANCHAN" as const, // ソロプレイのデフォルト
      endReason,
      endedAt: game.endedAt?.toISOString() || new Date().toISOString(),
      basePoints, // 実際のゲームの初期点数を使用
      // セッション関連は全てundefined（ソロプレイには不要）
      sessionId: undefined,
      sessionCode: undefined,
      sessionName: undefined,
      hostPlayerId: undefined,
      nextGame: null,
    }

    return createSuccessResponse(resultData)
  },
  "ソロゲーム結果の取得に失敗しました"
)
