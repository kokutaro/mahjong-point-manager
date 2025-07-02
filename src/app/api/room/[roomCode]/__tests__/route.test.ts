import { GET } from "@/app/api/room/[roomCode]/route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"

// Prismaのモック
jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: {
      findFirst: jest.fn(),
    },
  },
}))

describe("GET /api/room/[roomCode]", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockGameData = {
    id: "game-123",
    roomCode: "ABCD12",
    status: "WAITING",
    currentRound: 1,
    currentOya: 0,
    honba: 0,
    kyotaku: 0,
    hostPlayer: {
      id: "host-123",
      name: "ホストプレイヤー",
    },
    participants: [
      {
        playerId: "player-1",
        position: 0,
        currentPoints: 25000,
        isReach: false,
        player: {
          name: "プレイヤー1",
        },
      },
      {
        playerId: "player-2",
        position: 1,
        currentPoints: 25000,
        isReach: true,
        player: {
          name: "プレイヤー2",
        },
      },
    ],
    settings: {
      gameType: "HANCHAN",
      initialPoints: 25000,
      hasTobi: true,
      uma: [20, 10, -10, -20],
    },
  }

  describe("正常系", () => {
    it("WAITINGステータスのルーム情報を取得できる", async () => {
      mockPrisma.game.findFirst.mockResolvedValue(mockGameData)

      const { req } = createMocks({
        method: "GET",
      })

      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "abcd12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toMatchObject({
        gameId: "game-123",
        roomCode: "ABCD12",
        status: "WAITING",
        hostPlayer: {
          id: "host-123",
          name: "ホストプレイヤー",
        },
        players: [
          {
            playerId: "player-1",
            name: "プレイヤー1",
            position: 0,
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player-2",
            name: "プレイヤー2",
            position: 1,
            points: 25000,
            isReach: true,
            isConnected: true,
          },
        ],
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
        gamePhase: "waiting",
        settings: {
          gameType: "HANCHAN",
          initialPoints: 25000,
          hasTobi: true,
          uma: [20, 10, -10, -20],
        },
      })

      expect(mockPrisma.game.findFirst).toHaveBeenCalledWith({
        where: {
          roomCode: "ABCD12",
          status: { in: ["WAITING", "PLAYING"] },
        },
        include: {
          participants: {
            include: { player: true },
            orderBy: { position: "asc" },
          },
          settings: true,
          hostPlayer: true,
        },
      })
    })

    it("PLAYINGステータスのルーム情報を取得できる", async () => {
      const playingGameData = {
        ...mockGameData,
        status: "PLAYING",
      }
      mockPrisma.game.findFirst.mockResolvedValue(playingGameData)

      const { req } = createMocks({
        method: "GET",
      })

      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.status).toBe("PLAYING")
      expect(responseData.data.gamePhase).toBe("playing")
    })

    it("roomCodeが小文字でも大文字に変換される", async () => {
      mockPrisma.game.findFirst.mockResolvedValue(mockGameData)

      const { req } = createMocks({
        method: "GET",
      })

      await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "abcd12" }),
      })

      expect(mockPrisma.game.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roomCode: "ABCD12",
          }),
        })
      )
    })

    it("settings情報がnullの場合でも正常に処理される", async () => {
      const gameDataWithoutSettings = {
        ...mockGameData,
        settings: null,
      }
      mockPrisma.game.findFirst.mockResolvedValue(gameDataWithoutSettings)

      const { req } = createMocks({
        method: "GET",
      })

      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.settings).toEqual({
        gameType: undefined,
        initialPoints: undefined,
        hasTobi: undefined,
        uma: undefined,
      })
    })
  })

  describe("異常系", () => {
    it("存在しないルームコードで404エラーを返す", async () => {
      mockPrisma.game.findFirst.mockResolvedValue(null)

      const { req } = createMocks({
        method: "GET",
      })

      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "NOTFOUND" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("ルームが見つかりません")
    })

    it("データベースエラーで500エラーを返す", async () => {
      const dbError = new Error("Database connection failed")
      mockPrisma.game.findFirst.mockRejectedValue(dbError)

      const { req } = createMocks({
        method: "GET",
      })

      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("ルーム情報の取得に失敗しました")
      expect(responseData.error.details).toBe("Database connection failed")
    })

    it("不明なエラーで500エラーを返す", async () => {
      mockPrisma.game.findFirst.mockRejectedValue("Unknown error")

      const { req } = createMocks({
        method: "GET",
      })

      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error.details).toBe("Unknown error")
    })
  })

  describe("エッジケース", () => {
    it("参加者が空の場合でも正常に処理される", async () => {
      const gameDataNoParticipants = {
        ...mockGameData,
        participants: [],
      }
      mockPrisma.game.findFirst.mockResolvedValue(gameDataNoParticipants)

      const { req } = createMocks({
        method: "GET",
      })

      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.players).toEqual([])
    })

    it("FINISHED状態のゲームは取得されない", async () => {
      mockPrisma.game.findFirst.mockResolvedValue(null)

      const { req } = createMocks({
        method: "GET",
      })

      await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "FINISHED" }),
      })

      expect(mockPrisma.game.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ["WAITING", "PLAYING"] },
          }),
        })
      )
    })
  })
})
