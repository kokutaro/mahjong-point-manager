# 点数計算機能 詳細設計

## 概要

麻雀の点数計算を自動化する機能の詳細設計です。翻数・符数から正確な点数を算出し、本場・供託を含めた点数分配を行います。

## 機能要件

### 基本点数計算

- **翻数・符数対応**: 1-13翻、20-110符の全パターン
- **親子判定**: 親と子で異なる点数計算
- **ツモ・ロン対応**: 支払い方法による分配の違い
- **特殊役対応**: 満貫・跳満・倍満・三倍満・役満

### 本場・供託計算

- **本場加算**: アガリ時に本場数×300点を加算
- **供託分配**: リーチ棒（1000点/本）をアガリ者が取得
- **分配計算**: ツモ時とロン時の支払い分担

## データ構造

### 点数マスタテーブル

```typescript
interface ScorePattern {
  id: string
  han: number // 翻数 (1-13)
  fu: number // 符数 (20,25,30,40,50,60,70,80,90,100,110)

  // 基本点数
  oyaPoints: number // 親アガリ時の点数
  koPoints: number // 子アガリ時の点数

  // ツモ時分配
  oyaTsumoAll: number // 親ツモ時: 子全員の支払い
  koTsumoOya: number // 子ツモ時: 親の支払い
  koTsumoKo: number // 子ツモ時: 他の子の支払い
}
```

### 点数計算結果

```typescript
interface ScoreResult {
  // 基本情報
  han: number
  fu: number
  isOya: boolean
  isTsumo: boolean

  // 基本点数
  basePoints: number

  // 分配詳細
  distribution: {
    winner: {
      playerId: string
      receives: number // 受け取り点数
    }
    losers: Array<{
      playerId: string
      pays: number // 支払い点数
    }>
  }

  // 本場・供託込み
  withBonuses: {
    honbaBonus: number // 本場ボーナス
    kyotakuBonus: number // 供託ボーナス
    totalReceives: number // 総受け取り点数
  }
}
```

## 点数計算ロジック

### 1. 基本点数計算

```typescript
function calculateBaseScore(han: number, fu: number, isOya: boolean): number {
  // 役満判定 (13翻以上)
  if (han >= 13) {
    return isOya ? 48000 : 32000
  }

  // 特殊役判定
  if (han >= 11) return isOya ? 36000 : 24000 // 三倍満
  if (han >= 8) return isOya ? 24000 : 16000 // 倍満
  if (han >= 6) return isOya ? 18000 : 12000 // 跳満
  if (han >= 5) return isOya ? 12000 : 8000 // 満貫

  // 通常計算
  let baseScore = fu * Math.pow(2, han + 2)

  // 親の場合は×1.5
  if (isOya) {
    baseScore = Math.floor(baseScore * 1.5)
  }

  // 100点単位で切り上げ
  return Math.ceil(baseScore / 100) * 100
}
```

### 2. ツモ時分配計算

```typescript
function calculateTsumoDistribution(
  baseScore: number,
  isOya: boolean,
  winnerId: string,
  participants: GameParticipant[]
): ScoreDistribution {
  if (isOya) {
    // 親ツモ: 子全員が均等支払い
    const koPayment = Math.ceil(baseScore / 3 / 100) * 100

    return {
      winner: { playerId: winnerId, receives: koPayment * 3 },
      losers: participants
        .filter((p) => p.playerId !== winnerId)
        .map((p) => ({ playerId: p.playerId, pays: koPayment })),
    }
  } else {
    // 子ツモ: 親が2倍、他の子が1倍
    const oyaPayment = Math.ceil(baseScore / 2 / 100) * 100
    const koPayment = Math.ceil(baseScore / 4 / 100) * 100

    return {
      winner: { playerId: winnerId, receives: oyaPayment + koPayment * 2 },
      losers: participants
        .filter((p) => p.playerId !== winnerId)
        .map((p) => ({
          playerId: p.playerId,
          pays: isOya(p.position) ? oyaPayment : koPayment,
        })),
    }
  }
}
```

### 3. ロン時分配計算

```typescript
function calculateRonDistribution(
  baseScore: number,
  winnerId: string,
  loserId: string
): ScoreDistribution {
  return {
    winner: { playerId: winnerId, receives: baseScore },
    losers: [{ playerId: loserId, pays: baseScore }],
  }
}
```

### 4. 本場・供託計算

```typescript
function calculateBonuses(
  distribution: ScoreDistribution,
  honba: number,
  kyotaku: number,
  isTsumo: boolean
): BonusCalculation {
  // 本場ボーナス計算
  const honbaBonus = honba * 300
  let honbaDistribution: { [playerId: string]: number } = {}

  if (isTsumo) {
    // ツモ時: 全員が本場×100点支払い
    const honbaPerPlayer = honba * 100
    distribution.losers.forEach((loser) => {
      honbaDistribution[loser.playerId] = honbaPerPlayer
    })
  } else {
    // ロン時: ロンされた人が本場×300点支払い
    honbaDistribution[distribution.losers[0].playerId] = honbaBonus
  }

  // 供託ボーナス (アガリ者が全て取得)
  const kyotakuBonus = kyotaku * 1000

  return {
    honbaBonus,
    kyotakuBonus,
    honbaDistribution,
    totalReceives: distribution.winner.receives + honbaBonus + kyotakuBonus,
  }
}
```

## 点数マスタデータ

### データ生成ロジック

```typescript
function generateScorePatterns(): ScorePattern[] {
  const patterns: ScorePattern[] = []
  const fuValues = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110]

  for (let han = 1; han <= 4; han++) {
    for (const fu of fuValues) {
      // 20符は2翻以上、25符は2翻以上など制約あり
      if ((fu === 20 && han < 2) || (fu === 25 && han < 2)) continue

      const oyaPoints = calculateBaseScore(han, fu, true)
      const koPoints = calculateBaseScore(han, fu, false)

      patterns.push({
        id: `${han}-${fu}`,
        han,
        fu,
        oyaPoints,
        koPoints,
        oyaTsumoAll: Math.ceil(oyaPoints / 3 / 100) * 100,
        koTsumoOya: Math.ceil(koPoints / 2 / 100) * 100,
        koTsumoKo: Math.ceil(koPoints / 4 / 100) * 100,
      })
    }
  }

  // 満貫以上の固定値を追加
  const specialScores = [
    { han: 5, name: "満貫", oya: 12000, ko: 8000 },
    { han: 6, name: "跳満", oya: 18000, ko: 12000 },
    { han: 8, name: "倍満", oya: 24000, ko: 16000 },
    { han: 11, name: "三倍満", oya: 36000, ko: 24000 },
    { han: 13, name: "役満", oya: 48000, ko: 32000 },
  ]

  specialScores.forEach((score) => {
    patterns.push({
      id: `${score.han}-special`,
      han: score.han,
      fu: 30, // 代表値
      oyaPoints: score.oya,
      koPoints: score.ko,
      oyaTsumoAll: Math.ceil(score.oya / 3 / 100) * 100,
      koTsumoOya: Math.ceil(score.ko / 2 / 100) * 100,
      koTsumoKo: Math.ceil(score.ko / 4 / 100) * 100,
    })
  })

  return patterns
}
```

## サービス層実装

### ScoreCalculatorService

```typescript
export class ScoreCalculatorService {
  private scorePatterns: Map<string, ScorePattern> = new Map()

  constructor(private prisma: PrismaClient) {
    this.loadScorePatterns()
  }

  private async loadScorePatterns() {
    const patterns = await this.prisma.scorePattern.findMany()
    patterns.forEach((pattern) => {
      this.scorePatterns.set(`${pattern.han}-${pattern.fu}`, pattern)
    })
  }

  /**
   * 点数計算メイン関数
   */
  async calculateScore(input: ScoreInput): Promise<ScoreResult> {
    const {
      han,
      fu,
      winnerId,
      targetId,
      participants,
      honba,
      kyotaku,
      isTsumo,
    } = input

    // 基本点数取得
    const pattern = this.getScorePattern(han, fu)
    if (!pattern) {
      throw new Error(`Invalid han/fu combination: ${han}翻${fu}符`)
    }

    // 親判定
    const winner = participants.find((p) => p.playerId === winnerId)
    const isOya = winner?.position === this.getCurrentOyaPosition()

    // 基本点数
    const baseScore = isOya ? pattern.oyaPoints : pattern.koPoints

    // 分配計算
    const distribution = isTsumo
      ? this.calculateTsumoDistribution(pattern, winnerId, participants, isOya)
      : this.calculateRonDistribution(baseScore, winnerId, targetId!)

    // 本場・供託計算
    const bonuses = this.calculateBonuses(distribution, honba, kyotaku, isTsumo)

    return {
      han,
      fu,
      isOya,
      isTsumo,
      basePoints: baseScore,
      distribution,
      withBonuses: bonuses,
    }
  }

  private getScorePattern(han: number, fu: number): ScorePattern | null {
    // 満貫以上は符数に関係なく固定
    if (han >= 5) {
      return (
        this.scorePatterns.get(`${han}-special`) ||
        this.scorePatterns.get(`5-special`)
      ) // 満貫をデフォルト
    }

    return this.scorePatterns.get(`${han}-${fu}`)
  }

  /**
   * 点数変更を適用
   */
  async applyScoreChange(
    gameId: string,
    scoreResult: ScoreResult
  ): Promise<GameParticipant[]> {
    return await this.prisma.$transaction(async (tx) => {
      const participants = await tx.gameParticipant.findMany({
        where: { gameId },
      })

      // 点数更新処理
      const updates = this.generatePointUpdates(participants, scoreResult)

      // 並行更新
      await Promise.all(
        updates.map((update) =>
          tx.gameParticipant.update({
            where: { id: update.participantId },
            data: { currentPoints: update.newPoints },
          })
        )
      )

      return await tx.gameParticipant.findMany({
        where: { gameId },
        include: { player: true },
      })
    })
  }

  private generatePointUpdates(
    participants: GameParticipant[],
    scoreResult: ScoreResult
  ): PointUpdate[] {
    const updates: PointUpdate[] = []

    // 勝者の点数更新
    const winner = participants.find(
      (p) => p.playerId === scoreResult.distribution.winner.playerId
    )
    if (winner) {
      updates.push({
        participantId: winner.id,
        newPoints: winner.currentPoints + scoreResult.withBonuses.totalReceives,
      })
    }

    // 敗者の点数更新
    scoreResult.distribution.losers.forEach((loser) => {
      const participant = participants.find(
        (p) => p.playerId === loser.playerId
      )
      if (participant) {
        updates.push({
          participantId: participant.id,
          newPoints: participant.currentPoints - loser.pays,
        })
      }
    })

    return updates
  }
}
```

## API実装

### 点数計算エンドポイント

```typescript
// app/api/score/calculate/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const input = scoreInputSchema.parse(body)

    const scoreService = new ScoreCalculatorService(prisma)
    const result = await scoreService.calculateScore(input)

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CALCULATION_ERROR",
          message: error.message,
        },
      },
      { status: 400 }
    )
  }
}
```

### バリデーションスキーマ

```typescript
import { z } from "zod"

export const scoreInputSchema = z.object({
  han: z.number().min(1).max(13),
  fu: z
    .number()
    .refine((fu) =>
      [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110].includes(fu)
    ),
  winnerId: z.string(),
  targetId: z.string().optional(),
  isTsumo: z.boolean(),
  honba: z.number().min(0).max(99),
  kyotaku: z.number().min(0).max(99),
})
```

## フロントエンド実装

### Zustand Store

```typescript
interface ScoreStore {
  // 状態
  selectedHan: number
  selectedFu: number
  isCalculating: boolean
  lastResult: ScoreResult | null

  // アクション
  setHan: (han: number) => void
  setFu: (fu: number) => void
  calculateScore: (input: ScoreInput) => Promise<ScoreResult>
  applyScore: (gameId: string, result: ScoreResult) => Promise<void>
}

export const useScoreStore = create<ScoreStore>((set, get) => ({
  selectedHan: 1,
  selectedFu: 30,
  isCalculating: false,
  lastResult: null,

  setHan: (han) => set({ selectedHan: han }),
  setFu: (fu) => set({ selectedFu: fu }),

  calculateScore: async (input) => {
    set({ isCalculating: true })
    try {
      const response = await fetch("/api/score/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error.message)

      set({ lastResult: data.data })
      return data.data
    } finally {
      set({ isCalculating: false })
    }
  },

  applyScore: async (gameId, result) => {
    // WebSocket経由でリアルタイム更新
    const socket = useSocket()
    socket.emit("apply-score", { gameId, scoreResult: result })
  },
}))
```

### React Components

```typescript
// 翻数・符数選択コンポーネント
export const ScoreSelector: React.FC = () => {
  const { selectedHan, selectedFu, setHan, setFu } = useScoreStore();

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium mb-2">翻数</label>
        <select
          value={selectedHan}
          onChange={(e) => setHan(Number(e.target.value))}
          className="w-full p-2 border rounded"
        >
          {Array.from({length: 13}, (_, i) => i + 1).map(han => (
            <option key={han} value={han}>
              {han}翻 {han >= 13 ? '(役満)' : han >= 5 ? getSpecialName(han) : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">符数</label>
        <select
          value={selectedFu}
          onChange={(e) => setFu(Number(e.target.value))}
          className="w-full p-2 border rounded"
          disabled={selectedHan >= 5} // 満貫以上は符数無関係
        >
          {[20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110].map(fu => (
            <option key={fu} value={fu}>{fu}符</option>
          ))}
        </select>
      </div>
    </div>
  );
};
```

## テスト設計

### 単体テスト

```typescript
describe("ScoreCalculatorService", () => {
  let service: ScoreCalculatorService

  beforeEach(() => {
    service = new ScoreCalculatorService(mockPrisma)
  })

  describe("calculateScore", () => {
    it("親の3翻30符ツモを正しく計算する", async () => {
      const input = {
        han: 3,
        fu: 30,
        winnerId: "player1",
        isTsumo: true,
        participants: mockParticipants,
        honba: 1,
        kyotaku: 2,
      }

      const result = await service.calculateScore(input)

      expect(result.basePoints).toBe(3900)
      expect(result.distribution.winner.receives).toBe(3900)
      expect(result.withBonuses.totalReceives).toBe(6200) // 3900 + 300 + 2000
    })

    it("子の2翻40符ロンを正しく計算する", async () => {
      const input = {
        han: 2,
        fu: 40,
        winnerId: "player2",
        targetId: "player1",
        isTsumo: false,
        participants: mockParticipants,
        honba: 0,
        kyotaku: 0,
      }

      const result = await service.calculateScore(input)

      expect(result.basePoints).toBe(2600)
      expect(result.distribution.losers[0].pays).toBe(2600)
    })
  })
})
```

## エラーハンドリング

### バリデーションエラー

- 無効な翻数・符数の組み合わせ
- 存在しないプレイヤーID
- ゲーム状態の不整合

### 計算エラー

- オーバーフロー・アンダーフロー
- 点数分配の不整合
- データベース更新失敗

### 復旧処理

- トランザクションによる整合性保証
- エラー時の状態ロールバック
- WebSocket再接続による状態同期
