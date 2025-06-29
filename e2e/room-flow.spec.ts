import { test, expect } from "@playwright/test"

test("room creation to game start flow", async ({ page }) => {
  await page.goto("/")
  await page.click("text=ルーム作成")
  await expect(page).toHaveURL(/room\/create/)
  await page.click('button:has-text("ルーム作成")')
  await page.waitForURL(/room\/[A-Z0-9]+/)
  await expect(page.getByText("ゲーム開始")).toBeVisible()
})
