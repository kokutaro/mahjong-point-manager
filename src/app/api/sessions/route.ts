import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentPlayer } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const currentPlayer = await getCurrentPlayer()
    if (!currentPlayer) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "認証が必要です" },
        },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "10")
    const offset = parseInt(searchParams.get("offset") || "0")

    // 基本的なクエリ条件 - 認証されたプレイヤーが参加しているセッションのみ
    const whereCondition: Prisma.GameSessionWhereInput = {
      participants: {
        some: {
          playerId: currentPlayer.playerId,
        },
      },
    }

    // ステータスによるフィルタリング
    if (status) {
      // 有効なSessionStatusかチェック
      const validStatuses = ["ACTIVE", "PAUSED", "FINISHED", "CANCELLED"]
      if (validStatuses.includes(status)) {
        whereCondition.status = status as
          | "ACTIVE"
          | "PAUSED"
          | "FINISHED"
          | "CANCELLED"
      }
    }

    // セッション一覧取得
    const sessions = await prisma.gameSession.findMany({
      where: whereCondition,
      include: {
        hostPlayer: {
          select: { id: true, name: true },
        },
        settings: true,
        participants: {
          include: {
            player: {
              select: { id: true, name: true },
            },
          },
          orderBy: { position: "asc" },
        },
        games: {
          where: { status: "FINISHED" },
          select: {
            id: true,
            gameType: true,
            endedAt: true,
          },
          orderBy: { sessionOrder: "asc" },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    })

    // 総件数取得
    const totalCount = await prisma.gameSession.count({
      where: whereCondition,
    })

    // レスポンス用データ整形
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      sessionCode: session.sessionCode,
      name: session.name,
      status: session.status,
      createdAt: session.createdAt,
      endedAt: session.endedAt,
      hostPlayer: session.hostPlayer,
      totalGames: session.games.length,
      participants: session.participants.map((p) => ({
        playerId: p.player.id,
        name: p.player.name,
        position: p.position,
        totalSettlement: p.totalSettlement,
        gamesPlayed: p.totalGames,
      })),
      settings: session.settings,
    }))

    return NextResponse.json({
      success: true,
      data: {
        sessions: formattedSessions,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      },
    })
  } catch (error) {
    console.error("Sessions API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "セッション一覧の取得に失敗しました",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}

// セッション作成API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { hostPlayerId, name, settingsId } = body

    // 6桁のセッションコード生成
    const sessionCode = Math.floor(100000 + Math.random() * 900000).toString()

    const session = await prisma.gameSession.create({
      data: {
        sessionCode,
        hostPlayerId,
        name,
        settingsId,
        status: "ACTIVE",
      },
      include: {
        hostPlayer: {
          select: { id: true, name: true },
        },
        settings: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: session,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Session creation error:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "セッションの作成に失敗しました",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}
