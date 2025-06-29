import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { PointManager } from "@/lib/point-manager"
import { analyzeVotes } from "@/lib/vote-analysis"
import { getIO, initializeVoteGlobals } from "@/lib/vote-globals"

// 投票グローバル変数を初期化
initializeVoteGlobals()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params

    // 認証確認
    const player = await requireAuth()

    console.log(`🗳️ Cancel vote for player ${player.name} in game ${gameId}`)

    // 投票状態を取得
    const gameVotes = global.gameVotes || {}
    const voteStartTimes = global.voteStartTimes || {}

    // 投票を削除
    if (gameVotes && gameVotes[gameId] && gameVotes[gameId][player.playerId]) {
      delete gameVotes[gameId][player.playerId]

      console.log(`🗳️ Vote cancelled for ${player.name}`)
      console.log(`🗳️ Remaining votes for game ${gameId}:`, gameVotes[gameId])

      // 誰も投票していない場合は投票をリセット
      if (Object.keys(gameVotes[gameId]).length === 0) {
        delete gameVotes[gameId]
        if (voteStartTimes) {
          delete voteStartTimes[gameId]
        }
        console.log(`🗳️ All votes cleared for game ${gameId}`)
      }

      // グローバル変数に反映
      global.gameVotes = gameVotes
      global.voteStartTimes = voteStartTimes
    }

    // ゲーム情報を取得してWebSocket通知
    const pointManager = new PointManager(gameId)
    const gameInfo = await pointManager.getGameInfo()

    if (gameInfo && gameInfo.roomCode) {
      const io = getIO()
      if (io) {
        console.log("🔌 Cancel Vote API: Found WebSocket instance in process")
        const currentVotes = (gameVotes && gameVotes[gameId]) || {}
        const voteResult = analyzeVotes(currentVotes, 4)

        io.to(gameInfo.roomCode).emit("session_vote_update", {
          votes: currentVotes,
          result: voteResult,
          voterName: player.name,
        })

        console.log(
          `🔌 Broadcasted vote cancellation to room ${gameInfo.roomCode}`
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "投票を取り消しました",
        currentVotes: (gameVotes && gameVotes[gameId]) || {},
        playerName: player.name,
      },
    })
  } catch (error) {
    // 認証エラーのハンドリング
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        {
          success: false,
          error: { message: "認証が必要です" },
        },
        { status: 401 }
      )
    }

    console.error("Cancel vote failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "投票の取り消しに失敗しました",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}
