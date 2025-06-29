import { GET } from "../route"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    scorePattern: { findMany: jest.fn() },
  },
}))

describe("GET /api/score/patterns", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns patterns sorted by han and fu", async () => {
    mockPrisma.scorePattern.findMany.mockResolvedValue([
      { han: 1, fu: 30 },
      { han: 2, fu: 20 },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(mockPrisma.scorePattern.findMany).toHaveBeenCalledWith({
      orderBy: [{ han: "asc" }, { fu: "asc" }],
    })
  })

  it("returns 500 on db error", async () => {
    mockPrisma.scorePattern.findMany.mockRejectedValue(new Error("db"))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.message).toBe("点数パターン取得に失敗しました")
  })
})
