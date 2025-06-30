import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { v4 as uuidv4 } from "uuid"
import { POST, GET } from "../route"

// Mocksの設定
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}))

jest.mock("@/lib/prisma", () => ({
  prisma: {
    player: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock("uuid", () => ({
  v4: jest.fn(),
}))

const mockCookies = cookies as jest.MockedFunction<typeof cookies>
const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>

describe("app/api/auth/player/route.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    // console.logをモック
    jest.spyOn(console, "log").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("POST /api/auth/player", () => {
    const mockCookieStore = {
      set: jest.fn(),
    }

    beforeEach(() => {
      mockCookies.mockResolvedValue(mockCookieStore as any)
      mockUuidv4.mockReturnValue("test-uuid-12345")
    })

    it("新規プレイヤーを作成し認証できる", async () => {
      const requestBody = {
        name: "テストプレイヤー",
        deviceId: "device-123",
      }

      const mockPlayer = {
        id: "player-456",
        name: "テストプレイヤー",
        deviceId: "device-123",
        createdAt: new Date(),
        lastLogin: new Date(),
      }

      // 既存プレイヤーが見つからない
      mockPrisma.player.findFirst.mockResolvedValue(null)
      // 新規プレイヤー作成
      mockPrisma.player.create.mockResolvedValue(mockPlayer)
      // lastLogin更新
      mockPrisma.player.update.mockResolvedValue(mockPlayer)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          host: "localhost",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual({
        playerId: "player-456",
        name: "テストプレイヤー",
        deviceId: "device-123",
        sessionToken: "test-uuid-12345",
      })

      // Prismaの呼び出し確認
      expect(mockPrisma.player.create).toHaveBeenCalledWith({
        data: {
          name: "テストプレイヤー",
          deviceId: "device-123",
          createdAt: expect.any(Date),
        },
      })

      // Cookie設定確認
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "session_token",
        "test-uuid-12345",
        expect.objectContaining({
          httpOnly: true,
          path: "/",
          sameSite: "lax",
          secure: false,
        })
      )
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "player_id",
        "player-456",
        expect.any(Object)
      )
    })

    it("既存プレイヤーでログインできる", async () => {
      const requestBody = {
        name: "既存プレイヤー",
        deviceId: "device-existing",
      }

      const existingPlayer = {
        id: "player-existing",
        name: "既存プレイヤー",
        deviceId: "device-existing",
        createdAt: new Date(),
        lastLogin: new Date(),
      }

      // 既存プレイヤーが見つかる
      mockPrisma.player.findFirst.mockResolvedValue(existingPlayer)
      mockPrisma.player.update.mockResolvedValue(existingPlayer)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          host: "localhost",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data.playerId).toBe("player-existing")

      // 新規作成は呼ばれない
      expect(mockPrisma.player.create).not.toHaveBeenCalled()
      // lastLogin更新は呼ばれる
      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: "player-existing" },
        data: {
          lastLogin: expect.any(Date),
        },
      })
    })

    it("deviceIdなしでも新規プレイヤーを作成できる", async () => {
      const requestBody = {
        name: "deviceIDなしプレイヤー",
      }

      const mockPlayer = {
        id: "player-no-device",
        name: "deviceIDなしプレイヤー",
        deviceId: "test-uuid-12345", // 自動生成されたUUID
        createdAt: new Date(),
        lastLogin: new Date(),
      }

      mockPrisma.player.create.mockResolvedValue(mockPlayer)
      mockPrisma.player.update.mockResolvedValue(mockPlayer)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          host: "localhost",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)

      // 自動生成されたdeviceIdで作成
      expect(mockPrisma.player.create).toHaveBeenCalledWith({
        data: {
          name: "deviceIDなしプレイヤー",
          deviceId: "test-uuid-12345",
          createdAt: expect.any(Date),
        },
      })
    })

    it("Safari + HTTPS環境でSameSite=noneとSecure=trueを設定する", async () => {
      const requestBody = {
        name: "Safariユーザー",
        deviceId: "safari-device",
      }

      const mockPlayer = {
        id: "safari-player",
        name: "Safariユーザー",
        deviceId: "safari-device",
        createdAt: new Date(),
        lastLogin: new Date(),
      }

      mockPrisma.player.findFirst.mockResolvedValue(null)
      mockPrisma.player.create.mockResolvedValue(mockPlayer)
      mockPrisma.player.update.mockResolvedValue(mockPlayer)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
          host: "example.com",
          "x-forwarded-proto": "https",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.debug.browser.isSafari).toBe(true)
      expect(responseData.debug.cookieOptions.sameSite).toBe("none")
      expect(responseData.debug.cookieOptions.secure).toBe(true)

      // Cookie設定確認
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "session_token",
        "test-uuid-12345",
        expect.objectContaining({
          sameSite: "none",
          secure: true,
        })
      )
    })

    it("モバイル + HTTP環境でSameSite=laxとSecure=falseを設定する", async () => {
      const requestBody = {
        name: "モバイルユーザー",
        deviceId: "mobile-device",
      }

      const mockPlayer = {
        id: "mobile-player",
        name: "モバイルユーザー",
        deviceId: "mobile-device",
        createdAt: new Date(),
        lastLogin: new Date(),
      }

      mockPrisma.player.findFirst.mockResolvedValue(null)
      mockPrisma.player.create.mockResolvedValue(mockPlayer)
      mockPrisma.player.update.mockResolvedValue(mockPlayer)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
          host: "localhost:3000",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.debug.browser.isMobile).toBe(true)
      expect(responseData.debug.cookieOptions.sameSite).toBe("lax")
      expect(responseData.debug.cookieOptions.secure).toBe(false)
    })

    it("バリデーションエラーを適切に処理する", async () => {
      const invalidRequestBody = {
        name: "", // 空の名前
        deviceId: "device-123",
      }

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify(invalidRequestBody),
        headers: {
          "content-type": "application/json",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("バリデーションエラー")
      expect(responseData.error.details).toBeDefined()
    })

    it("長すぎる名前でバリデーションエラーを返す", async () => {
      const invalidRequestBody = {
        name: "非常に長いプレイヤー名前前前前前前前", // 20文字超
        deviceId: "device-123",
      }

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify(invalidRequestBody),
        headers: {
          "content-type": "application/json",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("バリデーションエラー")
    })

    it("JSONパースエラーを処理する", async () => {
      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: "invalid json",
        headers: {
          "content-type": "application/json",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("プレイヤー認証に失敗しました")
    })

    it("データベースエラーを処理する", async () => {
      const requestBody = {
        name: "テストプレイヤー",
        deviceId: "device-123",
      }

      // データベースエラーを模擬
      const dbError = new Error("Database connection failed")
      mockPrisma.player.findFirst.mockRejectedValue(dbError)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          "content-type": "application/json",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("プレイヤー認証に失敗しました")
      expect(console.error).toHaveBeenCalledWith(
        "Player authentication failed:",
        dbError
      )
    })
  })

  describe("GET /api/auth/player", () => {
    const mockCookieStore = {
      get: jest.fn(),
    }

    beforeEach(() => {
      mockCookies.mockResolvedValue(mockCookieStore as any)
    })

    it("Cookieからプレイヤー情報を取得できる", async () => {
      const mockPlayer = {
        id: "player-123",
        name: "テストプレイヤー",
        deviceId: "device-456",
      }

      mockCookieStore.get.mockReturnValue({ value: "player-123" })
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "GET",
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual({
        playerId: "player-123",
        name: "テストプレイヤー",
        deviceId: "device-456",
      })

      expect(mockPrisma.player.findUnique).toHaveBeenCalledWith({
        where: { id: "player-123" },
      })
    })

    it("ヘッダーからプレイヤー情報を取得できる（Cookie代替）", async () => {
      const mockPlayer = {
        id: "player-456",
        name: "ヘッダーユーザー",
        deviceId: "device-789",
      }

      // Cookieはなし
      mockCookieStore.get.mockReturnValue(undefined)
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "GET",
        headers: {
          "x-player-id": "player-456", // ヘッダーでプレイヤーID指定
        },
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data.playerId).toBe("player-456")

      expect(console.log).toHaveBeenCalledWith(
        "📱 Using header-based auth, playerId:",
        "player-456"
      )
    })

    it("認証情報がない場合401エラーを返す", async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "GET",
        headers: {
          "user-agent": "Mozilla/5.0 Test Browser",
        },
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("認証が必要です")
      expect(responseData.debug).toEqual({
        cookiePlayerId: undefined,
        headerPlayerId: null,
        userAgent: "Mozilla/5.0 Test Browser",
      })
    })

    it("プレイヤーが見つからない場合404エラーを返す", async () => {
      mockCookieStore.get.mockReturnValue({ value: "nonexistent-player" })
      mockPrisma.player.findUnique.mockResolvedValue(null)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "GET",
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe("プレイヤーが見つかりません")
    })

    it("データベースエラーを処理する", async () => {
      mockCookieStore.get.mockReturnValue({ value: "player-123" })

      const dbError = new Error("Database connection failed")
      mockPrisma.player.findUnique.mockRejectedValue(dbError)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "GET",
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe(
        "プレイヤー情報の取得に失敗しました"
      )
      expect(console.error).toHaveBeenCalledWith(
        "Player info retrieval failed:",
        dbError
      )
    })

    it("Cookieエラーを処理する", async () => {
      const cookieError = new Error("Cookie access failed")
      mockCookies.mockRejectedValue(cookieError)

      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "GET",
      })

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
      expect(responseData.error.message).toBe(
        "プレイヤー情報の取得に失敗しました"
      )
    })
  })

  describe("ブラウザ検出ロジック", () => {
    const mockCookieStore = {
      set: jest.fn(),
    }

    beforeEach(() => {
      mockCookies.mockResolvedValue(mockCookieStore as any)
      mockPrisma.player.findFirst.mockResolvedValue(null)
      mockPrisma.player.create.mockResolvedValue({
        id: "test-player",
        name: "Test",
        deviceId: "test-device",
        createdAt: new Date(),
        lastLogin: new Date(),
      })
      mockPrisma.player.update.mockResolvedValue({} as any)
    })

    it("Chrome（Safari含まず）を正しく判定する", async () => {
      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify({ name: "Chrome User" }),
        headers: {
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(responseData.debug.browser.isSafari).toBe(false)
      expect(responseData.debug.browser.isMobile).toBe(false)
    })

    it("Safariを正しく判定する", async () => {
      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify({ name: "Safari User" }),
        headers: {
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(responseData.debug.browser.isSafari).toBe(true)
      expect(responseData.debug.browser.isMobile).toBe(false)
    })

    it("iPhoneを正しく判定する", async () => {
      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify({ name: "iPhone User" }),
        headers: {
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(responseData.debug.browser.isSafari).toBe(true)
      expect(responseData.debug.browser.isMobile).toBe(true)
    })

    it("iPadを正しく判定する", async () => {
      const request = new NextRequest("http://localhost/api/auth/player", {
        method: "POST",
        body: JSON.stringify({ name: "iPad User" }),
        headers: {
          "content-type": "application/json",
          "user-agent":
            "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(responseData.debug.browser.isMobile).toBe(true)
    })
  })
})
