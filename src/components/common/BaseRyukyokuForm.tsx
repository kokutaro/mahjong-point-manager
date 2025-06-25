'use client'

import { useState, memo } from 'react'
import { Modal, Stepper, Button as MantineButton } from '@mantine/core'
import {
  BasePlayerState,
  BaseRyukyokuFormProps
} from './types'

// 汎用化されたRyukyokuForm
function BaseRyukyokuForm<TPlayer extends BasePlayerState>({
  players,
  mode,
  onSubmit,
  onCancel
}: BaseRyukyokuFormProps<TPlayer>) {
  const [step, setStep] = useState(0)
  const [tenpaiMap, setTenpaiMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(players.map(p => [p.id, false]))
  )

  const toggleTenpai = (playerId: string) => {
    setTenpaiMap(prev => ({ ...prev, [playerId]: !prev[playerId] }))
  }

  const tenpaiPlayerIds = Object.keys(tenpaiMap).filter(pid => tenpaiMap[pid])

  const tenpaiCount = tenpaiPlayerIds.length
  const notenCount = players.length - tenpaiCount

  const receive =
    tenpaiCount > 0 && tenpaiCount < players.length
      ? Math.floor(3000 / tenpaiCount)
      : 0
  const pay =
    tenpaiCount > 0 && tenpaiCount < players.length
      ? Math.floor(3000 / notenCount)
      : 0

  const handleSubmit = async () => {
    try {
      await onSubmit(tenpaiPlayerIds)
    } catch (error) {
      console.error('Ryukyoku submission failed:', error)
    }
  }

  return (
    <Modal opened onClose={onCancel} withCloseButton={false} centered>
      <h2 className="text-lg font-semibold mb-4">流局処理</h2>
      <Stepper active={step} allowNextStepsSelect={false} orientation="vertical">
        <Stepper.Step label="聴牌入力">
          <div className="space-y-2 mt-4">
            {players.map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <span>{p.name}</span>
                <MantineButton
                  color={tenpaiMap[p.id] ? 'blue' : 'gray'}
                  onClick={() => toggleTenpai(p.id)}
                >
                  {tenpaiMap[p.id] ? '聴牌' : 'ノーテン'}
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
              テンパイ者: {tenpaiPlayerIds.map(pid => players.find(p => p.id === pid)?.name).join('、') || 'なし'}
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
            <MantineButton onClick={handleSubmit} fullWidth>
              支払い
            </MantineButton>
          </div>
        </Stepper.Step>
      </Stepper>
    </Modal>
  )
}

export default memo(BaseRyukyokuForm) as typeof BaseRyukyokuForm