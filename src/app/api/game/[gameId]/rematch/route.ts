import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function generateRoomCode(): string {
  return Math.random().toString(36).substr(2, 6).toUpperCase()
}

function generateSessionCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

const rematchSchema = z.object({
  continueSession: z.boolean().default(true),
  newSessionName: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params
    const body = await request.json()
    const validatedData = rematchSchema.parse(body)

    console.log(`🔄 Rematch API called for gameId: ${gameId}`, validatedData)

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: true,
        settings: true,
        hostPlayer: true,
        session: true,
      },
    })

    if (!game) {
      console.error(`🔄 Game not found: ${gameId}`)
      return NextResponse.json(
        { success: false, error: { message: "ゲームが見つかりません" } },
        { status: 404 }
      )
    }

    console.log(
      `🔄 Found game: ${game.id}, session: ${game.session?.id}, participants: ${game.participants.length}`
    )

    let roomCode: string
    let session = game.session
    let nextSessionOrder = 1

    if (validatedData.continueSession && session) {
      // 既存セッション継続 - 新しいルームコードを生成（ユニーク制約回避）
      console.log(`🔄 Continuing existing session: ${session.id}`)

      let existing
      let attempts = 0
      do {
        roomCode = generateRoomCode()
        existing = await prisma.game.findFirst({ where: { roomCode } })
        attempts++
        if (attempts > 10) {
          throw new Error("ルームコード生成に失敗しました（10回試行）")
        }
      } while (existing)

      const sessionGameCount = await prisma.game.count({
        where: { sessionId: session.id },
      })
      nextSessionOrder = sessionGameCount + 1

      console.log(
        `🔄 Continuing session with NEW roomCode: ${roomCode}, sessionOrder: ${nextSessionOrder}, existing games in session: ${sessionGameCount}`
      )
    } else {
      // 新規セッション作成 - 新しいルームコードを生成
      let existing
      do {
        roomCode = generateRoomCode()
        existing = await prisma.game.findFirst({ where: { roomCode } })
      } while (existing)

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
          hostPlayerId: game.hostPlayerId,
          name: validatedData.newSessionName || null,
          status: "ACTIVE",
          settingsId: game.settingsId!,
          createdAt: new Date(),
        },
      })

      // 既存参加者のセッション参加者作成
      await Promise.all(
        game.participants.map((p) =>
          prisma.sessionParticipant.create({
            data: {
              sessionId: session!.id,
              playerId: p.playerId,
              position: p.position,
              totalGames: 0,
              totalSettlement: 0,
              firstPlace: 0,
              secondPlace: 0,
              thirdPlace: 0,
              fourthPlace: 0,
            },
          })
        )
      )
    }

    // セッション継続・新規セッション共に新しいゲームを作成
    console.log(
      `🔄 Creating new game with roomCode: ${roomCode}, sessionId: ${session.id}, sessionOrder: ${nextSessionOrder}`
    )

    if (!game.settingsId) {
      throw new Error("ゲーム設定が見つかりません")
    }

    const newGame = await prisma.game.create({
      data: {
        roomCode,
        hostPlayerId: game.hostPlayerId,
        settingsId: game.settingsId,
        sessionId: session.id,
        sessionOrder: nextSessionOrder,
        status: "WAITING",
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
      },
    })

    console.log(`🔄 Successfully created new game with ID: ${newGame.id}`)

    // 新しいGameParticipantを作成
    const participantResults = await Promise.all(
      game.participants.map((p) =>
        prisma.gameParticipant.create({
          data: {
            gameId: newGame.id,
            playerId: p.playerId,
            position: p.position,
            currentPoints: game.settings?.initialPoints || 25000,
            isReach: false,
          },
        })
      )
    )

    console.log(
      `🔄 Successfully created ${participantResults.length} participants for new game`
    )

    return NextResponse.json({
      success: true,
      data: {
        gameId: newGame.id,
        roomCode,
        sessionId: session.id,
        sessionCode: session.sessionCode,
      },
    })
  } catch (err) {
    console.error("🔄 Rematch creation failed:", err)

    let errorMessage = "再戦作成に失敗しました"
    let statusCode = 500

    if (err instanceof Error) {
      console.error(`🔄 Error details: ${err.message}`)
      console.error(`🔄 Error stack: ${err.stack}`)

      if (err.message.includes("ゲーム設定が見つかりません")) {
        errorMessage = "ゲーム設定が見つかりません"
        statusCode = 400
      } else if (err.message.includes("ルームコード生成に失敗")) {
        errorMessage = "ルームコード生成に失敗しました"
        statusCode = 500
      } else {
        errorMessage = `再戦作成に失敗しました: ${err.message}`
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          message: errorMessage,
          details: err instanceof Error ? err.message : String(err),
        },
      },
      { status: statusCode }
    )
  }
}
