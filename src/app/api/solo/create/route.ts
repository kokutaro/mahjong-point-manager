import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CreateSoloGameSchema, DEFAULT_PLAYER_NAMES, validatePlayerNames, validatePlayerPositions } from '@/schemas/solo'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // バリデーション
    const validation = CreateSoloGameSchema.safeParse(body)
    
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

    const { gameType, initialPoints, players } = validation.data

    // プレイヤー名の重複チェック
    if (!validatePlayerNames(players)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DUPLICATE_NAMES',
          message: 'プレイヤー名が重複しています'
        }
      }, { status: 400 })
    }

    // プレイヤー位置の妥当性チェック
    if (!validatePlayerPositions(players)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_POSITIONS',
          message: 'プレイヤーの位置が無効です'
        }
      }, { status: 400 })
    }

    // ユーザー情報の取得（簡易的に Cookie から取得）
    const userCookie = request.cookies.get('auth-user')
    if (!userCookie) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'ログインが必要です'
        }
      }, { status: 401 })
    }

    const userData = JSON.parse(userCookie.value)
    const hostPlayerId = userData.id

    // データベーストランザクション
    const result = await prisma.$transaction(async (tx) => {
      // ソロゲーム作成
      const soloGame = await tx.soloGame.create({
        data: {
          hostPlayerId,
          gameType,
          initialPoints,
          status: 'WAITING'
        }
      })

      // ソロプレイヤー作成
      const soloPlayers = await Promise.all(
        players.map(player => 
          tx.soloPlayer.create({
            data: {
              soloGameId: soloGame.id,
              position: player.position,
              name: player.name,
              currentPoints: initialPoints
            }
          })
        )
      )

      // ゲーム開始イベントを記録
      await tx.soloGameEvent.create({
        data: {
          soloGameId: soloGame.id,
          eventType: 'GAME_START',
          round: 1,
          honba: 0,
          eventData: {
            gameType,
            initialPoints,
            players: soloPlayers.map(p => ({
              position: p.position,
              name: p.name,
              initialPoints: p.currentPoints
            }))
          }
        }
      })

      return {
        soloGame,
        soloPlayers
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        gameId: result.soloGame.id,
        gameType: result.soloGame.gameType,
        initialPoints: result.soloGame.initialPoints,
        players: result.soloPlayers.map(p => ({
          position: p.position,
          name: p.name,
          currentPoints: p.currentPoints,
          isReach: p.isReach
        })),
        status: result.soloGame.status,
        currentOya: result.soloGame.currentOya,
        currentRound: result.soloGame.currentRound,
        honba: result.soloGame.honba,
        kyotaku: result.soloGame.kyotaku
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Solo game creation error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'ソロゲーム作成に失敗しました'
      }
    }, { status: 500 })
  }
}