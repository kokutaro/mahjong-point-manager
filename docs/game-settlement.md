# 対局終了・精算機能 詳細設計

## 概要

麻雀対局の終了処理と最終精算を行う機能です。**オカ機能は廃止**され、ウマとトビ終了のみに対応。返し点（base points）設定により精算を行います。

## 実装済み機能

### 終局判定 ✅

- **規定局数終了**: 東風戦（東4局）・半荘戦（南4局）の完了判定
- **トビ終了**: 0点以下での強制終了（設定により有効/無効）
- **手動終了**: 管理者による強制終了機能

### 精算計算 ✅

- **ウマ計算**: 順位による点数分配（プリセット + カスタム対応）
- **返し点計算**: 配給原点25,000点 + 設定可能な返し点（20,000〜50,000点）
- **トビ終了対応**: 設定により有効/無効を切り替え可能
- **最終精算**: 素点差分 + ウマによる精算

### 結果管理 ✅

- **順位確定**: 最終点数による順位決定（同点時は起家順）
- **統計記録**: 対局データの自動保存
- **結果表示**: GameResult コンポーネントによる結果画面
- **履歴管理**: 対局履歴・統計の表示機能

## 実装済みデータ構造

### 精算データ (PointManager.calculateSettlement)

```typescript
interface SettlementResult {
  playerId: string;
  finalPoints: number;
  rank: number;              // 最終順位 (1-4)
  pointDiff: number;         // 返し点との差分
  roundedDiff: number;       // 千点単位での差分
  uma: number;               // ウマ
  settlement: number;        // 最終精算額
}

interface GameSettings {
  initialPoints: number;     // 配給原点 (25000)
  basePoints: number;        // 返し点 (設定可能)
  gameType: 'TONPUU' | 'HANCHAN';
  uma: number[];             // [1位, 2位, 3位, 4位]
  hasTobi: boolean;          // トビ終了有効/無効
}
```

### データベースモデル

```typescript
model GameResult {
  id          String   @id @default(cuid())
  gameId      String   @unique
  playerId    String
  finalPoints Int
  rank        Int
  pointDiff   Int
  uma         Int
  settlement  Int
  createdAt   DateTime @default(now())
}
```

## 実装済みコアロジック

### PointManager.calculateSettlement (実装済み)

```typescript
// src/lib/point-manager.ts
class PointManager {
  private calculateSettlement(
    participants: GameParticipant[],
    settings: { uma: number[]; basePoints: number }
  ): SettlementResult[] {
    
    // 1. 順位計算（点数順、同点時は起家順）
    const sortedParticipants = participants
      .map(p => ({
        ...p,
        pointDiff: p.currentPoints - settings.basePoints,
        roundedDiff: Math.round((p.currentPoints - settings.basePoints) / 1000)
      }))
      .sort((a, b) => {
        if (a.currentPoints !== b.currentPoints) {
          return b.currentPoints - a.currentPoints; // 高得点順
        }
        return a.position - b.position; // 同点時は起家順
      });

    // 2. ウマ適用
    const resultsWithUma = sortedParticipants.map((participant, index) => ({
      playerId: participant.playerId,
      finalPoints: participant.currentPoints,
      rank: index + 1,
      pointDiff: participant.pointDiff,
      roundedDiff: participant.roundedDiff,
      uma: settings.uma[index],
      settlement: 0 // 後で計算
    }));

    // 3. 最終精算額計算
    const othersTotal = resultsWithUma
      .slice(1) // 1位以外
      .reduce((sum, result) => sum + result.roundedDiff, 0);
    
    // 1位の精算額は他の3人の合計の逆数 + ウマ
    resultsWithUma[0].settlement = -othersTotal + resultsWithUma[0].uma;
    
    // 2-4位の精算額は素点差 + ウマ
    for (let i = 1; i < resultsWithUma.length; i++) {
      resultsWithUma[i].settlement = resultsWithUma[i].roundedDiff + resultsWithUma[i].uma;
    }

    return resultsWithUma;
  }
  
  // ゲーム終了時の最終結果保存
  async calculateFinalResults(): Promise<void> {
    const participants = await this.getParticipants();
    const settings = await this.getGameSettings();
    
    const results = this.calculateSettlement(participants, settings);
    
    // データベースに結果保存
    await this.saveFinalResults(results, participants);
    
    // ゲーム状態を終了に更新
    await prisma.game.update({
      where: { id: this.gameId },
      data: { status: 'FINISHED', endedAt: new Date() }
    });
  }
}
```

### ゲーム終了判定 (実装済み)

```typescript
// src/lib/point-manager.ts  
async checkGameEnd(): Promise<{ shouldEnd: boolean; reason?: string }> {
  const participants = await this.getParticipants();
  const game = await prisma.game.findUnique({
    where: { id: this.gameId },
    include: { settings: true }
  });

  // 1. トビ判定
  const tobiPlayer = participants.find(p => p.currentPoints <= 0);
  if (tobiPlayer && game.settings?.hasTobi) {
    return { 
      shouldEnd: true, 
      reason: `トビ終了: ${tobiPlayer.playerId}がマイナス点数` 
    };
  }

  // 2. 規定局数終了判定
  const gameEndResult = this.checkRoundEnd(game, game.settings?.gameType);
  return gameEndResult;
}

private checkRoundEnd(game: any, gameType?: string): { shouldEnd: boolean; reason?: string } {
  if (gameType === 'TONPUU' && game.currentRound > 4) {
    return { shouldEnd: true, reason: '東風戦終了: 東4局完了' };
  }
  if (gameType === 'HANCHAN' && game.currentRound > 8) {
    return { shouldEnd: true, reason: '半荘戦終了: 南4局完了' };
  }
  return { shouldEnd: false };
}
```

## 実装済み特殊ルール

### ウマ設定パターン ✅

```typescript
// src/app/room/create/page.tsx で実装済み
const UMA_PRESETS = {
  gottou: [10, 5, -5, -10],    // ゴットー
  onetwo: [20, 10, -10, -20],  // ワンツー  
  onethree: [30, 10, -10, -30] // ワンスリー
};
```

### ルーム作成時の設定 ✅

- **ゲーム種別**: 東風戦 / 半荘戦
- **配給原点**: 25,000点 (固定)
- **返し点**: 20,000〜50,000点 (設定可能)
- **ウマ**: プリセット選択 + カスタム設定
- **トビ終了**: 有効 / 無効

### 廃止された機能

- ❌ **オカ計算**: 返し点システムに統合
- ❌ **焼き鳥ルール**: 将来実装予定

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
