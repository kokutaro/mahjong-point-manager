"use client"

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react"
import { AuthFallback, fetchWithAuth } from "@/lib/auth-fallback"

interface AuthUser {
  playerId: string
  name: string
  deviceId?: string
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (name: string, deviceId?: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = !!user

  // 初期化時に既存セッションをチェック
  useEffect(() => {
    checkExistingSession()
  }, [])

  const checkExistingSession = async () => {
    try {
      // ブラウザ情報を取得
      const browserInfo = AuthFallback.getBrowserInfo()
      console.log("🔍 Browser info:", browserInfo)

      // フォールバック機能でセッションをチェック
      const fallbackSession = AuthFallback.getSession()
      console.log("🔍 Fallback session:", fallbackSession)

      // 認証対応のfetchを使用
      const response = await fetchWithAuth("/api/auth/player", {
        method: "GET",
      })

      if (response.ok) {
        const data = await response.json()
        console.log("🔍 Auth response:", data)

        if (data.success) {
          setUser(data.data)

          // Safari/モバイルの場合、LocalStorageにも保存
          if (
            !browserInfo.cookieSupported ||
            browserInfo.isSafari ||
            browserInfo.isMobile
          ) {
            AuthFallback.setSession({
              playerId: data.data.playerId,
              sessionToken:
                data.data.sessionToken || fallbackSession?.sessionToken || "",
              expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24時間
            })
          }
        }
      } else {
        // 認証失敗時はフォールバックセッションをクリア
        AuthFallback.clearSession()
      }
    } catch (error) {
      console.error("Session check failed:", error)
      AuthFallback.clearSession()
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (name: string, deviceId?: string) => {
    try {
      setIsLoading(true)
      setError(null)

      // デバイスIDを取得または生成
      const storedDeviceId =
        deviceId || localStorage.getItem("mahjong_device_id")
      let finalDeviceId = storedDeviceId

      if (!finalDeviceId) {
        finalDeviceId = generateDeviceId()
        localStorage.setItem("mahjong_device_id", finalDeviceId)
      }

      const response = await fetch("/api/auth/player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          deviceId: finalDeviceId,
        }),
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || "ログインに失敗しました")
      }

      if (data.success) {
        setUser(data.data)

        console.log("✅ Login successful:", data)

        // Safari/モバイルの場合、LocalStorageにセッション保存
        const browserInfo = AuthFallback.getBrowserInfo()
        if (
          !browserInfo.cookieSupported ||
          browserInfo.isSafari ||
          browserInfo.isMobile
        ) {
          AuthFallback.setSession({
            playerId: data.data.playerId,
            sessionToken: data.data.sessionToken,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24時間
          })
          console.log(
            "📱 Session saved to localStorage for browser compatibility"
          )
        }

        // デバイスIDを更新
        localStorage.setItem("mahjong_device_id", data.data.deviceId)
      } else {
        throw new Error(data.error?.message || "ログインに失敗しました")
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "ログインに失敗しました"
      setError(errorMessage)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // フォールバック認証を使用してログアウト
      await fetchWithAuth("/api/auth/logout", {
        method: "POST",
      })

      // LocalStorageのセッションもクリア
      AuthFallback.clearSession()
      setUser(null)

      console.log("✅ Logout successful")
    } catch (error) {
      console.error("Logout failed:", error)
      // エラーでもローカルセッションはクリア
      AuthFallback.clearSession()
      setUser(null)
      setError("ログアウトに失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  const refreshAuth = async () => {
    try {
      setError(null)
      await checkExistingSession()
    } catch (error) {
      console.error("Auth refresh failed:", error)
      setError("認証情報の更新に失敗しました")
    }
  }

  const generateDeviceId = (): string => {
    return (
      "device_" +
      Math.random().toString(36).substring(2, 11) +
      Date.now().toString(36)
    )
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshAuth,
    error,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// 認証が必要なコンポーネント用のHOC
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth()

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">読み込み中...</div>
        </div>
      )
    }

    if (!isAuthenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">ログインが必要です</div>
        </div>
      )
    }

    return <Component {...props} />
  }
}
