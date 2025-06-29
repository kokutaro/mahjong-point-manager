# Phase 2: ゲーム明確終了機能 - ホスト専用強制終了ボタン

## 1. 概要

Phase 1で実装したホスト権限基盤を活用し、ゲーム結果画面にホスト専用の強制終了ボタンを実装します。これにより、ホストが明示的にセッションを終了できるようになり、「継続可能なセッション」として残り続ける問題を解決します。

## 2. 実装目標

### 2.1. ホスト専用強制終了ボタンの実装

- **目的**: ゲーム結果画面でホストが明示的にセッションを終了
- **効果**: 「もう1局」の意思決定を待たずに確実なセッション終了

### 2.2. 確認ダイアログシステム

- **目的**: 誤操作防止のための2段階確認
- **効果**: 意図しないセッション終了を防止

### 2.3. 強制終了時の通知システム

- **目的**: 全プレイヤーへの適切な終了理由通知
- **効果**: プレイヤー間のコミュニケーション向上

## 3. 詳細技術仕様

### 3.1. ホスト専用強制終了ボタン

#### 3.1.1. UI配置とデザイン

```tsx
// GameResult.tsx内のアクションボタンエリア
<div className="mb-4">
  {/* 既存のボタン */}
  <button onClick={onBack}>ゲームに戻る</button>
  <button onClick={() => (window.location.href = "/")}>ホームに戻る</button>

  {/* 新規追加: ホスト専用強制終了ボタン */}
  {isHost && (
    <button
      onClick={handleHostForceEnd}
      className="bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors ml-4"
    >
      ⚠️ セッション強制終了
    </button>
  )}
</div>
```

#### 3.1.2. 表示条件ロジック

```tsx
// ホスト判定ロジック
const { user } = useAuth()
const isHost = user?.playerId === resultData.hostPlayerId
const isSessionActive = resultData.sessionId && !isWaitingForVotes

// 表示条件
// 1. 現在のユーザーがホスト
// 2. セッションが存在する
// 3. 継続投票中でない
const showForceEndButton = isHost && isSessionActive
```

#### 3.1.3. レスポンシブデザイン対応

```tsx
// モバイル・タブレット・PC対応
<button className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors mb-3 sm:mb-0 sm:ml-4">
  ⚠️ セッション強制終了
</button>
```

### 3.2. 確認ダイアログシステム

#### 3.2.1. モーダルコンポーネントの実装

```tsx
// ForceEndConfirmModal.tsx
interface ForceEndConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  sessionName?: string
}

export default function ForceEndConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  sessionName,
}: ForceEndConfirmModalProps) {
  const [reason, setReason] = useState("")
  const [customReason, setCustomReason] = useState("")

  const predefinedReasons = [
    "ホストによる終了",
    "時間切れ",
    "技術的問題",
    "プレイヤー都合",
    "その他",
  ]

  const handleConfirm = () => {
    const finalReason = reason === "その他" ? customReason : reason
    onConfirm(finalReason)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            セッション強制終了の確認
          </h3>

          <div className="mb-6">
            <p className="text-gray-600 mb-2">
              セッション「{sessionName}」を強制終了しますか？
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-yellow-800 text-sm">
                ⚠️
                この操作は取り消せません。全てのプレイヤーがセッションから退出します。
              </p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              終了理由を選択してください
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">理由を選択...</option>
              {predefinedReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {reason === "その他" && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="詳細な理由を入力してください"
                className="w-full mt-2 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              disabled={
                !reason || (reason === "その他" && !customReason.trim())
              }
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              強制終了
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

#### 3.2.2. GameResult.tsxへの統合

```tsx
// State追加
const [showForceEndModal, setShowForceEndModal] = useState(false)

// ハンドラー実装
const handleHostForceEnd = () => {
  setShowForceEndModal(true)
}

const handleForceEndConfirm = async (reason: string) => {
  if (!resultData) return

  try {
    setLoading(true)
    const response = await fetch(`/api/game/${resultData.gameId}/end`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    })

    const data = await response.json()

    if (!response.ok) {
      if (response.status === 403) {
        setGlobalError("ホスト権限が必要です")
      } else if (response.status === 401) {
        setGlobalError("認証が必要です")
      } else {
        setGlobalError(data.error?.message || "セッション終了に失敗しました")
      }
      return
    }

    // 成功時はホームに遷移
    window.location.href = "/"
  } catch (error) {
    console.error("Force end failed:", error)
    setGlobalError("セッション終了に失敗しました")
  } finally {
    setLoading(false)
  }
}
```

### 3.3. 強制終了時の通知システム

#### 3.3.1. WebSocket通知の拡張

現在のWebSocket通知システムを拡張し、強制終了の詳細情報を含めます。

```typescript
// Socket.IO サーバーサイド
io.to(game.roomCode).emit("session_force_ended", {
  gameState: updatedGameState,
  reason: validatedData.reason,
  endedBy: {
    playerId: player.playerId,
    name: player.name,
  },
  endedAt: new Date().toISOString(),
  forced: true,
})
```

#### 3.3.2. フロントエンド通知受信

```tsx
// GameResult.tsx内のWebSocket処理拡張
socketInstance.on(
  "session_force_ended",
  ({
    reason,
    endedBy,
  }: {
    reason: string
    endedBy: { playerId: string; name: string }
  }) => {
    // ホスト以外のプレイヤーに通知
    if (user?.playerId !== endedBy.playerId) {
      alert(
        `セッションが${endedBy.name}により強制終了されました。\n理由: ${reason}`
      )
    }

    // 5秒後にホームページに遷移
    setTimeout(() => {
      window.location.href = "/"
    }, 5000)
  }
)
```

### 3.4. セッション状態の更新

#### 3.4.1. データベース更新処理

```typescript
// /lib/point-manager.ts 内の forceEndGame メソッド拡張
async forceEndGame(reason: string, endedBy?: string): Promise<void> {
  const transaction = await this.prisma.$transaction(async (tx) => {
    // ゲーム状態を FINISHED に更新
    await tx.game.update({
      where: { id: this.gameId },
      data: {
        status: 'FINISHED',
        endedAt: new Date()
      }
    })

    // セッション状態を FINISHED に更新
    const game = await tx.game.findUnique({
      where: { id: this.gameId },
      select: { sessionId: true }
    })

    if (game?.sessionId) {
      await tx.gameSession.update({
        where: { id: game.sessionId },
        data: {
          status: 'FINISHED',
          endedAt: new Date()
        }
      })
    }

    // 強制終了イベントを記録
    await tx.gameEvent.create({
      data: {
        gameId: this.gameId,
        eventType: 'FORCE_END',
        eventData: {
          reason,
          endedBy,
          timestamp: new Date().toISOString()
        }
      }
    })
  })
}
```

## 4. UI/UX設計

### 4.1. ボタン配置案

```text
┌─────────────────────────────────────┐
│  対局結果 - 東風戦第1局                │
├─────────────────────────────────────┤
│  [順位表とプレイヤー情報]               │
├─────────────────────────────────────┤
│  [アクションボタンエリア]               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │ゲームに戻る│ │ホームに戻る│ │⚠️強制終了│ │
│  └─────────┘ └─────────┘ └─────────┘ │
│                           ↑ホスト専用│
├─────────────────────────────────────┤
│  [継続オプションエリア]                │
│  ┌─────────────────┐ ┌─────────────┐  │
│  │セッション継続(全員合意)│ │新しいセッション│  │
│  └─────────────────┘ └─────────────┘  │
└─────────────────────────────────────┘
```

### 4.2. 確認ダイアログ

```text
┌───────────────────────────────┐
│ セッション強制終了の確認      │
├───────────────────────────────┤
│ セッション「○○」を強制終了    │
│ しますか？                   │
│                              │
│ ⚠️ この操作は取り消せません    │
│                              │
│ 終了理由: [ドロップダウン]     │
│                              │
│ ┌─────────┐ ┌──────────┐    │
│ │キャンセル│ │強制終了    │    │
│ └─────────┘ └──────────┘    │
└───────────────────────────────┘
```

## 5. テスト計画

### 5.1. ホスト専用ボタン表示のテスト

#### 5.1.1. Unit Tests

```typescript
// GameResult.test.tsx への追加
describe('Host Force End Button', () => {
  test('ホストユーザーに強制終了ボタンが表示される', () => {
    const hostUser = { playerId: 'host-id', name: 'ホスト' }
    const data = { ...mockGameResultData, hostPlayerId: 'host-id' }

    // useAuthモックでホストユーザーを返すよう設定
    ;(useAuth as jest.Mock).mockReturnValue({ user: hostUser })

    render(<GameResult gameId="test" onBack={jest.fn()} />)

    expect(screen.getByText('⚠️ セッション強制終了')).toBeInTheDocument()
  })

  test('非ホストユーザーに強制終了ボタンが表示されない', () => {
    const nonHostUser = { playerId: 'player-id', name: 'プレイヤー' }
    const data = { ...mockGameResultData, hostPlayerId: 'host-id' }

    ;(useAuth as jest.Mock).mockReturnValue({ user: nonHostUser })

    render(<GameResult gameId="test" onBack={jest.fn()} />)

    expect(screen.queryByText('⚠️ セッション強制終了')).not.toBeInTheDocument()
  })
})
```

### 5.2. 確認ダイアログのテスト

```typescript
describe('Force End Confirmation Modal', () => {
  test('強制終了ボタンクリックで確認ダイアログが表示される', async () => {
    render(<GameResult gameId="test" onBack={jest.fn()} />)

    const forceEndButton = screen.getByText('⚠️ セッション強制終了')
    fireEvent.click(forceEndButton)

    expect(screen.getByText('セッション強制終了の確認')).toBeInTheDocument()
  })

  test('理由選択なしでは確定ボタンが無効', () => {
    render(<ForceEndConfirmModal isOpen={true} onClose={jest.fn()} onConfirm={jest.fn()} />)

    const confirmButton = screen.getByText('強制終了')
    expect(confirmButton).toBeDisabled()
  })
})
```

### 5.3. API統合テスト

```typescript
describe('Host Force End API Integration', () => {
  test('ホストが強制終了を実行できる', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })
    global.fetch = mockFetch

    render(<GameResult gameId="test" onBack={jest.fn()} />)

    // 強制終了フローを実行
    fireEvent.click(screen.getByText('⚠️ セッション強制終了'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ホストによる終了' } })
    fireEvent.click(screen.getByText('強制終了'))

    expect(mockFetch).toHaveBeenCalledWith('/api/game/test/end', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ reason: 'ホストによる終了' })
    }))
  })
})
```

## 6. 実装チェックリスト

### 6.1. 事前準備

- [ ] Phase 1のホスト表示機能が正常動作していることを確認
- [ ] 既存の強制終了APIが正しく権限チェックを行うことを確認
- [ ] WebSocket通知システムの動作確認

### 6.2. UI実装

- [ ] ForceEndConfirmModal コンポーネントの作成
- [ ] GameResult.tsx にホスト専用ボタン追加
- [ ] レスポンシブデザインの実装
- [ ] 確認ダイアログのUIテスト

### 6.3. 機能実装

- [ ] 強制終了ハンドラーの実装
- [ ] WebSocket通知の拡張
- [ ] エラーハンドリングの実装
- [ ] セッション状態更新の確認

### 6.4. テスト実装

- [ ] ホストボタン表示テストの作成
- [ ] 確認ダイアログテストの作成
- [ ] API統合テストの作成
- [ ] E2Eテストシナリオの作成

### 6.5. 品質保証

- [ ] TypeScript型チェック
- [ ] ESLintエラー解消
- [ ] アクセシビリティ確認
- [ ] セキュリティ観点での確認

## 7. リスク分析と対策

### 7.1. 中リスク要因

⚠️ **UI複雑化**: 新しいモーダルコンポーネントの追加
⚠️ **WebSocket通知**: リアルタイム通知の信頼性
⚠️ **状態管理**: モーダル表示状態の管理

### 7.2. 対策

- **段階的実装**: 基本ボタン → 確認ダイアログ → 通知システムの順で実装
- **既存パターン活用**: 既存の継続投票モーダルのパターンを参考
- **フォールバック**: WebSocket失敗時のポーリング代替手段

### 7.3. 低リスク要因

✅ **既存API活用**: Phase 1で実装済みの強制終了APIを活用
✅ **権限基盤**: ホスト権限チェックの基盤が整備済み
✅ **UI基盤**: 既存のボタンスタイルとレイアウトパターンを活用

## 8. 完了基準

### 8.1. 機能面

1. ホストのみに強制終了ボタンが表示される
2. 確認ダイアログで誤操作を防止できる
3. 全プレイヤーに適切な終了通知が送信される
4. セッション状態が正しく更新される

### 8.2. 非機能面

1. レスポンシブデザインで全デバイス対応
2. アクセシビリティ基準を満たす
3. 5秒以内のレスポンス時間
4. エラー時の適切なユーザー通知

### 8.3. ユーザー体験

1. ホストが明確にセッションを終了できる
2. 誤操作による意図しない終了を防止
3. 他プレイヤーへの適切な終了理由通知
4. 直感的で分かりやすい操作フロー

## 9. Phase 3への準備

Phase 2の完了により、以下が整います：

- **明示的終了手段**: ホストによる確実なセッション終了
- **通知システム**: リアルタイム状態変更通知の基盤
- **UI基盤**: モーダルベースの意思決定システム

これらはPhase 3での「全員合意終了システム」において重要な基盤技術となります。
