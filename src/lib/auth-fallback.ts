// Safari/iPhoneでクッキーが機能しない場合のフォールバック機能

interface SessionData {
  playerId: string
  sessionToken: string
  expiresAt: number
}

export class AuthFallback {
  private static readonly STORAGE_KEY = 'mahjong_session'
  private static readonly COOKIE_TEST_KEY = 'cookie_test'

  // クッキーサポートをテスト
  static isCookieSupported(): boolean {
    try {
      // テストクッキーを設定
      document.cookie = `${this.COOKIE_TEST_KEY}=test; path=/; max-age=1`
      
      // 設定されたかチェック
      const supported = document.cookie.includes(`${this.COOKIE_TEST_KEY}=test`)
      
      // テストクッキーを削除
      document.cookie = `${this.COOKIE_TEST_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      
      return supported
    } catch {
      return false
    }
  }

  // ブラウザタイプを検出
  static getBrowserInfo() {
    const userAgent = navigator.userAgent
    return {
      isSafari: userAgent.includes('Safari') && !userAgent.includes('Chrome'),
      isMobile: /Mobile|iPhone|iPad|Android/.test(userAgent),
      isIOS: /iPhone|iPad/.test(userAgent),
      cookieSupported: this.isCookieSupported()
    }
  }

  // セッションデータをLocalStorageに保存
  static setSession(sessionData: SessionData): void {
    try {
      const data = {
        ...sessionData,
        timestamp: Date.now()
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
      console.log('📱 Session saved to localStorage (fallback)', data)
    } catch (error) {
      console.error('Failed to save session to localStorage:', error)
    }
  }

  // セッションデータをLocalStorageから取得
  static getSession(): SessionData | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return null

      const data = JSON.parse(stored)
      
      // 有効期限チェック
      if (data.expiresAt && Date.now() > data.expiresAt) {
        this.clearSession()
        return null
      }

      return data
    } catch (error) {
      console.error('Failed to get session from localStorage:', error)
      return null
    }
  }

  // セッションをクリア
  static clearSession(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      console.log('📱 Session cleared from localStorage')
    } catch (error) {
      console.error('Failed to clear session from localStorage:', error)
    }
  }

  // セッションが有効かチェック
  static isSessionValid(): boolean {
    const session = this.getSession()
    return session !== null
  }

  // 認証APIリクエストにヘッダーを追加
  static getAuthHeaders(): Record<string, string> {
    const session = this.getSession()
    if (!session) return {}

    return {
      'X-Session-Token': session.sessionToken,
      'X-Player-Id': session.playerId
    }
  }
}

// APIリクエスト用のヘルパー関数
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const browserInfo = AuthFallback.getBrowserInfo()
  
  // Safari/モバイルでクッキーサポートがない場合、ヘッダーを追加
  let headers = { ...options.headers }
  
  if (!browserInfo.cookieSupported || browserInfo.isSafari || browserInfo.isMobile) {
    headers = {
      ...headers,
      ...AuthFallback.getAuthHeaders()
    }
    console.log('📱 Using header-based auth for', { browserInfo, headers })
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include' // クッキーも試行
  })
}