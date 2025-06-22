import { NextRequest } from 'next/server'
import { initSocket } from '@/lib/socket'

export async function GET(request: NextRequest) {
  // Socket.IOサーバーの起動は server.js で行うため、
  // このエンドポイントは接続確認用
  return Response.json({
    status: 'WebSocket server ready',
    port: process.env.SOCKET_IO_PORT || 3001
  })
}