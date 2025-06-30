import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import {
  getCurrentPlayer,
  requireAuth,
  checkGameAccess,
  checkHostAccess,
  checkSessionAccess,
  type AuthenticatedUser,
} from "../auth"

// Cookiesのモック
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}))

// Prismaのモック
jest.mock("@/lib/prisma", () => ({
  prisma: {
    player: {
      findUnique: jest.fn(),
    },
    gameParticipant: {
      findFirst: jest.fn(),
    },
    game: {
      findUnique: jest.fn(),
    },
    sessionParticipant: {
      findFirst: jest.fn(),
    },
  },
}))

const mockCookies = cookies as jest.MockedFunction<typeof cookies>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe("lib/auth.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    // console.errorをモック
    jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("getCurrentPlayer", () => {
    const mockPlayer = {
      id: "player-123",
      name: "テストプレイヤー",
      deviceId: "device-456",
    }

    it("有効なCookieとプレイヤーが存在する場合、プレイヤー情報を返す", async () => {
      const mockCookieStore = {
        get: jest.fn().mockReturnValue({ value: "player-123" }),
      }
      mockCookies.mockResolvedValue(mockCookieStore as any)
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer)

      const result = await getCurrentPlayer()

      expect(result).toEqual({
        playerId: "player-123",
        name: "テストプレイヤー",
        deviceId: "device-456",
      })
      expect(mockPrisma.player.findUnique).toHaveBeenCalledWith({
        where: { id: "player-123" },
      })
    })

    it("デバイスIDがnullの場合、undefinedを返す", async () => {
      const playerWithoutDevice = { ...mockPlayer, deviceId: null }
      const mockCookieStore = {
        get: jest.fn().mockReturnValue({ value: "player-123" }),
      }
      mockCookies.mockResolvedValue(mockCookieStore as any)
      mockPrisma.player.findUnique.mockResolvedValue(playerWithoutDevice)

      const result = await getCurrentPlayer()

      expect(result).toEqual({
        playerId: "player-123",
        name: "テストプレイヤー",
        deviceId: undefined,
      })
    })

    it("Cookieにplayer_idが存在しない場合、nullを返す", async () => {
      const mockCookieStore = {
        get: jest.fn().mockReturnValue(undefined),
      }
      mockCookies.mockResolvedValue(mockCookieStore as any)

      const result = await getCurrentPlayer()

      expect(result).toBe(null)
      expect(mockPrisma.player.findUnique).not.toHaveBeenCalled()
    })

    it("プレイヤーがデータベースに存在しない場合、nullを返す", async () => {
      const mockCookieStore = {
        get: jest.fn().mockReturnValue({ value: "nonexistent-player" }),
      }
      mockCookies.mockResolvedValue(mockCookieStore as any)
      mockPrisma.player.findUnique.mockResolvedValue(null)

      const result = await getCurrentPlayer()

      expect(result).toBe(null)
    })

    it("Cookieの取得でエラーが発生した場合、nullを返しエラーログを出力", async () => {
      const error = new Error("Cookie access failed")
      mockCookies.mockRejectedValue(error)

      const result = await getCurrentPlayer()

      expect(result).toBe(null)
      expect(console.error).toHaveBeenCalledWith(
        "Get current player failed:",
        error
      )
    })

    it("データベースアクセスでエラーが発生した場合、nullを返しエラーログを出力", async () => {
      const mockCookieStore = {
        get: jest.fn().mockReturnValue({ value: "player-123" }),
      }
      mockCookies.mockResolvedValue(mockCookieStore as any)

      const dbError = new Error("Database connection failed")
      mockPrisma.player.findUnique.mockRejectedValue(dbError)

      const result = await getCurrentPlayer()

      expect(result).toBe(null)
      expect(console.error).toHaveBeenCalledWith(
        "Get current player failed:",
        dbError
      )
    })
  })

  describe("requireAuth", () => {
    it("getCurrentPlayerがプレイヤーを返す場合、そのプレイヤーを返す", async () => {
      const mockPlayer: AuthenticatedUser = {
        playerId: "player-123",
        name: "テストプレイヤー",
        deviceId: "device-456",
      }

      // getCurrentPlayerをモック
      const mockCookieStore = {
        get: jest.fn().mockReturnValue({ value: "player-123" }),
      }
      mockCookies.mockResolvedValue(mockCookieStore as any)
      mockPrisma.player.findUnique.mockResolvedValue({
        id: "player-123",
        name: "テストプレイヤー",
        deviceId: "device-456",
      })

      const result = await requireAuth()

      expect(result).toEqual(mockPlayer)
    })

    it("getCurrentPlayerがnullを返す場合、エラーを投げる", async () => {
      const mockCookieStore = {
        get: jest.fn().mockReturnValue(undefined),
      }
      mockCookies.mockResolvedValue(mockCookieStore as any)

      await expect(requireAuth()).rejects.toThrow("Authentication required")
    })

    it("getCurrentPlayerでエラーが発生した場合、エラーを投げる", async () => {
      const error = new Error("Database error")
      mockCookies.mockRejectedValue(error)

      await expect(requireAuth()).rejects.toThrow("Authentication required")
    })
  })

  describe("checkGameAccess", () => {
    const gameId = "game-123"
    const playerId = "player-456"

    it("プレイヤーがゲームに参加している場合、trueを返す", async () => {
      const mockParticipant = {
        id: "participant-123",
        gameId,
        playerId,
      }
      mockPrisma.gameParticipant.findFirst.mockResolvedValue(mockParticipant)

      const result = await checkGameAccess(gameId, playerId)

      expect(result).toBe(true)
      expect(mockPrisma.gameParticipant.findFirst).toHaveBeenCalledWith({
        where: {
          gameId,
          playerId,
        },
      })
    })

    it("プレイヤーがゲームに参加していない場合、falseを返す", async () => {
      mockPrisma.gameParticipant.findFirst.mockResolvedValue(null)

      const result = await checkGameAccess(gameId, playerId)

      expect(result).toBe(false)
    })

    it("データベースエラーが発生した場合、falseを返しエラーログを出力", async () => {
      const dbError = new Error("Database query failed")
      mockPrisma.gameParticipant.findFirst.mockRejectedValue(dbError)

      const result = await checkGameAccess(gameId, playerId)

      expect(result).toBe(false)
      expect(console.error).toHaveBeenCalledWith(
        "Game access check failed:",
        dbError
      )
    })
  })

  describe("checkHostAccess", () => {
    const gameId = "game-123"
    const playerId = "player-456"

    it("プレイヤーがゲームのホストである場合、trueを返す", async () => {
      const mockGame = {
        id: gameId,
        hostPlayerId: playerId,
      }
      mockPrisma.game.findUnique.mockResolvedValue(mockGame)

      const result = await checkHostAccess(gameId, playerId)

      expect(result).toBe(true)
      expect(mockPrisma.game.findUnique).toHaveBeenCalledWith({
        where: { id: gameId },
      })
    })

    it("プレイヤーがゲームのホストでない場合、falseを返す", async () => {
      const mockGame = {
        id: gameId,
        hostPlayerId: "different-player",
      }
      mockPrisma.game.findUnique.mockResolvedValue(mockGame)

      const result = await checkHostAccess(gameId, playerId)

      expect(result).toBe(false)
    })

    it("ゲームが存在しない場合、falseを返す", async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null)

      const result = await checkHostAccess(gameId, playerId)

      expect(result).toBe(false)
    })

    it("データベースエラーが発生した場合、falseを返しエラーログを出力", async () => {
      const dbError = new Error("Database query failed")
      mockPrisma.game.findUnique.mockRejectedValue(dbError)

      const result = await checkHostAccess(gameId, playerId)

      expect(result).toBe(false)
      expect(console.error).toHaveBeenCalledWith(
        "Host access check failed:",
        dbError
      )
    })

    it("hostPlayerIdがundefinedの場合、falseを返す", async () => {
      const mockGame = {
        id: gameId,
        hostPlayerId: undefined,
      }
      mockPrisma.game.findUnique.mockResolvedValue(mockGame)

      const result = await checkHostAccess(gameId, playerId)

      expect(result).toBe(false)
    })
  })

  describe("checkSessionAccess", () => {
    const sessionId = "session-123"
    const playerId = "player-456"

    it("プレイヤーがセッションに参加している場合、trueを返す", async () => {
      const mockParticipant = {
        id: "participant-789",
        sessionId,
        playerId,
      }
      mockPrisma.sessionParticipant.findFirst.mockResolvedValue(mockParticipant)

      const result = await checkSessionAccess(sessionId, playerId)

      expect(result).toBe(true)
      expect(mockPrisma.sessionParticipant.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId,
          playerId,
        },
      })
    })

    it("プレイヤーがセッションに参加していない場合、falseを返す", async () => {
      mockPrisma.sessionParticipant.findFirst.mockResolvedValue(null)

      const result = await checkSessionAccess(sessionId, playerId)

      expect(result).toBe(false)
    })

    it("データベースエラーが発生した場合、falseを返しエラーログを出力", async () => {
      const dbError = new Error("Database query failed")
      mockPrisma.sessionParticipant.findFirst.mockRejectedValue(dbError)

      const result = await checkSessionAccess(sessionId, playerId)

      expect(result).toBe(false)
      expect(console.error).toHaveBeenCalledWith(
        "Session access check failed:",
        dbError
      )
    })
  })

  describe("型定義のテスト", () => {
    it("AuthenticatedUserインターフェースが正しく定義されている", () => {
      const user: AuthenticatedUser = {
        playerId: "test-id",
        name: "テストユーザー",
        deviceId: "optional-device-id",
      }

      expect(user.playerId).toBe("test-id")
      expect(user.name).toBe("テストユーザー")
      expect(user.deviceId).toBe("optional-device-id")
    })

    it("AuthenticatedUserのdeviceIdはオプショナル", () => {
      const user: AuthenticatedUser = {
        playerId: "test-id",
        name: "テストユーザー",
      }

      expect(user.playerId).toBe("test-id")
      expect(user.name).toBe("テストユーザー")
      expect(user.deviceId).toBeUndefined()
    })
  })
})
