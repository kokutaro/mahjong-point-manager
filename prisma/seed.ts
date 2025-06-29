import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// 点数計算マスタデータを生成
function generateScorePatterns() {
  const patterns = []
  const fuValues = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110]

  // 通常の翻数・符数組み合わせ (1-4翻)
  for (let han = 1; han <= 4; han++) {
    for (const fu of fuValues) {
      // 制約: 20符は2翻以上、25符は2翻以上
      if ((fu === 20 && han < 2) || (fu === 25 && han < 2)) continue

      const { baseScore, oyaPoints, koPoints } = calculateBaseScore(han, fu)

      patterns.push({
        han,
        fu,
        oyaPoints,
        koPoints,
        oyaTsumoAll: Math.ceil((baseScore * 2) / 100) * 100,
        koTsumoOya: Math.ceil((baseScore * 2) / 100) * 100,
        koTsumoKo: Math.ceil(baseScore / 100) * 100,
      })
    }
  }

  // 満貫以上の固定値
  const specialScores = [
    { han: 5, name: "満貫", oya: 12000, ko: 8000 },
    { han: 6, name: "跳満", oya: 18000, ko: 12000 },
    { han: 8, name: "倍満", oya: 24000, ko: 16000 },
    { han: 11, name: "三倍満", oya: 36000, ko: 24000 },
    { han: 13, name: "役満", oya: 48000, ko: 32000 },
  ]

  specialScores.forEach((score) => {
    patterns.push({
      han: score.han,
      fu: 30, // 代表値
      oyaPoints: score.oya,
      koPoints: score.ko,
      oyaTsumoAll: Math.ceil(score.oya / 3 / 100) * 100,
      koTsumoOya: Math.ceil(score.ko / 2 / 100) * 100,
      koTsumoKo: Math.ceil(score.ko / 4 / 100) * 100,
    })
  })

  // 3翻70符、4翻40符以上を満貫に変更
  patterns.forEach((pattern) => {
    if (
      (pattern.han === 3 && pattern.fu >= 70) ||
      (pattern.han === 4 && pattern.fu >= 40)
    ) {
      pattern.oyaPoints = 12000
      pattern.koPoints = 8000
      pattern.oyaTsumoAll = 4000
      pattern.koTsumoOya = 4000
      pattern.koTsumoKo = 2000
    }
  })

  return patterns
}

function calculateBaseScore(han: number, fu: number) {
  const baseScore = fu * Math.pow(2, han + 2)

  // 親の支払い: 基本点 * 6 → 100の倍数で切り上げ
  const oyaPoints = Math.ceil((baseScore * 6) / 100) * 100

  // 子の支払い: 基本点 * 4 → 100の倍数で切り上げ
  const koPoints = Math.ceil((baseScore * 4) / 100) * 100

  return { baseScore, oyaPoints, koPoints }
}

async function main() {
  console.log("開始: データベースシード処理")

  // 既存データクリア
  await prisma.scorePattern.deleteMany()
  await prisma.gameResult.deleteMany()
  await prisma.gameEvent.deleteMany()
  await prisma.gameParticipant.deleteMany()
  await prisma.gameSettings.deleteMany()
  await prisma.game.deleteMany()
  await prisma.player.deleteMany()

  console.log("既存データをクリアしました")

  // 点数マスタデータ投入
  const scorePatterns = generateScorePatterns()
  await prisma.scorePattern.createMany({
    data: scorePatterns,
  })

  console.log(`点数パターン ${scorePatterns.length} 件を登録しました`)

  // テスト用プレイヤー作成
  const testPlayers = await Promise.all([
    prisma.player.create({
      data: {
        name: "プレイヤー1",
        avatar: null,
      },
    }),
    prisma.player.create({
      data: {
        name: "プレイヤー2",
        avatar: null,
      },
    }),
    prisma.player.create({
      data: {
        name: "プレイヤー3",
        avatar: null,
      },
    }),
    prisma.player.create({
      data: {
        name: "プレイヤー4",
        avatar: null,
      },
    }),
  ])

  console.log(`テスト用プレイヤー ${testPlayers.length} 名を作成しました`)

  console.log("完了: データベースシード処理")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
