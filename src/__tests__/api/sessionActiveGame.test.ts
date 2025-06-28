import { GET } from '@/app/api/sessions/[sessionId]/active-game/route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    game: {
      findFirst: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('/api/sessions/[sessionId]/active-game', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns open game if available', async () => {
    mockPrisma.game.findFirst.mockResolvedValueOnce({
      id: 'game1',
      roomCode: 'ROOM1',
      status: 'WAITING',
    } as any)

    const response = await GET({} as any, {
      params: Promise.resolve({ sessionId: 'session1' }),
    } as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.roomCode).toBe('ROOM1')
    expect(mockPrisma.game.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['WAITING', 'PLAYING'] } }),
      })
    )
  })

  it('falls back to latest finished game', async () => {
    mockPrisma.game.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'game2',
        roomCode: 'ROOM2',
        status: 'FINISHED',
      } as any)

    const response = await GET({} as any, {
      params: Promise.resolve({ sessionId: 'session1' }),
    } as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.status).toBe('FINISHED')
    expect(mockPrisma.game.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['WAITING', 'PLAYING'] } }),
      })
    )
    expect(mockPrisma.game.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ status: 'FINISHED' }),
      })
    )
  })

  it('returns 404 if no game found', async () => {
    mockPrisma.game.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

    const response = await GET({} as any, {
      params: Promise.resolve({ sessionId: 'session1' }),
    } as any)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
  })
})
