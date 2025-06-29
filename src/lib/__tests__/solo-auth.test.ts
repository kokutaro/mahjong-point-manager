import { authenticatePlayer, createAuthErrorResponse } from "../solo/auth"
import { NextRequest } from "next/server"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    player: { findUnique: jest.fn() },
  },
}))

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}))

import { prisma as mockPrisma } from "@/lib/prisma"
import { cookies as mockCookies } from "next/headers"

function createRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost", { headers })
}

describe("authenticatePlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("returns UNAUTHORIZED when no player id", async () => {
    mockCookies.mockReturnValue({ get: () => undefined })

    const req = createRequest()
    const result = await authenticatePlayer(req)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("UNAUTHORIZED")
  })

  test("returns PLAYER_NOT_FOUND when player missing", async () => {
    mockCookies.mockReturnValue({ get: () => ({ value: "p1" }) })
    mockPrisma.player.findUnique.mockResolvedValue(null)

    const req = createRequest()
    const result = await authenticatePlayer(req)

    expect(mockPrisma.player.findUnique).toHaveBeenCalledWith({
      where: { id: "p1" },
    })
    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("PLAYER_NOT_FOUND")
  })

  test("returns player info when found via header", async () => {
    mockCookies.mockReturnValue({ get: () => undefined })
    const player = {
      id: "p2",
      name: "Taro",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.player.findUnique.mockResolvedValue(player)

    const req = createRequest({ "x-player-id": "p2" })
    const result = await authenticatePlayer(req)

    expect(result.success).toBe(true)
    expect(result.playerId).toBe("p2")
    expect(result.player).toEqual(player)
  })
})

describe("createAuthErrorResponse", () => {
  test("wraps error", () => {
    const res = createAuthErrorResponse({
      success: false,
      error: { code: "UNAUTHORIZED", message: "ng" },
    })
    expect(res).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "ng" },
    })
  })
})
