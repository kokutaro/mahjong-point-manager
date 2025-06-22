import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params

    // ゲーム情報と結果を取得
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: 'asc' }
        },
        result: true
      }
    })

    console.log('Game result query:', { gameId, game: game ? { 
      id: game.id, 
      status: game.status, 
      participants: game.participants.map(p => ({
        playerId: p.playerId,
        name: p.player.name,
        finalPoints: p.finalPoints,
        finalRank: p.finalRank,
        uma: p.uma,
        oka: p.oka,
        settlement: p.settlement
      }))
    } : null })

    if (!game) {
      return NextResponse.json({
        success: false,
        error: { message: 'ゲームが見つかりません' }
      }, { status: 404 })
    }

    if (game.status !== 'FINISHED') {
      return NextResponse.json({
        success: false,
        error: { message: 'ゲームが終了していません' }
      }, { status: 400 })
    }

    // 結果データを整形
    // finalRankがnullの場合は現在の点数で順位を計算
    const participantsWithRank = game.participants.map(participant => {
      if (participant.finalRank !== null) {
        return participant
      } else {
        // finalRankがnullの場合は現在の点数をfinalPointsとして使用
        return {
          ...participant,
          finalPoints: participant.currentPoints,
          finalRank: 0, // 後で計算
          uma: 0,
          oka: 0,
          settlement: participant.currentPoints - 25000
        }
      }
    })

    // 現在の点数で順位を計算
    const sortedByPoints = participantsWithRank
      .sort((a, b) => (b.finalPoints || b.currentPoints) - (a.finalPoints || a.currentPoints))
      .map((participant, index) => ({
        ...participant,
        calculatedRank: index + 1
      }))

    const results = sortedByPoints.map(participant => ({
      playerId: participant.playerId,
      name: participant.player.name,
      finalPoints: participant.finalPoints || participant.currentPoints,
      rank: participant.finalRank || participant.calculatedRank,
      uma: participant.uma || 0,
      oka: participant.oka || 0,
      settlement: participant.settlement || (participant.finalPoints || participant.currentPoints) - 25000
    }))

    console.log('Processed results:', results)

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

    const resultData = {
      gameId: game.id,
      results,
      gameType: game.gameType,
      endReason,
      endedAt: game.endedAt?.toISOString() || new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: resultData
    })

  } catch (error) {
    console.error('Get game result failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: '結果の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}