'use client'

import React from 'react'

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  qrCodeData?: string
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, qrCodeData }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">QRコード</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="text-center">
          {qrCodeData ? (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">QRコードで共有</p>
              <div className="bg-gray-100 p-4 rounded">
                {/* QRコード表示エリア - 実装予定 */}
                <div className="w-48 h-48 mx-auto bg-gray-200 flex items-center justify-center">
                  QRコード
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">QRコードデータがありません</p>
          )}
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

export default QRCodeModal