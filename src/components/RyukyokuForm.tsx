'use client'

import { useState, memo } from 'react'
import { Modal, Stepper, Button as MantineButton } from '@mantine/core'

interface GamePlayer {
  playerId: string
  name: string
  position: number
  points: number
  isReach: boolean
  isConnected: boolean
}

interface RyukyokuFormProps {
  players: GamePlayer[]
  onSubmit: (tenpaiPlayers: string[]) => void
  onCancel: () => void
}

const RyukyokuForm = memo(function RyukyokuForm({
  players,
  onSubmit,
  onCancel
}: RyukyokuFormProps) {
  const [step, setStep] = useState(0)
  const [tenpaiMap, setTenpaiMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(players.map(p => [p.playerId, false]))
  )

  const toggleTenpai = (playerId: string) => {
    setTenpaiMap(prev => ({ ...prev, [playerId]: !prev[playerId] }))
  }

  const tenpaiPlayers = Object.keys(tenpaiMap).filter(pid => tenpaiMap[pid])

  const tenpaiCount = tenpaiPlayers.length
  const notenCount = players.length - tenpaiCount

  const receive =
    tenpaiCount > 0 && tenpaiCount < players.length
      ? Math.floor(3000 / tenpaiCount)
      : 0
  const pay =
    tenpaiCount > 0 && tenpaiCount < players.length
      ? Math.floor(3000 / notenCount)
      : 0

  return (
    <Modal opened onClose={onCancel} withCloseButton={false} centered>
      <h2 className="text-lg font-semibold mb-4">流局処理</h2>
      <Stepper active={step} allowNextStepsSelect={false} orientation="vertical">
        <Stepper.Step label="聴牌入力">
          <div className="space-y-2 mt-4">
            {players.map(p => (
              <div key={p.playerId} className="flex items-center justify-between">
                <span>{p.name}</span>
                <MantineButton
                  color={tenpaiMap[p.playerId] ? 'blue' : 'gray'}
                  onClick={() => toggleTenpai(p.playerId)}
                >
                  {tenpaiMap[p.playerId] ? '聴牌' : 'ノーテン'}
                </MantineButton>
              </div>
            ))}
          </div>
          <MantineButton className="mt-4" fullWidth onClick={() => setStep(1)}>
            確認
          </MantineButton>
        </Stepper.Step>
        <Stepper.Step label="確認">
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm text-gray-700 mt-4">
            <div>
              テンパイ者: {tenpaiPlayers.map(pid => players.find(p => p.playerId === pid)?.name).join('、') || 'なし'}
            </div>
            {tenpaiCount > 0 && tenpaiCount < players.length && (
              <div>
                聴牌者受取: {receive}点 / ノーテン者支払: {pay}点
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <MantineButton variant="default" onClick={() => setStep(0)} fullWidth>
              戻る
            </MantineButton>
            <MantineButton onClick={() => onSubmit(tenpaiPlayers)} fullWidth>
              支払い
            </MantineButton>
          </div>
        </Stepper.Step>
      </Stepper>
    </Modal>
  )
})

export default RyukyokuForm
