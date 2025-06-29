"use client"

import { useState, useEffect } from "react"

interface GameEndScreenProps {
  gameType: "TONPUU" | "HANCHAN"
  endReason: string
  onShowResult: () => void
}

export default function GameEndScreen({
  gameType,
  endReason,
  onShowResult,
}: GameEndScreenProps) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // 次のレンダーサイクルで実行するためにsetTimeoutを使用
          setTimeout(() => onShowResult(), 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [onShowResult])

  const handleShowResult = () => {
    // 次のレンダーサイクルで実行するためにsetTimeoutを使用
    setTimeout(() => onShowResult(), 0)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 max-w-md w-full text-center">
        {/* 終了アイコン */}
        <div className="mb-4 sm:mb-6">
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 sm:w-8 sm:h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* 終了メッセージ */}
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
          対局終了
        </h2>

        <p className="text-base sm:text-lg text-gray-600 mb-2">
          {gameType === "TONPUU" ? "東風戦" : "半荘戦"}が終了しました
        </p>

        <p className="text-sm text-gray-500 mb-4 sm:mb-6">{endReason}</p>

        {/* カウントダウンボタン */}
        <button
          onClick={handleShowResult}
          className="w-full bg-blue-600 text-white py-4 px-4 sm:py-3 sm:px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-semibold text-base sm:text-lg"
        >
          {countdown > 0 ? <>結果を見る ({countdown}秒)</> : "結果を見る"}
        </button>

        <p className="text-xs text-gray-400 mt-2 sm:mt-3">
          {countdown > 0
            ? `${countdown}秒後に自動的に結果画面に移動します`
            : ""}
        </p>
      </div>
    </div>
  )
}
