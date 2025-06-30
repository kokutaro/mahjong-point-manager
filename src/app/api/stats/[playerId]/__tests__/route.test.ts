import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { GET } from "../route"

// モック設定
jest.mock("@/lib/prisma", () => ({
  prisma: {
    gameParticipant: {
      findMany: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe("GET /api/stats/[playerId]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()
  })

  const createMockParticipation = (overrides = {}) => ({
    id: "participation-1",
    playerId: "test-player-id",
    finalRank: 1,
    finalPoints: 32000,
    settlement: 15000,
    player: {
      id: "test-player-id",
      name: "テストプレイヤー",
    },
    game: {
      id: "game-1",
      endedAt: new Date("2024-01-15T10:00:00Z"),
      settings: {
        gameType: "HANCHAN",
      },
    },
    ...overrides,
  })

  describe("正常系", () => {
    it("参加履歴がある場合の統計を正常に計算できる", async () => {
      const mockParticipations = [
        createMockParticipation({
          finalRank: 1,
          finalPoints: 32000,
          settlement: 15000,
        }),
        createMockParticipation({
          id: "participation-2",
          finalRank: 2,
          finalPoints: 28000,
          settlement: 5000,
          game: {
            id: "game-2",
            endedAt: new Date("2024-01-10T10:00:00Z"),
            settings: {
              gameType: "HANCHAN",
            },
          },
        }),
        createMockParticipation({
          id: "participation-3",
          finalRank: 3,
          finalPoints: 22000,
          settlement: -5000,
          game: {
            id: "game-3",
            endedAt: new Date("2024-01-05T10:00:00Z"),
            settings: {
              gameType: "TONPUU",
            },
          },
        }),
        createMockParticipation({
          id: "participation-4",
          finalRank: 4,
          finalPoints: 18000,
          settlement: -15000,
          game: {
            id: "game-4",
            endedAt: new Date("2024-01-01T10:00:00Z"),
            settings: {
              gameType: "HANCHAN",
            },
          },
        }),
      ]

      mockPrisma.gameParticipant.findMany.mockResolvedValue(
        mockParticipations as any
      )

      const request = new NextRequest(
        "http://localhost/api/stats/test-player-id"
      )
      const response = await GET(request, {
        params: Promise.resolve({ playerId: "test-player-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        playerId: "test-player-id",
        playerName: "テストプレイヤー",
        totalGames: 4,
        winRate: 25, // 1勝/4戦 = 25%
        averageRank: 2.5, // (1+2+3+4)/4 = 2.5
        averagePoints: 25000, // (32000+28000+22000+18000)/4 = 25000
        totalSettlement: 0, // 15000+5000-5000-15000 = 0
        rankDistribution: { 1: 1, 2: 1, 3: 1, 4: 1 },
      })

      // ゲームタイプ別統計の確認
      expect(data.data.gameTypeStats).toMatchObject({
        HANCHAN: {
          totalGames: 3,
          winRate: 33.33, // 1勝/3戦
          averageRank: 2.33, // (1+2+4)/3
          totalSettlement: 5000, // 15000+5000-15000
          rankDistribution: { 1: 1, 2: 1, 3: 0, 4: 1 },
        },
        TONPUU: {
          totalGames: 1,
          winRate: 0, // 0勝/1戦
          averageRank: 3, // 3/1
          totalSettlement: -5000,
          rankDistribution: { 1: 0, 2: 0, 3: 1, 4: 0 },
        },
      })

      // 最近の対局の確認（最新5件、日付順）
      expect(data.data.recentGames).toHaveLength(4)
      expect(data.data.recentGames[0]).toMatchObject({
        gameId: "game-1",
        rank: 1,
        points: 32000,
        settlement: 15000,
      })

      // キャッシュヘッダーの確認
      expect(response.headers.get("Cache-Control")).toBe(
        "public, s-maxage=120, stale-while-revalidate=240"
      )
    })

    it("ゲームタイプフィルターが正常に動作する", async () => {
      const mockParticipations = [
        createMockParticipation({
          game: {
            id: "game-1",
            endedAt: new Date("2024-01-15T10:00:00Z"),
            settings: {
              gameType: "HANCHAN",
            },
          },
        }),
        createMockParticipation({
          id: "participation-2",
          game: {
            id: "game-2",
            endedAt: new Date("2024-01-10T10:00:00Z"),
            settings: {
              gameType: "TONPUU",
            },
          },
        }),
      ]

      mockPrisma.gameParticipant.findMany.mockResolvedValue([
        mockParticipations[0],
      ] as any)

      const request = new NextRequest(
        "http://localhost/api/stats/test-player-id?gameType=HANCHAN"
      )
      const response = await GET(request, {
        params: Promise.resolve({ playerId: "test-player-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.totalGames).toBe(1)

      // Prismaクエリにゲームタイプフィルターが含まれていることを確認
      expect(mockPrisma.gameParticipant.findMany).toHaveBeenCalledWith({
        where: {
          playerId: "test-player-id",
          game: {
            status: "FINISHED",
            endedAt: { not: null },
            settings: {
              gameType: "HANCHAN",
            },
          },
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      })
    })

    it("無効なゲームタイプフィルターを無視する", async () => {
      const mockParticipations = [createMockParticipation()]
      mockPrisma.gameParticipant.findMany.mockResolvedValue(
        mockParticipations as any
      )

      const request = new NextRequest(
        "http://localhost/api/stats/test-player-id?gameType=INVALID"
      )
      const response = await GET(request, {
        params: Promise.resolve({ playerId: "test-player-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 無効なゲームタイプは無視され、フィルターなしでクエリが実行される
      expect(mockPrisma.gameParticipant.findMany).toHaveBeenCalledWith({
        where: {
          playerId: "test-player-id",
          game: {
            status: "FINISHED",
            endedAt: { not: null },
          },
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      })
    })

    it("参加履歴がない場合の空の統計を返す", async () => {
      mockPrisma.gameParticipant.findMany.mockResolvedValue([])

      const request = new NextRequest(
        "http://localhost/api/stats/test-player-id"
      )
      const response = await GET(request, {
        params: Promise.resolve({ playerId: "test-player-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        playerId: "test-player-id",
        playerName: "",
        totalGames: 0,
        winRate: 0,
        averageRank: 0,
        averagePoints: 0,
        totalSettlement: 0,
        rankDistribution: { 1: 0, 2: 0, 3: 0, 4: 0 },
        gameTypeStats: {},
        recentGames: [],
        monthlyStats: {},
      })
    })

    it("月別統計を正常に計算できる", async () => {
      const now = new Date()
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 15)
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15)

      const mockParticipations = [
        createMockParticipation({
          finalRank: 1,
          settlement: 10000,
          game: {
            id: "game-1",
            endedAt: currentMonth,
            settings: { gameType: "HANCHAN" },
          },
        }),
        createMockParticipation({
          id: "participation-2",
          finalRank: 2,
          settlement: 5000,
          game: {
            id: "game-2",
            endedAt: currentMonth,
            settings: { gameType: "HANCHAN" },
          },
        }),
        createMockParticipation({
          id: "participation-3",
          finalRank: 1,
          settlement: 15000,
          game: {
            id: "game-3",
            endedAt: lastMonth,
            settings: { gameType: "HANCHAN" },
          },
        }),
      ]

      mockPrisma.gameParticipant.findMany.mockResolvedValue(
        mockParticipations as any
      )

      const request = new NextRequest(
        "http://localhost/api/stats/test-player-id"
      )
      const response = await GET(request, {
        params: Promise.resolve({ playerId: "test-player-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`
      const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`

      expect(data.data.monthlyStats).toMatchObject({
        [currentMonthKey]: {
          games: 2,
          wins: 1,
          totalSettlement: 15000,
        },
        [lastMonthKey]: {
          games: 1,
          wins: 1,
          totalSettlement: 15000,
        },
      })
    })

    it("nullやundefinedのデータを適切に処理できる", async () => {
      const mockParticipations = [
        createMockParticipation({
          finalRank: null,
          finalPoints: null,
          settlement: null,
        }),
        createMockParticipation({
          id: "participation-2",
          finalRank: 1,
          finalPoints: 30000,
          settlement: 10000,
        }),
      ]

      mockPrisma.gameParticipant.findMany.mockResolvedValue(
        mockParticipations as any
      )

      const request = new NextRequest(
        "http://localhost/api/stats/test-player-id"
      )
      const response = await GET(request, {
        params: Promise.resolve({ playerId: "test-player-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.totalGames).toBe(2)
      expect(data.data.winRate).toBe(50) // 1勝/2戦（nullは計算に含まれない）
      expect(data.data.averageRank).toBe(1) // 1/1（nullは計算に含まれない）
      expect(data.data.averagePoints).toBe(15000) // 30000/2（nullは0として扱われる）
      expect(data.data.totalSettlement).toBe(10000) // nullは0として扱われる
    })

    it("ゲーム設定がnullの場合をデフォルト値で処理できる", async () => {
      const mockParticipations = [
        createMockParticipation({
          game: {
            id: "game-1",
            endedAt: new Date("2024-01-15T10:00:00Z"),
            settings: null, // settingsがnull
          },
        }),
      ]

      mockPrisma.gameParticipant.findMany.mockResolvedValue(
        mockParticipations as any
      )

      const request = new NextRequest(
        "http://localhost/api/stats/test-player-id"
      )
      const response = await GET(request, {
        params: Promise.resolve({ playerId: "test-player-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.gameTypeStats).toHaveProperty("HANCHAN") // デフォルト値
    })
  })

  describe("エラーハンドリング", () => {
    it("データベースエラーで500エラーを返す", async () => {
      mockPrisma.gameParticipant.findMany.mockRejectedValue(
        new Error("Database connection failed")
      )

      const request = new NextRequest(
        "http://localhost/api/stats/test-player-id"
      )
      const response = await GET(request, {
        params: Promise.resolve({ playerId: "test-player-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toMatchObject({
        message: "統計の取得に失敗しました",
        details: "Database connection failed",
      })
      expect(console.error).toHaveBeenCalledWith(
        "Stats API error:",
        expect.any(Error)
      )
    })

    it("予期しないエラーで500エラーを返す", async () => {
      mockPrisma.gameParticipant.findMany.mockRejectedValue("Unexpected error")

      const request = new NextRequest(
        "http://localhost/api/stats/test-player-id"
      )
      const response = await GET(request, {
        params: Promise.resolve({ playerId: "test-player-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toMatchObject({
        message: "統計の取得に失敗しました",
        details: "Unknown error",
      })
    })
  })

  describe("エッジケース", () => {
    it("大量のデータでも正常に処理できる", async () => {
      // 100ゲームのモックデータを生成
      const mockParticipations = Array.from({ length: 100 }, (_, i) =>
        createMockParticipation({
          id: `participation-${i}`,
          finalRank: (i % 4) + 1,
          finalPoints: 25000 + (i % 4) * 1000,
          settlement: (i % 4) * 5000 - 7500,
          game: {
            id: `game-${i}`,
            endedAt: new Date(2024, 0, i + 1),
            settings: {
              gameType: i % 2 === 0 ? "HANCHAN" : "TONPUU",
            },
          },
        })
      )

      mockPrisma.gameParticipant.findMany.mockResolvedValue(
        mockParticipations as any
      )

      const request = new NextRequest(
        "http://localhost/api/stats/test-player-id"
      )
      const response = await GET(request, {
        params: Promise.resolve({ playerId: "test-player-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.totalGames).toBe(100)
      expect(data.data.recentGames).toHaveLength(5) // 最新5件のみ
      expect(data.data.rankDistribution).toMatchObject({
        1: 25,
        2: 25,
        3: 25,
        4: 25,
      })
    })

    it("12ヶ月以上前のデータは月別統計に含まれない", async () => {
      const now = new Date()
      const veryOldDate = new Date(now.getFullYear() - 2, now.getMonth(), 15)
      const recentDate = new Date(now.getFullYear(), now.getMonth(), 15)

      const mockParticipations = [
        createMockParticipation({
          game: {
            id: "game-1",
            endedAt: veryOldDate,
            settings: { gameType: "HANCHAN" },
          },
        }),
        createMockParticipation({
          id: "participation-2",
          game: {
            id: "game-2",
            endedAt: recentDate,
            settings: { gameType: "HANCHAN" },
          },
        }),
      ]

      mockPrisma.gameParticipant.findMany.mockResolvedValue(
        mockParticipations as any
      )

      const request = new NextRequest(
        "http://localhost/api/stats/test-player-id"
      )
      const response = await GET(request, {
        params: Promise.resolve({ playerId: "test-player-id" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 全体統計は2ゲーム分
      expect(data.data.totalGames).toBe(2)

      // 月別統計は最近の1ゲームのみ
      const monthlyStatsEntries = Object.entries(data.data.monthlyStats)
      expect(monthlyStatsEntries).toHaveLength(1)
      expect(monthlyStatsEntries[0][1]).toMatchObject({
        games: 1,
        wins: 1,
      })
    })
  })
})
