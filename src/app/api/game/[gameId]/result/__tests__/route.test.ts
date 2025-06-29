import { GET } from "@/app/api/game/[gameId]/result/route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"

// Prismaのモック
jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    soloGame: {
      findUnique: jest.fn(),
    },
    gameEvent: {
      findFirst: jest.fn(),
    },
  },
}))

describe("GET /api/game/[gameId]/result", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>
  const mockGameId = "test-game-id"
  const mockSoloGameId = "test-solo-game-id"

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("マルチプレイヤーゲーム", () => {
    const mockMultiGameData = {
      id: mockGameId,
      roomCode: "TEST123",
      status: "FINISHED",
      gameType: "HANCHAN",
      endedAt: new Date("2025-01-01T12:00:00Z"),
      sessionId: "session-123",
      sessionOrder: 1,
      participants: [
        {
          playerId: "player1",
          position: 0,
          finalPoints: 32000,
          finalRank: 1,
          uma: 20,
          settlement: 7000,
          currentPoints: 32000,
          player: { name: "Player 1" },
        },
        {
          playerId: "player2",
          position: 1,
          finalPoints: 28000,
          finalRank: 2,
          uma: 10,
          settlement: 3000,
          currentPoints: 28000,
          player: { name: "Player 2" },
        },
        {
          playerId: "player3",
          position: 2,
          finalPoints: 22000,
          finalRank: 3,
          uma: -10,
          settlement: -3000,
          currentPoints: 22000,
          player: { name: "Player 3" },
        },
        {
          playerId: "player4",
          position: 3,
          finalPoints: 18000,
          finalRank: 4,
          uma: -20,
          settlement: -7000,
          currentPoints: 18000,
          player: { name: "Player 4" },
        },
      ],
      result: {
        id: "result-123",
        gameId: mockGameId,
      },
      settings: {
        basePoints: 25000,
        gameType: "HANCHAN",
      },
      session: {
        sessionCode: "S123",
        name: "Test Session",
        hostPlayerId: "player1",
        hostPlayer: { name: "Player 1" },
      },
    }

    const mockEndEvent = {
      eventType: "GAME_END",
      eventData: { reason: "オーラス終了" },
      createdAt: new Date(),
    }

    beforeEach(() => {
      mockPrisma.game.findUnique.mockResolvedValue(mockMultiGameData)
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)
      mockPrisma.gameEvent.findFirst.mockResolvedValue(mockEndEvent)
    })

    it("マルチプレイヤーゲームの正常な結果取得", async () => {
      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toMatchObject({
        gameId: mockGameId,
        roomCode: "TEST123",
        gameMode: "MULTIPLAYER",
        gameType: "HANCHAN",
        endReason: "オーラス終了",
        basePoints: 25000,
        sessionId: "session-123",
        sessionCode: "S123",
        sessionName: "Test Session",
        hostPlayerId: "player1",
      })
      expect(responseData.data.results).toHaveLength(4)
      expect(responseData.data.results[0]).toMatchObject({
        playerId: "player1",
        name: "Player 1",
        finalPoints: 32000,
        rank: 1,
        uma: 20,
        settlement: 7000,
      })
    })

    it("次のゲーム情報が含まれる場合", async () => {
      const mockNextGame = {
        id: "next-game-id",
        roomCode: "NEXT123",
      }

      mockPrisma.game.findFirst.mockResolvedValue(mockNextGame)

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.nextGame).toEqual(mockNextGame)
    })

    it("finalRankがnullの場合の順位計算", async () => {
      // finalRankがnullのゲームデータを設定
      const gameWithNullRanks = {
        ...mockMultiGameData,
        participants: mockMultiGameData.participants.map((p) => ({
          ...p,
          finalRank: null,
          finalPoints: null,
          uma: null,
          settlement: null,
        })),
      }

      mockPrisma.game.findUnique.mockResolvedValue(gameWithNullRanks)

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      // 点数順で順位が計算されることを確認
      expect(responseData.data.results[0].rank).toBe(1) // 32000点
      expect(responseData.data.results[3].rank).toBe(4) // 18000点
    })

    it("ゲーム未終了エラー", async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        ...mockMultiGameData,
        status: "PLAYING", // 終了していない
      })

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
      const responseData = await response.json()
      expect(responseData.error.details.code).toBe("GAME_NOT_FINISHED")
    })

    it("終了理由がない場合のデフォルト値", async () => {
      mockPrisma.gameEvent.findFirst.mockResolvedValue(null)

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.endReason).toBe("終了")
    })
  })

  describe("ソロプレイゲーム", () => {
    const mockSoloGameData = {
      id: mockSoloGameId,
      status: "FINISHED",
      initialPoints: 25000,
      endedAt: new Date("2025-01-01T12:00:00Z"),
      players: [
        {
          position: 0,
          name: "Player 1",
          currentPoints: 30000,
          finalPoints: 30000,
          finalRank: 1,
          uma: 15,
          settlement: 5000,
        },
        {
          position: 1,
          name: "Player 2",
          currentPoints: 25000,
          finalPoints: 25000,
          finalRank: 2,
          uma: 5,
          settlement: 0,
        },
        {
          position: 2,
          name: "Player 3",
          currentPoints: 23000,
          finalPoints: 23000,
          finalRank: 3,
          uma: -5,
          settlement: -2000,
        },
        {
          position: 3,
          name: "Player 4",
          currentPoints: 22000,
          finalPoints: 22000,
          finalRank: 4,
          uma: -15,
          settlement: -3000,
        },
      ],
    }

    const mockSoloEndEvent = {
      eventType: "GAME_END",
      eventData: { reason: "ソロゲーム終了" },
      createdAt: new Date(),
    }

    beforeEach(() => {
      mockPrisma.game.findUnique.mockResolvedValue(null)
      mockPrisma.soloGame.findUnique.mockResolvedValue(mockSoloGameData)
      mockPrisma.gameEvent.findFirst.mockResolvedValue(mockSoloEndEvent)
    })

    it("ソロゲームの正常な結果取得", async () => {
      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toMatchObject({
        gameId: mockSoloGameId,
        roomCode: `SOLO-${mockSoloGameId}`,
        gameMode: "SOLO",
        gameType: "HANCHAN",
        endReason: "ソロゲーム終了",
        basePoints: 25000,
        sessionId: undefined,
        sessionCode: undefined,
        sessionName: undefined,
        hostPlayerId: undefined,
        nextGame: null,
      })
      expect(responseData.data.results).toHaveLength(4)
      expect(responseData.data.results[0]).toMatchObject({
        playerId: "0",
        name: "Player 1",
        finalPoints: 30000,
        rank: 1,
        uma: 15,
        settlement: 5000,
      })
    })

    it("ソロゲームでfinalRankがnullの場合", async () => {
      const gameWithNullRanks = {
        ...mockSoloGameData,
        players: mockSoloGameData.players.map((p) => ({
          ...p,
          finalRank: null,
          finalPoints: null,
          uma: null,
          settlement: null,
        })),
      }

      mockPrisma.soloGame.findUnique.mockResolvedValue(gameWithNullRanks)

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      // 点数順で順位が計算されることを確認
      expect(responseData.data.results[0].rank).toBe(1) // 30000点
      expect(responseData.data.results[3].rank).toBe(4) // 22000点
      // settlementが自動計算されることを確認
      expect(responseData.data.results[0].settlement).toBe(5000) // 30000 - 25000
    })

    it("ソロゲーム未終了エラー", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue({
        ...mockSoloGameData,
        status: "PLAYING", // 終了していない
      })

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(400)
      const responseData = await response.json()
      expect(responseData.error.details.code).toBe("GAME_NOT_FINISHED")
    })

    it("ソロゲームのinitialPointsがnullの場合のデフォルト値", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue({
        ...mockSoloGameData,
        initialPoints: null,
      })

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockSoloGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.basePoints).toBe(25000) // デフォルト値
    })
  })

  describe("エラーケース", () => {
    it("ゲームが見つからない場合", async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null)
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: "nonexistent-game" }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      expect(response.status).toBe(404)
      const responseData = await response.json()
      expect(responseData.error.details.code).toBe("GAME_NOT_FOUND")
    })

    it("GameEventのeventDataが無効な形式の場合", async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: mockGameId,
        roomCode: "TEST123",
        status: "FINISHED",
        participants: [],
        result: null,
        settings: null,
        session: null,
      })

      mockPrisma.gameEvent.findFirst.mockResolvedValue({
        eventType: "GAME_END",
        eventData: "invalid-data", // オブジェクトでない
        createdAt: new Date(),
      })

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.endReason).toBe("終了") // デフォルト値
    })

    it("GameEventのeventDataにreasonがない場合", async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: mockGameId,
        roomCode: "TEST123",
        status: "FINISHED",
        participants: [],
        result: null,
        settings: null,
        session: null,
      })

      mockPrisma.gameEvent.findFirst.mockResolvedValue({
        eventType: "GAME_END",
        eventData: { other: "data" }, // reasonがない
        createdAt: new Date(),
      })

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.endReason).toBe("終了") // デフォルト値
    })

    it("次のゲームが存在しない場合", async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: mockGameId,
        roomCode: "TEST123",
        status: "FINISHED",
        sessionId: "session-123",
        sessionOrder: 5, // 最後のゲーム
        participants: [],
        result: null,
        settings: { basePoints: 25000 },
        session: null,
      })

      mockPrisma.gameEvent.findFirst.mockResolvedValue(null)
      mockPrisma.game.findFirst.mockResolvedValue(null) // 次のゲームなし

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.nextGame).toBeNull()
    })

    it("settingsがnullの場合のデフォルト値", async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: mockGameId,
        roomCode: "TEST123",
        status: "FINISHED",
        gameType: "TONPUU", // gameTypeは直接設定
        participants: [],
        result: null,
        settings: null, // settingsがnull
        session: null,
      })

      mockPrisma.gameEvent.findFirst.mockResolvedValue(null)

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.basePoints).toBe(25000) // デフォルト値
      expect(responseData.data.gameType).toBe("TONPUU") // gameTypeから取得
    })
  })

  describe("複雑なテストケース", () => {
    it("同点の場合の順位処理", async () => {
      const gameWithTiedScores = {
        id: mockGameId,
        roomCode: "TEST123",
        status: "FINISHED",
        participants: [
          {
            playerId: "player1",
            currentPoints: 25000,
            finalPoints: null,
            finalRank: null,
            player: { name: "Player 1" },
          },
          {
            playerId: "player2",
            currentPoints: 25000, // 同点
            finalPoints: null,
            finalRank: null,
            player: { name: "Player 2" },
          },
        ],
        result: null,
        settings: { basePoints: 25000 },
        session: null,
      }

      mockPrisma.game.findUnique.mockResolvedValue(gameWithTiedScores)
      mockPrisma.gameEvent.findFirst.mockResolvedValue(null)

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      // 同点の場合でも順位が付けられることを確認
      expect(responseData.data.results).toHaveLength(2)
      expect(responseData.data.results[0].rank).toBe(1)
      expect(responseData.data.results[1].rank).toBe(2)
    })

    it("空のparticipants配列の場合", async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: mockGameId,
        roomCode: "TEST123",
        status: "FINISHED",
        participants: [], // 空の配列
        result: null,
        settings: { basePoints: 25000 },
        session: null,
      })

      mockPrisma.gameEvent.findFirst.mockResolvedValue(null)

      const { req } = createMocks({
        method: "GET",
      })

      const mockParams = { gameId: mockGameId }
      const response = await GET(req as unknown as NextRequest, {
        params: Promise.resolve(mockParams),
      })

      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.results).toEqual([])
    })
  })
})