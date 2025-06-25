# テスト・品質保証ガイド

## テスト戦略

### テストピラミッド

```text
         /\
        /E2E\      - 10% (重要なユーザーフロー)
       /------\
      /統合テスト\  - 30% (API、DB連携)
     /----------\
    /  単体テスト  \ - 60% (関数、コンポーネント)
   /--------------\
```

### テストカバレッジ目標

- 全体: 80%以上
- 重要なビジネスロジック: 95%以上
- ユーティリティ関数: 100%

## 単体テスト

### Jest設定

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
```

### Zodスキーマのテスト

```typescript
// schemas/__tests__/user.test.ts
import { UserSchema, CreateUserSchema } from '../user'

describe('UserSchema', () => {
  describe('正常系', () => {
    it('有効なユーザーデータを検証できる', () => {
      const validUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        name: '山田太郎',
        age: 30,
        role: 'user',
        createdAt: new Date(),
      }
      
      const result = UserSchema.safeParse(validUser)
      expect(result.success).toBe(true)
    })
  })
  
  describe('異常系', () => {
    it('無効なメールアドレスを拒否する', () => {
      const invalidUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'invalid-email',
        name: '山田太郎',
        role: 'user',
        createdAt: new Date(),
      }
      
      const result = UserSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].path).toContain('email')
    })
    
    it('空の名前を拒否する', () => {
      const invalidUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        name: '',
        role: 'user',
        createdAt: new Date(),
      }
      
      const result = UserSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('名前は必須です')
    })
  })
})
```

### APIルートのテスト

```typescript
// app/api/users/__tests__/route.test.ts
import { POST } from '../route'
import { prisma } from '@/lib/prisma'

// Prismaのモック
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

describe('POST /api/users', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  
  it('有効なデータでユーザーを作成できる', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: '山田太郎',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    ;(prisma.user.create as jest.Mock).mockResolvedValue(mockUser)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    
    const request = new Request('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        name: '山田太郎',
        role: 'user',
      }),
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(201)
    expect(data.email).toBe('test@example.com')
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'test@example.com',
        name: '山田太郎',
        role: 'user',
      },
    })
  })
  
  it('無効なデータで400エラーを返す', async () => {
    const request = new Request('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        name: '',
      }),
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(data.details).toBeDefined()
  })
})
```

### Reactコンポーネントのテスト

```typescript
// components/__tests__/UserCard.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserCard } from '../UserCard'

describe('UserCard', () => {
  const mockUser = {
    id: '1',
    name: '山田太郎',
    email: 'yamada@example.com',
    role: 'user' as const,
  }
  
  it('ユーザー情報を表示する', () => {
    render(<UserCard user={mockUser} />)
    
    expect(screen.getByText('山田太郎')).toBeInTheDocument()
    expect(screen.getByText('yamada@example.com')).toBeInTheDocument()
    expect(screen.getByText('一般ユーザー')).toBeInTheDocument()
  })
  
  it('編集ボタンクリックでコールバックが呼ばれる', async () => {
    const handleEdit = jest.fn()
    render(<UserCard user={mockUser} onEdit={handleEdit} />)
    
    const editButton = screen.getByRole('button', { name: '編集' })
    await userEvent.click(editButton)
    
    expect(handleEdit).toHaveBeenCalledWith(mockUser.id)
  })
})
```

### カスタムフックのテスト

```typescript
// hooks/__tests__/useUser.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { useUser } from '../useUser'
import { SWRConfig } from 'swr'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
)

describe('useUser', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })
  
  it('ユーザーデータを取得できる', async () => {
    const mockUser = {
      id: '1',
      name: '山田太郎',
      email: 'yamada@example.com',
    }
    
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    })
    
    const { result } = renderHook(() => useUser('1'), { wrapper })
    
    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isError).toBe(undefined)
    })
  })
})
```

## 統合テスト

### Prismaのテスト

```typescript
// __tests__/integration/user.test.ts
import { prisma } from '@/lib/prisma'
import { CreateUserSchema } from '@/schemas/user'

describe('User Integration Tests', () => {
  beforeEach(async () => {
    // テスト用データベースをクリーンアップ
    await prisma.user.deleteMany()
  })
  
  afterAll(async () => {
    await prisma.$disconnect()
  })
  
  it('ユーザーを作成して取得できる', async () => {
    const userData = {
      email: 'test@example.com',
      name: '山田太郎',
      role: 'user' as const,
    }
    
    // 作成
    const created = await prisma.user.create({
      data: userData,
    })
    
    expect(created.id).toBeDefined()
    expect(created.email).toBe(userData.email)
    
    // 取得
    const found = await prisma.user.findUnique({
      where: { id: created.id },
    })
    
    expect(found).toMatchObject(userData)
  })
  
  it('メールアドレスの重複を防ぐ', async () => {
    const email = 'duplicate@example.com'
    
    await prisma.user.create({
      data: {
        email,
        name: 'ユーザー1',
        role: 'user',
      },
    })
    
    await expect(
      prisma.user.create({
        data: {
          email,
          name: 'ユーザー2',
          role: 'user',
        },
      })
    ).rejects.toThrow()
  })
})
```

## E2Eテスト (Playwright)

### Playwright設定

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
})
```

### E2Eテストの実装

```typescript
// e2e/user-management.spec.ts
import { test, expect } from '@playwright/test'

test.describe('ユーザー管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users')
  })
  
  test('ユーザー一覧を表示できる', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'ユーザー一覧' })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })
  
  test('新規ユーザーを作成できる', async ({ page }) => {
    // 作成ボタンをクリック
    await page.getByRole('button', { name: '新規作成' }).click()
    
    // フォームに入力
    await page.getByLabel('名前').fill('田中花子')
    await page.getByLabel('メールアドレス').fill('tanaka@example.com')
    await page.getByLabel('役割').selectOption('user')
    
    // 送信
    await page.getByRole('button', { name: '作成' }).click()
    
    // 成功メッセージを確認
    await expect(page.getByText('ユーザーを作成しました')).toBeVisible()
    
    // 一覧に表示されることを確認
    await expect(page.getByRole('cell', { name: '田中花子' })).toBeVisible()
  })
  
  test('入力エラーを表示する', async ({ page }) => {
    await page.getByRole('button', { name: '新規作成' }).click()
    
    // 空のフォームを送信
    await page.getByRole('button', { name: '作成' }).click()
    
    // エラーメッセージを確認
    await expect(page.getByText('名前は必須です')).toBeVisible()
    await expect(page.getByText('メールアドレスは必須です')).toBeVisible()
  })
})
```

### ビジュアルリグレッションテスト

```typescript
// e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test'

test.describe('ビジュアルリグレッション', () => {
  test('ホームページのスクリーンショット', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })
  
  test('ユーザー一覧のスクリーンショット', async ({ page }) => {
    await page.goto('/users')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('users-list.png')
  })
})
```

## 品質チェック自動化

### pre-commitフック

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# フォーマットチェック
npm run format:check || {
  echo "❌ フォーマットエラーが見つかりました。'npm run format'を実行してください。"
  exit 1
}

# リントチェック
npm run lint || {
  echo "❌ リントエラーが見つかりました。"
  exit 1
}

# 型チェック
npm run typecheck || {
  echo "❌ 型エラーが見つかりました。"
  exit 1
}

# テスト実行（変更されたファイルのみ）
npm run test:staged || {
  echo "❌ テストが失敗しました。"
  exit 1
}
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup database
        run: |
          npx prisma generate
          npx prisma db push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Run format check
        run: npm run format:check
      
      - name: Run linter
        run: npm run lint
      
      - name: Run type check
        run: npm run typecheck
      
      - name: Run tests
        run: npm run test:ci
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            coverage/
            playwright-report/
```

## パフォーマンステスト

### Lighthouse CI

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      staticDistDir: './out',
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/users',
      ],
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
```

## テストデバッグ

### デバッグ方法

```typescript
// テスト内でのデバッグ
test('デバッグが必要なテスト', async () => {
  // ブレークポイントを設定
  debugger
  
  // コンソールログ
  console.log('現在の状態:', someVariable)
  
  // スナップショット
  expect(someObject).toMatchSnapshot()
})

// Playwrightのデバッグモード
npx playwright test --debug
npx playwright test --ui
```

## 品質メトリクス

### 追跡すべき指標

- コードカバレッジ率
- 技術的負債の量
- バグ発見率
- テスト実行時間
- ビルド成功率

### 品質ダッシュボード

```typescript
// scripts/quality-report.ts
interface QualityMetrics {
  coverage: {
    lines: number
    branches: number
    functions: number
    statements: number
  }
  testResults: {
    passed: number
    failed: number
    skipped: number
    duration: number
  }
  codeQuality: {
    duplications: number
    complexityAverage: number
    maintainabilityIndex: number
  }
}
```
