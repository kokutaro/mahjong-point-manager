# Phase 1: ゲーム明確終了機能 - 基本的なホスト権限強化

## 1. 概要

現在、対局終了画面から「ホームに戻る」した際に、セッションが「継続可能なセッション」として表示される問題を解決するため、段階的にゲーム明確終了機能を実装します。

Phase 1では、低リスク・高効果な基本的なホスト権限強化を実装し、セキュリティ向上とユーザビリティ改善を図ります。

## 2. 実装目標

### 2.1. ホスト表示機能の実装

- **目的**: ゲーム結果画面でホストを明確に識別表示
- **効果**: プレイヤーがホストの権限を理解し、責任の所在を明確化

### 2.2. 強制終了API権限チェック強化  

- **目的**: ホスト以外による不正な強制終了を防止
- **効果**: セキュリティ脆弱性の解決と権限の明確化

## 3. 詳細技術仕様

### 3.1. ホスト表示機能

#### 3.1.1. 実装箇所

- **ファイル**: `src/components/GameResult.tsx`
- **表示位置**: プレイヤー名の右側にホストバッジを表示

#### 3.1.2. UI仕様

```tsx
// ホストバッジのデザイン
<span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full border border-yellow-300">
  👑 ホスト
</span>
```

#### 3.1.3. 表示条件

- `result.playerId === hostPlayerId` の場合にのみ表示
- セッション情報から `hostPlayerId` を取得
- 認証情報から現在のプレイヤーIDを確認

#### 3.1.4. データフロー

```text
1. GameResult.tsx → useAppStore から currentSession 取得
2. currentSession.hostPlayerId を確認
3. 各プレイヤーの playerId と比較
4. 一致するプレイヤーにホストバッジを表示
```

### 3.2. 強制終了API権限チェック強化

#### 3.2.1. 実装箇所

- **ファイル**: `src/app/api/game/[gameId]/end/route.ts`
- **機能**: 既存の強制終了APIにホスト権限チェックを追加

#### 3.2.2. セキュリティ仕様

```typescript
export async function POST(request: Request, { params }: { params: { gameId: string } }) {
  try {
    // 1. 認証確認
    const player = await requireAuth()
    
    // 2. ホスト権限チェック
    const hasHostAccess = await checkHostAccess(params.gameId, player.playerId)
    
    if (!hasHostAccess) {
      return NextResponse.json(
        { error: 'この操作にはホスト権限が必要です' }, 
        { status: 403 }
      )
    }
    
    // 3. 既存の強制終了処理
    const reason = await request.json().then(body => body.reason) || 'HOST_FORCE_END'
    
    // ... 既存の実装継続
    
  } catch (error) {
    console.error('Game end error:', error)
    return NextResponse.json(
      { error: 'ゲーム終了処理でエラーが発生しました' }, 
      { status: 500 }
    )
  }
}
```

#### 3.2.3. 権限チェック関数の確認

```typescript
// /lib/auth.ts の checkHostAccess 関数を利用
async function checkHostAccess(gameId: string, playerId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { hostPlayerId: true }
  })
  
  return game?.hostPlayerId === playerId
}
```

#### 3.2.4. エラーハンドリング

- **403 Forbidden**: ホスト権限なしの場合
- **404 Not Found**: ゲームが存在しない場合  
- **500 Internal Server Error**: システムエラーの場合

### 3.3. データベース影響

#### 3.3.1. 既存テーブル構造の確認

```sql
-- Game テーブル（既存）
Game {
  id: String @id
  hostPlayerId: String
  hostPlayer: Player @relation(fields: [hostPlayerId], references: [id])
  -- その他既存フィールド
}

-- GameSession テーブル（既存）
GameSession {
  id: String @id
  hostPlayerId: String  
  hostPlayer: Player @relation(fields: [hostPlayerId], references: [id])
  -- その他既存フィールド
}
```

**Phase 1では既存のデータベース構造をそのまま活用し、新しいマイグレーションは不要です。**

### 3.4. フロントエンド状態管理

#### 3.4.1. Zustand ストア連携

```typescript
// useAppStore から既存のセッション情報を活用
const { currentSession } = useAppStore()
const hostPlayerId = currentSession?.hostPlayerId

// 現在のプレイヤー情報
const { user } = useAuth()
const isHost = user?.playerId === hostPlayerId
```

#### 3.4.2. 型定義の確認

```typescript
// 既存の型定義を活用
interface GameSession {
  id: string
  hostPlayerId: string
  // ... その他のフィールド
}

interface GameResult {
  playerId: string
  playerName: string
  finalScore: number
  settlement: number
  rank: number
}
```

## 4. テスト計画

### 4.1. ホスト表示機能のテスト

#### 4.1.1. Unit Tests

```typescript
// GameResult.test.tsx
describe('Host Badge Display', () => {
  it('should display host badge for host player', () => {
    const props = {
      results: [{ playerId: 'host123', playerName: 'ホストプレイヤー' }],
      hostPlayerId: 'host123'
    }
    
    render(<GameResult {...props} />)
    expect(screen.getByText('👑 ホスト')).toBeInTheDocument()
  })
  
  it('should not display host badge for non-host players', () => {
    const props = {
      results: [{ playerId: 'player123', playerName: '一般プレイヤー' }],
      hostPlayerId: 'host123'
    }
    
    render(<GameResult {...props} />)
    expect(screen.queryByText('👑 ホスト')).not.toBeInTheDocument()
  })
})
```

#### 4.1.2. Integration Tests

- セッション情報の正しい取得確認
- 複数プレイヤー間でのホスト識別確認
- ホスト移譲後の表示更新確認（将来機能）

### 4.2. 強制終了API権限チェックのテスト

#### 4.2.1. Unit Tests

```typescript
// api/game/[gameId]/end.test.ts
describe('Game End API Authorization', () => {
  it('should allow host to end game', async () => {
    // モックデータでホストとして認証
    const response = await request(app)
      .post('/api/game/test-game-id/end')
      .set('Authorization', 'Bearer host-token')
      .send({ reason: 'HOST_FORCE_END' })
    
    expect(response.status).toBe(200)
  })
  
  it('should deny non-host to end game', async () => {
    // モックデータで非ホストとして認証
    const response = await request(app)
      .post('/api/game/test-game-id/end')
      .set('Authorization', 'Bearer non-host-token')
      .send({ reason: 'UNAUTHORIZED_ATTEMPT' })
    
    expect(response.status).toBe(403)
    expect(response.body.error).toContain('ホスト権限が必要です')
  })
  
  it('should handle unauthenticated requests', async () => {
    const response = await request(app)
      .post('/api/game/test-game-id/end')
      .send({ reason: 'NO_AUTH' })
    
    expect(response.status).toBe(401)
  })
})
```

#### 4.2.2. E2E Tests

- ホストによる強制終了フローの完全テスト
- 非ホストプレイヤーによる不正アクセス防止確認
- WebSocket通知の正常な配信確認

## 5. 実装チェックリスト

### 5.1. 事前準備

- [ ] 既存の `checkHostAccess` 関数の動作確認
- [ ] GameResult.tsx の現在の実装理解
- [ ] テスト環境での認証システム確認

### 5.2. 実装作業

- [ ] GameResult.tsx にホストバッジ表示機能追加
- [ ] CSS スタイルの調整とレスポンシブ対応
- [ ] 強制終了API に権限チェック追加
- [ ] エラーメッセージの多言語対応（日本語）

### 5.3. テスト作業

- [ ] Unit Tests の実装と実行
- [ ] Integration Tests の実装と実行
- [ ] 手動テストでの動作確認
- [ ] 権限エラーケースの確認

### 5.4. 品質保証

- [ ] ESLint エラーの解消
- [ ] TypeScript エラーの解消
- [ ] コードレビューの実施
- [ ] セキュリティ観点での確認

## 6. リスク分析と対策

### 6.1. 低リスク要因

✅ **既存API構造の活用**: 新しいエンドポイント作成不要
✅ **既存認証システムの活用**: 追加の認証システム不要  
✅ **段階的実装**: 大幅な機能変更なし

### 6.2. 潜在的リスク

⚠️ **権限チェックによるパフォーマンス影響**: データベースクエリの追加
⚠️ **UI表示の不整合**: ホスト情報の同期ずれ

### 6.3. 対策

- **パフォーマンス**: 既存の `checkHostAccess` 関数の最適化済み実装を活用
- **同期問題**: Zustand ストアの既存セッション管理を活用

## 7. 完了基準

### 7.1. 機能面

1. ゲーム結果画面でホストが明確に識別できる
2. 非ホストプレイヤーが強制終了APIを呼び出せない
3. すべてのテストケースが PASS する

### 7.2. 非機能面  

1. ページ表示速度に影響がない
2. 既存機能に悪影響を与えない
3. セキュリティ脆弱性が解消される

### 7.3. ユーザー体験

1. ホストの責任範囲が明確になる
2. 不正な強制終了によるトラブルが防止される
3. 将来のPhase 2実装の基盤が整う

## 8. 次のPhaseへの準備

Phase 1の完了により、以下の基盤が整います：

- **ホスト権限の可視化**: プレイヤーがホストを認識可能
- **セキュリティ基盤**: 権限チェックの実装パターン確立
- **UI基盤**: ホスト専用機能の表示枠組み準備

これらはPhase 2での「ホスト専用強制終了ボタン」実装において重要な前提条件となります。
