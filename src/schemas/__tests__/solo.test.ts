import {
  SoloPlayerStateSchema,
  SoloGameStateSchema,
  CreateSoloPlayerSchema,
  UmaSettingsSchema,
  CreateSoloGameSchema,
  SoloScoreCalculationSchema,
  SoloRyukyokuSchema,
  SoloGameStateResponseSchema,
  SoloGameResultResponseSchema,
  validatePlayerNames,
  validateReachPlayersTenpai,
  calculateRanks,
  calculateUma,
  calculateSettlement,
  getPlayerWind,
  generateRyukyokuReason,
  PLAYER_POSITIONS,
  SOLO_UMA_SETTINGS,
  type PlayerPosition,
} from "../solo"

describe("schemas/solo.ts", () => {
  describe("SoloPlayerStateSchema", () => {
    it("有効なプレイヤー状態を検証できる", () => {
      const validPlayer = {
        position: 0,
        name: "プレイヤー1",
        currentPoints: 25000,
        isReach: false,
        reachRound: null,
        finalPoints: 25000,
        finalRank: 1,
        uma: 15000,
        settlement: 10000,
      }

      const result = SoloPlayerStateSchema.safeParse(validPlayer)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validPlayer)
      }
    })

    it("空の名前を拒否する", () => {
      const invalidPlayer = {
        position: 0,
        name: "",
        currentPoints: 25000,
        isReach: false,
      }

      const result = SoloPlayerStateSchema.safeParse(invalidPlayer)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe("名前は必須です")
    })

    it("長すぎる名前を拒否する", () => {
      const invalidPlayer = {
        position: 0,
        name: "非常に長いプレイヤー名前前前前前前前前前前",
        currentPoints: 25000,
        isReach: false,
      }

      const result = SoloPlayerStateSchema.safeParse(invalidPlayer)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe("名前は20文字以内です")
    })

    it("不正な順位を拒否する", () => {
      const invalidPlayer = {
        position: 0,
        name: "プレイヤー1",
        currentPoints: 25000,
        isReach: false,
        finalRank: 0, // 1-4の範囲外
      }

      const result = SoloPlayerStateSchema.safeParse(invalidPlayer)
      expect(result.success).toBe(false)
    })
  })

  describe("SoloGameStateSchema", () => {
    it("有効なゲーム状態を検証できる", () => {
      const validGame = {
        gameId: "550e8400-e29b-41d4-a716-446655440000",
        gameMode: "SOLO" as const,
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
        status: "WAITING" as const,
        gameType: "HANCHAN" as const,
        initialPoints: 25000,
        hostPlayerId: "550e8400-e29b-41d4-a716-446655440001",
        players: [
          {
            position: 0,
            name: "プレイヤー1",
            currentPoints: 25000,
            isReach: false,
          },
          {
            position: 1,
            name: "プレイヤー2",
            currentPoints: 25000,
            isReach: false,
          },
          {
            position: 2,
            name: "プレイヤー3",
            currentPoints: 25000,
            isReach: false,
          },
          {
            position: 3,
            name: "プレイヤー4",
            currentPoints: 25000,
            isReach: false,
          },
        ],
      }

      const result = SoloGameStateSchema.safeParse(validGame)
      expect(result.success).toBe(true)
    })

    it("プレイヤー数が4人でない場合を拒否する", () => {
      const invalidGame = {
        gameId: "550e8400-e29b-41d4-a716-446655440000",
        gameMode: "SOLO" as const,
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
        status: "WAITING" as const,
        gameType: "HANCHAN" as const,
        initialPoints: 25000,
        hostPlayerId: "550e8400-e29b-41d4-a716-446655440001",
        players: [
          {
            position: 0,
            name: "プレイヤー1",
            currentPoints: 25000,
            isReach: false,
          },
          {
            position: 1,
            name: "プレイヤー2",
            currentPoints: 25000,
            isReach: false,
          },
        ],
      }

      const result = SoloGameStateSchema.safeParse(invalidGame)
      expect(result.success).toBe(false)
    })
  })

  describe("CreateSoloPlayerSchema", () => {
    it("有効なプレイヤー作成データを検証できる", () => {
      const validInput = {
        position: 0,
        name: "テストプレイヤー",
      }

      const result = CreateSoloPlayerSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("無効なポジションを拒否する", () => {
      const invalidInput = {
        position: 5, // 0-3の範囲外
        name: "テストプレイヤー",
      }

      const result = CreateSoloPlayerSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })
  })

  describe("UmaSettingsSchema", () => {
    it("有効なウマ設定を検証できる", () => {
      const validUma = [15000, 5000, -5000, -15000]

      const result = UmaSettingsSchema.safeParse(validUma)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(validUma)
    })

    it("要素数が4でない場合を拒否する", () => {
      const invalidUma = [15000, 5000, -5000]

      const result = UmaSettingsSchema.safeParse(invalidUma)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe("ウマは4つの値が必要です")
    })

    it("デフォルト値を適用する", () => {
      const result = UmaSettingsSchema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([15000, 5000, -5000, -15000])
      }
    })
  })

  describe("CreateSoloGameSchema", () => {
    const validPlayers = [
      { position: 0, name: "プレイヤー1" },
      { position: 1, name: "プレイヤー2" },
      { position: 2, name: "プレイヤー3" },
      { position: 3, name: "プレイヤー4" },
    ]

    it("有効なゲーム作成データを検証できる", () => {
      const validInput = {
        gameType: "HANCHAN" as const,
        initialPoints: 25000,
        basePoints: 30000,
        uma: [15000, 5000, -5000, -15000],
        players: validPlayers,
      }

      const result = CreateSoloGameSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it("プレイヤー名の重複を拒否する", () => {
      const duplicatePlayers = [
        { position: 0, name: "プレイヤー1" },
        { position: 1, name: "プレイヤー1" }, // 重複
        { position: 2, name: "プレイヤー3" },
        { position: 3, name: "プレイヤー4" },
      ]

      const invalidInput = {
        gameType: "HANCHAN" as const,
        initialPoints: 25000,
        basePoints: 30000,
        uma: [15000, 5000, -5000, -15000],
        players: duplicatePlayers,
      }

      const result = CreateSoloGameSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "プレイヤー名に重複があります"
      )
    })

    it("プレイヤー位置の重複を拒否する", () => {
      const duplicatePositions = [
        { position: 0, name: "プレイヤー1" },
        { position: 0, name: "プレイヤー2" }, // 位置重複
        { position: 2, name: "プレイヤー3" },
        { position: 3, name: "プレイヤー4" },
      ]

      const invalidInput = {
        gameType: "HANCHAN" as const,
        initialPoints: 25000,
        basePoints: 30000,
        uma: [15000, 5000, -5000, -15000],
        players: duplicatePositions,
      }

      const result = CreateSoloGameSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "無効なプレイヤー位置があります"
      )
    })

    it("ウマの合計が0でない場合を拒否する", () => {
      const invalidInput = {
        gameType: "HANCHAN" as const,
        initialPoints: 25000,
        basePoints: 30000,
        uma: [20000, 5000, -5000, -15000], // 合計が5000
        players: validPlayers,
      }

      const result = CreateSoloGameSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "ウマの合計は0である必要があります"
      )
    })
  })

  describe("SoloScoreCalculationSchema", () => {
    it("有効なツモの点数計算データを検証できる", () => {
      const validTsumo = {
        winnerId: 0,
        han: 2,
        fu: 30,
        isTsumo: true,
        isOya: false,
        isDora: false,
        isUraDora: false,
        isAkaDora: false,
      }

      const result = SoloScoreCalculationSchema.safeParse(validTsumo)
      expect(result.success).toBe(true)
    })

    it("有効なロンの点数計算データを検証できる", () => {
      const validRon = {
        winnerId: 0,
        han: 2,
        fu: 30,
        isTsumo: false,
        isOya: false,
        isDora: false,
        isUraDora: false,
        isAkaDora: false,
        loserId: 1,
      }

      const result = SoloScoreCalculationSchema.safeParse(validRon)
      expect(result.success).toBe(true)
    })

    it("無効な翻符の組み合わせを拒否する", () => {
      const invalidHanFu = {
        winnerId: 0,
        han: 2,
        fu: 25, // 無効なfu値
        isTsumo: true,
        isOya: false,
        isDora: false,
        isUraDora: false,
        isAkaDora: false,
      }

      const result = SoloScoreCalculationSchema.safeParse(invalidHanFu)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "無効な翻符の組み合わせです"
      )
    })

    it("ツモで敗者を指定した場合を拒否する", () => {
      const invalidTsumo = {
        winnerId: 0,
        han: 2,
        fu: 30,
        isTsumo: true,
        isOya: false,
        isDora: false,
        isUraDora: false,
        isAkaDora: false,
        loserId: 1, // ツモで敗者指定
      }

      const result = SoloScoreCalculationSchema.safeParse(invalidTsumo)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "ツモの場合は敗者を指定できません"
      )
    })

    it("ロンで敗者を指定しない場合を拒否する", () => {
      const invalidRon = {
        winnerId: 0,
        han: 2,
        fu: 30,
        isTsumo: false,
        isOya: false,
        isDora: false,
        isUraDora: false,
        isAkaDora: false,
        // loserId未指定
      }

      const result = SoloScoreCalculationSchema.safeParse(invalidRon)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "ロンの場合は敗者の指定が必要です"
      )
    })

    it("勝者と敗者が同じ場合を拒否する", () => {
      const invalidRon = {
        winnerId: 0,
        han: 2,
        fu: 30,
        isTsumo: false,
        isOya: false,
        isDora: false,
        isUraDora: false,
        isAkaDora: false,
        loserId: 0, // 勝者と同じ
      }

      const result = SoloScoreCalculationSchema.safeParse(invalidRon)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe("勝者と敗者が同じです")
    })
  })

  describe("SoloRyukyokuSchema", () => {
    it("有効な流局データを検証できる", () => {
      const validRyukyoku = {
        type: "DRAW" as const,
        tenpaiPlayers: [0, 1],
        reachPlayers: [0],
      }

      const result = SoloRyukyokuSchema.safeParse(validRyukyoku)
      expect(result.success).toBe(true)
    })

    it("テンパイ者が4人を超える場合を拒否する", () => {
      const invalidRyukyoku = {
        type: "DRAW" as const,
        tenpaiPlayers: [0, 1, 2, 3, 4], // 5人
      }

      const result = SoloRyukyokuSchema.safeParse(invalidRyukyoku)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "テンパイ者は4人以下である必要があります"
      )
    })

    it("無効なプレイヤー位置を拒否する", () => {
      const invalidRyukyoku = {
        type: "DRAW" as const,
        tenpaiPlayers: [0, 5], // 5は無効な位置
      }

      const result = SoloRyukyokuSchema.safeParse(invalidRyukyoku)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "無効なプレイヤー位置があります"
      )
    })

    it("デフォルト値を適用する", () => {
      const minimalRyukyoku = {
        type: "DRAW" as const,
      }

      const result = SoloRyukyokuSchema.safeParse(minimalRyukyoku)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tenpaiPlayers).toEqual([])
      }
    })
  })

  describe("バリデーション関数", () => {
    describe("validatePlayerNames", () => {
      it("重複のない名前のリストを通す", () => {
        const players = [
          { name: "プレイヤー1" },
          { name: "プレイヤー2" },
          { name: "プレイヤー3" },
          { name: "プレイヤー4" },
        ]

        expect(validatePlayerNames(players)).toBe(true)
      })

      it("重複のある名前のリストを拒否する", () => {
        const players = [
          { name: "プレイヤー1" },
          { name: "プレイヤー1" }, // 重複
          { name: "プレイヤー3" },
          { name: "プレイヤー4" },
        ]

        expect(validatePlayerNames(players)).toBe(false)
      })

      it("空の名前を拒否する", () => {
        const players = [
          { name: "プレイヤー1" },
          { name: "" }, // 空文字
          { name: "プレイヤー3" },
          { name: "プレイヤー4" },
        ]

        expect(validatePlayerNames(players)).toBe(false)
      })

      it("空白のみの名前を拒否する", () => {
        const players = [
          { name: "プレイヤー1" },
          { name: "   " }, // 空白のみ
          { name: "プレイヤー3" },
          { name: "プレイヤー4" },
        ]

        expect(validatePlayerNames(players)).toBe(false)
      })

      it("前後の空白を除去して判定する", () => {
        const players = [
          { name: " プレイヤー1 " },
          { name: "プレイヤー1" }, // trim後重複
          { name: "プレイヤー3" },
          { name: "プレイヤー4" },
        ]

        expect(validatePlayerNames(players)).toBe(false)
      })
    })

    describe("validateReachPlayersTenpai", () => {
      it("リーチ者が全員テンパイしている場合を通す", () => {
        const reachPlayers = [0, 1]
        const tenpaiPlayers = [0, 1, 2]

        expect(validateReachPlayersTenpai(reachPlayers, tenpaiPlayers)).toBe(
          true
        )
      })

      it("リーチ者がテンパイしていない場合を拒否する", () => {
        const reachPlayers = [0, 1]
        const tenpaiPlayers = [0, 2] // 1がテンパイしていない

        expect(validateReachPlayersTenpai(reachPlayers, tenpaiPlayers)).toBe(
          false
        )
      })

      it("リーチ者がいない場合を通す", () => {
        const reachPlayers: number[] = []
        const tenpaiPlayers = [0, 1, 2]

        expect(validateReachPlayersTenpai(reachPlayers, tenpaiPlayers)).toBe(
          true
        )
      })
    })

    describe("calculateRanks", () => {
      it("点数順に正しく順位を計算する", () => {
        const players = [
          { position: 0, currentPoints: 35000 },
          { position: 1, currentPoints: 25000 },
          { position: 2, currentPoints: 20000 },
          { position: 3, currentPoints: 20000 }, // 同点
        ]

        const result = calculateRanks(players)

        expect(result).toEqual([
          { position: 0, rank: 1 }, // 35000点で1位
          { position: 1, rank: 2 }, // 25000点で2位
          { position: 2, rank: 3 }, // 20000点で3位
          { position: 3, rank: 4 }, // 20000点で4位（同点でも順序で決定）
        ])
      })

      it("単一プレイヤーでも動作する", () => {
        const players = [{ position: 0, currentPoints: 25000 }]

        const result = calculateRanks(players)
        expect(result).toEqual([{ position: 0, rank: 1 }])
      })
    })

    describe("calculateUma", () => {
      it("各順位に対して正しいウマを計算する", () => {
        expect(calculateUma(1)).toBe(15000)
        expect(calculateUma(2)).toBe(5000)
        expect(calculateUma(3)).toBe(-5000)
        expect(calculateUma(4)).toBe(-15000)
      })

      it("無効な順位に対して0を返す", () => {
        expect(calculateUma(0)).toBe(0)
        expect(calculateUma(5)).toBe(0)
        expect(calculateUma(-1)).toBe(0)
      })
    })

    describe("calculateSettlement", () => {
      it("精算を正しく計算する", () => {
        const finalPoints = 35000
        const basePoints = 30000
        const uma = 15000

        const result = calculateSettlement(finalPoints, basePoints, uma)
        expect(result).toBe(20000) // 35000 - 30000 + 15000
      })

      it("マイナスの精算も正しく計算する", () => {
        const finalPoints = 15000
        const basePoints = 30000
        const uma = -15000

        const result = calculateSettlement(finalPoints, basePoints, uma)
        expect(result).toBe(-30000) // 15000 - 30000 + (-15000)
      })
    })

    describe("getPlayerWind", () => {
      it("東1局での風牌を正しく取得する", () => {
        const currentOya = 0

        expect(getPlayerWind(0, currentOya)).toBe("東") // 親
        expect(getPlayerWind(1, currentOya)).toBe("南")
        expect(getPlayerWind(2, currentOya)).toBe("西")
        expect(getPlayerWind(3, currentOya)).toBe("北")
      })

      it("南1局での風牌を正しく取得する", () => {
        const currentOya = 1

        expect(getPlayerWind(0, currentOya)).toBe("北")
        expect(getPlayerWind(1, currentOya)).toBe("東") // 親
        expect(getPlayerWind(2, currentOya)).toBe("南")
        expect(getPlayerWind(3, currentOya)).toBe("西")
      })

      it("西1局での風牌を正しく取得する", () => {
        const currentOya = 2

        expect(getPlayerWind(0, currentOya)).toBe("西")
        expect(getPlayerWind(1, currentOya)).toBe("北")
        expect(getPlayerWind(2, currentOya)).toBe("東") // 親
        expect(getPlayerWind(3, currentOya)).toBe("南")
      })

      it("北1局での風牌を正しく取得する", () => {
        const currentOya = 3

        expect(getPlayerWind(0, currentOya)).toBe("南")
        expect(getPlayerWind(1, currentOya)).toBe("西")
        expect(getPlayerWind(2, currentOya)).toBe("北")
        expect(getPlayerWind(3, currentOya)).toBe("東") // 親
      })
    })

    describe("generateRyukyokuReason", () => {
      it("途中流局の理由を生成する", () => {
        const result = generateRyukyokuReason("ABORTIVE_DRAW", 2)
        expect(result).toBe("途中流局")
      })

      it("全員ノーテン流局の理由を生成する", () => {
        const result = generateRyukyokuReason("DRAW", 0)
        expect(result).toBe("全員ノーテン流局")
      })

      it("全員テンパイ流局の理由を生成する", () => {
        const result = generateRyukyokuReason("DRAW", 4)
        expect(result).toBe("全員テンパイ流局")
      })

      it("一部テンパイ流局の理由を生成する", () => {
        expect(generateRyukyokuReason("DRAW", 1)).toBe("1人テンパイ流局")
        expect(generateRyukyokuReason("DRAW", 2)).toBe("2人テンパイ流局")
        expect(generateRyukyokuReason("DRAW", 3)).toBe("3人テンパイ流局")
      })
    })
  })

  describe("定数とタイプ", () => {
    it("PLAYER_POSITIONSが正しく定義されている", () => {
      expect(PLAYER_POSITIONS).toEqual([0, 1, 2, 3])
    })

    it("SOLO_UMA_SETTINGSが正しく定義されている", () => {
      expect(SOLO_UMA_SETTINGS).toEqual({
        first: 15000,
        second: 5000,
        third: -5000,
        fourth: -15000,
      })
    })

    it("PlayerPosition型が正しく推論される", () => {
      const position: PlayerPosition = 0
      expect(typeof position).toBe("number")
      expect([0, 1, 2, 3]).toContain(position)
    })
  })

  describe("レスポンススキーマ", () => {
    describe("SoloGameStateResponseSchema", () => {
      it("有効なゲーム状態レスポンスを検証できる", () => {
        const validResponse = {
          success: true as const,
          data: {
            gameId: "550e8400-e29b-41d4-a716-446655440000",
            gameMode: "SOLO" as const,
            currentRound: 1,
            currentOya: 0,
            honba: 0,
            kyotaku: 0,
            status: "WAITING" as const,
            gameType: "HANCHAN" as const,
            initialPoints: 25000,
            hostPlayerId: "550e8400-e29b-41d4-a716-446655440001",
            players: [
              {
                position: 0,
                name: "プレイヤー1",
                currentPoints: 25000,
                isReach: false,
              },
              {
                position: 1,
                name: "プレイヤー2",
                currentPoints: 25000,
                isReach: false,
              },
              {
                position: 2,
                name: "プレイヤー3",
                currentPoints: 25000,
                isReach: false,
              },
              {
                position: 3,
                name: "プレイヤー4",
                currentPoints: 25000,
                isReach: false,
              },
            ],
          },
        }

        const result = SoloGameStateResponseSchema.safeParse(validResponse)
        expect(result.success).toBe(true)
      })
    })

    describe("SoloGameResultResponseSchema", () => {
      it("有効なゲーム結果レスポンスを検証できる", () => {
        const validResponse = {
          success: true as const,
          data: {
            gameId: "game-123",
            roomCode: "ABCD",
            results: [
              {
                playerId: "0",
                name: "プレイヤー1",
                finalPoints: 35000,
                rank: 1,
                uma: 15000,
                settlement: 20000,
              },
              {
                playerId: "1",
                name: "プレイヤー2",
                finalPoints: 25000,
                rank: 2,
                uma: 5000,
                settlement: 0,
              },
              {
                playerId: "2",
                name: "プレイヤー3",
                finalPoints: 20000,
                rank: 3,
                uma: -5000,
                settlement: -15000,
              },
              {
                playerId: "3",
                name: "プレイヤー4",
                finalPoints: 20000,
                rank: 4,
                uma: -15000,
                settlement: -25000,
              },
            ],
            gameType: "HANCHAN" as const,
            endReason: "自動終了",
            endedAt: "2024-01-01T00:00:00Z",
            basePoints: 30000,
            sessionId: undefined,
            sessionCode: undefined,
            sessionName: undefined,
            hostPlayerId: undefined,
            nextGame: null,
          },
        }

        const result = SoloGameResultResponseSchema.safeParse(validResponse)
        expect(result.success).toBe(true)
      })
    })
  })
})
