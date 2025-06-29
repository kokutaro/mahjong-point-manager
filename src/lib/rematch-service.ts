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

export interface RematchResult {
  success: true
  data: {
    gameId: string
    roomCode: string
    sessionId: string
    sessionCode: string
  }
}

export interface RematchError {
  success: false
  error: {
    message: string
    details: string
    errorType?: string
  }
}

/**
 * rematch処理を実行する関数
 * 内部API呼び出しの代わりに直接呼び出し可能
 */
export async function createRematch(
  gameId: string,
  requestData: unknown
): Promise<RematchResult | RematchError> {
  try {
    const validatedData = rematchSchema.parse(requestData)

    console.log(`🔄 === REMATCH SERVICE START ===`)
    console.log(`🔄 Environment: ${process.env.NODE_ENV}`)
    console.log(`🔄 GameId: ${gameId}`)
    console.log(`🔄 Request data:`, validatedData)

    console.log(`🔄 Fetching game data for gameId: ${gameId}`)
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
      console.error(`🔄 === GAME NOT FOUND ERROR ===`)
      console.error(`🔄 GameId searched: ${gameId}`)
      console.error(`🔄 Type of gameId: ${typeof gameId}`)
      console.error(`🔄 GameId length: ${gameId.length}`)
      return {
        success: false,
        error: {
          message: "ゲームが見つかりません",
          details: `gameId: ${gameId}`,
        },
      }
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
    console.log(`🔄 === CREATING NEW GAME ===`)
    console.log(`🔄 RoomCode: ${roomCode}`)
    console.log(`🔄 SessionId: ${session.id}`)
    console.log(`🔄 SessionOrder: ${nextSessionOrder}`)
    console.log(`🔄 HostPlayerId: ${game.hostPlayerId}`)
    console.log(`🔄 SettingsId: ${game.settingsId}`)

    if (!game.settingsId) {
      console.error(`🔄 === SETTINGS NOT FOUND ERROR ===`)
      console.error(`🔄 Game.settingsId: ${game.settingsId}`)
      console.error(`🔄 Game settings:`, game.settings)
      throw new Error("ゲーム設定が見つかりません")
    }

    console.log(`🔄 Creating game with data:`, {
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
    })

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

    console.log(`🔄 === NEW GAME CREATED ===`)
    console.log(`🔄 New Game ID: ${newGame.id}`)
    console.log(`🔄 New Game RoomCode: ${newGame.roomCode}`)

    // 新しいGameParticipantを作成
    console.log(`🔄 === CREATING PARTICIPANTS ===`)
    console.log(`🔄 Participants to create: ${game.participants.length}`)
    console.log(`🔄 Initial points: ${game.settings?.initialPoints || 25000}`)

    const participantResults = await Promise.all(
      game.participants.map((p, index) => {
        console.log(
          `🔄 Creating participant ${index + 1}: ${p.playerId} at position ${p.position}`
        )
        return prisma.gameParticipant.create({
          data: {
            gameId: newGame.id,
            playerId: p.playerId,
            position: p.position,
            currentPoints: game.settings?.initialPoints || 25000,
            isReach: false,
          },
        })
      })
    )

    console.log(`🔄 === PARTICIPANTS CREATED ===`)
    console.log(
      `🔄 Successfully created ${participantResults.length} participants for new game`
    )
    console.log(
      `🔄 Participant IDs: ${participantResults.map((p) => p.id).join(", ")}`
    )

    console.log(`🔄 === REMATCH SERVICE SUCCESS ===`)
    return {
      success: true,
      data: {
        gameId: newGame.id,
        roomCode,
        sessionId: session.id,
        sessionCode: session.sessionCode,
      },
    }
  } catch (err) {
    console.error(`🔄 === REMATCH SERVICE FAILED ===`)
    console.error(
      `🔄 Error type: ${err instanceof Error ? err.constructor.name : typeof err}`
    )
    console.error(
      `🔄 Error message: ${err instanceof Error ? err.message : String(err)}`
    )
    console.error(`🔄 Full error:`, err)

    if (err instanceof Error) {
      console.error(`🔄 Error stack:`)
      console.error(err.stack)
    }

    let errorMessage = "再戦作成に失敗しました"

    if (err instanceof Error) {
      if (err.message.includes("ゲーム設定が見つかりません")) {
        errorMessage = "ゲーム設定が見つかりません"
        console.error(`🔄 Settings error detected`)
      } else if (err.message.includes("ルームコード生成に失敗")) {
        errorMessage = "ルームコード生成に失敗しました"
        console.error(`🔄 Room code generation error detected`)
      } else if (
        err.message.includes("Unique constraint") ||
        err.message.includes("unique")
      ) {
        errorMessage = "データベース制約違反が発生しました"
        console.error(`🔄 Database constraint error detected`)
      } else if (
        err.message.includes("connect") ||
        err.message.includes("timeout")
      ) {
        errorMessage = "データベース接続エラーが発生しました"
        console.error(`🔄 Database connection error detected`)
      } else {
        errorMessage = `再戦作成に失敗しました: ${err.message}`
        console.error(`🔄 Generic error detected`)
      }
    }

    console.error(`🔄 Final error response: message="${errorMessage}"`)

    return {
      success: false,
      error: {
        message: errorMessage,
        details: err instanceof Error ? err.message : String(err),
        errorType: err instanceof Error ? err.constructor.name : typeof err,
      },
    }
  }
}
