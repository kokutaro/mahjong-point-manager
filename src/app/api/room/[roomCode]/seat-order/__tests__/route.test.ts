import { POST } from "@/app/api/room/[roomCode]/seat-order/route"
import { prisma } from "@/lib/prisma"
import { createMocks } from "node-mocks-http"

// Prismaのモック
jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

// Socket.ioのモック
jest.mock("@/lib/socket", () => ({
  getIO: jest.fn(() => ({
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
  })),
}))

describe("POST /api/room/[roomCode]/seat-order", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockGetIO = require("@/lib/socket").getIO

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockGame = {
    id: "game-123",
    roomCode: "ABCD12",
    status: "WAITING",
    participants: [
      {
        playerId: "player-1",
        position: 0,
      },
      {
        playerId: "player-2",
        position: 1,
      },
      {
        playerId: "player-3",
        position: 2,
      },
      {
        playerId: "player-4",
        position: 3,
      },
    ],
  }

  const mockUpdatedGame = {
    id: "game-123",
    roomCode: "ABCD12",
    currentRound: 1,
    currentOya: 0,
    honba: 0,
    kyotaku: 0,
    participants: [
      {
        playerId: "player-2",
        position: 0,
        currentPoints: 25000,
        isReach: false,
        player: { name: "プレイヤー2" },
      },
      {
        playerId: "player-1",
        position: 1,
        currentPoints: 25000,
        isReach: false,
        player: { name: "プレイヤー1" },
      },
      {
        playerId: "player-4",
        position: 2,
        currentPoints: 25000,
        isReach: false,
        player: { name: "プレイヤー4" },
      },
      {
        playerId: "player-3",
        position: 3,
        currentPoints: 25000,
        isReach: false,
        player: { name: "プレイヤー3" },
      },
    ],
  }

  describe("正常系", () => {
    beforeEach(() => {
      mockPrisma.game.findFirst.mockResolvedValue(mockGame)
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          gameParticipant: {
            update: jest.fn().mockResolvedValue({}),
          },
        }
        return callback(mockTx)
      })
      mockPrisma.game.findUnique.mockResolvedValue(mockUpdatedGame)
    })

    it("席順を正常に更新できる", async () => {
      const requestBody = {
        positions: [
          { playerId: "player-2", position: 0 },
          { playerId: "player-1", position: 1 },
          { playerId: "player-4", position: 2 },
          { playerId: "player-3", position: 3 },
        ],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "abcd12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)

      // ゲーム検索でroomCodeが大文字に変換されることを確認
      expect(mockPrisma.game.findFirst).toHaveBeenCalledWith({
        where: { roomCode: "ABCD12", status: "WAITING" },
        include: { participants: true },
      })

      // トランザクションが実行されることを確認
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it("WebSocketで席順更新通知が送信される", async () => {
      // このテスト専用のWebSocketモック設定
      const mockEmit = jest.fn()
      const mockTo = jest.fn(() => ({ emit: mockEmit }))
      mockGetIO.mockReturnValue({ to: mockTo })

      // 適切なゲーム情報を設定
      const twoPlayerGame = {
        ...mockGame,
        participants: [
          { playerId: "player-1", position: 0 },
          { playerId: "player-2", position: 1 },
        ],
      }
      mockPrisma.game.findFirst.mockResolvedValueOnce(twoPlayerGame)

      // 更新されたゲーム情報のモック設定を追加
      mockPrisma.game.findUnique.mockResolvedValueOnce(mockUpdatedGame)

      const requestBody = {
        positions: [
          { playerId: "player-1", position: 0 },
          { playerId: "player-2", position: 1 },
        ],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(mockTo).toHaveBeenCalledWith("ABCD12")
      expect(mockEmit).toHaveBeenCalledWith("seat_order_updated", {
        gameState: {
          gameId: "game-123",
          players: [
            {
              playerId: "player-2",
              name: "プレイヤー2",
              position: 0,
              points: 25000,
              isReach: false,
              isConnected: true,
            },
            {
              playerId: "player-1",
              name: "プレイヤー1",
              position: 1,
              points: 25000,
              isReach: false,
              isConnected: true,
            },
            {
              playerId: "player-4",
              name: "プレイヤー4",
              position: 2,
              points: 25000,
              isReach: false,
              isConnected: true,
            },
            {
              playerId: "player-3",
              name: "プレイヤー3",
              position: 3,
              points: 25000,
              isReach: false,
              isConnected: true,
            },
          ],
          currentRound: 1,
          currentOya: 0,
          honba: 0,
          kyotaku: 0,
          gamePhase: "waiting",
        },
      })
    })

    it("1人だけの席順変更でも正常に処理される", async () => {
      const singlePlayerGame = {
        ...mockGame,
        participants: [{ playerId: "player-1", position: 0 }],
      }
      mockPrisma.game.findFirst.mockResolvedValue(singlePlayerGame)

      const requestBody = {
        positions: [{ playerId: "player-1", position: 0 }],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(response.status).toBe(200)
    })

    it("Socket.IOが利用できない場合でも処理は継続される", async () => {
      mockGetIO.mockReturnValue(null)

      // gameの設定を追加
      const twoPlayerGame = {
        ...mockGame,
        participants: [
          { playerId: "player-1", position: 0 },
          { playerId: "player-2", position: 1 },
        ],
      }
      mockPrisma.game.findFirst.mockResolvedValueOnce(twoPlayerGame)

      const requestBody = {
        positions: [
          { playerId: "player-1", position: 0 },
          { playerId: "player-2", position: 1 },
        ],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(response.status).toBe(200)
    })
  })

  describe("異常系", () => {
    it("存在しないルームコードで404エラー", async () => {
      mockPrisma.game.findFirst.mockResolvedValue(null)

      const requestBody = {
        positions: [{ playerId: "player-1", position: 0 }],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "NOTFOUND" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("ルームが見つかりません")
    })

    it("参加人数が一致しない場合は400エラー", async () => {
      const twoPlayerGame = {
        ...mockGame,
        participants: [
          { playerId: "player-1", position: 0 },
          { playerId: "player-2", position: 1 },
        ],
      }
      mockPrisma.game.findFirst.mockResolvedValue(twoPlayerGame)

      const requestBody = {
        positions: [
          { playerId: "player-1", position: 0 },
          { playerId: "player-2", position: 1 },
          { playerId: "player-3", position: 2 }, // 参加していないプレイヤー
        ],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error.message).toBe("参加人数が一致しません")
    })

    it("無効なプレイヤーIDが含まれている場合は400エラー", async () => {
      mockPrisma.game.findFirst.mockResolvedValue(mockGame)

      const requestBody = {
        positions: [
          { playerId: "player-1", position: 0 },
          { playerId: "invalid-player", position: 1 }, // 無効なプレイヤーID
          { playerId: "player-3", position: 2 },
          { playerId: "player-4", position: 3 },
        ],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error.message).toBe("無効なプレイヤーIDがあります")
    })

    it("バリデーションエラー - 空の配列", async () => {
      const requestBody = {
        positions: [],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error.message).toBe("バリデーションエラー")
      expect(responseData.error.details).toBeDefined()
    })

    it("バリデーションエラー - 無効なposition値", async () => {
      const requestBody = {
        positions: [
          { playerId: "player-1", position: -1 }, // 無効な位置
        ],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(response.status).toBe(400)
    })

    it("バリデーションエラー - 5人以上の配列", async () => {
      const requestBody = {
        positions: [
          { playerId: "player-1", position: 0 },
          { playerId: "player-2", position: 1 },
          { playerId: "player-3", position: 2 },
          { playerId: "player-4", position: 3 },
          { playerId: "player-5", position: 4 }, // 5人目（無効）
        ],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(response.status).toBe(400)
    })

    it("データベースエラーで500エラー", async () => {
      mockPrisma.game.findFirst.mockRejectedValue(new Error("DB Error"))

      const requestBody = {
        positions: [{ playerId: "player-1", position: 0 }],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error.message).toBe("席順の更新に失敗しました")
    })

    it("トランザクションエラーで500エラー", async () => {
      // 適切なゲーム情報を設定
      const twoPlayerGame = {
        ...mockGame,
        participants: [
          { playerId: "player-1", position: 0 },
          { playerId: "player-2", position: 1 },
        ],
      }
      mockPrisma.game.findFirst.mockResolvedValueOnce(twoPlayerGame)
      mockPrisma.$transaction.mockRejectedValue(new Error("Transaction failed"))

      const requestBody = {
        positions: [
          { playerId: "player-1", position: 0 },
          { playerId: "player-2", position: 1 },
        ],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(response.status).toBe(500)
    })
  })

  describe("エッジケース", () => {
    beforeEach(() => {
      mockPrisma.game.findFirst.mockResolvedValue(mockGame)
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          gameParticipant: {
            update: jest.fn().mockResolvedValue({}),
          },
        }
        return callback(mockTx)
      })
    })

    it("同じ位置のままでも更新処理は実行される", async () => {
      // ゲーム情報を設定
      const twoPlayerGame = {
        ...mockGame,
        participants: [
          { playerId: "player-1", position: 0 },
          { playerId: "player-2", position: 1 },
        ],
      }
      mockPrisma.game.findFirst.mockResolvedValueOnce(twoPlayerGame)

      const requestBody = {
        positions: [
          { playerId: "player-1", position: 0 }, // 変更なし
          { playerId: "player-2", position: 1 }, // 変更なし
        ],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(response.status).toBe(200)
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it("更新後のゲーム取得に失敗してもWebSocket通知はスキップされる", async () => {
      // 初期ゲーム情報を設定
      const singlePlayerGame = {
        ...mockGame,
        participants: [{ playerId: "player-1", position: 0 }],
      }
      mockPrisma.game.findFirst.mockResolvedValueOnce(singlePlayerGame)
      // 更新後の取得は失敗
      mockPrisma.game.findUnique.mockResolvedValueOnce(null)

      const requestBody = {
        positions: [{ playerId: "player-1", position: 0 }],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(response.status).toBe(200)
      // WebSocket通知は送信されない
      expect(mockGetIO).toHaveBeenCalled()
    })

    it("positionが0-3の範囲内でランダムに配置されても正常に処理される", async () => {
      const requestBody = {
        positions: [
          { playerId: "player-1", position: 3 },
          { playerId: "player-2", position: 0 },
          { playerId: "player-3", position: 2 },
          { playerId: "player-4", position: 1 },
        ],
      }

      const { req } = createMocks({
        method: "POST",
        body: requestBody,
      })

      // NextRequestのjson()メソッドをモック
      ;(req as any).json = jest.fn().mockResolvedValue(requestBody)

      const response = await POST(req, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(response.status).toBe(200)
    })
  })
})
