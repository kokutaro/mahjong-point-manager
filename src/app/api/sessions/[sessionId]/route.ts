import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// ゲーム結果の型定義
type GameResultItem = {
  playerId: string
  settlement: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    // セッション詳細とゲーム履歴を取得
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        hostPlayer: {
          select: { id: true, name: true }
        },
        settings: true,
        participants: {
          include: {
            player: {
              select: { id: true, name: true }
            }
          },
          orderBy: { position: 'asc' }
        },
        games: {
          include: {
            participants: {
              include: {
                player: {
                  select: { id: true, name: true }
                }
              },
              orderBy: { position: 'asc' }
            },
            settings: true
          },
          orderBy: { sessionOrder: 'asc' }
        }
      }
    })

    if (!session) {
      return NextResponse.json({
        success: false,
        error: { message: 'セッションが見つかりません' }
      }, { status: 404 })
    }

    // このセッションに関連する全てのGameResultを取得
    const allGameIds = session.games.map(game => game.id)
    const gameResultsData = await prisma.gameResult.findMany({
      where: { gameId: { in: allGameIds } }
    })

    // GameResultが存在するゲームのみを対象に対局履歴を作成
    const gameResults = gameResultsData
      .map((gameResult) => {
        const game = session.games.find(g => g.id === gameResult.gameId)
        if (!game) return null
        
        const gameNumber = game.sessionOrder || 1
        const playerResults: Record<string, number> = {}
        
        // GameResultから精算額を取得
        if (Array.isArray(gameResult.results)) {
          (gameResult.results as GameResultItem[]).forEach((result) => {
            if (result.playerId && result.settlement !== undefined) {
              playerResults[result.playerId] = result.settlement
            }
          })
        }

        return {
          gameNumber,
          gameId: game.id,
          gameType: game.settings?.gameType || 'HANCHAN',
          endedAt: game.endedAt,
          results: playerResults
        }
      })
      .filter(Boolean) // null値を除外
      .sort((a, b) => a!.gameNumber - b!.gameNumber) // ゲーム番号順にソート

    // セッション参加者の順序でプレイヤー情報を整理
    const players = session.participants.map(participant => ({
      playerId: participant.playerId,
      name: participant.player.name,
      position: participant.position,
      totalGames: participant.totalGames,
      totalSettlement: participant.totalSettlement,
      firstPlace: participant.firstPlace,
      secondPlace: participant.secondPlace,
      thirdPlace: participant.thirdPlace,
      fourthPlace: participant.fourthPlace
    }))

    // 合計行の計算
    const totalRow = players.reduce((acc, player) => {
      acc[player.playerId] = gameResults.reduce((sum, game) => 
        sum + (game?.results[player.playerId] || 0), 0
      )
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          sessionCode: session.sessionCode,
          name: session.name,
          status: session.status,
          createdAt: session.createdAt,
          endedAt: session.endedAt,
          hostPlayer: session.hostPlayer
        },
        players,
        gameResults,
        totalRow,
        settings: session.settings
      }
    })

  } catch (error) {
    console.error('Session details API error:', error)
    return NextResponse.json({
      success: false,
      error: {
        message: 'セッション詳細の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}