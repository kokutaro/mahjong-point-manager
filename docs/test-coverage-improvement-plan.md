# テストカバレッジ改善計画

## 1. 現状分析

現在のテストカバレッジ: **15.93%**（目標: 80%以上）

### 1.1. カバレッジ状況別分類

#### 1.1.1. 高カバレッジ（80%以上）

- `app/api/sessions/route.ts`: 94.11%
- `app/api/game/[gameId]/end/route.ts`: 89.18%
- `app/solo/create/page.tsx`: 83.6%
- `app/api/room/join/route.ts`: 81.42%

#### 1.1.2. 中カバレッジ（50-79%）

- `app/api/solo/create/route.ts`: 68.75%
- `app/api/game/[gameId]/route.ts`: 59.18%
- `app/api/sessions/[sessionId]/route.ts`: 57.5%

#### 1.1.3. 低カバレッジ（0-49%）

- **大部分のAPIエンドポイント**: 0%
- **UIコンポーネント**: 多くが0%
- **重要なライブラリ**:
  - `lib/point-manager.ts`: 36.43%
  - `lib/auth.ts`: 32.43%
  - `lib/error-handler.ts`: 19.81%

## 2. 改善戦略

### 2.1. 優先度判定基準

1. **ビジネス影響度**: 点数計算、ゲーム管理などの中核機能
2. **使用頻度**: よく使われる機能
3. **バグリスク**: 障害時の影響範囲
4. **テスト効率**: 少ない工数で大きなカバレッジ向上が期待できるもの

## 3. フェーズ別実装計画

### 3.1. フェーズ1: 重要ビジネスロジック（目標カバレッジ: 95%）

**期間**: 2週間  
**優先度**: 最高

#### 3.1.1. 対象ファイル

1. `lib/point-manager.ts` (現在: 36.43%)
2. `lib/score.ts` (現在: 0%)
3. `lib/solo/solo-point-manager.ts` (現在: 27.02%)
4. `lib/vote-analysis.ts` (現在: 50%)

#### 3.1.2. 実装するテスト

- **点数計算ロジック**
  - 正常系: 標準的な和了、ツモ、ロン
  - 異常系: 不正な点数、範囲外の値
  - 境界値: 最大/最小点数
- **ゲーム状態管理**
  - 局の進行管理
  - プレイヤー状態の更新
  - リーチ、流局の処理
- **投票システム**
  - 投票の集計
  - 過半数判定
  - 無効票の処理

### 3.2. フェーズ2: 主要APIエンドポイント（目標カバレッジ: 80%）

**期間**: 3週間  
**優先度**: 高

#### 3.2.1. 対象エンドポイント（現在0%のもの）

1. `app/api/game/[gameId]/score/route.ts`
2. `app/api/game/[gameId]/riichi/route.ts`
3. `app/api/game/[gameId]/ryukyoku/route.ts`
4. `app/api/game/[gameId]/result/route.ts`
5. `app/api/room/create/route.ts`
6. `app/api/players/route.ts`

#### 3.2.2. 実装するテスト

- **統合テスト**
  - HTTPリクエスト/レスポンス
  - データベース操作
  - 認証・認可
- **エラーハンドリング**
  - 400 Bad Request
  - 401 Unauthorized
  - 404 Not Found
  - 500 Internal Server Error
- **バリデーション**
  - 入力データ検証
  - パラメータ検証

### 3.3. フェーズ3: UIコンポーネント（目標カバレッジ: 70%）

**期間**: 2週間  
**優先度**: 中

#### 3.3.1. 対象コンポーネント（現在0%のもの）

1. `components/ScoreInputForm.tsx`
2. `components/RyukyokuForm.tsx`
3. `components/GameInfo.tsx`
4. `components/LoadingSpinner.tsx`
5. `app/game/[gameId]/page.tsx`
6. `app/room/[roomCode]/page.tsx`

#### 3.3.2. 実装するテスト

- **レンダリングテスト**
  - コンポーネントの正常な表示
  - プロパティの反映
- **ユーザーインタラクション**
  - ボタンクリック
  - フォーム入力
  - バリデーション表示
- **状態管理**
  - ローカル状態の更新
  - プロパティの変更対応

### 3.4. フェーズ4: ユーティリティ・認証（目標カバレッジ: 85%）

**期間**: 1週間  
**優先度**: 中

#### 3.4.1. 対象ファイル

1. `lib/auth.ts` (現在: 32.43%)
2. `lib/error-handler.ts` (現在: 19.81%)
3. `lib/utils.ts` (現在: 31.57%)
4. `schemas/` (現在: 27.58%)

#### 3.4.2. 実装するテスト

- **認証機能**
  - トークン検証
  - セッション管理
  - 権限チェック
- **エラーハンドリング**
  - エラー分類
  - ログ出力
  - レスポンス生成
- **バリデーションスキーマ**
  - Zodスキーマのテスト
  - 正常系・異常系の検証

## 4. 技術的実装方針

### 4.1. テストフレームワーク

#### 4.1.1. 単体テスト

- **Jest + @testing-library/react**: Reactコンポーネント
- **Jest**: ユーティリティ関数、ビジネスロジック

#### 4.1.2. 統合テスト

- **Jest + Supertest**: APIエンドポイント
- **MSW (Mock Service Worker)**: 外部API呼び出しのモック

#### 4.1.3. E2Eテスト

- **Playwright**: 重要なユーザーフロー

### 4.2. モック戦略

```typescript
// Prismaクライアントのモック
jest.mock("@/lib/prisma", () => ({
  prisma: {
    game: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    player: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

// WebSocketのモック
jest.mock("@/lib/socket", () => ({
  broadcastToRoom: jest.fn(),
  broadcastToGame: jest.fn(),
}))
```

### 4.3. テストデータ管理

```typescript
// テストファクトリーの活用
export const createTestGame = (overrides?: Partial<Game>): Game => ({
  id: "test-game-id",
  roomId: "test-room-id",
  players: createTestPlayers(),
  currentRound: 1,
  currentDealer: 0,
  status: "active",
  ...overrides,
})

export const createTestPlayer = (overrides?: Partial<Player>): Player => ({
  id: "test-player-id",
  name: "テストプレイヤー",
  score: 25000,
  position: 0,
  ...overrides,
})
```

## 5. 品質保証

### 5.1. 自動化

- **pre-commit hooks**: テスト実行の強制
- **CI/CD**: PRごとのカバレッジチェック
- **品質ゲート**: カバレッジ80%未満でマージブロック

### 5.2. カバレッジ監視

```json
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    },
    "./lib/point-manager.ts": {
      "branches": 95,
      "functions": 95,
      "lines": 95,
      "statements": 95
    }
  }
}
```

## 6. 実装スケジュール

| フェーズ  | 期間     | 担当者  | 成果物                       |
| --------- | -------- | ------- | ---------------------------- |
| フェーズ1 | Week 1-2 | 開発者A | 重要ビジネスロジックのテスト |
| フェーズ2 | Week 3-5 | 開発者B | 主要APIのテスト              |
| フェーズ3 | Week 6-7 | 開発者C | UIコンポーネントのテスト     |
| フェーズ4 | Week 8   | 全員    | ユーティリティのテスト完了   |

## 7. 成功指標

### 7.1. 定量的指標

- **全体カバレッジ**: 15.93% → 80%以上
- **重要モジュールカバレッジ**: 95%以上
- **テスト実行時間**: 5分以内
- **失敗率**: 1%未満

### 7.2. 定性的指標

- **バグ検出率の向上**
- **リファクタリング時の安全性向上**
- **新機能開発の品質向上**
- **開発者の信頼性向上**

## 8. リスク管理

### 8.1. 技術的リスク

- **テスト実行時間の増大**: 並列実行、効率的なモック
- **フレキシブルテストの維持**: テストの可読性重視
- **CI/CDパイプラインの負荷**: 段階的なテスト実行

### 8.2. プロジェクトリスク

- **開発速度の一時的低下**: 段階的導入で影響最小化
- **学習コスト**: テストベストプラクティスの共有
- **メンテナンスコスト**: 自動化による工数削減

## 9. 長期的な品質戦略

1. **テスト駆動開発（TDD）の導入**
2. **継続的リファクタリング**
3. **品質メトリクスの可視化**
4. **定期的なテストレビュー**

---

**次のアクション**: フェーズ1から開始し、週次でプログレスレビューを実施
