# テスト失敗分析レポート

## 実行日時

2025-01-26

## 失敗テスト概要

- **失敗テストスイート数**: 4
- **失敗テスト数**: 41
- **成功テスト数**: 888
- **総テスト数**: 929

## 失敗しているテストファイル

### 1. ✅ src/app/api/room/[roomCode]/rejoin/**tests**/route.test.ts **【解決済み】**

#### 問題の種類

- ~~**NextResponse Cookie設定エラー**~~ → **解決完了**

#### 解決内容

```typescript
// NextResponse全体をモック化
jest.mock("next/server", () => ({
  ...originalModule,
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: jest.fn(() => Promise.resolve(data)),
      status: init?.status || 200,
      cookies: { set: jest.fn() },
    })),
  },
}))
```

#### 修正結果

- **15テスト全て成功**
- NextResponse Cookie APIエラー完全解消
- 認証フローも正常動作

### 2. ✅ src/hooks/**tests**/useSocket.test.ts **【解決済み】**

#### 問題の種類

- ~~**EventBusモックの不完全性**~~ → **解決完了**
- ~~**Mock関数の呼び出し回数不一致**~~ → **解決完了**

#### 解決内容

```typescript
// EventEmitterリーク対策
newBus.setMaxListeners(200)

// 再接続回数修正
socketClientMock.connect.mockClear()
expect(socketClientMock.connect).toHaveBeenCalledTimes(2)

// クリーンアップテスト修正
expect(mockSocket.disconnect).toHaveBeenCalled()
```

#### 修正結果

- **32テスト全て成功**
- EventEmitterメモリリーク完全解消
- 再接続ロジック・クリーンアップ処理正常動作

### 3. src/components/common/**tests**/BaseScoreInputForm.test.tsx

#### 問題の種類

- **Mantineコンポーネントのモック不備**
- **バリデーション機能の想定外動作**

#### エラー詳細

```
Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.

expect(submitButton).toBeDisabled()
Expected element to be disabled, but it wasn't.

expect(jest.fn()).not.toHaveBeenCalled()
Expected number of calls: 0
Received number of calls: 1
```

#### 原因分析

1. **Stepper.Stepモックの問題**
   - MantineのStepperコンポーネントのStep子コンポーネントが正しくモックされていない
   - Object.assignによるStepプロパティの設定が不完全

2. **フォームバリデーションの問題**
   - トビ状態（points: 0）のプレイヤーの和了制限が効いていない
   - 期待されるバリデーション処理が動作していない

3. **ボタン状態の問題**
   - ボタンのdisabled属性が期待通りに設定されていない
   - フォーム状態とUI状態の同期問題

#### 影響範囲

- スコア入力フォーム全体
- Mantineコンポーネント使用箇所
- フォームバリデーション機能

### 4. src/components/common/**tests**/BaseRyukyokuForm.test.tsx

#### 問題の種類

- **未使用インポートによるlintエラー**

#### エラー詳細

```
'fireEvent' is defined but never used  @typescript-eslint/no-unused-vars
'waitFor' is defined but never used  @typescript-eslint/no-unused-vars
'MultiGamePlayer' is defined but never used  @typescript-eslint/no-unused-vars
'ScoreSubmissionData' is defined but never used  @typescript-eslint/no-unused-vars
'currentOya' is defined but never used  @typescript-eslint/no-unused-vars
```

#### 原因分析

- テスト実装時に使用されなくなったインポートが残存
- 単純なクリーンアップ不備

#### 影響範囲

- コードの品質チェック
- CI/CDパイプライン

## 修正優先度

### 高優先度

1. **BaseScoreInputForm.test.tsx** - 機能の中核部分
2. **rejoin/route.test.ts** - APIの重要機能

### 中優先度

3. **useSocket.test.ts** - リアルタイム機能

### 低優先度

4. **BaseRyukyokuForm.test.ts** - lintエラーのみ

## 修正方針

### 1. NextResponse Cookie問題

- NextResponseのモック戦略を見直し
- createMocksの代わりに、Next.js用のテストヘルパーを検討
- Cookie設定部分を別関数に分離してモック化を容易にする

### 2. EventBus モック問題

- EventBusのモック設定を完全にjest.fn()で統一
- フックのライフサイクルテストを詳細に検証
- beforeEach/afterEachでのモック初期化を改善

### 3. Mantine モック問題

- Stepperコンポーネントのモック構造を修正
- Object.assignの代わりに、より直接的なモック定義を採用
- テスト用のMantineコンポーネントラッパーを作成

### 4. フォームバリデーション問題

- BaseScoreInputFormの実装を確認し、バリデーション仕様を明確化
- テストケースの期待値を実装に合わせて調整
- バリデーション関数の単体テストを追加

### 5. lint問題

- 未使用インポートを削除
- ESLintルールに従ったコードクリーンアップ

## 次のアクション

1. lint問題を最初に修正（簡単なため）
2. NextResponse Cookie問題の調査と修正
3. Mantineモック問題の修正
4. EventBusモック問題の修正
5. バリデーション問題の詳細調査と修正
