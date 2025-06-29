import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"

const createRoomSchema = z.object({
  hostPlayerName: z.string().min(1).max(20),
  gameType: z.enum(["TONPUU", "HANCHAN"]).default("HANCHAN"),
  initialPoints: z.number().int().min(20000).max(50000).default(25000),
  basePoints: z.number().int().min(20000).max(50000).default(30000),
  hasTobi: z.boolean().default(true),
  uma: z.array(z.number()).length(4).default([20, 10, -10, -20]),
  // セッション関連の新しいフィールド
  sessionMode: z.boolean().default(false),
  existingSessionId: z.string().optional(),
  sessionName: z.string().optional(),
})

// 6桁のランダムルームコード生成
function generateRoomCode(): string {
  return Math.random().toString(36).substr(2, 6).toUpperCase()
}

// 6桁のランダムセッションコード生成
function generateSessionCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
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
        where: { roomCode, status: { in: ["WAITING", "PLAYING"] } },
      })
    } while (existingGame)

    // 既存プレイヤーがいれば再利用
    const cookieStore = await cookies()
    const currentPlayerId = cookieStore.get("player_id")?.value

    let hostPlayer = currentPlayerId
      ? await prisma.player.findUnique({ where: { id: currentPlayerId } })
      : null

    if (hostPlayer) {
      if (hostPlayer.name !== validatedData.hostPlayerName) {
        hostPlayer = await prisma.player.update({
          where: { id: hostPlayer.id },
          data: { name: validatedData.hostPlayerName },
        })
      }
    } else {
      hostPlayer = await prisma.player.create({
        data: {
          name: validatedData.hostPlayerName,
          createdAt: new Date(),
        },
      })
    }

    // ゲーム設定作成
    const gameSettings = await prisma.gameSettings.create({
      data: {
        gameType: validatedData.gameType,
        initialPoints: validatedData.initialPoints,
        basePoints: validatedData.basePoints,
        hasTobi: validatedData.hasTobi,
        uma: validatedData.uma,
      },
    })

    // セッション処理: 既存セッションまたは新規作成
    let session
    if (validatedData.existingSessionId) {
      // 既存セッション継続
      session = await prisma.gameSession.findUnique({
        where: { id: validatedData.existingSessionId },
        include: { participants: true },
      })

      if (!session) {
        return NextResponse.json(
          {
            success: false,
            error: { message: "指定されたセッションが見つかりません" },
          },
          { status: 404 }
        )
      }
    } else {
      // 新規セッション作成
      let sessionCode: string
      let existingSession
      do {
        sessionCode = generateSessionCode()
        existingSession = await prisma.gameSession.findFirst({
          where: { sessionCode },
        })
      } while (existingSession)

      session = await prisma.gameSession.create({
        data: {
          sessionCode,
          hostPlayerId: hostPlayer.id,
          name: validatedData.sessionName || null,
          status: "ACTIVE",
          settingsId: gameSettings.id,
          createdAt: new Date(),
        },
        include: { participants: true },
      })

      // セッション参加者を作成（ホストのみ）
      await prisma.sessionParticipant.create({
        data: {
          sessionId: session.id,
          playerId: hostPlayer.id,
          position: 0,
          totalGames: 0,
          totalSettlement: 0,
          firstPlace: 0,
          secondPlace: 0,
          thirdPlace: 0,
          fourthPlace: 0,
        },
      })
    }

    // 次のセッションオーダーを計算
    const nextSessionOrder =
      (await prisma.game.count({
        where: { sessionId: session.id },
      })) + 1

    // ゲーム作成（セッション付き）
    const game = await prisma.game.create({
      data: {
        roomCode,
        hostPlayerId: hostPlayer.id,
        settingsId: gameSettings.id,
        sessionId: session.id,
        sessionOrder: nextSessionOrder,
        status: "WAITING",
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
        createdAt: new Date(),
      },
    })

    // ホストを最初の参加者として追加
    await prisma.gameParticipant.create({
      data: {
        gameId: game.id,
        playerId: hostPlayer.id,
        position: 0,
        currentPoints: validatedData.initialPoints,
        isReach: false,
      },
    })

    const response = NextResponse.json({
      success: true,
      data: {
        gameId: game.id,
        roomCode: game.roomCode,
        sessionId: session.id,
        sessionCode: session.sessionCode,
        hostPlayerId: hostPlayer.id,
        settings: validatedData,
      },
    })

    // ホストプレイヤーの認証情報をCookieに設定
    cookieStore.set("player_id", hostPlayer.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30日
    })

    return response
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

    console.error("Room creation failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "ルーム作成に失敗しました",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}
