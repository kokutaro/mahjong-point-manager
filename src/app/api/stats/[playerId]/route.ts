import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    const gameType = searchParams.get('gameType') // 'TONPUU' | 'HANCHAN'

    // 基本的なクエリ条件
    const whereCondition: any = {
      playerId: playerId,
      game: {
        status: 'FINISHED',
        endedAt: { not: null }
      }
    }

    // ゲームタイプフィルター
    if (gameType) {
      whereCondition.game.settings = {
        gameType: gameType
      }
    }

    // 参加した対局を取得
    const participations = await prisma.gameParticipant.findMany({
      where: whereCondition,
      include: {
        player: {
          select: {
            id: true,
            name: true
          }
        },
        game: {
          select: {
            id: true,
            endedAt: true,
            settings: {
              select: {
                gameType: true
              }
            }
          }
        }
      },
      orderBy: {
        game: {
          endedAt: 'desc'
        }
      }
    })

    if (participations.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          playerId,
          playerName: '',
          totalGames: 0,
          winRate: 0,
          averageRank: 0,
          averagePoints: 0,
          totalSettlement: 0,
          rankDistribution: { 1: 0, 2: 0, 3: 0, 4: 0 },
          gameTypeStats: {},
          recentGames: []
        }
      })
    }

    // 基本統計計算
    const totalGames = participations.length
    const playerName = participations[0].player.name

    // 順位分布
    const rankDistribution = { 1: 0, 2: 0, 3: 0, 4: 0 }
    let totalRank = 0
    let totalPoints = 0
    let totalSettlement = 0

    participations.forEach(p => {
      if (p.finalRank) {
        rankDistribution[p.finalRank as keyof typeof rankDistribution]++
        totalRank += p.finalRank
      }
      if (p.finalPoints) {
        totalPoints += p.finalPoints
      }
      if (p.settlement) {
        totalSettlement += p.settlement
      }
    })

    // 勝率（1位率）
    const winRate = totalGames > 0 ? (rankDistribution[1] / totalGames) * 100 : 0

    // 平均順位
    const averageRank = totalGames > 0 ? totalRank / totalGames : 0

    // 平均点数
    const averagePoints = totalGames > 0 ? Math.round(totalPoints / totalGames) : 0

    // ゲームタイプ別統計
    const gameTypeStats: Record<string, any> = {}
    const gameTypeGroups = participations.reduce((acc, p) => {
      const type = p.game.settings?.gameType || 'HANCHAN'
      if (!acc[type]) acc[type] = []
      acc[type].push(p)
      return acc
    }, {} as Record<string, typeof participations>)

    Object.entries(gameTypeGroups).forEach(([type, games]) => {
      const typeRankDistribution = { 1: 0, 2: 0, 3: 0, 4: 0 }
      let typeRankTotal = 0
      let typeSettlementTotal = 0

      games.forEach(g => {
        if (g.finalRank) {
          typeRankDistribution[g.finalRank as keyof typeof typeRankDistribution]++
          typeRankTotal += g.finalRank
        }
        if (g.settlement) {
          typeSettlementTotal += g.settlement
        }
      })

      gameTypeStats[type] = {
        totalGames: games.length,
        winRate: games.length > 0 ? (typeRankDistribution[1] / games.length) * 100 : 0,
        averageRank: games.length > 0 ? typeRankTotal / games.length : 0,
        totalSettlement: typeSettlementTotal,
        rankDistribution: typeRankDistribution
      }
    })

    // 最近の対局（最新5件）
    const recentGames = participations.slice(0, 5).map(p => ({
      gameId: p.game.id,
      endedAt: p.game.endedAt,
      gameType: p.game.settings?.gameType,
      rank: p.finalRank,
      points: p.finalPoints,
      settlement: p.settlement
    }))

    // 月別統計（過去12ヶ月）
    const monthlyStats: Record<string, { games: number; wins: number; totalSettlement: number }> = {}
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    participations
      .filter(p => p.game.endedAt && p.game.endedAt >= twelveMonthsAgo)
      .forEach(p => {
        if (p.game.endedAt) {
          const monthKey = `${p.game.endedAt.getFullYear()}-${String(p.game.endedAt.getMonth() + 1).padStart(2, '0')}`
          if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = { games: 0, wins: 0, totalSettlement: 0 }
          }
          monthlyStats[monthKey].games++
          if (p.finalRank === 1) {
            monthlyStats[monthKey].wins++
          }
          if (p.settlement) {
            monthlyStats[monthKey].totalSettlement += p.settlement
          }
        }
      })

    return NextResponse.json({
      success: true,
      data: {
        playerId,
        playerName,
        totalGames,
        winRate: Math.round(winRate * 100) / 100,
        averageRank: Math.round(averageRank * 100) / 100,
        averagePoints,
        totalSettlement,
        rankDistribution,
        gameTypeStats,
        recentGames,
        monthlyStats
      }
    })

  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json({
      success: false,
      error: {
        message: '統計の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}