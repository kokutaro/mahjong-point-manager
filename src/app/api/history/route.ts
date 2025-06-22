import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Enable caching for GET requests
export const revalidate = 60 // Cache for 60 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('playerId')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const gameType = searchParams.get('gameType') // 'TONPUU' | 'HANCHAN'

    // 基本的なクエリ条件
    const whereCondition: any = {
      status: 'FINISHED',
      endedAt: { not: null }
    }

    // 特定プレイヤーの履歴の場合
    if (playerId) {
      whereCondition.participants = {
        some: {
          playerId: playerId
        }
      }
    }

    // ゲームタイプフィルター
    if (gameType) {
      whereCondition.settings = {
        gameType: gameType
      }
    }

    // 対局履歴取得
    const games = await prisma.game.findMany({
      where: whereCondition,
      include: {
        settings: {
          select: {
            gameType: true,
            initialPoints: true,
            basePoints: true,
            uma: true,
            oka: true
          }
        },
        participants: {
          include: {
            player: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            finalRank: 'asc'
          }
        },
        result: {
          select: {
            results: true
          }
        }
      },
      orderBy: {
        endedAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // 総件数取得
    const totalCount = await prisma.game.count({
      where: whereCondition
    })

    // レスポンス用データ整形
    const formattedGames = games.map(game => ({
      id: game.id,
      roomCode: game.roomCode,
      gameType: game.settings?.gameType || 'HANCHAN',
      startedAt: game.createdAt,
      endedAt: game.endedAt,
      duration: game.endedAt && game.createdAt 
        ? Math.round((game.endedAt.getTime() - game.createdAt.getTime()) / (1000 * 60)) // 分単位
        : null,
      players: game.participants.map(p => ({
        playerId: p.player.id,
        name: p.player.name,
        position: p.position,
        finalPoints: p.finalPoints,
        finalRank: p.finalRank,
        uma: p.uma,
        oka: p.oka,
        settlement: p.settlement
      })),
      settings: {
        gameType: game.settings?.gameType,
        initialPoints: game.settings?.initialPoints,
        basePoints: game.settings?.basePoints,
        uma: game.settings?.uma,
        oka: game.settings?.oka
      }
    }))

    const response = NextResponse.json({
      success: true,
      data: {
        games: formattedGames,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      }
    })

    // Add cache headers for better performance
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    
    return response

  } catch (error) {
    console.error('History API error:', error)
    return NextResponse.json({
      success: false,
      error: {
        message: '履歴の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}