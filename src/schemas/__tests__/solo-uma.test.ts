import { CreateSoloGameSchema, UmaSettingsSchema } from '../solo'

describe('Solo Uma Settings Schema', () => {
  describe('UmaSettingsSchema', () => {
    it('有効なウマ設定を受け入れる', () => {
      const validUma = [20, 10, -10, -20]
      const result = UmaSettingsSchema.safeParse(validUma)
      expect(result.success).toBe(true)
    })

    it('合計が0でないウマ設定を拒否する', () => {
      const invalidUma = [20, 10, -10, -15] // 合計が5
      const gameData = {
        gameType: 'HANCHAN' as const,
        initialPoints: 25000,
        basePoints: 30000,
        uma: invalidUma,
        players: [
          { position: 0, name: '東家' },
          { position: 1, name: '南家' },
          { position: 2, name: '西家' },
          { position: 3, name: '北家' }
        ]
      }
      const result = CreateSoloGameSchema.safeParse(gameData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('ウマの合計は0である必要があります')
      }
    })

    it('デフォルト値を設定する', () => {
      const result = UmaSettingsSchema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([15000, 5000, -5000, -15000])
      }
    })
  })

  describe('CreateSoloGameSchema', () => {
    it('有効なゲーム作成データを受け入れる', () => {
      const validData = {
        gameType: 'HANCHAN' as const,
        initialPoints: 25000,
        basePoints: 30000,
        uma: [20, 10, -10, -20],
        players: [
          { position: 0, name: '東家' },
          { position: 1, name: '南家' },
          { position: 2, name: '西家' },
          { position: 3, name: '北家' }
        ]
      }
      const result = CreateSoloGameSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('basePointsのデフォルト値を設定する', () => {
      const dataWithoutBasePoints = {
        gameType: 'HANCHAN' as const,
        initialPoints: 25000,
        uma: [20, 10, -10, -20],
        players: [
          { position: 0, name: '東家' },
          { position: 1, name: '南家' },
          { position: 2, name: '西家' },
          { position: 3, name: '北家' }
        ]
      }
      const result = CreateSoloGameSchema.safeParse(dataWithoutBasePoints)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.basePoints).toBe(30000)
      }
    })
  })
})