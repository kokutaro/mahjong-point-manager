import { test, expect } from "@playwright/test"

test("home page displays title", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByText("麻雀点数管理")).toBeVisible()
})
