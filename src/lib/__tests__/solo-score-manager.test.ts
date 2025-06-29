import {
  updateSoloGameScore,
  declareSoloReach,
  processSoloRyukyoku,
} from "../solo/score-manager"
import { prisma } from "@/lib/prisma"
import { calculateScore } from "../score"

jest.mock("@/lib/prisma", () => {
  const prisma = {
    soloGame: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    soloPlayer: {
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    soloGameEvent: {
      create: jest.fn(),
    },
  }
  prisma.$transaction = jest.fn(async (cb) => await cb(prisma))
  return { __esModule: true, prisma, default: prisma }
})

jest.mock("../score", () => ({
  calculateScore: jest.fn(),
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockCalcScore = calculateScore as jest.Mock

const basePlayers = [
  { id: "p0", position: 0, name: "A", currentPoints: 25000 },
  { id: "p1", position: 1, name: "B", currentPoints: 25000 },
  { id: "p2", position: 2, name: "C", currentPoints: 25000 },
  { id: "p3", position: 3, name: "D", currentPoints: 25000 },
]

beforeEach(() => {
  jest.clearAllMocks()
})

describe("updateSoloGameScore", () => {
  it("updates points for child tsumo", async () => {
    const game = {
      id: "g1",
      honba: 0,
      kyotaku: 1,
      currentOya: 0,
      currentRound: 1,
      status: "PLAYING",
      players: basePlayers,
    }
    mockPrisma.soloGame.findUnique.mockResolvedValueOnce(game)
    mockPrisma.soloGame.findUnique.mockResolvedValueOnce(game)
    const updated = { ...game, kyotaku: 0 }
    mockPrisma.soloGame.findUnique.mockResolvedValueOnce(updated)

    mockCalcScore.mockResolvedValue({
      payments: { fromOya: 4000, fromKo: 2000 },
      totalScore: 8000,
      kyotakuPayment: 1000,
    })

    const result = await updateSoloGameScore("g1", {
      winnerId: 1,
      loserId: undefined,
      han: 2,
      fu: 30,
      isOya: false,
      isTsumo: true,
    })

    expect(result.scoreResult.totalScore).toBe(8000)
    expect(mockPrisma.soloPlayer.updateMany).toHaveBeenCalledWith({
      where: { soloGameId: "g1", position: 1 },
      data: { currentPoints: { increment: 9000 } },
    })
    expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { currentOya: 1, honba: 0, kyotaku: 0 },
    })
  })
})

describe("declareSoloReach", () => {
  it("decrements points and increases kyotaku", async () => {
    const game = { id: "g1", currentRound: 1, honba: 0, players: basePlayers }
    mockPrisma.soloGame.findUnique.mockResolvedValue(game as any)
    const updated = { ...game, kyotaku: 1 }
    mockPrisma.soloGame.findUnique.mockResolvedValue(updated as any)

    const res = await declareSoloReach("g1", 2, 3)

    expect(mockPrisma.soloPlayer.updateMany).toHaveBeenCalledWith({
      where: { soloGameId: "g1", position: 2 },
      data: {
        currentPoints: { decrement: 1000 },
        isReach: true,
        reachRound: 3,
      },
    })
    expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { kyotaku: { increment: 1 } },
    })
    expect(res.gameId).toBe("g1")
  })
})

describe("processSoloRyukyoku", () => {
  it("distributes points and rotates dealer", async () => {
    const game = {
      id: "g1",
      currentRound: 1,
      currentOya: 0,
      honba: 0,
      players: basePlayers,
    }
    mockPrisma.soloGame.findUnique.mockResolvedValue(game as any)
    const updated = { ...game, currentOya: 1, honba: 0 }
    mockPrisma.soloGame.findUnique.mockResolvedValue(updated as any)

    const res = await processSoloRyukyoku("g1", [1, 2], [0])

    expect(mockPrisma.soloPlayer.update).toHaveBeenCalled()
    expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: expect.objectContaining({ currentOya: 1 }),
    })
    expect(res.gameId).toBe("g1")
  })
})
