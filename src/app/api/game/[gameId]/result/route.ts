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
    console.log('Processing as solo game result')
    return await processSoloResult(soloGame, gameId)
  }

  // どちらのゲームも見つからない場合
  throw new GameNotFoundError(gameId)
}, 'ゲーム結果の取得に失敗しました')

/**
 * マルチプレイゲームの結果処理
 */
async function processMultiplayerResult(game: any, gameId: string) {
  if (game.status !== 'FINISHED') {
    throw new AppError('GAME_NOT_FINISHED', 'ゲームが終了していません', { status: game.status }, 400)
  }

  console.log('Multiplayer game result query:', { gameId, game: { 
    id: game.id, 
    status: game.status, 
    participants: game.participants.map((p: any) => ({
      playerId: p.playerId,
      name: p.player.name,
      finalPoints: p.finalPoints,
      finalRank: p.finalRank,
      uma: p.uma,
      settlement: p.settlement
    }))
  } })

  // 結果データを整形
  // finalRankがnullの場合は現在の点数で順位を計算
  const participantsWithRank = game.participants.map((participant: any) => {
    if (participant.finalRank !== null) {
      return participant
    } else {
      // finalRankがnullの場合は現在の点数をfinalPointsとして使用
      return {
        ...participant,
        finalPoints: participant.currentPoints,
        finalRank: 0, // 後で計算
        uma: 0,
        settlement: participant.currentPoints - 25000
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
    playerId: participant.playerId,
    name: participant.player.name,
    finalPoints: participant.finalPoints || participant.currentPoints,
    rank: participant.finalRank || participant.calculatedRank,
    uma: participant.uma || 0,
    settlement: participant.settlement || (participant.finalPoints || participant.currentPoints) - 25000
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
    gameMode: 'MULTIPLAYER',
    gameType: game.settings?.gameType || game.gameType,
    endReason,
    endedAt: game.endedAt?.toISOString() || new Date().toISOString(),
    basePoints: game.settings?.basePoints || 30000,
    sessionId: game.sessionId,
    sessionCode: game.session?.sessionCode,
    sessionName: game.session?.name,
    hostPlayerId: game.session?.hostPlayerId,
    nextGame
  }

  return createSuccessResponse(resultData)
}

/**
 * ソロプレイゲームの結果処理
 */
async function processSoloResult(game: any, gameId: string) {
  if (game.status !== 'FINISHED') {
    throw new AppError('GAME_NOT_FINISHED', 'ゲームが終了していません', { status: game.status }, 400)
  }

  console.log('Solo game result query:', { gameId, game: { 
    id: game.id, 
    status: game.status, 
    players: game.players.map((p: any) => ({
      position: p.position,
      name: p.name,
      currentPoints: p.currentPoints,
      finalPoints: p.finalPoints,
      finalRank: p.finalRank,
      uma: p.uma,
      settlement: p.settlement
    }))
  } })

  // 結果データを整形
  // finalRankがnullの場合は現在の点数で順位を計算
  const basePoints = game.initialPoints || 25000
  const playersWithRank = game.players.map((player: any) => {
    if (player.finalRank !== null && player.finalPoints !== null) {
      return player
    } else {
      // finalRankがnullの場合は現在の点数をfinalPointsとして使用
      return {
        ...player,
        finalPoints: player.currentPoints,
        finalRank: 0, // 後で計算
        uma: 0,
        settlement: player.currentPoints - basePoints
      }
    }
  })

  // 現在の点数で順位を計算
  const sortedByPoints = playersWithRank
    .sort((a: any, b: any) => (b.finalPoints || b.currentPoints) - (a.finalPoints || a.currentPoints))
    .map((player: any, index: number) => ({
      ...player,
      calculatedRank: index + 1
    }))

  // ウマ計算（簡易版）
  const uma = [15000, 5000, -5000, -15000] // +15/+5/-5/-15

  const results = sortedByPoints.map((player: any) => {
    const rank = player.finalRank || player.calculatedRank
    const finalPoints = player.finalPoints || player.currentPoints
    const umaValue = uma[rank - 1] || 0
    const settlement = (finalPoints - basePoints) + umaValue

    return {
      playerId: player.position.toString(),
      name: player.name,
      finalPoints,
      rank,
      uma: umaValue,
      settlement
    }
  })

  console.log('Processed solo results:', results)

  // 終了理由を取得（最後のGAME_ENDイベントから）
  const endEvent = await prisma.soloGameEvent.findFirst({
    where: {
      soloGameId: gameId,
      eventType: 'GAME_END'
    },
    orderBy: { createdAt: 'desc' }
  })

  const endReason = endEvent?.eventData ? 
    (typeof endEvent.eventData === 'object' && endEvent.eventData !== null && 'reason' in endEvent.eventData ? 
      (endEvent.eventData as any).reason : '終了') : '終了'

  const resultData = {
    gameId: game.id,
    roomCode: `SOLO-${game.id}`, // ソロプレイ用の固定値
    results,
    gameMode: 'SOLO',
    gameType: 'HANCHAN' as const, // ソロプレイのデフォルト
    endReason,
    endedAt: game.endedAt?.toISOString() || new Date().toISOString(),
    basePoints, // 実際のゲームの初期点数を使用
    // セッション関連は全てundefined（ソロプレイには不要）
    sessionId: undefined,
    sessionCode: undefined,
    sessionName: undefined,
    hostPlayerId: undefined,
    nextGame: null
  }

  return createSuccessResponse(resultData)
}