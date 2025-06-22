import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // データベース接続テスト
    const playerCount = await prisma.player.count()
    const scorePatternCount = await prisma.scorePattern.count()
    
    return NextResponse.json({
      status: 'healthy',
      database: {
        connected: true,
        players: playerCount,
        scorePatterns: scorePatternCount
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}