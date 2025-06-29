import { POST } from "../route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    gameSession: { findFirst: jest.fn(), create: jest.fn() },
    gameParticipant: { create: jest.fn() },
  },
}))

describe("POST /api/game/[gameId]/rematch", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 404 when game not found", async () => {
    mockPrisma.game.findUnique.mockResolvedValue(null)
    const { req } = createMocks({
      method: "POST",
      json: () => ({ continueSession: true }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(404)
  })

  it("creates new game in existing session", async () => {
    const game = {
      id: "old",
      roomCode: "RC",
      hostPlayerId: "h",
      participants: [],
      settingsId: "s",
      settings: {},
      session: { id: "sess" },
    }
    mockPrisma.game.findUnique.mockResolvedValue(game as any)
    mockPrisma.game.count.mockResolvedValue(1)
    mockPrisma.game.create.mockResolvedValue({
      id: "new",
      roomCode: "NEW",
    } as any)
    mockPrisma.gameParticipant.create.mockResolvedValue({} as any)

    const { req } = createMocks({
      method: "POST",
      json: () => ({ continueSession: true }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "old" }),
    })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockPrisma.game.create).toHaveBeenCalled()
  })
})
