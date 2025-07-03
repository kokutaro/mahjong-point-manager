import {
  updateSoloGameScore,
  declareSoloReach,
  processSoloRyukyoku,
  getSoloGameState,
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

  it("increments honba for oya tsumo", async () => {
    const game = {
      id: "g2",
      honba: 1,
      kyotaku: 2,
      currentOya: 0,
      currentRound: 1,
      status: "PLAYING",
      players: basePlayers,
    }
    mockPrisma.soloGame.findUnique.mockResolvedValueOnce(game)
    mockPrisma.soloGame.findUnique.mockResolvedValueOnce(game)
    const updated = { ...game, honba: 2, kyotaku: 0 }
    mockPrisma.soloGame.findUnique.mockResolvedValueOnce(updated)

    mockCalcScore.mockResolvedValue({
      payments: { fromKo: 2000 },
      totalScore: 6000,
      kyotakuPayment: 2000,
    })

    const res = await updateSoloGameScore("g2", {
      winnerId: 0,
      loserId: undefined,
      han: 3,
      fu: 40,
      isOya: true,
      isTsumo: true,
    })

    expect(res.gameState.honba).toBe(2)
    expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
      where: { id: "g2" },
      data: { currentOya: 0, honba: 2, kyotaku: 0 },
    })
  })

  it("updates dealer on ron", async () => {
    const game = {
      id: "g3",
      honba: 0,
      kyotaku: 0,
      currentOya: 0,
      currentRound: 1,
      status: "PLAYING",
      players: basePlayers,
    }
    mockPrisma.soloGame.findUnique.mockResolvedValueOnce(game)
    mockPrisma.soloGame.findUnique.mockResolvedValueOnce(game)
    const updated = { ...game, currentOya: 1, honba: 0 }
    mockPrisma.soloGame.findUnique.mockResolvedValueOnce(updated)

    mockCalcScore.mockResolvedValue({
      payments: {},
      totalScore: 8000,
      kyotakuPayment: 0,
    })

    const res = await updateSoloGameScore("g3", {
      winnerId: 1,
      loserId: 2,
      han: 3,
      fu: 30,
      isOya: false,
      isTsumo: false,
    })

    expect(res.gameState.currentOya).toBe(1)
    expect(mockPrisma.soloGame.update).toHaveBeenCalledWith({
      where: { id: "g3" },
      data: { currentOya: 1, honba: 0, kyotaku: 0 },
    })
  })

  it("throws when game not found", async () => {
    mockPrisma.soloGame.findUnique.mockResolvedValue(null)

    await expect(
      updateSoloGameScore("none", {
        winnerId: 0,
        loserId: undefined,
        han: 2,
        fu: 30,
        isOya: true,
        isTsumo: true,
      })
    ).rejects.toThrow("ゲームが見つかりません")
  })

  it("throws when game is not playing", async () => {
    const game = {
      id: "g4",
      honba: 0,
      kyotaku: 0,
      currentOya: 0,
      currentRound: 1,
      status: "WAITING",
      players: basePlayers,
    }
    mockPrisma.soloGame.findUnique.mockResolvedValue(game as any)

    await expect(
      updateSoloGameScore("g4", {
        winnerId: 0,
        loserId: undefined,
        han: 1,
        fu: 20,
        isOya: true,
        isTsumo: true,
      })
    ).rejects.toThrow("ゲームが開始されていません")
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

describe("getSoloGameState", () => {
  it("returns formatted state", async () => {
    const game = {
      id: "g5",
      currentRound: 1,
      currentOya: 0,
      honba: 0,
      kyotaku: 0,
      status: "PLAYING",
      players: basePlayers.map((p) => ({
        ...p,
        isReach: false,
        reachRound: null,
      })),
    }
    mockPrisma.soloGame.findUnique.mockResolvedValue(game as any)

    const state = await getSoloGameState("g5")

    expect(state.players.length).toBe(4)
    expect(state.gameId).toBe("g5")
  })

  it("throws when state not found", async () => {
    mockPrisma.soloGame.findUnique.mockResolvedValue(null)
    await expect(getSoloGameState("bad")).rejects.toThrow(
      "ゲームが見つかりません"
    )
  })
})
