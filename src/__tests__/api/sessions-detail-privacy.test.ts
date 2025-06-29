/**
 * セッション詳細APIのプライバシーテスト
 * 参加していないセッションの詳細にアクセスできないことを確認
 */
import { GET } from '@/app/api/sessions/[sessionId]/route'
import { getCurrentPlayer, checkSessionAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// モック設定
jest.mock('@/lib/auth')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    gameSession: {
      findUnique: jest.fn(),
    },
    gameResult: {
      findMany: jest.fn(),
    },
  },
}))

const mockGetCurrentPlayer = getCurrentPlayer as jest.MockedFunction<typeof getCurrentPlayer>
const mockCheckSessionAccess = checkSessionAccess as jest.MockedFunction<typeof checkSessionAccess>

describe('セッション詳細API プライバシーテスト', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('認証されていない場合は401エラーを返す', async () => {
    mockGetCurrentPlayer.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/sessions/session-1')
    const params = Promise.resolve({ sessionId: 'session-1' })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error.message).toBe('認証が必要です')
  })

  it('セッション参加者以外は403エラーを返す', async () => {
    const currentPlayer = {
      playerId: 'other-player',
      name: 'その他プレイヤー'
    }

    mockGetCurrentPlayer.mockResolvedValue(currentPlayer)
    mockCheckSessionAccess.mockResolvedValue(false)

    const request = new NextRequest('http://localhost/api/sessions/session-1')
    const params = Promise.resolve({ sessionId: 'session-1' })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.success).toBe(false)
    expect(data.error.message).toBe('このセッションにアクセスする権限がありません')
    expect(mockCheckSessionAccess).toHaveBeenCalledWith('session-1', 'other-player')
  })

  it('セッション参加者は詳細にアクセスできる', async () => {
    const currentPlayer = {
      playerId: 'player-1',
      name: 'テストプレイヤー'
    }

    mockGetCurrentPlayer.mockResolvedValue(currentPlayer)
    mockCheckSessionAccess.mockResolvedValue(true)

    const mockSession = {
      id: 'session-1',
      sessionCode: '123456',
      name: 'テストセッション',
      status: 'ACTIVE',
      createdAt: new Date(),
      endedAt: null,
      hostPlayer: { id: 'host-1', name: 'ホスト' },
      settings: null,
      participants: [
        {
          playerId: 'player-1',
          player: { id: 'player-1', name: 'テストプレイヤー' },
          position: 0,
          totalGames: 0,
          totalSettlement: 0,
          firstPlace: 0,
          secondPlace: 0,
          thirdPlace: 0,
          fourthPlace: 0
        }
      ],
      games: []
    }

    ;(prisma.gameSession.findUnique as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.gameResult.findMany as jest.Mock).mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/sessions/session-1')
    const params = Promise.resolve({ sessionId: 'session-1' })
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockCheckSessionAccess).toHaveBeenCalledWith('session-1', 'player-1')
  })
})