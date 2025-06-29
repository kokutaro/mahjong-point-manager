import { GET } from "../health/route"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    player: { count: jest.fn() },
    scorePattern: { count: jest.fn() },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns healthy status when db calls succeed", async () => {
    mockPrisma.player.count.mockResolvedValue(5)
    mockPrisma.scorePattern.count.mockResolvedValue(2)

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("healthy")
    expect(data.database.players).toBe(5)
    expect(data.database.scorePatterns).toBe(2)
  })

  it("returns unhealthy status when db call fails", async () => {
    mockPrisma.player.count.mockRejectedValue(new Error("db failure"))

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.status).toBe("unhealthy")
    expect(data.database.connected).toBe(false)
    expect(data.database.error).toBe("db failure")
  })
})
