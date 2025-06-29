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
      return NextResponse.json(
        { success: false, error: { message: "ゲームが見つかりません" } },
        { status: 404 }
      )
    }

    let roomCode: string
    let session = game.session
    let nextSessionOrder = 1

    if (validatedData.continueSession && session) {
      // 既存セッション継続 - 新しいルームコードを生成（ユニーク制約回避）
      let existing
      do {
        roomCode = generateRoomCode()
        existing = await prisma.game.findFirst({ where: { roomCode } })
      } while (existing)

      nextSessionOrder =
        (await prisma.game.count({
          where: { sessionId: session.id },
        })) + 1

      console.log(
        "🔄 Continuing session with NEW roomCode:",
        roomCode,
        "sessionOrder:",
        nextSessionOrder
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
      "🔄 Creating new game with roomCode:",
      roomCode,
      "sessionId:",
      session.id,
      "sessionOrder:",
      nextSessionOrder
    )

    const newGame = await prisma.game.create({
      data: {
        roomCode,
        hostPlayerId: game.hostPlayerId,
        settingsId: game.settingsId!,
        sessionId: session.id,
        sessionOrder: nextSessionOrder,
        status: "WAITING",
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
      },
    })

    console.log("🔄 Successfully created new game with ID:", newGame.id)

    // 新しいGameParticipantを作成
    await Promise.all(
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
    console.error("Rematch creation failed:", err)
    return NextResponse.json(
      { success: false, error: { message: "再戦作成に失敗しました" } },
      { status: 500 }
    )
  }
}
