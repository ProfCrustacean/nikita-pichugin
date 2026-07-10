import { expect, test } from "@playwright/test";

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
  await expect(page.locator(".prototype-switcher")).toHaveCount(0);
  await expect(page.locator("meta[name='robots'][content*='noindex']")).toHaveCount(0);
  await expect(page.locator("[data-landscape-journey]")).toHaveAttribute("data-landscape-status", "ready");
  await expect(page.locator("text=/Vite|Astro.*error|Unhandled Runtime Error/i")).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  expect(consoleIssues).toEqual([]);
});

test("catalog exposes all artworks and its filters work", async ({ page }, testInfo) => {
  await page.goto("/works/");
  await expect(page.locator("[data-catalog-item]")).toHaveCount(183);
  await expect(page.locator("[data-catalog-count]")).toHaveText("183");

  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Фильтры" }).click();
  }

  await page.locator("button[data-type='work on paper']").click();
  await expect(page.locator("button[data-type='work on paper']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-catalog-count]")).toHaveText("9");
  await expect(page.locator("[data-catalog-item]:not([hidden])")).toHaveCount(9);

  await page.locator("[data-catalog-search]").fill("Гурзуф");
  await expect(page.locator("[data-catalog-count]")).toHaveText("0");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Закрыть" }).click();
  }
  await page.locator("[data-catalog-reset]").click();
  await expect(page.locator("[data-catalog-count]")).toHaveText("183");
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

test("photographic works use a neutral public title", async ({ page }, testInfo) => {
  await page.goto("/works/fotokompozitsiya-bad98140/");
  const heading = page.getByRole("heading", { name: "Фотокомпозиция", level: 1 });
  await expect(heading).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/NP-[0-9]{4}|Фотография,/);
  await expect(page.locator("meta[name='description']")).not.toHaveAttribute("content", /г\.\.|Дата уточняется/);
  await expect(page.locator("script[type='application/ld+json']")).toHaveCount(1);
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(await page.evaluate(() => document.documentElement.clientWidth));

  if (testInfo.project.name === "desktop") {
    for (const width of [768, 1024, 1366, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await elementFitsViewport(heading)).toBe(true);
    }
  }
});

test("undated photographic work does not promise a date", async ({ page }) => {
  await page.goto("/works/fotokompozitsiya-22a21a77/");
  await expect(page).toHaveTitle("Фотокомпозиция — Никита Пичугин");
  await expect(page.locator("meta[name='description']")).toHaveAttribute("content", "Фотокомпозиция Никиты Пичугина.");
  await expect(page.locator("body")).not.toContainText("Дата уточняется");
});

test("404 is excluded from indexing", async ({ page }) => {
  const response = await page.goto("/missing-editorial-test/");
  expect(response?.status()).toBe(404);
  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", "noindex,follow");
  await expect(page.locator("link[rel='canonical']")).toHaveCount(0);
});

test("mobile menu is usable and does not expose the text logo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile navigation check.");
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
  await expect(navigation.getByRole("link", { name: "Работы" })).toBeFocused();
  const menuGeometry = await navigation.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const links = [...element.querySelectorAll("a")].map((link) => link.getBoundingClientRect());
    return {
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight,
      linksFit: links.every((link) => link.top >= 0 && link.bottom <= window.innerHeight)
    };
  });
  expect(menuGeometry.top).toBe(0);
  expect(menuGeometry.bottom).toBeGreaterThanOrEqual(menuGeometry.viewportHeight - 1);
  expect(menuGeometry.linksFit).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".sunday-mark")).toBeFocused();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test("mobile headings and catalog controls stay usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile geometry check.");
  for (const route of ["/", "/works/", "/archive/", "/studio/", "/contact/"]) {
    await page.goto(route);
    expect(await elementFitsViewport(page.locator("h1"))).toBe(true);
  }

  await page.goto("/works/");
  await expect(page.locator("[data-catalog-item]:not([hidden])")).toHaveCount(30);
  const filters = page.getByRole("button", { name: "Фильтры" });
  await filters.click();
  await expect(filters).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Закрыть" })).toBeVisible();
});

test("reduced motion uses the static journey fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-landscape-journey]")).toHaveAttribute("data-landscape-status", "fallback");
  await expect(page.locator(".landscape-journey__sticky")).toBeHidden();
  await expect(page.locator(".landscape-journey__fallback")).toBeVisible();
});

async function horizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function elementFitsViewport(locator: import("@playwright/test").Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= -1 && rect.right <= window.innerWidth + 1;
  });
}
