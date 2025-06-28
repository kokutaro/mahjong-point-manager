import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { 
  withErrorHandler, 
  createSuccessResponse, 
  GameNotFoundError,
  AppError
} from '@/lib/error-handler'

/**
 * 統合版ゲーム結果取得エンドポイント
 * マルチプレイとソロプレイの両方に対応
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await params

  console.log('Fetching unified game result for gameId:', gameId)

  // まずマルチプレイゲームかどうか確認
  const multiGame = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      participants: {
        include: { player: true },
        orderBy: { position: 'asc' }
      },
      result: true,
      settings: true,
      session: {
        include: {
          hostPlayer: true
        }
      }
    }
  })

  if (multiGame) {
    console.log('Processing as multiplayer game result')
    return await processMultiplayerResult(multiGame, gameId)
  }

  // ソロプレイゲームかどうか確認
  const soloGame = await prisma.soloGame.findUnique({
    where: { id: gameId },
    include: {
      players: {
        orderBy: { position: 'asc' }
      }
    }
  })

  if (soloGame) {
    console.log('Processing as solo game result (using multiplayer logic)')
    // ソロゲームの場合もマルチプレイヤーのロジックを使用
    return await processMultiplayerResult(soloGame, gameId, true)
  }

  // どちらのゲームも見つからない場合
  throw new GameNotFoundError(gameId)
}, 'ゲーム結果の取得に失敗しました')

/**
 * マルチプレイゲームの結果処理
 */
async function processMultiplayerResult(game: any, gameId: string, isSoloGame: boolean = false) {
  if (game.status !== 'FINISHED') {
    throw new AppError('GAME_NOT_FINISHED', 'ゲームが終了していません', { status: game.status }, 400)
  }

  console.log('Unified game result query:', { gameId, game: { 
    id: game.id, 
    status: game.status, 
    players: isSoloGame ? game.players.map((p: any) => ({
      position: p.position,
      name: p.name,
      currentPoints: p.currentPoints,
      finalPoints: p.finalPoints,
      finalRank: p.finalRank,
      uma: p.uma,
      settlement: p.settlement
    })) : game.participants.map((p: any) => ({
      playerId: p.playerId,
      name: p.player.name,
      finalPoints: p.finalPoints,
      finalRank: p.finalRank,
      uma: p.uma,
      settlement: p.settlement
    }))
  } })

  const playersToProcess = isSoloGame ? game.players : game.participants

  // 結果データを整形
  // finalRankがnullの場合は現在の点数で順位を計算
  const basePoints = isSoloGame ? game.initialPoints || 25000 : game.settings?.basePoints || 25000
  const participantsWithRank = playersToProcess.map((participant: any) => {
    if (participant.finalRank !== null && participant.finalPoints !== null) {
      return participant
    } else {
      // finalRankがnullの場合は現在の点数をfinalPointsとして使用
      return {
        ...participant,
        finalPoints: participant.currentPoints,
        finalRank: 0, // 後で計算
        uma: 0,
        settlement: participant.currentPoints - basePoints
      }
    }
  })

  // 現在の点数で順位を計算
  const sortedByPoints = participantsWithRank
    .sort((a: any, b: any) => (b.finalPoints || b.currentPoints) - (a.finalPoints || a.currentPoints))
    .map((participant: any, index: number) => ({
      ...participant,
      calculatedRank: index + 1
    }))

  const results = sortedByPoints.map((participant: any) => ({
    playerId: isSoloGame ? participant.position.toString() : participant.playerId,
    name: isSoloGame ? participant.name : participant.player.name,
    finalPoints: participant.finalPoints || participant.currentPoints,
    rank: participant.finalRank || participant.calculatedRank,
    uma: participant.uma || 0,
    settlement: participant.settlement || (participant.finalPoints || participant.currentPoints) - basePoints
  }))

  console.log('Processed multiplayer results:', results)

  // 終了理由を取得（最後のGAME_ENDイベントから）
  const endEvent = await prisma.gameEvent.findFirst({
    where: {
      gameId: gameId,
      eventType: 'GAME_END'
    },
    orderBy: { createdAt: 'desc' }
  })

  const endReason = endEvent?.eventData ? 
    (typeof endEvent.eventData === 'object' && endEvent.eventData !== null && 'reason' in endEvent.eventData ? 
      (endEvent.eventData as any).reason : '終了') : '終了'

  let nextGame: { id: string, roomCode: string } | null = null
  if (game.sessionId && game.sessionOrder != null) {
    const ng = await prisma.game.findFirst({
      where: {
        sessionId: game.sessionId,
        sessionOrder: game.sessionOrder + 1,
        status: 'WAITING'
      },
      select: { id: true, roomCode: true }
    })
    if (ng) {
      nextGame = { id: ng.id, roomCode: ng.roomCode }
    }
  }

  const resultData = {
    gameId: game.id,
    roomCode: game.roomCode,
    results,
    gameMode: isSoloGame ? 'SOLO' : 'MULTIPLAYER',
    gameType: isSoloGame ? 'HANCHAN' : (game.settings?.gameType || game.gameType),
    endReason,
    endedAt: game.endedAt?.toISOString() || new Date().toISOString(),
    basePoints: isSoloGame ? (game.initialPoints || 25000) : (game.settings?.basePoints || 25000),
    sessionId: isSoloGame ? undefined : game.sessionId,
    sessionCode: isSoloGame ? undefined : game.session?.sessionCode,
    sessionName: isSoloGame ? undefined : game.session?.name,
    hostPlayerId: isSoloGame ? undefined : game.session?.hostPlayerId,
    nextGame: isSoloGame ? null : nextGame
  }

  return createSuccessResponse(resultData)
}

