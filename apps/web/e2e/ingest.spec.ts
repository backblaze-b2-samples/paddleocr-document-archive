import { test, expect } from "@playwright/test";

test.describe("Document archive flow", () => {
  test("should display the ingest page", async ({ page }) => {
    await page.goto("/upload");
    await expect(page).toHaveURL(/upload/);
    await expect(page.getByRole("heading", { name: "Ingest" })).toBeVisible();
  });

  test("should navigate to the archive", async ({ page }) => {
    await page.goto("/archive");
    await expect(page).toHaveURL(/archive/);
  });

  test("should display the dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
