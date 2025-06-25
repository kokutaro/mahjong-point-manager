import { NextRequest, NextResponse } from 'next/server'
import { getSoloGameState } from '@/lib/solo/score-manager'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params

    if (!gameId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_GAME_ID',
          message: 'ゲームIDが必要です'
        }
      }, { status: 400 })
    }

    // ゲーム状態を取得
    const gameState = await getSoloGameState(gameId)

    return NextResponse.json({
      success: true,
      data: gameState
    })

  } catch (error) {
    console.error('Solo game state fetch error:', error)
    
    if (error instanceof Error && error.message === 'ゲームが見つかりません') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'GAME_NOT_FOUND',
          message: 'ゲームが見つかりません'
        }
      }, { status: 404 })
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'ゲーム状態の取得に失敗しました'
      }
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params
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

    // ゲーム開始
    if (body.action === 'start') {
      const { prisma } = await import('@/lib/prisma')
      
      await prisma.soloGame.update({
        where: { id: gameId },
        data: { 
          status: 'PLAYING',
          startedAt: new Date()
        }
      })

      const gameState = await getSoloGameState(gameId)

      return NextResponse.json({
        success: true,
        data: gameState
      })
    }

    // ゲーム終了
    if (body.action === 'finish') {
      const { prisma } = await import('@/lib/prisma')
      
      const game = await prisma.soloGame.findUnique({
        where: { id: gameId },
        include: { players: true }
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

      // 最終順位と精算を計算
      const sortedPlayers = [...game.players].sort((a, b) => b.currentPoints - a.currentPoints)
      const basePoints = game.initialPoints || 25000
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
            round: game.currentRound,
            honba: game.honba,
            eventData: {
              finalResults: results
            }
          }
        })
      })

      return NextResponse.json({
        success: true,
        data: {
          gameId,
          status: 'FINISHED',
          results
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INVALID_ACTION',
        message: '無効なアクションです'
      }
    }, { status: 400 })

  } catch (error) {
    console.error('Solo game update error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'ゲーム更新に失敗しました'
      }
    }, { status: 500 })
  }
}