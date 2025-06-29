import { POST } from "@/app/api/game/[gameId]/ryukyoku/route"
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
    handleRyukyoku: jest.fn(),
    getGameState: jest.fn(),
    getGameInfo: jest.fn(),
  })),
}))

// SoloPointManagerのモック
jest.mock("@/lib/solo/solo-point-manager", () => ({
  SoloPointManager: jest.fn().mockImplementation(() => ({
    handleRyukyoku: jest.fn(),
    getGameState: jest.fn(),
  })),
}))

// WebSocketの処理をモック化
const mockSocketIO = {
  to: jest.fn().mockReturnValue({
    emit: jest.fn(),
  }),
}

declare global {
  namespace NodeJS {
    interface Process {
      __socketio?: typeof mockSocketIO
    }
  }
}

describe("POST /api/game/[gameId]/ryukyoku", () => {
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
        { playerId: "player2", position: 1, score: 25000, isReach: true },
        { playerId: "player3", position: 2, score: 25000, isReach: false },
        { playerId: "player4", position: 3, score: 25000, isReach: false },
      ],
      currentOya: 0,
      kyotaku: 1000,
    }

    beforeEach(() => {
      const PointManager = require("@/lib/point-manager").PointManager

      mockPrisma.game.findUnique.mockResolvedValue(mockGameData)
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)

      const mockPointManager = new PointManager()
      mockPointManager.handleRyukyoku.mockResolvedValue({
        gameEnded: false,
        reason: "",
      })
      mockPointManager.getGameState.mockResolvedValue(mockGameState)
      mockPointManager.getGameInfo.mockResolvedValue(mockGameData)
    })

    it("デフォルト流局（DRAW）の正常系テスト", async () => {
      const requestBody = {
        tenpaiPlayers: ["player1", "player2"],
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
      expect(responseData.data.message).toContain("2人テンパイ流局")

      // PointManagerのメソッドが正しく呼ばれることを確認
      const PointManager = require("@/lib/point-manager").PointManager
      const mockPointManager = new PointManager()
      expect(mockPointManager.handleRyukyoku).toHaveBeenCalledWith(
        "2人テンパイ流局",
        ["player1", "player2"]
      )
    })

    it("途中流局（ABORTIVE_DRAW）のテスト", async () => {
      const requestBody = {
        type: "ABORTIVE_DRAW",
        reason: "九種九牌",
        tenpaiPlayers: [],
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
      expect(responseData.data.message).toContain("九種九牌")

      const PointManager = require("@/lib/point-manager").PointManager
      const mockPointManager = new PointManager()
      expect(mockPointManager.handleRyukyoku).toHaveBeenCalledWith(
        "九種九牌",
        []
      )
    })

    it("全員ノーテン流局のテスト", async () => {
      const requestBody = {
        tenpaiPlayers: [],
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
      expect(responseData.data.message).toContain("全員ノーテン流局")
    })

    it("全員テンパイ流局のテスト", async () => {
      const requestBody = {
        tenpaiPlayers: ["player1", "player2", "player3", "player4"],
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
      expect(responseData.data.message).toContain("全員テンパイ流局")
    })

    it("ゲーム終了時のWebSocket通知テスト", async () => {
      const PointManager = require("@/lib/point-manager").PointManager
      const mockPointManager = new PointManager()
      mockPointManager.handleRyukyoku.mockResolvedValue({
        gameEnded: true,
        reason: "オーラス流局終了",
      })

      const requestBody = {
        tenpaiPlayers: ["player1"],
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
        reason: "オーラス流局終了",
        finalResults: true,
      })
    })

    it("通常の流局WebSocket通知テスト", async () => {
      const requestBody = {
        tenpaiPlayers: ["player1", "player3"],
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
      expect(mockSocketIO.to().emit).toHaveBeenCalledWith("ryukyoku", {
        gameState: mockGameState,
        reason: "2人テンパイ流局",
      })
    })

    it("バリデーションエラー: テンパイ者が5人以上", async () => {
      const requestBody = {
        tenpaiPlayers: ["player1", "player2", "player3", "player4", "player5"],
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
          currentPoints: 24000,
          isReach: true,
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
          currentPoints: 26000,
          isReach: false,
        },
      ],
    }

    const mockUpdatedGameState = {
      gamePhase: "playing",
      players: [
        { position: 0, name: "Player 1", score: 26000, isReach: false },
        { position: 1, name: "Player 2", score: 24000, isReach: false },
        { position: 2, name: "Player 3", score: 24000, isReach: false },
        { position: 3, name: "Player 4", score: 26000, isReach: false },
      ],
      kyotaku: 0,
    }

    beforeEach(() => {
      const SoloPointManager = require("@/lib/solo/solo-point-manager").SoloPointManager

      mockPrisma.game.findUnique.mockResolvedValue(null)
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockSoloGameData)

      const mockSoloPointManager = new SoloPointManager()
      mockSoloPointManager.handleRyukyoku.mockResolvedValue({
        gameEnded: false,
        reason: "",
      })
      mockSoloPointManager.getGameState.mockResolvedValue(mockUpdatedGameState)
    })

    it("ソロゲームの正常な流局テスト", async () => {
      const requestBody = {
        tenpaiPlayers: [0, 1], // リーチプレイヤー（1）を含む
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
      expect(responseData.data.tenpaiPlayers).toEqual([0, 1])
      expect(responseData.data.reachPlayers).toEqual([1])
      expect(responseData.data.message).toContain("2人テンパイ流局")

      // SoloPointManagerのメソッドが正しく呼ばれることを確認
      const SoloPointManager = require("@/lib/solo/solo-point-manager").SoloPointManager
      const mockSoloPointManager = new SoloPointManager()
      expect(mockSoloPointManager.handleRyukyoku).toHaveBeenCalledWith(
        "2人テンパイ流局",
        [0, 1]
      )
    })

    it("文字列の位置指定（型変換）テスト", async () => {
      const requestBody = {
        tenpaiPlayers: ["0", "1"], // 文字列で指定されても数値に変換される
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
      expect(responseData.data.tenpaiPlayers).toEqual([0, 1])
    })

    it("カスタム理由指定のテスト", async () => {
      const requestBody = {
        type: "ABORTIVE_DRAW",
        reason: "四風連打",
        tenpaiPlayers: [],
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
      expect(responseData.data.message).toBe("四風連打")

      const SoloPointManager = require("@/lib/solo/solo-point-manager").SoloPointManager
      const mockSoloPointManager = new SoloPointManager()
      expect(mockSoloPointManager.handleRyukyoku).toHaveBeenCalledWith(
        "四風連打",
        []
      )
    })

    it("バリデーションエラー: 無効な位置", async () => {
      const requestBody = {
        tenpaiPlayers: [0, 1, 5], // 5は無効な位置
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
      expect(responseData.error.details.code).toBe("INVALID_PLAYER_POSITION")
    })

    it("バリデーションエラー: 数値変換不可", async () => {
      const requestBody = {
        tenpaiPlayers: [0, 1, "invalid"], // 数値に変換できない文字列
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

    it("ゲーム状態エラー: 非プレイ状態", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue({
        ...mockSoloGameData,
        status: "ENDED", // プレイ中でない
      })

      const requestBody = {
        tenpaiPlayers: [0, 1],
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

    it("バリデーションエラー: リーチプレイヤーがテンパイしていない", async () => {
      const requestBody = {
        tenpaiPlayers: [0, 3], // リーチプレイヤー（位置1）が含まれていない
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
      expect(responseData.error.details.code).toBe("REACH_PLAYER_NOT_TENPAI")
      expect(responseData.error.details.missingReachPlayers).toEqual([1])
    })

    it("バリデーションエラー: 位置の範囲外", async () => {
      const requestBody = {
        tenpaiPlayers: [-1], // 負の値は無効
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
        tenpaiPlayers: [0, 1],
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
        invalidField: "invalid",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const mockParams = { gameId: mockGameId }
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(200) // デフォルト値で処理される
    })

    it("無効な流局タイプ", async () => {
      const requestBody = {
        type: "INVALID_TYPE",
        tenpaiPlayers: [],
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

  describe("流局理由の自動生成テスト", () => {
    beforeEach(() => {
      const PointManager = require("@/lib/point-manager").PointManager

      mockPrisma.game.findUnique.mockResolvedValue({
        id: mockGameId,
        roomCode: "TEST123",
        status: "playing",
      })
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)

      const mockPointManager = new PointManager()
      mockPointManager.handleRyukyoku.mockResolvedValue({
        gameEnded: false,
        reason: "",
      })
      mockPointManager.getGameState.mockResolvedValue({
        gamePhase: "playing",
        players: [],
      })
      mockPointManager.getGameInfo.mockResolvedValue({
        id: mockGameId,
        roomCode: "TEST123",
      })
    })

    it("1人テンパイ流局", async () => {
      const requestBody = { tenpaiPlayers: ["player1"] }
      const { req } = createMocks({ method: "POST", json: () => requestBody })
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: mockGameId }),
      })
      const responseData = await response.json()
      expect(responseData.data.message).toContain("1人テンパイ流局")
    })

    it("3人テンパイ流局", async () => {
      const requestBody = { tenpaiPlayers: ["player1", "player2", "player3"] }
      const { req } = createMocks({ method: "POST", json: () => requestBody })
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: mockGameId }),
      })
      const responseData = await response.json()
      expect(responseData.data.message).toContain("3人テンパイ流局")
    })

    it("途中流局の理由自動生成", async () => {
      const requestBody = { type: "ABORTIVE_DRAW", tenpaiPlayers: [] }
      const { req } = createMocks({ method: "POST", json: () => requestBody })
      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: mockGameId }),
      })
      const responseData = await response.json()
      expect(responseData.data.message).toContain("途中流局")
    })
  })
})