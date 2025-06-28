import { prisma } from '@/lib/prisma';
import { SoloPointManager } from '../solo/solo-point-manager';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    soloGame: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    soloPlayer: {
      findMany: jest.fn(),
      update: jest.fn(), // Added this line
    },
    soloGameResult: {
      createMany: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => await callback(prisma)),
  },
}));

describe('SoloPointManager', () => {
  let pointManager: SoloPointManager;
  const mockPrisma = jest.requireMock('@/lib/prisma').prisma;
  const gameId = 'test-solo-game-id';

  beforeEach(() => {
    pointManager = new SoloPointManager(gameId);
    jest.clearAllMocks();
  });

  describe('calculateSettlement', () => {
    it('should calculate settlement correctly with custom uma and base points', () => {
      const players = [
        { id: '1', name: 'Player 1', currentPoints: 45000, position: 0 },
        { id: '2', name: 'Player 2', currentPoints: 25000, position: 1 },
        { id: '3', name: 'Player 3', currentPoints: 20000, position: 2 },
        { id: '4', name: 'Player 4', currentPoints: 10000, position: 3 },
      ];
      const settings = {
        initialPoints: 25000,
        basePoints: 30000,
        uma: [30, 10, -10, -30], // ワンスリー
      };

      // Private method access for testing
      const results = pointManager['calculateSettlement'](players, settings);

      // 1位
      expect(results[0].settlement).toBe(65); // 15 (oka) + 30 (uma) + 20 (oka)

      // 2位
      expect(results[1].settlement).toBe(5); // -5 + 10

      // 3位
      expect(results[2].settlement).toBe(-20); // -10 + -10

      // 4位
      expect(results[3].settlement).toBe(-50); // -20 + -30
    });

    it('should handle ties in rank correctly', () => {
        const players = [
            { id: '1', name: 'Player 1', currentPoints: 35000, position: 0 },
            { id: '2', name: 'Player 2', currentPoints: 35000, position: 1 },
            { id: '3', name: 'Player 3', currentPoints: 15000, position: 2 },
            { id: '4', name: 'Player 4', currentPoints: 15000, position: 3 },
          ];
          const settings = {
            initialPoints: 25000,
            basePoints: 30000,
            uma: [20, 10, -10, -20], // ワンツー
          };
    
          const results = pointManager['calculateSettlement'](players, settings);
    
          // 1位
          expect(results[0].position).toBe(0);
          expect(results[0].settlement).toBe(45); // 25 + 20
          // 2位
          expect(results[1].position).toBe(1);
          expect(results[1].settlement).toBe(15); // 5 + 10
          // 3位
          expect(results[2].position).toBe(2);
          expect(results[2].settlement).toBe(-25); // -15 + -10
          // 4位 
          expect(results[3].position).toBe(3);
          expect(results[3].settlement).toBe(-35); // -15 + -20
    });
  });

  describe('calculateFinalResults', () => {
    it('should fetch game settings and call calculateSettlement', async () => {
      const mockGame = {
        id: gameId,
        initialPoints: 25000,
        basePoints: 30000,
        uma: [10, 5, -5, -10], // ゴットー
      };
      const mockPlayers = [
        { id: '1', name: 'Player 1', currentPoints: 40000, position: 0 },
        { id: '2', name: 'Player 2', currentPoints: 30000, position: 1 },
        { id: '3', name: 'Player 3', currentPoints: 20000, position: 2 },
        { id: '4', name: 'Player 4', currentPoints: 10000, position: 3 },
      ];

      mockPrisma.soloGame.findUnique.mockResolvedValue(mockGame);
      mockPrisma.soloPlayer.findMany.mockResolvedValue(mockPlayers);
      
      const calculateSettlementSpy = jest.spyOn(pointManager as any, 'calculateSettlement');

      await pointManager.calculateFinalResults();

      expect(mockPrisma.soloGame.findUnique).toHaveBeenCalledWith({ where: { id: gameId } });
      expect(mockPrisma.soloPlayer.findMany).toHaveBeenCalledWith({ 
        where: { soloGameId: gameId },
        orderBy: { position: 'asc' }
      });
      expect(calculateSettlementSpy).toHaveBeenCalledWith(mockPlayers, {
        initialPoints: mockGame.initialPoints,
        basePoints: mockGame.basePoints,
        uma: mockGame.uma,
      });
      expect(mockPrisma.soloGameResult.upsert).toHaveBeenCalled();
    });
  });
});