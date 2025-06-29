import { GET, POST } from "@/app/api/sessions/route"
import { prisma } from "@/lib/prisma"
import { getCurrentPlayer } from "@/lib/auth"
import { NextRequest } from "next/server"

// Prismaのモック
jest.mock("@/lib/prisma", () => ({
  prisma: {
    gameSession: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  },
}))

// 認証のモック
jest.mock("@/lib/auth")

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockGetCurrentPlayer = getCurrentPlayer as jest.MockedFunction<
  typeof getCurrentPlayer
>

describe("/api/sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("GET", () => {
    it("セッション一覧を正常に取得できる", async () => {
      // 認証モックを設定
      mockGetCurrentPlayer.mockResolvedValue({
        playerId: "player1",
        name: "プレイヤー1",
      })

      const mockSessions = [
        {
          id: "session1",
          sessionCode: "123456",
          name: "テストセッション",
          status: "ACTIVE",
          createdAt: new Date(),
          endedAt: null,
          hostPlayer: { id: "host1", name: "ホスト" },
          participants: [
            {
              player: { id: "player1", name: "プレイヤー1" },
              position: 0,
              totalSettlement: 1000,
              totalGames: 2,
            },
          ],
          games: [{ id: "game1", gameType: "HANCHAN", endedAt: new Date() }],
          settings: { gameType: "HANCHAN" },
        },
      ]

      mockPrisma.gameSession.findMany.mockResolvedValue(mockSessions as any)
      mockPrisma.gameSession.count.mockResolvedValue(1)

      const request = new NextRequest(
        "http://localhost:3000/api/sessions?limit=10&offset=0"
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.sessions).toHaveLength(1)
      expect(data.data.sessions[0].sessionCode).toBe("123456")
      expect(data.data.pagination.total).toBe(1)
    })

    it("特定プレイヤーのセッション履歴を取得できる", async () => {
      // 認証モックを設定
      mockGetCurrentPlayer.mockResolvedValue({
        playerId: "player1",
        name: "プレイヤー1",
      })

      mockPrisma.gameSession.findMany.mockResolvedValue([])
      mockPrisma.gameSession.count.mockResolvedValue(0)

      const request = new NextRequest(
        "http://localhost:3000/api/sessions?playerId=player1"
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockPrisma.gameSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            participants: {
              some: {
                playerId: "player1",
              },
            },
          }),
        })
      )
    })

    it("ステータスでセッションをフィルタリングできる", async () => {
      // 認証モックを設定
      mockGetCurrentPlayer.mockResolvedValue({
        playerId: "player1",
        name: "プレイヤー1",
      })

      mockPrisma.gameSession.findMany.mockResolvedValue([])
      mockPrisma.gameSession.count.mockResolvedValue(0)

      const request = new NextRequest(
        "http://localhost:3000/api/sessions?status=ACTIVE"
      )
      await GET(request)

      expect(mockPrisma.gameSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "ACTIVE",
          }),
        })
      )
    })
  })

  describe("POST", () => {
    it("新しいセッションを作成できる", async () => {
      const mockSession = {
        id: "session1",
        sessionCode: "123456",
        hostPlayerId: "host1",
        name: "テストセッション",
        status: "ACTIVE",
        hostPlayer: { id: "host1", name: "ホスト" },
        settings: { gameType: "HANCHAN" },
      }

      mockPrisma.gameSession.create.mockResolvedValue(mockSession as any)

      const request = new NextRequest("http://localhost:3000/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          hostPlayerId: "host1",
          name: "テストセッション",
          settingsId: "settings1",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.sessionCode).toBe("123456")
      expect(mockPrisma.gameSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hostPlayerId: "host1",
            name: "テストセッション",
            settingsId: "settings1",
            status: "ACTIVE",
          }),
        })
      )
    })

    it("セッション作成時にエラーが発生した場合は500を返す", async () => {
      mockPrisma.gameSession.create.mockRejectedValue(
        new Error("Database error")
      )

      const request = new NextRequest("http://localhost:3000/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          hostPlayerId: "host1",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("セッションの作成に失敗しました")
    })
  })
})
