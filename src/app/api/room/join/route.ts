import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getIO } from "@/lib/socket"

const joinRoomSchema = z.object({
  roomCode: z.string().length(6),
  playerName: z.string().min(1).max(20),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = joinRoomSchema.parse(body)

    // ゲーム存在確認
    const game = await prisma.game.findFirst({
      where: {
        roomCode: validatedData.roomCode.toUpperCase(),
        status: "WAITING",
      },
      include: {
        participants: true,
        settings: true,
        session: {
          include: {
            participants: true,
          },
        },
      },
    })

    if (!game) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message:
              "指定されたルームが見つからないか、既にゲームが開始されています",
          },
        },
        { status: 404 }
      )
    }

    // 参加者数確認
    if (game.participants.length >= 4) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "ルームが満員です" },
        },
        { status: 400 }
      )
    }

    // 現在参加しているプレイヤー名を取得して重複をチェック
    const participantPlayers = await prisma.gameParticipant.findMany({
      where: { gameId: game.id },
      include: { player: true },
    })

    const existingPlayerName = participantPlayers.find(
      (p) => p.player.name === validatedData.playerName
    )
    if (existingPlayerName) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "同じ名前のプレイヤーが既に参加しています" },
        },
        { status: 400 }
      )
    }

    // ログイン済みプレイヤーを使用（存在しない場合は作成）
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    const currentPlayerId = cookieStore.get("player_id")?.value

    let player = currentPlayerId
      ? await prisma.player.findUnique({ where: { id: currentPlayerId } })
      : null

    if (player) {
      if (player.name !== validatedData.playerName) {
        player = await prisma.player.update({
          where: { id: player.id },
          data: { name: validatedData.playerName },
        })
      }
    } else {
      player = await prisma.player.create({
        data: {
          name: validatedData.playerName,
          createdAt: new Date(),
        },
      })
    }

    // トランザクションで次のポジション決定とゲーム参加を原子的に実行
    const participant = await prisma.$transaction(async (tx) => {
      // 現在の参加者数を再確認（同時リクエスト対応）
      const currentParticipants = await tx.gameParticipant.findMany({
        where: { gameId: game.id },
        orderBy: { position: "asc" },
      })

      if (currentParticipants.length >= 4) {
        throw new Error("ルームが満員です")
      }

      // 次の利用可能なポジションを検索
      let nextGamePosition = 0
      const usedGamePositions = currentParticipants
        .map((p) => p.position)
        .sort((a, b) => a - b)

      for (let i = 0; i < 4; i++) {
        if (!usedGamePositions.includes(i)) {
          nextGamePosition = i
          break
        }
      }

      // ゲーム参加
      const gameParticipant = await tx.gameParticipant.create({
        data: {
          gameId: game.id,
          playerId: player.id,
          position: nextGamePosition,
          currentPoints: game.settings?.initialPoints || 25000,
          isReach: false,
        },
      })

      // セッション参加者として登録（セッションが存在する場合）
      if (game.session) {
        // 既にセッション参加者として登録されているかチェック
        const existingSessionParticipant =
          await tx.sessionParticipant.findFirst({
            where: {
              sessionId: game.session.id,
              playerId: player.id,
            },
          })

        if (!existingSessionParticipant) {
          // セッション内の次の利用可能なポジションを検索
          const currentSessionParticipants =
            await tx.sessionParticipant.findMany({
              where: { sessionId: game.session.id },
              orderBy: { position: "asc" },
            })

          let nextSessionPosition = 0
          const usedSessionPositions = currentSessionParticipants
            .map((p) => p.position)
            .sort((a, b) => a - b)

          for (let i = 0; i < 4; i++) {
            if (!usedSessionPositions.includes(i)) {
              nextSessionPosition = i
              break
            }
          }

          // セッション参加者を作成
          await tx.sessionParticipant.create({
            data: {
              sessionId: game.session.id,
              playerId: player.id,
              position: nextSessionPosition,
              totalGames: 0,
              totalSettlement: 0,
              firstPlace: 0,
              secondPlace: 0,
              thirdPlace: 0,
              fourthPlace: 0,
            },
          })
        }
      }

      return gameParticipant
    })

    // 更新されたゲーム状態取得
    const updatedGame = await prisma.game.findUnique({
      where: { id: game.id },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: "asc" },
        },
        settings: true,
      },
    })

    // WebSocketで全員に参加通知
    const io = getIO()
    if (io) {
      io.to(game.roomCode).emit("player_joined", {
        playerId: player.id,
        playerName: player.name,
        position: participant.position,
        gameState: {
          gameId: game.id,
          players:
            updatedGame?.participants.map((p) => ({
              playerId: p.playerId,
              name: p.player.name,
              position: p.position,
              points: p.currentPoints,
              isReach: p.isReach,
              isConnected: true,
            })) || [],
          currentRound: updatedGame?.currentRound || 1,
          currentOya: updatedGame?.currentOya || 0,
          honba: updatedGame?.honba || 0,
          kyotaku: updatedGame?.kyotaku || 0,
          gamePhase: "waiting" as const,
        },
      })
    }

    const response = NextResponse.json({
      success: true,
      data: {
        gameId: game.id,
        playerId: player.id,
        position: participant.position,
        roomCode: validatedData.roomCode.toUpperCase(),
        playerCount: updatedGame?.participants.length || 0,
      },
    })

    // 参加プレイヤーの認証情報をCookieに設定
    response.cookies.set("player_id", player.id, {
      httpOnly: true,
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

    console.error("Room join failed:", error)
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    )
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "ルーム参加に失敗しました",
          details: error instanceof Error ? error.message : "Unknown error",
          stack:
            process.env.NODE_ENV === "development"
              ? error instanceof Error
                ? error.stack
                : null
              : undefined,
        },
      },
      { status: 500 }
    )
  }
}
