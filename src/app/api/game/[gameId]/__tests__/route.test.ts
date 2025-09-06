import { GET, PATCH, POST } from "../route"
import { prisma } from "@/lib/prisma"
import * as soloManager from "@/lib/solo/score-manager"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: { findUnique: jest.fn(), update: jest.fn() },
    gameEvent: { create: jest.fn() },
    soloGame: { findUnique: jest.fn(), update: jest.fn() },
    soloPlayer: { updateMany: jest.fn() },
    soloGameResult: { create: jest.fn() },
    soloGameEvent: { create: jest.fn() },
    gameParticipant: { update: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<void>) => {
      // txとして同じモックを渡す
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return fn(prisma)
    }),
  },
}))

jest.mock("@/lib/solo/score-manager", () => ({
  getSoloGameState: jest.fn(),
}))

jest.spyOn(console, "log").mockImplementation(() => {})
jest.spyOn(console, "error").mockImplementation(() => {})

describe("/api/game/[gameId] (統合ルート)", () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("GET", () => {
    it("マルチプレイゲームの状態を返す", async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: "g1",
        status: "PLAYING",
        roomCode: "RC",
        sessionId: "s1",
        createdAt: new Date(),
        startedAt: new Date(),
        endedAt: null,
        settings: { initialPoints: 25000 },
        participants: [
          {
            playerId: "p1",
            position: 0,
            currentPoints: 25000,
            isReach: false,
            player: { name: "A" },
          },
        ],
      } as unknown as any)

      const { req } = createMocks({ method: "GET" })
      const res = await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.gameInfo.gameMode).toBe("MULTIPLAYER")
      expect(body.data.gameState.players[0].name).toBe("A")
    })

    it("ソロゲームの状態を返す", async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null as unknown as any)
      mockPrisma.soloGame.findUnique.mockResolvedValue({
        id: "sg1",
        status: "WAITING",
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
        gameType: "HANCHAN",
        initialPoints: 25000,
        currentRound: 1,
        honba: 0,
        players: [{ position: 0, name: "You" }],
      } as unknown as any)
      ;(soloManager.getSoloGameState as jest.Mock).mockResolvedValue({
        gameId: "sg1",
        players: [{ position: 0, name: "You", points: 25000, isReach: false }],
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
        status: "WAITING",
      })

      const { req } = createMocks({ method: "GET" })
      const res = await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "sg1" }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.gameInfo.gameMode).toBe("SOLO")
      expect(body.data.gameState.gameMode).toBe("SOLO")
    })

    it("見つからない場合は404", async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null as unknown as any)
      mockPrisma.soloGame.findUnique.mockResolvedValue(null as unknown as any)
      const { req } = createMocks({ method: "GET" })
      const res = await GET(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "x" }),
      })
      const body = await res.json()
      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("GAME_NOT_FOUND")
    })
  })

  describe("PATCH", () => {
    it("マルチプレイに対しては400 (INVALID_ACTION)", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue(null as unknown as any)
      mockPrisma.game.findUnique.mockResolvedValue({ id: "g1" } as any)
      const { req } = createMocks({
        method: "PATCH",
        json: () => ({ action: "start" }),
      })
      const res = await PATCH(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })
      const body = await res.json()
      expect(res.status).toBe(400)
      expect(body.error.code).toBe("INVALID_ACTION")
    })

    it("ソロゲーム開始で成功レスポンス", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue({
        id: "sg1",
        players: [],
      } as unknown as any)
      ;(soloManager.getSoloGameState as jest.Mock).mockResolvedValue({
        gameId: "sg1",
        players: [],
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
        status: "PLAYING",
      })

      const { req } = createMocks({
        method: "PATCH",
        json: () => ({ action: "start" }),
      })
      const res = await PATCH(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "sg1" }),
      })
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it("ソロゲーム終了でリザルト計算して成功", async () => {
      mockPrisma.soloGame.findUnique.mockResolvedValue({
        id: "sg1",
        currentRound: 1,
        honba: 0,
        initialPoints: 25000,
        players: [
          { position: 0, name: "A", currentPoints: 26000 },
          { position: 1, name: "B", currentPoints: 25000 },
          { position: 2, name: "C", currentPoints: 24000 },
          { position: 3, name: "D", currentPoints: 25000 },
        ],
      } as unknown as any)

      const { req } = createMocks({
        method: "PATCH",
        json: () => ({ action: "finish" }),
      })
      const res = await PATCH(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "sg1" }),
      })
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data.results)).toBe(true)
    })
  })

  describe("POST 強制終了", () => {
    it("マルチプレイの強制終了が成功", async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: "g1",
        status: "PLAYING",
        currentRound: 1,
        honba: 0,
        participants: [
          { playerId: "p1", position: 0, currentPoints: 25000 },
          { playerId: "p2", position: 1, currentPoints: 25000 },
          { playerId: "p3", position: 2, currentPoints: 25000 },
          { playerId: "p4", position: 3, currentPoints: 25000 },
        ],
      } as unknown as any)

      const { req } = createMocks({
        method: "POST",
        json: () => ({ reason: "test" }),
      })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.gameMode).toBe("MULTIPLAYER")
    })

    it("ソロの強制終了が成功", async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null as unknown as any)
      mockPrisma.soloGame.findUnique.mockResolvedValue({
        id: "sg1",
        status: "PLAYING",
        currentRound: 1,
        honba: 0,
        initialPoints: 25000,
        players: [
          { position: 0, name: "A", currentPoints: 26000, id: "sp1" },
          { position: 1, name: "B", currentPoints: 24000, id: "sp2" },
          { position: 2, name: "C", currentPoints: 25000, id: "sp3" },
          { position: 3, name: "D", currentPoints: 25000, id: "sp4" },
        ],
      } as unknown as any)

      const { req } = createMocks({ method: "POST", json: () => ({}) })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "sg1" }),
      })
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.gameMode).toBe("SOLO")
    })
  })
})
