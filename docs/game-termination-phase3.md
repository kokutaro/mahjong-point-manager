# Phase 3: ゲーム明確終了機能 - 全員合意終了システム

## 1. 概要

Phase 1のホスト権限基盤とPhase 2のホスト専用強制終了機能を基盤として、全員参加による民主的なセッション終了システムを実装します。従来の継続/辞退の2択投票を拡張し、継続/終了/保留の3択投票システムを構築することで、プレイヤー全員の合意によるセッション終了を実現します。

## 2. 実装目標

### 2.1. 3択投票システムの実装

- **目的**: 継続/終了/保留の3つの選択肢による民主的な意思決定
- **効果**: 全員合意によるセッション終了で「継続可能なセッション」問題を解決

### 2.2. 全員合意終了ロジック

- **目的**: 全員が「終了」を選択した場合の自動セッション終了
- **効果**: プレイヤー間の意思統一による自然なセッション終了

### 2.3. 投票タイムアウト機能

- **目的**: 長時間の投票待機防止とデッドロック回避
- **効果**: スムーズなゲーム進行と放置対策

## 3. 詳細技術仕様

### 3.1. 投票システムの拡張

#### 3.1.1. 投票選択肢の定義

```typescript
// 投票選択肢の型定義
type VoteOption = 'continue' | 'end' | 'pause'

interface VoteData {
  gameId: string
  playerId: string
  vote: VoteOption
  votedAt: string
}

interface VoteState {
  [playerId: string]: VoteOption
}
```

#### 3.1.2. 投票UI設計

```tsx
// GameResult.tsx内の投票エリア
<div className="bg-green-50 p-4 rounded-lg">
  <h3 className="text-lg font-semibold text-green-800 mb-3">セッションをどうしますか？</h3>
  
  {!isWaitingForVotes ? (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* 継続ボタン */}
      <button
        onClick={() => handleVote('continue')}
        className="bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
      >
        🔄 セッション継続
      </button>
      
      {/* 終了ボタン */}
      <button
        onClick={() => handleVote('end')}
        className="bg-red-600 text-white py-3 px-6 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
      >
        ✋ セッション終了
      </button>
      
      {/* 保留ボタン */}
      <button
        onClick={() => handleVote('pause')}
        className="bg-yellow-600 text-white py-3 px-6 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors"
      >
        ⏸️ 保留・様子見
      </button>
    </div>
  ) : (
    <VotingProgress 
      votes={votes}
      players={resultData.results}
      currentUser={user}
      onCancelVote={handleCancelVote}
    />
  )}
</div>
```

### 3.2. 投票進行状況コンポーネント

#### 3.2.1. VotingProgress コンポーネント

```tsx
// VotingProgress.tsx
interface VotingProgressProps {
  votes: VoteState
  players: PlayerResult[]
  currentUser: { playerId: string; name: string } | null
  onCancelVote: () => void
}

export default function VotingProgress({ 
  votes, 
  players, 
  currentUser, 
  onCancelVote 
}: VotingProgressProps) {
  const getVoteIcon = (vote: VoteOption | undefined) => {
    switch (vote) {
      case 'continue': return '🔄'
      case 'end': return '✋'
      case 'pause': return '⏸️'
      default: return '⏳'
    }
  }

  const getVoteLabel = (vote: VoteOption | undefined) => {
    switch (vote) {
      case 'continue': return '継続'
      case 'end': return '終了'
      case 'pause': return '保留'
      default: return '投票中'
    }
  }

  const getVoteColor = (vote: VoteOption | undefined) => {
    switch (vote) {
      case 'continue': return 'bg-green-100 text-green-800 border-green-200'
      case 'end': return 'bg-red-100 text-red-800 border-red-200'
      case 'pause': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center text-green-700 font-medium">
        全員の投票を待っています...
      </div>
      
      {/* 投票状況の表示 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.map((player) => {
          const isMyself = currentUser?.playerId === player.playerId
          const vote = isMyself ? votes[player.playerId] : votes[player.playerId]
          
          return (
            <div key={player.playerId} className="flex items-center justify-between p-3 bg-white rounded-lg border">
              <div className="flex items-center">
                <span className="text-sm font-medium">{player.name}</span>
                {isMyself && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    あなた
                  </span>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getVoteColor(vote)}`}>
                <span className="mr-1">{getVoteIcon(vote)}</span>
                {getVoteLabel(vote)}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* 投票集計サマリー */}
      <div className="bg-white p-3 rounded-lg border">
        <div className="text-sm text-gray-600 mb-2">投票集計:</div>
        <div className="flex justify-between text-sm">
          <span>🔄 継続: {Object.values(votes).filter(v => v === 'continue').length}票</span>
          <span>✋ 終了: {Object.values(votes).filter(v => v === 'end').length}票</span>
          <span>⏸️ 保留: {Object.values(votes).filter(v => v === 'pause').length}票</span>
        </div>
      </div>
      
      {/* キャンセルボタン */}
      {currentUser && votes[currentUser.playerId] && (
        <button
          onClick={onCancelVote}
          className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
        >
          投票を取り消す
        </button>
      )}
    </div>
  )
}
```

### 3.3. 投票ロジックとセッション終了判定

#### 3.3.1. 合意判定ロジック

```typescript
// 投票結果に基づく処理判定
interface VoteResult {
  action: 'continue' | 'end' | 'wait'
  message: string
  details: {
    continueVotes: number
    endVotes: number
    pauseVotes: number
    totalPlayers: number
  }
}

function analyzeVotes(votes: VoteState, totalPlayers: number): VoteResult {
  const voteCount = Object.values(votes)
  const continueVotes = voteCount.filter(v => v === 'continue').length
  const endVotes = voteCount.filter(v => v === 'end').length
  const pauseVotes = voteCount.filter(v => v === 'pause').length
  
  const details = { continueVotes, endVotes, pauseVotes, totalPlayers }
  
  // 全員投票済みの場合
  if (voteCount.length === totalPlayers) {
    if (endVotes === totalPlayers) {
      return {
        action: 'end',
        message: '全員がセッション終了に合意しました。セッションを終了します。',
        details
      }
    } else if (continueVotes > 0) {
      return {
        action: 'continue',
        message: `${continueVotes}名がセッション継続を希望しています。継続プロセスを開始します。`,
        details
      }
    } else {
      // 全員が保留の場合
      return {
        action: 'wait',
        message: '全員が保留を選択しました。再度投票を行ってください。',
        details
      }
    }
  }
  
  // まだ投票中
  return {
    action: 'wait',
    message: `投票待機中 (${voteCount.length}/${totalPlayers})`,
    details
  }
}
```

#### 3.3.2. サーバーサイド投票処理

```typescript
// /api/game/[gameId]/vote-session/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'

const voteSchema = z.object({
  vote: z.enum(['continue', 'end', 'pause']),
  gameId: z.string()
})

// 投票状態を管理（実際の実装ではRedisやDB使用を推奨）
const gameVotes: Record<string, Record<string, 'continue' | 'end' | 'pause'>> = {}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const body = await request.json()
    const { gameId } = await params
    const validatedData = voteSchema.parse({ ...body, gameId })
    
    // 認証確認
    const player = await requireAuth()
    
    // 投票記録
    if (!gameVotes[gameId]) {
      gameVotes[gameId] = {}
    }
    gameVotes[gameId][player.playerId] = validatedData.vote
    
    // ゲーム情報とプレイヤー数を取得
    const pointManager = new PointManager(gameId)
    const gameInfo = await pointManager.getGameInfo()
    const totalPlayers = 4 // または動的に取得
    
    // 投票結果を分析
    const voteResult = analyzeVotes(gameVotes[gameId], totalPlayers)
    
    // WebSocket通知
    const io = getIO()
    if (io && gameInfo?.roomCode) {
      // 投票状況をブロードキャスト
      io.to(gameInfo.roomCode).emit('session_vote_update', {
        votes: gameVotes[gameId],
        result: voteResult,
        voterName: player.name
      })
      
      // 決定した場合の追加処理
      if (voteResult.action === 'end') {
        // セッション終了処理
        await pointManager.forceEndGame('全員合意による終了')
        
        io.to(gameInfo.roomCode).emit('session_ended_by_consensus', {
          reason: '全員合意による終了',
          voteDetails: voteResult.details
        })
        
        // 投票状態をクリア
        delete gameVotes[gameId]
      } else if (voteResult.action === 'continue') {
        // 継続プロセス開始
        io.to(gameInfo.roomCode).emit('session_continue_agreed', {
          continueVotes: voteResult.details.continueVotes
        })
        
        // 投票状態をクリア
        delete gameVotes[gameId]
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        vote: validatedData.vote,
        currentVotes: gameVotes[gameId],
        result: voteResult
      }
    })
    
  } catch (error) {
    console.error('Vote session failed:', error)
    return NextResponse.json({
      success: false,
      error: { message: '投票処理に失敗しました' }
    }, { status: 500 })
  }
}
```

### 3.4. WebSocket通知システムの拡張

#### 3.4.1. 新しいWebSocketイベント

```typescript
// Socket.IO イベント定義
interface SessionVoteEvents {
  // クライアント → サーバー
  'session-vote': (data: { gameId: string, vote: VoteOption }) => void
  'cancel-session-vote': (data: { gameId: string }) => void
  
  // サーバー → クライアント
  'session_vote_update': (data: {
    votes: VoteState
    result: VoteResult
    voterName: string
  }) => void
  
  'session_ended_by_consensus': (data: {
    reason: string
    voteDetails: {
      continueVotes: number
      endVotes: number
      pauseVotes: number
      totalPlayers: number
    }
  }) => void
  
  'session_continue_agreed': (data: {
    continueVotes: number
  }) => void
}
```

#### 3.4.2. GameResult.tsxでのWebSocket処理

```tsx
// WebSocketイベントハンドリングの拡張
useEffect(() => {
  if (!socket || !resultData) return
  
  // 投票状況更新の受信
  socket.on('session_vote_update', ({ votes, result, voterName }) => {
    setVotes(votes)
    setVoteResult(result)
    
    // 投票が入った通知
    if (user?.name !== voterName) {
      console.log(`${voterName}が投票しました`)
    }
  })
  
  // 全員合意によるセッション終了
  socket.on('session_ended_by_consensus', ({ reason, voteDetails }) => {
    alert(`セッションが終了しました。\n理由: ${reason}\n\n5秒後にホームページに遷移します。`)
    
    setTimeout(() => {
      window.location.href = '/'
    }, 5000)
  })
  
  // 継続合意
  socket.on('session_continue_agreed', ({ continueVotes }) => {
    alert(`${continueVotes}名が継続を希望しています。継続プロセスを開始します。`)
    // 既存の継続プロセスに移行
    setIsWaitingForVotes(false)
    setVotes({})
    handleContinueSession()
  })
  
  return () => {
    socket.off('session_vote_update')
    socket.off('session_ended_by_consensus')
    socket.off('session_continue_agreed')
  }
}, [socket, resultData, user])
```

### 3.5. タイムアウト機能

#### 3.5.1. 投票タイムアウト設定

```tsx
// GameResult.tsx内のタイムアウト管理
const [voteTimeout, setVoteTimeout] = useState<NodeJS.Timeout | null>(null)
const VOTE_TIMEOUT_DURATION = 300000 // 5分

const startVoteTimeout = useCallback(() => {
  if (voteTimeout) {
    clearTimeout(voteTimeout)
  }
  
  const timeout = setTimeout(() => {
    // タイムアウト時の処理
    alert('投票がタイムアウトしました。投票をリセットします。')
    setIsWaitingForVotes(false)
    setVotes({})
    
    // サーバーに投票リセット通知
    if (socket && resultData) {
      socket.emit('vote-timeout', { gameId: resultData.gameId })
    }
  }, VOTE_TIMEOUT_DURATION)
  
  setVoteTimeout(timeout)
}, [voteTimeout, socket, resultData])

// 投票開始時にタイムアウト開始
const handleVote = (vote: VoteOption) => {
  if (!resultData || !socket || !user) return
  
  setIsWaitingForVotes(true)
  setVotes(prev => ({ ...prev, [user.playerId]: vote }))
  
  socket.emit('session-vote', {
    gameId: resultData.gameId,
    vote
  })
  
  // タイムアウト開始
  startVoteTimeout()
}
```

## 4. UI/UX設計

### 4.1. 投票選択画面

```text
┌─────────────────────────────────────────────┐
│  セッションをどうしますか？                   │
├─────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │🔄 セッション │ │✋ セッション │ │⏸️ 保留・   │ │
│  │   継続      │ │   終了      │ │  様子見     │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ │
│                                             │
│  説明:                                      │
│  • 継続: 次局を続ける                        │
│  • 終了: セッションを終了する                │
│  • 保留: 他の人の判断を待つ                  │
└─────────────────────────────────────────────┘
```

### 4.2. 投票進行状況画面

```text
┌─────────────────────────────────────────────┐
│  全員の投票を待っています...                 │
├─────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐     │
│  │プレイヤー1      │ │🔄 継続          │     │
│  │(あなた)        │ │               │     │
│  └─────────────────┘ └─────────────────┘     │
│  ┌─────────────────┐ ┌─────────────────┐     │
│  │プレイヤー2      │ │✋ 終了          │     │
│  └─────────────────┘ └─────────────────┘     │
│  ┌─────────────────┐ ┌─────────────────┐     │
│  │プレイヤー3      │ │⏳ 投票中        │     │
│  └─────────────────┘ └─────────────────┘     │
│  ┌─────────────────┐ ┌─────────────────┐     │
│  │プレイヤー4      │ │⏸️ 保留          │     │
│  └─────────────────┘ └─────────────────┘     │
├─────────────────────────────────────────────┤
│  投票集計: 🔄継続:1票 ✋終了:1票 ⏸️保留:1票    │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐ │
│  │           投票を取り消す                │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## 5. テスト計画

### 5.1. 投票システムのテスト

#### 5.1.1. Unit Tests

```typescript
// VotingProgress.test.tsx
describe('VotingProgress', () => {
  test('各投票選択肢が正しく表示される', () => {
    const votes = {
      'player1': 'continue',
      'player2': 'end',
      'player3': 'pause'
    }
    
    render(<VotingProgress votes={votes} players={mockPlayers} currentUser={mockUser} onCancelVote={jest.fn()} />)
    
    expect(screen.getByText('🔄 継続')).toBeInTheDocument()
    expect(screen.getByText('✋ 終了')).toBeInTheDocument()
    expect(screen.getByText('⏸️ 保留')).toBeInTheDocument()
    expect(screen.getByText('⏳ 投票中')).toBeInTheDocument()
  })
  
  test('投票集計が正しく表示される', () => {
    const votes = {
      'player1': 'continue',
      'player2': 'end',
      'player3': 'end',
      'player4': 'pause'
    }
    
    render(<VotingProgress votes={votes} players={mockPlayers} currentUser={mockUser} onCancelVote={jest.fn()} />)
    
    expect(screen.getByText('🔄 継続: 1票')).toBeInTheDocument()
    expect(screen.getByText('✋ 終了: 2票')).toBeInTheDocument()
    expect(screen.getByText('⏸️ 保留: 1票')).toBeInTheDocument()
  })
})
```

#### 5.1.2. 投票ロジックのテスト

```typescript
// vote-logic.test.ts
describe('analyzeVotes', () => {
  test('全員終了投票の場合、終了アクションを返す', () => {
    const votes = {
      'player1': 'end',
      'player2': 'end',
      'player3': 'end',
      'player4': 'end'
    }
    
    const result = analyzeVotes(votes, 4)
    
    expect(result.action).toBe('end')
    expect(result.message).toContain('全員がセッション終了に合意')
  })
  
  test('継続投票がある場合、継続アクションを返す', () => {
    const votes = {
      'player1': 'continue',
      'player2': 'end',
      'player3': 'end',
      'player4': 'end'
    }
    
    const result = analyzeVotes(votes, 4)
    
    expect(result.action).toBe('continue')
    expect(result.message).toContain('継続を希望')
  })
  
  test('全員保留の場合、待機アクションを返す', () => {
    const votes = {
      'player1': 'pause',
      'player2': 'pause',
      'player3': 'pause',
      'player4': 'pause'
    }
    
    const result = analyzeVotes(votes, 4)
    
    expect(result.action).toBe('wait')
    expect(result.message).toContain('全員が保留を選択')
  })
})
```

### 5.2. API統合テスト

```typescript
describe('Session Vote API', () => {
  test('有効な投票を正しく処理する', async () => {
    const response = await fetch('/api/game/test-game/vote-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: 'end' })
    })
    
    const data = await response.json()
    
    expect(response.ok).toBe(true)
    expect(data.success).toBe(true)
    expect(data.data.vote).toBe('end')
  })
  
  test('無効な投票選択肢を拒否する', async () => {
    const response = await fetch('/api/game/test-game/vote-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: 'invalid' })
    })
    
    expect(response.ok).toBe(false)
    expect(response.status).toBe(400)
  })
})
```

## 6. 実装チェックリスト

### 6.1. UI実装

- [ ] VotingProgress コンポーネントの作成
- [ ] GameResult.tsx の投票UI拡張
- [ ] 3択ボタンのレスポンシブデザイン
- [ ] 投票状況表示の実装

### 6.2. ロジック実装

- [ ] 投票分析ロジックの実装
- [ ] セッション終了判定の実装
- [ ] タイムアウト機能の実装
- [ ] 投票状態管理の実装

### 6.3. API実装

- [ ] /api/game/[gameId]/vote-session エンドポイント作成
- [ ] WebSocket投票イベントの実装
- [ ] 投票結果通知システムの実装

### 6.4. テスト実装

- [ ] VotingProgress コンポーネントテスト
- [ ] 投票ロジックユニットテスト
- [ ] API統合テスト
- [ ] E2Eテストシナリオ

### 6.5. 品質保証

- [ ] TypeScript型チェック
- [ ] ESLintエラー解消
- [ ] アクセシビリティ確認
- [ ] パフォーマンス最適化

## 7. 段階的実装戦略

### 7.1. Step 1: 基本投票UI（1-2時間）

1. VotingProgress コンポーネント作成
2. GameResult.tsx の3択ボタン追加
3. 基本的な投票状態管理

### 7.2. Step 2: 投票ロジック（2-3時間）

1. 投票分析関数の実装
2. 合意判定ロジックの実装
3. タイムアウト機能の実装

### 7.3. Step 3: API・WebSocket（2-3時間）

1. 投票APIエンドポイント作成
2. WebSocketイベント拡張
3. 投票結果通知システム

### 7.4. Step 4: テスト・品質保証（1-2時間）

1. ユニットテスト作成
2. 統合テスト作成
3. コード品質チェック

## 8. リスク分析と対策

### 8.1. 中リスク要因

⚠️ **投票同期**: 複数プレイヤー間での投票状態同期の複雑性
⚠️ **タイムアウト処理**: 投票タイムアウト時の状態管理
⚠️ **既存システム統合**: 現在の継続投票システムとの統合

### 8.2. 対策

- **段階的テスト**: 各段階での動作確認
- **フォールバック**: WebSocket失敗時の代替手段
- **状態管理統一**: Zustandによる一元的な状態管理

### 8.3. 低リスク要因

✅ **既存基盤活用**: Phase 1・2の実装基盤を活用
✅ **UI基盤**: 既存の投票UIパターンを拡張
✅ **WebSocket基盤**: 既存のリアルタイム通信基盤を活用

## 9. 完了基準

### 9.1. 機能面

1. 3択投票（継続/終了/保留）が正常動作
2. 全員終了合意でセッション自動終了
3. 投票状況のリアルタイム表示
4. タイムアウト機能の正常動作

### 9.2. 非機能面

1. レスポンシブデザイン対応
2. 投票データの整合性保証
3. WebSocket接続の安定性
4. エラーハンドリングの完備

### 9.3. ユーザー体験

1. 直感的な投票選択肢
2. 明確な投票状況表示
3. 適切な結果通知
4. スムーズな投票フロー

## 10. Phase 完了後の展望

Phase 3の完了により、以下が実現されます：

- **完全な終了手段**: ホスト強制終了 + 全員合意終了の2つの明確な終了手段
- **民主的なセッション管理**: 全員参加による意思決定システム
- **「継続可能なセッション」問題の完全解決**: 明示的な終了処理による状態管理

これにより、麻雀セッション管理システムは完全性を持ち、ユーザーにとって明確で使いやすいシステムとなります。
