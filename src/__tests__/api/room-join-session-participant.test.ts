/**
 * ルーム参加時のセッション参加者登録テスト
 * クライアントプレイヤーがルーム参加時にSessionParticipantとして登録されることを確認
 */
import { POST } from '@/app/api/room/join/route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Prismaのモック
jest.mock('@/lib/prisma', () => ({
  prisma: {
    game: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    gameParticipant: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    player: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    sessionParticipant: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

// Cookiesのモック
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(() => ({ value: 'test-player-id' })),
  })),
}))

// SocketIOのモック
jest.mock('@/lib/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
  })),
}))

// NextRequestとNextResponseのモック
jest.mock('next/server', () => {
  return {
    NextRequest: jest.fn().mockImplementation((url, options) => {
      let requestBody = {}
      if (options?.body) {
        try {
          requestBody = JSON.parse(options.body)
        } catch {
          requestBody = {}
        }
      }

      return {
        url,
        method: options?.method || 'GET',
        json: jest.fn(() => Promise.resolve(requestBody)),
        headers: new Map(),
      }
    }),
    NextResponse: {
      json: jest.fn((data, options) => {
        const response = {
          json: jest.fn(() => Promise.resolve(data)),
          status: options?.status || 200,
          cookies: {
            set: jest.fn(),
          },
        }
        return response
      }),
    },
  }
})

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('ルーム参加時のセッション参加者登録', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('クライアントプレイヤーがルーム参加時にSessionParticipantとして登録される', async () => {
    const mockGame = {
      id: 'game-1',
      roomCode: 'ABCDEF',
      hostPlayerId: 'host-player',
      status: 'WAITING',
      participants: [
        { playerId: 'host-player', position: 0 }
      ],
      settings: { initialPoints: 25000 },
      session: {
        id: 'session-1',
        participants: [
          { playerId: 'host-player', position: 0 }
        ]
      }
    }

    const mockPlayer = {
      id: 'test-player-id',
      name: 'テストプレイヤー'
    }

    const mockGameParticipant = {
      id: 'game-participant-1',
      gameId: 'game-1',
      playerId: 'test-player-id',
      position: 1
    }

    // Prismaのモック設定
    mockPrisma.game.findFirst.mockResolvedValue(mockGame as any)
    mockPrisma.player.findUnique.mockResolvedValue(mockPlayer as any)
    mockPrisma.gameParticipant.findMany.mockResolvedValue([
      { player: { name: 'ホストプレイヤー' } }
    ] as any)
    mockPrisma.game.findUnique.mockResolvedValue({
      ...mockGame,
      participants: [
        {
          playerId: 'host-player',
          position: 0,
          player: { name: 'ホストプレイヤー' }
        },
        {
          playerId: 'test-player-id',
          position: 1,
          player: { name: 'テストプレイヤー' }
        }
      ]
    } as any)

    // トランザクション内のモック関数
    const mockTxGameParticipantFindMany = jest.fn().mockResolvedValue([
      { playerId: 'host-player', position: 0 }
    ])
    const mockTxGameParticipantCreate = jest.fn().mockResolvedValue(mockGameParticipant)
    const mockTxSessionParticipantFindFirst = jest.fn().mockResolvedValue(null)
    const mockTxSessionParticipantFindMany = jest.fn().mockResolvedValue([
      { playerId: 'host-player', position: 0 }
    ])
    const mockTxSessionParticipantCreate = jest.fn().mockResolvedValue({
      id: 'session-participant-1',
      sessionId: 'session-1',
      playerId: 'test-player-id',
      position: 1
    })

    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const mockTx = {
        gameParticipant: {
          findMany: mockTxGameParticipantFindMany,
          create: mockTxGameParticipantCreate,
        },
        sessionParticipant: {
          findFirst: mockTxSessionParticipantFindFirst,
          findMany: mockTxSessionParticipantFindMany,
          create: mockTxSessionParticipantCreate,
        },
      }
      return callback(mockTx as any)
    })

    const request = new NextRequest('http://localhost/api/room/join', {
      method: 'POST',
      body: JSON.stringify({
        roomCode: 'ABCDEF',
        playerName: 'テストプレイヤー'
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // GameParticipantが作成されることを確認
    expect(mockTxGameParticipantCreate).toHaveBeenCalledWith({
      data: {
        gameId: 'game-1',
        playerId: 'test-player-id',
        position: 1,
        currentPoints: 25000,
        isReach: false
      }
    })

    // SessionParticipantが作成されることを確認
    expect(mockTxSessionParticipantCreate).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        playerId: 'test-player-id',
        position: 1,
        totalGames: 0,
        totalSettlement: 0,
        firstPlace: 0,
        secondPlace: 0,
        thirdPlace: 0,
        fourthPlace: 0
      }
    })
  })

  it('既にセッション参加者として登録済みの場合はSessionParticipantを重複作成しない', async () => {
    const mockGame = {
      id: 'game-1',
      roomCode: 'ABCDEF',
      hostPlayerId: 'host-player',
      status: 'WAITING',
      participants: [
        { playerId: 'host-player', position: 0 }
      ],
      settings: { initialPoints: 25000 },
      session: {
        id: 'session-1',
        participants: [
          { playerId: 'host-player', position: 0 },
          { playerId: 'test-player-id', position: 1 }
        ]
      }
    }

    const mockPlayer = {
      id: 'test-player-id',
      name: 'テストプレイヤー'
    }

    const mockGameParticipant = {
      id: 'game-participant-1',
      gameId: 'game-1',
      playerId: 'test-player-id',
      position: 1
    }

    const mockExistingSessionParticipant = {
      id: 'session-participant-1',
      sessionId: 'session-1',
      playerId: 'test-player-id',
      position: 1
    }

    // Prismaのモック設定
    mockPrisma.game.findFirst.mockResolvedValue(mockGame as any)
    mockPrisma.player.findUnique.mockResolvedValue(mockPlayer as any)
    mockPrisma.gameParticipant.findMany.mockResolvedValue([
      { player: { name: 'ホストプレイヤー' } }
    ] as any)
    mockPrisma.game.findUnique.mockResolvedValue({
      ...mockGame,
      participants: [
        {
          playerId: 'host-player',
          position: 0,
          player: { name: 'ホストプレイヤー' }
        },
        {
          playerId: 'test-player-id',
          position: 1,
          player: { name: 'テストプレイヤー' }
        }
      ]
    } as any)

    // トランザクション内のモック関数
    const mockTxGameParticipantFindMany = jest.fn().mockResolvedValue([
      { playerId: 'host-player', position: 0 }
    ])
    const mockTxGameParticipantCreate = jest.fn().mockResolvedValue(mockGameParticipant)
    const mockTxSessionParticipantFindFirst = jest.fn().mockResolvedValue(mockExistingSessionParticipant)
    const mockTxSessionParticipantCreate = jest.fn()

    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const mockTx = {
        gameParticipant: {
          findMany: mockTxGameParticipantFindMany,
          create: mockTxGameParticipantCreate,
        },
        sessionParticipant: {
          findFirst: mockTxSessionParticipantFindFirst,
          create: mockTxSessionParticipantCreate,
        },
      }
      return callback(mockTx as any)
    })

    const request = new NextRequest('http://localhost/api/room/join', {
      method: 'POST',
      body: JSON.stringify({
        roomCode: 'ABCDEF',
        playerName: 'テストプレイヤー'
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // GameParticipantは作成される
    expect(mockTxGameParticipantCreate).toHaveBeenCalled()

    // SessionParticipantは重複作成されない
    expect(mockTxSessionParticipantCreate).not.toHaveBeenCalled()
  })

  it('セッションが存在しない場合はSessionParticipantを作成しない', async () => {
    const mockGame = {
      id: 'game-1',
      roomCode: 'ABCDEF',
      hostPlayerId: 'host-player',
      status: 'WAITING',
      participants: [
        { playerId: 'host-player', position: 0 }
      ],
      settings: { initialPoints: 25000 },
      session: null
    }

    const mockPlayer = {
      id: 'test-player-id',
      name: 'テストプレイヤー'
    }

    const mockGameParticipant = {
      id: 'game-participant-1',
      gameId: 'game-1',
      playerId: 'test-player-id',
      position: 1
    }

    // Prismaのモック設定
    mockPrisma.game.findFirst.mockResolvedValue(mockGame as any)
    mockPrisma.player.findUnique.mockResolvedValue(mockPlayer as any)
    mockPrisma.gameParticipant.findMany.mockResolvedValue([
      { player: { name: 'ホストプレイヤー' } }
    ] as any)
    mockPrisma.game.findUnique.mockResolvedValue({
      ...mockGame,
      participants: [
        {
          playerId: 'host-player',
          position: 0,
          player: { name: 'ホストプレイヤー' }
        },
        {
          playerId: 'test-player-id',
          position: 1,
          player: { name: 'テストプレイヤー' }
        }
      ]
    } as any)

    // トランザクション内のモック関数
    const mockTxGameParticipantFindMany = jest.fn().mockResolvedValue([
      { playerId: 'host-player', position: 0 }
    ])
    const mockTxGameParticipantCreate = jest.fn().mockResolvedValue(mockGameParticipant)
    const mockTxSessionParticipantCreate = jest.fn()

    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const mockTx = {
        gameParticipant: {
          findMany: mockTxGameParticipantFindMany,
          create: mockTxGameParticipantCreate,
        },
        sessionParticipant: {
          create: mockTxSessionParticipantCreate,
        },
      }
      return callback(mockTx as any)
    })

    const request = new NextRequest('http://localhost/api/room/join', {
      method: 'POST',
      body: JSON.stringify({
        roomCode: 'ABCDEF',
        playerName: 'テストプレイヤー'
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // GameParticipantは作成される
    expect(mockTxGameParticipantCreate).toHaveBeenCalled()

    // SessionParticipantは作成されない（セッションが存在しないため）
    expect(mockTxSessionParticipantCreate).not.toHaveBeenCalled()
  })
})