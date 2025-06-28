import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSoloGameState } from '@/lib/solo/score-manager'
import { 
  withErrorHandler, 
  createSuccessResponse, 
  GameNotFoundError,
  AppError
} from '@/lib/error-handler'

/**
 * ゲーム状態取得（統合版）
 * マルチプレイとソロプレイの両方に対応
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await params

  console.log('Fetching unified game state for gameId:', gameId)

  // まずマルチプレイのゲームを確認
  const multiGame = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      participants: {
        include: { player: true },
        orderBy: { position: 'asc' }
      },
      settings: true
    }
  })

  if (multiGame) {
    console.log('Found multiplayer game:', { id: multiGame.id, status: multiGame.status, participantsCount: multiGame.participants.length })

    // マルチプレイゲームの状態を構築
    const gameState = {
      gameId: multiGame.id,
      gameMode: 'MULTIPLAYER' as const,
      players: multiGame.participants.map(p => ({
        playerId: p.playerId,
        name: p.player.name,
        position: p.position,
        points: p.currentPoints,
        isReach: p.isReach,
        isConnected: true // WebSocket接続状態は別途管理
      })),
      currentRound: multiGame.currentRound,
      currentOya: multiGame.currentOya,
      honba: multiGame.honba,
      kyotaku: multiGame.kyotaku,
      gamePhase: multiGame.status === 'PLAYING' ? 'playing' as const : 
                 multiGame.status === 'FINISHED' ? 'finished' as const : 'waiting' as const
    }

    return createSuccessResponse({
      gameState,
      gameInfo: {
        id: multiGame.id,
        roomCode: multiGame.roomCode,
        status: multiGame.status,
        sessionId: multiGame.sessionId,
        gameMode: 'MULTIPLAYER',
        createdAt: multiGame.createdAt,
        startedAt: multiGame.startedAt,
        endedAt: multiGame.endedAt,
        settings: multiGame.settings
      }
    })
  }

  // ソロプレイのゲームを確認
  const soloGame = await prisma.soloGame.findUnique({
    where: { id: gameId },
    include: {
      players: {
        orderBy: { position: 'asc' }
      }
    }
  })

  if (soloGame) {
    console.log('Found solo game:', { id: soloGame.id, status: soloGame.status, playersCount: soloGame.players.length })

    // ソロゲームの詳細状態を取得
    const soloGameState = await getSoloGameState(gameId)

    return createSuccessResponse({
      gameState: {
        ...soloGameState,
        gameMode: 'SOLO' as const
      },
      gameInfo: {
        id: soloGame.id,
        roomCode: `SOLO-${soloGame.id}`,
        status: soloGame.status,
        sessionId: null,
        gameMode: 'SOLO',
        createdAt: soloGame.createdAt,
        startedAt: soloGame.startedAt,
        endedAt: soloGame.endedAt,
        settings: {
          gameType: soloGame.gameType,
          basePoints: soloGame.initialPoints || 25000
        }
      }
    })
  }

  // どちらのゲームも見つからない場合
  throw new GameNotFoundError(gameId)
}, 'ゲーム状態の取得に失敗しました')

/**
 * ゲーム操作（統合版）
 * ソロプレイのゲーム開始・終了処理
 */
export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await params
  const body = await request.json()

  // まずソロプレイのゲームかどうか確認
  const soloGame = await prisma.soloGame.findUnique({
    where: { id: gameId },
    include: { players: true }
  })

  if (!soloGame) {
    // マルチプレイゲームでPATCH操作を試みた場合
    const multiGame = await prisma.game.findUnique({ where: { id: gameId } })
    if (multiGame) {
      throw new AppError('INVALID_ACTION', 'マルチプレイゲームでは直接的なゲーム操作はサポートされていません', { gameMode: 'MULTIPLAYER' }, 400)
    }
    throw new GameNotFoundError(gameId)
  }

  // ゲーム開始
  if (body.action === 'start') {
    await prisma.soloGame.update({
      where: { id: gameId },
      data: { 
        status: 'PLAYING',
        startedAt: new Date()
      }
    })

    const gameState = await getSoloGameState(gameId)

    return createSuccessResponse({
      ...gameState,
      gameMode: 'SOLO'
    })
  }

  // ゲーム終了
  if (body.action === 'finish') {
    // 最終順位と精算を計算
    const sortedPlayers = [...soloGame.players].sort((a, b) => b.currentPoints - a.currentPoints)
    const basePoints = soloGame.initialPoints || 25000
    const uma = [15, 5, -5, -15] // 簡単なウマ設定

    const results = sortedPlayers.map((player, index) => {
      const rank = index + 1
      const rawScore = player.currentPoints - basePoints
      const umaScore = uma[index] * 1000
      const settlement = rawScore + umaScore

      return {
        position: player.position,
        name: player.name,
        finalPoints: player.currentPoints,
        rank,
        rawScore,
        uma: umaScore,
        settlement
      }
    })

    // ゲーム結果を保存
    await prisma.$transaction(async (tx) => {
      await tx.soloGame.update({
        where: { id: gameId },
        data: { 
          status: 'FINISHED',
          endedAt: new Date()
        }
      })

      // プレイヤーの最終結果を更新
      for (const result of results) {
        await tx.soloPlayer.updateMany({
          where: {
            soloGameId: gameId,
            position: result.position
          },
          data: {
            finalPoints: result.finalPoints,
            finalRank: result.rank,
            uma: result.uma,
            settlement: result.settlement
          }
        })
      }

      // 結果を保存
      await tx.soloGameResult.create({
        data: {
          soloGameId: gameId,
          results: {
            players: results,
            basePoints,
            uma,
            endedAt: new Date()
          }
        }
      })

      // ゲーム終了イベントを記録
      await tx.soloGameEvent.create({
        data: {
          soloGameId: gameId,
          eventType: 'GAME_END',
          round: soloGame.currentRound,
          honba: soloGame.honba,
          eventData: {
            finalResults: results
          }
        }
      })
    })

    return createSuccessResponse({
      gameId,
      gameMode: 'SOLO',
      status: 'FINISHED',
      results
    })
  }

  throw new AppError('INVALID_ACTION', '無効なアクションです', { action: body.action }, 400)
}, 'ゲーム操作に失敗しました')

/**
 * ゲーム強制終了（統合版）
 * ソロプレイとマルチプレイの両方に対応
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await params
  const body = await request.json()
  
  // 理由の取得
  const reason = body.reason || '強制終了'

  console.log('Processing unified force-end for gameId:', gameId, 'reason:', reason)

  // まずマルチプレイゲームかどうか確認
  const multiGame = await prisma.game.findUnique({
    where: { id: gameId },
    include: { participants: true }
  })

  if (multiGame) {
    // マルチプレイゲームの強制終了処理
    console.log('Processing as multiplayer force-end')
    
    if (multiGame.status === 'FINISHED') {
      throw new AppError('GAME_NOT_PLAYING', 'ゲームが既に終了しています', {}, 400)
    }

    // マルチプレイゲームを強制終了
    await prisma.$transaction(async (tx) => {
      await tx.game.update({
        where: { id: gameId },
        data: {
          status: 'FINISHED',
          endedAt: new Date()
        }
      })

      // 最終順位と精算を計算（現在の点数ベース）
      const participants = multiGame.participants.sort((a, b) => b.currentPoints - a.currentPoints)
      const basePoints = 30000 // マルチプレイのデフォルト
      const uma = [15000, 5000, -5000, -15000]

      for (let i = 0; i < participants.length; i++) {
        const participant = participants[i]
        const rank = i + 1
        const settlement = (participant.currentPoints - basePoints) + (uma[i] || 0)

        await tx.gameParticipant.update({
          where: { id: participant.id },
          data: {
            finalPoints: participant.currentPoints,
            finalRank: rank,
            uma: uma[i] || 0,
            settlement
          }
        })
      }

      // 強制終了イベントを記録
      await tx.gameEvent.create({
        data: {
          gameId,
          eventType: 'GAME_END',
          round: multiGame.currentRound,
          honba: multiGame.honba,
          eventData: {
            reason,
            forceEnded: true
          }
        }
      })
    })

    return createSuccessResponse({
      gameId,
      gameMode: 'MULTIPLAYER',
      status: 'FINISHED',
      reason,
      message: `マルチプレイゲームが強制終了されました: ${reason}`
    })
  }

  // ソロプレイゲームかどうか確認
  const soloGame = await prisma.soloGame.findUnique({
    where: { id: gameId },
    include: { players: true }
  })

  if (soloGame) {
    console.log('Processing as solo force-end')
    
    if (soloGame.status === 'FINISHED') {
      throw new AppError('GAME_NOT_PLAYING', 'ゲームが既に終了しています', {}, 400)
    }

    // ソロゲームを強制終了
    await prisma.$transaction(async (tx) => {
      await tx.soloGame.update({
        where: { id: gameId },
        data: {
          status: 'FINISHED',
          endedAt: new Date()
        }
      })

      // 最終順位と精算を計算（現在の点数ベース）
      const sortedPlayers = [...soloGame.players].sort((a, b) => b.currentPoints - a.currentPoints)
      const basePoints = soloGame.initialPoints || 25000
      const uma = [15000, 5000, -5000, -15000]

      const results = sortedPlayers.map((player, index) => {
        const rank = index + 1
        const umaValue = uma[index] || 0
        const settlement = (player.currentPoints - basePoints) + umaValue

        return {
          position: player.position,
          name: player.name,
          finalPoints: player.currentPoints,
          rank,
          uma: umaValue,
          settlement
        }
      })

      // プレイヤーの最終結果を更新
      for (const result of results) {
        await tx.soloPlayer.updateMany({
          where: {
            soloGameId: gameId,
            position: result.position
          },
          data: {
            finalPoints: result.finalPoints,
            finalRank: result.rank,
            uma: result.uma,
            settlement: result.settlement
          }
        })
      }

      // 強制終了イベントを記録
      await tx.soloGameEvent.create({
        data: {
          soloGameId: gameId,
          eventType: 'GAME_END',
          round: soloGame.currentRound,
          honba: soloGame.honba,
          eventData: {
            reason,
            forceEnded: true,
            finalResults: results
          }
        }
      })
    })

    return createSuccessResponse({
      gameId,
      gameMode: 'SOLO',
      status: 'FINISHED',
      reason,
      message: `ソロプレイゲームが強制終了されました: ${reason}`
    })
  }

  throw new GameNotFoundError(gameId)
}, 'ゲーム強制終了に失敗しました')