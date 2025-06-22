# 対局終了・精算機能 詳細設計

## 概要

麻雀対局の終了処理と最終精算を行う機能です。ウマ・オカの計算、特殊ルール（トビ賞・焼き鳥）の適用、最終順位の確定を自動化します。

## 機能要件

### 終局判定

- **規定局数終了**: 東風戦・半荘戦の完了判定
- **トビ終了**: 0点未満での強制終了
- **30000点到達**: 親番での高得点終了
- **時間制限**: 制限時間による強制終了

### 精算計算

- **ウマ計算**: 順位による点数分配
- **オカ計算**: 配給原点からのプラス分配
- **特殊ルール**: トビ賞・焼き鳥ペナルティ
- **最終精算**: 実際の金額計算

### 結果管理

- **順位確定**: 最終点数による順位決定
- **統計記録**: 対局データの保存
- **結果表示**: 分かりやすい結果画面

## データ構造

### 精算データ

```typescript
interface GameSettlement {
  gameId: string;
  endReason: EndReason;
  endedAt: Date;
  
  // 最終結果
  finalResults: PlayerResult[];
  
  // 精算設定
  settings: SettlementSettings;
  
  // 精算詳細
  calculations: SettlementCalculation;
}

interface PlayerResult {
  playerId: string;
  playerName: string;
  position: number;          // 座席位置
  
  // 点数情報
  finalPoints: number;       // 最終点数
  rawPoints: number;         // 補正前点数
  pointDifference: number;   // 配給原点との差
  
  // 順位・精算
  rank: number;              // 最終順位 (1-4)
  uma: number;               // ウマ
  oka: number;               // オカ
  penalties: PenaltyInfo[];  // ペナルティ
  settlement: number;        // 最終精算額
}

interface SettlementSettings {
  startingPoints: number;    // 配給原点 (25000)
  returnPoints: number;      // 返し点 (30000)
  
  // ウマ設定
  umaSettings: {
    first: number;           // 1位ウマ
    second: number;          // 2位ウマ
    third: number;           // 3位ウマ
    fourth: number;          // 4位ウマ
  };
  
  // 特殊ルール
  hasOka: boolean;
  hasTobi: boolean;
  hasYakitori: boolean;
  tobiPenalty: number;
  yakitoriPenalty: number;
}
```

## コア実装

### SettlementService

```typescript
export class SettlementService {
  constructor(private prisma: PrismaClient) {}
  
  async processGameEnd(
    gameId: string,
    endReason: EndReason
  ): Promise<GameSettlement> {
    return await this.prisma.$transaction(async (tx) => {
      // 最終状態取得
      const game = await tx.game.findUnique({
        where: { id: gameId },
        include: {
          participants: { include: { player: true } },
          settings: true
        }
      });
      
      // 順位確定
      const rankedResults = this.calculateRankings(game.participants);
      
      // 精算計算
      const settlement = this.calculateSettlement(rankedResults, game.settings);
      
      // 結果保存
      await this.saveGameResult(tx, gameId, settlement);
      
      // ゲーム状態更新
      await tx.game.update({
        where: { id: gameId },
        data: { status: 'FINISHED', endedAt: new Date() }
      });
      
      return settlement;
    });
  }
  
  private calculateRankings(
    participants: GameParticipant[]
  ): PlayerResult[] {
    // 点数順でソート（同点の場合は起家に近い順）
    const sorted = participants
      .sort((a, b) => {
        if (a.currentPoints !== b.currentPoints) {
          return b.currentPoints - a.currentPoints;
        }
        return a.position - b.position;
      })
      .map((p, index) => ({
        playerId: p.playerId,
        playerName: p.player.name,
        position: p.position,
        finalPoints: p.currentPoints,
        rawPoints: p.currentPoints,
        pointDifference: p.currentPoints - 25000,
        rank: index + 1,
        uma: 0,
        oka: 0,
        penalties: [],
        settlement: 0
      }));
    
    return sorted;
  }
  
  private calculateSettlement(
    results: PlayerResult[],
    settings: GameSettings
  ): SettlementCalculation {
    const calculations = {
      totalUma: 0,
      totalOka: 0,
      totalPenalties: 0,
      verification: { isBalanced: true, difference: 0 }
    };
    
    // ウマ計算
    if (settings.umaSettings) {
      const umaValues = [
        settings.umaSettings.first,
        settings.umaSettings.second,
        settings.umaSettings.third,
        settings.umaSettings.fourth
      ];
      
      results.forEach((result, index) => {
        result.uma = umaValues[index];
        calculations.totalUma += result.uma;
      });
    }
    
    // オカ計算
    if (settings.hasOka) {
      const totalPoints = results.reduce((sum, r) => sum + r.finalPoints, 0);
      const expectedTotal = settings.startingPoints * 4;
      const okaPool = totalPoints - expectedTotal;
      
      if (okaPool > 0) {
        const okaPerPlayer = Math.floor(okaPool / 1000) * 250; // 1000点につき250円
        results.forEach(result => {
          result.oka = okaPerPlayer;
          calculations.totalOka += okaPerPlayer;
        });
      }
    }
    
    // 特殊ペナルティ
    this.applyPenalties(results, settings, calculations);
    
    // 最終精算額計算
    results.forEach(result => {
      const pointValue = Math.floor(result.pointDifference / 1000) * 100; // 1000点=100円
      result.settlement = pointValue + result.uma + result.oka 
        - result.penalties.reduce((sum, p) => sum + p.amount, 0);
    });
    
    // 収支バランス検証
    this.verifySettlement(results, calculations);
    
    return calculations;
  }
  
  private applyPenalties(
    results: PlayerResult[],
    settings: GameSettings,
    calculations: SettlementCalculation
  ): void {
    results.forEach(result => {
      // トビ賞
      if (settings.hasTobi && result.finalPoints < 0) {
        result.penalties.push({
          type: 'TOBI',
          amount: settings.tobiPenalty,
          description: 'トビ賞'
        });
        calculations.totalPenalties += settings.tobiPenalty;
      }
      
      // 焼き鳥 (アガリ回数0回の判定は別途実装)
      if (settings.hasYakitori && this.hasNoWins(result.playerId)) {
        result.penalties.push({
          type: 'YAKITORI',
          amount: settings.yakitoriPenalty,
          description: '焼き鳥'
        });
        calculations.totalPenalties += settings.yakitoriPenalty;
      }
    });
  }
}
```

## 特殊ルール対応

### ウマ設定パターン

```typescript
const UMA_PRESETS = {
  standard: { first: 20000, second: 10000, third: -10000, fourth: -20000 },
  tournament: { first: 30000, second: 10000, third: -10000, fourth: -30000 },
  casual: { first: 10000, second: 5000, third: -5000, fourth: -10000 }
};
```

### オカ計算方式

```typescript
interface OkaCalculation {
  method: 'EQUAL_DISTRIBUTION' | 'WINNER_TAKES_ALL' | 'PROPORTIONAL';
  baseUnit: number;           // 計算単位 (1000点など)
  rate: number;               // 変換レート (250円/1000点など)
}
```

## 結果表示

### 精算結果画面

```typescript
const SettlementResult = ({ settlement }: { settlement: GameSettlement }) => {
  return (
    <div className="settlement-result">
      <h2>対局結果</h2>
      
      {/* 最終順位表 */}
      <div className="ranking-table">
        {settlement.finalResults.map((result, index) => (
          <div key={result.playerId} className="rank-row">
            <span className="rank">{result.rank}位</span>
            <span className="name">{result.playerName}</span>
            <span className="points">{result.finalPoints.toLocaleString()}</span>
            <span className="settlement">
              {result.settlement > 0 ? '+' : ''}{result.settlement}
            </span>
          </div>
        ))}
      </div>
      
      {/* 精算詳細 */}
      <SettlementBreakdown settlement={settlement} />
    </div>
  );
};
```

## イベントフロー

### 対局終了フロー

```text
1. 終局条件判定
2. 最終点数確定
3. 順位計算
4. ウマ・オカ・ペナルティ計算
5. 最終精算額確定
6. 結果保存
7. 全プレイヤーに結果通知
8. 結果画面表示
```

## バリデーション

### 精算データ検証

```typescript
const validateSettlement = (results: PlayerResult[]): ValidationResult => {
  const errors: string[] = [];
  
  // 収支バランス
  const totalSettlement = results.reduce((sum, r) => sum + r.settlement, 0);
  if (Math.abs(totalSettlement) > 100) { // 100円の誤差まで許容
    errors.push(`収支が合いません: ${totalSettlement}円`);
  }
  
  // 順位重複チェック
  const ranks = results.map(r => r.rank);
  if (new Set(ranks).size !== ranks.length) {
    errors.push('順位に重複があります');
  }
  
  return { isValid: errors.length === 0, errors };
};
```

## エラーハンドリング

### 精算エラー

- **CalculationError**: 計算結果異常
- **BalanceError**: 収支不整合
- **RankingError**: 順位決定エラー

### 復旧処理

- **再計算**: エラー時の精算再実行
- **手動補正**: 管理者による手動調整
- **履歴保持**: 計算過程の完全記録

## テスト設計

### 精算計算テスト

```typescript
describe('SettlementService', () => {
  it('標準ウマで正しく精算される', async () => {
    const participants = [
      { playerId: '1', currentPoints: 35000 },
      { playerId: '2', currentPoints: 25000 },
      { playerId: '3', currentPoints: 20000 },
      { playerId: '4', currentPoints: 20000 }
    ];
    
    const result = await settlementService.calculateSettlement(
      participants, standardSettings
    );
    
    expect(result.finalResults[0].settlement).toBe(21000); // +10000 + 20000 - 9000
    expect(result.finalResults[1].settlement).toBe(10000); // 0 + 10000
    expect(result.calculations.verification.isBalanced).toBe(true);
  });
});
```
