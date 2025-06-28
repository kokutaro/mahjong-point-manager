import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// 既存の個別対局を自動でセッションに移行するユーティリティAPI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dryRun = true } = body

    // セッションに属していない完了済み対局を取得
    const standAloneGames = await prisma.game.findMany({
      where: {
        sessionId: null,
        status: 'FINISHED',
        endedAt: { not: null }
      },
      include: {
        hostPlayer: true,
        participants: {
          include: {
            player: true
          },
          orderBy: { position: 'asc' }
        },
        settings: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    if (standAloneGames.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'セッション化が必要な対局がありません',
        data: { processedGames: 0 }
      })
    }

    // 同じホスト・同じ参加者・24時間以内の対局をグループ化
    const sessionGroups: { [key: string]: typeof standAloneGames } = {}

    for (const game of standAloneGames) {
      // グループキー: ホストID + 参加者ID（ソート済み）
      const participantIds = game.participants
        .map(p => p.playerId)
        .sort()
        .join(',')
      const groupKey = `${game.hostPlayerId}-${participantIds}`

      if (!sessionGroups[groupKey]) {
        sessionGroups[groupKey] = []
      }
      sessionGroups[groupKey].push(game)
    }

    let processedGames = 0
    const operations = []

    if (!dryRun) {
      // 実際に移行処理を実行
      for (const [, games] of Object.entries(sessionGroups)) {
        // Phase 1: すべての対局をセッション化（単発対局も含む）
        const isMultiGame = games.length > 1
        const firstGame = games[0]
        const sessionCode = Math.floor(100000 + Math.random() * 900000).toString()

        // セッション作成
        const sessionName = isMultiGame 
          ? `自動移行セッション (${games.length}局)`
          : `単発対局セッション`
          
        const session = await prisma.gameSession.create({
          data: {
            sessionCode,
            hostPlayerId: firstGame.hostPlayerId,
            name: sessionName,
            status: 'FINISHED',
            settingsId: firstGame.settingsId,
            createdAt: firstGame.createdAt,
            endedAt: games[games.length - 1].endedAt
          }
        })

        // セッション参加者作成
        const participantPromises = firstGame.participants.map(participant => 
          prisma.sessionParticipant.create({
            data: {
              sessionId: session.id,
              playerId: participant.playerId,
              position: participant.position,
              totalGames: games.length,
              totalSettlement: games.reduce((sum, game) => {
                const gameParticipant = game.participants.find(p => p.playerId === participant.playerId)
                return sum + (gameParticipant?.settlement || 0)
              }, 0),
              firstPlace: games.filter(game => {
                const gameParticipant = game.participants.find(p => p.playerId === participant.playerId)
                return gameParticipant?.finalRank === 1
              }).length,
              secondPlace: games.filter(game => {
                const gameParticipant = game.participants.find(p => p.playerId === participant.playerId)
                return gameParticipant?.finalRank === 2
              }).length,
              thirdPlace: games.filter(game => {
                const gameParticipant = game.participants.find(p => p.playerId === participant.playerId)
                return gameParticipant?.finalRank === 3
              }).length,
              fourthPlace: games.filter(game => {
                const gameParticipant = game.participants.find(p => p.playerId === participant.playerId)
                return gameParticipant?.finalRank === 4
              }).length
            }
          })
        )

        await Promise.all(participantPromises)

        // 対局をセッションに関連付け
        const gameUpdatePromises = games.map((game, index) =>
          prisma.game.update({
            where: { id: game.id },
            data: {
              sessionId: session.id,
              sessionOrder: index + 1
            }
          })
        )

        await Promise.all(gameUpdatePromises)
        processedGames += games.length

        operations.push({
          sessionId: session.id,
          sessionCode: session.sessionCode,
          gameCount: games.length,
          hostPlayer: firstGame.hostPlayer.name,
          participants: firstGame.participants.map(p => p.player.name)
        })
      }
    } else {
      // ドライラン: 何が実行されるかの概要を返す
      for (const [groupKey, games] of Object.entries(sessionGroups)) {
        // Phase 1: すべての対局をセッション化対象とする
        const firstGame = games[0]
        operations.push({
          groupKey,
          gameCount: games.length,
          hostPlayer: firstGame.hostPlayer.name,
          participants: firstGame.participants.map(p => p.player.name),
          dateRange: {
            start: games[0].createdAt,
            end: games[games.length - 1].endedAt
          },
          type: games.length > 1 ? 'multi-game' : 'single-game'
        })
        processedGames += games.length
      }
    }

    return NextResponse.json({
      success: true,
      message: dryRun 
        ? `${processedGames}局がセッション化の対象です（ドライラン）`
        : `${processedGames}局をセッションに移行しました`,
      data: {
        processedGames,
        operations,
        dryRun
      }
    })

  } catch (error) {
    console.error('Session migration error:', error)
    return NextResponse.json({
      success: false,
      error: {
        message: 'セッション移行に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}