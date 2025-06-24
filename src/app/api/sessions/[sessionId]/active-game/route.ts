import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    const game = await prisma.game.findFirst({
      where: {
        sessionId,
        status: { in: ['WAITING', 'PLAYING'] }
      },
      orderBy: { sessionOrder: 'desc' }
    })

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
