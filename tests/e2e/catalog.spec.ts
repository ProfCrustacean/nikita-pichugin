import { expect, test } from "@playwright/test";
import { elementFitsViewport, horizontalOverflow } from "./helpers";
import { catalogCounts, workOnPaperCount } from "./runtime";

test("catalog exposes all artworks and its filters work", async ({ page }) => {
  await page.goto("/works/");
  await expect(page.locator("[data-catalog-item]")).toHaveCount(catalogCounts.artworkWorks);
  await expect(page.locator("[data-catalog-count]")).toHaveText(String(catalogCounts.artworkWorks));

  await page.locator("button[data-type='work on paper']").click();
  await expect(page.locator("button[data-type='work on paper']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-catalog-count]")).toHaveText(String(workOnPaperCount));
  await expect(page.locator("[data-catalog-item]:not([hidden])")).toHaveCount(workOnPaperCount);

  await page.locator("[data-catalog-search]").fill("Гурзуф");
  await expect(page.locator("[data-catalog-count]")).toHaveText("0");
  await page.locator("[data-catalog-reset]").click();
  await expect(page.locator("[data-catalog-count]")).toHaveText(String(catalogCounts.artworkWorks));
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test("work detail separates the reproduction and associated materials", async ({ page }) => {
  await page.goto("/works/otrazhenie-081413fe/");
  await expect(page.getByRole("heading", { name: "Отражение" })).toBeVisible();
  await expect(page.locator(".work-detail__primary img")).toHaveCount(1);
  await expect(page.locator(".work-media--warm img")).toHaveCount(5);
  await expect(page.locator("[data-work-asset-id]")).toHaveCount(6);
  await expect(page.locator("body")).not.toContainText("Метаданные зафиксированы по подписи");
  await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", "https://nikita-pichugin.onrender.com/works/otrazhenie-081413fe/");
  await expect(page.locator("body")).not.toContainText(/NP-[0-9]{4}/);
});

test("every associated material is present on the relevant work page", async ({ page }) => {
  await page.goto("/works/vremya-zastylo-310ced83/");
  await expect(page.getByRole("heading", { name: "Время застыло" })).toBeVisible();
  await expect(page.locator("[data-work-asset-id]")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Связанные изображения." })).toBeVisible();
});

test("photographic works use a neutral public title", async ({ page }) => {
  await page.goto("/works/fotokompozitsiya-bad98140/");
  const heading = page.getByRole("heading", { name: "Фотокомпозиция", level: 1 });
  await expect(heading).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/NP-[0-9]{4}|Фотография,/);
  await expect(page.locator("meta[name='description']")).not.toHaveAttribute("content", /г\.\.|Дата уточняется/);
  await expect(page.locator("script[type='application/ld+json']")).toHaveCount(1);
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(await page.evaluate(() => document.documentElement.clientWidth));

  for (const width of [768, 1024, 1366, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await elementFitsViewport(heading)).toBe(true);
  }
});

test("undated photographic work does not promise a date", async ({ page }) => {
  await page.goto("/works/fotokompozitsiya-22a21a77/");
  await expect(page).toHaveTitle("Фотокомпозиция — Никита Пичугин");
  await expect(page.locator("meta[name='description']")).toHaveAttribute("content", "Фотокомпозиция Никиты Пичугина.");
  await expect(page.locator("body")).not.toContainText("Дата уточняется");
});
