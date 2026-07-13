import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers";

test("homepage is the production Sunday Light experience", async ({ page }) => {
  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleIssues.push(message.text());
  });

  await page.goto("/");
  await expect(page).toHaveTitle("Никита Пичугин — мастерская художника");
  await expect(page.getByRole("heading", { name: "Никита Пичугин" })).toBeVisible();
  await expect(page.locator(".sunday-header img")).toHaveAttribute("src", "/favicon.png");
  await expect(page.locator(".sunday-footer img")).toHaveAttribute("src", "/favicon.png");
  const headerExhibitionLink = page.locator("nav[aria-label='Основная навигация'] a[href='/exhibitions/erzia/']");
  const footerExhibitionLink = page.locator("nav[aria-label='Нижняя навигация'] a[href='/exhibitions/erzia/']");
  await expect(headerExhibitionLink).toHaveCount(1);
  await expect(headerExhibitionLink).toHaveText("Выставка");
  await expect(footerExhibitionLink).toHaveCount(1);
  await expect(footerExhibitionLink).toHaveText("Выставка");
  await expect(page.locator(".prototype-switcher")).toHaveCount(0);
  await expect(page.locator("meta[name='robots'][content*='noindex']")).toHaveCount(0);
  await expect(page.locator("[data-landscape-journey]")).toHaveAttribute("data-landscape-status", "ready");
  await expect(page.locator("text=/Vite|Astro.*error|Unhandled Runtime Error/i")).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  expect(consoleIssues).toEqual([]);
});

test("exhibition is discoverable in editorial contexts", async ({ page }) => {
  for (const [route, entry] of [["/", "home"], ["/contact/", "contact"]]) {
    await page.goto(route);
    const link = page.locator(`[data-exhibition-entry='${entry}']`);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/exhibitions/erzia/");
    await expect(link).not.toHaveAttribute("target", "_blank");
  }
});

test("studio presents every observation", async ({ page }) => {
  await page.goto("/studio/");
  await expect(page.getByRole("heading", { name: "Мастерская" })).toBeVisible();
  await expect(page.locator(".studio-process__item")).toHaveCount(11);
  await expect(page.locator(".observation-wall__item")).toHaveCount(87);
  await expect(page.getByText("Выставка в Музее Эрьзи")).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test("canonical destinations for hosting redirects exist", async ({ request }) => {
  for (const route of ["/contact/", "/studio/", "/works/otrazhenie-081413fe/"]) {
    const response = await request.get(route);
    expect(response.status()).toBe(200);
  }
});

test("404 is excluded from indexing", async ({ page }) => {
  const response = await page.goto("/missing-editorial-test/");
  expect(response?.status()).toBe(404);
  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", "noindex,follow");
  await expect(page.locator("link[rel='canonical']")).toHaveCount(0);
});
