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

  // Test data factory functions
  const createMockParticipant = (overrides = {}) => ({
    id: "participant-1",
    playerId: "player1",
    position: 0,
    currentPoints: 25000,
    isReach: false,
    finalRank: null,
    settlement: null,
    player: { name: "テストプレイヤー" },
    ...overrides,
  })

  const createMockGame = (overrides = {}) => ({
    id: "test-game-id",
    currentRound: 1,
    currentOya: 0,
    honba: 0,
    kyotaku: 0,
    status: "PLAYING",
    settings: {
      initialPoints: 25000,
      basePoints: 30000,
      uma: [20, 10, -10, -20],
      hasTobi: true,
      gameType: "HANCHAN",
    },
    ...overrides,
  })

  const createMockScoreResult = (overrides = {}) => ({
    baseScore: 7700,
    totalScore: 7700,
    payments: {
      fromOya: 4000,
      fromKo: 2000,
      fromLoser: 7700,
    },
    honbaPayment: 0,
    kyotakuPayment: 0,
    ...overrides,
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

  describe("点数分配処理", () => {
    describe("distributeWinPoints", () => {
      beforeEach(() => {
        // Mock additional Prisma methods for point distribution
        mockPrisma.gameParticipant.findFirst = jest.fn()
        mockPrisma.gameParticipant.updateMany = jest.fn()
      })

      test("ツモ和了時の点数分配（親ツモ）", async () => {
        const participants = [
          createMockParticipant({ playerId: "player1", position: 0 }), // 親
          createMockParticipant({
            playerId: "player2",
            position: 1,
            currentPoints: 24000,
          }),
          createMockParticipant({
            playerId: "player3",
            position: 2,
            currentPoints: 23000,
          }),
          createMockParticipant({
            playerId: "player4",
            position: 3,
            currentPoints: 22000,
          }),
        ]
        const scoreResult = createMockScoreResult({
          totalScore: 12000,
          payments: { fromKo: 4000 },
        })

        mockPrisma.gameParticipant.findMany.mockResolvedValue(participants)
        mockPrisma.game.findUnique.mockResolvedValue(
          createMockGame({ currentOya: 0 })
        )
        mockPrisma.gameParticipant.update.mockResolvedValue({})
        mockPrisma.gameParticipant.updateMany.mockResolvedValue({})

        // Mock rotateDealer method
        jest
          .spyOn(pointManager as any, "rotateDealer")
          .mockResolvedValue({ gameEnded: false })

        const result = await pointManager.distributeWinPoints(
          "player1",
          scoreResult,
          true // isTsumo
        )

        expect(result.gameEnded).toBe(false)
        expect(mockPrisma.gameParticipant.update).toHaveBeenCalledTimes(4) // 全員の点数更新
        expect(mockPrisma.gameParticipant.updateMany).toHaveBeenCalledWith({
          where: { gameId: "test-game-id", isReach: true },
          data: { isReach: false, reachRound: null },
        })
      })

      test("ロン和了時の点数分配", async () => {
        const participants = [
          createMockParticipant({ playerId: "player1", position: 0 }),
          createMockParticipant({
            playerId: "player2",
            position: 1,
            currentPoints: 24000,
          }),
        ]
        const scoreResult = createMockScoreResult({
          totalScore: 7700,
          payments: { fromLoser: 7700 },
        })

        mockPrisma.gameParticipant.findMany.mockResolvedValue(participants)
        mockPrisma.game.findUnique.mockResolvedValue(createMockGame())
        mockPrisma.gameParticipant.findFirst
          .mockResolvedValueOnce(participants[0]) // winner
          .mockResolvedValueOnce(participants[1]) // loser
        mockPrisma.gameParticipant.update.mockResolvedValue({})
        mockPrisma.gameParticipant.updateMany.mockResolvedValue({})

        jest
          .spyOn(pointManager as any, "rotateDealer")
          .mockResolvedValue({ gameEnded: false })

        const result = await pointManager.distributeWinPoints(
          "player1",
          scoreResult,
          false, // isRon
          "player2" // loserId
        )

        expect(result.gameEnded).toBe(false)
        expect(mockPrisma.gameParticipant.findFirst).toHaveBeenCalledTimes(2)
        expect(mockPrisma.gameParticipant.update).toHaveBeenCalledTimes(2)
      })

      test("存在しないプレイヤーでエラー", async () => {
        mockPrisma.gameParticipant.findMany.mockResolvedValue([])

        await expect(
          pointManager.distributeWinPoints(
            "nonexistent",
            createMockScoreResult(),
            true
          )
        ).rejects.toThrow("Winner not found")
      })

      test("供託がある場合の処理", async () => {
        const participants = [createMockParticipant()]
        const scoreResult = createMockScoreResult({
          totalScore: 8700, // 7700 + 1000 (供託)
          kyotakuPayment: 1000,
        })

        mockPrisma.gameParticipant.findMany.mockResolvedValue(participants)
        mockPrisma.game.findUnique.mockResolvedValue(
          createMockGame({ kyotaku: 1 })
        )
        mockPrisma.gameParticipant.update.mockResolvedValue({})
        mockPrisma.gameParticipant.updateMany.mockResolvedValue({})

        jest
          .spyOn(pointManager as any, "rotateDealer")
          .mockResolvedValue({ gameEnded: false })

        await pointManager.distributeWinPoints(
          "player1",
          scoreResult,
          false,
          "player2"
        )

        expect(mockPrisma.game.update).toHaveBeenCalledWith({
          where: { id: "test-game-id" },
          data: { kyotaku: 0 },
        })
      })
    })
  })

  describe("流局処理", () => {
    describe("handleRyukyoku", () => {
      test("親テンパイ流局（親続投）", async () => {
        const game = createMockGame({
          currentOya: 0,
          honba: 1,
          currentRound: 5,
          participants: [
            createMockParticipant({ position: 0, playerId: "player1" }),
            createMockParticipant({ position: 1, playerId: "player2" }),
            createMockParticipant({ position: 2, playerId: "player3" }),
            createMockParticipant({ position: 3, playerId: "player4" }),
          ],
        })

        mockPrisma.game.findUnique.mockResolvedValue(game)
        mockPrisma.soloGameEvent = { create: jest.fn() }
        mockPrisma.gameEvent = { create: jest.fn() }

        jest
          .spyOn(pointManager as any, "checkGameEnd")
          .mockResolvedValue({ shouldEnd: false })

        const result = await pointManager.handleRyukyoku(
          "手牌荒れ",
          ["player1"] // 親のみテンパイ
        )

        expect(result.gameEnded).toBe(false)
        expect(mockPrisma.game.update).toHaveBeenCalledWith({
          where: { id: "test-game-id" },
          data: {
            honba: 2, // インクリメント
            currentOya: 0, // 親続投
            currentRound: 5, // 変わらず
            updatedAt: expect.any(Date),
          },
        })
      })

      test("親ノーテン流局（親交代）", async () => {
        const game = createMockGame({
          currentOya: 0,
          honba: 1,
          currentRound: 5,
          participants: [
            createMockParticipant({ position: 0, playerId: "player1" }),
            createMockParticipant({ position: 1, playerId: "player2" }),
            createMockParticipant({ position: 2, playerId: "player3" }),
            createMockParticipant({ position: 3, playerId: "player4" }),
          ],
        })

        mockPrisma.game.findUnique.mockResolvedValue(game)
        mockPrisma.gameEvent = { create: jest.fn() }

        jest
          .spyOn(pointManager as any, "checkGameEnd")
          .mockResolvedValue({ shouldEnd: false })

        const result = await pointManager.handleRyukyoku(
          "手牌荒れ",
          ["player2", "player3"] // 親以外がテンパイ
        )

        expect(result.gameEnded).toBe(false)
        expect(mockPrisma.game.update).toHaveBeenCalledWith({
          where: { id: "test-game-id" },
          data: {
            honba: 2,
            currentOya: 1, // 親交代
            currentRound: 6, // ラウンド進行
            updatedAt: expect.any(Date),
          },
        })
      })

      test("テンパイ料の計算（2名テンパイ）", async () => {
        const game = createMockGame({
          participants: [
            createMockParticipant({
              position: 0,
              playerId: "player1",
              currentPoints: 25000,
            }),
            createMockParticipant({
              position: 1,
              playerId: "player2",
              currentPoints: 24000,
            }),
            createMockParticipant({
              position: 2,
              playerId: "player3",
              currentPoints: 23000,
            }),
            createMockParticipant({
              position: 3,
              playerId: "player4",
              currentPoints: 22000,
            }),
          ],
        })

        mockPrisma.game.findUnique.mockResolvedValue(game)
        mockPrisma.gameEvent = { create: jest.fn() }

        jest
          .spyOn(pointManager as any, "checkGameEnd")
          .mockResolvedValue({ shouldEnd: false })

        await pointManager.handleRyukyoku(
          "手牌荒れ",
          ["player1", "player2"] // 2名テンパイ
        )

        // テンパイ者は1500点ずつ受け取り、ノーテン者は1500点ずつ支払い
        expect(mockPrisma.gameParticipant.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { currentPoints: expect.any(Number) },
          })
        )
      })

      test("流局でゲーム終了", async () => {
        const game = createMockGame()

        mockPrisma.game.findUnique.mockResolvedValue(game)
        mockPrisma.gameEvent = { create: jest.fn() }

        jest.spyOn(pointManager as any, "checkGameEnd").mockResolvedValue({
          shouldEnd: true,
          reason: "規定局数終了",
        })
        jest.spyOn(pointManager as any, "finishGame").mockResolvedValue()

        const result = await pointManager.handleRyukyoku("手牌荒れ", [])

        expect(result.gameEnded).toBe(true)
        expect(result.reason).toBe("規定局数終了")
      })
    })
  })

  describe("エラーハンドリング", () => {
    test("ゲームが見つからない場合", async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null)

      await expect(pointManager.handleRyukyoku("test", [])).rejects.toThrow(
        "Game not found"
      )
    })

    test("既にリーチ済みの場合のエラー", async () => {
      mockPrisma.gameParticipant.findFirst.mockResolvedValue({
        id: "participant-1",
        currentPoints: 25000,
        isReach: true, // 既にリーチ済み
      })

      await expect(pointManager.declareReach("player1")).rejects.toThrow(
        "既にリーチ宣言済みです"
      )
    })

    test("プレイヤーが見つからない場合", async () => {
      mockPrisma.gameParticipant.findFirst.mockResolvedValue(null)

      await expect(pointManager.declareReach("player1")).rejects.toThrow(
        "Player not found"
      )
    })
  })

  describe("親ローテーション処理", () => {
    describe("rotateDealer", () => {
      test("親和了時の連荘", async () => {
        const game = createMockGame({
          currentOya: 0,
          honba: 1,
          currentRound: 5,
        })
        const winner = createMockParticipant({ position: 0 }) // 親が和了

        mockPrisma.game.findUnique.mockResolvedValue(game)
        mockPrisma.gameParticipant.findFirst.mockResolvedValue(winner)

        jest
          .spyOn(pointManager as any, "checkGameEnd")
          .mockResolvedValue({ shouldEnd: false })

        const result = await pointManager.rotateDealer("player1")

        expect(mockPrisma.game.update).toHaveBeenCalledWith({
          where: { id: "test-game-id" },
          data: {
            currentOya: 0, // 親続投
            honba: 2, // 本場増加
            currentRound: 5, // 局は進まない
          },
        })
        expect(result.gameEnded).toBe(false)
      })

      test("子和了時の親交代", async () => {
        const game = createMockGame({
          currentOya: 0,
          honba: 1,
          currentRound: 5,
        })
        const winner = createMockParticipant({ position: 1 }) // 子が和了

        mockPrisma.game.findUnique.mockResolvedValue(game)
        mockPrisma.gameParticipant.findFirst.mockResolvedValue(winner)

        jest
          .spyOn(pointManager as any, "checkGameEnd")
          .mockResolvedValue({ shouldEnd: false })

        const result = await pointManager.rotateDealer("player1")

        expect(mockPrisma.game.update).toHaveBeenCalledWith({
          where: { id: "test-game-id" },
          data: {
            currentOya: 1, // 親交代
            honba: 0, // 本場リセット
            currentRound: 6, // 局進行
          },
        })
        expect(result.gameEnded).toBe(false)
      })
    })
  })

  describe("境界値テスト", () => {
    test("最大点数での精算", () => {
      const participants = [
        createMockParticipant({ currentPoints: 100000, position: 0 }),
        createMockParticipant({ currentPoints: 0, position: 1 }),
        createMockParticipant({ currentPoints: 0, position: 2 }),
        createMockParticipant({ currentPoints: 0, position: 3 }),
      ]
      const settings = {
        uma: [20, 10, -10, -20],
        basePoints: 30000,
      }

      const result = pointManager["calculateSettlement"](participants, settings)

      expect(result[0].settlement).toBeDefined()
      expect(result[0].rank).toBe(1)
      // ゼロサムの確認
      const total = result.reduce((sum, r) => sum + r.settlement, 0)
      expect(total).toBe(0)
    })

    test("最小点数（マイナス）での精算", () => {
      const participants = [
        createMockParticipant({ currentPoints: 50000, position: 0 }),
        createMockParticipant({ currentPoints: 25000, position: 1 }),
        createMockParticipant({ currentPoints: 25000, position: 2 }),
        createMockParticipant({ currentPoints: -1000, position: 3 }),
      ]
      const settings = {
        uma: [20, 10, -10, -20],
        basePoints: 30000,
      }

      const result = pointManager["calculateSettlement"](participants, settings)

      expect(result[3].finalPoints).toBe(-1000)
      expect(result[3].rank).toBe(4)
    })

    test("ゲーム終了判定（東風戦）", () => {
      const game = createMockGame({ currentRound: 5, gameType: "TONPUU" })

      const result = pointManager["checkRoundEnd"](game, "TONPUU")

      expect(result.shouldEnd).toBe(true)
      expect(result.reason).toContain("東風戦終了")
    })

    test("ゲーム終了判定（半荘戦）", () => {
      const game = createMockGame({ currentRound: 9, gameType: "HANCHAN" })

      const result = pointManager["checkRoundEnd"](game, "HANCHAN")

      expect(result.shouldEnd).toBe(true)
      expect(result.reason).toContain("半荘戦終了")
    })
  })
})
