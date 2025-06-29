import { POST } from "../route"
import { createMocks } from "node-mocks-http"
import { NextRequest } from "next/server"
import { calculateScore } from "@/lib/score"

const mockGetGameState = jest.fn()
const mockDistribute = jest.fn()
jest.mock("@/lib/solo/solo-point-manager", () => ({
  SoloPointManager: jest.fn().mockImplementation(() => ({
    getGameState: mockGetGameState,
    distributeWinPoints: mockDistribute,
  })),
}))

jest.mock("@/lib/score", () => ({
  calculateScore: jest.fn(),
}))

describe("POST /api/solo/[gameId]/score", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("validates input and returns 400", async () => {
    const { req } = createMocks({
      method: "POST",
      json: () => ({
        han: 2,
        fu: 30,
        isTsumo: false,
        winnerId: 1,
      }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(400)
  })

  it("returns updated game state when valid", async () => {
    mockGetGameState.mockResolvedValueOnce({
      players: [
        { position: 0 },
        { position: 1 },
        { position: 2 },
        { position: 3 },
      ],
      currentOya: 0,
      honba: 0,
      kyotaku: 0,
    })
    mockDistribute.mockResolvedValue({ gameEnded: false })
    mockGetGameState.mockResolvedValueOnce({ gameId: "g1" })
    ;(calculateScore as jest.Mock).mockResolvedValue({ totalScore: 8000 })

    const { req } = createMocks({
      method: "POST",
      json: () => ({
        han: 3,
        fu: 40,
        isTsumo: true,
        winnerId: 1,
      }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(400)
  })
})
