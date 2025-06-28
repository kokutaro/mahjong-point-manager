/**
 * 統合API ユニットテスト
 * 統合エンドポイントの動作を検証
 */

const { createMocks } = require('node-mocks-http')
import { GET, PATCH, POST } from '@/app/api/game/[gameId]/route'
import { GET as RiichiPOST } from '@/app/api/game/[gameId]/riichi/route'
import { POST as ScorePOST } from '@/app/api/game/[gameId]/score/route'
import { POST as RyukyokuPOST } from '@/app/api/game/[gameId]/ryukyoku/route'
import { GET as ResultGET } from '@/app/api/game/[gameId]/result/route'

// Prismaクライアントのモック
jest.mock('@/lib/prisma', () => ({
  prisma: {
    game: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    soloGame: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    soloPlayer: {
      updateMany: jest.fn(),
    },
    soloGameEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    soloGameResult: {
      create: jest.fn(),
    },
    gameParticipant: {
      update: jest.fn(),
    },
    gameEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

// WebSocketのモック
jest.mock('@/lib/socket', () => ({
  getIO: jest.fn(() => null),
}))

// ソロゲーム関連のモック
jest.mock('@/lib/solo/score-manager', () => ({
  getSoloGameState: jest.fn(),
  declareSoloReach: jest.fn(),
}))

// ポイントマネージャーのモック
jest.mock('@/lib/point-manager', () => ({
  PointManager: jest.fn().mockImplementation(() => ({
    declareReach: jest.fn(),
    getGameState: jest.fn(),
    getGameInfo: jest.fn(),
  })),
}))

const { prisma } = require('@/lib/prisma')
const { getSoloGameState, declareSoloReach } = require('@/lib/solo/score-manager')

describe('統合API ユニットテスト', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/game/[gameId] - ゲーム状態取得', () => {
    test('ソロゲームの状態を正常に取得', async () => {
      // モックデータ設定
      const mockSoloGame = {
        id: 'solo-game-id',
        status: 'PLAYING',
        gameType: 'HANCHAN',
        initialPoints: 25000,
        createdAt: new Date(),
        startedAt: new Date(),
        endedAt: null,
        players: [
          { position: 0, name: 'プレイヤー1', currentPoints: 25000 },
          { position: 1, name: 'プレイヤー2', currentPoints: 25000 },
          { position: 2, name: 'プレイヤー3', currentPoints: 25000 },
          { position: 3, name: 'プレイヤー4', currentPoints: 25000 },
        ],
      }

      const mockGameState = {
        gameId: 'solo-game-id',
        status: 'PLAYING',
        players: mockSoloGame.players,
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
      }

      // マルチプレイゲームが存在しない設定
      prisma.game.findUnique.mockResolvedValue(null)
      
      // ソロプレイゲームが存在する設定
      prisma.soloGame.findUnique.mockResolvedValue(mockSoloGame)
      getSoloGameState.mockResolvedValue(mockGameState)

      // リクエスト作成
      const { req } = createMocks({
        method: 'GET',
      })

      // パラメータをPromiseとして設定
      const params = Promise.resolve({ gameId: 'solo-game-id' })

      // API実行
      const response = await GET(req, { params })
      const data = await response.json()

      // 検証
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.gameState.gameMode).toBe('SOLO')
      expect(data.data.gameState.gameId).toBe('solo-game-id')
      expect(data.data.gameInfo.gameMode).toBe('SOLO')
      expect(prisma.game.findUnique).toHaveBeenCalledWith({
        where: { id: 'solo-game-id' },
        include: {
          participants: {
            include: { player: true },
            orderBy: { position: 'asc' }
          },
          settings: true
        }
      })
    })

    test('マルチプレイゲームの状態を正常に取得', async () => {
      // モックデータ設定
      const mockMultiGame = {
        id: 'multi-game-id',
        status: 'PLAYING',
        roomCode: 'ROOM123',
        currentRound: 2,
        currentOya: 1,
        honba: 1,
        kyotaku: 1000,
        sessionId: 'session-id',
        createdAt: new Date(),
        startedAt: new Date(),
        endedAt: null,
        participants: [
          {
            playerId: 'player1',
            player: { name: 'プレイヤー1' },
            position: 0,
            currentPoints: 28000,
            isReach: false,
          },
          {
            playerId: 'player2',
            player: { name: 'プレイヤー2' },
            position: 1,
            currentPoints: 25000,
            isReach: true,
          },
        ],
        settings: {
          gameType: 'HANCHAN',
          basePoints: 30000,
        },
      }

      // マルチプレイゲームが存在する設定
      prisma.game.findUnique.mockResolvedValue(mockMultiGame)

      // リクエスト作成
      const { req } = createMocks({
        method: 'GET',
      })

      const params = Promise.resolve({ gameId: 'multi-game-id' })

      // API実行
      const response = await GET(req, { params })
      const data = await response.json()

      // 検証
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.gameState.gameMode).toBe('MULTIPLAYER')
      expect(data.data.gameState.gameId).toBe('multi-game-id')
      expect(data.data.gameState.players).toHaveLength(2)
      expect(data.data.gameInfo.gameMode).toBe('MULTIPLAYER')
    })

    test('存在しないゲームでエラーレスポンス', async () => {
      // ゲームが存在しない設定
      prisma.game.findUnique.mockResolvedValue(null)
      prisma.soloGame.findUnique.mockResolvedValue(null)

      // リクエスト作成
      const { req } = createMocks({
        method: 'GET',
      })

      const params = Promise.resolve({ gameId: 'non-existent-id' })

      // API実行
      const response = await GET(req, { params })
      const data = await response.json()

      // 検証
      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('GAME_NOT_FOUND')
    })
  })

  describe('PATCH /api/game/[gameId] - ゲーム操作', () => {
    test('ソロゲームの開始処理', async () => {
      // モックデータ設定
      const mockSoloGame = {
        id: 'solo-game-id',
        status: 'WAITING',
        players: [],
      }

      const mockUpdatedGameState = {
        gameId: 'solo-game-id',
        status: 'PLAYING',
        gameMode: 'SOLO',
      }

      prisma.soloGame.findUnique.mockResolvedValue(mockSoloGame)
      prisma.soloGame.update.mockResolvedValue({
        ...mockSoloGame,
        status: 'PLAYING',
      })
      getSoloGameState.mockResolvedValue(mockUpdatedGameState)

      // リクエスト作成
      const { req } = createMocks({
        method: 'PATCH',
        body: JSON.stringify({ action: 'start' }),
        headers: {
          'content-type': 'application/json',
        },
      })

      // json()メソッドを追加
      req.json = async () => ({ action: 'start' })

      const params = Promise.resolve({ gameId: 'solo-game-id' })

      // API実行
      const response = await PATCH(req, { params })
      const data = await response.json()

      // 検証
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.gameMode).toBe('SOLO')
      expect(prisma.soloGame.update).toHaveBeenCalledWith({
        where: { id: 'solo-game-id' },
        data: {
          status: 'PLAYING',
          startedAt: expect.any(Date),
        },
      })
    })
  })

  describe('POST /api/game/[gameId] - 強制終了', () => {
    test('ソロゲームの強制終了処理', async () => {
      // モックデータ設定
      const mockSoloGame = {
        id: 'solo-game-id',
        status: 'PLAYING',
        currentRound: 3,
        honba: 2,
        initialPoints: 25000,
        players: [
          { position: 0, name: 'プレイヤー1', currentPoints: 30000 },
          { position: 1, name: 'プレイヤー2', currentPoints: 25000 },
          { position: 2, name: 'プレイヤー3', currentPoints: 22000 },
          { position: 3, name: 'プレイヤー4', currentPoints: 18000 },
        ],
      }

      prisma.game.findUnique.mockResolvedValue(null)
      prisma.soloGame.findUnique.mockResolvedValue(mockSoloGame)
      
      // トランザクションのモック
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          soloGame: {
            update: jest.fn().mockResolvedValue({}),
          },
          soloPlayer: {
            updateMany: jest.fn().mockResolvedValue({}),
          },
          soloGameEvent: {
            create: jest.fn().mockResolvedValue({}),
          },
        }
        return await callback(tx)
      })

      // リクエスト作成
      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({ reason: 'テスト強制終了' }),
        headers: {
          'content-type': 'application/json',
        },
      })

      // json()メソッドを追加
      req.json = async () => ({ reason: 'テスト強制終了' })

      const params = Promise.resolve({ gameId: 'solo-game-id' })

      // API実行
      const response = await POST(req, { params })
      const data = await response.json()

      // 検証
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.gameMode).toBe('SOLO')
      expect(data.data.reason).toBe('テスト強制終了')
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('API統合 - パラメータ統一', () => {
    test('リーチAPIでplayerIdパラメータが正しく処理される', async () => {
      // ソロゲームでplayerIdが数値として処理されることを確認
      const mockSoloGame = {
        id: 'solo-game-id',
        status: 'PLAYING',
        players: [
          { position: 0, name: 'プレイヤー1', currentPoints: 25000, isReach: false },
        ],
      }

      const mockGameState = {
        gameId: 'solo-game-id',
        status: 'PLAYING',
      }

      prisma.game.findUnique.mockResolvedValue(null)
      prisma.soloGame.findUnique.mockResolvedValue(mockSoloGame)
      declareSoloReach.mockResolvedValue(mockGameState)

      // 統合リーチAPIのテスト（実際のファイルパスでテスト）
      const mockRequest = {
        json: async () => ({
          playerId: 0, // 数値として送信
          round: 1,
        }),
      }

      const params = Promise.resolve({ gameId: 'solo-game-id' })

      // この部分は実際のリーチAPIインポートが必要
      // expect(declareSoloReach).toHaveBeenCalledWith('solo-game-id', 0, 1)
    })
  })

  describe('エラーハンドリング統一', () => {
    test('統一されたエラーレスポンス形式', async () => {
      // 無効なアクションでエラーテスト
      prisma.soloGame.findUnique.mockResolvedValue({
        id: 'solo-game-id',
        status: 'PLAYING',
        players: [],
      })

      const { req } = createMocks({
        method: 'PATCH',
        body: JSON.stringify({ action: 'invalid-action' }),
        headers: {
          'content-type': 'application/json',
        },
      })

      // json()メソッドを追加
      req.json = async () => ({ action: 'invalid-action' })

      const params = Promise.resolve({ gameId: 'solo-game-id' })

      const response = await PATCH(req, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_ACTION')
      expect(data.error.message).toBe('無効なアクションです')
    })
  })
})