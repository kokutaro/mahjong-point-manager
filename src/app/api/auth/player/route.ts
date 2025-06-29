import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"

const playerAuthSchema = z.object({
  name: z.string().min(1).max(20),
  deviceId: z.string().optional(),
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
          deviceId: validatedData.deviceId,
        },
      })
    }

    // 既存プレイヤーが見つからなければ新規作成
    if (!player) {
      const deviceId = validatedData.deviceId || uuidv4()
      player = await prisma.player.create({
        data: {
          name: validatedData.name,
          deviceId,
          createdAt: new Date(),
        },
      })
    }

    // セッショントークン生成
    const sessionToken = uuidv4()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24時間

    // セッション情報を保存（Playerテーブルに追加するかRedisを使用）
    await prisma.player.update({
      where: { id: player.id },
      data: {
        lastLogin: new Date(),
      },
    })

    // Cookieにセッション情報を設定
    const cookieStore = await cookies()

    // ブラウザ対応のクッキー設定（Safari/iPhone Chrome対応）
    const userAgent = request.headers.get("user-agent") || ""
    const isSafari =
      userAgent.includes("Safari") && !userAgent.includes("Chrome")
    const isMobile =
      userAgent.includes("Mobile") ||
      userAgent.includes("iPhone") ||
      userAgent.includes("iPad")

    console.log("Browser detection:", { userAgent, isSafari, isMobile })

    // プロトコル検出（HTTPSかHTTPか）
    const protocol =
      request.headers.get("x-forwarded-proto") ||
      (request.headers.get("host")?.includes("localhost") ? "http" : "http")
    const isHttps = protocol === "https"

    console.log("Protocol detection:", { protocol, isHttps })

    // SameSiteとSecureの組み合わせを適切に設定
    let sameSiteSetting: "strict" | "lax" | "none" = "lax"
    let secureSetting = false

    if (isSafari || isMobile) {
      // Safari/モバイルの場合
      if (isHttps) {
        // HTTPS環境ではSameSite=noneとSecure=trueを使用
        sameSiteSetting = "none"
        secureSetting = true
      } else {
        // HTTP環境では最も緩い設定（sameSiteを設定しない）
        sameSiteSetting = "lax"
        secureSetting = false
      }
    } else {
      // その他のブラウザ（Chrome, Firefox等）
      sameSiteSetting = "lax"
      secureSetting = isHttps
    }

    const cookieOptions = {
      httpOnly: true,
      secure: secureSetting,
      sameSite: sameSiteSetting,
      expires: expiresAt,
      path: "/",
    }

    console.log("Cookie options:", cookieOptions)

    cookieStore.set("session_token", sessionToken, cookieOptions)
    cookieStore.set("player_id", player.id, cookieOptions)

    return NextResponse.json({
      success: true,
      data: {
        playerId: player.id,
        name: player.name,
        deviceId: player.deviceId,
        sessionToken: sessionToken,
      },
      // ブラウザ情報をクライアントに送信（デバッグ用）
      debug: {
        browser: { isSafari, isMobile },
        cookieOptions: cookieOptions,
        protocol: protocol,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "バリデーションエラー",
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    console.error("Player authentication failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "プレイヤー認証に失敗しました",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}

// 現在のプレイヤー情報取得
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // クッキーまたはヘッダーからプレイヤーIDを取得
    let playerId = cookieStore.get("player_id")?.value

    // クッキーがない場合、ヘッダーから取得（Safari/iPhone対応）
    if (!playerId) {
      playerId = request.headers.get("x-player-id") || undefined
      console.log("📱 Using header-based auth, playerId:", playerId)
    }

    if (!playerId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "認証が必要です" },
          debug: {
            cookiePlayerId: cookieStore.get("player_id")?.value,
            headerPlayerId: request.headers.get("x-player-id"),
            userAgent: request.headers.get("user-agent"),
          },
        },
        { status: 401 }
      )
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
    })

    if (!player) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "プレイヤーが見つかりません" },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        playerId: player.id,
        name: player.name,
        deviceId: player.deviceId,
      },
    })
  } catch (error) {
    console.error("Player info retrieval failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "プレイヤー情報の取得に失敗しました",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}
