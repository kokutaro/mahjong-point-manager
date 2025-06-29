"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  DEFAULT_PLAYER_NAMES,
  DEFAULT_INITIAL_POINTS,
  DEFAULT_GAME_TYPE,
  CreateSoloGameInput,
  validatePlayerNames,
  validatePlayerPositions,
} from "@/schemas/solo"
import { DEFAULT_UMA_SETTINGS } from "@/schemas/common"

export default function SoloCreatePage() {
  const router = useRouter()
  const [gameType, setGameType] = useState<"TONPUU" | "HANCHAN">(
    DEFAULT_GAME_TYPE
  )
  const [initialPoints, setInitialPoints] = useState(DEFAULT_INITIAL_POINTS)
  const [basePoints, setBasePoints] = useState(30000)
  const [uma, setUma] = useState<number[]>([
    DEFAULT_UMA_SETTINGS.first,
    DEFAULT_UMA_SETTINGS.second,
    DEFAULT_UMA_SETTINGS.third,
    DEFAULT_UMA_SETTINGS.fourth,
  ])
  const [umaPreset, setUmaPreset] = useState("ワンツー")
  const [playerNames, setPlayerNames] = useState([...DEFAULT_PLAYER_NAMES])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState("")

  const handlePlayerNameChange = (index: number, name: string) => {
    const newNames = [...playerNames]
    newNames[index] = name
    setPlayerNames(newNames)
  }

  const umaPresets = {
    ゴットー: [10, 5, -5, -10],
    ワンツー: [20, 10, -10, -20],
    ワンスリー: [30, 10, -10, -30],
  }

  const handleUmaPresetChange = (preset: string) => {
    setUmaPreset(preset)
    if (preset !== "カスタム") {
      setUma(umaPresets[preset as keyof typeof umaPresets])
    }
  }

  const handleUmaChange = (index: number, value: number) => {
    const newUma = [...uma]
    newUma[index] = value
    setUma(newUma)
    setUmaPreset("カスタム") // 手動変更時はカスタムに切り替え
  }

  const handleCreateGame = async () => {
    try {
      setIsCreating(true)
      setError("")

      // プレイヤーデータの準備
      const players = playerNames.map((name, index) => ({
        position: index,
        name: name.trim() || DEFAULT_PLAYER_NAMES[index],
      }))

      // バリデーション
      if (!validatePlayerNames(players)) {
        setError("プレイヤー名が重複しています")
        return
      }

      if (!validatePlayerPositions(players.map((p) => p.position))) {
        setError("プレイヤーの位置が無効です")
        return
      }

      const gameData: CreateSoloGameInput = {
        gameType,
        initialPoints,
        basePoints,
        uma,
        players,
      }

      const response = await fetch("/api/solo/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gameData),
        credentials: "include",
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || "ゲーム作成に失敗しました")
      }

      if (result.success) {
        // ゲーム画面に遷移
        router.push(`/solo/game/${result.data.gameId}`)
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "ゲーム作成に失敗しました"
      )
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              一人プレイゲーム作成
            </h1>
            <p className="text-gray-600">
              4人分の点数を管理する麻雀ゲームを開始します
            </p>
          </div>

          {/* ゲーム設定 */}
          <div className="space-y-6">
            {/* ゲームタイプ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ゲームタイプ
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setGameType("TONPUU")}
                  className={`p-3 rounded-md border-2 transition-all ${
                    gameType === "TONPUU"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  東風戦
                </button>
                <button
                  onClick={() => setGameType("HANCHAN")}
                  className={`p-3 rounded-md border-2 transition-all ${
                    gameType === "HANCHAN"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  半荘戦
                </button>
              </div>
            </div>

            {/* 初期点数 */}
            <div>
              <label
                htmlFor="initialPoints"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                初期点数
              </label>
              <select
                id="initialPoints"
                value={initialPoints}
                onChange={(e) => setInitialPoints(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value={25000}>25,000点</option>
                <option value={30000}>30,000点</option>
                <option value={35000}>35,000点</option>
              </select>
            </div>

            {/* 返し点 */}
            <div>
              <label
                htmlFor="basePoints"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                返し点（基準点）
              </label>
              <select
                id="basePoints"
                value={basePoints}
                onChange={(e) => setBasePoints(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value={25000}>25,000点</option>
                <option value={30000}>30,000点</option>
                <option value={35000}>35,000点</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                精算計算の基準となる点数
              </p>
            </div>

            {/* ウマ設定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                ウマ設定
              </label>

              {/* プリセット選択 */}
              <div className="mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.keys(umaPresets).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleUmaPresetChange(preset)}
                      className={`p-3 rounded-lg border-2 text-sm transition-colors ${
                        umaPreset === preset
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <div className="font-semibold">{preset}</div>
                      <div className="text-xs text-gray-500">
                        {umaPresets[preset as keyof typeof umaPresets].join(
                          ","
                        )}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleUmaPresetChange("カスタム")}
                    className={`p-3 rounded-lg border-2 text-sm transition-colors ${
                      umaPreset === "カスタム"
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-semibold">カスタム</div>
                    <div className="text-xs text-gray-500">手動設定</div>
                  </button>
                </div>
              </div>

              {/* 詳細設定 */}
              <div className="grid grid-cols-4 gap-2">
                {["1位", "2位", "3位", "4位"].map((rank, index) => (
                  <div key={rank}>
                    <label className="block text-xs text-gray-500 mb-1">
                      {rank}
                    </label>
                    <input
                      type="number"
                      value={uma[index]}
                      onChange={(e) =>
                        handleUmaChange(index, Number(e.target.value))
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* プレイヤー名設定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                プレイヤー名
              </label>
              <div className="space-y-3">
                {playerNames.map((name, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-semibold">
                      {["東", "南", "西", "北"][index]}
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) =>
                        handlePlayerNameChange(index, e.target.value)
                      }
                      placeholder={DEFAULT_PLAYER_NAMES[index]}
                      maxLength={20}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex space-x-4">
              <button
                onClick={() => router.back()}
                className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleCreateGame}
                disabled={isCreating}
                className="flex-1 bg-orange-600 text-white py-3 px-4 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? "ゲーム作成中..." : "ゲーム開始"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
