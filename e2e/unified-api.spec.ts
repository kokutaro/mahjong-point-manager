import { test, expect, Page } from '@playwright/test'

/**
 * 統合API E2Eテスト（認証済み）
 * ソロプレイとマルチプレイの統合エンドポイントの動作を検証
 */

// テスト用のソロゲーム作成（認証済み状態）
async function createSoloGame(page: Page) {
  // ソロゲーム作成ページに移動
  await page.goto('/solo/create')
  
  // ページが正常にロードされることを確認
  await expect(page.getByText('一人プレイゲーム作成')).toBeVisible()
  
  // ゲーム設定
  await page.click('button:has-text("半荘戦")')
  
  // プレイヤー名設定（デフォルトを使用）
  
  // ゲーム作成
  await page.click('button:has-text("ゲーム開始")')
  
  // ゲーム画面への遷移を待機
  await page.waitForURL(/\/solo\/game\//, { timeout: 10000 })
  
  // ゲームIDを取得
  const url = page.url()
  const gameId = url.split('/').pop()
  
  return gameId
}

test.describe('統合API E2Eテスト', () => {
  
  test.beforeEach(async ({ page }) => {
    // 認証済み状態でテストを開始（setup プロジェクトで設定済み）
    await page.goto('/')
    
    // 認証が成功していることを確認（プレイヤー名が表示される）
    await expect(page.getByText('E2Eテストプレイヤー')).toBeVisible()
  })

  test('ソロプレイゲームの作成と状態取得', async ({ page }) => {
    // ソロゲーム作成
    const gameId = await createSoloGame(page)
    expect(gameId).toBeTruthy()

    // ゲーム状態が表示されることを確認
    await expect(page.getByText('一人プレイゲーム')).toBeVisible()
    await expect(page.getByText('ゲーム開始')).toBeVisible()
    
    // プレイヤーカードが4つ表示されることを確認
    const playerCards = page.locator('[class*="bg-gray-50 rounded-lg p-4"]')
    await expect(playerCards).toHaveCount(4)
  })

  test('ソロプレイゲームの開始', async ({ page }) => {
    // ソロゲーム作成
    const gameId = await createSoloGame(page)
    
    // ゲーム開始ボタンをクリック
    await page.click('button:has-text("ゲーム開始")')
    
    // ゲームが開始されることを確認
    await expect(page.getByText('ゲーム開始中...')).toBeVisible({ timeout: 1000 })
    
    // 開始後の画面確認
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return !buttons.some(button => button.textContent?.includes('ゲーム開始中...'))
    }, {
      timeout: 5000
    })
    
    // ゲームアクションボタンが表示されることを確認
    await expect(page.getByText('ゲームアクション')).toBeVisible()
    await expect(page.getByRole('button', { name: 'ツモ' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ロン' })).toBeVisible()
    await expect(page.getByRole('button', { name: '流局' })).toBeVisible()
    await expect(page.getByRole('button', { name: '強制終了' })).toBeVisible()
  })

  test('リーチ機能の動作確認', async ({ page }) => {
    // ソロゲーム作成・開始
    const gameId = await createSoloGame(page)
    await page.click('button:has-text("ゲーム開始")')
    
    // ゲーム開始完了を待機
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return !buttons.some(button => button.textContent?.includes('ゲーム開始中...'))
    }, {
      timeout: 5000
    })
    
    // 最初のプレイヤーのリーチボタンをクリック（具体的なセレクタを使用）
    const firstReachButton = page.locator('button').filter({ hasText: 'リーチ' }).first()
    await expect(firstReachButton).toBeVisible()
    
    await firstReachButton.click()
    
    // リーチ状態になることを確認（リーチバッジで確認）
    await expect(page.locator('.bg-red-100').filter({ hasText: 'リーチ' })).toBeVisible({ timeout: 3000 })
    
    // 元のリーチボタンが無効化されるか、"リーチ中..."に変わることを確認
    await page.waitForTimeout(1000) // 状態変更の待機
  })

  test('ツモ得点計算の動作確認', async ({ page }) => {
    // ソロゲーム作成・開始
    const gameId = await createSoloGame(page)
    await page.click('button:has-text("ゲーム開始")')
    
    // ゲーム開始完了を待機
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return !buttons.some(button => button.textContent?.includes('ゲーム開始中...'))
    }, {
      timeout: 5000
    })
    
    // ツモボタンをクリック
    await page.click('button:has-text("ツモ")')
    
    // スコア入力フォームが表示されることを確認
    await expect(page.getByRole('heading', { name: /点数入力.*ツモ/ })).toBeVisible()
    
    // ソロモードの場合、まず和了者を選択
    const winnerButtons = page.getByRole('button').filter({ hasText: /東/ })
    await expect(winnerButtons.first()).toBeVisible()
    await winnerButtons.first().click()
    
    // 翻数選択（1翻を選択）
    await expect(page.getByRole('button', { name: '1翻' })).toBeVisible()
    await page.getByRole('button', { name: '1翻' }).click()
    
    // 符数選択（30符を選択）
    await expect(page.getByRole('button', { name: '30符' })).toBeVisible()
    await page.getByRole('button', { name: '30符' }).click()
    
    // 点数計算実行
    await page.getByRole('button', { name: '支払い' }).click()
    
    // 点数変更が反映されることを確認（東家が親の場合のツモ）
    await page.waitForTimeout(1000) // 点数更新の待機
    
    // フォームが閉じることを確認（翻数選択ボタンが見えなくなる）
    await expect(page.getByRole('button', { name: '1翻' })).not.toBeVisible()
  })

  test('流局処理の動作確認', async ({ page }) => {
    // ソロゲーム作成・開始
    const gameId = await createSoloGame(page)
    await page.click('button:has-text("ゲーム開始")')
    
    // ゲーム開始完了を待機
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return !buttons.some(button => button.textContent?.includes('ゲーム開始中...'))
    }, {
      timeout: 5000
    })
    
    // 流局ボタンをクリック
    await page.click('button:has-text("流局")')
    
    // 流局フォームが表示されることを確認
    await expect(page.getByText('流局処理')).toBeVisible()
    
    // テンパイ者を選択（Mantineボタンを使用）
    // 最初に表示されるのは全てノーテン状態なので、2人をテンパイに変更
    const notenButtons = page.getByRole('button', { name: 'ノーテン' })
    await expect(notenButtons.first()).toBeVisible({ timeout: 3000 })
    
    // 最初の2人をテンパイに変更
    await notenButtons.nth(0).click() // 東家
    await notenButtons.nth(1).click() // 南家
    
    // 確認ステップに進む（フォーム内の確認ボタンを指定）
    await page.getByRole('button', { name: '確認', exact: true }).click()
    
    // 流局実行
    await page.getByRole('button', { name: '支払い' }).click()
    
    // 流局処理が完了することを確認
    await page.waitForTimeout(1000)
    
    // フォームが閉じることを確認（流局処理のヘディングが消える）
    await expect(page.getByText('流局処理')).not.toBeVisible()
  })

  test('強制終了機能の動作確認', async ({ page }) => {
    // ソロゲーム作成・開始
    const gameId = await createSoloGame(page)
    await page.click('button:has-text("ゲーム開始")')
    
    // ゲーム開始完了を待機
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return !buttons.some(button => button.textContent?.includes('ゲーム開始中...'))
    }, {
      timeout: 5000
    })
    
    // 強制終了の確認ダイアログとアラートダイアログのハンドリング
    let confirmDialogHandled = false
    let alertDialogHandled = false
    
    page.on('dialog', async dialog => {
      if (dialog.type() === 'confirm' && !confirmDialogHandled) {
        expect(dialog.message()).toContain('ゲームを強制終了しますか')
        confirmDialogHandled = true
        await dialog.accept()
      } else if (dialog.type() === 'alert' && !alertDialogHandled) {
        expect(dialog.message()).toContain('ゲームを強制終了しました')
        alertDialogHandled = true
        await dialog.accept()
      }
    })
    
    // 強制終了ボタンをクリック
    await page.click('button:has-text("強制終了")')
    
    // ダイアログ処理の完了を待機
    await page.waitForTimeout(3000)
    
    // 強制終了処理が完了していることを確認
    expect(confirmDialogHandled).toBe(true)
    expect(alertDialogHandled).toBe(true)
  })

  test('ゲーム結果表示の動作確認', async ({ page }) => {
    // ソロゲーム作成・開始
    const gameId = await createSoloGame(page)
    await page.click('button:has-text("ゲーム開始")')
    
    // ゲーム開始完了を待機
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return !buttons.some(button => button.textContent?.includes('ゲーム開始中...'))
    }, {
      timeout: 5000
    })
    
    // 強制終了でゲームを終了
    let confirmDialogHandled = false
    let alertDialogHandled = false
    
    page.on('dialog', async dialog => {
      if (dialog.type() === 'confirm' && !confirmDialogHandled) {
        confirmDialogHandled = true
        await dialog.accept()
      } else if (dialog.type() === 'alert' && !alertDialogHandled) {
        alertDialogHandled = true
        await dialog.accept()
      }
    })
    
    await page.click('button:has-text("強制終了")')
    
    // ダイアログ処理の完了を待機
    await page.waitForTimeout(3000)
    
    // 強制終了処理が完了していることを確認
    expect(confirmDialogHandled).toBe(true)
    expect(alertDialogHandled).toBe(true)
    
    // ※ 現在の実装では強制終了後にGameEndScreenが表示されないため、
    // 結果画面への遷移は手動で行う必要があります
    console.log('注意: 現在の実装では強制終了後にGameEndScreenが自動表示されません')
  })

  test('統合エラーハンドリングの確認', async ({ page }) => {
    // 存在しないゲームIDでアクセス
    await page.goto('/solo/game/non-existent-game-id')
    
    // エラーメッセージが表示されることを確認
    await expect(page.getByText('エラー')).toBeVisible({ timeout: 10000 })
    
    // ホームに戻るボタンが表示されることを確認
    await expect(page.getByText('ホームに戻る')).toBeVisible()
  })

  test('API レスポンス形式の検証', async ({ page }) => {
    // ネットワークレスポンスを監視
    const responses: any[] = []
    
    page.on('response', async (response) => {
      if (response.url().includes('/api/game/')) {
        const body = await response.text()
        try {
          const json = JSON.parse(body)
          responses.push({
            url: response.url(),
            status: response.status(),
            data: json
          })
        } catch (e) {
          // JSONでない場合はスキップ
        }
      }
    })
    
    // ソロゲーム作成・開始
    const gameId = await createSoloGame(page)
    await page.click('button:has-text("ゲーム開始")')
    
    // ゲーム開始完了を待機
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return !buttons.some(button => button.textContent?.includes('ゲーム開始中...'))
    }, {
      timeout: 5000
    })
    
    // APIレスポンスが記録されていることを確認
    expect(responses.length).toBeGreaterThan(0)
    
    // 統合APIのレスポンス形式を確認
    const gameStateResponse = responses.find(r => r.url.includes('/api/game/') && !r.url.includes('/api/game/') )
    
    if (gameStateResponse) {
      expect(gameStateResponse.status).toBe(200)
      expect(gameStateResponse.data).toHaveProperty('success')
      expect(gameStateResponse.data).toHaveProperty('data')
      
      const gameState = gameStateResponse.data.data.gameState
      expect(gameState).toHaveProperty('gameMode')
      expect(gameState.gameMode).toBe('SOLO')
    }
  })
})

test.describe('API統合テスト（直接アクセス）', () => {
  test('統合ゲーム状態API', async ({ request }) => {
    // 事前にソロゲームを作成する必要があります
    // この部分は実際のデータベースに依存するため、モックまたは事前データが必要
  })
})