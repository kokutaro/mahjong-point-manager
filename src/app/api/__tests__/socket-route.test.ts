import { GET } from "../socket/route"

describe("GET /api/socket", () => {
  it("returns status and port", async () => {
    process.env.SOCKET_IO_PORT = "1234"
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      status: "WebSocket server ready",
      port: "1234",
    })
  })
})
