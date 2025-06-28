import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface ScorePattern {
  oyaPoints: number
  koPoints: number
  han: number
  fu: number
  oyaTsumoAll: number
  koTsumoOya: number
  koTsumoKo: number
}

export interface ScoreCalculationInput {
  han: number
  fu: number
  isOya: boolean
  isTsumo: boolean
  honba: number
  kyotaku: number
}

export interface ScoreCalculationResult {
  baseScore: number
  totalScore: number
  payments: {
    fromOya?: number
    fromKo?: number
    fromLoser?: number
  }
  honbaPayment: number
  kyotakuPayment: number
}

/**
 * 点数計算メインエンジン
 */
export async function calculateScore(input: ScoreCalculationInput): Promise<ScoreCalculationResult> {
  const { han, fu, isOya, isTsumo, honba, kyotaku } = input
  
  // DBから点数パターンを検索
  const scorePattern = await findScorePattern(han, fu)
  if (!scorePattern) {
    throw new Error(`点数パターンが見つかりません: ${han}翻${fu}符`)
  }
  
  const baseScore = calculateBaseScore(han, fu)
  const mainPoints = isOya ? scorePattern.oyaPoints : scorePattern.koPoints
  
  // 本場による加算
  const honbaPayment = honba * 300
  
  // 供託による加算
  const kyotakuPayment = kyotaku * 1000
  
  // 支払い分配の計算
  const payments = calculatePayments({
    isOya,
    isTsumo,
    mainPoints,
    honba,
    scorePattern
  })
  
  // 総得点の計算
  let totalScore: number
  if (isTsumo) {
    if (isOya) {
      // 親ツモ: 子3人の支払い合計（本場分は既に含まれている） + 供託
      totalScore = (payments.fromKo || 0) * 3 + kyotakuPayment
    } else {
      // 子ツモ: 親1人 + 子2人の支払い合計（本場分は既に含まれている） + 供託
      totalScore = (payments.fromOya || 0) + (payments.fromKo || 0) * 2 + kyotakuPayment
    }
  } else {
    // ロン: 基本点 + 本場 + 供託
    totalScore = mainPoints + honbaPayment + kyotakuPayment
  }
  
  return {
    baseScore,
    totalScore,
    payments,
    honbaPayment,
    kyotakuPayment
  }
}

/**
 * DBから点数パターンを検索
 */
async function findScorePattern(han: number, fu: number) {
  // 満貫以上は符数に関わらず固定
  if (han >= 5) {
    return await prisma.scorePattern.findFirst({
      where: { han, fu: 30 }
    })
  }
  
  // 3翻70符、4翻40符以上は満貫
  if ((han === 3 && fu >= 70) || (han === 4 && fu >= 40)) {
    return await prisma.scorePattern.findFirst({
      where: { han: 5, fu: 30 }
    })
  }
  
  return await prisma.scorePattern.findFirst({
    where: { han, fu }
  })
}

/**
 * 基本点計算
 */
function calculateBaseScore(han: number, fu: number): number {
  return fu * Math.pow(2, han + 2)
}

/**
 * 支払い分配計算
 */
function calculatePayments(params: {
  isOya: boolean
  isTsumo: boolean
  mainPoints: number
  honba: number
  scorePattern: ScorePattern
}) {
  const { isOya, isTsumo, mainPoints, honba, scorePattern } = params
  
  if (isTsumo) {
    // ツモの場合
    if (isOya) {
      // 親ツモ: 子全員が同額支払い（本場分を含む）
      const perKoPayment = scorePattern.oyaTsumoAll + (honba * 100)
      return {
        fromKo: perKoPayment
      }
    } else {
      // 子ツモ: 親と子で支払額が異なる（本場分を含む）
      const oyaPayment = scorePattern.koTsumoOya + (honba * 100)
      const koPayment = scorePattern.koTsumoKo + (honba * 100)
      return {
        fromOya: oyaPayment,
        fromKo: koPayment
      }
    }
  } else {
    // ロンの場合: 被ロン者が全額支払い（本場分を含む）
    return {
      fromLoser: mainPoints + (honba * 300)
    }
  }
}

/**
 * 点数表示用フォーマット
 */
export function formatScore(score: number): string {
  return score.toLocaleString()
}

/**
 * 翻数・符数の組み合わせ検証
 */
export function validateHanFu(han: number, fu: number): boolean {
  // 20符は2翻以上
  if (fu === 20 && han < 2) return false
  // 25符は2翻以上  
  if (fu === 25 && han < 2) return false
  // 一般的な符数範囲
  if (fu < 20 || fu > 110) return false
  // 翻数範囲
  if (han < 1 || han > 13) return false
  
  return true
}

/**
 * 役満判定
 */
export function isYakuman(han: number): boolean {
  return han >= 13
}

/**
 * 満貫以上判定
 */
export function isMangan(han: number, fu: number): boolean {
  if (han >= 5) return true
  if (han === 3 && fu >= 70) return true
  if (han === 4 && fu >= 40) return true
  return false
}