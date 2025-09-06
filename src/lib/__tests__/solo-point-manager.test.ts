// Prepare Prisma mock before importing modules
jest.mock("@/lib/prisma", () => {
  const prisma = {
    soloGame: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    soloPlayer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    soloGameResult: {
      createMany: jest.fn(),
      upsert: jest.fn(),
    },
    soloGameEvent: {
      create: jest.fn(),
    },
  }
  prisma.$transaction = jest.fn(async (callback) => await callback(prisma))
  return { __esModule: true, prisma, default: prisma }
})

import { SoloPointManager } from "../solo/solo-point-manager"

// Mock score calculation module
jest.mock("../score", () => ({
  calculateScore: jest.fn(),
}))

describe("SoloPointManager", () => {
  let pointManager: SoloPointManager
  const mockPrisma = jest.requireMock("@/lib/prisma").prisma
  const gameId = "test-solo-game-id"

  beforeEach(() => {
    pointManager = new SoloPointManager(gameId)
    jest.clearAllMocks()
  })

  // Test data factory functions
  const createMockPlayer = (overrides = {}) => ({
    id: "1",
    name: "プレイヤー1",
    position: 0,
    currentPoints: 25000,
    isReach: false,
    finalRank: null,
    settlement: null,
    ...overrides,
  })

  const createMockGame = (overrides = {}) => ({
    id: gameId,
    currentRound: 1,
    currentOya: 0,
    honba: 0,
    kyotaku: 0,
    status: "PLAYING",
    gameType: "HANCHAN",
    initialPoints: 25000,
    basePoints: 30000,
    uma: [15000, 5000, -5000, -15000],
    players: [
      createMockPlayer({ position: 0 }),
      createMockPlayer({ position: 1, name: "プレイヤー2" }),
      createMockPlayer({ position: 2, name: "プレイヤー3" }),
      createMockPlayer({ position: 3, name: "プレイヤー4" }),
    ],
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

  describe("calculateSettlement", () => {
    it("should calculate settlement correctly with custom uma and base points", () => {
      const players = [
        { id: "1", name: "Player 1", currentPoints: 45000, position: 0 },
        { id: "2", name: "Player 2", currentPoints: 25000, position: 1 },
        { id: "3", name: "Player 3", currentPoints: 20000, position: 2 },
        { id: "4", name: "Player 4", currentPoints: 10000, position: 3 },
      ]
      const settings = {
        initialPoints: 25000,
        basePoints: 30000,
        uma: [30, 10, -10, -30], // ワンスリー
      }

      // Private method access for testing
      const results = pointManager["calculateSettlement"](players, settings)

      // 1位
      expect(results[0].settlement).toBe(65) // 15 (oka) + 30 (uma) + 20 (oka)

      // 2位
      expect(results[1].settlement).toBe(5) // -5 + 10

      // 3位
      expect(results[2].settlement).toBe(-20) // -10 + -10

      // 4位
      expect(results[3].settlement).toBe(-50) // -20 + -30
    })

    it("should handle ties in rank correctly", () => {
      const players = [
        { id: "1", name: "Player 1", currentPoints: 35000, position: 0 },
        { id: "2", name: "Player 2", currentPoints: 35000, position: 1 },
        { id: "3", name: "Player 3", currentPoints: 15000, position: 2 },
        { id: "4", name: "Player 4", currentPoints: 15000, position: 3 },
      ]
      const settings = {
        initialPoints: 25000,
        basePoints: 30000,
        uma: [20, 10, -10, -20], // ワンツー
      }

      const results = pointManager["calculateSettlement"](players, settings)

      // 1位
      expect(results[0].position).toBe(0)
      expect(results[0].settlement).toBe(45) // 25 + 20
      // 2位
      expect(results[1].position).toBe(1)
      expect(results[1].settlement).toBe(15) // 5 + 10
      // 3位
      expect(results[2].position).toBe(2)
      expect(results[2].settlement).toBe(-25) // -15 + -10
      // 4位
      expect(results[3].position).toBe(3)
      expect(results[3].settlement).toBe(-35) // -15 + -20
    })
  })

  describe("calculateFinalResults", () => {
    it("should fetch game settings and call calculateSettlement", async () => {
      const mockGame = {
        id: gameId,
        initialPoints: 25000,
        basePoints: 30000,
        uma: [10, 5, -5, -10], // ゴットー
      }
      const mockPlayers = [
        { id: "1", name: "Player 1", currentPoints: 40000, position: 0 },
        { id: "2", name: "Player 2", currentPoints: 30000, position: 1 },
        { id: "3", name: "Player 3", currentPoints: 20000, position: 2 },
        { id: "4", name: "Player 4", currentPoints: 10000, position: 3 },
      ]

      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame)
      mockPrisma.soloPlayer.findMany.mockResolvedValue(mockPlayers)

      const calculateSettlementSpy = jest.spyOn(
        pointManager as any,
        "calculateSettlement"
      )

      await pointManager.calculateFinalResults()

      expect(mockPrisma.soloGame.findUnique).toHaveBeenCalledWith({
        where: { id: gameId },
      })
      expect(mockPrisma.soloPlayer.findMany).toHaveBeenCalledWith({
        where: { soloGameId: gameId },
        orderBy: { position: "asc" },
      })
      expect(calculateSettlementSpy).toHaveBeenCalledWith(mockPlayers, {
        initialPoints: mockGame.initialPoints,
        basePoints: mockGame.basePoints,
        uma: mockGame.uma,
      })
      expect(mockPrisma.soloGameResult.upsert).toHaveBeenCalled()
    })
  })

  describe("点数分配処理", () => {
    describe("distributeWinPoints", () => {
      test("ツモ和了時の点数分配（子ツモ: 親と子の支払い差分）", async () => {
        const players = [
          createMockPlayer({ position: 0, currentPoints: 25000 }), // 親（支払い大）
          createMockPlayer({ position: 1, currentPoints: 24000 }), // 勝者（子）
          createMockPlayer({ position: 2, currentPoints: 23000 }), // 子
          createMockPlayer({ position: 3, currentPoints: 22000 }), // 子
        ]
        const scoreResult = createMockScoreResult({
          totalScore: 8000,
          payments: { fromOya: 4000, fromKo: 2000 },
        })

        mockPrisma.soloPlayer.findMany.mockResolvedValue(players)
        mockPrisma.soloGame.findUnique
          .mockResolvedValueOnce(createMockGame({ currentOya: 0 })) // distribute前の取得
          .mockResolvedValueOnce(createMockGame({ currentOya: 0 })) // handleTsumoDistribution内の取得

        // updatePointsが内部で使用する findFirst の振る舞い
        mockPrisma.soloPlayer.findFirst.mockImplementation(({ where }) =>
          Promise.resolve(
            players.find((p) => p.position === where.position) || null
          )
        )
        mockPrisma.soloPlayer.update.mockResolvedValue({})
        mockPrisma.soloPlayer.updateMany.mockResolvedValue({})

        jest
          .spyOn(pointManager as any, "rotateDealer")
          .mockResolvedValue({ gameEnded: false })

        const result = await pointManager.distributeWinPoints(
          1, // winner (child)
          scoreResult,
          true // tsumo
        )

        expect(result.gameEnded).toBe(false)
        // 親は4000支払い、他の子は2000支払い、勝者は+8000
        expect(mockPrisma.soloPlayer.update).toHaveBeenCalled()
      })
      test("ツモ和了時の点数分配（親ツモ）", async () => {
        const players = [
          createMockPlayer({ position: 0, currentPoints: 25000 }), // 親
          createMockPlayer({ position: 1, currentPoints: 24000 }),
          createMockPlayer({ position: 2, currentPoints: 23000 }),
          createMockPlayer({ position: 3, currentPoints: 22000 }),
        ]
        const scoreResult = createMockScoreResult({
          totalScore: 12000,
          payments: { fromKo: 4000 },
        })

        mockPrisma.soloPlayer.findMany.mockResolvedValue(players)
        mockPrisma.soloGame.findUnique.mockResolvedValue(
          createMockGame({ currentOya: 0 })
        )
        mockPrisma.soloPlayer.findFirst.mockImplementation(({ where }) =>
          Promise.resolve(players.find((p) => p.position === where.position))
        )
        mockPrisma.soloPlayer.update.mockResolvedValue({})
        mockPrisma.soloPlayer.updateMany.mockResolvedValue({})

        // Mock rotateDealer method
        jest
          .spyOn(pointManager as any, "rotateDealer")
          .mockResolvedValue({ gameEnded: false })

        const result = await pointManager.distributeWinPoints(
          0, // winnerPosition
          scoreResult,
          true // isTsumo
        )

        expect(result.gameEnded).toBe(false)
        expect(mockPrisma.soloPlayer.updateMany).toHaveBeenCalledWith({
          where: { soloGameId: gameId, isReach: true },
          data: { isReach: false, reachRound: null },
        })
      })

      test("ロン和了時の点数分配", async () => {
        const players = [
          createMockPlayer({ position: 0 }),
          createMockPlayer({ position: 1, currentPoints: 24000 }),
        ]
        const scoreResult = createMockScoreResult({
          totalScore: 7700,
          payments: { fromLoser: 7700 },
        })

        mockPrisma.soloPlayer.findMany.mockResolvedValue(players)
        mockPrisma.soloGame.findUnique.mockResolvedValue(createMockGame())
        mockPrisma.soloPlayer.findFirst.mockImplementation(({ where }) =>
          Promise.resolve(players.find((p) => p.position === where.position))
        )
        mockPrisma.soloPlayer.update.mockResolvedValue({})
        mockPrisma.soloPlayer.updateMany.mockResolvedValue({})

        jest
          .spyOn(pointManager as any, "rotateDealer")
          .mockResolvedValue({ gameEnded: false })

        const result = await pointManager.distributeWinPoints(
          0, // winnerPosition
          scoreResult,
          false, // isRon
          1 // loserPosition
        )

        expect(result.gameEnded).toBe(false)
        expect(mockPrisma.soloPlayer.findFirst).toHaveBeenCalledTimes(4)
        expect(mockPrisma.soloPlayer.update).toHaveBeenCalledTimes(2)
      })

      test("存在しないプレイヤーでエラー", async () => {
        mockPrisma.soloPlayer.findMany.mockResolvedValue([])

        await expect(
          pointManager.distributeWinPoints(0, createMockScoreResult(), true)
        ).rejects.toThrow("Winner not found")
      })

      test("供託がある場合の処理", async () => {
        const players = [createMockPlayer()]
        const scoreResult = createMockScoreResult({
          totalScore: 8700, // 7700 + 1000 (供託)
          kyotakuPayment: 1000,
        })

        mockPrisma.soloPlayer.findMany.mockResolvedValue(players)
        mockPrisma.soloGame.findUnique.mockResolvedValue(
          createMockGame({ kyotaku: 1 })
        )
        mockPrisma.soloPlayer.update.mockResolvedValue({})
        mockPrisma.soloPlayer.updateMany.mockResolvedValue({})

        jest
          .spyOn(pointManager as any, "rotateDealer")
          .mockResolvedValue({ gameEnded: false })

        await pointManager.distributeWinPoints(0, scoreResult, false, 1)

        expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
          where: { id: gameId },
          data: { kyotaku: 0 },
        })
      })

      test("updatePoints 内のプレイヤー未検出で例外（子ツモの減算時）", async () => {
        const players = [
          createMockPlayer({ position: 0, currentPoints: 25000 }), // 親
          createMockPlayer({ position: 1, currentPoints: 24000 }), // 勝者
          createMockPlayer({ position: 2, currentPoints: 23000 }),
          createMockPlayer({ position: 3, currentPoints: 22000 }),
        ]
        const scoreResult = createMockScoreResult({
          totalScore: 8000,
          payments: { fromOya: 4000, fromKo: 2000 },
        })

        mockPrisma.soloPlayer.findMany.mockResolvedValue(players)
        mockPrisma.soloGame.findUnique
          .mockResolvedValueOnce(createMockGame({ currentOya: 0 }))
          .mockResolvedValueOnce(createMockGame({ currentOya: 0 }))

        // 最初に勝者分のupdatePoints用の findFirst は存在、次に親(0)の減算で見つからないようにする
        let callCount = 0
        mockPrisma.soloPlayer.findFirst.mockImplementation(() => {
          callCount += 1
          if (callCount === 1) {
            return Promise.resolve(
              players.find((p) => p.position === 1) || null
            )
          }
          // 敗者側の検索では null を返して例外を誘発
          return Promise.resolve(null)
        })

        await expect(
          pointManager.distributeWinPoints(1, scoreResult, true)
        ).rejects.toThrow("Player not found")
      })
    })
  })

  describe("リーチ処理", () => {
    describe("declareReach", () => {
      test("リーチ宣言が正しく処理される", async () => {
        const player = createMockPlayer({
          id: "player-1",
          position: 0,
          currentPoints: 25000,
          isReach: false,
        })

        mockPrisma.soloPlayer.findFirst.mockResolvedValue(player)
        mockPrisma.soloGameEvent.create.mockResolvedValue({})

        await pointManager.declareReach(0)

        expect(mockPrisma.soloPlayer.update).toHaveBeenCalledWith({
          where: { id: "player-1" },
          data: {
            isReach: true,
            currentPoints: 24000, // 1000点減額
          },
        })

        expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
          where: { id: gameId },
          data: { kyotaku: { increment: 1 } },
        })
      })

      test("点数不足時のリーチエラー", async () => {
        const player = createMockPlayer({
          currentPoints: 500, // 不足
          isReach: false,
        })

        mockPrisma.soloPlayer.findFirst.mockResolvedValue(player)

        await expect(pointManager.declareReach(0)).rejects.toThrow(
          "リーチするには1000点以上必要です"
        )
      })

      test("既にリーチ済みの場合のエラー", async () => {
        const player = createMockPlayer({
          currentPoints: 25000,
          isReach: true, // 既にリーチ済み
        })

        mockPrisma.soloPlayer.findFirst.mockResolvedValue(player)

        await expect(pointManager.declareReach(0)).rejects.toThrow(
          "既にリーチ宣言済みです"
        )
      })

      test("プレイヤーが見つからない場合", async () => {
        mockPrisma.soloPlayer.findFirst.mockResolvedValue(null)

        await expect(pointManager.declareReach(0)).rejects.toThrow(
          "Player not found"
        )
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
        })

        mockPrisma.soloGame.findUnique.mockResolvedValue(game)
        mockPrisma.soloGameEvent.create.mockResolvedValue({})

        jest
          .spyOn(pointManager as any, "checkGameEnd")
          .mockResolvedValue({ shouldEnd: false })

        const result = await pointManager.handleRyukyoku(
          "手牌荒れ",
          [0] // 親のみテンパイ
        )

        expect(result.gameEnded).toBe(false)
        expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
          where: { id: gameId },
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
        })

        mockPrisma.soloGame.findUnique.mockResolvedValue(game)
        mockPrisma.soloGameEvent.create.mockResolvedValue({})

        jest
          .spyOn(pointManager as any, "checkGameEnd")
          .mockResolvedValue({ shouldEnd: false })

        const result = await pointManager.handleRyukyoku(
          "手牌荒れ",
          [1, 2] // 親以外がテンパイ
        )

        expect(result.gameEnded).toBe(false)
        expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
          where: { id: gameId },
          data: {
            honba: 2,
            currentOya: 1, // 親交代
            currentRound: 6, // ラウンド進行
            updatedAt: expect.any(Date),
          },
        })
      })

      test("テンパイ料の計算（2名テンパイ）", async () => {
        const game = createMockGame()

        mockPrisma.soloGame.findUnique.mockResolvedValue(game)
        mockPrisma.soloGameEvent.create.mockResolvedValue({})

        jest
          .spyOn(pointManager as any, "checkGameEnd")
          .mockResolvedValue({ shouldEnd: false })

        await pointManager.handleRyukyoku(
          "手牌荒れ",
          [0, 1] // 2名テンパイ
        )

        // テンパイ者は1500点ずつ受け取り、ノーテン者は1500点ずつ支払い
        expect(mockPrisma.soloPlayer.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { currentPoints: expect.any(Number) },
          })
        )
      })

      test("流局でゲーム終了", async () => {
        const game = createMockGame()

        mockPrisma.soloGame.findUnique.mockResolvedValue(game)
        mockPrisma.soloGameEvent.create.mockResolvedValue({})

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

  describe("親ローテーション処理", () => {
    describe("rotateDealer", () => {
      test("親和了時の連荘", async () => {
        const game = createMockGame({
          currentOya: 0,
          honba: 1,
          currentRound: 5,
        })

        mockPrisma.soloGame.findUnique.mockResolvedValue(game)

        jest
          .spyOn(pointManager as any, "checkGameEnd")
          .mockResolvedValue({ shouldEnd: false })

        const result = await pointManager.rotateDealer(0) // 親が和了

        expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
          where: { id: gameId },
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

        mockPrisma.soloGame.findUnique.mockResolvedValue(game)

        jest
          .spyOn(pointManager as any, "checkGameEnd")
          .mockResolvedValue({ shouldEnd: false })

        const result = await pointManager.rotateDealer(1) // 子が和了

        expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
          where: { id: gameId },
          data: {
            currentOya: 1, // 親交代
            honba: 0, // 本場リセット
            currentRound: 6, // 局進行
          },
        })
        expect(result.gameEnded).toBe(false)
      })

      test("流局（winnerPosition未指定）時の親交代とゲーム終了処理", async () => {
        const game = createMockGame({
          currentOya: 2,
          honba: 1,
          currentRound: 7,
        })
        mockPrisma.soloGame.findUnique.mockResolvedValue(game)

        const finishSpy = jest
          .spyOn(pointManager as any, "finishGame")
          .mockResolvedValue()
        jest
          .spyOn(pointManager as any, "checkGameEnd")
          .mockResolvedValue({ shouldEnd: true, reason: "規定局数終了" })

        const result = await pointManager.rotateDealer()

        expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
          where: { id: gameId },
          data: { currentOya: 3, honba: 0, currentRound: 8 },
        })
        expect(finishSpy).toHaveBeenCalledWith("規定局数終了")
        expect(result).toEqual({ gameEnded: true, reason: "規定局数終了" })
      })
    })
  })

  describe("ゲーム終了判定", () => {
    describe("checkGameEnd", () => {
      test("トビ終了の判定", async () => {
        const players = [
          createMockPlayer({ position: 0, currentPoints: 35000 }),
          createMockPlayer({ position: 1, currentPoints: 25000 }),
          createMockPlayer({ position: 2, currentPoints: 20000 }),
          createMockPlayer({
            position: 3,
            currentPoints: -5000,
            name: "マイナスプレイヤー",
          }),
        ]
        const game = createMockGame()

        mockPrisma.soloPlayer.findMany.mockResolvedValue(players)
        mockPrisma.soloGame.findUnique.mockResolvedValue(game)

        const result = await pointManager.checkGameEnd()

        expect(result.shouldEnd).toBe(true)
        expect(result.reason).toContain("トビ終了")
        expect(result.reason).toContain("マイナスプレイヤー")
      })

      test("東風戦の終了判定", async () => {
        const players = [createMockPlayer()]
        const game = createMockGame({
          currentRound: 5, // 東4局終了後
          gameType: "TONPUU",
        })

        mockPrisma.soloPlayer.findMany.mockResolvedValue(players)
        mockPrisma.soloGame.findUnique.mockResolvedValue(game)

        jest.spyOn(pointManager as any, "checkRoundEnd").mockReturnValue({
          shouldEnd: true,
          reason: "東風戦終了: 東4局完了",
        })

        const result = await pointManager.checkGameEnd()

        expect(result.shouldEnd).toBe(true)
        expect(result.reason).toContain("東風戦終了")
      })

      test("ゲーム続行", async () => {
        const players = [
          createMockPlayer({ currentPoints: 35000 }),
          createMockPlayer({ currentPoints: 25000 }),
          createMockPlayer({ currentPoints: 20000 }),
          createMockPlayer({ currentPoints: 15000 }),
        ]
        const game = createMockGame({ currentRound: 4 })

        mockPrisma.soloPlayer.findMany.mockResolvedValue(players)
        mockPrisma.soloGame.findUnique.mockResolvedValue(game)

        const result = await pointManager.checkGameEnd()

        expect(result.shouldEnd).toBe(false)
      })

      test("半荘戦の終了判定", async () => {
        const players = [createMockPlayer()]
        const game = createMockGame({ currentRound: 9, gameType: "HANCHAN" })
        mockPrisma.soloPlayer.findMany.mockResolvedValue(players)
        mockPrisma.soloGame.findUnique.mockResolvedValue(game)

        const result = await pointManager.checkGameEnd()
        expect(result.shouldEnd).toBe(true)
        expect(result.reason).toContain("半荘戦終了")
      })

      test("不明なゲームタイプは継続", async () => {
        const players = [createMockPlayer()]
        const game = createMockGame({
          currentRound: 1,
          gameType: "CUSTOM" as any,
        })
        mockPrisma.soloPlayer.findMany.mockResolvedValue(players)
        mockPrisma.soloGame.findUnique.mockResolvedValue(game)

        const result = await pointManager.checkGameEnd()
        expect(result.shouldEnd).toBe(false)
      })
    })
  })

  describe("強制終了処理", () => {
    test("forceEndGame", async () => {
      mockPrisma.soloGameEvent.create.mockResolvedValue({})

      jest
        .spyOn(pointManager as any, "calculateFinalResults")
        .mockResolvedValue()

      await pointManager.forceEndGame("テスト強制終了")

      expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
        where: { id: gameId },
        data: {
          status: "FINISHED",
          endedAt: expect.any(Date),
        },
      })

      expect(mockPrisma.soloGameEvent.create).toHaveBeenCalledWith({
        data: {
          soloGameId: gameId,
          eventType: "GAME_END",
          eventData: {
            reason: "テスト強制終了",
            forcedEnd: true,
          },
          round: 0,
          honba: 0,
        },
      })
    })

    test("finishGame が最終結果とイベントを記録する", async () => {
      jest
        .spyOn(pointManager as any, "calculateFinalResults")
        .mockResolvedValue()

      await pointManager["finishGame"]("手動終了")

      expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
        where: { id: gameId },
        data: { status: "FINISHED", endedAt: expect.any(Date) },
      })
      expect(mockPrisma.soloGameEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          soloGameId: gameId,
          eventType: "GAME_END",
          eventData: expect.objectContaining({
            reason: "手動終了",
            finalResults: true,
          }),
        }),
      })
    })
  })

  describe("ゲーム情報取得", () => {
    test("getGameInfo", async () => {
      const gameInfo = {
        id: gameId,
        gameType: "HANCHAN",
        status: "PLAYING",
        currentRound: 5,
        currentOya: 2,
        honba: 1,
        kyotaku: 2,
        initialPoints: 25000,
      }

      mockPrisma.soloGame.findUnique.mockResolvedValue(gameInfo)

      const result = await pointManager.getGameInfo()

      expect(result).toEqual(gameInfo)
      expect(mockPrisma.soloGame.findUnique).toHaveBeenCalledWith({
        where: { id: gameId },
        select: {
          id: true,
          gameType: true,
          status: true,
          currentRound: true,
          currentOya: true,
          honba: true,
          kyotaku: true,
          initialPoints: true,
        },
      })
    })

    test("getGameState", async () => {
      const game = createMockGame()

      mockPrisma.soloGame.findUnique.mockResolvedValue(game)

      const result = await pointManager.getGameState()

      expect(result.gameId).toBe(gameId)
      expect(result.players).toHaveLength(4)
      expect(result.players[0].id).toBe("0") // position as string ID
      expect(result.currentRound).toBe(1)
      expect(result.status).toBe("PLAYING")
    })

    test("getGameState - ゲームが見つからない場合", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)

      await expect(pointManager.getGameState()).rejects.toThrow(
        "Solo Game not found"
      )
    })
  })

  describe("境界値テスト", () => {
    test("最大点数での精算", () => {
      const players = [
        createMockPlayer({ currentPoints: 100000, position: 0 }),
        createMockPlayer({ currentPoints: 0, position: 1 }),
        createMockPlayer({ currentPoints: 0, position: 2 }),
        createMockPlayer({ currentPoints: 0, position: 3 }),
      ]
      const settings = {
        initialPoints: 25000,
        basePoints: 30000,
        uma: [15000, 5000, -5000, -15000],
      }

      const result = pointManager["calculateSettlement"](players, settings)

      expect(result[0].settlement).toBeDefined()
      expect(result[0].rank).toBe(1)
      // ゼロサムの確認
      const total = result.reduce((sum, r) => sum + r.settlement, 0)
      expect(total).toBe(0)
    })

    test("最小点数（マイナス）での精算", () => {
      const players = [
        createMockPlayer({ currentPoints: 50000, position: 0 }),
        createMockPlayer({ currentPoints: 25000, position: 1 }),
        createMockPlayer({ currentPoints: 25000, position: 2 }),
        createMockPlayer({ currentPoints: -10000, position: 3 }),
      ]
      const settings = {
        initialPoints: 25000,
        basePoints: 30000,
        uma: [15000, 5000, -5000, -15000],
      }

      const result = pointManager["calculateSettlement"](players, settings)

      expect(result[3].finalPoints).toBe(-10000)
      expect(result[3].rank).toBe(4)
    })
  })

  describe("エラーハンドリング", () => {
    test("ゲームが見つからない場合（流局処理）", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)

      await expect(pointManager.handleRyukyoku("test", [])).rejects.toThrow(
        "Game not found"
      )
    })

    test("親プレイヤーが見つからない場合（流局処理）", async () => {
      const game = createMockGame({
        players: [], // 空の配列
        currentOya: 0,
      })

      mockPrisma.soloGame.findUnique.mockResolvedValue(game)

      await expect(pointManager.handleRyukyoku("test", [])).rejects.toThrow(
        "親プレイヤーが見つかりません"
      )
    })

    test("ゲームが見つからない場合（親ローテーション）", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)

      await expect(pointManager.rotateDealer(0)).rejects.toThrow(
        "Game not found"
      )
    })

    test("calculateFinalResults: ゲーム未検出で早期return", async () => {
      const saveSpy = jest.spyOn(pointManager as any, "saveFinalResults")
      mockPrisma.soloGame.findUnique.mockResolvedValue(null)
      jest.spyOn(pointManager as any, "getPlayers").mockResolvedValue([])

      await pointManager.calculateFinalResults()
      expect(saveSpy).not.toHaveBeenCalled()
    })

    test("calculateFinalResults: uma JSON文字列のパース", async () => {
      const players = [
        createMockPlayer({ position: 0, currentPoints: 25000 }),
        createMockPlayer({ position: 1, currentPoints: 25000 }),
        createMockPlayer({ position: 2, currentPoints: 25000 }),
        createMockPlayer({ position: 3, currentPoints: 25000 }),
      ]
      jest.spyOn(pointManager as any, "getPlayers").mockResolvedValue(players)
      const calcSpy = jest
        .spyOn(pointManager as any, "calculateSettlement")
        .mockReturnValue([])
      mockPrisma.soloGame.findUnique.mockResolvedValue(
        createMockGame({ uma: "[15000,5000,-5000,-15000]" as any })
      )

      await pointManager.calculateFinalResults()
      expect(calcSpy).toHaveBeenCalled()
    })

    test("calculateFinalResults: uma がオブジェクト(JSON型)の場合", async () => {
      const players = [
        createMockPlayer({ position: 0, currentPoints: 25000 }),
        createMockPlayer({ position: 1, currentPoints: 25000 }),
        createMockPlayer({ position: 2, currentPoints: 25000 }),
        createMockPlayer({ position: 3, currentPoints: 25000 }),
      ]
      jest.spyOn(pointManager as any, "getPlayers").mockResolvedValue(players)
      const calcSpy = jest
        .spyOn(pointManager as any, "calculateSettlement")
        .mockReturnValue([])
      // Prisma JSON型相当として配列ではないオブジェクトを設定
      mockPrisma.soloGame.findUnique.mockResolvedValue(
        createMockGame({ uma: { a: 1 } as any })
      )

      await pointManager.calculateFinalResults()
      expect(calcSpy).toHaveBeenCalled()
    })

    test("calculateFinalResults: uma のJSONパース失敗時はデフォルトで継続", async () => {
      const players = [
        createMockPlayer({ position: 0, currentPoints: 25000 }),
        createMockPlayer({ position: 1, currentPoints: 25000 }),
        createMockPlayer({ position: 2, currentPoints: 25000 }),
        createMockPlayer({ position: 3, currentPoints: 25000 }),
      ]
      jest.spyOn(pointManager as any, "getPlayers").mockResolvedValue(players)
      const calcSpy = jest
        .spyOn(pointManager as any, "calculateSettlement")
        .mockReturnValue([])
      mockPrisma.soloGame.findUnique.mockResolvedValue(
        createMockGame({ uma: "not-a-json" as any })
      )

      await pointManager.calculateFinalResults()
      expect(calcSpy).toHaveBeenCalled()
    })

    test("checkRoundEnd: 東風戦の終了判定分岐を通る", async () => {
      const players = [createMockPlayer()]
      const game = createMockGame({ currentRound: 5, gameType: "TONPUU" })
      mockPrisma.soloPlayer.findMany.mockResolvedValue(players)
      mockPrisma.soloGame.findUnique.mockResolvedValue(game)

      const result = await pointManager.checkGameEnd()
      expect(result.shouldEnd).toBe(true)
      expect(result.reason).toContain("東風戦終了")
    })
  })
})
