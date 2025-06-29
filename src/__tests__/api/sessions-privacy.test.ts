/**
 * セッション一覧APIのプライバシーテスト
 * 参加していないセッションが表示されないことを確認
 */
import { GET } from "@/app/api/sessions/route"
import { getCurrentPlayer } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

// モック設定
jest.mock("@/lib/auth")
jest.mock("@/lib/prisma", () => ({
  prisma: {
    gameSession: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))

const mockGetCurrentPlayer = getCurrentPlayer as jest.MockedFunction<
  typeof getCurrentPlayer
>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe("セッション一覧API プライバシーテスト", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("認証されていない場合は401エラーを返す", async () => {
    mockGetCurrentPlayer.mockResolvedValue(null)

    const request = new NextRequest("http://localhost/api/sessions")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error.message).toBe("認証が必要です")
  })

  it("認証されたプレイヤーが参加しているセッションのみを取得する", async () => {
    const currentPlayer = {
      playerId: "player-1",
      name: "テストプレイヤー",
    }

    mockGetCurrentPlayer.mockResolvedValue(currentPlayer)

    const mockSessions = [
      {
        id: "session-1",
        sessionCode: "123456",
        name: "テストセッション1",
        status: "ACTIVE",
        createdAt: new Date(),
        endedAt: null,
        hostPlayer: { id: "host-1", name: "ホスト" },
        settings: null,
        participants: [
          {
            player: { id: "player-1", name: "テストプレイヤー" },
            position: 0,
            totalSettlement: 1000,
            totalGames: 5,
          },
        ],
        games: [],
      },
    ]

    mockPrisma.gameSession.findMany.mockResolvedValue(mockSessions as any)
    mockPrisma.gameSession.count.mockResolvedValue(1)

    const request = new NextRequest("http://localhost/api/sessions")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // 正しいwhere条件でクエリが実行されることを確認
    expect(mockPrisma.gameSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          participants: {
            some: {
              playerId: "player-1",
            },
          },
        },
      })
    )
  })

  it("参加者以外のセッションは除外される", async () => {
    const currentPlayer = {
      playerId: "player-1",
      name: "テストプレイヤー",
    }

    mockGetCurrentPlayer.mockResolvedValue(currentPlayer)

    // 空の結果（参加していないセッション）
    mockPrisma.gameSession.findMany.mockResolvedValue([])
    mockPrisma.gameSession.count.mockResolvedValue(0)

    const request = new NextRequest("http://localhost/api/sessions")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.sessions).toHaveLength(0)
  })
})
