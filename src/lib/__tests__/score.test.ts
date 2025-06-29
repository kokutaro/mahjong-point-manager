import {
  calculateScore,
  validateHanFu,
  isYakuman,
  isMangan,
  formatScore,
  ScoreCalculationInput,
  ScorePattern,
} from "../score"

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    scorePattern: {
      findFirst: jest.fn(),
    },
  },
}))

const mockPrisma = jest.requireMock("@/lib/prisma").prisma

describe("Score Calculation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Test data factory functions
  const createScorePattern = (
    overrides: Partial<ScorePattern> = {}
  ): ScorePattern => ({
    oyaPoints: 12000,
    koPoints: 8000,
    han: 3,
    fu: 30,
    oyaTsumoAll: 4000,
    koTsumoOya: 4000,
    koTsumoKo: 2000,
    ...overrides,
  })

  const createScoreInput = (
    overrides: Partial<ScoreCalculationInput> = {}
  ): ScoreCalculationInput => ({
    han: 3,
    fu: 30,
    isOya: false,
    isTsumo: false,
    honba: 0,
    kyotaku: 0,
    ...overrides,
  })

  describe("calculateScore", () => {
    describe("正常系テスト", () => {
      test("子のロン和了（3翻30符）", async () => {
        const scorePattern = createScorePattern({
          han: 3,
          fu: 30,
          oyaPoints: 12000,
          koPoints: 8000,
        })
        const input = createScoreInput({
          han: 3,
          fu: 30,
          isOya: false,
          isTsumo: false,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.baseScore).toBe(240) // 30 * 2^(3+2)
        expect(result.totalScore).toBe(8000)
        expect(result.payments.fromLoser).toBe(8000)
        expect(result.honbaPayment).toBe(0)
        expect(result.kyotakuPayment).toBe(0)
      })

      test("親のロン和了（3翻30符）", async () => {
        const scorePattern = createScorePattern({
          han: 3,
          fu: 30,
          oyaPoints: 12000,
          koPoints: 8000,
        })
        const input = createScoreInput({
          han: 3,
          fu: 30,
          isOya: true,
          isTsumo: false,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.totalScore).toBe(12000)
        expect(result.payments.fromLoser).toBe(12000)
      })

      test("子のツモ和了（3翻30符）", async () => {
        const scorePattern = createScorePattern({
          han: 3,
          fu: 30,
          koTsumoOya: 4000,
          koTsumoKo: 2000,
        })
        const input = createScoreInput({
          han: 3,
          fu: 30,
          isOya: false,
          isTsumo: true,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.totalScore).toBe(8000) // 4000 + 2000 * 2
        expect(result.payments.fromOya).toBe(4000)
        expect(result.payments.fromKo).toBe(2000)
      })

      test("親のツモ和了（3翻30符）", async () => {
        const scorePattern = createScorePattern({
          han: 3,
          fu: 30,
          oyaTsumoAll: 4000,
        })
        const input = createScoreInput({
          han: 3,
          fu: 30,
          isOya: true,
          isTsumo: true,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.totalScore).toBe(12000) // 4000 * 3
        expect(result.payments.fromKo).toBe(4000)
      })

      test("本場とリーチ棒がある場合", async () => {
        const scorePattern = createScorePattern()
        const input = createScoreInput({
          honba: 2,
          kyotaku: 1,
          isTsumo: false,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.honbaPayment).toBe(600) // 2 * 300
        expect(result.kyotakuPayment).toBe(1000) // 1 * 1000
        expect(result.totalScore).toBe(9600) // 8000 + 600 + 1000
        expect(result.payments.fromLoser).toBe(9600)
      })

      test("ツモ時の本場計算", async () => {
        const scorePattern = createScorePattern({
          koTsumoOya: 4000,
          koTsumoKo: 2000,
        })
        const input = createScoreInput({
          honba: 2,
          kyotaku: 1,
          isTsumo: true,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.honbaPayment).toBe(600)
        expect(result.kyotakuPayment).toBe(1000)
        // ツモ時は本場分が支払いに含まれる
        expect(result.payments.fromOya).toBe(4200) // 4000 + 200
        expect(result.payments.fromKo).toBe(2200) // 2000 + 200
        expect(result.totalScore).toBe(9600) // (4200) + (2200*2) + 1000(供託)
      })
    })

    describe("満貫以上のテスト", () => {
      test("満貫（5翻）", async () => {
        const scorePattern = createScorePattern({
          han: 5,
          fu: 30,
          oyaPoints: 18000,
          koPoints: 12000,
        })
        const input = createScoreInput({
          han: 5,
          fu: 30,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.totalScore).toBe(12000)
      })

      test("跳満（6-7翻）", async () => {
        const scorePattern = createScorePattern({
          han: 6,
          fu: 30,
          oyaPoints: 24000,
          koPoints: 16000,
        })
        const input = createScoreInput({
          han: 6,
          fu: 30,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.totalScore).toBe(16000)
      })

      test("倍満（8-10翻）", async () => {
        const scorePattern = createScorePattern({
          han: 8,
          fu: 30,
          oyaPoints: 30000,
          koPoints: 20000,
        })
        const input = createScoreInput({
          han: 8,
          fu: 30,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.totalScore).toBe(20000)
      })

      test("三倍満（11-12翻）", async () => {
        const scorePattern = createScorePattern({
          han: 11,
          fu: 30,
          oyaPoints: 45000,
          koPoints: 30000,
        })
        const input = createScoreInput({
          han: 11,
          fu: 30,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.totalScore).toBe(30000)
      })

      test("役満（13翻以上）", async () => {
        const scorePattern = createScorePattern({
          han: 13,
          fu: 30,
          oyaPoints: 60000,
          koPoints: 40000,
        })
        const input = createScoreInput({
          han: 13,
          fu: 30,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.totalScore).toBe(40000)
      })
    })

    describe("特殊ケース", () => {
      test("3翻70符（満貫切り上げ）", async () => {
        // 3翻70符は満貫として扱われる
        const scorePattern = createScorePattern({
          han: 5, // 満貫として検索される
          fu: 30,
          oyaPoints: 18000,
          koPoints: 12000,
        })
        const input = createScoreInput({
          han: 3,
          fu: 70,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.totalScore).toBe(12000)
        expect(mockPrisma.scorePattern.findFirst).toHaveBeenCalledWith({
          where: { han: 5, fu: 30 },
        })
      })

      test("4翻40符（満貫切り上げ）", async () => {
        const scorePattern = createScorePattern({
          han: 5,
          fu: 30,
          oyaPoints: 18000,
          koPoints: 12000,
        })
        const input = createScoreInput({
          han: 4,
          fu: 40,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.totalScore).toBe(12000)
        expect(mockPrisma.scorePattern.findFirst).toHaveBeenCalledWith({
          where: { han: 5, fu: 30 },
        })
      })

      test("低い符数（20符、25符）", async () => {
        const scorePattern = createScorePattern({
          han: 2,
          fu: 25,
          oyaPoints: 4800,
          koPoints: 3200,
        })
        const input = createScoreInput({
          han: 2,
          fu: 25,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

        const result = await calculateScore(input)

        expect(result.totalScore).toBe(3200)
      })
    })

    describe("異常系テスト", () => {
      test("点数パターンが見つからない場合", async () => {
        const input = createScoreInput({
          han: 99,
          fu: 999,
        })

        mockPrisma.scorePattern.findFirst.mockResolvedValue(null)

        await expect(calculateScore(input)).rejects.toThrow(
          "点数パターンが見つかりません: 99翻999符"
        )
      })

      test("無効な翻数・符数の組み合わせ", async () => {
        const input = createScoreInput({
          han: 0,
          fu: 15,
        })

        // バリデーションは呼び出し側で行うと仮定し、ここではDBエラーをテスト
        mockPrisma.scorePattern.findFirst.mockResolvedValue(null)

        await expect(calculateScore(input)).rejects.toThrow(
          "点数パターンが見つかりません"
        )
      })
    })
  })

  describe("バリデーション関数", () => {
    describe("validateHanFu", () => {
      test("有効な翻数・符数の組み合わせ", () => {
        expect(validateHanFu(1, 30)).toBe(true)
        expect(validateHanFu(3, 60)).toBe(true)
        expect(validateHanFu(13, 30)).toBe(true) // 役満
        expect(validateHanFu(2, 20)).toBe(true) // 平和ツモ
        expect(validateHanFu(2, 25)).toBe(true) // 七対子
      })

      test("無効な翻数・符数の組み合わせ", () => {
        expect(validateHanFu(0, 30)).toBe(false) // 0翻
        expect(validateHanFu(1, 20)).toBe(false) // 1翻20符（平和ロンは不可）
        expect(validateHanFu(1, 25)).toBe(false) // 1翻25符（七対子は2翻以上）
        expect(validateHanFu(3, 15)).toBe(false) // 符数が低すぎる
        expect(validateHanFu(3, 120)).toBe(false) // 符数が高すぎる
        expect(validateHanFu(-1, 30)).toBe(false) // マイナス翻
        expect(validateHanFu(14, 30)).toBe(false) // 翻数が高すぎる
      })
    })

    describe("isYakuman", () => {
      test("役満の判定", () => {
        expect(isYakuman(13)).toBe(true)
        expect(isYakuman(26)).toBe(true) // ダブル役満
        expect(isYakuman(12)).toBe(false)
        expect(isYakuman(0)).toBe(false)
      })
    })

    describe("isMangan", () => {
      test("満貫以上の判定", () => {
        expect(isMangan(5, 30)).toBe(true) // 満貫
        expect(isMangan(6, 30)).toBe(true) // 跳満
        expect(isMangan(3, 70)).toBe(true) // 3翻70符
        expect(isMangan(4, 40)).toBe(true) // 4翻40符
        expect(isMangan(4, 30)).toBe(false) // 3900点
        expect(isMangan(3, 60)).toBe(false) // 3900点
        expect(isMangan(2, 70)).toBe(false) // 2300点
      })
    })
  })

  describe("フォーマット関数", () => {
    describe("formatScore", () => {
      test("点数の表示フォーマット", () => {
        expect(formatScore(1000)).toBe("1,000")
        expect(formatScore(12000)).toBe("12,000")
        expect(formatScore(100000)).toBe("100,000")
        expect(formatScore(500)).toBe("500")
        expect(formatScore(0)).toBe("0")
      })
    })
  })

  describe("境界値テスト", () => {
    test("最小翻数・符数", async () => {
      const scorePattern = createScorePattern({
        han: 1,
        fu: 30,
        oyaPoints: 2300,
        koPoints: 1500,
      })
      const input = createScoreInput({
        han: 1,
        fu: 30,
      })

      mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

      const result = await calculateScore(input)

      expect(result.totalScore).toBe(1500)
    })

    test("最大翻数（役満）", async () => {
      const scorePattern = createScorePattern({
        han: 13,
        fu: 30,
        oyaPoints: 60000,
        koPoints: 40000,
      })
      const input = createScoreInput({
        han: 13,
        fu: 30,
      })

      mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

      const result = await calculateScore(input)

      expect(result.totalScore).toBe(40000)
    })

    test("最大符数（110符）", async () => {
      const scorePattern = createScorePattern({
        han: 2,
        fu: 110,
        oyaPoints: 10600,
        koPoints: 7100,
      })
      const input = createScoreInput({
        han: 2,
        fu: 110,
      })

      mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

      const result = await calculateScore(input)

      expect(result.totalScore).toBe(7100)
    })

    test("最大本場数", async () => {
      const scorePattern = createScorePattern()
      const input = createScoreInput({
        honba: 10, // 10本場
        isTsumo: false,
      })

      mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

      const result = await calculateScore(input)

      expect(result.honbaPayment).toBe(3000) // 10 * 300
      expect(result.totalScore).toBe(11000) // 8000 + 3000
    })

    test("最大供託数", async () => {
      const scorePattern = createScorePattern()
      const input = createScoreInput({
        kyotaku: 4, // 4人全員リーチ
        isTsumo: false,
      })

      mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

      const result = await calculateScore(input)

      expect(result.kyotakuPayment).toBe(4000) // 4 * 1000
      expect(result.totalScore).toBe(12000) // 8000 + 4000
    })
  })

  describe("エッジケース", () => {
    test("0本場・0供託", async () => {
      const scorePattern = createScorePattern()
      const input = createScoreInput({
        honba: 0,
        kyotaku: 0,
      })

      mockPrisma.scorePattern.findFirst.mockResolvedValue(scorePattern)

      const result = await calculateScore(input)

      expect(result.honbaPayment).toBe(0)
      expect(result.kyotakuPayment).toBe(0)
      expect(result.totalScore).toBe(8000)
    })

    test("データベースエラー", async () => {
      const input = createScoreInput()

      mockPrisma.scorePattern.findFirst.mockRejectedValue(
        new Error("Database error")
      )

      await expect(calculateScore(input)).rejects.toThrow("Database error")
    })
  })
})
