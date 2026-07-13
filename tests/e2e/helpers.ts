import type { Locator, Page } from "@playwright/test";

export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

export async function elementFitsViewport(locator: Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= -1 && rect.right <= window.innerWidth + 1;
  });
}

export async function navigationGeometry(locator: Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const links = [...element.querySelectorAll("a")].map((link) => link.getBoundingClientRect());
    return {
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight,
      linksFit: links.every((link) => link.top >= 0 && link.bottom <= window.innerHeight)
    };
  });
}
