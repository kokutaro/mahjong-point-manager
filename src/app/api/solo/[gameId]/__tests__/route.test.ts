import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSoloGameState } from "@/lib/solo/score-manager"
import { GET, PATCH } from "../route"

// モック設定
jest.mock("@/lib/prisma", () => ({
  prisma: {
    soloGame: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    soloPlayer: {
      updateMany: jest.fn(),
    },
    soloGameResult: {
      create: jest.fn(),
    },
    soloGameEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock("@/lib/solo/score-manager", () => ({
  getSoloGameState: jest.fn(),
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockGetSoloGameState = getSoloGameState as jest.MockedFunction<
  typeof getSoloGameState
>

describe("GET /api/solo/[gameId]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()
  })

  describe("正常系", () => {
    it("ゲーム状態を正常に取得できる", async () => {
      const mockGameState = {
        gameId: "test-game-id",
        status: "PLAYING",
        currentRound: 1,
        honba: 0,
        kyotaku: 0,
        currentOya: 0,
        players: [
          {
            position: 0,
            name: "プレイヤー1",
            currentPoints: 25000,
            isReach: false,
          },
          {
            position: 1,
            name: "プレイヤー2",
            currentPoints: 25000,
            isReach: false,
          },
          {
            position: 2,
            name: "プレイヤー3",
            currentPoints: 25000,
            isReach: false,
          },
          {
            position: 3,
            name: "プレイヤー4",
            currentPoints: 25000,
            isReach: false,
          },
        ],
      }

      mockGetSoloGameState.mockResolvedValue(mockGameState)

      const request = new NextRequest("http://localhost/api/solo/test-game-id")
      const response = await GET(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockGameState)
      expect(mockGetSoloGameState).toHaveBeenCalledWith("test-game-id")
    })
  })

  describe("異常系", () => {
    it("ゲーム状態取得失敗時に500エラーを返す", async () => {
      mockGetSoloGameState.mockRejectedValue(new Error("Database error"))

      const request = new NextRequest("http://localhost/api/solo/test-game-id")
      const response = await GET(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("ソロゲーム状態の取得に失敗しました")
    })
  })
})

describe("PATCH /api/solo/[gameId]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()
  })

  describe("ゲーム開始 (action: start)", () => {
    it("ゲームを正常に開始できる", async () => {
      const mockGameState = {
        gameId: "test-game-id",
        status: "PLAYING",
        currentRound: 1,
        players: [],
      }

      mockPrisma.soloGame.update.mockResolvedValue({
        id: "test-game-id",
        status: "PLAYING",
        startedAt: new Date(),
      } as any)
      mockGetSoloGameState.mockResolvedValue(mockGameState)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id",
        {
          method: "PATCH",
          body: JSON.stringify({ action: "start" }),
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockGameState)
      expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
        where: { id: "test-game-id" },
        data: {
          status: "PLAYING",
          startedAt: expect.any(Date),
        },
      })
      expect(mockGetSoloGameState).toHaveBeenCalledWith("test-game-id")
    })

    it("ゲーム開始時のデータベースエラーで500エラーを返す", async () => {
      mockPrisma.soloGame.update.mockRejectedValue(new Error("DB error"))

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id",
        {
          method: "PATCH",
          body: JSON.stringify({ action: "start" }),
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("ソロゲーム更新に失敗しました")
    })
  })

  describe("ゲーム終了 (action: finish)", () => {
    const mockGame = {
      id: "test-game-id",
      initialPoints: 25000,
      currentRound: 8,
      honba: 2,
      players: [
        {
          position: 0,
          name: "プレイヤー1",
          currentPoints: 32000,
        },
        {
          position: 1,
          name: "プレイヤー2",
          currentPoints: 28000,
        },
        {
          position: 2,
          name: "プレイヤー3",
          currentPoints: 22000,
        },
        {
          position: 3,
          name: "プレイヤー4",
          currentPoints: 18000,
        },
      ],
    }

    it("ゲームを正常に終了できる", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          soloGame: {
            update: jest.fn().mockResolvedValue({}),
          },
          soloPlayer: {
            updateMany: jest.fn().mockResolvedValue({}),
          },
          soloGameResult: {
            create: jest.fn().mockResolvedValue({}),
          },
          soloGameEvent: {
            create: jest.fn().mockResolvedValue({}),
          },
        } as any)
      })

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id",
        {
          method: "PATCH",
          body: JSON.stringify({ action: "finish" }),
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.gameId).toBe("test-game-id")
      expect(data.data.status).toBe("FINISHED")
      expect(data.data.results).toHaveLength(4)

      // 順位が正しく計算されていることを確認
      const results = data.data.results
      expect(results[0]).toMatchObject({
        position: 0,
        name: "プレイヤー1",
        finalPoints: 32000,
        rank: 1,
        rawScore: 7000,
        uma: 15000,
        settlement: 22000,
      })
      expect(results[1]).toMatchObject({
        position: 1,
        name: "プレイヤー2",
        finalPoints: 28000,
        rank: 2,
        rawScore: 3000,
        uma: 5000,
        settlement: 8000,
      })
      expect(results[2]).toMatchObject({
        position: 2,
        name: "プレイヤー3",
        finalPoints: 22000,
        rank: 3,
        rawScore: -3000,
        uma: -5000,
        settlement: -8000,
      })
      expect(results[3]).toMatchObject({
        position: 3,
        name: "プレイヤー4",
        finalPoints: 18000,
        rank: 4,
        rawScore: -7000,
        uma: -15000,
        settlement: -22000,
      })

      expect(mockPrisma.soloGame.findUnique).toHaveBeenCalledWith({
        where: { id: "test-game-id" },
        include: { players: true },
      })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it("ゲームが見つからない場合に404エラーを返す", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id",
        {
          method: "PATCH",
          body: JSON.stringify({ action: "finish" }),
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("GAME_NOT_FOUND")
      expect(data.error.message).toBe("ゲームが見つかりません")
    })

    it("ゲーム終了時のデータベースエラーで500エラーを返す", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame as any)
      mockPrisma.$transaction.mockRejectedValue(new Error("Transaction failed"))

      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id",
        {
          method: "PATCH",
          body: JSON.stringify({ action: "finish" }),
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("ソロゲーム更新に失敗しました")
    })
  })

  describe("無効なアクション", () => {
    it("無効なアクションで400エラーを返す", async () => {
      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id",
        {
          method: "PATCH",
          body: JSON.stringify({ action: "invalid_action" }),
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("INVALID_ACTION")
      expect(data.error.message).toBe("無効なアクションです")
      expect(data.error.details).toEqual({
        code: "INVALID_ACTION",
        action: "invalid_action",
      })
    })

    it("アクションが指定されていない場合に400エラーを返す", async () => {
      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id",
        {
          method: "PATCH",
          body: JSON.stringify({}),
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("INVALID_ACTION")
      expect(data.error.message).toBe("無効なアクションです")
    })
  })

  describe("その他のエラー", () => {
    it("JSON解析エラーで500エラーを返す", async () => {
      const request = new NextRequest(
        "http://localhost/api/solo/test-game-id",
        {
          method: "PATCH",
          body: "invalid json",
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ gameId: "test-game-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("ソロゲーム更新に失敗しました")
    })
  })
})
