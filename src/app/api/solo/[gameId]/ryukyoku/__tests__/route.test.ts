import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { SoloPointManager } from "@/lib/solo/solo-point-manager"
import { POST } from "../route"

// モック設定
jest.mock("@/lib/prisma", () => ({
  prisma: {
    soloGame: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock("@/lib/solo/solo-point-manager", () => ({
  SoloPointManager: jest.fn().mockImplementation(() => ({
    handleRyukyoku: jest.fn(),
    getGameState: jest.fn(),
  })),
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const MockSoloPointManager = SoloPointManager as jest.MockedClass<
  typeof SoloPointManager
>

describe("POST /api/solo/[gameId]/ryukyoku", () => {
  let mockPointManager: jest.Mocked<SoloPointManager>

  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()

    mockPointManager = {
      handleRyukyoku: jest.fn(),
      getGameState: jest.fn(),
    } as any
    MockSoloPointManager.mockImplementation(() => mockPointManager)
  })

  const createMockGame = (status = "PLAYING", players = []) => ({
    id: "test-game-id",
    status,
    currentRound: 1,
    honba: 0,
    players:
      players.length > 0
        ? players
        : [
            { position: 0, name: "プレイヤー1", isReach: false },
            { position: 1, name: "プレイヤー2", isReach: false },
            { position: 2, name: "プレイヤー3", isReach: false },
            { position: 3, name: "プレイヤー4", isReach: false },
          ],
  })

  describe("正常系", () => {
    it("全員ノーテン流局を正常に処理できる", async () => {
      const mockGame = createMockGame()
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)

      const mockGameEndResult = {
        gameEnded: false,
        reason: "続行",
      }
      const mockGameState = {
        gameId: "test-game-id",
        status: "PLAYING",
        currentRound: 1,
        honba: 1,
        players: mockGame.players,
      }

      mockPointManager.handleRyukyoku.mockResolvedValue(mockGameEndResult)
      mockPointManager.getGameState.mockResolvedValue(mockGameState)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "DRAW",
            tenpaiPlayers: [],
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.gameState).toEqual(mockGameState)
      expect(data.data.tenpaiPlayers).toEqual([])
      expect(data.data.message).toBe("全員ノーテン流局")
      expect(data.data.gameEnded).toBe(false)

      expect(mockPointManager.handleRyukyoku).toHaveBeenCalledWith(
        "全員ノーテン流局",
        []
      )
    })

    it("全員テンパイ流局を正常に処理できる", async () => {
      const mockGame = createMockGame()
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)

      const mockGameEndResult = {
        gameEnded: false,
        reason: "続行",
      }
      const mockGameState = {
        gameId: "test-game-id",
        status: "PLAYING",
        players: mockGame.players,
      }

      mockPointManager.handleRyukyoku.mockResolvedValue(mockGameEndResult)
      mockPointManager.getGameState.mockResolvedValue(mockGameState)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "DRAW",
            tenpaiPlayers: [0, 1, 2, 3],
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toBe("全員テンパイ流局")
      expect(data.data.tenpaiPlayers).toEqual([0, 1, 2, 3])
    })

    it("3人テンパイ流局を正常に処理できる", async () => {
      const mockGame = createMockGame()
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)

      const mockGameEndResult = {
        gameEnded: false,
        reason: "続行",
      }
      const mockGameState = {
        gameId: "test-game-id",
        status: "PLAYING",
        players: mockGame.players,
      }

      mockPointManager.handleRyukyoku.mockResolvedValue(mockGameEndResult)
      mockPointManager.getGameState.mockResolvedValue(mockGameState)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "DRAW",
            tenpaiPlayers: [0, 1, 2],
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toBe("3人テンパイ流局")
      expect(data.data.tenpaiPlayers).toEqual([0, 1, 2])
    })

    it("途中流局を正常に処理できる", async () => {
      const mockGame = createMockGame()
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)

      const mockGameEndResult = {
        gameEnded: false,
        reason: "続行",
      }
      const mockGameState = {
        gameId: "test-game-id",
        status: "PLAYING",
        players: mockGame.players,
      }

      mockPointManager.handleRyukyoku.mockResolvedValue(mockGameEndResult)
      mockPointManager.getGameState.mockResolvedValue(mockGameState)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "ABORTIVE_DRAW",
            tenpaiPlayers: [],
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toBe("途中流局")
    })

    it("リーチプレイヤーがテンパイに含まれている場合を正常に処理できる", async () => {
      const mockPlayers = [
        { position: 0, name: "プレイヤー1", isReach: true },
        { position: 1, name: "プレイヤー2", isReach: false },
        { position: 2, name: "プレイヤー3", isReach: true },
        { position: 3, name: "プレイヤー4", isReach: false },
      ]
      const mockGame = createMockGame("PLAYING", mockPlayers)
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)

      const mockGameEndResult = {
        gameEnded: false,
        reason: "続行",
      }
      const mockGameState = {
        gameId: "test-game-id",
        status: "PLAYING",
        players: mockPlayers,
      }

      mockPointManager.handleRyukyoku.mockResolvedValue(mockGameEndResult)
      mockPointManager.getGameState.mockResolvedValue(mockGameState)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "DRAW",
            tenpaiPlayers: [0, 1, 2], // リーチプレイヤー(0,2)を含む
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.reachPlayers).toEqual([0, 2])
      expect(data.data.tenpaiPlayers).toEqual([0, 1, 2])
    })

    it("ゲーム終了時の処理を正常に行える", async () => {
      const mockGame = createMockGame()
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)

      const mockGameEndResult = {
        gameEnded: true,
        reason: "オーラス終了",
      }
      const mockGameState = {
        gameId: "test-game-id",
        status: "FINISHED",
        players: mockGame.players,
      }

      mockPointManager.handleRyukyoku.mockResolvedValue(mockGameEndResult)
      mockPointManager.getGameState.mockResolvedValue(mockGameState)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "DRAW",
            tenpaiPlayers: [0, 1],
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
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "INVALID_TYPE",
            tenpaiPlayers: "invalid",
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

    it("テンパイ者数が5人以上で400エラーを返す", async () => {
      const mockGame = createMockGame()
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "DRAW",
            tenpaiPlayers: [0, 1, 2, 3, 4], // 5人
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
      const mockGame = createMockGame()
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "DRAW",
            tenpaiPlayers: [0, 1, 5], // 5は無効な位置
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
    it("ゲームが見つからない場合に404エラーを返す", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "DRAW",
            tenpaiPlayers: [0, 1],
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("GAME_NOT_FOUND")
      expect(data.error.message).toBe("ゲームが見つかりません")
    })

    it("ゲームが進行中でない場合に400エラーを返す", async () => {
      const mockGame = createMockGame("WAITING")
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "DRAW",
            tenpaiPlayers: [0, 1],
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("GAME_NOT_PLAYING")
      expect(data.error.message).toBe("ゲームが進行中ではありません")
    })
  })

  describe("リーチプレイヤー検証エラー", () => {
    it("リーチプレイヤーがテンパイに含まれていない場合に400エラーを返す", async () => {
      const mockPlayers = [
        { position: 0, name: "プレイヤー1", isReach: true },
        { position: 1, name: "プレイヤー2", isReach: false },
        { position: 2, name: "プレイヤー3", isReach: true },
        { position: 3, name: "プレイヤー4", isReach: false },
      ]
      const mockGame = createMockGame("PLAYING", mockPlayers)
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "DRAW",
            tenpaiPlayers: [1, 3], // リーチプレイヤー(0,2)を含まない
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("REACH_PLAYER_NOT_TENPAI")
      expect(data.error.message).toBe(
        "リーチしているプレイヤーはテンパイしている必要があります"
      )
      expect(data.error.details.missingReachPlayers).toEqual([0, 2])
    })
  })

  describe("その他のエラー", () => {
    it("JSON解析エラーで500エラーを返す", async () => {
      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
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
      expect(data.error.message).toBe("ソロ流局処理に失敗しました")
    })

    it("ポイント管理でエラーが発生した場合に500エラーを返す", async () => {
      const mockGame = createMockGame()
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)
      mockPointManager.handleRyukyoku.mockRejectedValue(
        new Error("Point manager error")
      )

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id/ryukyoku",
        {
          method: "POST",
          body: JSON.stringify({
            type: "DRAW",
            tenpaiPlayers: [0, 1],
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("ソロ流局処理に失敗しました")
    })
  })
})
