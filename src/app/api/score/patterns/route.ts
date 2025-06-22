import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const scorePatterns = await prisma.scorePattern.findMany({
      orderBy: [
        { han: 'asc' },
        { fu: 'asc' }
      ]
    })
    
    return NextResponse.json({
      success: true,
      data: scorePatterns
    })
  } catch (error) {
    console.error('Failed to fetch score patterns:', error)
    return NextResponse.json({
      success: false,
      error: { message: '点数パターン取得に失敗しました' }
    }, { status: 500 })
  }
}