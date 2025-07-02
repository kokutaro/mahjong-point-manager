import { POST } from "@/app/api/room/[roomCode]/rejoin/route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"

// Next.js cookiesのモック
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}))

// Prismaのモック
jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    player: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    gameParticipant: {
      update: jest.fn(),
    },
  },
}))

// Socket.ioのモック
jest.mock("@/lib/socket", () => ({
  getIO: jest.fn(() => ({
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
  })),
}))

describe("POST /api/room/[roomCode]/rejoin", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockCookies = require("next/headers").cookies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockGetIO = require("@/lib/socket").getIO

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockGame = {
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
        id: "participant-1",
        playerId: "old-player-id",
        position: 0,
        currentPoints: 25000,
        isReach: false,
        player: {
          name: "テストプレイヤー",
        },
      },
    ],
  }

  const mockCurrentPlayer = {
    id: "current-player-id",
    name: "現在のプレイヤー",
    createdAt: new Date(),
  }

  describe("正常系 - 再参加成功", () => {
    beforeEach(() => {
      // 認証情報設定
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: "current-player-id" }),
        set: jest.fn(),
      })

      mockPrisma.game.findFirst.mockResolvedValue(mockGame)
      mockPrisma.player.findUnique.mockResolvedValue(mockCurrentPlayer)
      mockPrisma.gameParticipant.update.mockResolvedValue({})
      mockPrisma.game.update.mockResolvedValue({})
      mockPrisma.game.findUnique.mockResolvedValue({
        ...mockGame,
        participants: [
          {
            ...mockGame.participants[0],
            playerId: "current-player-id",
          },
        ],
      })
    })

    it("同じ名前のプレイヤーで再参加できる", async () => {
      const requestBody = {
        playerName: "テストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "abcd12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toMatchObject({
        gameId: "game-123",
        playerId: "current-player-id",
        position: 0,
        roomCode: "ABCD12",
        message: "ルームに再参加しました",
      })

      // 参加者のプレイヤーIDが更新されることを確認
      expect(mockPrisma.gameParticipant.update).toHaveBeenCalledWith({
        where: { id: "participant-1" },
        data: { playerId: "current-player-id" },
      })
    })

    it("ホストプレイヤーの再参加でゲームのホストIDも更新される", async () => {
      const hostGame = {
        ...mockGame,
        hostPlayer: {
          id: "old-host-id",
          name: "ホストプレイヤー",
        },
        participants: [
          {
            id: "participant-1",
            playerId: "old-host-id",
            position: 0,
            currentPoints: 25000,
            isReach: false,
            player: {
              name: "ホストプレイヤー",
            },
          },
        ],
      }

      mockPrisma.game.findFirst.mockResolvedValue(hostGame)

      const requestBody = {
        playerName: "ホストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      // ゲームのホストプレイヤーIDが更新されることを確認
      expect(mockPrisma.game.update).toHaveBeenCalledWith({
        where: { id: "game-123" },
        data: { hostPlayerId: "current-player-id" },
      })
    })

    it("古いプレイヤーレコードが削除される", async () => {
      mockPrisma.player.delete.mockResolvedValue({})

      const requestBody = {
        playerName: "テストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(mockPrisma.player.delete).toHaveBeenCalledWith({
        where: { id: "old-player-id" },
      })
    })

    it("WebSocketで再参加通知が送信される", async () => {
      const mockEmit = jest.fn()
      const mockTo = jest.fn(() => ({ emit: mockEmit }))
      mockGetIO.mockReturnValue({ to: mockTo })

      const requestBody = {
        playerName: "テストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(mockTo).toHaveBeenCalledWith("ABCD12")
      expect(mockEmit).toHaveBeenCalledWith("player_rejoined", {
        playerId: "current-player-id",
        playerName: "テストプレイヤー",
        position: 0,
        gameState: expect.objectContaining({
          gameId: "game-123",
          players: expect.any(Array),
          gamePhase: "waiting",
        }),
      })
    })

    it("Cookieが再設定される", async () => {
      const mockSetCookie = jest.fn()
      const mockResponseWithCookies = {
        json: jest.fn(() => Promise.resolve({})),
        cookies: { set: mockSetCookie },
      }

      // NextResponseのモック（簡易版）
      const originalNextResponse =
        jest.requireActual("next/server").NextResponse
      jest
        .spyOn(originalNextResponse, "json")
        .mockReturnValue(mockResponseWithCookies)

      const requestBody = {
        playerName: "テストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(mockSetCookie).toHaveBeenCalledWith(
        "player_id",
        "current-player-id",
        {
          httpOnly: false,
          secure: false, // NODE_ENV !== "production"
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60,
        }
      )
    })
  })

  describe("異常系", () => {
    beforeEach(() => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: "current-player-id" }),
        set: jest.fn(),
      })
    })

    it("存在しないルームコードで404エラー", async () => {
      mockPrisma.game.findFirst.mockResolvedValue(null)

      const requestBody = {
        playerName: "テストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "NOTFOUND" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe(
        "指定されたルームが見つからないか、既にゲームが開始されています"
      )
    })

    it("認証情報がない場合は401エラー", async () => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      })

      const requestBody = {
        playerName: "テストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.error.message).toBe("認証が必要です")
    })

    it("プレイヤー情報が見つからない場合は404エラー", async () => {
      mockPrisma.game.findFirst.mockResolvedValue(mockGame)
      mockPrisma.player.findUnique.mockResolvedValue(null)

      const requestBody = {
        playerName: "テストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.error.message).toBe("プレイヤー情報が見つかりません")
    })

    it("該当する名前のプレイヤーがルームにいない場合は404エラー", async () => {
      mockPrisma.game.findFirst.mockResolvedValue(mockGame)
      mockPrisma.player.findUnique.mockResolvedValue(mockCurrentPlayer)

      const requestBody = {
        playerName: "存在しないプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.error.message).toBe(
        "このルームに該当する名前のプレイヤーが見つかりません"
      )
    })

    it("バリデーションエラー - 空のプレイヤー名", async () => {
      const requestBody = {
        playerName: "",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error.message).toBe("バリデーションエラー")
      expect(responseData.error.details).toBeDefined()
    })

    it("バリデーションエラー - 長すぎるプレイヤー名", async () => {
      const requestBody = {
        playerName: "a".repeat(21), // 20文字超過
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(response.status).toBe(400)
    })

    it("データベースエラーで500エラー", async () => {
      mockPrisma.game.findFirst.mockRejectedValue(new Error("DB Error"))

      const requestBody = {
        playerName: "テストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error.message).toBe("ルーム再参加に失敗しました")
    })
  })

  describe("エッジケース", () => {
    beforeEach(() => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: "current-player-id" }),
        set: jest.fn(),
      })
      mockPrisma.game.findFirst.mockResolvedValue(mockGame)
      mockPrisma.player.findUnique.mockResolvedValue(mockCurrentPlayer)
    })

    it("同じプレイヤーIDで再参加する場合、削除処理をスキップ", async () => {
      const samePlayerGame = {
        ...mockGame,
        participants: [
          {
            ...mockGame.participants[0],
            playerId: "current-player-id", // 同じプレイヤーID
          },
        ],
      }
      mockPrisma.game.findFirst.mockResolvedValue(samePlayerGame)
      mockPrisma.gameParticipant.update.mockResolvedValue({})

      const requestBody = {
        playerName: "テストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      // プレイヤー削除は呼ばれないことを確認
      expect(mockPrisma.player.delete).not.toHaveBeenCalled()
    })

    it("プレイヤー削除でエラーが発生しても処理は継続される", async () => {
      mockPrisma.gameParticipant.update.mockResolvedValue({})
      mockPrisma.player.delete.mockRejectedValue(new Error("Cannot delete"))
      mockPrisma.game.findUnique.mockResolvedValue({
        ...mockGame,
        participants: [
          {
            ...mockGame.participants[0],
            playerId: "current-player-id",
          },
        ],
      })

      const requestBody = {
        playerName: "テストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(response.status).toBe(200) // 削除エラーでも成功
    })

    it("Socket.IOが利用できない場合でも処理は継続される", async () => {
      mockGetIO.mockReturnValue(null)
      mockPrisma.gameParticipant.update.mockResolvedValue({})
      mockPrisma.game.findUnique.mockResolvedValue({
        ...mockGame,
        participants: [
          {
            ...mockGame.participants[0],
            playerId: "current-player-id",
          },
        ],
      })

      const requestBody = {
        playerName: "テストプレイヤー",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ roomCode: "ABCD12" }),
      })

      expect(response.status).toBe(200)
    })
  })
})
