import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

test("public site smoke flow", async ({ page }) => {
  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/Никита Пичугин/);
  await expect(page.locator(".site-header .brand-mark")).toHaveAttribute("src", "/content/brand/np-logo.png");
  await expect(page.locator(".site-footer .brand-mark")).toHaveAttribute("src", "/content/brand/np-logo.png");
  await expect(page.getByRole("heading", { name: "Никита Пичугин" })).toBeVisible();
  await expect(page.getByText("Официальный сайт художника").first()).toBeVisible();
  await expect(page.locator("text=/Vite|Astro.*error|Unhandled Runtime Error/i")).toHaveCount(0);

  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const canvasScreenshot = await canvas.screenshot();
  expect(await countVisiblePixels(canvasScreenshot)).toBeGreaterThan(1_000);

  const filters = page.locator(".works-stage__filters");
  const yearFilter = filters.getByRole("button", { name: /2022/ });
  await yearFilter.click();
  await expect(yearFilter).toHaveAttribute("aria-pressed", "true");
  const worksSection = page.locator("#works");
  await expect.poll(() => yearFilter.evaluate((filter) => getComputedStyle(filter).borderBottomColor)).toBe("rgb(255, 31, 50)");
  await expect
    .poll(() => worksSection.locator(".archive-index__row[aria-current='true']").evaluate((row) => getComputedStyle(row).borderColor))
    .toBe("rgb(248, 248, 242)");
  const openWorkLink = worksSection.getByRole("link", { name: /Открыть работу/ });
  await expect(openWorkLink).toBeVisible();

  await openWorkLink.click();
  await expect(page).toHaveURL(/\/portfolios\//);
  await expect(page.getByRole("link", { name: /Назад к работам/ })).toBeVisible();

  await page.goto("/contact-info/");
  await expect(page.getByRole("link", { name: /8.*927.*177.*68.*78/ })).toHaveAttribute("href", "tel:+79271776878");
  await expect(page.getByRole("link", { name: /x-tarmit@yandex\.ru/ })).toHaveAttribute("href", "mailto:x-tarmit@yandex.ru");

  expect(consoleIssues.filter(isRelevantConsoleIssue)).toEqual([]);
});

test("home feed mixed timeline flow", async ({ page }) => {
  await page.goto("/");

  const lenta = page.locator("#lenta");
  await expect(lenta).toBeVisible();
  await expect(lenta.getByRole("heading", { name: "Лента на главной" })).toBeVisible();

  const artworkCards = lenta.locator(".lenta-card[data-kind='artwork']");
  expect(await artworkCards.count()).toBe(25);
  await expect(lenta.locator(".lenta-card[data-kind='studio']")).toHaveCount(0);
  await expect(lenta.getByText("Кадр мастерской")).toHaveCount(0);

  const year2025 = lenta.locator(".lenta-stage__filter").filter({ hasText: "2025" });
  await year2025.click();
  await expect(year2025).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => year2025.evaluate((filter) => getComputedStyle(filter).borderBottomColor)).toBe("rgb(255, 31, 50)");
  await expect
    .poll(() => lenta.locator(".lenta-card[aria-current='true']").evaluate((card) => getComputedStyle(card).borderColor))
    .toBe("rgb(248, 248, 242)");
  await expect(lenta.getByRole("link", { name: /Открыть работу/ })).toBeVisible();
  expect(await lenta.locator(".lenta-card").evaluateAll((cards) => Array.from(new Set(cards.map((card) => card.getAttribute("data-year")))))).toEqual([
    "2025"
  ]);

  const year2026 = lenta.locator(".lenta-stage__filter").filter({ hasText: "2026" });
  await expect(year2026).toHaveCount(0);
  const archiveFilter = lenta.locator(".lenta-stage__filter").filter({ hasText: "Архив" });
  await archiveFilter.click();
  await expect(archiveFilter).toHaveAttribute("aria-pressed", "true");
  await expect(lenta.getByRole("link", { name: /Открыть работу/ })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("home feed hover advances only after leaving and re-entering card bounds", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Hover navigation is a desktop pointer behavior.");
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 761, height: 666 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("#lenta").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.mouse.move(12, 12);

  const initial = await getLentaHoverState(page);
  const firstRightTarget = findVisibleNeighbor(initial, 1);
  await hoverCardAndAssertSingleActivation(page, firstRightTarget);

  const afterFirstHover = await getLentaHoverState(page);
  const secondRightTarget = findVisibleNeighbor(afterFirstHover, 1);
  await leaveLentaCardBounds(page);
  await hoverCardAndAssertSingleActivation(page, secondRightTarget);

  const afterSecondHover = await getLentaHoverState(page);
  const leftTarget = findVisibleNeighbor(afterSecondHover, -1);
  await leaveLentaCardBounds(page);
  await hoverCardAndAssertSingleActivation(page, leftTarget);
});

test("home feed keeps active card centered during arrow navigation", async ({ page }) => {
  await page.setViewportSize({ width: 761, height: 666 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("#lenta").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const initialState = await getKeyboardGalleryState(page, "#lenta", ".lenta-card");
  const expectedActiveIndex = (initialState.activeIndex + 1) % initialState.count;
  await page.locator("#lenta .lenta-card[aria-current='true']").focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await getKeyboardGalleryState(page, "#lenta", ".lenta-card")).activeIndex)
    .toBe(expectedActiveIndex);
  await page.waitForTimeout(1_120);

  const finalState = await getLentaCenterState(page);
  expect(Math.abs(finalState.centerDelta)).toBeLessThanOrEqual(2);
  expect(finalState.scrollSnapType).toBe("x mandatory");
  expect(finalState.transitionProperty).toContain("transform");
  expect(finalState.neighborTransform).not.toBe("none");
});

test("home feed accepts page-level arrow keys without native scroll jumps", async ({ page }) => {
  await page.setViewportSize({ width: 761, height: 666 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("#lenta").scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  const initialState = await getKeyboardGalleryState(page, "#lenta", ".lenta-card");
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await getKeyboardGalleryState(page, "#lenta", ".lenta-card")).activeIndex)
    .toBe((initialState.activeIndex + 1) % initialState.count);
  await page.waitForTimeout(1_120);

  const centeredState = await getLentaCenterState(page);

  expect(Math.abs(centeredState.centerDelta)).toBeLessThanOrEqual(2);
  expect(centeredState.scrollSnapType).toBe("x mandatory");
});

test("arrow keys navigate image galleries across the site", async ({ page }) => {
  await page.goto("/");

  const lenta = page.locator("#lenta");
  await lenta.scrollIntoViewIfNeeded();
  const initialLenta = await getKeyboardGalleryState(page, "#lenta", ".lenta-card");
  expect(initialLenta.count).toBeGreaterThan(1);
  await lenta.locator(".lenta-card[aria-current='true']").focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await getKeyboardGalleryState(page, "#lenta", ".lenta-card")).activeIndex)
    .toBe((initialLenta.activeIndex + 1) % initialLenta.count);

  const works = page.locator("#works");
  await works.scrollIntoViewIfNeeded();
  const initialWorks = await getKeyboardGalleryState(page, "#works", ".archive-index__row");
  expect(initialWorks.count).toBeGreaterThan(1);
  await works.locator(".archive-index__row[aria-current='true']").focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await getKeyboardGalleryState(page, "#works", ".archive-index__row")).activeIndex)
    .toBe((initialWorks.activeIndex + 1) % initialWorks.count);

  const photo = page.locator("#photo .photo-grid");
  await photo.scrollIntoViewIfNeeded();
  const photoItems = photo.locator(".photo-grid__item");
  expect(await photoItems.count()).toBeGreaterThan(1);
  await photoItems.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(photo.locator(".photo-grid__item[data-keyboard-active='true']")).toHaveCount(1);
  await expect(photoItems.nth(1)).toHaveAttribute("data-keyboard-active", "true");
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains("photo-grid__item"))).toBe(true);
});

test("arrow keys switch images on artwork detail pages", async ({ page }) => {
  await page.goto("/portfolios/solncze-avgusta/");

  const detail = page.locator(".detail__image");
  await expect(detail.locator("[data-keyboard-item]")).toHaveCount(5);
  await expect(detail.locator("[data-keyboard-main-image]")).toHaveAttribute("src", /\/content\/images\/artworks\/solncze-avgusta\/01\.webp$/);
  await expect(detail.locator("[data-keyboard-count]")).toHaveText("01 / 05");

  await detail.locator("[data-keyboard-item]").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(detail.locator("[data-keyboard-main-image]")).toHaveAttribute("src", /\/content\/images\/artworks\/solncze-avgusta\/02\.webp$/);
  await expect(detail.locator("[data-keyboard-count]")).toHaveText("02 / 05");
  await expect(detail.locator("[data-keyboard-item]").nth(1)).toHaveAttribute("aria-current", "true");

  await page.keyboard.press("ArrowLeft");
  await expect(detail.locator("[data-keyboard-main-image]")).toHaveAttribute("src", /\/content\/images\/artworks\/solncze-avgusta\/01\.webp$/);
  await expect(detail.locator("[data-keyboard-count]")).toHaveText("01 / 05");
  await expect(detail.locator("[data-keyboard-item]").first()).toHaveAttribute("aria-current", "true");
});

test("hero portrait stays complete across breakpoints", async ({ page }) => {
  const sizes = [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 599, height: 666 },
    { width: 390, height: 844 },
    { width: 320, height: 568 }
  ];

  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto("/");
    const report = await getHeroPortraitReport(page);

    expect(report.atelierWallCount, `${size.width}x${size.height}: no artwork wall in hero`).toBe(0);
    expect(report.visibleAtelierItems, `${size.width}x${size.height}: no visible artwork pieces in hero`).toBe(0);
    expect(report.objectFit, `${size.width}x${size.height}: portrait must not use cover crop`).toBe("contain");
    expect(report.clipPath, `${size.width}x${size.height}: portrait frame must not mask the figure`).toBe("none");
    expect(report.overflow, `${size.width}x${size.height}: portrait frame must not clip the figure`).toBe("visible");
    expect(report.opacity, `${size.width}x${size.height}: portrait must not reveal background art through transparency`).toBeCloseTo(1, 3);
    expect(report.imageComplete, `${size.width}x${size.height}: portrait image should be loaded`).toBe(true);
    expect(report.imageNaturalWidth, `${size.width}x${size.height}: portrait source width should be known`).toBeGreaterThan(0);
    expect(report.imageNaturalHeight, `${size.width}x${size.height}: portrait source height should be known`).toBeGreaterThan(0);
    expect(report.scrollWidth, `${size.width}x${size.height}: hero should not cause horizontal overflow`).toBeLessThanOrEqual(size.width + 1);
    expect(report.portrait.left, `${size.width}x${size.height}: portrait should not leave viewport left`).toBeGreaterThanOrEqual(-1);
    expect(report.portrait.right, `${size.width}x${size.height}: portrait should not leave viewport right`).toBeLessThanOrEqual(size.width + 1);
    expect(report.portrait.top, `${size.width}x${size.height}: portrait should not leave viewport top`).toBeGreaterThanOrEqual(-1);
    expect(report.portrait.bottom, `${size.width}x${size.height}: portrait should not leave viewport bottom`).toBeLessThanOrEqual(size.height + 1);
  }
});

test("reduced-motion hero keeps portrait without artwork wall", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect.poll(() => page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  await expect(page.locator("canvas").first()).toBeHidden();
  await expect(page.locator(".atelier-hero__wall")).toHaveCount(0);
  await expect(page.locator(".hero__portrait img")).toBeVisible();
  await expect.poll(() => page.locator(".hero__portrait img").evaluate((image) => getComputedStyle(image).objectFit)).toBe("contain");
});

async function getHeroPortraitReport(page: Page) {
  return page.locator(".hero").evaluate((hero) => {
    const portrait = hero.querySelector<HTMLElement>(".hero__portrait");
    const frame = hero.querySelector<HTMLElement>(".hero__portrait-frame");
    const image = hero.querySelector<HTMLImageElement>(".hero__portrait img");

    if (!portrait || !frame || !image) {
      throw new Error("Hero portrait markup is missing");
    }

    const portraitStyle = getComputedStyle(portrait);
    const frameStyle = getComputedStyle(frame);
    const imageStyle = getComputedStyle(image);
    const rect = portrait.getBoundingClientRect();
    const visibleAtelierItems = Array.from(hero.querySelectorAll<HTMLElement>(".atelier-piece")).filter((item) => {
      const style = getComputedStyle(item);
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
    }).length;

    return {
      atelierWallCount: hero.querySelectorAll(".atelier-hero__wall").length,
      visibleAtelierItems,
      imageComplete: image.complete,
      imageNaturalWidth: image.naturalWidth,
      imageNaturalHeight: image.naturalHeight,
      objectFit: imageStyle.objectFit,
      clipPath: frameStyle.clipPath,
      overflow: frameStyle.overflow,
      opacity: Number(portraitStyle.opacity),
      scrollWidth: document.documentElement.scrollWidth,
      portrait: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      }
    };
  });
}

interface LentaHoverCard {
  index: number;
  current: boolean;
  rect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
}

interface LentaHoverState {
  activeIndex: number;
  scrollLeft: number;
  visibleCards: LentaHoverCard[];
}

async function getLentaHoverState(page: Page): Promise<LentaHoverState> {
  return page.locator("#lenta").evaluate((section) => {
    const rail = section.querySelector<HTMLElement>(".lenta-stage__rail");
    const railRect = rail?.getBoundingClientRect();
    const cards = Array.from(section.querySelectorAll<HTMLElement>(".lenta-card"));
    const active = section.querySelector<HTMLElement>(".lenta-card[aria-current='true']");
    const activeIndex = cards.indexOf(active as HTMLElement);
    return {
      activeIndex,
      scrollLeft: rail?.scrollLeft || 0,
      visibleCards: cards
        .map((card, index) => {
          const rect = card.getBoundingClientRect();
          const visibleLeft = Math.max(rect.left, railRect?.left || 0, 0);
          const visibleRight = Math.min(rect.right, railRect?.right || innerWidth, innerWidth);
          const visibleTop = Math.max(rect.top, railRect?.top || 0, 0);
          const visibleBottom = Math.min(rect.bottom, railRect?.bottom || innerHeight, innerHeight);
          return {
            index,
            current: card.getAttribute("aria-current") === "true",
            rect: {
              left: visibleLeft,
              right: visibleRight,
              top: visibleTop,
              bottom: visibleBottom,
              width: Math.max(visibleRight - visibleLeft, 0),
              height: Math.max(visibleBottom - visibleTop, 0)
            }
          };
        })
        .filter((card) => card.rect.width > 8 && card.rect.height > 8)
    };
  });
}

function findVisibleNeighbor(state: LentaHoverState, direction: 1 | -1) {
  const candidates = state.visibleCards
    .filter((card) => (direction === 1 ? card.index > state.activeIndex : card.index < state.activeIndex))
    .sort((a, b) => (direction === 1 ? a.index - b.index : b.index - a.index));
  const target = candidates[0];
  expect(target, `visible ${direction === 1 ? "right" : "left"} neighbor for active index ${state.activeIndex}`).toBeDefined();
  return target;
}

async function hoverCardAndAssertSingleActivation(page: Page, target: LentaHoverCard) {
  await page.mouse.move((target.rect.left + target.rect.right) / 2, (target.rect.top + target.rect.bottom) / 2, { steps: 6 });
  await expect.poll(async () => (await getLentaHoverState(page)).activeIndex, { timeout: 2_500 }).toBe(target.index);
  const activeAfterHover = await getLentaHoverState(page);
  expect(activeAfterHover.activeIndex).toBe(target.index);
  await page.waitForTimeout(1_100);
  const activeAfterStationaryCursor = await getLentaHoverState(page);
  expect(activeAfterStationaryCursor.activeIndex).toBe(target.index);
}

async function leaveLentaCardBounds(page: Page) {
  await page.mouse.move(12, 12, { steps: 8 });
  await page.waitForTimeout(120);
  const pointerIsInsideCard = await page.evaluate(() => Boolean(document.elementFromPoint(12, 12)?.closest(".lenta-card")));
  expect(pointerIsInsideCard).toBe(false);
}

async function getKeyboardGalleryState(page: Page, gallerySelector: string, itemSelector: string) {
  return page.locator(gallerySelector).evaluate(
    (gallery, selector) => {
      const items = Array.from(gallery.querySelectorAll<HTMLElement>(selector));
      const active = gallery.querySelector<HTMLElement>(
        `${selector}[aria-current='true'], ${selector}[data-keyboard-active='true']`
      );

      return {
        activeIndex: items.indexOf(active as HTMLElement),
        count: items.length
      };
    },
    itemSelector
  );
}

async function getLentaCenterState(page: Page) {
  return page.evaluate(() => {
    const section = document.querySelector<HTMLElement>("#lenta");
    const rail = section?.querySelector<HTMLElement>(".lenta-stage__rail");
    const active = section?.querySelector<HTMLElement>(".lenta-card[aria-current='true']");
    if (!section || !rail || !active) {
      return {
        centerDelta: Number.POSITIVE_INFINITY,
        scrollSnapType: "",
        transitionProperty: "",
        neighborTransform: ""
      };
    }

    const railRect = rail.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const cards = Array.from(section.querySelectorAll<HTMLElement>(".lenta-card"));
    const activeIndex = cards.indexOf(active);
    const neighbor = cards[activeIndex + 1] || cards[activeIndex - 1] || null;
    return {
      centerDelta: activeRect.left + activeRect.width / 2 - (railRect.left + railRect.width / 2),
      scrollSnapType: getComputedStyle(rail).scrollSnapType,
      transitionProperty: getComputedStyle(active).transitionProperty,
      neighborTransform: neighbor ? getComputedStyle(neighbor).transform : ""
    };
  });
}

async function countVisiblePixels(buffer: Buffer) {
  const image = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visible = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];
    const a = image.data[index + 3];
    if (a > 0 && r + g + b > 32) {
      visible += 1;
    }
  }
  return visible;
}

function isRelevantConsoleIssue(issue: string) {
  return ![
    "THREE.Clock: This module has been deprecated",
    "GPU stall due to ReadPixels",
    "Astro background:",
    "THREE.WebGLRenderer"
  ].some((knownDiagnostic) => issue.includes(knownDiagnostic));
}
