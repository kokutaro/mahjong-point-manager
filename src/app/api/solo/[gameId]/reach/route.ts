import { NextRequest, NextResponse } from 'next/server'
import { declareSoloReach } from '@/lib/solo/score-manager'
import { SoloReachSchema } from '@/schemas/solo'

export async function POST(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const { gameId } = params
    const body = await request.json()

    if (!gameId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_GAME_ID',
          message: 'ゲームIDが必要です'
        }
      }, { status: 400 })
    }

    // バリデーション
    const validation = SoloReachSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力データが無効です',
          details: validation.error.errors
        }
      }, { status: 400 })
    }

    const { position, round } = validation.data

    // ゲーム状態を事前チェック
    const { prisma } = await import('@/lib/prisma')
    const game = await prisma.soloGame.findUnique({
      where: { id: gameId },
      include: { 
        players: {
          where: { position }
        }
      }
    })

    if (!game) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'GAME_NOT_FOUND',
          message: 'ゲームが見つかりません'
        }
      }, { status: 404 })
    }

    if (game.status !== 'PLAYING') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'GAME_NOT_PLAYING',
          message: 'ゲームが進行中ではありません'
        }
      }, { status: 400 })
    }

    const player = game.players[0]
    if (!player) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: '指定された位置のプレイヤーが見つかりません'
        }
      }, { status: 400 })
    }

    if (player.isReach) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ALREADY_REACH',
          message: 'このプレイヤーは既にリーチしています'
        }
      }, { status: 400 })
    }

    if (player.currentPoints < 1000) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INSUFFICIENT_POINTS',
          message: 'リーチ宣言には1000点が必要です'
        }
      }, { status: 400 })
    }

    // リーチ宣言処理
    const gameState = await declareSoloReach(gameId, position, round)

    return NextResponse.json({
      success: true,
      data: {
        gameState,
        message: `${player.name}がリーチしました`
      }
    })

  } catch (error) {
    console.error('Solo reach declaration error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'リーチ宣言に失敗しました'
      }
    }, { status: 500 })
  }
}