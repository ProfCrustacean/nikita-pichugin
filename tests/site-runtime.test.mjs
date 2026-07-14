import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  PROJECT_ROOT,
  SITE_RUNTIME_PATH,
  buildSiteRuntime,
  deriveLegacyRedirects,
  loadCanonicalCatalog,
  serializeSiteRuntime,
  validateSiteConfig,
  validateSiteRuntime
} from "../scripts/site-runtime.mjs";
import {
  getAsset,
  getCatalogManifest,
  getRouteRegistry,
  getSiteContent,
  getWorkByCatalog,
  listAssets,
  listWorks
} from "../src/domain/catalog/repository.ts";

let source;
let runtime;

beforeAll(async () => {
  source = await loadCanonicalCatalog();
  runtime = buildSiteRuntime(source);
});

describe("site runtime generator", () => {
  it("is deterministic and keeps the tracked runtime current", async () => {
    const rebuilt = buildSiteRuntime(source);
    const serialized = serializeSiteRuntime(runtime);
    expect(serializeSiteRuntime(rebuilt)).toBe(serialized);
    expect(await readFile(path.join(PROJECT_ROOT, SITE_RUNTIME_PATH), "utf8")).toBe(serialized);
    expect(runtime.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps normal site-copy changes outside the generated catalog", () => {
    const copyChanged = structuredClone(source);
    copyChanged.siteConfig.contact.email = "new-address@example.com";
    copyChanged.siteConfig.defaultDescription = "Новая вступительная строка";
    expect(serializeSiteRuntime(buildSiteRuntime(copyChanged))).toBe(serializeSiteRuntime(runtime));
    expect(runtime).not.toHaveProperty("siteContent");
    expect(runtime.routeRegistry).not.toHaveProperty("staticPaths");
    expect(runtime.routeRegistry).not.toHaveProperty("sitemapPaths");
  });

  it("rejects missing and unknown fields at the strict runtime boundary", () => {
    const missing = structuredClone(runtime);
    delete missing.works[0].displayTitle;
    expect(validateSiteRuntime(missing).join("\n")).toContain("displayTitle");

    const unknown = structuredClone(runtime);
    unknown.works[0].unexpected = true;
    expect(validateSiteRuntime(unknown).join("\n")).toContain("additional properties");
  });

  it("validates site copy, navigation routes, and configured assets without rebuilding the catalog", () => {
    expect(validateSiteConfig(source.siteConfig, { assets: runtime.assets })).toEqual([]);

    const invalid = structuredClone(source.siteConfig);
    invalid.navigation.push({ label: "Повтор", href: "/works/" });
    invalid.exhibitionTourPath = "/missing/";
    invalid.portraitAssetId = "asset_0000000000000000";
    invalid.unexpected = true;
    const errors = validateSiteConfig(invalid, { assets: runtime.assets }).join("\n");
    expect(errors).toContain("additional properties");

    delete invalid.unexpected;
    const semanticErrors = validateSiteConfig(invalid, { assets: runtime.assets }).join("\n");
    expect(semanticErrors).toContain("duplicate route");
    expect(semanticErrors).toContain("exhibitionTourPath");
    expect(semanticErrors).toContain("missing asset");
  });

  it("preserves catalog order, links, and source counts while dropping archival-only fields", () => {
    expect(runtime.works.map(({ workId }) => workId)).toEqual(source.works.map(({ workId }) => workId));
    expect(runtime.assets.map(({ assetId }) => assetId)).toEqual(source.assets.map(({ assetId }) => assetId));
    expect(runtime.counts).toEqual(source.manifest.counts);
    expect(runtime.routeRegistry.workPaths).toEqual(
      source.works.map((work) => `/works/${work.publicSlug}/`)
    );
    expect(runtime.works[0]).not.toHaveProperty("sourceKey");
    expect(runtime.works[0]).not.toHaveProperty("artistInventoryNumber");
    expect(runtime.assets[0]).not.toHaveProperty("exif");
    expect(runtime.assets[0]).not.toHaveProperty("sourceUrls");
  });

  it("keeps the generated browser-facing projection compact and report-free", () => {
    const serialized = serializeSiteRuntime(runtime);
    const keys = new Set();
    const collectKeys = (value) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) return value.forEach(collectKeys);
      for (const [key, nested] of Object.entries(value)) {
        keys.add(key);
        collectKeys(nested);
      }
    };
    collectKeys(runtime);
    expect(Buffer.byteLength(serialized)).toBeLessThanOrEqual(500_000);
    for (const forbiddenField of [
      "provenance",
      "rights",
      "history",
      "qualityControl",
      "fieldStatus",
      "sourceKey",
      "artistInventoryNumber",
      "sourceUrls",
      "wpMediaId",
      "wpPortfolioId",
      "rawLabel"
    ]) {
      expect(keys).not.toContain(forbiddenField);
    }
  });

  it("derives every portfolio redirect from canonical record sources", () => {
    const redirects = deriveLegacyRedirects(source.works, source.siteContent);
    const redirectBySource = new Map(redirects.map((redirect) => [redirect.source, redirect.destination]));
    const expectedPortfolioRedirects = new Map();
    for (const work of source.works) {
      for (const recordSource of work.recordSource) {
        const pathname = new URL(recordSource.sourcePageUrl).pathname;
        if (!recordSource.collection.startsWith("portfolio.") || !pathname.startsWith("/portfolios/")) continue;
        expectedPortfolioRedirects.set(pathname, `/works/${work.publicSlug}/`);
      }
    }

    expect(redirectBySource.get("/portfolio/galereya-rabot-hudozhnika-nikity-pichugina/")).toBe("/works/");
    expect(redirectBySource.get("/masterskaya-nikity-pichugina/")).toBe("/studio/");
    expect(redirectBySource.get("/contact-info/")).toBe("/contact/");
    for (const [sourcePath, destination] of expectedPortfolioRedirects) {
      expect(redirectBySource.get(sourcePath)).toBe(destination);
    }
    expect(redirects).toHaveLength(expectedPortfolioRedirects.size + 3);
  });

  it("exposes indexed, read-only catalog access without parsing source files", () => {
    const works = listWorks();
    const assets = listAssets();
    const firstWork = works[0];
    const firstAsset = assets[0];
    const manifest = getCatalogManifest();

    expect(getWorkByCatalog(firstWork.publicSlug)).toBe(firstWork);
    expect(getWorkByCatalog(firstWork.workId)).toBe(firstWork);
    expect(getAsset(firstAsset.assetId)).toBe(firstAsset);
    expect(manifest.counts.works).toBe(works.length);
    expect(manifest.sourceDigest).toBe(runtime.sourceDigest);
    expect(getRouteRegistry().sitemapPaths).toEqual([
      ...getSiteContent().staticRoutes,
      ...runtime.routeRegistry.workPaths
    ]);
  });
});
