import { POST } from "@/app/api/game/[gameId]/score/route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"
import { calculateScore } from "@/lib/score"

const mockPointManager = {
  getGameState: jest.fn(),
  distributeWinPoints: jest.fn(),
  getGameInfo: jest.fn(),
}

const mockSoloPointManager = {
  getGameState: jest.fn(),
  distributeWinPoints: jest.fn(),
}

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
  PointManager: jest.fn(() => mockPointManager),
}))

// SoloPointManagerのモック
jest.mock("@/lib/solo/solo-point-manager", () => ({
  SoloPointManager: jest.fn(() => mockSoloPointManager),
}))

// scoreライブラリのモック
jest.mock("@/lib/score", () => ({
  calculateScore: jest.fn(),
}))

// WebSocketの処理をモック化
const mockSocketIO = {
  to: jest.fn().mockReturnValue({
    emit: jest.fn(),
  }),
}

describe("POST /api/game/[gameId]/score", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>
  const mockGameId = "test-game-id"
  const mockSoloGameId = "test-solo-game-id"

  beforeEach(() => {
    jest.clearAllMocks()
    // WebSocketのモック設定
    process.__socketio = mockSocketIO
    Object.values(mockPointManager).forEach((fn) =>
      (fn as jest.Mock).mockReset()
    )
    Object.values(mockSoloPointManager).forEach((fn) =>
      (fn as jest.Mock).mockReset()
    )
    ;(calculateScore as jest.Mock).mockReset()
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
        { playerId: "player1", position: 0, score: 25000 },
        { playerId: "player2", position: 1, score: 25000 },
        { playerId: "player3", position: 2, score: 25000 },
        { playerId: "player4", position: 3, score: 25000 },
      ],
      currentOya: 0,
      honba: 0,
      kyotaku: 0,
    }

    const mockScoreResult = {
      oyaPayment: 12000,
      koPayment: 6000,
      totalPayment: 18000,
    }

    beforeEach(() => {
      mockPrisma.game.findUnique.mockResolvedValue(mockGameData)
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)

      mockPointManager.getGameState.mockResolvedValue(mockGameState)
      mockPointManager.distributeWinPoints.mockResolvedValue({
        gameEnded: false,
        reason: "",
      })
      mockPointManager.getGameInfo.mockResolvedValue(mockGameData)

      calculateScore.mockResolvedValue(mockScoreResult)
    })

    it("ツモ和了の正常系テスト", async () => {
      const requestBody = {
        winnerId: "player1",
        han: 2,
        fu: 30,
        isTsumo: true,
        honba: 0,
        kyotaku: 0,
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
      expect(responseData.data.scoreResult).toEqual(mockScoreResult)
    })

    it("ロン和了の正常系テスト", async () => {
      const requestBody = {
        winnerId: "player1",
        han: 3,
        fu: 40,
        isTsumo: false,
        loserId: "player2",
        honba: 1,
        kyotaku: 1000,
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
    })

    it("ゲーム終了時のWebSocket通知テスト", async () => {
      mockPointManager.distributeWinPoints.mockResolvedValue({
        gameEnded: true,
        reason: "オーラス終了",
      })

      const requestBody = {
        winnerId: "player1",
        han: 13,
        fu: 30,
        isTsumo: true,
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
      expect(mockSocketIO.to().emit).toHaveBeenCalledWith("game_ended", {
        gameState: mockGameState,
        reason: "オーラス終了",
        finalResults: true,
      })
    })

    it("バリデーションエラー: ツモ時に敗者を指定", async () => {
      const requestBody = {
        winnerId: "player1",
        han: 2,
        fu: 30,
        isTsumo: true,
        loserId: "player2", // ツモ時に敗者指定はエラー
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

    it("バリデーションエラー: ロン時に敗者未指定", async () => {
      const requestBody = {
        winnerId: "player1",
        han: 2,
        fu: 30,
        isTsumo: false,
        // loserId未指定
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

    it("バリデーションエラー: 勝者と敗者が同じ", async () => {
      const requestBody = {
        winnerId: "player1",
        han: 2,
        fu: 30,
        isTsumo: false,
        loserId: "player1", // 勝者と敗者が同じ
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

    it("ゲーム状態エラー: ゲームが非アクティブ", async () => {
      mockPointManager.getGameState.mockResolvedValue({
        ...mockGameState,
        gamePhase: "ended",
      })

      const requestBody = {
        winnerId: "player1",
        han: 2,
        fu: 30,
        isTsumo: true,
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(500)
    })
  })

  describe("ソロプレイゲーム", () => {
    const mockSoloGameData = {
      id: mockSoloGameId,
      status: "playing",
    }

    const mockSoloGameState = {
      gamePhase: "playing",
      players: [
        { position: 0, name: "Player 1", score: 25000 },
        { position: 1, name: "Player 2", score: 25000 },
        { position: 2, name: "Player 3", score: 25000 },
        { position: 3, name: "Player 4", score: 25000 },
      ],
      currentOya: 0,
      honba: 0,
      kyotaku: 0,
    }

    const mockScoreResult = {
      oyaPayment: 12000,
      koPayment: 6000,
      totalPayment: 18000,
    }

    beforeEach(() => {
      mockPrisma.game.findUnique.mockResolvedValue(null)
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockSoloGameData)

      mockSoloPointManager.getGameState.mockResolvedValue(mockSoloGameState)
      mockSoloPointManager.distributeWinPoints.mockResolvedValue({
        gameEnded: false,
        reason: "",
      })

      calculateScore.mockResolvedValue(mockScoreResult)
    })

    it("ソロゲームのツモ和了テスト", async () => {
      const requestBody = {
        winnerId: 0,
        han: 2,
        fu: 30,
        isTsumo: true,
        honba: 0,
        kyotaku: 0,
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
    })

    it("ソロゲームのロン和了テスト", async () => {
      const requestBody = {
        winnerId: 1,
        han: 1,
        fu: 30,
        isTsumo: false,
        loserId: 2,
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
    })

    it("ソロゲーム位置バリデーションエラー: 無効な勝者位置", async () => {
      const requestBody = {
        winnerId: 5, // 無効な位置（0-3のみ有効）
        han: 2,
        fu: 30,
        isTsumo: true,
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

    it("ソロゲーム位置バリデーションエラー: 無効な敗者位置", async () => {
      const requestBody = {
        winnerId: 0,
        han: 2,
        fu: 30,
        isTsumo: false,
        loserId: -1, // 無効な位置
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
        winnerId: "player1",
        han: 2,
        fu: 30,
        isTsumo: true,
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: "nonexistent-game" }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(500)
    })

    it("無効なリクエストボディ", async () => {
      const requestBody = {
        // 必須フィールドが不足
        han: 2,
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

    it("範囲外の翻数", async () => {
      const requestBody = {
        winnerId: "player1",
        han: 15, // 最大13を超過
        fu: 30,
        isTsumo: true,
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

    it("範囲外の符数", async () => {
      const requestBody = {
        winnerId: "player1",
        han: 2,
        fu: 150, // 最大110を超過
        isTsumo: true,
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
