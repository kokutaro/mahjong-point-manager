import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

const playerAuthSchema = z.object({
  name: z.string().min(1).max(20),
  deviceId: z.string().optional()
})

// プレイヤー作成・認証
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = playerAuthSchema.parse(body)

    // デバイスIDがあれば既存プレイヤーを探す
    let player
    if (validatedData.deviceId) {
      player = await prisma.player.findFirst({
        where: { 
          name: validatedData.name,
          deviceId: validatedData.deviceId
        }
      })
    }

    // 既存プレイヤーが見つからなければ新規作成
    if (!player) {
      const deviceId = validatedData.deviceId || uuidv4()
      player = await prisma.player.create({
        data: {
          name: validatedData.name,
          deviceId,
          createdAt: new Date()
        }
      })
    }

    // セッショントークン生成
    const sessionToken = uuidv4()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24時間

    // セッション情報を保存（Playerテーブルに追加するかRedisを使用）
    await prisma.player.update({
      where: { id: player.id },
      data: {
        lastLogin: new Date()
      }
    })

    // Cookieにセッション情報を設定
    const cookieStore = await cookies()
    
    // ネットワークアクセス対応のクッキー設定
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' as const : 'strict' as const,
      expires: expiresAt,
      path: '/',
      // ドメイン設定はしない（自動的に現在のホストが使用される）
    }
    
    cookieStore.set('session_token', sessionToken, cookieOptions)
    cookieStore.set('player_id', player.id, cookieOptions)

    return NextResponse.json({
      success: true,
      data: {
        playerId: player.id,
        name: player.name,
        deviceId: player.deviceId,
        sessionToken: sessionToken
      }
    })

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

    console.error('Player authentication failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: 'プレイヤー認証に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}

// 現在のプレイヤー情報取得
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const playerId = cookieStore.get('player_id')?.value

    if (!playerId) {
      return NextResponse.json({
        success: false,
        error: { message: '認証が必要です' }
      }, { status: 401 })
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId }
    })

    if (!player) {
      return NextResponse.json({
        success: false,
        error: { message: 'プレイヤーが見つかりません' }
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        playerId: player.id,
        name: player.name,
        deviceId: player.deviceId
      }
    })

  } catch (error) {
    console.error('Player info retrieval failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: 'プレイヤー情報の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}