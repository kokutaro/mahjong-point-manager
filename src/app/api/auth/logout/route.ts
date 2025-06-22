import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    
    // セッションCookieを削除
    cookieStore.delete('session_token')
    cookieStore.delete('player_id')

    return NextResponse.json({
      success: true,
      message: 'ログアウトしました'
    })

  } catch (error) {
    console.error('Logout failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: 'ログアウトに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}