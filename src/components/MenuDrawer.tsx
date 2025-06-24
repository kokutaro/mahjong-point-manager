'use client'

import { useRouter } from 'next/navigation'

interface MenuDrawerProps {
  isOpen: boolean
  onClose: () => void
  onShowHistory: () => void
}

export default function MenuDrawer({ isOpen, onClose, onShowHistory }: MenuDrawerProps) {
  const router = useRouter()
  
  if (!isOpen) return null

  const handleHistory = () => {
    onShowHistory()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black bg-opacity-50" onClick={onClose} />
      <div className="w-64 bg-white shadow-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">メニュー</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <ul className="space-y-2">
          <li>
            <button onClick={handleHistory} className="w-full text-left px-2 py-2 rounded hover:bg-gray-100">
              📋 セッション履歴
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
