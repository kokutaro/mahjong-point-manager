import { POST } from "../route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

// Prismaのモック
jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    gameSession: {
      create: jest.fn(),
    },
    sessionParticipant: {
      create: jest.fn(),
    },
  },
}))

describe("POST /api/admin/migrate-to-sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("ドライラン", () => {
    it("セッション化が必要な対局がない場合", async () => {
      ;(prisma.game.findMany as jest.Mock).mockResolvedValue([])

      const request = new NextRequest(
        "http://localhost/api/admin/migrate-to-sessions",
        {
          method: "POST",
          body: JSON.stringify({ dryRun: true }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe("セッション化が必要な対局がありません")
      expect(data.data.processedGames).toBe(0)
    })

    it("単発対局のドライラン", async () => {
      const mockGame = {
        id: "game1",
        hostPlayerId: "host1",
        settingsId: "settings1",
        createdAt: new Date("2025-01-01T10:00:00Z"),
        endedAt: new Date("2025-01-01T11:00:00Z"),
        hostPlayer: { name: "ホストプレイヤー" },
        participants: [
          {
            playerId: "player1",
            position: 1,
            player: { name: "プレイヤー1" },
          },
          {
            playerId: "player2",
            position: 2,
            player: { name: "プレイヤー2" },
          },
          {
            playerId: "player3",
            position: 3,
            player: { name: "プレイヤー3" },
          },
          {
            playerId: "player4",
            position: 4,
            player: { name: "プレイヤー4" },
          },
        ],
        settings: {},
      }

      ;(prisma.game.findMany as jest.Mock).mockResolvedValue([mockGame])

      const request = new NextRequest(
        "http://localhost/api/admin/migrate-to-sessions",
        {
          method: "POST",
          body: JSON.stringify({ dryRun: true }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe("1局がセッション化の対象です（ドライラン）")
      expect(data.data.processedGames).toBe(1)
      expect(data.data.operations).toHaveLength(1)
      expect(data.data.operations[0].type).toBe("single-game")
      expect(data.data.operations[0].hostPlayer).toBe("ホストプレイヤー")
      expect(data.data.operations[0].participants).toEqual([
        "プレイヤー1",
        "プレイヤー2",
        "プレイヤー3",
        "プレイヤー4",
      ])
    })

    it("複数対局のドライラン", async () => {
      const baseGame = {
        hostPlayerId: "host1",
        settingsId: "settings1",
        hostPlayer: { name: "ホストプレイヤー" },
        participants: [
          {
            playerId: "player1",
            position: 1,
            player: { name: "プレイヤー1" },
          },
          {
            playerId: "player2",
            position: 2,
            player: { name: "プレイヤー2" },
          },
          {
            playerId: "player3",
            position: 3,
            player: { name: "プレイヤー3" },
          },
          {
            playerId: "player4",
            position: 4,
            player: { name: "プレイヤー4" },
          },
        ],
        settings: {},
      }

      const mockGames = [
        {
          ...baseGame,
          id: "game1",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          endedAt: new Date("2025-01-01T11:00:00Z"),
        },
        {
          ...baseGame,
          id: "game2",
          createdAt: new Date("2025-01-01T11:30:00Z"),
          endedAt: new Date("2025-01-01T12:30:00Z"),
        },
      ]

      ;(prisma.game.findMany as jest.Mock).mockResolvedValue(mockGames)

      const request = new NextRequest(
        "http://localhost/api/admin/migrate-to-sessions",
        {
          method: "POST",
          body: JSON.stringify({ dryRun: true }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe("2局がセッション化の対象です（ドライラン）")
      expect(data.data.processedGames).toBe(2)
      expect(data.data.operations).toHaveLength(1)
      expect(data.data.operations[0].type).toBe("multi-game")
      expect(data.data.operations[0].gameCount).toBe(2)
    })
  })

  describe("実際の移行処理", () => {
    it("単発対局の移行", async () => {
      const mockGame = {
        id: "game1",
        hostPlayerId: "host1",
        settingsId: "settings1",
        createdAt: new Date("2025-01-01T10:00:00Z"),
        endedAt: new Date("2025-01-01T11:00:00Z"),
        hostPlayer: { name: "ホストプレイヤー" },
        participants: [
          {
            playerId: "player1",
            position: 1,
            settlement: 25000,
            finalRank: 1,
            player: { name: "プレイヤー1" },
          },
          {
            playerId: "player2",
            position: 2,
            settlement: 5000,
            finalRank: 2,
            player: { name: "プレイヤー2" },
          },
          {
            playerId: "player3",
            position: 3,
            settlement: -10000,
            finalRank: 3,
            player: { name: "プレイヤー3" },
          },
          {
            playerId: "player4",
            position: 4,
            settlement: -20000,
            finalRank: 4,
            player: { name: "プレイヤー4" },
          },
        ],
        settings: {},
      }

      const mockSession = {
        id: "session1",
        sessionCode: "123456",
      }

      ;(prisma.game.findMany as jest.Mock).mockResolvedValue([mockGame])
      ;(prisma.gameSession.create as jest.Mock).mockResolvedValue(mockSession)
      ;(prisma.sessionParticipant.create as jest.Mock).mockResolvedValue({})
      ;(prisma.game.update as jest.Mock).mockResolvedValue({})

      const request = new NextRequest(
        "http://localhost/api/admin/migrate-to-sessions",
        {
          method: "POST",
          body: JSON.stringify({ dryRun: false }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe("1局をセッションに移行しました")
      expect(data.data.processedGames).toBe(1)

      // セッション作成の確認
      expect(prisma.gameSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          hostPlayerId: "host1",
          name: "単発対局セッション",
          status: "FINISHED",
          settingsId: "settings1",
        }),
      })

      // セッション参加者作成の確認
      expect(prisma.sessionParticipant.create).toHaveBeenCalledTimes(4)

      // ゲーム更新の確認
      expect(prisma.game.update).toHaveBeenCalledWith({
        where: { id: "game1" },
        data: {
          sessionId: "session1",
          sessionOrder: 1,
        },
      })
    })

    it("複数対局の移行", async () => {
      const baseParticipants = [
        {
          playerId: "player1",
          position: 1,
          player: { name: "プレイヤー1" },
        },
        {
          playerId: "player2",
          position: 2,
          player: { name: "プレイヤー2" },
        },
        {
          playerId: "player3",
          position: 3,
          player: { name: "プレイヤー3" },
        },
        {
          playerId: "player4",
          position: 4,
          player: { name: "プレイヤー4" },
        },
      ]

      const mockGames = [
        {
          id: "game1",
          hostPlayerId: "host1",
          settingsId: "settings1",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          endedAt: new Date("2025-01-01T11:00:00Z"),
          hostPlayer: { name: "ホストプレイヤー" },
          participants: baseParticipants.map((p) => ({
            ...p,
            settlement: 10000,
            finalRank: p.position,
          })),
          settings: {},
        },
        {
          id: "game2",
          hostPlayerId: "host1",
          settingsId: "settings1",
          createdAt: new Date("2025-01-01T11:30:00Z"),
          endedAt: new Date("2025-01-01T12:30:00Z"),
          hostPlayer: { name: "ホストプレイヤー" },
          participants: baseParticipants.map((p) => ({
            ...p,
            settlement: -5000,
            finalRank: p.position,
          })),
          settings: {},
        },
      ]

      const mockSession = {
        id: "session1",
        sessionCode: "123456",
      }

      ;(prisma.game.findMany as jest.Mock).mockResolvedValue(mockGames)
      ;(prisma.gameSession.create as jest.Mock).mockResolvedValue(mockSession)
      ;(prisma.sessionParticipant.create as jest.Mock).mockResolvedValue({})
      ;(prisma.game.update as jest.Mock).mockResolvedValue({})

      const request = new NextRequest(
        "http://localhost/api/admin/migrate-to-sessions",
        {
          method: "POST",
          body: JSON.stringify({ dryRun: false }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe("2局をセッションに移行しました")
      expect(data.data.processedGames).toBe(2)

      // セッション作成の確認
      expect(prisma.gameSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "自動移行セッション (2局)",
        }),
      })

      // ゲーム更新の確認（2局）
      expect(prisma.game.update).toHaveBeenCalledTimes(2)
    })
  })

  describe("エラーハンドリング", () => {
    it("データベースエラーの処理", async () => {
      ;(prisma.game.findMany as jest.Mock).mockRejectedValue(
        new Error("Database connection failed")
      )

      const request = new NextRequest(
        "http://localhost/api/admin/migrate-to-sessions",
        {
          method: "POST",
          body: JSON.stringify({ dryRun: true }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("セッション移行に失敗しました")
      expect(data.error.details).toBe("Database connection failed")
    })

    it("無効なリクエストボディの処理", async () => {
      const request = new NextRequest(
        "http://localhost/api/admin/migrate-to-sessions",
        {
          method: "POST",
          body: "invalid json",
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("セッション移行に失敗しました")
    })
  })

  describe("グループ化ロジック", () => {
    it("異なるホストの対局は別グループになる", async () => {
      const baseParticipants = [
        {
          playerId: "player1",
          position: 1,
          player: { name: "プレイヤー1" },
        },
        {
          playerId: "player2",
          position: 2,
          player: { name: "プレイヤー2" },
        },
        {
          playerId: "player3",
          position: 3,
          player: { name: "プレイヤー3" },
        },
        {
          playerId: "player4",
          position: 4,
          player: { name: "プレイヤー4" },
        },
      ]

      const mockGames = [
        {
          id: "game1",
          hostPlayerId: "host1",
          settingsId: "settings1",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          endedAt: new Date("2025-01-01T11:00:00Z"),
          hostPlayer: { name: "ホストプレイヤー1" },
          participants: baseParticipants,
          settings: {},
        },
        {
          id: "game2",
          hostPlayerId: "host2", // 異なるホスト
          settingsId: "settings1",
          createdAt: new Date("2025-01-01T11:30:00Z"),
          endedAt: new Date("2025-01-01T12:30:00Z"),
          hostPlayer: { name: "ホストプレイヤー2" },
          participants: baseParticipants,
          settings: {},
        },
      ]

      ;(prisma.game.findMany as jest.Mock).mockResolvedValue(mockGames)

      const request = new NextRequest(
        "http://localhost/api/admin/migrate-to-sessions",
        {
          method: "POST",
          body: JSON.stringify({ dryRun: true }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.operations).toHaveLength(2) // 2つの別セッション
      expect(data.data.operations[0].gameCount).toBe(1)
      expect(data.data.operations[1].gameCount).toBe(1)
    })

    it("異なる参加者の対局は別グループになる", async () => {
      const mockGames = [
        {
          id: "game1",
          hostPlayerId: "host1",
          settingsId: "settings1",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          endedAt: new Date("2025-01-01T11:00:00Z"),
          hostPlayer: { name: "ホストプレイヤー" },
          participants: [
            {
              playerId: "player1",
              position: 1,
              player: { name: "プレイヤー1" },
            },
            {
              playerId: "player2",
              position: 2,
              player: { name: "プレイヤー2" },
            },
            {
              playerId: "player3",
              position: 3,
              player: { name: "プレイヤー3" },
            },
            {
              playerId: "player4",
              position: 4,
              player: { name: "プレイヤー4" },
            },
          ],
          settings: {},
        },
        {
          id: "game2",
          hostPlayerId: "host1", // 同じホスト
          settingsId: "settings1",
          createdAt: new Date("2025-01-01T11:30:00Z"),
          endedAt: new Date("2025-01-01T12:30:00Z"),
          hostPlayer: { name: "ホストプレイヤー" },
          participants: [
            {
              playerId: "player1",
              position: 1,
              player: { name: "プレイヤー1" },
            },
            {
              playerId: "player2",
              position: 2,
              player: { name: "プレイヤー2" },
            },
            {
              playerId: "player3",
              position: 3,
              player: { name: "プレイヤー3" },
            },
            {
              playerId: "player5", // 異なる参加者
              position: 4,
              player: { name: "プレイヤー5" },
            },
          ],
          settings: {},
        },
      ]

      ;(prisma.game.findMany as jest.Mock).mockResolvedValue(mockGames)

      const request = new NextRequest(
        "http://localhost/api/admin/migrate-to-sessions",
        {
          method: "POST",
          body: JSON.stringify({ dryRun: true }),
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.operations).toHaveLength(2) // 2つの別セッション
    })
  })
})
