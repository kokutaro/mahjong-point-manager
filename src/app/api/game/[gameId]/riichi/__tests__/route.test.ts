import { POST } from "@/app/api/game/[gameId]/riichi/route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"

// Prismaのモック
jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: {
      findUnique: jest.fn(),
    },
    soloGame: {
      findUnique: jest.fn(),
    },
  },
}))

// PointManagerのモック
jest.mock("@/lib/point-manager", () => ({
  PointManager: jest.fn().mockImplementation(() => ({
    declareReach: jest.fn(),
    getGameState: jest.fn(),
    getGameInfo: jest.fn(),
  })),
}))

// Solo score managerのモック
jest.mock("@/lib/solo/score-manager", () => ({
  declareSoloReach: jest.fn(),
}))

// WebSocketの処理をモック化
const mockSocketIO = {
  to: jest.fn().mockReturnValue({
    emit: jest.fn(),
  }),
}

describe("POST /api/game/[gameId]/riichi", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>
  const mockGameId = "test-game-id"
  const mockSoloGameId = "test-solo-game-id"

  beforeEach(() => {
    jest.clearAllMocks()
    // WebSocketのモック設定
    process.__socketio = mockSocketIO
  })

  afterEach(() => {
    delete process.__socketio
  })

  describe("マルチプレイヤーゲーム", () => {
    const mockGameData = {
      id: mockGameId,
      roomCode: "TEST123",
      status: "playing",
    }

    const mockGameState = {
      gamePhase: "playing",
      players: [
        { playerId: "player1", position: 0, score: 25000, isReach: false },
        { playerId: "player2", position: 1, score: 25000, isReach: false },
        { playerId: "player3", position: 2, score: 25000, isReach: false },
        { playerId: "player4", position: 3, score: 25000, isReach: false },
      ],
      currentOya: 0,
      kyotaku: 0,
    }

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PointManager = require("@/lib/point-manager").PointManager

      mockPrisma.game.findUnique.mockResolvedValue(mockGameData)
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)

      const mockPointManager = new PointManager()
      mockPointManager.declareReach.mockResolvedValue(undefined)
      mockPointManager.getGameState.mockResolvedValue({
        ...mockGameState,
        players: [
          { playerId: "player1", position: 0, score: 24000, isReach: true },
          ...mockGameState.players.slice(1),
        ],
        kyotaku: 1000,
      })
      mockPointManager.getGameInfo.mockResolvedValue(mockGameData)
    })

    it("マルチプレイゲームでの正常なリーチ宣言", async () => {
      const requestBody = {
        playerId: "player1",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data.gameMode).toBe("MULTIPLAYER")
      expect(responseData.data.message).toContain("player1 がリーチしました")

      // PointManagerのメソッドが正しく呼ばれることを確認
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PointManager = require("@/lib/point-manager").PointManager
      const mockPointManager = new PointManager()
      expect(mockPointManager.declareReach).toHaveBeenCalledWith("player1")
    })

    it("WebSocket通知の送信確認", async () => {
      const requestBody = {
        playerId: "player2",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockGameId }
      await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(mockSocketIO.to).toHaveBeenCalledWith("TEST123")
      expect(mockSocketIO.to().emit).toHaveBeenCalledWith("riichi_declared", {
        gameState: expect.any(Object),
        playerId: "player2",
      })
    })

    it("バリデーションエラー: 数値のプレイヤーIDを指定", async () => {
      const requestBody = {
        playerId: 0, // マルチプレイでは文字列である必要がある
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
      const responseData = await response.json()
      expect(responseData.error.details.code).toBe("VALIDATION_ERROR")
    })
  })

  describe("ソロプレイゲーム", () => {
    const mockSoloGameData = {
      id: mockSoloGameId,
      status: "PLAYING",
      currentRound: 1,
      players: [
        {
          id: "solo-player-1",
          position: 0,
          name: "Player 1",
          currentPoints: 25000,
          isReach: false,
        },
        {
          id: "solo-player-2",
          position: 1,
          name: "Player 2",
          currentPoints: 25000,
          isReach: false,
        },
        {
          id: "solo-player-3",
          position: 2,
          name: "Player 3",
          currentPoints: 25000,
          isReach: false,
        },
        {
          id: "solo-player-4",
          position: 3,
          name: "Player 4",
          currentPoints: 25000,
          isReach: false,
        },
      ],
    }

    const mockUpdatedGameState = {
      gamePhase: "playing",
      players: [
        { position: 0, name: "Player 1", score: 24000, isReach: true },
        { position: 1, name: "Player 2", score: 25000, isReach: false },
        { position: 2, name: "Player 3", score: 25000, isReach: false },
        { position: 3, name: "Player 4", score: 25000, isReach: false },
      ],
      kyotaku: 1000,
    }

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const declareSoloReach =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("@/lib/solo/score-manager").declareSoloReach

      mockPrisma.game.findUnique.mockResolvedValue(null)
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockSoloGameData)

      declareSoloReach.mockResolvedValue(mockUpdatedGameState)
    })

    it("ソロゲームでの正常なリーチ宣言（位置指定）", async () => {
      const requestBody = {
        playerId: 0,
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data.gameMode).toBe("SOLO")
      expect(responseData.data.message).toContain("Player 1がリーチしました")

      // declareSoloReachが正しい引数で呼ばれることを確認
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const declareSoloReach =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("@/lib/solo/score-manager").declareSoloReach
      expect(declareSoloReach).toHaveBeenCalledWith(mockSoloGameId, 0, 1)
    })

    it("ソロゲームでの後方互換性（position指定）", async () => {
      const requestBody = {
        playerId: "some-string", // 文字列でも
        position: 1, // positionが指定されていれば動作する
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data.gameMode).toBe("SOLO")
      expect(responseData.data.message).toContain("Player 2がリーチしました")
    })

    it("ソロゲームでのカスタムラウンド指定", async () => {
      const requestBody = {
        playerId: 2,
        round: 5,
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockSoloGameId }
      await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const declareSoloReach =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("@/lib/solo/score-manager").declareSoloReach
      expect(declareSoloReach).toHaveBeenCalledWith(mockSoloGameId, 2, 5)
    })

    it("バリデーションエラー: 無効な位置", async () => {
      const requestBody = {
        playerId: 5, // 無効な位置（0-3のみ有効）
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
    })

    it("バリデーションエラー: 位置が指定されていない", async () => {
      const requestBody = {
        playerId: "string-but-no-position", // 文字列でpositionもない
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
      const responseData = await response.json()
      expect(responseData.error.details.code).toBe("VALIDATION_ERROR")
    })

    it("ゲーム状態エラー: 非プレイ状態", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue({
        ...mockSoloGameData,
        status: "ENDED", // プレイ中でない
      })

      const requestBody = {
        playerId: 0,
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
      const responseData = await response.json()
      expect(responseData.error.details.code).toBe("GAME_NOT_PLAYING")
    })

    it("バリデーションエラー: 存在しないプレイヤー位置", async () => {
      const requestBody = {
        playerId: 0,
      }

      // プレイヤーが存在しないゲームデータを設定
      mockPrisma.soloGame.findUnique.mockResolvedValue({
        ...mockSoloGameData,
        players: [], // プレイヤーなし
      })

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
    })

    it("バリデーションエラー: すでにリーチ済み", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue({
        ...mockSoloGameData,
        players: [
          {
            ...mockSoloGameData.players[0],
            isReach: true, // すでにリーチ済み
          },
          ...mockSoloGameData.players.slice(1),
        ],
      })

      const requestBody = {
        playerId: 0,
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
    })

    it("バリデーションエラー: 点数不足", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue({
        ...mockSoloGameData,
        players: [
          {
            ...mockSoloGameData.players[0],
            currentPoints: 500, // リーチに必要な1000点未満
          },
          ...mockSoloGameData.players.slice(1),
        ],
      })

      const requestBody = {
        playerId: 0,
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
    })
  })

  describe("エラーケース", () => {
    it("ゲームが見つからない場合", async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null)
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)

      const requestBody = {
        playerId: "player1",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: "nonexistent-game" }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(404)
      const responseData = await response.json()
      expect(responseData.error.details.code).toBe("GAME_NOT_FOUND")
    })

    it("無効なリクエストボディ", async () => {
      const requestBody = {
        // playerIdが不足
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
    })

    it("無効な位置の範囲", async () => {
      const requestBody = {
        playerId: "player1",
        position: -1, // 無効な位置
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
    })

    it("無効なラウンド数", async () => {
      const requestBody = {
        playerId: 0,
        round: 0, // 無効なラウンド数（正数である必要）
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
    })
  })
})
