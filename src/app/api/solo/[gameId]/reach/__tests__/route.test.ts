import { POST } from "../route"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"
import { prisma } from "@/lib/prisma"
import { declareSoloReach } from "@/lib/solo/score-manager"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    soloGame: { findUnique: jest.fn() },
  },
}))

jest.mock("@/lib/solo/score-manager", () => ({
  declareSoloReach: jest.fn(),
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockDeclareSoloReach = declareSoloReach as jest.Mock

describe("POST /api/solo/[gameId]/reach", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 400 for invalid input", async () => {
    const { req } = createMocks({ method: "POST", json: () => ({}) })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 500 when game missing", async () => {
    mockPrisma.soloGame.findUnique.mockResolvedValue(null)
    const { req } = createMocks({
      method: "POST",
      json: () => ({ position: 0, round: 1 }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(500)
  })

  it("declares reach when valid", async () => {
    mockPrisma.soloGame.findUnique.mockResolvedValue({
      id: "g1",
      status: "PLAYING",
      players: [
        { position: 0, name: "P", currentPoints: 2000, isReach: false },
      ],
    })
    mockDeclareSoloReach.mockResolvedValue({ gameId: "g1" })
    const { req } = createMocks({
      method: "POST",
      json: () => ({ position: 0, round: 1 }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockDeclareSoloReach).toHaveBeenCalledWith("g1", 0, 1)
  })
})
