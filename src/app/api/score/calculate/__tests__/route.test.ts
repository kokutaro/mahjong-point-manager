import { POST } from "../route"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"
import * as scoreLib from "@/lib/score"

jest.mock("@/lib/score", () => ({
  calculateScore: jest.fn(),
  validateHanFu: jest.fn(),
}))

describe("POST /api/score/calculate", () => {
  const { calculateScore, validateHanFu } = scoreLib as jest.Mocked<
    typeof scoreLib
  >

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns calculation result when valid", async () => {
    ;(validateHanFu as jest.Mock).mockReturnValue(true)
    ;(calculateScore as jest.Mock).mockResolvedValue({ result: 8000 })
    const body = {
      han: 2,
      fu: 40,
      isOya: false,
      isTsumo: true,
      honba: 1,
      kyotaku: 0,
    }
    const { req } = createMocks({ method: "POST", json: () => body })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.input).toEqual(body)
    expect(calculateScore).toHaveBeenCalledWith(body)
  })

  it("returns 400 when han-fu invalid", async () => {
    ;(validateHanFu as jest.Mock).mockReturnValue(false)
    const body = {
      han: 1,
      fu: 20,
      isOya: false,
      isTsumo: false,
      honba: 0,
      kyotaku: 0,
    }
    const { req } = createMocks({ method: "POST", json: () => body })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.success).toBe(false)
  })

  it("returns 400 on validation error", async () => {
    const { req } = createMocks({ method: "POST", json: () => ({}) })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(400)
  })

  it("returns 500 when calculation fails", async () => {
    ;(validateHanFu as jest.Mock).mockReturnValue(true)
    ;(calculateScore as jest.Mock).mockRejectedValue(new Error("fail"))
    const body = {
      han: 3,
      fu: 30,
      isOya: true,
      isTsumo: false,
      honba: 0,
      kyotaku: 0,
    }
    const { req } = createMocks({ method: "POST", json: () => body })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.success).toBe(false)
    expect(data.error.message).toBe("点数計算に失敗しました")
  })
})
