import { GET } from "../route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    soloGame: { findUnique: jest.fn() },
    soloGameEvent: { findFirst: jest.fn() },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe("GET /api/solo/[gameId]/result", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 404 when game missing", async () => {
    mockPrisma.soloGame.findUnique.mockResolvedValue(null)
    const { req } = createMocks({ method: "GET" })
    const res = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "x" }),
    })
    expect(res.status).toBe(404)
  })

  it("returns 400 when game not finished", async () => {
    mockPrisma.soloGame.findUnique.mockResolvedValue({
      status: "PLAYING",
      players: [],
    })
    const { req } = createMocks({ method: "GET" })
    const res = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(400)
  })

  it("returns result when finished", async () => {
    mockPrisma.soloGame.findUnique.mockResolvedValue({
      id: "g1",
      status: "FINISHED",
      initialPoints: 25000,
      players: [
        {
          position: 0,
          name: "A",
          currentPoints: 27000,
          finalRank: 1,
          finalPoints: 27000,
          uma: 0,
          settlement: 2000,
        },
      ],
    })
    mockPrisma.soloGameEvent.findFirst.mockResolvedValue({
      eventData: { reason: "end" },
    })
    const { req } = createMocks({ method: "GET" })
    const res = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.gameId).toBe("g1")
  })
})
