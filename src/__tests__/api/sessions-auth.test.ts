/**
 * セッション認証関連のテスト
 * セッション一覧と詳細に参加者以外がアクセスできないことを確認
 */
import { checkSessionAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Prismaのモック
jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionParticipant: {
      findFirst: jest.fn(),
    },
  },
}))

describe('セッション認証機能', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkSessionAccess', () => {
    it('セッション参加者の場合はtrueを返す', async () => {
      const mockParticipant = {
        id: 'participant-1',
        sessionId: 'session-1',
        playerId: 'player-1',
        position: 0
      }

      ;(prisma.sessionParticipant.findFirst as jest.Mock).mockResolvedValue(mockParticipant)

      const result = await checkSessionAccess('session-1', 'player-1')
      expect(result).toBe(true)
      expect(prisma.sessionParticipant.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId: 'session-1',
          playerId: 'player-1'
        }
      })
    })

    it('セッション非参加者の場合はfalseを返す', async () => {
      ;(prisma.sessionParticipant.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await checkSessionAccess('session-1', 'other-player')
      expect(result).toBe(false)
      expect(prisma.sessionParticipant.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId: 'session-1',
          playerId: 'other-player'
        }
      })
    })

    it('データベースエラーの場合はfalseを返す', async () => {
      ;(prisma.sessionParticipant.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'))

      const result = await checkSessionAccess('session-1', 'player-1')
      expect(result).toBe(false)
    })
  })
})