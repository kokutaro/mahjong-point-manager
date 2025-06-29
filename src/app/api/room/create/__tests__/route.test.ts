import { POST } from "@/app/api/room/create/route"
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
      create: jest.fn(),
      count: jest.fn(),
    },
    player: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    gameSettings: {
      create: jest.fn(),
    },
    gameSession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    sessionParticipant: {
      create: jest.fn(),
    },
    gameParticipant: {
      create: jest.fn(),
    },
  },
}))

// ランダム関数のモック
const mockMath = Object.create(global.Math)
mockMath.random = jest.fn()
global.Math = mockMath

describe("POST /api/room/create", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockCookies = require("next/headers").cookies

  beforeEach(() => {
    jest.clearAllMocks()
    // Math.randomの固定値を設定（予測可能なテストのため）
    ;(Math.random as jest.Mock).mockReturnValue(0.123456789)
  })

  describe("新規ルーム作成", () => {
    const mockPlayer = {
      id: "player-123",
      name: "Test Player",
      createdAt: new Date(),
    }

    const mockGameSettings = {
      id: "settings-123",
      gameType: "HANCHAN",
      initialPoints: 25000,
      basePoints: 30000,
      hasTobi: true,
      uma: [20, 10, -10, -20],
    }

    const mockSession = {
      id: "session-123",
      sessionCode: "123456",
      hostPlayerId: "player-123",
      name: null,
      status: "ACTIVE",
      settingsId: "settings-123",
      participants: [],
    }

    const mockGame = {
      id: "game-123",
      roomCode: "4FZBYO",
      hostPlayerId: "player-123",
      settingsId: "settings-123",
      sessionId: "session-123",
      sessionOrder: 1,
      status: "WAITING",
    }

    beforeEach(() => {
      // Cookieなし（新規プレイヤー）
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      })

      // 新規ルームコード生成（重複なし）
      mockPrisma.game.findFirst.mockResolvedValue(null)
      mockPrisma.gameSession.findFirst.mockResolvedValue(null)

      // 新規プレイヤー作成
      mockPrisma.player.findUnique.mockResolvedValue(null)
      mockPrisma.player.create.mockResolvedValue(mockPlayer)

      // ゲーム設定作成
      mockPrisma.gameSettings.create.mockResolvedValue(mockGameSettings)

      // セッション作成
      mockPrisma.gameSession.create.mockResolvedValue(mockSession)
      mockPrisma.sessionParticipant.create.mockResolvedValue({})

      // ゲーム作成
      mockPrisma.game.count.mockResolvedValue(0)
      mockPrisma.game.create.mockResolvedValue(mockGame)
      mockPrisma.gameParticipant.create.mockResolvedValue({})
    })

    it("新規プレイヤーで新規ルーム作成", async () => {
      const requestBody = {
        hostPlayerName: "Test Player",
        gameType: "HANCHAN",
        initialPoints: 25000,
        basePoints: 30000,
        hasTobi: true,
        uma: [20, 10, -10, -20],
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toMatchObject({
        gameId: "game-123",
        roomCode: "4FZBYO",
        sessionId: "session-123",
        sessionCode: "123456",
        hostPlayerId: "player-123",
        settings: requestBody,
      })

      // プレイヤー作成が呼ばれることを確認
      expect(mockPrisma.player.create).toHaveBeenCalledWith({
        data: {
          name: "Test Player",
          createdAt: expect.any(Date),
        },
      })

      // Cookieが設定されることを確認
      const cookiesInstance = mockCookies()
      expect(cookiesInstance.set).toHaveBeenCalled()
    })

    it("既存プレイヤーで新規ルーム作成", async () => {
      // 既存プレイヤーのCookie設定
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: "existing-player-id" }),
        set: jest.fn(),
      })

      mockPrisma.player.findUnique.mockResolvedValue({
        id: "existing-player-id",
        name: "Old Name",
      })

      const updatedPlayer = {
        id: "existing-player-id",
        name: "New Name",
      }
      mockPrisma.player.update.mockResolvedValue(updatedPlayer)

      const requestBody = {
        hostPlayerName: "New Name",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      await POST(req as unknown as NextRequest)

      // プレイヤー名更新が呼ばれることを確認
      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: "existing-player-id" },
        data: { name: "New Name" },
      })

      // 新規作成は呼ばれないことを確認
      expect(mockPrisma.player.create).not.toHaveBeenCalled()
    })

    it("既存プレイヤーで名前変更なしの場合", async () => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: "existing-player-id" }),
        set: jest.fn(),
      })

      mockPrisma.player.findUnique.mockResolvedValue({
        id: "existing-player-id",
        name: "Same Name",
      })

      const requestBody = {
        hostPlayerName: "Same Name", // 同じ名前
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      await POST(req as unknown as NextRequest)

      // プレイヤー名更新は呼ばれないことを確認
      expect(mockPrisma.player.update).not.toHaveBeenCalled()
    })

    it("デフォルト値での作成", async () => {
      const requestBody = {
        hostPlayerName: "Test Player",
        // 他のフィールドはデフォルト値を使用
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.settings).toMatchObject({
        hostPlayerName: "Test Player",
        gameType: "HANCHAN",
        initialPoints: 25000,
        basePoints: 30000,
        hasTobi: true,
        uma: [20, 10, -10, -20],
        sessionMode: false,
      })
    })

    it("カスタムセッション名の設定", async () => {
      const requestBody = {
        hostPlayerName: "Test Player",
        sessionName: "カスタムセッション",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      await POST(req as unknown as NextRequest)

      expect(mockPrisma.gameSession.create).toHaveBeenCalledWith({
        data: {
          sessionCode: expect.any(String),
          hostPlayerId: "player-123",
          name: "カスタムセッション",
          status: "ACTIVE",
          settingsId: "settings-123",
          createdAt: expect.any(Date),
        },
        include: { participants: true },
      })
    })

    it("ルームコード重複時の再生成", async () => {
      // 最初の呼び出しでは重複あり、2回目で重複なし
      mockPrisma.game.findFirst
        .mockResolvedValueOnce({ id: "existing-game" }) // 重複あり
        .mockResolvedValueOnce(null) // 重複なし

      const requestBody = {
        hostPlayerName: "Test Player",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      await POST(req as unknown as NextRequest)

      // findFirstが2回呼ばれることを確認
      expect(mockPrisma.game.findFirst).toHaveBeenCalledTimes(2)
    })

    it("セッションコード重複時の再生成", async () => {
      // 最初の呼び出しでは重複あり、2回目で重複なし
      mockPrisma.gameSession.findFirst
        .mockResolvedValueOnce({ id: "existing-session" }) // 重複あり
        .mockResolvedValueOnce(null) // 重複なし

      const requestBody = {
        hostPlayerName: "Test Player",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      await POST(req as unknown as NextRequest)

      // セッション重複チェックが2回呼ばれることを確認
      expect(mockPrisma.gameSession.findFirst).toHaveBeenCalledTimes(2)
    })
  })

  describe("既存セッション継続", () => {
    const mockExistingSession = {
      id: "existing-session-123",
      sessionCode: "654321",
      participants: [],
    }

    beforeEach(() => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      })

      mockPrisma.player.create.mockResolvedValue({
        id: "player-123",
        name: "Test Player",
      })

      mockPrisma.gameSettings.create.mockResolvedValue({
        id: "settings-123",
      })

      mockPrisma.gameSession.findUnique.mockResolvedValue(mockExistingSession)

      mockPrisma.game.findFirst.mockResolvedValue(null)
      mockPrisma.game.count.mockResolvedValue(1) // 既に1ゲーム存在
      mockPrisma.game.create.mockResolvedValue({
        id: "game-123",
        roomCode: "4FZBYO",
      })
      mockPrisma.gameParticipant.create.mockResolvedValue({})
    })

    it("既存セッションでのルーム作成", async () => {
      const requestBody = {
        hostPlayerName: "Test Player",
        existingSessionId: "existing-session-123",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.sessionId).toBe("existing-session-123")
      expect(responseData.data.sessionCode).toBe("654321")

      // 新規セッション作成は呼ばれないことを確認
      expect(mockPrisma.gameSession.create).not.toHaveBeenCalled()

      // セッションオーダーが2になることを確認（既に1ゲーム存在）
      expect(mockPrisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionOrder: 2,
          }),
        })
      )
    })

    it("存在しない既存セッションIDでエラー", async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(null)

      const requestBody = {
        hostPlayerName: "Test Player",
        existingSessionId: "nonexistent-session",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("指定されたセッションが見つかりません")
    })
  })

  describe("バリデーションエラー", () => {
    beforeEach(() => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      })
    })

    it("必須フィールド（hostPlayerName）の欠如", async () => {
      const requestBody = {
        // hostPlayerNameが不足
        gameType: "HANCHAN",
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

    it("hostPlayerNameの長さ制限", async () => {
      const requestBody = {
        hostPlayerName: "a".repeat(21), // 20文字を超過
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)

      expect(response.status).toBe(400)
    })

    it("無効なgameType", async () => {
      const requestBody = {
        hostPlayerName: "Test Player",
        gameType: "INVALID_TYPE",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)

      expect(response.status).toBe(400)
    })

    it("initialPointsの範囲外", async () => {
      const requestBody = {
        hostPlayerName: "Test Player",
        initialPoints: 15000, // 20000未満
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)

      expect(response.status).toBe(400)
    })

    it("basePointsの範囲外", async () => {
      const requestBody = {
        hostPlayerName: "Test Player",
        basePoints: 60000, // 50000超過
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)

      expect(response.status).toBe(400)
    })

    it("umaの長さ不正", async () => {
      const requestBody = {
        hostPlayerName: "Test Player",
        uma: [20, 10, -10], // 4つでない
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
    beforeEach(() => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      })
    })

    it("データベース接続エラー", async () => {
      mockPrisma.game.findFirst.mockRejectedValue(new Error("DB connection failed"))

      const requestBody = {
        hostPlayerName: "Test Player",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("ルーム作成に失敗しました")
      expect(responseData.error.details).toBe("DB connection failed")
    })

    it("不明なエラー", async () => {
      mockPrisma.game.findFirst.mockRejectedValue("Unknown error")

      const requestBody = {
        hostPlayerName: "Test Player",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error.details).toBe("Unknown error")
    })
  })

  describe("エッジケース", () => {
    beforeEach(() => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue(undefined),
        set: jest.fn(),
      })

      mockPrisma.player.create.mockResolvedValue({
        id: "player-123",
        name: "Test Player",
      })

      mockPrisma.gameSettings.create.mockResolvedValue({
        id: "settings-123",
      })

      mockPrisma.gameSession.create.mockResolvedValue({
        id: "session-123",
        sessionCode: "123456",
        participants: [],
      })

      mockPrisma.sessionParticipant.create.mockResolvedValue({})
      mockPrisma.game.findFirst.mockResolvedValue(null)
      mockPrisma.game.count.mockResolvedValue(0)
      mockPrisma.game.create.mockResolvedValue({
        id: "game-123",
        roomCode: "4FZBYO",
      })
      mockPrisma.gameParticipant.create.mockResolvedValue({})
    })

    it("空文字列のセッション名", async () => {
      const requestBody = {
        hostPlayerName: "Test Player",
        sessionName: "",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)

      expect(response.status).toBe(200)
      // 空文字列はnullに変換される
      expect(mockPrisma.gameSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: null,
          }),
        })
      )
    })

    it("sessionModeがtrueの場合", async () => {
      const requestBody = {
        hostPlayerName: "Test Player",
        sessionMode: true,
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.settings.sessionMode).toBe(true)
    })

    it("TONPUUゲームタイプの作成", async () => {
      const requestBody = {
        hostPlayerName: "Test Player",
        gameType: "TONPUU",
      }

      const { req } = createMocks({
        method: "POST",
        json: () => requestBody,
      })

      const response = await POST(req as unknown as NextRequest)

      expect(response.status).toBe(200)
      expect(mockPrisma.gameSettings.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gameType: "TONPUU",
        }),
      })
    })
  })
})