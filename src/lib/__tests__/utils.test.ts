import {
  getPositionName,
  formatPoints,
  getRoundName,
  generateRoomCode,
  calculatePointDifference,
  cn,
} from "../utils"

describe("Utils", () => {
  describe("getPositionName", () => {
    test("親が東家（position 0）の場合", () => {
      const currentOya = 0

      expect(getPositionName(0, currentOya)).toBe("東")
      expect(getPositionName(1, currentOya)).toBe("南")
      expect(getPositionName(2, currentOya)).toBe("西")
      expect(getPositionName(3, currentOya)).toBe("北")
    })

    test("親が南家（position 1）の場合", () => {
      const currentOya = 1

      expect(getPositionName(0, currentOya)).toBe("北")
      expect(getPositionName(1, currentOya)).toBe("東")
      expect(getPositionName(2, currentOya)).toBe("南")
      expect(getPositionName(3, currentOya)).toBe("西")
    })

    test("親が西家（position 2）の場合", () => {
      const currentOya = 2

      expect(getPositionName(0, currentOya)).toBe("西")
      expect(getPositionName(1, currentOya)).toBe("北")
      expect(getPositionName(2, currentOya)).toBe("東")
      expect(getPositionName(3, currentOya)).toBe("南")
    })

    test("親が北家（position 3）の場合", () => {
      const currentOya = 3

      expect(getPositionName(0, currentOya)).toBe("南")
      expect(getPositionName(1, currentOya)).toBe("西")
      expect(getPositionName(2, currentOya)).toBe("北")
      expect(getPositionName(3, currentOya)).toBe("東")
    })

    test("無効なposition値の場合", () => {
      const currentOya = 0

      expect(getPositionName(-1, currentOya)).toBe("北") // (-1 - 0 + 4) % 4 = 3 = 北
      expect(getPositionName(4, currentOya)).toBe("東") // (4 - 0 + 4) % 4 = 0 = 東
      expect(getPositionName(10, currentOya)).toBe("西") // (10 - 0 + 4) % 4 = 2 = 西
    })

    test("無効なcurrentOya値の場合", () => {
      expect(getPositionName(0, -1)).toBe("南") // (0 - (-1) + 4) % 4 = 1 = 南
      expect(getPositionName(1, -1)).toBe("西") // (1 - (-1) + 4) % 4 = 2 = 西
      expect(getPositionName(0, 5)).toBe("不明") // (0 - 5 + 4) % 4 = -1 -> positions[-1] = undefined -> '不明'
      expect(getPositionName(1, 5)).toBe("東") // (1 - 5 + 4) % 4 = 0 = 東
    })

    test("親の移動パターンが正しく動作する", () => {
      // 東1局から南4局までの親の移動
      for (let round = 0; round < 8; round++) {
        const currentOya = round % 4

        // 親は常に「東」になる
        expect(getPositionName(currentOya, currentOya)).toBe("東")

        // 親の下家（次の席）は常に「南」になる
        const nextPosition = (currentOya + 1) % 4
        expect(getPositionName(nextPosition, currentOya)).toBe("南")
      }
    })

    test("風順が正しく循環する", () => {
      const expectedWinds = ["東", "南", "西", "北"]

      for (let oya = 0; oya < 4; oya++) {
        for (let pos = 0; pos < 4; pos++) {
          const wind = getPositionName(pos, oya)
          const expectedIndex = (pos - oya + 4) % 4
          expect(wind).toBe(expectedWinds[expectedIndex])
        }
      }
    })
  })

  describe("other utility functions", () => {
    test("formatPoints formats numbers with commas", () => {
      expect(formatPoints(0)).toBe("0")
      expect(formatPoints(1234)).toBe("1,234")
    })

    test("getRoundName returns correct string", () => {
      expect(getRoundName(1)).toBe("東1局")
      expect(getRoundName(7)).toBe("南3局")
    })

    test("generateRoomCode creates four digit codes", () => {
      const code = generateRoomCode()
      expect(code).toMatch(/^\d{4}$/)
      const num = Number(code)
      expect(num).toBeGreaterThanOrEqual(1000)
      expect(num).toBeLessThanOrEqual(9999)
    })

    test("calculatePointDifference computes diff", () => {
      expect(calculatePointDifference(26000)).toBe(1000)
      expect(calculatePointDifference(20000, 20000)).toBe(0)
    })

    test("cn merges class names", () => {
      expect(cn("a", false && "b", "c")).toBe("a c")
    })
  })
})
