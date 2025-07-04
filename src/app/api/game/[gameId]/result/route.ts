import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import {
  withErrorHandler,
  createSuccessResponse,
  GameNotFoundError,
  AppError,
} from "@/lib/error-handler"
import type {
  Game,
  GameParticipant,
  Player,
  GameResult,
  GameSettings,
  GameSession,
  SoloGame,
  SoloPlayer,
} from "@prisma/client"

// 型定義
type MultiplayerGameWithIncludes = Game & {
  participants: (GameParticipant & { player: Player })[]
  result: GameResult | null
  settings: GameSettings | null
  session: (GameSession & { hostPlayer: Player }) | null
}

type SoloGameWithIncludes = SoloGame & {
  players: SoloPlayer[]
}

/**
 * 統合版ゲーム結果取得エンドポイント
 * マルチプレイとソロプレイの両方に対応
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
  ) => {
    const { gameId } = await params

    console.log("Fetching unified game result for gameId:", gameId)

    // まずマルチプレイゲームかどうか確認
    const multiGame = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: "asc" },
        },
        result: true,
        settings: true,
        session: {
          include: {
            hostPlayer: true,
          },
        },
      },
    })

    if (multiGame) {
      console.log("Processing as multiplayer game result")
      return await processMultiplayerResult(multiGame, gameId)
    }

    // ソロプレイゲームかどうか確認
    const soloGame = await prisma.soloGame.findUnique({
      where: { id: gameId },
      include: {
        players: {
          orderBy: { position: "asc" },
        },
      },
    })

    if (soloGame) {
      console.log("Processing as solo game result (using multiplayer logic)")
      // ソロゲームの場合もマルチプレイヤーのロジックを使用
      return await processMultiplayerResult(soloGame, gameId, true)
    }

    // どちらのゲームも見つからない場合
    throw new GameNotFoundError(gameId)
  },
  "ゲーム結果の取得に失敗しました"
)

/**
 * マルチプレイゲームの結果処理
 */
async function processMultiplayerResult(
  game: MultiplayerGameWithIncludes | SoloGameWithIncludes,
  gameId: string,
  isSoloGame: boolean = false
) {
  if (game.status !== "FINISHED") {
    throw new AppError(
      "GAME_NOT_FINISHED",
      "ゲームが終了していません",
      { status: game.status },
      400
    )
  }

  console.log("Unified game result query:", {
    gameId,
    game: {
      id: game.id,
      status: game.status,
      players: isSoloGame
        ? (game as SoloGameWithIncludes).players.map((p) => ({
            position: p.position,
            name: p.name,
            currentPoints: p.currentPoints,
            finalPoints: p.finalPoints,
            finalRank: p.finalRank,
            uma: p.uma,
            settlement: p.settlement,
          }))
        : (game as MultiplayerGameWithIncludes).participants.map((p) => ({
            playerId: p.playerId,
            name: p.player.name,
            finalPoints: p.finalPoints,
            finalRank: p.finalRank,
            uma: p.uma,
            settlement: p.settlement,
          })),
    },
  })

  const playersToProcess = isSoloGame
    ? (game as SoloGameWithIncludes).players
    : (game as MultiplayerGameWithIncludes).participants

  // 結果データを整形
  // finalRankがnullの場合は現在の点数で順位を計算
  const basePoints = isSoloGame
    ? (game as SoloGameWithIncludes).initialPoints || 25000
    : (game as MultiplayerGameWithIncludes).settings?.basePoints || 25000
  const participantsWithRank = playersToProcess.map((participant) => {
    if (participant.finalRank !== null && participant.finalPoints !== null) {
      return participant
    } else {
      // finalRankがnullの場合は現在の点数をfinalPointsとして使用
      return {
        ...participant,
        finalPoints: participant.currentPoints,
        finalRank: 0, // 後で計算
        uma: 0,
        settlement: participant.currentPoints - basePoints,
      }
    }
  })

  // 現在の点数で順位を計算
  const sortedByPoints = participantsWithRank
    .sort(
      (a, b) =>
        (b.finalPoints || b.currentPoints) - (a.finalPoints || a.currentPoints)
    )
    .map((participant, index: number) => ({
      ...participant,
      calculatedRank: index + 1,
    }))

  const results = sortedByPoints.map((participant) => ({
    playerId: isSoloGame
      ? participant.position?.toString() || ""
      : "playerId" in participant
        ? participant.playerId || ""
        : "",
    name: isSoloGame
      ? "name" in participant
        ? participant.name
        : ""
      : "player" in participant
        ? participant.player?.name || ""
        : "",
    finalPoints: participant.finalPoints || participant.currentPoints,
    rank: participant.finalRank || participant.calculatedRank,
    uma: participant.uma || 0,
    settlement:
      participant.settlement ||
      (participant.finalPoints || participant.currentPoints) - basePoints,
  }))

  console.log("Processed multiplayer results:", results)

  // 終了理由を取得（最後のGAME_ENDイベントから）
  const endEvent = await prisma.gameEvent.findFirst({
    where: {
      gameId: gameId,
      eventType: "GAME_END",
    },
    orderBy: { createdAt: "desc" },
  })

  const endReason = endEvent?.eventData
    ? typeof endEvent.eventData === "object" &&
      endEvent.eventData !== null &&
      "reason" in endEvent.eventData
      ? (endEvent.eventData as { reason: string }).reason
      : "終了"
    : "終了"

  let nextGame: { id: string; roomCode: string } | null = null
  if (
    !isSoloGame &&
    "sessionId" in game &&
    "sessionOrder" in game &&
    game.sessionId &&
    game.sessionOrder != null
  ) {
    const ng = await prisma.game.findFirst({
      where: {
        sessionId: game.sessionId,
        sessionOrder: game.sessionOrder + 1,
        status: "WAITING",
      },
      select: { id: true, roomCode: true },
    })
    if (ng) {
      nextGame = { id: ng.id, roomCode: ng.roomCode }
    }
  }

  const resultData = {
    gameId: game.id,
    roomCode: isSoloGame
      ? `SOLO-${game.id}`
      : "roomCode" in game
        ? game.roomCode
        : "",
    results,
    gameMode: isSoloGame ? "SOLO" : "MULTIPLAYER",
    gameType: isSoloGame
      ? "HANCHAN"
      : (game as MultiplayerGameWithIncludes).settings?.gameType ||
        (game as MultiplayerGameWithIncludes).gameType,
    endReason,
    endedAt: game.endedAt?.toISOString() || new Date().toISOString(),
    basePoints: isSoloGame
      ? (game as SoloGameWithIncludes).initialPoints || 25000
      : (game as MultiplayerGameWithIncludes).settings?.basePoints || 25000,
    sessionId: isSoloGame
      ? undefined
      : (game as MultiplayerGameWithIncludes).sessionId,
    sessionCode: isSoloGame
      ? undefined
      : (game as MultiplayerGameWithIncludes).session?.sessionCode,
    sessionName: isSoloGame
      ? undefined
      : (game as MultiplayerGameWithIncludes).session?.name,
    hostPlayerId: isSoloGame
      ? undefined
      : (game as MultiplayerGameWithIncludes).session?.hostPlayerId,
    nextGame: isSoloGame ? null : nextGame,
  }

  return createSuccessResponse(resultData)
}
