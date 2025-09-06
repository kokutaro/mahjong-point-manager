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

  it("creates new session when continueSession is false", async () => {
    const game = {
      id: "old",
      roomCode: "RC",
      hostPlayerId: "h",
      participants: [
        { playerId: "p1", position: 0 },
        { playerId: "p2", position: 1 },
        { playerId: "p3", position: 2 },
        { playerId: "p4", position: 3 },
      ],
      settingsId: "s",
      settings: { initialPoints: 25000 },
      session: null,
    }

    mockPrisma.game.findUnique.mockResolvedValue(game as any)
    // for roomCode/sessionCode uniqueness checks
    mockPrisma.game.findFirst.mockResolvedValue(null as any)
    ;(mockPrisma as any).gameSession = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockResolvedValue({ id: "sess2", sessionCode: "123456" }),
    }
    ;(mockPrisma as any).sessionParticipant = {
      create: jest.fn().mockResolvedValue({}),
    }
    mockPrisma.game.create.mockResolvedValue({
      id: "new",
      roomCode: "NEW",
    } as any)
    mockPrisma.gameParticipant.create.mockResolvedValue({} as any)

    const { req } = createMocks({
      method: "POST",
      json: () => ({ continueSession: false, newSessionName: "S" }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "old" }),
    })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.sessionId).toBe("sess2")
  })
})
