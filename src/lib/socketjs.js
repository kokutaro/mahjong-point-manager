// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Server: SocketIOServer } = require("socket.io")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client")

let io = null

function initSocket(server) {
  console.log("🔌 JS: Initializing WebSocket server...")
  console.log("🔌 Environment:", process.env.NODE_ENV)
  console.log("🔌 NEXTAUTH_URL:", process.env.NEXTAUTH_URL)

  const corsOrigins =
    process.env.NODE_ENV === "production"
      ? [
          process.env.NEXTAUTH_URL,
          "http://localhost",
          "https://localhost",
          /^https?:\/\/.*$/, // すべてのHTTP/HTTPSを許可（プロダクション環境）
          /^http:\/\/\d+\.\d+\.\d+\.\d+(:\d+)?$/, // IPアドレス（ポート付き可）を許可
          /^http:\/\/.*\.local(:\d+)?$/, // .localドメイン許可
        ].filter(Boolean)
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3000",
          /^http:\/\/.*$/,
        ]

  console.log("🔌 CORS origins:", corsOrigins)

  io = new SocketIOServer(server, {
    cors: {
      origin: corsOrigins,
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    },
    transports: ["websocket", "polling"],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e6,
  })

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id)

    // ルーム参加
    socket.on("join_room", async (data) => {
      try {
        const { roomCode, playerId } = data
        console.log(`Player ${playerId} attempting to join room ${roomCode}`)

        const prisma = new PrismaClient()

        try {
          // ゲーム存在確認
          const game = await prisma.game.findFirst({
            where: { roomCode: roomCode.toUpperCase() },
            include: {
              participants: {
                include: { player: true },
              },
            },
          })

          if (!game) {
            socket.emit("error", { message: "ルームが見つかりません" })
            return
          }

          // プレイヤーが既に参加しているかチェック
          const existingParticipant = game.participants.find(
            (p) => p.playerId === playerId
          )

          if (!existingParticipant) {
            // プレイヤーが参加者リストにない場合は警告だけ出してルームには参加させる
            console.log(
              `Warning: Player ${playerId} not in participant list for room ${roomCode}`
            )
            // socket.emit('error', { message: 'プレイヤーが登録されていません' })
            // return
          }

          // ソケットをルームに追加
          socket.join(roomCode.toUpperCase())
          console.log(`Player ${playerId} joined room ${roomCode}`)

          // 現在のゲーム状態を送信
          const gameState = await getGameState(game.id, prisma)
          socket.emit("game_state", gameState)

          // 他のプレイヤーに接続通知
          socket.to(roomCode.toUpperCase()).emit("player_connected", {
            playerId,
            gameState,
          })
        } finally {
          await prisma.$disconnect()
        }
      } catch (error) {
        console.error("Room join error:", error)
        socket.emit("error", { message: "ルーム参加に失敗しました" })
      }
    })

    // セッション継続投票
    socket.on("continue-vote", async (data) => {
      try {
        const { gameId, playerId, vote } = data
        console.log(
          `Continue vote received: ${playerId} voted ${vote} for game ${gameId}`
        )

        const prisma = new PrismaClient()

        try {
          const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
              participants: {
                include: { player: true },
              },
            },
          })

          if (!game) {
            socket.emit("error", { message: "ゲームが見つかりません" })
            return
          }

          // 投票を他のプレイヤーに通知
          socket.to(game.roomCode).emit("continue-vote", { playerId, vote })
          console.log(
            `Broadcasting vote to room ${game.roomCode}: ${playerId} voted ${vote}`
          )

          // 投票状況をMapで管理（より安全）
          const voteKey = `votes_${gameId}`
          if (!global.continueVotes) {
            global.continueVotes = new Map()
          }
          if (!global.continueVotes.has(voteKey)) {
            global.continueVotes.set(voteKey, new Map())
          }

          const gameVotes = global.continueVotes.get(voteKey)
          gameVotes.set(playerId, vote)
          console.log(
            `Vote stored: ${playerId} voted ${vote} for game ${gameId}`
          )

          // 全員の投票をチェック
          const allPlayers = game.participants.map((p) => p.playerId)
          const votes = {}
          allPlayers.forEach((pid) => {
            votes[pid] = gameVotes.get(pid)
          })

          const allVoted = allPlayers.every((pid) => gameVotes.has(pid))
          const allAgreed = allPlayers.every(
            (pid) => gameVotes.get(pid) === true
          )

          console.log(`Vote status for game ${gameId}:`, {
            votes,
            allVoted,
            allAgreed,
            allPlayers,
          })

          if (allVoted && allAgreed) {
            // 全員が合意した場合、新しいルームを作成
            console.log(
              `All players agreed for game ${gameId}, creating new room...`
            )

            try {
              const response = await fetch(
                `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/game/${gameId}/rematch`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    continueSession: true,
                  }),
                }
              )

              const result = await response.json()

              if (response.ok && result.success) {
                // 新しいルームができたことを全員に通知
                io.to(game.roomCode).emit("new-room-ready", {
                  roomCode: result.data.roomCode,
                  gameId: result.data.gameId,
                  sessionId: result.data.sessionId,
                })

                // 投票データをクリア
                global.continueVotes.delete(voteKey)
                console.log(
                  `Successfully created new room ${result.data.roomCode} for session continuation`
                )
              } else {
                console.error(
                  "Failed to create new room:",
                  result.error?.message
                )
                // エラー時も投票データをクリア
                global.continueVotes.delete(voteKey)
                io.to(game.roomCode).emit("error", {
                  message: "新しいルーム作成に失敗しました",
                })
              }
            } catch (error) {
              console.error("Error creating new room:", error)
              // エラー時も投票データをクリア
              global.continueVotes.delete(voteKey)
              io.to(game.roomCode).emit("error", {
                message: "新しいルーム作成に失敗しました",
              })
            }
          } else if (vote === false) {
            // 誰かがキャンセル（vote: false）した場合、即座に投票をリセット
            console.log(
              `Player ${playerId} cancelled vote for game ${gameId}, clearing all votes`
            )
            global.continueVotes.delete(voteKey)
            io.to(game.roomCode).emit("vote-cancelled", {
              message: `${game.participants.find((p) => p.playerId === playerId)?.player.name || "プレイヤー"}がキャンセルしました`,
            })
          }
        } finally {
          await prisma.$disconnect()
        }
      } catch (error) {
        console.error("Continue vote error:", error)
        // エラー時は投票データをクリア
        const voteKey = `votes_${data?.gameId}`
        if (global.continueVotes && voteKey) {
          global.continueVotes.delete(voteKey)
        }
        socket.emit("error", { message: "投票処理に失敗しました" })
      }
    })

    // 切断処理
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id)
    })
  })

  // プロセスに保存
  process.__socketio = io
  console.log("🔌 JS: WebSocket instance saved to process")

  return io
}

async function getGameState(gameId, prismaInstance = null) {
  const prisma = prismaInstance || new PrismaClient()
  const shouldDisconnect = !prismaInstance

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        participants: {
          include: { player: true },
          orderBy: { position: "asc" },
        },
      },
    })

    if (!game) {
      throw new Error("Game not found")
    }

    return {
      gameId: game.id,
      players: game.participants.map((p) => ({
        playerId: p.playerId,
        name: p.player.name,
        position: p.position,
        points: p.currentPoints,
        isReach: p.isReach,
        isConnected: true, // TODO: 実際の接続状態を管理
      })),
      currentRound: game.currentRound,
      currentOya: game.currentOya,
      honba: game.honba,
      kyotaku: game.kyotaku,
      gamePhase: game.status.toLowerCase(),
    }
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect()
    }
  }
}

function getIO() {
  if (io) {
    console.log("🔌 JS: getIO() returning local io instance")
    return io
  }

  if (process.__socketio) {
    io = process.__socketio
    console.log("🔌 JS: getIO() returning process.__socketio instance")
    return io
  }

  console.log("🔌 JS: getIO() - no WebSocket instance found")
  return null
}

module.exports = {
  initSocket,
  getIO,
}
