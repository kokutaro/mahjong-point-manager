import { POST } from "../route"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    soloGame: { findUnique: jest.fn(), update: jest.fn() },
    soloGameEvent: { create: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(prisma)),
  },
}))

describe("POST /api/solo/[gameId]/force-end", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 400 when gameId missing", async () => {
    const { req } = createMocks({
      method: "POST",
      json: () => ({ reason: "err" }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "" }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 400 on invalid input", async () => {
    const { req } = createMocks({ method: "POST", json: () => ({}) })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 404 if game not found", async () => {
    mockPrisma.soloGame.findUnique.mockResolvedValue(null)
    const { req } = createMocks({
      method: "POST",
      json: () => ({ reason: "stop" }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(404)
  })

  it("force ends game successfully", async () => {
    mockPrisma.soloGame.findUnique.mockResolvedValue({
      id: "g1",
      status: "PLAYING",
      currentRound: 1,
      honba: 0,
      players: [],
    } as any)

    const { req } = createMocks({
      method: "POST",
      json: () => ({ reason: "stop" }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockPrisma.soloGame.update).toHaveBeenCalled()
    expect(mockPrisma.soloGameEvent.create).toHaveBeenCalled()
  })
})
