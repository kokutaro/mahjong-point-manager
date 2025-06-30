import { prisma } from "@/lib/prisma"
import {
  calculateScore,
  ScoreCalculationInput,
  ScoreCalculationResult,
} from "@/lib/score"
import { SoloScoreCalculationInput } from "@/schemas/solo"

export interface SoloGameState {
  gameId: string
  players: SoloPlayerState[]
  currentRound: number
  currentOya: number
  honba: number
  kyotaku: number
  status: "WAITING" | "PLAYING" | "FINISHED"
}

export interface SoloPlayerState {
  position: number
  name: string
  points: number
  isReach: boolean
  reachRound?: number
}

export interface SoloScoreUpdateResult {
  gameState: SoloGameState
  scoreResult: ScoreCalculationResult
  pointChanges: { position: number; change: number }[]
}

/**
 * ソロゲームの点数計算と更新
 */
export async function updateSoloGameScore(
  gameId: string,
  scoreInput: SoloScoreCalculationInput
): Promise<SoloScoreUpdateResult> {
  const game = await prisma.soloGame.findUnique({
    where: { id: gameId },
    include: { players: true },
  })

  if (!game) {
    throw new Error("ゲームが見つかりません")
  }

  if (game.status !== "PLAYING") {
    throw new Error("ゲームが開始されていません")
  }

  // 既存の点数計算ロジックを利用
  const isOya = scoreInput.winnerId === game.currentOya
  const calculationInput: ScoreCalculationInput = {
    han: scoreInput.han,
    fu: scoreInput.fu,
    isOya,
    isTsumo: scoreInput.isTsumo,
    honba: game.honba,
    kyotaku: game.kyotaku,
  }

  const scoreResult = await calculateScore(calculationInput)

  // 点数変更を計算
  const pointChanges = calculateSoloPointChanges(
    game.players,
    scoreInput,
    scoreResult,
    isOya
  )

  // データベースを更新
  await updateSoloGameState(
    gameId,
    scoreInput,
    pointChanges,
    scoreResult,
    isOya
  )

  // 更新後のゲーム状態を取得
  const updatedGameState = await getSoloGameState(gameId)

  return {
    gameState: updatedGameState,
    scoreResult,
    pointChanges,
  }
}

/**
 * ソロゲームの点数変更を計算
 */
function calculateSoloPointChanges(
  players: Array<{
    position: number
    currentPoints: number
  }>,
  scoreInput: SoloScoreCalculationInput,
  scoreResult: ScoreCalculationResult,
  isOya: boolean
): { position: number; change: number }[] {
  const changes: { position: number; change: number }[] = []

  if (scoreInput.isTsumo) {
    // ツモの場合
    if (isOya) {
      // 親ツモ: 子3人が同額支払い
      const perKoPayment = scoreResult.payments.fromKo || 0

      players.forEach((player) => {
        if (player.position === scoreInput.winnerId) {
          // 勝者
          changes.push({
            position: player.position,
            change: perKoPayment * 3 + scoreResult.kyotakuPayment,
          })
        } else {
          // 敗者
          changes.push({
            position: player.position,
            change: -perKoPayment,
          })
        }
      })
    } else {
      // 子ツモ: 親と子で支払額が異なる
      const oyaPayment = scoreResult.payments.fromOya || 0
      const koPayment = scoreResult.payments.fromKo || 0

      players.forEach((player) => {
        if (player.position === scoreInput.winnerId) {
          // 勝者
          changes.push({
            position: player.position,
            change: oyaPayment + koPayment * 2 + scoreResult.kyotakuPayment,
          })
        } else if (player.position === 0) {
          // 親（敗者）
          changes.push({
            position: player.position,
            change: -oyaPayment,
          })
        } else {
          // 子（敗者）
          changes.push({
            position: player.position,
            change: -koPayment,
          })
        }
      })
    }
  } else {
    // ロンの場合
    const loserPayment = scoreResult.totalScore

    players.forEach((player) => {
      if (player.position === scoreInput.winnerId) {
        // 勝者
        changes.push({
          position: player.position,
          change: loserPayment,
        })
      } else if (player.position === scoreInput.loserId) {
        // 敗者
        changes.push({
          position: player.position,
          change: -loserPayment,
        })
      } else {
        // その他
        changes.push({
          position: player.position,
          change: 0,
        })
      }
    })
  }

  return changes
}

/**
 * ソロゲームの状態を更新
 */
async function updateSoloGameState(
  gameId: string,
  scoreInput: SoloScoreCalculationInput,
  pointChanges: { position: number; change: number }[],
  scoreResult: ScoreCalculationResult,
  isOya: boolean
) {
  await prisma.$transaction(async (tx) => {
    // プレイヤーの点数を更新
    for (const change of pointChanges) {
      await tx.soloPlayer.updateMany({
        where: {
          soloGameId: gameId,
          position: change.position,
        },
        data: {
          currentPoints: {
            increment: change.change,
          },
        },
      })
    }

    // 親・本場・供託の更新
    const game = await tx.soloGame.findUnique({ where: { id: gameId } })
    if (!game) return

    let newOya = game.currentOya
    let newHonba = game.honba

    if (isOya) {
      // 親の和了：連荘
      newHonba += 1
    } else {
      // 子の和了：親交代
      newOya = (game.currentOya + 1) % 4
      newHonba = 0
    }

    await tx.soloGame.update({
      where: { id: gameId },
      data: {
        currentOya: newOya,
        honba: newHonba,
        kyotaku: 0, // 和了時に供託はクリア
      },
    })

    // イベントを記録
    await tx.soloGameEvent.create({
      data: {
        soloGameId: gameId,
        position: scoreInput.winnerId,
        eventType: scoreInput.isTsumo ? "TSUMO" : "RON",
        round: game.currentRound,
        honba: game.honba,
        eventData: {
          han: scoreInput.han,
          fu: scoreInput.fu,
          winnerId: scoreInput.winnerId,
          loserId: scoreInput.loserId,
          scoreResult: JSON.parse(JSON.stringify(scoreResult)),
          pointChanges: pointChanges,
        },
      },
    })
  })
}

/**
 * ソロゲームの現在状態を取得
 */
export async function getSoloGameState(gameId: string): Promise<SoloGameState> {
  const game = await prisma.soloGame.findUnique({
    where: { id: gameId },
    include: {
      players: {
        orderBy: { position: "asc" },
      },
    },
  })

  if (!game) {
    throw new Error("ゲームが見つかりません")
  }

  return {
    gameId: game.id,
    players: game.players.map((p) => ({
      position: p.position,
      name: p.name,
      points: p.currentPoints,
      isReach: p.isReach,
      reachRound: p.reachRound || undefined,
    })),
    currentRound: game.currentRound,
    currentOya: game.currentOya,
    honba: game.honba,
    kyotaku: game.kyotaku,
    status: game.status as "WAITING" | "PLAYING" | "FINISHED",
  }
}

/**
 * リーチ宣言
 */
export async function declareSoloReach(
  gameId: string,
  position: number,
  round: number
): Promise<SoloGameState> {
  await prisma.$transaction(async (tx) => {
    // プレイヤーの点数を1000点減算、リーチ状態に設定
    await tx.soloPlayer.updateMany({
      where: {
        soloGameId: gameId,
        position: position,
      },
      data: {
        currentPoints: {
          decrement: 1000,
        },
        isReach: true,
        reachRound: round,
      },
    })

    // ゲームの供託を1増加
    await tx.soloGame.update({
      where: { id: gameId },
      data: {
        kyotaku: {
          increment: 1,
        },
      },
    })

    // イベントを記録
    const game = await tx.soloGame.findUnique({ where: { id: gameId } })
    await tx.soloGameEvent.create({
      data: {
        soloGameId: gameId,
        position: position,
        eventType: "REACH",
        round: game?.currentRound || 1,
        honba: game?.honba || 0,
        eventData: {
          position: position,
          round: round,
        },
      },
    })
  })

  return await getSoloGameState(gameId)
}

/**
 * 流局処理
 */
export async function processSoloRyukyoku(
  gameId: string,
  tenpaiPlayers: number[],
  reachPlayers: number[]
): Promise<SoloGameState> {
  await prisma.$transaction(async (tx) => {
    const game = await tx.soloGame.findUnique({
      where: { id: gameId },
      include: { players: true },
    })

    if (!game) throw new Error("ゲームが見つかりません")

    // 流局時の点数分配
    const tenpaiCount = tenpaiPlayers.length
    const natenCount = 4 - tenpaiCount

    if (tenpaiCount > 0 && natenCount > 0) {
      const pointPerTenpai = Math.floor(3000 / tenpaiCount)
      const pointPerNaten = Math.floor(3000 / natenCount)

      for (const player of game.players) {
        if (tenpaiPlayers.includes(player.position)) {
          // テンパイ者は受け取り
          await tx.soloPlayer.update({
            where: { id: player.id },
            data: {
              currentPoints: player.currentPoints + pointPerTenpai,
            },
          })
        } else {
          // ノーテン者は支払い
          await tx.soloPlayer.update({
            where: { id: player.id },
            data: {
              currentPoints: player.currentPoints - pointPerNaten,
            },
          })
        }
      }
    }

    // 親・本場の更新
    let newOya = game.currentOya
    let newHonba = game.honba + 1

    // 親がテンパイしていない場合は親交代
    if (!tenpaiPlayers.includes(game.currentOya)) {
      newOya = (game.currentOya + 1) % 4
      newHonba = 0
    }

    await tx.soloGame.update({
      where: { id: gameId },
      data: {
        currentOya: newOya,
        honba: newHonba,
      },
    })

    // イベントを記録
    await tx.soloGameEvent.create({
      data: {
        soloGameId: gameId,
        position: null,
        eventType: "RYUKYOKU",
        round: game.currentRound,
        honba: game.honba,
        eventData: {
          tenpaiPlayers: tenpaiPlayers,
          reachPlayers: reachPlayers,
          pointPerTenpai: tenpaiCount > 0 ? Math.floor(3000 / tenpaiCount) : 0,
          pointPerNaten: natenCount > 0 ? Math.floor(3000 / natenCount) : 0,
        },
      },
    })
  })

  return await getSoloGameState(gameId)
}
