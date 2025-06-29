import { createRematch } from "../rematch-service"

jest.mock("@/lib/prisma", () => {
  const prisma = {
    game: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    gameSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    sessionParticipant: {
      create: jest.fn(),
    },
    gameParticipant: {
      create: jest.fn(),
    },
  }
  return { __esModule: true, prisma, default: prisma }
})

const mockPrisma = jest.requireMock("@/lib/prisma").prisma

describe("createRematch", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("returns error when game is not found", async () => {
    mockPrisma.game.findUnique.mockResolvedValue(null)

    const result = await createRematch("missing", {})

    expect(result.success).toBe(false)
    expect(result.error.message).toBe("ゲームが見つかりません")
  })

  test("returns error when game settings are missing", async () => {
    mockPrisma.game.findUnique.mockResolvedValue({
      id: "game1",
      hostPlayerId: "host",
      participants: [],
      session: null,
      settingsId: null,
      settings: null,
    })
    mockPrisma.game.findFirst.mockResolvedValue(null)
    mockPrisma.gameSession.findFirst.mockResolvedValue(null)
    mockPrisma.gameSession.create.mockResolvedValue({
      id: "s1",
      sessionCode: "ABC",
    })
    mockPrisma.sessionParticipant.create.mockResolvedValue({})
    mockPrisma.game.create.mockResolvedValue({ id: "g2", roomCode: "ROOM" })
    mockPrisma.gameParticipant.create.mockResolvedValue({})

    const result = await createRematch("game1", { continueSession: false })

    expect(result.success).toBe(false)
    expect(result.error.message).toBe("ゲーム設定が見つかりません")
  })

  test("successfully creates rematch", async () => {
    mockPrisma.game.findUnique.mockResolvedValue({
      id: "game1",
      hostPlayerId: "host",
      participants: [
        { playerId: "p1", position: 0 },
        { playerId: "p2", position: 1 },
      ],
      session: null,
      settingsId: "settings1",
      settings: { initialPoints: 25000 },
    })
    mockPrisma.game.findFirst.mockResolvedValue(null)
    mockPrisma.gameSession.findFirst.mockResolvedValue(null)
    mockPrisma.gameSession.create.mockResolvedValue({
      id: "s1",
      sessionCode: "ABC",
    })
    mockPrisma.sessionParticipant.create.mockResolvedValue({ id: "sp" })
    mockPrisma.game.create.mockResolvedValue({ id: "g2", roomCode: "ROOM" })
    mockPrisma.gameParticipant.create.mockResolvedValue({ id: "gp" })

    const result = await createRematch("game1", { continueSession: false })

    expect(result.success).toBe(true)
    expect(result.data.gameId).toBe("g2")
    expect(mockPrisma.game.create).toHaveBeenCalled()
    expect(mockPrisma.gameParticipant.create).toHaveBeenCalledTimes(2)
  })
})
