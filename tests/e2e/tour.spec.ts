import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers";

test("homepage activates the complete local Erzia tour only on request", async ({ page, request }) => {
  const failedTourResponses: string[] = [];
  const tourRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/tours/erzia-pichugin/")) tourRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.url().includes("/tours/erzia-pichugin/") && !response.ok()) {
      failedTourResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/");
  const tour = page.locator("section#erzia-tour[data-tour-shell]");
  const tourFrame = tour.locator("iframe[data-tour-frame]");
  const enter = tour.locator("[data-tour-enter]");
  const exit = tour.locator("[data-tour-exit]");

  await expect(tour).toHaveCount(1);
  await expect(tourFrame).toHaveAttribute("data-tour-src", "/tours/erzia-pichugin/index.html");
  expect(await tourFrame.evaluate((frame) => frame.hasAttribute("src"))).toBe(false);
  await expect(enter).toBeVisible();
  await expect(exit).toBeHidden();
  expect(tourRequests).toEqual([]);

  await enter.click();
  await expect(tour).toHaveAttribute("data-started", "true");
  await expect(tourFrame).toHaveAttribute("src", "/tours/erzia-pichugin/index.html");
  await expect(exit).toBeVisible();

  const frame = page.frameLocator("iframe[data-tour-frame]");
  await expect(frame.locator("#container")).toBeVisible();
  await expect(exit).toBeInViewport();
  await expect(exit).toBeFocused();
  await expect(page.locator("a[href*='erzia-museum.ru'], a[href*='k360.ru']")).toHaveCount(0);
  await expect(frame.locator("a[href*='erzia-museum.ru'], a[href*='k360.ru']")).toHaveCount(0);
  expect(tourRequests.length).toBeGreaterThan(0);

  await exit.click();
  await expect(tour).not.toHaveAttribute("data-started", "true");
  await expect(enter).toBeVisible();
  await expect(enter).toBeFocused();
  await expect(tourFrame).toHaveAttribute("src", "/tours/erzia-pichugin/index.html");

  await enter.click();
  await expect(tour).toHaveAttribute("data-started", "true");
  await page.keyboard.press("Escape");
  await expect(tour).not.toHaveAttribute("data-started", "true");
  await expect(enter).toBeFocused();

  const [indexResponse, configResponse, playerResponse, tileResponse] = await Promise.all([
    request.get("/tours/erzia-pichugin/index.html"),
    request.get("/tours/erzia-pichugin/museum-01.xml"),
    request.get("/tours/erzia-pichugin/pano2vr_player.js"),
    request.get("/tours/erzia-pichugin/images/05_o_0.jpg")
  ]);
  for (const response of [indexResponse, configResponse, playerResponse, tileResponse]) {
    expect(response.status()).toBe(200);
    expect((await response.body()).byteLength).toBeGreaterThan(0);
  }

  const indexHtml = await indexResponse.text();
  const configXml = await configResponse.text();
  expect(indexHtml).not.toMatch(/erzia-museum\.ru|k360\.ru/i);
  expect(configXml.match(/<panorama\b/g)).toHaveLength(5);
  expect(configXml.match(/<hotspot\b/g)).toHaveLength(8);
  expect(configXml).not.toMatch(/https?:\/\/(?:[^/]*\.)?(?:erzia-museum\.ru|k360\.ru)/i);
  expect(failedTourResponses).toEqual([]);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});
