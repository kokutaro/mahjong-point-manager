"use client"

import YakuHelp from "@/components/help/YakuHelp"

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function YakuHelpModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">ヘルプ</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            aria-label="ヘルプを閉じる"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-6">
          <YakuHelp />
        </div>
      </div>
    </div>
  )
}
