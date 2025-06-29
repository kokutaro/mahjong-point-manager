export async function GET() {
  // Socket.IOサーバーの起動は server.js で行うため、
  // このエンドポイントは接続確認用
  return Response.json({
    status: "WebSocket server ready",
    port: process.env.SOCKET_IO_PORT || 3001,
  })
}
