"use client"

import { useState, useEffect } from "react"
import { GamePlayer } from "@/hooks/useSocket"
import { getPositionName } from "@/lib/utils"

interface PointChange {
  playerId: string
  change: number
  newPoints: number
}

interface PointAnimationProps {
  players: GamePlayer[]
  pointChanges: PointChange[]
  dealerPosition: number
  onComplete: () => void
}

export default function PointAnimation({
  players,
  pointChanges,
  dealerPosition,
  onComplete,
}: PointAnimationProps) {
  const [currentPoints, setCurrentPoints] = useState<{
    [playerId: string]: number
  }>({})
  const [animationPhase, setAnimationPhase] = useState<
    "fadeIn" | "counting" | "fadeOut"
  >("fadeIn")

  useEffect(() => {
    console.log("PointAnimation component mounted", { players, pointChanges })
    // 初期点数を設定（変更前の点数）
    const initialPoints: { [playerId: string]: number } = {}
    players.forEach((player) => {
      const change = pointChanges.find((pc) => pc.playerId === player.playerId)
      if (change && change.change !== 0) {
        // 変更があった場合は変更前の点数を設定
        initialPoints[player.playerId] = change.newPoints - change.change
      } else {
        // 変更がない場合は現在の点数
        initialPoints[player.playerId] = player.points
      }
    })
    setCurrentPoints(initialPoints)

    // アニメーション開始
    const timeline = async () => {
      console.log("Starting animation timeline")
      // フェーズ1: フェードイン (200ms)
      setAnimationPhase("fadeIn")
      await new Promise((resolve) => setTimeout(resolve, 200))

      // フェーズ2: カウントアップ/ダウン (800ms)
      setAnimationPhase("counting")

      // カウントアップアニメーション
      const animationDuration = 800
      const frameRate = 60
      const totalFrames = (animationDuration / 1000) * frameRate
      let currentFrame = 0

      const animationInterval = setInterval(() => {
        currentFrame++
        const progress = currentFrame / totalFrames

        const newPoints: { [playerId: string]: number } = {}
        pointChanges.forEach((change) => {
          if (change.change !== 0) {
            const startPoints = change.newPoints - change.change
            const targetPoints = change.newPoints
            const currentValue =
              startPoints + (targetPoints - startPoints) * progress
            newPoints[change.playerId] = Math.floor(currentValue)
          } else {
            // 変化のないプレイヤーは最終点数
            newPoints[change.playerId] = change.newPoints
          }
        })

        // pointChangesにないプレイヤーの点数も保持
        players.forEach((player) => {
          if (!newPoints[player.playerId]) {
            newPoints[player.playerId] = player.points
          }
        })

        setCurrentPoints(newPoints)

        if (currentFrame >= totalFrames) {
          clearInterval(animationInterval)

          // 最終的な正確な点数を設定
          const finalPoints: { [playerId: string]: number } = {}
          pointChanges.forEach((change) => {
            finalPoints[change.playerId] = change.newPoints
          })
          players.forEach((player) => {
            if (!finalPoints[player.playerId]) {
              finalPoints[player.playerId] = player.points
            }
          })
          setCurrentPoints(finalPoints)

          // フェーズ3: フェードアウト (200ms)
          setTimeout(() => {
            setAnimationPhase("fadeOut")
            setTimeout(() => {
              onComplete()
            }, 200)
          }, 0)
        }
      }, 1000 / frameRate)
    }

    timeline()
  }, [players, pointChanges, onComplete])

  const getChangeOpacity = () => {
    switch (animationPhase) {
      case "fadeIn":
        return "opacity-100"
      case "counting":
        return "opacity-100"
      case "fadeOut":
        return "opacity-0"
      default:
        return "opacity-0"
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full mx-4">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          点数変動
        </h2>

        <div className="grid gap-4">
          {players.map((player) => {
            const change = pointChanges.find(
              (pc) => pc.playerId === player.playerId
            )
            const displayPoints =
              currentPoints[player.playerId] || player.points

            return (
              <div
                key={player.playerId}
                className="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center font-semibold text-gray-700">
                    {getPositionName(player.position, dealerPosition)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">
                      {player.name}
                    </div>
                    <div className="text-lg font-bold">
                      {displayPoints.toLocaleString()}点
                    </div>
                  </div>
                </div>

                {/* 点数変動表示 */}
                {change && change.change !== 0 && (
                  <div
                    className={`transition-opacity duration-200 ${getChangeOpacity()}`}
                  >
                    <div
                      className={`text-xl font-bold px-3 py-1 rounded ${
                        change.change > 0
                          ? "text-green-600 bg-green-100"
                          : "text-red-600 bg-red-100"
                      }`}
                    >
                      {change.change > 0 ? "+" : ""}
                      {change.change.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* プログレスバー */}
        <div className="mt-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-1200 ease-out"
              style={{
                width:
                  animationPhase === "fadeIn"
                    ? "10%"
                    : animationPhase === "counting"
                      ? "90%"
                      : "100%",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
