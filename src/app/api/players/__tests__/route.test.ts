import { GET, POST } from "@/app/api/players/route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"

// Prismaのモック
jest.mock("@/lib/prisma", () => ({
  prisma: {
    player: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

describe("/api/players", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("GET /api/players", () => {
    it("プレイヤー一覧の正常取得", async () => {
      const mockPlayers = [
        {
          id: "player-1",
          name: "Player 1",
          avatar: "https://example.com/avatar1.jpg",
          createdAt: new Date("2025-01-01T10:00:00Z"),
        },
        {
          id: "player-2",
          name: "Player 2",
          avatar: null,
          createdAt: new Date("2025-01-01T09:00:00Z"),
        },
        {
          id: "player-3",
          name: "Player 3",
          avatar: "https://example.com/avatar3.jpg",
          createdAt: new Date("2025-01-01T08:00:00Z"),
        },
      ]

      mockPrisma.player.findMany.mockResolvedValue(mockPlayers)

      const response = await GET()
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual(mockPlayers)

      // 作成日時の降順でソートされることを確認
      expect(mockPrisma.player.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      })
    })

    it("空のプレイヤーリストの取得", async () => {
      mockPrisma.player.findMany.mockResolvedValue([])

      const response = await GET()
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual([])
    })

    it("データベースエラーの処理", async () => {
      mockPrisma.player.findMany.mockRejectedValue(
        new Error("DB connection failed")
      )

      const response = await GET()
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("プレイヤー取得に失敗しました")
    })
  })

  describe("POST /api/players", () => {
    const mockCreatedPlayer = {
      id: "new-player-id",
      name: "New Player",
      avatar: "https://example.com/avatar.jpg",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    beforeEach(() => {
      mockPrisma.player.create.mockResolvedValue(mockCreatedPlayer)
    })

    it("プレイヤーの正常作成（アバター付き）", async () => {
      const requestBody = {
        name: "New Player",
        avatar: "https://example.com/avatar.jpg",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)
      const responseData = await response.json()

      expect(response.status).toBe(201)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual(mockCreatedPlayer)

      expect(mockPrisma.player.create).toHaveBeenCalledWith({
        data: {
          name: "New Player",
          avatar: "https://example.com/avatar.jpg",
        },
      })
    })

    it("プレイヤーの正常作成（アバターなし）", async () => {
      const requestBody = {
        name: "Player Without Avatar",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)
      const responseData = await response.json()

      expect(response.status).toBe(201)
      expect(responseData.success).toBe(true)

      expect(mockPrisma.player.create).toHaveBeenCalledWith({
        data: {
          name: "Player Without Avatar",
        },
      })
    })

    it("最小限の有効な名前", async () => {
      const requestBody = {
        name: "A", // 1文字（最小有効長）
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)

      expect(response.status).toBe(201)
    })

    it("最大長の有効な名前", async () => {
      const requestBody = {
        name: "A".repeat(20), // 20文字（最大有効長）
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)

      expect(response.status).toBe(201)
    })

    describe("バリデーションエラー", () => {
      it("名前が空文字列", async () => {
        const requestBody = {
          name: "",
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)
        const responseData = await response.json()

        expect(response.status).toBe(400)
        expect(responseData.success).toBe(false)
        expect(responseData.error.message).toBe("バリデーションエラー")
        expect(responseData.error.details).toBeDefined()
      })

      it("名前が長すぎる", async () => {
        const requestBody = {
          name: "A".repeat(21), // 20文字を超過
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)

        expect(response.status).toBe(400)
      })

      it("名前フィールドの欠如", async () => {
        const requestBody = {
          avatar: "https://example.com/avatar.jpg",
          // nameが不足
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)

        expect(response.status).toBe(400)
      })

      it("無効なアバターURL", async () => {
        const requestBody = {
          name: "Valid Name",
          avatar: "invalid-url",
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)

        expect(response.status).toBe(400)
      })

      it("アバターがURL形式でない", async () => {
        const requestBody = {
          name: "Valid Name",
          avatar: "not-a-url",
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)

        expect(response.status).toBe(400)
      })
    })

    describe("サーバーエラー", () => {
      it("データベース作成エラー", async () => {
        mockPrisma.player.create.mockRejectedValue(
          new Error("DB constraint violation")
        )

        const requestBody = {
          name: "Valid Player",
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)
        const responseData = await response.json()

        expect(response.status).toBe(500)
        expect(responseData.success).toBe(false)
        expect(responseData.error.message).toBe("プレイヤー作成に失敗しました")
      })

      it("不明なエラー", async () => {
        mockPrisma.player.create.mockRejectedValue("Unknown error")

        const requestBody = {
          name: "Valid Player",
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)

        expect(response.status).toBe(500)
      })
    })

    describe("エッジケース", () => {
      it("日本語の名前", async () => {
        const requestBody = {
          name: "山田太郎",
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)

        expect(response.status).toBe(201)
      })

      it("特殊文字を含む名前", async () => {
        const requestBody = {
          name: "Player-123_!@#",
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)

        expect(response.status).toBe(201)
      })

      it("HTTPSアバターURL", async () => {
        const requestBody = {
          name: "Player",
          avatar: "https://secure.example.com/avatar.png",
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)

        expect(response.status).toBe(201)
      })

      it("HTTPアバターURL", async () => {
        const requestBody = {
          name: "Player",
          avatar: "http://example.com/avatar.png",
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)

        expect(response.status).toBe(201)
      })

      it("クエリパラメータ付きアバターURL", async () => {
        const requestBody = {
          name: "Player",
          avatar: "https://example.com/avatar.jpg?size=200&format=webp",
        }

        const { req } = createMocks({
          method: "POST",
          json: () => requestBody,
        })

        const response = await POST(req as unknown as NextRequest)

        expect(response.status).toBe(201)
      })

      it("無効なJSONボディ", async () => {
        const { req } = createMocks({
          method: "POST",
          json: () => {
            throw new SyntaxError("Unexpected token")
          },
        })

        const response = await POST(req as unknown as NextRequest)

        expect(response.status).toBe(500)
      })
    })
  })
})
