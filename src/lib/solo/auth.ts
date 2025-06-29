import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

export interface AuthResult {
  success: boolean
  playerId?: string
  player?: {
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
  }
  error?: {
    code: string
    message: string
  }
}

/**
 * リクエストからプレイヤー認証を行う
 * 既存の認証システムと同じロジックを使用
 */
export async function authenticatePlayer(
  request: NextRequest
): Promise<AuthResult> {
  try {
    const cookieStore = await cookies()

    // クッキーまたはヘッダーからプレイヤーIDを取得
    let playerId = cookieStore.get("player_id")?.value

    // クッキーがない場合、ヘッダーから取得（Safari/iPhone対応）
    if (!playerId) {
      playerId = request.headers.get("x-player-id") || undefined
    }

    if (!playerId) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "ログインが必要です",
        },
      }
    }

    // プレイヤーの存在確認
    const player = await prisma.player.findUnique({
      where: { id: playerId },
    })

    if (!player) {
      return {
        success: false,
        error: {
          code: "PLAYER_NOT_FOUND",
          message: "プレイヤーが見つかりません",
        },
      }
    }

    return {
      success: true,
      playerId: player.id,
      player,
    }
  } catch (error) {
    console.error("Player authentication error:", error)
    return {
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "認証処理でエラーが発生しました",
      },
    }
  }
}

/**
 * 認証エラーレスポンスを生成
 */
export function createAuthErrorResponse(authResult: AuthResult) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const statusCode =
    authResult.error?.code === "UNAUTHORIZED"
      ? 401
      : authResult.error?.code === "PLAYER_NOT_FOUND"
        ? 404
        : 500

  return {
    success: false,
    error: authResult.error,
  }
}
