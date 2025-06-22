'use client'

import MatchHistoryTable from './MatchHistoryTable'
import { MatchResult } from '@/hooks/useMatchHistory'

interface MatchHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  history: MatchResult[]
}

export default function MatchHistoryModal({ isOpen, onClose, history }: MatchHistoryModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">対局履歴</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <MatchHistoryTable history={history} />
      </div>
    </div>
  )
}
