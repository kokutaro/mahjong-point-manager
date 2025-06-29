import { PointManager } from "../point-manager"

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    gameParticipant: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    gameEvent: {
      create: jest.fn(),
    },
    gameResult: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    gameSettings: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback({})),
  },
}))

// Mock score calculation module
jest.mock("../score", () => ({
  calculateScore: jest.fn(),
}))

describe("PointManager", () => {
  let pointManager: PointManager
  const mockPrisma = jest.requireMock("@/lib/prisma").prisma

  beforeEach(() => {
    pointManager = new PointManager("test-game-id")
    jest.clearAllMocks()
  })

  describe("クラス初期化", () => {
    test("PointManagerが正しく初期化される", () => {
      expect(pointManager).toBeInstanceOf(PointManager)
    })
  })

  describe("精算計算", () => {
    test("精算計算が正しく行われる", () => {
      const mockParticipants = [
        { playerId: "player1", currentPoints: 34500, position: 0 },
        { playerId: "player2", currentPoints: 27400, position: 1 },
        { playerId: "player3", currentPoints: 22600, position: 2 },
        { playerId: "player4", currentPoints: 15500, position: 3 },
      ]

      const mockSettings = {
        uma: [20, 10, -10, -20],
        basePoints: 30000,
      }

      // Use the private method by accessing it through bracket notation
      const result = pointManager["calculateSettlement"](
        mockParticipants,
        mockSettings
      )

      expect(result).toHaveLength(4)
      expect(result[0].rank).toBe(1) // Highest points
      expect(result[3].rank).toBe(4) // Lowest points

      // Check that uma is applied correctly
      expect(result[0].uma).toBe(20) // 1st place
      expect(result[1].uma).toBe(10) // 2nd place
      expect(result[2].uma).toBe(-10) // 3rd place
      expect(result[3].uma).toBe(-20) // 4th place
    })

    test("同点時の順位処理", () => {
      const mockParticipants = [
        { playerId: "player1", currentPoints: 25000, position: 0 },
        { playerId: "player2", currentPoints: 25000, position: 1 },
        { playerId: "player3", currentPoints: 25000, position: 2 },
        { playerId: "player4", currentPoints: 25000, position: 3 },
      ]

      const mockSettings = {
        uma: [20, 10, -10, -20],
        basePoints: 25000,
      }

      const result = pointManager["calculateSettlement"](
        mockParticipants,
        mockSettings
      )

      // Check that all players have proper settlement calculations
      expect(result).toHaveLength(4)
      result.forEach((player) => {
        expect(player.finalPoints).toBe(25000)
        expect(player.pointDiff).toBe(0)
      })
    })
  })

  describe("ゲーム状態管理", () => {
    test("ゲーム終了チェック", async () => {
      mockPrisma.gameParticipant.findMany.mockResolvedValue([
        { currentPoints: 35000, playerId: "player1" },
        { currentPoints: 25000, playerId: "player2" },
        { currentPoints: 20000, playerId: "player3" },
        { currentPoints: -5000, playerId: "player4" }, // Negative points
      ])

      mockPrisma.game.findUnique.mockResolvedValue({
        currentRound: 8,
        gameType: "hanchan",
        settings: {
          hasTobi: true,
        },
      })

      const result = await pointManager.checkGameEnd()

      expect(result.shouldEnd).toBe(true)
      expect(result.reason).toContain("トビ終了")
    })

    test("通常のゲーム続行", async () => {
      mockPrisma.gameParticipant.findMany.mockResolvedValue([
        { currentPoints: 35000, playerId: "player1" },
        { currentPoints: 25000, playerId: "player2" },
        { currentPoints: 20000, playerId: "player3" },
        { currentPoints: 15000, playerId: "player4" },
      ])

      mockPrisma.game.findUnique.mockResolvedValue({
        currentRound: 4,
        gameType: "hanchan",
        settings: {
          hasTobi: true,
        },
      })

      const result = await pointManager.checkGameEnd()

      expect(result.shouldEnd).toBe(false)
    })
  })

  describe("リーチ処理", () => {
    test("リーチ宣言が正しく処理される", async () => {
      mockPrisma.gameParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        playerId: "player1",
        currentPoints: 25000,
        isReach: false,
      })

      mockPrisma.game.findUnique.mockResolvedValue({
        currentRound: 3,
        kyotaku: 0,
      })

      await pointManager.declareReach("player1")

      expect(mockPrisma.gameParticipant.update).toHaveBeenCalledWith({
        where: {
          id: "participant-1",
        },
        data: {
          currentPoints: 24000, // 1000 point deduction
          isReach: true,
        },
      })

      expect(mockPrisma.game.update).toHaveBeenCalledWith({
        where: { id: "test-game-id" },
        data: { kyotaku: { increment: 1 } },
      })
    })

    test("点数不足時のリーチエラー", async () => {
      mockPrisma.gameParticipant.findFirst.mockResolvedValue({
        playerId: "player1",
        currentPoints: 500, // Not enough points
        isReach: false,
      })

      await expect(pointManager.declareReach("player1")).rejects.toThrow(
        "リーチするには1000点以上必要です"
      )
    })
  })

  describe("ゲーム情報取得", () => {
    test("ゲーム情報が正しく取得される", async () => {
      const mockGameData = {
        id: "test-game-id",
        roomCode: "ABCD",
        status: "PLAYING",
        currentRound: 5,
        currentOya: 2,
        honba: 1,
        kyotaku: 2,
      }

      mockPrisma.game.findUnique.mockResolvedValue(mockGameData)

      const result = await pointManager.getGameInfo()

      expect(result).toEqual(mockGameData)
      expect(mockPrisma.game.findUnique).toHaveBeenCalledWith({
        where: { id: "test-game-id" },
        select: {
          id: true,
          roomCode: true,
          status: true,
          currentRound: true,
          currentOya: true,
          honba: true,
          kyotaku: true,
          sessionId: true,
        },
      })
    })
  })

  describe("セッション統計更新", () => {
    beforeEach(() => {
      // Mock additional Prisma methods for session statistics
      mockPrisma.gameResult = {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      }
      mockPrisma.sessionParticipant = {
        findMany: jest.fn(),
        upsert: jest.fn(),
      }
      mockPrisma.game.count = jest.fn()
    })

    test("既にゲーム結果がない場合は統計更新をスキップする", async () => {
      mockPrisma.gameResult.findUnique.mockResolvedValue(null)

      await pointManager.updateSessionStatistics()

      expect(mockPrisma.gameResult.findUnique).toHaveBeenCalledWith({
        where: { gameId: "test-game-id" },
      })
      expect(mockPrisma.game.findUnique).not.toHaveBeenCalled()
    })

    test("セッションIDがない場合は統計更新をスキップする", async () => {
      mockPrisma.gameResult.findUnique.mockResolvedValue({
        id: "result-id",
        gameId: "test-game-id",
        results: [],
      })
      mockPrisma.game.findUnique.mockResolvedValue({
        id: "test-game-id",
        sessionId: null,
        participants: [],
        session: null,
      })

      await pointManager.updateSessionStatistics()

      expect(mockPrisma.sessionParticipant.findMany).not.toHaveBeenCalled()
    })

    test("統計が既に最新の場合は更新をスキップする", async () => {
      const mockGameResult = {
        id: "result-id",
        gameId: "test-game-id",
        results: [],
      }
      const mockGame = {
        id: "test-game-id",
        sessionId: "session-id",
        participants: [
          { playerId: "player1", finalRank: 1, settlement: 20 },
          { playerId: "player2", finalRank: 2, settlement: -20 },
        ],
      }
      const mockSessionParticipants = [
        { playerId: "player1", totalGames: 1 },
        { playerId: "player2", totalGames: 1 },
      ]

      mockPrisma.gameResult.findUnique.mockResolvedValue(mockGameResult)
      mockPrisma.game.findUnique.mockResolvedValue(mockGame)
      mockPrisma.game.count.mockResolvedValue(1) // 完了したゲーム数は1
      mockPrisma.sessionParticipant.findMany.mockResolvedValue(
        mockSessionParticipants
      )

      await pointManager.updateSessionStatistics()

      expect(mockPrisma.sessionParticipant.upsert).not.toHaveBeenCalled()
    })

    test("統計が古い場合は更新を実行する", async () => {
      const mockGameResult = {
        id: "result-id",
        gameId: "test-game-id",
        results: [],
      }
      const mockGame = {
        id: "test-game-id",
        sessionId: "session-id",
        participants: [
          { playerId: "player1", finalRank: 1, settlement: 20, position: 0 },
          { playerId: "player2", finalRank: 2, settlement: -20, position: 1 },
        ],
      }
      const mockSessionParticipants = [
        { playerId: "player1", totalGames: 0 }, // まだ統計が更新されていない
        { playerId: "player2", totalGames: 0 },
      ]

      mockPrisma.gameResult.findUnique.mockResolvedValue(mockGameResult)
      mockPrisma.game.findUnique.mockResolvedValue(mockGame)
      mockPrisma.game.count.mockResolvedValue(1) // 完了したゲーム数は1
      mockPrisma.sessionParticipant.findMany.mockResolvedValue(
        mockSessionParticipants
      )
      mockPrisma.sessionParticipant.upsert.mockResolvedValue({})

      await pointManager.updateSessionStatistics()

      expect(mockPrisma.sessionParticipant.upsert).toHaveBeenCalledTimes(2)
      expect(mockPrisma.sessionParticipant.upsert).toHaveBeenCalledWith({
        where: {
          sessionId_playerId: {
            sessionId: "session-id",
            playerId: "player1",
          },
        },
        create: {
          sessionId: "session-id",
          playerId: "player1",
          position: 0,
          totalGames: 1,
          totalSettlement: 20,
          firstPlace: 1,
          secondPlace: 0,
          thirdPlace: 0,
          fourthPlace: 0,
        },
        update: {
          totalGames: { increment: 1 },
          totalSettlement: { increment: 20 },
          firstPlace: { increment: 1 },
          secondPlace: undefined,
          thirdPlace: undefined,
          fourthPlace: undefined,
        },
      })
    })

    test("参加者ごとに個別に統計更新をチェックする", async () => {
      const mockGameResult = {
        id: "result-id",
        gameId: "test-game-id",
        results: [],
      }
      const mockGame = {
        id: "test-game-id",
        sessionId: "session-id",
        participants: [
          { playerId: "player1", finalRank: 1, settlement: 20, position: 0 },
          { playerId: "player2", finalRank: 2, settlement: -20, position: 1 },
        ],
      }
      const mockSessionParticipants = [
        { playerId: "player1", totalGames: 1 }, // 既に更新済み
        { playerId: "player2", totalGames: 0 }, // まだ未更新
      ]

      mockPrisma.gameResult.findUnique.mockResolvedValue(mockGameResult)
      mockPrisma.game.findUnique.mockResolvedValue(mockGame)
      mockPrisma.game.count.mockResolvedValue(1)
      mockPrisma.sessionParticipant.findMany.mockResolvedValue(
        mockSessionParticipants
      )
      mockPrisma.sessionParticipant.upsert.mockResolvedValue({})

      await pointManager.updateSessionStatistics()

      // player2のみ更新される
      expect(mockPrisma.sessionParticipant.upsert).toHaveBeenCalledTimes(1)
      expect(mockPrisma.sessionParticipant.upsert).toHaveBeenCalledWith({
        where: {
          sessionId_playerId: {
            sessionId: "session-id",
            playerId: "player2",
          },
        },
        create: expect.any(Object),
        update: expect.any(Object),
      })
    })
  })
})
