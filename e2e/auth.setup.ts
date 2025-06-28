import { test as setup, expect } from '@playwright/test'

/**
 * E2Eテスト用認証セットアップ
 * テスト実行前に認証状態を作成し、全テストで共有する
 */

const authFile = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // ホームページに移動
  await page.goto('/')
  
  // テスト用プレイヤーの認証情報
  const testPlayer = {
    name: 'E2Eテストプレイヤー',
    deviceId: 'e2e-test-device-' + Date.now()
  }
  
  // 認証APIを直接呼び出し
  const response = await page.request.post('/api/auth/player', {
    data: testPlayer
  })
  
  expect(response.ok()).toBeTruthy()
  
  const authData = await response.json()
  expect(authData.success).toBe(true)
  expect(authData.data.playerId).toBeTruthy()
  
  console.log('✅ Authentication setup completed:', {
    playerId: authData.data.playerId,
    name: authData.data.name,
    deviceId: authData.data.deviceId
  })
  
  // ページをリロードして認証状態を確認
  await page.reload()
  
  // 認証状態をファイルに保存
  await page.context().storageState({ path: authFile })
  
  console.log('✅ Authentication state saved to:', authFile)
})