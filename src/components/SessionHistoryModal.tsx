'use client'

import SessionHistoryTable from './SessionHistoryTable'

interface SessionHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string | null
}

export default function SessionHistoryModal({ isOpen, onClose, sessionId }: SessionHistoryModalProps) {
  if (!isOpen || !sessionId) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">セッション履歴</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ✕
          </button>
        </div>
        <div className="p-6">
          <SessionHistoryTable sessionId={sessionId} />
        </div>
      </div>
    </div>
  )
}