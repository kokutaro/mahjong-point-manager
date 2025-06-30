import { NextRequest } from "next/server"
import { SoloPointManager } from "@/lib/solo/solo-point-manager"
import { calculateScore } from "@/lib/score"
import { POST } from "../route"

// モック設定
jest.mock("@/lib/solo/solo-point-manager", () => ({
  SoloPointManager: jest.fn().mockImplementation(() => ({
    getGameState: jest.fn(),
    distributeWinPoints: jest.fn(),
  })),
}))

jest.mock("@/lib/score", () => ({
  calculateScore: jest.fn(),
}))

const MockSoloPointManager = SoloPointManager as jest.MockedClass<
  typeof SoloPointManager
>
const mockCalculateScore = calculateScore as jest.MockedFunction<
  typeof calculateScore
>

describe("POST /api/solo/[gameId]/score", () => {
  let mockPointManager: jest.Mocked<SoloPointManager>

  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()

    mockPointManager = {
      getGameState: jest.fn(),
      distributeWinPoints: jest.fn(),
    } as any
    MockSoloPointManager.mockImplementation(() => mockPointManager)
  })

  const createMockGameState = (currentOya = 0, honba = 0, kyotaku = 0) => ({
    gameId: "test-game-id",
    status: "PLAYING",
    currentRound: 1,
    honba,
    kyotaku,
    currentOya,
    players: [
      { position: 0, name: "プレイヤー1", currentPoints: 25000 },
      { position: 1, name: "プレイヤー2", currentPoints: 25000 },
      { position: 2, name: "プレイヤー3", currentPoints: 25000 },
      { position: 3, name: "プレイヤー4", currentPoints: 25000 },
    ],
  })

  describe("正常系", () => {
    it("ツモあがりを正常に処理できる", async () => {
      const mockGameState = createMockGameState()
      const mockScoreResult = {
        totalScore: 8000,
        paymentDetails: { all: 2000, oya: 4000 },
      }
      const mockGameEndResult = {
        gameEnded: false,
        reason: "続行",
      }
      const mockUpdatedGameState = {
        ...mockGameState,
        players: mockGameState.players.map((p, i) =>
          i === 1
            ? { ...p, currentPoints: 33000 }
            : { ...p, currentPoints: 23000 }
        ),
      }

      mockPointManager.getGameState
        .mockResolvedValueOnce(mockGameState)
        .mockResolvedValueOnce(mockUpdatedGameState)
      mockCalculateScore.mockResolvedValue(mockScoreResult)
      mockPointManager.distributeWinPoints.mockResolvedValue(mockGameEndResult)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 3,
            fu: 40,
            isTsumo: true,
            winnerId: 1,
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.gameState).toEqual(mockUpdatedGameState)
      expect(data.data.scoreResult).toEqual(mockScoreResult)
      expect(data.data.gameEnded).toBe(false)

      expect(mockCalculateScore).toHaveBeenCalledWith({
        han: 3,
        fu: 40,
        isOya: false,
        isTsumo: true,
        honba: 0,
        kyotaku: 0,
      })
      expect(mockPointManager.distributeWinPoints).toHaveBeenCalledWith(
        1,
        mockScoreResult,
        true,
        undefined
      )
    })

    it("ロンあがりを正常に処理できる", async () => {
      const mockGameState = createMockGameState()
      const mockScoreResult = {
        totalScore: 12000,
        paymentDetails: { direct: 12000 },
      }
      const mockGameEndResult = {
        gameEnded: false,
        reason: "続行",
      }
      const mockUpdatedGameState = {
        ...mockGameState,
        players: mockGameState.players.map((p, i) =>
          i === 2
            ? { ...p, currentPoints: 37000 }
            : i === 3
              ? { ...p, currentPoints: 13000 }
              : p
        ),
      }

      mockPointManager.getGameState
        .mockResolvedValueOnce(mockGameState)
        .mockResolvedValueOnce(mockUpdatedGameState)
      mockCalculateScore.mockResolvedValue(mockScoreResult)
      mockPointManager.distributeWinPoints.mockResolvedValue(mockGameEndResult)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 4,
            fu: 30,
            isTsumo: false,
            winnerId: 2,
            loserId: 3,
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockCalculateScore).toHaveBeenCalledWith({
        han: 4,
        fu: 30,
        isOya: false,
        isTsumo: false,
        honba: 0,
        kyotaku: 0,
      })
      expect(mockPointManager.distributeWinPoints).toHaveBeenCalledWith(
        2,
        mockScoreResult,
        false,
        3
      )
    })

    it("親のあがりを正常に処理できる", async () => {
      const mockGameState = createMockGameState(1) // プレイヤー1が親
      const mockScoreResult = {
        totalScore: 12000,
        paymentDetails: { all: 4000 },
      }
      const mockGameEndResult = {
        gameEnded: false,
        reason: "続行",
      }

      mockPointManager.getGameState
        .mockResolvedValueOnce(mockGameState)
        .mockResolvedValueOnce(mockGameState)
      mockCalculateScore.mockResolvedValue(mockScoreResult)
      mockPointManager.distributeWinPoints.mockResolvedValue(mockGameEndResult)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 3,
            fu: 40,
            isTsumo: true,
            winnerId: 1, // 親
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockCalculateScore).toHaveBeenCalledWith({
        han: 3,
        fu: 40,
        isOya: true, // 親フラグがtrue
        isTsumo: true,
        honba: 0,
        kyotaku: 0,
      })
    })

    it("本場とリーチ棒がある状態を正常に処理できる", async () => {
      const mockGameState = createMockGameState(0, 2, 1000) // 2本場、リーチ棒1本
      const mockScoreResult = {
        totalScore: 8600,
        paymentDetails: { all: 2000, oya: 4000, honba: 600, kyotaku: 1000 },
      }
      const mockGameEndResult = {
        gameEnded: false,
        reason: "続行",
      }

      mockPointManager.getGameState
        .mockResolvedValueOnce(mockGameState)
        .mockResolvedValueOnce(mockGameState)
      mockCalculateScore.mockResolvedValue(mockScoreResult)
      mockPointManager.distributeWinPoints.mockResolvedValue(mockGameEndResult)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 2,
            fu: 40,
            isTsumo: true,
            winnerId: 0,
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockCalculateScore).toHaveBeenCalledWith({
        han: 2,
        fu: 40,
        isOya: true,
        isTsumo: true,
        honba: 2,
        kyotaku: 1000,
      })
    })

    it("ゲーム終了時を正常に処理できる", async () => {
      const mockGameState = createMockGameState()
      const mockScoreResult = {
        totalScore: 32000,
        paymentDetails: { direct: 32000 },
      }
      const mockGameEndResult = {
        gameEnded: true,
        reason: "オーラス終了",
      }
      const mockUpdatedGameState = {
        ...mockGameState,
        status: "FINISHED",
      }

      mockPointManager.getGameState
        .mockResolvedValueOnce(mockGameState)
        .mockResolvedValueOnce(mockUpdatedGameState)
      mockCalculateScore.mockResolvedValue(mockScoreResult)
      mockPointManager.distributeWinPoints.mockResolvedValue(mockGameEndResult)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 13,
            fu: 30,
            isTsumo: false,
            winnerId: 0,
            loserId: 1,
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.gameEnded).toBe(true)
      expect(data.data.reason).toBe("オーラス終了")
    })
  })

  describe("バリデーションエラー", () => {
    it("無効なスキーマで400エラーを返す", async () => {
      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: "invalid",
            fu: 30,
            isTsumo: true,
            winnerId: 1,
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })

    it("無効な翻符組み合わせで400エラーを返す", async () => {
      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 1,
            fu: 25, // 無効な組み合わせ
            isTsumo: true,
            winnerId: 1,
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })

    it("無効なプレイヤー位置で400エラーを返す", async () => {
      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 2,
            fu: 30,
            isTsumo: true,
            winnerId: 5, // 無効な位置
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })

    it("ロンで敗者未指定の場合に400エラーを返す", async () => {
      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 2,
            fu: 30,
            isTsumo: false,
            winnerId: 1,
            // loserId が未指定
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })

    it("勝者と敗者が同じ場合に500エラーを返す", async () => {
      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 2,
            fu: 30,
            isTsumo: false,
            winnerId: 1,
            loserId: 1, // 勝者と同じ
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })
  })

  describe("ゲーム状態エラー", () => {
    it("存在しないプレイヤーで400エラーを返す", async () => {
      const mockGameState = {
        ...createMockGameState(),
        players: [
          { position: 0, name: "プレイヤー1", currentPoints: 25000 },
          { position: 2, name: "プレイヤー3", currentPoints: 25000 },
          { position: 3, name: "プレイヤー4", currentPoints: 25000 },
          // position: 1 が存在しない
        ],
      }

      mockPointManager.getGameState.mockResolvedValue(mockGameState)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 2,
            fu: 30,
            isTsumo: true,
            winnerId: 1, // 存在しないプレイヤー
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("PLAYER_NOT_FOUND")
    })

    it("ゲーム状態取得失敗で500エラーを返す", async () => {
      mockPointManager.getGameState.mockRejectedValue(
        new Error("Game state error")
      )

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 2,
            fu: 30,
            isTsumo: true,
            winnerId: 1,
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("INTERNAL_ERROR")
    })

    it("点数計算失敗で500エラーを返す", async () => {
      const mockGameState = createMockGameState()
      mockPointManager.getGameState.mockResolvedValue(mockGameState)
      mockCalculateScore.mockRejectedValue(new Error("Score calculation error"))

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 2,
            fu: 30,
            isTsumo: true,
            winnerId: 1,
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("INTERNAL_ERROR")
    })

    it("点数分配失敗で500エラーを返す", async () => {
      const mockGameState = createMockGameState()
      const mockScoreResult = { totalScore: 8000 }

      mockPointManager.getGameState.mockResolvedValue(mockGameState)
      mockCalculateScore.mockResolvedValue(mockScoreResult)
      mockPointManager.distributeWinPoints.mockRejectedValue(
        new Error("Distribution error")
      )

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: JSON.stringify({
            han: 2,
            fu: 30,
            isTsumo: true,
            winnerId: 1,
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("INTERNAL_ERROR")
    })
  })

  describe("その他のエラー", () => {
    it("JSON解析エラーで500エラーを返す", async () => {
      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/score",
        {
          method: "POST",
          body: "invalid json",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("INTERNAL_ERROR")
    })
  })
})
