import { POST } from '@/app/api/solo/create/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { createMocks } from 'node-mocks-http';
import * as auth from '@/lib/solo/auth';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    soloGame: {
      create: jest.fn(),
    },
    soloPlayer: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => await callback(prisma)),
  },
}));

jest.mock('@/lib/solo/auth', () => ({
  authenticatePlayer: jest.fn(),
}));

describe('POST /api/solo/create', () => {
  const mockPrisma = require('@/lib/prisma').prisma;

  beforeEach(() => {
    jest.clearAllMocks();
    (auth.authenticatePlayer as jest.Mock).mockResolvedValue({ success: true, playerId: 'test-player-id' });
  });

  it('should create a new solo game and players on valid input', async () => {
    const mockGameData = {
      gameType: 'HANCHAN',
      initialPoints: 25000,
      basePoints: 30000,
      uma: [20, 10, -10, -20],
      players: [
        { name: 'Player 1', position: 0 },
        { name: 'Player 2', position: 1 },
        { name: 'Player 3', position: 2 },
        { name: 'Player 4', position: 3 },
      ],
    };

    const createdGame = {
      id: 'new-game-id',
      ...mockGameData,
      status: 'WAITING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const createdPlayers = mockGameData.players.map(p => ({ ...p, id: `player-id-${p.position}`, soloGameId: 'new-game-id', score: 25000 }));

    mockPrisma.$transaction.mockImplementation(async (callback) => {
        mockPrisma.soloGame.create.mockResolvedValue(createdGame);
        mockPrisma.soloPlayer.createMany.mockResolvedValue({ count: 4 });
        return { soloGame: createdGame, soloPlayers: createdPlayers };
    });


    const { req } = createMocks({
      method: 'POST',
      json: () => mockGameData,
    });

    const response = await POST(req as unknown as NextRequest);
    const responseData = await response.json();

    expect(response.status).toBe(201);
    expect(responseData.data.gameId).toBe('new-game-id');
  });

  it('should return 400 on invalid input', async () => {
    const invalidGameData = {
      // Missing gameType, etc.
      players: [],
    };

    const { req } = createMocks({
      method: 'POST',
      json: () => invalidGameData,
    });

    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(400);
  });

  it('should return 400 if player names are not unique', async () => {
    const mockGameData = {
        gameType: 'HANCHAN',
        initialPoints: 25000,
        basePoints: 30000,
        uma: [20, 10, -10, -20],
        players: [
          { name: 'Player 1', position: 0 },
          { name: 'Player 1', position: 1 }, // Duplicate name
          { name: 'Player 3', position: 2 },
          { name: 'Player 4', position: 3 },
        ],
      };
  
      const { req } = createMocks({
        method: 'POST',
        json: () => mockGameData,
      });
  
      const response = await POST(req as unknown as NextRequest);
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.details[0].message).toBe('プレイヤー名に重複があります');
  });

  it('should return 500 on database error', async () => {
    const mockGameData = {
        gameType: 'HANCHAN',
        initialPoints: 25000,
        basePoints: 30000,
        uma: [20, 10, -10, -20],
        players: [
          { name: 'Player 1', position: 0 },
          { name: 'Player 2', position: 1 },
          { name: 'Player 3', position: 2 },
          { name: 'Player 4', position: 3 },
        ],
      };

    mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

    const { req } = createMocks({
      method: 'POST',
      json: () => mockGameData,
    });

    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(500);
  });
});