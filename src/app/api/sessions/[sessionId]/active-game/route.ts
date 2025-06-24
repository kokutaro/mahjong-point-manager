import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    // まず進行中もしくは待機中の対局を取得
    let game = await prisma.game.findFirst({
      where: {
        sessionId,
        status: { in: ['WAITING', 'PLAYING'] }
      },
      orderBy: { sessionOrder: 'desc' }
    })

    // 進行中の対局がない場合は最後に終了した対局を取得
    if (!game) {
      game = await prisma.game.findFirst({
        where: {
          sessionId,
          status: 'FINISHED'
        },
        orderBy: { sessionOrder: 'desc' }
      })
    }

    if (!game) {
      return NextResponse.json(
        { success: false, error: { message: 'Active game not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        gameId: game.id,
        roomCode: game.roomCode,
        status: game.status
      }
    })
  } catch (error) {
    console.error('Active game fetch failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to fetch active game',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}
