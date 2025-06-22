'use client'

import { useState, useEffect } from 'react'

export interface ErrorInfo {
  type: 'network' | 'validation' | 'server' | 'websocket' | 'general'
  message: string
  details?: string
  isRetryable?: boolean
  autoHide?: boolean
  duration?: number
}

interface ErrorDisplayProps {
  error: ErrorInfo | string | null
  onRetry?: () => void
  onDismiss?: () => void
  isReconnecting?: boolean
  reconnectTimeLeft?: number
}

export default function ErrorDisplay({ 
  error, 
  onRetry, 
  onDismiss,
  isReconnecting = false,
  reconnectTimeLeft = 0
}: ErrorDisplayProps) {
  const [isVisible, setIsVisible] = useState(false)
  
  // エラー情報の正規化
  const errorInfo: ErrorInfo | null = error ? (
    typeof error === 'string' 
      ? { type: 'general', message: error }
      : error
  ) : null

  useEffect(() => {
    if (errorInfo) {
      setIsVisible(true)
      
      // 自動非表示の設定
      if (errorInfo.autoHide) {
        const timer = setTimeout(() => {
          setIsVisible(false)
          onDismiss?.()
        }, errorInfo.duration || 5000)
        
        return () => clearTimeout(timer)
      }
    } else {
      setIsVisible(false)
    }
  }, [errorInfo, onDismiss])

  if (!errorInfo || !isVisible) return null

  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'network':
      case 'websocket':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        )
      case 'validation':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )
      case 'server':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getErrorColor = (type: string) => {
    switch (type) {
      case 'network':
      case 'websocket':
        return 'border-orange-200 bg-orange-50 text-orange-800'
      case 'validation':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800'
      case 'server':
        return 'border-red-200 bg-red-50 text-red-800'
      default:
        return 'border-red-200 bg-red-50 text-red-800'
    }
  }

  const getErrorTitle = (type: string) => {
    switch (type) {
      case 'network':
        return 'ネットワークエラー'
      case 'websocket':
        return '接続エラー'
      case 'validation':
        return '入力エラー'
      case 'server':
        return 'サーバーエラー'
      default:
        return 'エラー'
    }
  }

  return (
    <div className={`border rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 ${getErrorColor(errorInfo.type)}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3">
          {getErrorIcon(errorInfo.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">
              {getErrorTitle(errorInfo.type)}
            </h3>
            
            {/* 閉じるボタン */}
            {onDismiss && (
              <button
                onClick={() => {
                  setIsVisible(false)
                  onDismiss()
                }}
                className="ml-2 text-current hover:opacity-70 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <div className="text-sm mb-3">
            {errorInfo.message}
          </div>
          
          {/* 詳細情報 */}
          {errorInfo.details && (
            <div className="text-xs opacity-75 mb-3 font-mono bg-black bg-opacity-10 p-2 rounded">
              {errorInfo.details}
            </div>
          )}
          
          {/* 再接続中の表示 */}
          {isReconnecting && (
            <div className="text-sm mb-3 flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              再接続中...
              {reconnectTimeLeft > 0 && (
                <span className="ml-2">({reconnectTimeLeft}秒後)</span>
              )}
            </div>
          )}
          
          {/* アクションボタン */}
          <div className="flex flex-wrap gap-2">
            {/* 再試行ボタン */}
            {errorInfo.isRetryable && onRetry && (
              <button
                onClick={onRetry}
                disabled={isReconnecting}
                className="px-3 py-1.5 bg-white bg-opacity-70 hover:bg-opacity-90 rounded text-xs font-medium border border-current border-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isReconnecting ? '再接続中...' : '再試行'}
              </button>
            )}
            
            {/* リロードボタン */}
            {errorInfo.type === 'server' && (
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-white bg-opacity-70 hover:bg-opacity-90 rounded text-xs font-medium border border-current border-opacity-30 transition-all"
              >
                ページを再読み込み
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}