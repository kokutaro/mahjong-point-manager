import { GET } from "../websocket-status/route"
import { NextRequest } from "next/server"

describe("GET /api/websocket-status", () => {
  function createRequest() {
    return new NextRequest("http://localhost", {
      headers: { host: "localhost", origin: "test", "user-agent": "jest" },
    })
  }

  it("reports status when socketio initialized", async () => {
    ;(process as any).__socketio = {}
    const res = await GET(createRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.status.websocketInitialized).toBe(true)
    expect(data.message).toMatch(/initialized/)
  })

  it("reports not found when socketio missing", async () => {
    ;(process as any).__socketio = undefined
    const res = await GET(createRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.status.websocketInitialized).toBe(false)
    expect(data.message).toMatch(/not found/)
  })
})
