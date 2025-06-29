"use client"

import { useState } from "react"

interface ForceEndConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  sessionName?: string
  isLoading?: boolean
}

export default function ForceEndConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  sessionName,
  isLoading = false,
}: ForceEndConfirmModalProps) {
  const [reason, setReason] = useState("")
  const [customReason, setCustomReason] = useState("")

  const predefinedReasons = [
    "ホストによる終了",
    "時間切れ",
    "技術的問題",
    "プレイヤー都合",
    "その他",
  ]

  const handleConfirm = () => {
    const finalReason = reason === "その他" ? customReason.trim() : reason
    if (finalReason) {
      onConfirm(finalReason)
      // モーダルを閉じるのは親コンポーネントで処理
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setReason("")
      setCustomReason("")
      onClose()
    }
  }

  const isConfirmDisabled =
    !reason || (reason === "その他" && !customReason.trim()) || isLoading

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            セッション強制終了の確認
          </h3>

          <div className="mb-6">
            <p className="text-gray-600 mb-3">
              {sessionName ? (
                <>
                  セッション「<span className="font-medium">{sessionName}</span>
                  」を強制終了しますか？
                </>
              ) : (
                "このセッションを強制終了しますか？"
              )}
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-yellow-800 text-sm flex items-start">
                <span className="text-yellow-600 mr-2 mt-0.5">⚠️</span>
                この操作は取り消せません。全てのプレイヤーがセッションから退出します。
              </p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              終了理由を選択してください <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">理由を選択してください...</option>
              {predefinedReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {reason === "その他" && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="詳細な理由を入力してください"
                disabled={isLoading}
                maxLength={100}
                className="w-full mt-2 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed"
            >
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  処理中...
                </>
              ) : (
                "強制終了"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
