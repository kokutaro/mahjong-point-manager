# 技術スタックガイドライン

## Next.js ベストプラクティス

### ディレクトリ構造

```text
src/
├── app/                    # App Router
│   ├── (routes)/          # ルートグループ
│   ├── api/               # APIルート
│   └── layout.tsx         # ルートレイアウト
├── components/            # 共通コンポーネント
│   ├── ui/               # UIコンポーネント
│   └── features/         # 機能別コンポーネント
├── lib/                   # ユーティリティ関数
├── hooks/                 # カスタムフック
├── types/                 # 型定義
└── styles/               # グローバルスタイル
```

### ルーティング規則

- 動的ルートは`[param]`形式を使用
- グループ化には`(group)`形式を使用
- プライベートフォルダは`_folder`形式を使用

### データフェッチング

- Server Componentsを優先的に使用
- Client Componentsは対話性が必要な場合のみ使用
- `use client`ディレクティブは必要最小限に

### パフォーマンス最適化

- 画像は`next/image`を使用
- フォントは`next/font`を使用
- 動的インポートで初期バンドルサイズを削減

## Tailwind CSS ベストプラクティス

### クラス命名規則

```tsx
// 良い例
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">

// 避けるべき例
<div className="flex-center-between white-card">
```

### レスポンシブデザイン

```tsx
// モバイルファーストアプローチ
<div className="text-sm md:text-base lg:text-lg">
```

### カスタムユーティリティ

```css
/* globals.css */
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

### コンポーネントバリアント

```tsx
// cn関数を使用した条件付きスタイリング
import { cn } from "@/lib/utils"

interface ButtonProps {
  variant?: "primary" | "secondary"
  size?: "sm" | "md" | "lg"
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-md font-medium transition-colors",
        {
          "bg-blue-600 text-white hover:bg-blue-700": variant === "primary",
          "bg-gray-200 text-gray-900 hover:bg-gray-300": variant === "secondary",
          "px-3 py-1.5 text-sm": size === "sm",
          "px-4 py-2": size === "md",
          "px-6 py-3 text-lg": size === "lg",
        },
        className
      )}
      {...props}
    />
  )
}
```

## Zustand 状態管理

### ストア設計原則

```typescript
// stores/userStore.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface UserState {
  user: User | null
  isLoading: boolean
  error: string | null
  
  // アクション
  setUser: (user: User) => void
  clearUser: () => void
  updateUser: (updates: Partial<User>) => void
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isLoading: false,
        error: null,
        
        setUser: (user) => set({ user, error: null }),
        clearUser: () => set({ user: null }),
        updateUser: (updates) => 
          set((state) => ({ 
            user: state.user ? { ...state.user, ...updates } : null 
          })),
      }),
      {
        name: 'user-storage',
      }
    )
  )
)
```

### セレクタパターン

```typescript
// 特定のプロパティのみを購読
const userName = useUserStore((state) => state.user?.name)
const isLoggedIn = useUserStore((state) => !!state.user)
```

### 非同期アクション

```typescript
const fetchUser = async () => {
  const { setUser } = useUserStore.getState()
  
  try {
    const response = await fetch('/api/user')
    const user = await response.json()
    setUser(user)
  } catch (error) {
    console.error('Failed to fetch user:', error)
  }
}
```

## Zod バリデーション

### スキーマ定義

```typescript
// schemas/user.ts
import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1, "名前は必須です"),
  age: z.number().int().positive().optional(),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.date(),
})

export type User = z.infer<typeof UserSchema>

// フォームバリデーション用
export const CreateUserSchema = UserSchema.omit({ 
  id: true, 
  createdAt: true 
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
```

### API統合

```typescript
// app/api/users/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = CreateUserSchema.parse(body)
    
    // Prismaでユーザー作成
    const user = await prisma.user.create({
      data: validatedData,
    })
    
    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { errors: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
```

### フォーム統合

```typescript
// React Hook Formとの統合
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

export function UserForm() {
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'user',
    },
  })
  
  // ...
}
```

## Prisma ORM

### スキーマ設計

```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([email])
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([authorId])
}

enum Role {
  ADMIN
  USER
  GUEST
}
```

### クエリ最適化

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 使用例: 関連データの効率的な取得
const getUserWithPosts = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      posts: {
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      profile: true,
    },
  })
}
```

### トランザクション処理

```typescript
const createUserWithProfile = async (data: CreateUserWithProfileInput) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        name: data.name,
      },
    })
    
    const profile = await tx.profile.create({
      data: {
        bio: data.bio,
        userId: user.id,
      },
    })
    
    return { user, profile }
  })
}
```

## 統合パターン

### Server Actions with Zod & Prisma

```typescript
// app/actions/user.ts
'use server'

import { CreateUserSchema } from '@/schemas/user'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createUser(formData: FormData) {
  const rawData = Object.fromEntries(formData)
  
  const validation = CreateUserSchema.safeParse(rawData)
  
  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.flatten().fieldErrors,
    }
  }
  
  try {
    const user = await prisma.user.create({
      data: validation.data,
    })
    
    revalidatePath('/users')
    
    return { success: true, user }
  } catch (error) {
    return {
      success: false,
      error: 'ユーザーの作成に失敗しました',
    }
  }
}
```

### カスタムフックパターン

```typescript
// hooks/useUser.ts
export function useUser(userId: string) {
  const { data, error, isLoading } = useSWR(
    userId ? `/api/users/${userId}` : null,
    fetcher
  )
  
  return {
    user: data,
    isLoading,
    isError: error,
  }
}
```
