import { GET } from "../route"
import { prisma } from "@/lib/prisma"
import * as auth from "@/lib/auth"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    gameSession: { findUnique: jest.fn() },
    gameResult: { findMany: jest.fn() },
  },
}))

jest.mock("@/lib/auth", () => ({
  getCurrentPlayer: jest.fn(),
  checkSessionAccess: jest.fn(),
}))

describe("GET /api/sessions/[sessionId]", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>

  beforeEach(() => {
    ;(auth.getCurrentPlayer as jest.Mock).mockReset()
    ;(auth.checkSessionAccess as jest.Mock).mockReset()
    jest.clearAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    ;(auth.getCurrentPlayer as jest.Mock).mockResolvedValue(null)
    const { req } = createMocks({ method: "GET" })
    const res = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ sessionId: "s1" }),
    })
    expect(res.status).toBe(401)
  })

  it("returns 403 when no access", async () => {
    ;(auth.getCurrentPlayer as jest.Mock).mockResolvedValue({ playerId: "p1" })
    ;(auth.checkSessionAccess as jest.Mock).mockResolvedValue(false)
    const { req } = createMocks({ method: "GET" })
    const res = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ sessionId: "s1" }),
    })
    expect(res.status).toBe(403)
  })

  it("returns 404 when session missing", async () => {
    ;(auth.getCurrentPlayer as jest.Mock).mockResolvedValue({ playerId: "p1" })
    ;(auth.checkSessionAccess as jest.Mock).mockResolvedValue(true)
    mockPrisma.gameSession.findUnique.mockResolvedValue(null as any)
    const { req } = createMocks({ method: "GET" })
    const res = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ sessionId: "s1" }),
    })
    expect(res.status).toBe(404)
  })

  it("returns session details with aggregated results", async () => {
    jest.spyOn(auth, "getCurrentPlayer").mockResolvedValue({ playerId: "p1" })
    jest.spyOn(auth, "checkSessionAccess").mockResolvedValue(true)
    mockPrisma.gameSession.findUnique.mockResolvedValue({
      id: "s1",
      sessionCode: "123456",
      name: "S",
      status: "ACTIVE",
      createdAt: new Date(),
      endedAt: null,
      hostPlayer: { id: "p1", name: "Host" },
      settings: { gameType: "HANCHAN" },
      participants: [
        {
          playerId: "p1",
          position: 0,
          totalGames: 0,
          totalSettlement: 0,
          firstPlace: 0,
          secondPlace: 0,
          thirdPlace: 0,
          fourthPlace: 0,
          player: { id: "p1", name: "Host" },
        },
        {
          playerId: "p2",
          position: 1,
          totalGames: 0,
          totalSettlement: 0,
          firstPlace: 0,
          secondPlace: 0,
          thirdPlace: 0,
          fourthPlace: 0,
          player: { id: "p2", name: "G" },
        },
      ],
      games: [
        {
          id: "g1",
          sessionOrder: 1,
          endedAt: new Date(),
          settings: { gameType: "HANCHAN" },
          participants: [
            { playerId: "p1", position: 0, player: { id: "p1", name: "Host" } },
            { playerId: "p2", position: 1, player: { id: "p2", name: "G" } },
          ],
        },
      ],
    } as any)

    mockPrisma.gameResult.findMany.mockResolvedValue([
      {
        gameId: "g1",
        results: [
          { playerId: "p1", settlement: 5000 },
          { playerId: "p2", settlement: -5000 },
        ],
      },
    ] as any)

    const { req } = createMocks({ method: "GET" })
    const res = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ sessionId: "s1" }),
    })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.players).toHaveLength(2)
    expect(body.data.gameResults[0].results.p1).toBe(5000)
    expect(body.data.totalRow.p1).toBe(5000)
  })
})
