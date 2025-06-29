"use client"

import { BaseRyukyokuForm } from "@/components/common"
import type { SoloGamePlayer } from "@/components/common"

interface SoloRyukyokuFormProps {
  players: SoloGamePlayer[]
  onSubmit: (tenpaiPlayerIds: string[]) => Promise<void>
  onCancel: () => void
}

export default function SoloRyukyokuForm({
  players,
  onSubmit,
  onCancel,
}: SoloRyukyokuFormProps) {
  return (
    <BaseRyukyokuForm<SoloGamePlayer>
      players={players}
      mode="solo"
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  )
}
