import { POST } from "../route"
import { createMocks } from "node-mocks-http"
import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getIO } from "@/lib/vote-globals"

const mockGetGameInfo = jest.fn()
jest.mock("@/lib/point-manager", () => ({
  PointManager: jest.fn().mockImplementation(() => ({
    getGameInfo: mockGetGameInfo,
    forceEndGame: jest.fn(),
  })),
}))

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(),
}))

jest.mock("@/lib/vote-globals", () => ({
  getIO: jest.fn(),
  initializeVoteGlobals: jest.fn(),
}))

jest.mock("@/lib/vote-analysis", () => ({
  analyzeVotes: jest.fn(() => ({
    action: "wait",
    message: "",
    details: {
      continueVotes: 0,
      endVotes: 0,
      pauseVotes: 0,
      totalPlayers: 4,
      votedPlayers: 1,
    },
  })),
}))

jest.mock("@/lib/rematch-service", () => ({
  createRematch: jest.fn(() => ({ success: false })),
}))

describe("POST /api/game/[gameId]/vote-session", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.gameVotes = {}
    global.voteStartTimes = {}
  })

  it("returns 400 for invalid vote", async () => {
    ;(requireAuth as jest.Mock).mockResolvedValue({ playerId: "p1", name: "A" })
    const { req } = createMocks({
      method: "POST",
      json: () => ({ vote: "bad" }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 404 when game missing", async () => {
    ;(requireAuth as jest.Mock).mockResolvedValue({ playerId: "p1", name: "A" })
    mockGetGameInfo.mockResolvedValue(null)
    const { req } = createMocks({
      method: "POST",
      json: () => ({ vote: "continue" }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(404)
  })

  it("records vote when valid", async () => {
    ;(requireAuth as jest.Mock).mockResolvedValue({ playerId: "p1", name: "A" })
    mockGetGameInfo.mockResolvedValue({ sessionId: "s1", roomCode: "R" })
    ;(getIO as jest.Mock).mockReturnValue({ to: () => ({ emit: jest.fn() }) })
    const { req } = createMocks({
      method: "POST",
      json: () => ({ vote: "continue" }),
    })
    const res = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ gameId: "g1" }),
    })
    expect(res.status).toBe(200)
    expect(global.gameVotes["g1"].p1).toBe("continue")
    const body = await res.json()
    expect(body.data.vote).toBe("continue")
  })
})
