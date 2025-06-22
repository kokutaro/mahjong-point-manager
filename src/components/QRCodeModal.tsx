'use client'

import { Modal } from '@mantine/core'
import { QRCodeSVG } from 'qrcode.react'

interface QRCodeModalProps {
  opened: boolean
  onClose: () => void
  url: string
}

export function QRCodeModal({ opened, onClose, url }: QRCodeModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} centered title="参加用QRコード">
      <div className="flex justify-center p-4">
        <QRCodeSVG value={url} size={256} />
      </div>
    </Modal>
  )
}
