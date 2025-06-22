import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const createRoomSchema = z.object({
  hostPlayerName: z.string().min(1).max(20),
  gameType: z.enum(['TONPUU', 'HANCHAN']).default('HANCHAN'),
  initialPoints: z.number().int().min(20000).max(50000).default(25000),
  basePoints: z.number().int().min(20000).max(50000).default(30000),
  hasTobi: z.boolean().default(true),
  uma: z.array(z.number()).length(4).default([20, 10, -10, -20]),
  oka: z.number().default(0)
})

// 6桁のランダムルームコード生成
function generateRoomCode(): string {
  return Math.random().toString(36).substr(2, 6).toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createRoomSchema.parse(body)

    // ユニークなルームコード生成
    let roomCode: string
    let existingGame
    do {
      roomCode = generateRoomCode()
      existingGame = await prisma.game.findFirst({
        where: { roomCode, status: { in: ['WAITING', 'PLAYING'] } }
      })
    } while (existingGame)

    // ホストプレイヤー作成
    const hostPlayer = await prisma.player.create({
      data: {
        name: validatedData.hostPlayerName,
        createdAt: new Date()
      }
    })

    // ゲーム設定作成
    const gameSettings = await prisma.gameSettings.create({
      data: {
        gameType: validatedData.gameType,
        initialPoints: validatedData.initialPoints,
        basePoints: validatedData.basePoints,
        hasTobi: validatedData.hasTobi,
        uma: validatedData.uma,
        oka: validatedData.oka
      }
    })

    // ゲーム作成
    const game = await prisma.game.create({
      data: {
        roomCode,
        hostPlayerId: hostPlayer.id,
        settingsId: gameSettings.id,
        status: 'WAITING',
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
        createdAt: new Date()
      }
    })

    // ホストを最初の参加者として追加
    await prisma.gameParticipant.create({
      data: {
        gameId: game.id,
        playerId: hostPlayer.id,
        position: 0,
        currentPoints: validatedData.initialPoints,
        isReach: false
      }
    })

    const response = NextResponse.json({
      success: true,
      data: {
        gameId: game.id,
        roomCode,
        hostPlayerId: hostPlayer.id,
        settings: validatedData
      }
    })

    // ホストプレイヤーの認証情報をCookieに設定
    response.cookies.set('player_id', hostPlayer.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 // 30日
    })

    return response

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'バリデーションエラー',
          details: error.errors
        }
      }, { status: 400 })
    }

    console.error('Room creation failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: 'ルーム作成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}