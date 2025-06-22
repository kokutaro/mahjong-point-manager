import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    
    // セッションCookieを削除（ネットワークアクセス対応）
    const deleteOptions = {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' as const : 'strict' as const
    }
    
    cookieStore.set('session_token', '', { ...deleteOptions, maxAge: 0 })
    cookieStore.set('player_id', '', { ...deleteOptions, maxAge: 0 })

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