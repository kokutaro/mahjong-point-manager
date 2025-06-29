import { POST } from "../route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"
import { getIO } from "@/lib/socket"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { findUnique: jest.fn(), update: jest.fn() },
    gameEvent: { create: jest.fn() },
  },
}))

jest.mock("@/lib/socket", () => ({
  getIO: jest.fn(),
}))

describe("POST /api/game/[gameId]/start", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>
  const mockGetIO = getIO as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("starts game when valid", async () => {
    const mockGame = {
      id: "g1",
      roomCode: "RC",
      hostPlayerId: "host",
      status: "WAITING",
      currentOya: 0,
      honba: 0,
      kyotaku: 0,
      participants: [
        {
          playerId: "p1",
          position: 0,
          currentPoints: 25000,
          isReach: false,
          player: { name: "A" },
        },
        {
          playerId: "p2",
          position: 1,
          currentPoints: 25000,
          isReach: false,
          player: { name: "B" },
        },
        {
          playerId: "p3",
          position: 2,
          currentPoints: 25000,
          isReach: false,
          player: { name: "C" },
        },
        {
          playerId: "p4",
          position: 3,
          currentPoints: 25000,
          isReach: false,
          player: { name: "D" },
        },
      ],
    }
    mockPrisma.game.findUnique.mockResolvedValue(mockGame as any)
    mockPrisma.game.update.mockResolvedValue(mockGame as any)
    mockGetIO.mockReturnValue({ to: () => ({ emit: jest.fn() }) })

    const { req } = createMocks({
      method: "POST",
      json: () => ({ hostPlayerId: "host" }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })

    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockPrisma.game.update).toHaveBeenCalled()
    expect(mockPrisma.gameEvent.create).toHaveBeenCalled()
  })

  it("returns 404 when game missing", async () => {
    mockPrisma.game.findUnique.mockResolvedValue(null)
    const { req } = createMocks({
      method: "POST",
      json: () => ({ hostPlayerId: "x" }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "x" }),
    })
    expect(res.status).toBe(404)
  })
})
