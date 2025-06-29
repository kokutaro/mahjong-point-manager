"use client"

import { useState, useEffect } from "react"
import { AuthFallback } from "@/lib/auth-fallback"

interface BrowserInfo {
  isSafari: boolean
  isMobile: boolean
  isIOS: boolean
  cookieSupported: boolean
  fallbackSession?: {
    playerId: string
  }
}

interface WebSocketStatus {
  websocketInitialized: boolean
  environment: string
  timestamp: string
  socketioVersion: string
  serverInfo: {
    hostname: string
    port: string
    nextauthUrl: string
  }
  headers: {
    host: string
    origin: string
    userAgent: string
    upgrade: string
    connection: string
  }
}

interface DebugProps {
  show?: boolean
}

export default function WebSocketDebug({ show = false }: DebugProps) {
  const [status, setStatus] = useState<WebSocketStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null)

  const checkWebSocketStatus = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/websocket-status")
      const data = await response.json()

      if (data.success) {
        setStatus(data.status)
      } else {
        setError(data.message || "WebSocket status check failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch status")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (show) {
      checkWebSocketStatus()
      // ブラウザ情報を取得
      setBrowserInfo({
        ...AuthFallback.getBrowserInfo(),
        fallbackSession: AuthFallback.getSession() || undefined,
      })
    }
  }, [show])

  if (!show) return null

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-md max-h-96 overflow-y-auto z-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-800">WebSocket Debug Info</h3>
        <button
          onClick={checkWebSocketStatus}
          disabled={loading}
          className="text-sm bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "更新中..." : "更新"}
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          Error: {error}
        </div>
      )}

      {status && (
        <div className="space-y-2 text-xs">
          <div>
            <strong>WebSocket Status:</strong>{" "}
            <span
              className={
                status.websocketInitialized ? "text-green-600" : "text-red-600"
              }
            >
              {status.websocketInitialized ? "✅ Initialized" : "❌ Not Found"}
            </span>
          </div>

          <div>
            <strong>Environment:</strong> {status.environment}
          </div>

          <div>
            <strong>Socket.IO:</strong> {status.socketioVersion}
          </div>

          <div>
            <strong>Server Info:</strong>
            <ul className="ml-2 mt-1">
              <li>
                Host: {status.serverInfo.hostname}:{status.serverInfo.port}
              </li>
              <li>Auth URL: {status.serverInfo.nextauthUrl}</li>
            </ul>
          </div>

          <div>
            <strong>Request Headers:</strong>
            <ul className="ml-2 mt-1">
              <li>Host: {status.headers.host}</li>
              <li>Origin: {status.headers.origin}</li>
              <li>Upgrade: {status.headers.upgrade || "None"}</li>
              <li>Connection: {status.headers.connection || "None"}</li>
            </ul>
          </div>

          <div>
            <strong>Current URL:</strong>
            <ul className="ml-2 mt-1">
              <li>Protocol: {window.location.protocol}</li>
              <li>Hostname: {window.location.hostname}</li>
              <li>Port: {window.location.port || "Default"}</li>
            </ul>
          </div>

          <div className="text-xs text-gray-500 mt-2">
            Last updated: {status.timestamp}
          </div>
        </div>
      )}

      {browserInfo && (
        <div className="mt-4 p-2 bg-blue-50 rounded text-xs">
          <strong>ブラウザ・認証情報:</strong>
          <ul className="ml-2 mt-1">
            <li>Safari: {browserInfo.isSafari ? "✅" : "❌"}</li>
            <li>Mobile: {browserInfo.isMobile ? "✅" : "❌"}</li>
            <li>iOS: {browserInfo.isIOS ? "✅" : "❌"}</li>
            <li>Cookie Support: {browserInfo.cookieSupported ? "✅" : "❌"}</li>
            <li>
              Fallback Session: {browserInfo.fallbackSession ? "✅" : "❌"}
            </li>
            {browserInfo.fallbackSession && (
              <li>Session Player: {browserInfo.fallbackSession.playerId}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// キーボードショートカットでデバッグパネルを表示
export function useWebSocketDebug() {
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+Shift+W でデバッグパネル表示/非表示
      if (e.ctrlKey && e.shiftKey && e.key === "W") {
        e.preventDefault()
        setShowDebug((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [])

  return { showDebug, setShowDebug }
}
