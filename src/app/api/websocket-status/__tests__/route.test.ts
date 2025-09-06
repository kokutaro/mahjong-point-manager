import { GET } from "@/app/api/websocket-status/route"
import { NextRequest } from "next/server"

declare global {
  // テスト用: process に __socketio を追加
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      __socketio?: object
    }
  }
}

describe("/api/websocket-status GET", () => {
  test("WebSocket 初期化有無に関わらず成功レスポンスを返す", async () => {
    // ヘッダー付きの NextRequest を生成
    const req = new NextRequest("http://localhost/api/websocket-status", {
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "user-agent": "jest",
      },
    })

    // 成功パス（socketio あり）
    process.__socketio = {}
    const res1 = await GET(req)
    const body1 = await res1.json()
    expect(res1.status).toBe(200)
    expect(body1.success).toBe(true)
    expect(body1.status).toBeDefined()

    // 成功パス（socketio なし）
    delete process.__socketio
    const res2 = await GET(req)
    const body2 = await res2.json()
    expect(res2.status).toBe(200)
    expect(body2.success).toBe(true)
    expect(body2.status.websocketInitialized).toBe(false)
  })
})
