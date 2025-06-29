import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth"
import { PointManager } from "@/lib/point-manager"
import { analyzeVotes } from "@/lib/vote-analysis"
import { getIO, initializeVoteGlobals } from "@/lib/vote-globals"
import { createRematch } from "@/lib/rematch-service"

// 投票グローバル変数を初期化
initializeVoteGlobals()

// 投票リクエストのスキーマ
const voteSchema = z.object({
  vote: z.enum(["continue", "end", "pause"], {
    errorMap: () => ({
      message: "有効な投票選択肢を選択してください (continue, end, pause)",
    }),
  }),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const body = await request.json()
    const { gameId } = await params
    const validatedData = voteSchema.parse(body)

    console.log(
      `🗳️ Vote API: Processing vote for game ${gameId}:`,
      validatedData
    )

    // 認証確認
    const player = await requireAuth()

    // ゲーム情報を取得
    const pointManager = new PointManager(gameId)
    const gameInfo = await pointManager.getGameInfo()

    if (!gameInfo) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "ゲームが見つかりません" },
        },
        { status: 404 }
      )
    }

    // セッションが存在することを確認
    if (!gameInfo.sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "セッションが存在しません" },
        },
        { status: 400 }
      )
    }

    // 投票状態を取得
    const gameVotes = global.gameVotes!
    const voteStartTimes = global.voteStartTimes!

    // 投票の初期化（初回投票時）
    if (!gameVotes[gameId]) {
      gameVotes[gameId] = {}
      voteStartTimes[gameId] = new Date().toISOString()
    }

    // 投票を記録
    gameVotes[gameId][player.playerId] = validatedData.vote

    console.log(`🗳️ Vote recorded: ${player.name} voted ${validatedData.vote}`)
    console.log(`🗳️ Current votes for game ${gameId}:`, gameVotes[gameId])

    // 総プレイヤー数を取得（固定で4人とするか、動的に取得）
    const totalPlayers = 4

    // 投票結果を分析
    const voteResult = analyzeVotes(gameVotes[gameId], totalPlayers)

    console.log(`🗳️ Vote analysis result:`, voteResult)

    // WebSocket通知
    const io = getIO()
    if (io && gameInfo.roomCode) {
      console.log("🔌 Vote API: Found WebSocket instance in process")
      // 投票状況をブロードキャスト
      io.to(gameInfo.roomCode).emit("session_vote_update", {
        votes: gameVotes[gameId],
        result: voteResult,
        voterName: player.name,
      })

      console.log(`🔌 Broadcasted vote update to room ${gameInfo.roomCode}`)

      // 決定した場合の追加処理
      if (
        voteResult.action === "end" &&
        voteResult.details.votedPlayers === totalPlayers
      ) {
        // セッション終了処理
        console.log("🏁 All players voted to end session, forcing end...")

        try {
          await pointManager.forceEndGame("全員合意による終了")

          io.to(gameInfo.roomCode).emit("session_ended_by_consensus", {
            reason: "全員合意による終了",
            voteDetails: voteResult.details,
          })

          console.log("🏁 Session ended by consensus")

          // 投票状態をクリア
          if (gameVotes) {
            delete gameVotes[gameId]
          }
          if (voteStartTimes) {
            delete voteStartTimes[gameId]
          }
        } catch (endError) {
          console.error("Failed to end session:", endError)
          // エラーが発生してもレスポンスは投票成功として返す
        }
      } else if (
        voteResult.action === "continue" &&
        voteResult.details.votedPlayers === totalPlayers
      ) {
        // 継続プロセス開始
        console.log("🔄 Continue process triggered by votes")

        io.to(gameInfo.roomCode).emit("session_continue_agreed", {
          continueVotes: voteResult.details.continueVotes,
        })

        try {
          console.log(`🔄 === CALLING REMATCH SERVICE DIRECTLY ===`)
          console.log(`🔄 Environment: ${process.env.NODE_ENV}`)
          console.log(`🔄 GameId: ${gameId}`)
          console.log(`🔄 Service call data:`, { continueSession: true })

          const serviceStartTime = Date.now()
          const result = await createRematch(gameId, { continueSession: true })
          const serviceDuration = Date.now() - serviceStartTime

          console.log(`🔄 === REMATCH SERVICE RESPONSE ===`)
          console.log(`🔄 Service duration: ${serviceDuration}ms`)
          console.log(`🔄 Service result:`, JSON.stringify(result, null, 2))

          if (result.success) {
            io.to(gameInfo.roomCode).emit("new-room-ready", {
              roomCode: result.data.roomCode,
              gameId: result.data.gameId,
              sessionId: result.data.sessionId,
            })
            console.log(
              `🔄 Successfully created new room ${result.data.roomCode} for continuation via direct service call`
            )
          } else {
            console.error(
              "🔄 === REMATCH SERVICE ERROR ===",
              result.error.message
            )
            io.to(gameInfo.roomCode).emit("session_continue_failed", {
              message: result.error.message,
              details: result.error.details || "不明なエラー",
            })
          }
        } catch (err) {
          console.error("🔄 Error creating new room:", err)

          let errorMessage = "新しいルーム作成に失敗しました"
          let errorDetails = "不明なエラー"

          if (err instanceof Error) {
            if (err.name === "AbortError") {
              errorMessage = "新しいルーム作成がタイムアウトしました"
              errorDetails = "10秒以内に処理が完了しませんでした"
            } else {
              errorDetails = err.message
            }
          }

          io.to(gameInfo.roomCode).emit("session_continue_failed", {
            message: errorMessage,
            details: errorDetails,
          })
        }

        // 投票状態をクリア
        if (gameVotes) {
          delete gameVotes[gameId]
        }
        if (voteStartTimes) {
          delete voteStartTimes[gameId]
        }
      } else if (
        voteResult.action === "wait" &&
        voteResult.details.votedPlayers === totalPlayers
      ) {
        // 全員が保留の場合は投票をリセット
        if (voteResult.details.pauseVotes === totalPlayers) {
          console.log("⏸️ All players voted pause, resetting votes...")

          setTimeout(() => {
            if (gameVotes) {
              delete gameVotes[gameId]
            }
            if (voteStartTimes) {
              delete voteStartTimes[gameId]
            }

            io.to(gameInfo.roomCode).emit("vote_timeout", {
              reason: "全員が保留を選択したため投票をリセットしました",
            })
          }, 3000) // 3秒後にリセット
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        vote: validatedData.vote,
        currentVotes: gameVotes[gameId],
        result: voteResult,
        voteStartTime: voteStartTimes[gameId],
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

    console.error("Vote session failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "投票処理に失敗しました",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}

// 投票取り消しのエンドポイント
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params

    // 認証確認
    const player = await requireAuth()

    console.log(`🗳️ Cancel vote for player ${player.name} in game ${gameId}`)

    // 投票を削除
    if (gameVotes && gameVotes[gameId] && gameVotes[gameId][player.playerId]) {
      delete gameVotes[gameId][player.playerId]

      // 誰も投票していない場合は投票をリセット
      if (Object.keys(gameVotes[gameId]).length === 0) {
        delete gameVotes[gameId]
        if (voteStartTimes) {
          delete voteStartTimes[gameId]
        }
      }
    }

    // ゲーム情報を取得してWebSocket通知
    const pointManager = new PointManager(gameId)
    const gameInfo = await pointManager.getGameInfo()

    if (gameInfo && gameInfo.roomCode) {
      const io = getIO()
      if (io) {
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
      },
    })
  } catch (error) {
    console.error("Cancel vote failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: { message: "投票の取り消しに失敗しました" },
      },
      { status: 500 }
    )
  }
}
