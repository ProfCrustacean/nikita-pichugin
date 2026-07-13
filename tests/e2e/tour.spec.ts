import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers";

test("Erzia exhibition uses the complete local virtual tour", async ({ page, request }) => {
  await page.goto("/studio/");
  const exhibitionLink = page.locator(".studio-tour a[href='/exhibitions/erzia/']");
  await expect(exhibitionLink).toHaveCount(1);
  await expect(exhibitionLink).toHaveAttribute("href", "/exhibitions/erzia/");

  const failedTourResponses: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/tours/erzia-pichugin/") && !response.ok()) {
      failedTourResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/exhibitions/erzia/");
  const tourFrame = page.locator("iframe[src='/tours/erzia-pichugin/index.html']");
  await expect(tourFrame).toBeVisible();
  await expect(page.locator("a[href*='erzia-museum.ru'], a[href*='k360.ru']")).toHaveCount(0);

  const frame = page.frameLocator("iframe[src='/tours/erzia-pichugin/index.html']");
  await expect(frame.locator("#container")).toBeVisible();
  await expect(frame.locator("a[href*='erzia-museum.ru'], a[href*='k360.ru']")).toHaveCount(0);

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
