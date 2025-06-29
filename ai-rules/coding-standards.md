# コーディング規約

## 基本原則

### 読みやすさを最優先

- コードは書く時間より読む時間の方が長い
- 明確で自己文書化されたコードを書く
- 複雑な処理には必ずコメントを追加

### 一貫性を保つ

- プロジェクト全体で同じパターンを使用
- 既存のコードスタイルに従う
- 新しいパターンを導入する場合はチームで合意

## 命名規則

### 変数・関数名

```typescript
// 変数名: キャメルケース
const userName = "山田太郎"
const isActive = true
const userCount = 10

// 関数名: 動詞で始まるキャメルケース
function getUserById(id: string) {}
function calculateTotalPrice(items: Item[]) {}
function hasPermission(user: User, action: string) {}

// boolean を返す関数: is/has/can で始める
function isValidEmail(email: string): boolean {}
function hasAdminRole(user: User): boolean {}
function canEditPost(user: User, post: Post): boolean {}
```

### 定数

```typescript
// 定数: アッパースネークケース
const MAX_RETRY_COUNT = 3
const DEFAULT_PAGE_SIZE = 20
const API_BASE_URL = "https://api.example.com"

// Enumも同様
enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
  GUEST = "GUEST",
}
```

### 型・インターフェース

```typescript
// 型・インターフェース: パスカルケース
interface User {
  id: string
  name: string
  email: string
}

type UserId = string
type UserStatus = "active" | "inactive" | "suspended"

// ジェネリック型パラメータ: T, K, V など単一文字、または説明的な名前
function map<TInput, TOutput>(
  items: TInput[],
  fn: (item: TInput) => TOutput
): TOutput[] {}
```

### React コンポーネント

```typescript
// コンポーネント: パスカルケース
function UserProfile({ user }: { user: User }) {
  return <div>{user.name}</div>
}

// カスタムフック: use で始まるキャメルケース
function useUser(userId: string) {
  // ...
}

// イベントハンドラ: handle で始める
function handleClick(event: MouseEvent) {}
function handleSubmit(data: FormData) {}
```

### ファイル名

```bash
# コンポーネント: パスカルケース
UserProfile.tsx
SearchBar.tsx

# ユーティリティ・フック: キャメルケース
formatDate.ts
useDebounce.ts

# 定数・設定: キャメルケースまたはケバブケース
constants.ts
api-config.ts

# テスト: 元のファイル名.test.ts
UserProfile.test.tsx
formatDate.test.ts
```

## TypeScript 規約

### 型定義

```typescript
// インターフェースを優先（拡張可能な場合）
interface User {
  id: string
  name: string
  email: string
}

// 型エイリアスは Union型、関数型、ユーティリティ型で使用
type Status = "pending" | "active" | "inactive"
type Handler = (event: Event) => void
type ReadonlyUser = Readonly<User>

// 明示的な any は避ける
// 悪い例
function process(data: any) {}

// 良い例
function process<T>(data: T) {}
function processUser(data: unknown) {
  if (isUser(data)) {
    // 型ガード使用
  }
}
```

### 型ガード

```typescript
// 型ガード関数の定義
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "email" in value
  )
}

// 使用例
function processData(data: unknown) {
  if (isUser(data)) {
    console.log(data.name) // User型として扱える
  }
}
```

### Nullish Coalescing と Optional Chaining

```typescript
// Nullish Coalescing (??)
const port = process.env.PORT ?? 3000
const userName = user.name ?? "ゲスト"

// Optional Chaining (?.)
const city = user?.address?.city
const length = users?.length ?? 0

// 組み合わせ
const displayName = user?.profile?.displayName ?? user?.name ?? "名無し"
```

## 関数設計

### 純粋関数を優先

```typescript
// 良い例: 純粋関数
function calculateTotal(items: Item[]): number {
  return items.reduce((total, item) => total + item.price, 0)
}

// 避ける例: 副作用のある関数
let total = 0
function addToTotal(price: number): void {
  total += price // 外部の状態を変更
}
```

### 単一責任の原則

```typescript
// 悪い例: 複数の責任
async function createUserAndSendEmail(userData: CreateUserInput) {
  const user = await prisma.user.create({ data: userData })
  await sendWelcomeEmail(user.email)
  await logUserCreation(user.id)
  return user
}

// 良い例: 責任を分離
async function createUser(userData: CreateUserInput) {
  return prisma.user.create({ data: userData })
}

async function onUserCreated(user: User) {
  await sendWelcomeEmail(user.email)
  await logUserCreation(user.id)
}

// 使用
const user = await createUser(userData)
await onUserCreated(user)
```

### デフォルトパラメータ

```typescript
// オブジェクトパラメータのデフォルト値
interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: string
  order?: "asc" | "desc"
}

function fetchUsers({
  page = 1,
  limit = 20,
  sortBy = "createdAt",
  order = "desc",
}: PaginationOptions = {}) {
  // 実装
}
```

## エラーハンドリング

### カスタムエラークラス

```typescript
// エラークラスの定義
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = "AppError"
  }
}

class ValidationError extends AppError {
  constructor(
    message: string,
    public errors: Record<string, string[]>
  ) {
    super(message, "VALIDATION_ERROR", 400)
    this.name = "ValidationError"
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource}が見つかりません`, "NOT_FOUND", 404)
    this.name = "NotFoundError"
  }
}
```

### Try-Catch パターン

```typescript
// Result型パターン
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }

async function fetchUserSafe(id: string): Promise<Result<User>> {
  try {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return { ok: false, error: new NotFoundError("ユーザー") }
    }
    return { ok: true, value: user }
  } catch (error) {
    return { ok: false, error: error as Error }
  }
}

// 使用例
const result = await fetchUserSafe(userId)
if (result.ok) {
  console.log(result.value.name)
} else {
  console.error(result.error.message)
}
```

## React コンポーネント規約

### コンポーネント構造

```typescript
// 1. インポート
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// 2. 型定義
interface UserCardProps {
  user: User
  onEdit?: (id: string) => void
  className?: string
}

// 3. コンポーネント定義
export function UserCard({ user, onEdit, className }: UserCardProps) {
  // 4. State
  const [isLoading, setIsLoading] = useState(false)

  // 5. Effects
  useEffect(() => {
    // 副作用
  }, [])

  // 6. イベントハンドラ
  const handleEditClick = () => {
    onEdit?.(user.id)
  }

  // 7. レンダリング補助関数
  const renderStatus = () => {
    if (user.status === "active") return "アクティブ"
    return "非アクティブ"
  }

  // 8. メインレンダリング
  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <h3 className="text-lg font-semibold">{user.name}</h3>
      <p className="text-sm text-gray-600">{user.email}</p>
      <p className="text-sm">{renderStatus()}</p>
      {onEdit && (
        <Button onClick={handleEditClick} disabled={isLoading}>
          編集
        </Button>
      )}
    </div>
  )
}
```

### Props 設計

```typescript
// 明確な型定義
interface ButtonProps {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "danger"
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  onClick?: () => void
  className?: string
}

// コンポーネントの合成を活用
interface CardProps {
  header?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}

// Discriminated Union
type NotificationProps =
  | { type: "success"; message: string }
  | { type: "error"; message: string; retry?: () => void }
  | { type: "info"; message: string; link?: string }
```

## コメント規約

### JSDoc

```typescript
/**
 * ユーザーIDからユーザー情報を取得する
 * @param userId - 取得するユーザーのID
 * @returns ユーザー情報。見つからない場合はnull
 * @throws {DatabaseError} データベース接続エラーの場合
 * @example
 * const user = await getUserById("123")
 * if (user) {
 *   console.log(user.name)
 * }
 */
async function getUserById(userId: string): Promise<User | null> {
  // 実装
}
```

### インラインコメント

```typescript
function processPayment(amount: number, currency: string) {
  // 金額の検証（0円以下は許可しない）
  if (amount <= 0) {
    throw new Error("金額は0より大きい必要があります")
  }

  // TODO: 通貨の検証を追加する
  // FIXME: 小数点以下の処理が正しくない場合がある

  // 決済処理
  // 注意: この処理は冪等性を保証する必要がある
  const result = await paymentGateway.charge(amount, currency)

  return result
}
```

## フォーマッティング

### Prettier 設定

```json
{
  "semi": false,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### ESLint 設定（主要ルール）

```javascript
module.exports = {
  extends: ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  rules: {
    // TypeScript
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "off",

    // React
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // 一般
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error",
  },
}
```

## インポート順序

```typescript
// 1. React/Next.js
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

// 2. 外部ライブラリ
import { z } from "zod"
import { format } from "date-fns"

// 3. 内部ユーティリティ/lib
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

// 4. 型定義
import type { User, Post } from "@/types"

// 5. コンポーネント
import { Button } from "@/components/ui/button"
import { UserCard } from "@/components/UserCard"

// 6. スタイル
import styles from "./styles.module.css"
```

## パフォーマンス考慮事項

### メモ化

```typescript
// useMemo: 計算コストの高い値
const expensiveValue = useMemo(() => {
  return items.reduce((acc, item) => {
    // 複雑な計算
    return acc + complexCalculation(item)
  }, 0)
}, [items])

// useCallback: 関数の再生成を防ぐ
const handleClick = useCallback((id: string) => {
  // 処理
}, []) // 依存配列は最小限に

// React.memo: コンポーネントの再レンダリング防止
export const UserCard = React.memo(({ user }: { user: User }) => {
  return <div>{user.name}</div>
})
```

### 遅延ローディング

```typescript
// 動的インポート
const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <Skeleton />,
  ssr: false,
})

// 画像の最適化
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority={false}
  loading="lazy"
/>
```
