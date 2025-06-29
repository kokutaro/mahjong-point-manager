import { test, expect } from "@playwright/test"

test("room page reload retains state", async ({ page }) => {
  await page.goto("/")
  await page.click("text=ルーム作成")
  await expect(page).toHaveURL(/room\/create/)
  await page.click('button:has-text("ルーム作成")')
  await page.waitForURL(/room\/[A-Z0-9]+/)
  const url = page.url()
  await expect(page.getByText("ゲーム開始")).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(url)
  await expect(page.getByText("ゲーム開始")).toBeVisible()
})
