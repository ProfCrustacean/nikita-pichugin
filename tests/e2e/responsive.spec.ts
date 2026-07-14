import { expect, test } from "@playwright/test";
import { elementFitsViewport, horizontalOverflow, navigationGeometry } from "./helpers";
import { catalogCounts, workOnPaperCount } from "./runtime";

test("mobile menu is usable and does not expose the text logo", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 900));
  const menu = page.getByRole("button", { name: "Открыть меню" });
  await menu.click();
  const closeMenu = page.getByRole("button", { name: "Закрыть меню" });
  await expect(closeMenu).toHaveAttribute("aria-expanded", "true");
  const navigation = page.locator(".sunday-nav");
  await expect(navigation).toBeVisible();
  await expect(navigation).toHaveCSS("transform", "none");
  await expect(navigation.getByRole("link", { name: "Работы" })).toBeVisible();
  await expect(navigation.getByRole("link")).toHaveCount(5);
  await expect(navigation.getByRole("link", { name: "Выставка" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Работы" })).toBeFocused();
  const menuGeometry = await navigationGeometry(navigation);
  expect(menuGeometry.top).toBe(0);
  expect(menuGeometry.bottom).toBeGreaterThanOrEqual(menuGeometry.viewportHeight - 1);
  expect(menuGeometry.linksFit).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".sunday-mark")).toBeFocused();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await menu.click();
  await page.keyboard.press("Tab");
  await expect(page.locator(".sunday-mark")).toBeFocused();
  await page.waitForTimeout(400);
  await expect(page.locator(".sunday-mark")).toBeFocused();

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  const shortNavigation = page.locator(".sunday-nav");
  const shortMenuGeometry = await navigationGeometry(shortNavigation);
  expect(shortMenuGeometry.linksFit).toBe(true);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test("mobile headings and catalog controls stay usable", async ({ page }) => {
  for (const route of ["/", "/works/", "/archive/", "/studio/", "/contact/"]) {
    await page.goto(route);
    expect(await elementFitsViewport(page.locator("h1"))).toBe(true);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  }

  await page.goto("/works/");
  await expect(page.locator("[data-catalog-item]")).toHaveCount(catalogCounts.artworkWorks);
  await expect(page.locator("[data-catalog-count]")).toHaveText(String(catalogCounts.artworkWorks));
  await expect(page.locator("[data-catalog-item]:not([hidden])")).toHaveCount(30);
  const filters = page.getByRole("button", { name: "Фильтры" });
  await filters.click();
  await expect(filters).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Закрыть" })).toBeVisible();

  await page.locator("button[data-type='work on paper']").click();
  await expect(page.locator("button[data-type='work on paper']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-catalog-count]")).toHaveText(String(workOnPaperCount));
  await expect(page.locator("[data-catalog-item]:not([hidden])")).toHaveCount(workOnPaperCount);
  await page.locator("[data-catalog-search]").fill("Гурзуф");
  await expect(page.locator("[data-catalog-count]")).toHaveText("0");
  await page.getByRole("button", { name: "Закрыть" }).click();
  await page.locator("[data-catalog-reset]").click();
  await expect(page.locator("[data-catalog-count]")).toHaveText(String(catalogCounts.artworkWorks));
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

  await page.goto("/works/fotokompozitsiya-bad98140/");
  const heading = page.getByRole("heading", { name: "Фотокомпозиция", level: 1 });
  expect(await elementFitsViewport(heading)).toBe(true);
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(await page.evaluate(() => document.documentElement.clientWidth));
});

test("mobile exhibition anchor enters and leaves the homepage tour", async ({ page }) => {
  await page.goto("/#erzia-tour");
  const tour = page.locator("section#erzia-tour[data-tour-shell]");
  const frame = tour.locator("iframe[data-tour-frame]");
  const enter = tour.locator("[data-tour-enter]");
  const exit = tour.locator("[data-tour-exit]");

  await expect(tour).toBeInViewport();
  expect(await frame.evaluate((element) => element.hasAttribute("src"))).toBe(false);
  await enter.click();
  await expect(exit).toBeVisible();
  await exit.click();
  await expect(enter).toBeFocused();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test("reduced motion uses the static journey fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-landscape-journey]")).toHaveAttribute("data-landscape-status", "fallback");
  await expect(page.locator(".landscape-journey__sticky")).toBeHidden();
  await expect(page.locator(".landscape-journey__fallback")).toBeVisible();
});
