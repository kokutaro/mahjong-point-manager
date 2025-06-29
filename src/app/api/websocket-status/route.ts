import { NextRequest, NextResponse } from "next/server"

// プロセスの型拡張（他のファイルで既に定義済み）

export async function GET(request: NextRequest) {
  try {
    // WebSocketサーバーの状態をチェック
    const socketio = process.__socketio

    const status = {
      websocketInitialized: !!socketio,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      socketioVersion: socketio ? "Available" : "Not Available",
      serverInfo: {
        hostname: process.env.HOSTNAME || "localhost",
        port: process.env.PORT || "3000",
        nextauthUrl: process.env.NEXTAUTH_URL,
      },
      headers: {
        host: request.headers.get("host"),
        origin: request.headers.get("origin"),
        userAgent: request.headers.get("user-agent"),
        upgrade: request.headers.get("upgrade"),
        connection: request.headers.get("connection"),
      },
    }

    return NextResponse.json({
      success: true,
      status,
      message: socketio
        ? "WebSocket server is initialized"
        : "WebSocket server not found - check server.js initialization",
    })
  } catch (error) {
    console.error("WebSocket status check error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check WebSocket status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
