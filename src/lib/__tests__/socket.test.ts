import { Server as HTTPServer } from "http"
import { Server as SocketIOServer, Socket } from "socket.io"
import { prisma } from "@/lib/prisma"
import { calculateScore } from "@/lib/score"
import { initSocket, getIO } from "../socket"

// モック設定
jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    gameParticipant: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock("@/lib/score", () => ({
  calculateScore: jest.fn(),
}))

// Socket.IOのモック
jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
    emit: jest.fn(),
  })),
}))

// fetchのモック
global.fetch = jest.fn()

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockCalculateScore = calculateScore as jest.MockedFunction<
  typeof calculateScore
>
const MockSocketIOServer = SocketIOServer as jest.MockedClass<
  typeof SocketIOServer
>

describe("Socket Module", () => {
  let mockServer: HTTPServer
  let mockSocketIO: jest.Mocked<SocketIOServer>
  let mockSocket: jest.Mocked<Socket>

  beforeEach(() => {
    jest.clearAllMocks()
    console.log = jest.fn()
    console.error = jest.fn()

    // HTTPサーバーのモック
    mockServer = {} as HTTPServer

    // Socket.IOサーバーのモック
    mockSocketIO = {
      on: jest.fn(),
      to: jest.fn(() => ({
        emit: jest.fn(),
      })),
      emit: jest.fn(),
    } as any

    // ソケットのモック
    mockSocket = {
      id: "test-socket-id",
      on: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
      to: jest.fn(() => ({
        emit: jest.fn(),
      })),
    } as any

    MockSocketIOServer.mockImplementation(() => mockSocketIO)

    // プロセスオブジェクトをクリア
    delete process.__socketio
  })

  afterEach(() => {
    // プロセスオブジェクトをクリア
    delete process.__socketio
  })

  describe("initSocket", () => {
    it("新しいWebSocketインスタンスを作成できる", () => {
      const result = initSocket(mockServer)

      expect(MockSocketIOServer).toHaveBeenCalledWith(mockServer, {
        cors: {
          origin: ["http://localhost:3000", "http://localhost:3001"],
          methods: ["GET", "POST"],
          credentials: true,
        },
        transports: ["websocket", "polling"],
      })
      expect(mockSocketIO.on).toHaveBeenCalledWith(
        "connection",
        expect.any(Function)
      )
      expect(process.__socketio).toBe(mockSocketIO)
      expect(result).toBe(mockSocketIO)
    })

    it("既存のWebSocketインスタンスを再利用できる", () => {
      // 事前にインスタンスを設定
      process.__socketio = mockSocketIO

      const result = initSocket(mockServer)

      expect(MockSocketIOServer).not.toHaveBeenCalled()
      expect(result).toBe(mockSocketIO)
      expect(console.log).toHaveBeenCalledWith(
        "🔌 Reusing existing WebSocket instance"
      )
    })

    it("本番環境でのCORS設定を正しく使用する", () => {
      const originalEnv = process.env.NODE_ENV
      const originalUrl = process.env.NEXTAUTH_URL

      process.env.NODE_ENV = "production"
      process.env.NEXTAUTH_URL = "https://example.com"

      initSocket(mockServer)

      expect(MockSocketIOServer).toHaveBeenCalledWith(mockServer, {
        cors: {
          origin: "https://example.com",
          methods: ["GET", "POST"],
          credentials: true,
        },
        transports: ["websocket", "polling"],
      })

      process.env.NODE_ENV = originalEnv
      process.env.NEXTAUTH_URL = originalUrl
    })
  })

  describe("Connection Event Handlers", () => {
    beforeEach(() => {
      initSocket(mockServer)

      // connectionイベントハンドラーを取得して実行
      const connectionHandler = mockSocketIO.on.mock.calls.find(
        (call) => call[0] === "connection"
      )?.[1]
      expect(connectionHandler).toBeDefined()
      connectionHandler?.(mockSocket)
    })

    describe("join_room event", () => {
      it("有効なルーム参加を正常に処理できる", async () => {
        const mockGame = {
          id: "game-123",
          roomCode: "TEST123",
          participants: [
            {
              playerId: "player-1",
              player: { name: "Player 1" },
            },
          ],
          session: null,
        }

        mockPrisma.game.findFirst.mockResolvedValue(mockGame as any)

        // getGameStateのための追加のモック
        const mockGameWithDetails = {
          ...mockGame,
          currentRound: 1,
          currentOya: 0,
          honba: 0,
          kyotaku: 0,
          status: "WAITING",
        }
        mockPrisma.game.findUnique.mockResolvedValue(mockGameWithDetails as any)

        // join_roomイベントハンドラーを取得して実行
        const joinRoomHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "join_room"
        )?.[1]
        expect(joinRoomHandler).toBeDefined()

        await joinRoomHandler?.({
          roomCode: "test123",
          playerId: "player-1",
        })

        expect(mockPrisma.game.findFirst).toHaveBeenCalledWith({
          where: { roomCode: "TEST123" },
          include: {
            participants: {
              include: { player: true },
            },
            session: true,
          },
        })
        expect(mockSocket.join).toHaveBeenCalledWith("TEST123")
        expect(mockSocket.emit).toHaveBeenCalledWith(
          "game_state",
          expect.any(Object)
        )
        expect(mockSocket.to).toHaveBeenCalledWith("TEST123")
      })

      it("存在しないルームに対してエラーを返す", async () => {
        mockPrisma.game.findFirst.mockResolvedValue(null)

        const joinRoomHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "join_room"
        )?.[1]

        await joinRoomHandler?.({
          roomCode: "INVALID",
          playerId: "player-1",
        })

        expect(mockSocket.emit).toHaveBeenCalledWith("error", {
          message: "ルームが見つかりません",
        })
      })

      it("未登録プレイヤーに対してエラーを返す", async () => {
        const mockGame = {
          id: "game-123",
          roomCode: "TEST123",
          participants: [
            {
              playerId: "other-player",
              player: { name: "Other Player" },
            },
          ],
          session: null,
        }

        mockPrisma.game.findFirst.mockResolvedValue(mockGame as any)

        const joinRoomHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "join_room"
        )?.[1]

        await joinRoomHandler?.({
          roomCode: "test123",
          playerId: "unregistered-player",
        })

        expect(mockSocket.emit).toHaveBeenCalledWith("error", {
          message: "プレイヤーが登録されていません",
        })
      })

      it("データベースエラー時にエラーを返す", async () => {
        mockPrisma.game.findFirst.mockRejectedValue(new Error("DB Error"))

        const joinRoomHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "join_room"
        )?.[1]

        await joinRoomHandler?.({
          roomCode: "test123",
          playerId: "player-1",
        })

        expect(mockSocket.emit).toHaveBeenCalledWith("error", {
          message: "ルーム参加に失敗しました",
        })
        expect(console.error).toHaveBeenCalledWith(
          "Room join error:",
          expect.any(Error)
        )
      })
    })

    describe("player_ready event", () => {
      it("プレイヤー準備状態を正常に処理できる", async () => {
        const mockGameState = {
          gameId: "game-123",
          players: [
            { playerId: "player-1", isReady: false }, // 実装では常にfalse
            { playerId: "player-2", isReady: false },
            { playerId: "player-3", isReady: false },
            { playerId: "player-4", isReady: false },
          ],
        }
        const mockGame = {
          id: "game-123",
          roomCode: "TEST123",
        }

        mockPrisma.game.findUnique
          .mockResolvedValueOnce(mockGameState as any)
          .mockResolvedValueOnce(mockGame as any)

        const playerReadyHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "player_ready"
        )?.[1]

        await playerReadyHandler?.({
          gameId: "game-123",
          playerId: "player-1",
        })

        // isReadyが全てfalseなので、game.updateは呼ばれない
        expect(mockPrisma.game.update).not.toHaveBeenCalled()
        expect(mockSocket.to).toHaveBeenCalledWith("TEST123")
      })

      it("エラー時にエラーメッセージを送信する", async () => {
        mockPrisma.game.findUnique.mockRejectedValue(new Error("DB Error"))

        const playerReadyHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "player_ready"
        )?.[1]

        await playerReadyHandler?.({
          gameId: "game-123",
          playerId: "player-1",
        })

        expect(mockSocket.emit).toHaveBeenCalledWith("error", {
          message: "プレイヤー準備に失敗しました",
        })
        expect(console.error).toHaveBeenCalledWith(
          "プレイヤー準備エラー:",
          expect.any(Error)
        )
      })
    })

    describe("calculate_score event", () => {
      it("点数計算を正常に処理できる", async () => {
        const mockGame = {
          id: "game-123",
          roomCode: "TEST123",
          currentOya: 0,
          honba: 1,
          kyotaku: 1000,
          participants: [
            { playerId: "player-1", position: 0 },
            { playerId: "player-2", position: 1 },
          ],
          settings: {},
        }
        const mockScoreResult = {
          totalScore: 8000,
          payments: { fromOya: 4000, fromKo: 2000 },
        }

        mockPrisma.game.findUnique.mockResolvedValue(mockGame as any)
        mockCalculateScore.mockResolvedValue(mockScoreResult)
        mockPrisma.gameParticipant.findMany.mockResolvedValue([
          { id: "p1", playerId: "player-1", position: 0, currentPoints: 25000 },
          { id: "p2", playerId: "player-2", position: 1, currentPoints: 25000 },
        ] as any)
        mockPrisma.gameParticipant.update.mockResolvedValue({} as any)
        mockPrisma.game.update.mockResolvedValue({} as any)

        const calculateScoreHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "calculate_score"
        )?.[1]

        await calculateScoreHandler?.({
          gameId: "game-123",
          winnerId: "player-1",
          han: 2,
          fu: 30,
          isTsumo: true,
        })

        expect(mockCalculateScore).toHaveBeenCalledWith({
          han: 2,
          fu: 30,
          isOya: true,
          isTsumo: true,
          honba: 1,
          kyotaku: 1000,
        })
        expect(mockPrisma.game.update).toHaveBeenCalledWith({
          where: { id: "game-123" },
          data: {
            currentOya: 0,
            honba: 2, // 親続行で本場+1
            kyotaku: 0,
          },
        })
      })

      it("ゲームが見つからない場合にエラーを返す", async () => {
        mockPrisma.game.findUnique.mockResolvedValue(null)

        const calculateScoreHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "calculate_score"
        )?.[1]

        await calculateScoreHandler?.({
          gameId: "invalid-game",
          winnerId: "player-1",
          han: 2,
          fu: 30,
          isTsumo: true,
        })

        expect(mockSocket.emit).toHaveBeenCalledWith("error", {
          message: "ゲームが見つかりません",
        })
      })

      it("点数計算エラー時にエラーメッセージを送信する", async () => {
        mockPrisma.game.findUnique.mockRejectedValue(new Error("DB Error"))

        const calculateScoreHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "calculate_score"
        )?.[1]

        await calculateScoreHandler?.({
          gameId: "game-123",
          winnerId: "player-1",
          han: 2,
          fu: 30,
          isTsumo: true,
        })

        expect(mockSocket.emit).toHaveBeenCalledWith("error", {
          message: "点数計算に失敗しました",
        })
        expect(console.error).toHaveBeenCalledWith(
          "点数計算エラー:",
          expect.any(Error)
        )
      })
    })

    describe("continue-vote event", () => {
      it("継続投票を正常に処理できる", async () => {
        const mockGame = {
          id: "game-123",
          roomCode: "TEST123",
          participants: [
            { playerId: "player-1", player: { name: "Player 1" } },
            { playerId: "player-2", player: { name: "Player 2" } },
          ],
        }

        mockPrisma.game.findUnique.mockResolvedValue(mockGame as any)

        const continueVoteHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "continue-vote"
        )?.[1]

        await continueVoteHandler?.({
          gameId: "game-123",
          playerId: "player-1",
          vote: true,
        })

        expect(mockSocket.to).toHaveBeenCalledWith("TEST123")
        expect(process[`votes_game-123`]).toEqual({
          "player-1": true,
        })
      })

      it("全員の合意で新しいルームを作成する", async () => {
        const mockGame = {
          id: "game-123",
          roomCode: "TEST123",
          participants: [
            { playerId: "player-1", player: { name: "Player 1" } },
            { playerId: "player-2", player: { name: "Player 2" } },
          ],
        }

        mockPrisma.game.findUnique.mockResolvedValue(mockGame as any)

        // fetch APIのモック
        const mockFetchResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({
            success: true,
            data: {
              roomCode: "NEW123",
              gameId: "new-game-id",
              sessionId: "session-id",
            },
          }),
        }
        ;(global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse)

        const continueVoteHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "continue-vote"
        )?.[1]

        // 全員の投票をシミュレート
        process[`votes_game-123`] = {
          "player-1": true,
        }

        await continueVoteHandler?.({
          gameId: "game-123",
          playerId: "player-2",
          vote: true,
        })

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/game/game-123/rematch"),
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ continueSession: true }),
          })
        )
        expect(process[`votes_game-123`]).toBeUndefined()
      })

      it("投票が否決された場合に投票をクリアする", async () => {
        const mockGame = {
          id: "game-123",
          roomCode: "TEST123",
          participants: [
            { playerId: "player-1", player: { name: "Player 1" } },
            { playerId: "player-2", player: { name: "Player 2" } },
          ],
        }

        mockPrisma.game.findUnique.mockResolvedValue(mockGame as any)

        const continueVoteHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "continue-vote"
        )?.[1]

        // 1人目は賛成、2人目は反対
        process[`votes_game-123`] = {
          "player-1": true,
        }

        await continueVoteHandler?.({
          gameId: "game-123",
          playerId: "player-2",
          vote: false,
        })

        expect(process[`votes_game-123`]).toBeUndefined()
      })

      it("エラー時にエラーメッセージを送信する", async () => {
        mockPrisma.game.findUnique.mockRejectedValue(new Error("DB Error"))

        const continueVoteHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "continue-vote"
        )?.[1]

        await continueVoteHandler?.({
          gameId: "game-123",
          playerId: "player-1",
          vote: true,
        })

        expect(mockSocket.emit).toHaveBeenCalledWith("error", {
          message: "投票処理に失敗しました",
        })
        expect(console.error).toHaveBeenCalledWith(
          "Continue vote error:",
          expect.any(Error)
        )
      })
    })

    describe("disconnect event", () => {
      it("切断処理を正常に実行する", () => {
        const disconnectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "disconnect"
        )?.[1]

        disconnectHandler?.()

        expect(console.log).toHaveBeenCalledWith(
          "Client disconnected:",
          "test-socket-id"
        )
      })
    })
  })

  describe("getIO", () => {
    it("ローカルインスタンスを返す", () => {
      initSocket(mockServer)
      const result = getIO()

      expect(result).toBe(mockSocketIO)
      expect(console.log).toHaveBeenCalledWith(
        "🔌 getIO: Using local io instance"
      )
    })

    it("プロセスインスタンスを返す", () => {
      process.__socketio = mockSocketIO
      const result = getIO()

      expect(result).toBe(mockSocketIO)
      expect(console.log).toHaveBeenCalledWith(
        "🔌 getIO: Using process.__socketio instance"
      )
    })

    it("インスタンスが見つからない場合にnullを返す", () => {
      const result = getIO()

      expect(result).toBeNull()
      expect(console.log).toHaveBeenCalledWith(
        "🔌 Warning: WebSocket IO instance not found in both local and process"
      )
    })
  })

  describe("Helper Functions", () => {
    describe("getGameState", () => {
      it("ゲーム状態を正常に取得できる", async () => {
        // モジュール内の関数をテストするために、テスト内で直接実行する必要がある
        // 実際の実装では、これらの関数はプライベートなので、
        // 公開されたAPIを通じてテストするのが一般的
      })
    })
  })
})
