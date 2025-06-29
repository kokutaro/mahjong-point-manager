# 開発プロセスガイド

## 開発フロー概要

```mermaid
graph LR
    A[タスク分析] --> B[事前調査]
    B --> C[実装計画]
    C --> D[ブランチ作成]
    D --> E[実装]
    E --> F[テスト]
    F --> G[品質チェック]
    G --> H[PR作成]
    H --> I[レビュー]
    I --> J[マージ]
```

## 1. タスク分析フェーズ

### タスクの分解原則

#### 最小実装単位（MIU: Minimum Implementation Unit）

- 1つのPRで1つの機能または修正
- 2時間以内で完了できる規模
- 独立してテスト可能

#### タスク分解の例

```markdown
# 悪い例: ユーザー管理機能の実装

# 良い例:

1. ユーザーモデルの作成
2. ユーザー作成APIの実装
3. ユーザー一覧表示UIの実装
4. ユーザー詳細画面の実装
5. ユーザー編集機能の実装
6. ユーザー削除機能の実装
```

### タスクチェックリスト作成

```markdown
## タスク: ユーザー作成APIの実装

### 要件

- [ ] POSTエンドポイント `/api/users`
- [ ] 入力検証（email, name必須）
- [ ] 重複メールチェック
- [ ] エラーハンドリング
- [ ] 成功時は201ステータス

### 技術要件

- [ ] Zodスキーマ定義
- [ ] Prismaモデル定義
- [ ] APIルートハンドラー
- [ ] エラーレスポンス統一
```

## 2. 事前調査フェーズ

### 既存コード調査

#### 調査項目チェックリスト

```bash
# 1. 関連ファイルの特定
find . -name "*.ts" -o -name "*.tsx" | xargs grep -l "user"

# 2. 既存の実装パターン確認
- データモデル構造
- APIエンドポイントの命名規則
- エラーハンドリングパターン
- 認証・認可の実装方法

# 3. 依存関係の確認
- 使用されているライブラリ
- 共通ユーティリティ関数
- 型定義ファイル
```

### ドキュメント確認

#### 必須確認ドキュメント

1. プロジェクトREADME
2. API仕様書
3. データベース設計書
4. コーディング規約
5. 過去の類似PR

### 影響範囲分析

```typescript
// 影響範囲マトリクス
interface ImpactAnalysis {
  directImpact: string[] // 直接変更するファイル
  indirectImpact: string[] // 間接的に影響を受けるファイル
  breakingChanges: string[] // 破壊的変更
  requiredMigrations: string[] // 必要なマイグレーション
}

// 例
const impactAnalysis: ImpactAnalysis = {
  directImpact: [
    "prisma/schema.prisma",
    "app/api/users/route.ts",
    "schemas/user.ts",
  ],
  indirectImpact: ["components/UserList.tsx", "hooks/useUsers.ts"],
  breakingChanges: [],
  requiredMigrations: ["create_users_table"],
}
```

## 3. 実装計画フェーズ

### 実装計画テンプレート

```markdown
# 実装計画: [機能名]

## 概要

[1-2文で機能の説明]

## 技術的アプローチ

1. [ステップ1の説明]
2. [ステップ2の説明]
3. ...

## ファイル構成
```

src/
├── app/
│ └── api/
│ └── users/
│ └── route.ts # APIエンドポイント
├── schemas/
│ └── user.ts # Zodスキーマ
├── lib/
│ └── api/
│ └── users.ts # API関数
└── types/
└── user.ts # 型定義

```text

## 実装順序
1. Prismaスキーマ更新
2. Zod検証スキーマ作成
3. APIエンドポイント実装
4. フロントエンド統合
5. テスト作成

## エラーケース
- 入力検証エラー
- データベース接続エラー
- 重複データエラー
- 権限エラー

## テスト計画
- 単体テスト: Zodスキーマ、APIハンドラー
- 統合テスト: API全体フロー
- E2Eテスト: ユーザー作成フロー
```

### 設計判断の記録

```typescript
// DECISION_LOG.md
interface DesignDecision {
  date: string
  decision: string
  rationale: string
  alternatives: string[]
  consequences: string[]
}

// 例
const decision: DesignDecision = {
  date: "2025-01-25",
  decision: "Server ActionsではなくAPI Routesを使用",
  rationale: "外部システムとの連携を考慮",
  alternatives: ["Server Actions", "tRPC"],
  consequences: [
    "クライアント側でのfetch処理が必要",
    "エラーハンドリングの統一化が必要",
  ],
}
```

## 4. ブランチ戦略

### ブランチ命名規則

```bash
# フォーマット: feat/機能名(日本語)
feat/ユーザー作成API
feat/ログイン機能
feat/プロフィール編集

# バグ修正の場合
fix/ログインエラー修正
fix/データ取得バグ

# リファクタリング
refactor/API構造改善
```

### ブランチ作成手順

```bash
# 1. 最新のmainを取得
git checkout main
git pull origin main

# 2. 新規ブランチ作成
git checkout -b feat/ユーザー作成API

# 3. ブランチをリモートにプッシュ
git push -u origin feat/ユーザー作成API
```

## 5. 実装フェーズ

### コーディング原則

#### 早期リターン

```typescript
// 悪い例
function processUser(user: User | null) {
  if (user) {
    if (user.isActive) {
      // 処理
    }
  }
}

// 良い例
function processUser(user: User | null) {
  if (!user) return
  if (!user.isActive) return

  // 処理
}
```

#### エラーハンドリング

```typescript
// 一貫性のあるエラーレスポンス
interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
}

// エラーハンドリングユーティリティ
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "入力データが無効です",
        details: error.errors,
      },
      { status: 400 }
    )
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          code: "DUPLICATE_ERROR",
          message: "データが既に存在します",
        },
        { status: 409 }
      )
    }
  }

  return NextResponse.json(
    {
      code: "INTERNAL_ERROR",
      message: "サーバーエラーが発生しました",
    },
    { status: 500 }
  )
}
```

### コミット戦略

#### コミットメッセージ規則

```bash
# フォーマット: <type>: <subject>

# 種別
feat: 新機能
fix: バグ修正
docs: ドキュメント
style: フォーマット（コードの動作に影響なし）
refactor: リファクタリング
test: テスト
chore: ビルドプロセスや補助ツール

# 例
feat: ユーザー作成APIエンドポイントを追加
fix: メール重複チェックのバグを修正
docs: API仕様書を更新
test: ユーザー作成のテストケースを追加
```

#### コミット単位

- 1つの論理的変更 = 1コミット
- ビルドが通る状態を保つ
- レビューしやすい粒度

## 6. 品質保証フェーズ

### 自動チェック実行順序

```bash
# 1. コードフォーマット
npm run format

# 2. リント実行
npm run lint

# 3. 型チェック
npm run type-check

# 4. テスト実行
npm run test

# 5. ビルド確認
npm run build
```

### 手動確認項目

#### コードレビューセルフチェック

- [ ] 命名は適切か
- [ ] 不要なコメントはないか
- [ ] エラーハンドリングは適切か
- [ ] パフォーマンスの問題はないか
- [ ] セキュリティの問題はないか

## 7. プルリクエスト作成

### PRテンプレート

```markdown
## 概要

[変更の概要を1-2文で説明]

## 変更内容

- [ ] 機能A を実装
- [ ] バグB を修正
- [ ] ドキュメントC を更新

## 技術的な変更

- 使用した新しいライブラリ:
- 変更したデータベーススキーマ:
- 追加したAPI:

## テスト

- [ ] 単体テストを追加/更新
- [ ] 統合テストを実行
- [ ] 手動テストを完了

## スクリーンショット

[UIの変更がある場合は追加]

## 破壊的変更

[ある場合は記載]

## 関連Issue

Closes #123
```

### PR作成コマンド

```bash
# GitHub CLIを使用
gh pr create \
  --title "feat: ユーザー作成APIを実装" \
  --body-file .github/pull_request_template.md \
  --base main
```

## 継続的改善

### 振り返りポイント

- 見積もりと実際の時間の差異
- 予期しなかった問題
- 学んだベストプラクティス
- 改善可能なプロセス

### ナレッジ共有

- 技術的な発見はドキュメント化
- 共通パターンはテンプレート化
- エラー解決方法は記録
