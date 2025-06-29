import { POST } from "../route"
import { NextRequest } from "next/server"
import { createMocks } from "node-mocks-http"
import { cookies } from "next/headers"

const mockSet = jest.fn()

jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({ set: mockSet })),
}))

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("clears cookies and returns success", async () => {
    const { req } = createMocks({ method: "POST" })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockSet).toHaveBeenNthCalledWith(1, "session_token", "", {
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 0,
    })
    expect(mockSet).toHaveBeenNthCalledWith(2, "player_id", "", {
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 0,
    })
  })

  it("returns 500 on failure", async () => {
    ;(cookies as jest.Mock).mockImplementationOnce(() => {
      throw new Error("fail")
    })
    const { req } = createMocks({ method: "POST" })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.message).toBe("ログアウトに失敗しました")
  })
})
