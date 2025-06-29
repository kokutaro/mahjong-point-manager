"use client"

import { useEffect, useState } from "react"

interface AlertModalProps {
  isOpen: boolean
  message: string
  onConfirm: () => void
  confirmLabel?: string
  countdownSeconds?: number
}

export default function AlertModal({
  isOpen,
  message,
  onConfirm,
  confirmLabel = "OK",
  countdownSeconds,
}: AlertModalProps) {
  const [countdown, setCountdown] = useState(countdownSeconds ?? 0)

  useEffect(() => {
    if (!isOpen || countdownSeconds == null) return
    setCountdown(countdownSeconds)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isOpen, countdownSeconds])

  useEffect(() => {
    if (isOpen && countdownSeconds != null && countdown === 0) {
      onConfirm()
    }
  }, [isOpen, countdownSeconds, countdown, onConfirm])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full text-center">
        <p className="text-gray-700 whitespace-pre-line mb-6">{message}</p>
        <button
          onClick={onConfirm}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          {countdownSeconds != null && countdown > 0
            ? `${confirmLabel} (${countdown}秒)`
            : confirmLabel}
        </button>
      </div>
    </div>
  )
}
