import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/socket'

const rejoinRoomSchema = z.object({
  playerName: z.string().min(1).max(20)
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const body = await request.json()
    const validatedData = rejoinRoomSchema.parse(body)
    const { roomCode } = await params

    // ゲーム存在確認
    const game = await prisma.game.findFirst({
      where: {
        roomCode: roomCode.toUpperCase(),
        status: 'WAITING'
      },
      include: {
        participants: {
          include: { player: true }
        },
        hostPlayer: true
      }
    })

    if (!game) {
      return NextResponse.json({
        success: false,
        error: { message: '指定されたルームが見つからないか、既にゲームが開始されています' }
      }, { status: 404 })
    }

    // 現在のユーザーの認証情報を取得
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const currentPlayerId = cookieStore.get('player_id')?.value

    if (!currentPlayerId) {
      return NextResponse.json({
        success: false,
        error: { message: '認証が必要です' }
      }, { status: 401 })
    }

    // 現在のプレイヤー情報を取得
    const currentPlayer = await prisma.player.findUnique({
      where: { id: currentPlayerId }
    })

    if (!currentPlayer) {
      return NextResponse.json({
        success: false,
        error: { message: 'プレイヤー情報が見つかりません' }
      }, { status: 404 })
    }

    // 同じ名前のプレイヤーが既に参加している場合、そのプレイヤーを現在のユーザーに置き換える
    const existingParticipant = game.participants.find(p => p.player.name === validatedData.playerName)
    
    if (existingParticipant) {
      console.log('Found existing participant:', existingParticipant)
      console.log('Current player ID:', currentPlayerId)
      console.log('Existing player ID:', existingParticipant.playerId)

      // 既存の参加者のプレイヤーIDを現在のユーザーIDに更新
      await prisma.gameParticipant.update({
        where: { id: existingParticipant.id },
        data: { playerId: currentPlayerId }
      })

      // ホストプレイヤーの場合は、ゲームのホストプレイヤーIDも更新
      if (game.hostPlayer.name === validatedData.playerName) {
        await prisma.game.update({
          where: { id: game.id },
          data: { hostPlayerId: currentPlayerId }
        })
      }

      // 古いプレイヤーレコードを削除（新しいプレイヤーIDと異なる場合のみ）
      if (existingParticipant.playerId !== currentPlayerId) {
        try {
          await prisma.player.delete({
            where: { id: existingParticipant.playerId }
          })
          console.log('Deleted old player record:', existingParticipant.playerId)
        } catch (deleteError) {
          console.log('Could not delete old player record (may be referenced elsewhere):', deleteError)
        }
      }

      // 更新されたゲーム状態を取得
      const updatedGame = await prisma.game.findUnique({
        where: { id: game.id },
        include: {
          participants: {
            include: { player: true },
            orderBy: { position: 'asc' }
          },
          settings: true
        }
      })

      // WebSocketで全員に再参加通知
      const io = getIO()
      if (io && updatedGame) {
        const gameState = {
          gameId: game.id,
          players: updatedGame.participants.map(p => ({
            playerId: p.playerId,
            name: p.player.name,
            position: p.position,
            points: p.currentPoints,
            isReach: p.isReach,
            isConnected: true
          })),
          currentRound: updatedGame.currentRound,
          currentOya: updatedGame.currentOya,
          honba: updatedGame.honba,
          kyotaku: updatedGame.kyotaku,
          gamePhase: 'waiting' as const
        }

        io.to(game.roomCode).emit('player_rejoined', {
          playerId: currentPlayerId,
          playerName: validatedData.playerName,
          position: existingParticipant.position,
          gameState
        })
      }

      const response = NextResponse.json({
        success: true,
        data: {
          gameId: game.id,
          playerId: currentPlayerId,
          position: existingParticipant.position,
          roomCode: roomCode.toUpperCase(),
          message: 'ルームに再参加しました'
        }
      })

      // プレイヤー認証情報をCookieに再設定
      response.cookies.set('player_id', currentPlayerId, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30日
      })

      return response
    } else {
      return NextResponse.json({
        success: false,
        error: { message: 'このルームに該当する名前のプレイヤーが見つかりません' }
      }, { status: 404 })
    }

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

    console.error('Room rejoin failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: 'ルーム再参加に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}