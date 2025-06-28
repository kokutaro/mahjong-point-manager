import { PointManager } from '../point-manager'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
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
jest.mock('../score', () => ({
  calculateScore: jest.fn(),
}))

describe('PointManager', () => {
  let pointManager: PointManager
  const mockPrisma = jest.requireMock('@/lib/prisma').prisma

  beforeEach(() => {
    pointManager = new PointManager('test-game-id')
    jest.clearAllMocks()
  })

  describe('クラス初期化', () => {
    test('PointManagerが正しく初期化される', () => {
      expect(pointManager).toBeInstanceOf(PointManager)
    })
  })

  describe('精算計算', () => {
    test('精算計算が正しく行われる', () => {
      const mockParticipants = [
        { playerId: 'player1', currentPoints: 34500, position: 0 },
        { playerId: 'player2', currentPoints: 27400, position: 1 },
        { playerId: 'player3', currentPoints: 22600, position: 2 },
        { playerId: 'player4', currentPoints: 15500, position: 3 },
      ]

      const mockSettings = {
        uma: [20, 10, -10, -20],
        basePoints: 30000,
      }

      // Use the private method by accessing it through bracket notation
      const result = pointManager['calculateSettlement'](mockParticipants, mockSettings)

      expect(result).toHaveLength(4)
      expect(result[0].rank).toBe(1) // Highest points
      expect(result[3].rank).toBe(4) // Lowest points
      
      // Check that uma is applied correctly
      expect(result[0].uma).toBe(20) // 1st place
      expect(result[1].uma).toBe(10) // 2nd place
      expect(result[2].uma).toBe(-10) // 3rd place
      expect(result[3].uma).toBe(-20) // 4th place
    })

    test('同点時の順位処理', () => {
      const mockParticipants = [
        { playerId: 'player1', currentPoints: 25000, position: 0 },
        { playerId: 'player2', currentPoints: 25000, position: 1 },
        { playerId: 'player3', currentPoints: 25000, position: 2 },
        { playerId: 'player4', currentPoints: 25000, position: 3 },
      ]

      const mockSettings = {
        uma: [20, 10, -10, -20],
        basePoints: 25000,
      }

      const result = pointManager['calculateSettlement'](mockParticipants, mockSettings)

      // Check that all players have proper settlement calculations
      expect(result).toHaveLength(4)
      result.forEach(player => {
        expect(player.finalPoints).toBe(25000)
        expect(player.pointDiff).toBe(0)
      })
    })
  })

  describe('ゲーム状態管理', () => {
    test('ゲーム終了チェック', async () => {
      mockPrisma.gameParticipant.findMany.mockResolvedValue([
        { currentPoints: 35000, playerId: 'player1' },
        { currentPoints: 25000, playerId: 'player2' },
        { currentPoints: 20000, playerId: 'player3' },
        { currentPoints: -5000, playerId: 'player4' }, // Negative points
      ])

      mockPrisma.game.findUnique.mockResolvedValue({
        currentRound: 8,
        gameType: 'hanchan',
        settings: {
          hasTobi: true,
        },
      })

      const result = await pointManager.checkGameEnd()

      expect(result.shouldEnd).toBe(true)
      expect(result.reason).toContain('トビ終了')
    })

    test('通常のゲーム続行', async () => {
      mockPrisma.gameParticipant.findMany.mockResolvedValue([
        { currentPoints: 35000, playerId: 'player1' },
        { currentPoints: 25000, playerId: 'player2' },
        { currentPoints: 20000, playerId: 'player3' },
        { currentPoints: 15000, playerId: 'player4' },
      ])

      mockPrisma.game.findUnique.mockResolvedValue({
        currentRound: 4,
        gameType: 'hanchan',
        settings: {
          hasTobi: true,
        },
      })

      const result = await pointManager.checkGameEnd()

      expect(result.shouldEnd).toBe(false)
    })
  })

  describe('リーチ処理', () => {
    test('リーチ宣言が正しく処理される', async () => {
      mockPrisma.gameParticipant.findFirst.mockResolvedValue({
        id: 'participant-1',
        playerId: 'player1',
        currentPoints: 25000,
        isReach: false,
      })

      mockPrisma.game.findUnique.mockResolvedValue({
        currentRound: 3,
        kyotaku: 0,
      })

      await pointManager.declareReach('player1')

      expect(mockPrisma.gameParticipant.update).toHaveBeenCalledWith({
        where: {
          id: 'participant-1',
        },
        data: {
          currentPoints: 24000, // 1000 point deduction
          isReach: true,
        },
      })

      expect(mockPrisma.game.update).toHaveBeenCalledWith({
        where: { id: 'test-game-id' },
        data: { kyotaku: { increment: 1 } },
      })
    })

    test('点数不足時のリーチエラー', async () => {
      mockPrisma.gameParticipant.findFirst.mockResolvedValue({
        playerId: 'player1',
        currentPoints: 500, // Not enough points
        isReach: false,
      })

      await expect(pointManager.declareReach('player1')).rejects.toThrow('リーチするには1000点以上必要です')
    })
  })

  describe('ゲーム情報取得', () => {
    test('ゲーム情報が正しく取得される', async () => {
      const mockGameData = {
        id: 'test-game-id',
        roomCode: 'ABCD',
        status: 'PLAYING',
        currentRound: 5,
        currentOya: 2,
        honba: 1,
        kyotaku: 2,
      }

      mockPrisma.game.findUnique.mockResolvedValue(mockGameData)

      const result = await pointManager.getGameInfo()

      expect(result).toEqual(mockGameData)
      expect(mockPrisma.game.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-game-id' },
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
})