import runtimeJson from "../../generated/site-runtime.json";
import siteConfigJson from "../../config/site-config.json";
import type {
  AssetView,
  CatalogFixtures,
  CatalogManifest,
  RouteRegistry,
  SiteContent,
  SiteRuntimeBundle,
  WorkDetail,
  WorkSummary
} from "./model";

function assertRuntimeBoundary(value: unknown): asserts value is SiteRuntimeBundle {
  if (!value || typeof value !== "object") throw new Error("Invalid site runtime: expected an object");
  const runtime = value as Partial<SiteRuntimeBundle>;
  if (runtime.schemaVersion !== "1.0.0") throw new Error(`Unsupported site runtime schema: ${runtime.schemaVersion}`);
  if (!Array.isArray(runtime.works) || !Array.isArray(runtime.assets)) {
    throw new Error("Invalid site runtime: works and assets are required");
  }
  if (runtime.counts?.works !== runtime.works.length || runtime.counts?.assets !== runtime.assets.length) {
    throw new Error("Invalid site runtime: generated counts do not match records");
  }
  if (!runtime.indexes || !runtime.routeRegistry) {
    throw new Error("Invalid site runtime: indexes and routes are required");
  }
}

assertRuntimeBoundary(runtimeJson);
const runtime: SiteRuntimeBundle = runtimeJson;
const siteConfig: SiteContent = siteConfigJson;
const works: readonly WorkDetail[] = runtime.works;
const assets: readonly AssetView[] = runtime.assets;

export const listWorks = (): readonly WorkSummary[] => works;
export const listAssets = (): readonly AssetView[] => assets;

export function getWorkById(workId: string): WorkDetail | undefined {
  const position = runtime.indexes.workIdToIndex[workId];
  return position === undefined ? undefined : works[position];
}

export function getWorkBySlug(publicSlug: string): WorkDetail | undefined {
  const position = runtime.indexes.workSlugToIndex[publicSlug];
  return position === undefined ? undefined : works[position];
}

export function getWorkByCatalog(identifier: string): WorkDetail | undefined {
  return getWorkBySlug(identifier) ?? getWorkById(identifier);
}

export function getAsset(assetId: string): AssetView | undefined {
  const position = runtime.indexes.assetIdToIndex[assetId];
  return position === undefined ? undefined : assets[position];
}

export const getCatalogManifest = (): CatalogManifest => ({
  ...runtime.manifest,
  runtimeSchemaVersion: runtime.schemaVersion,
  sourceSnapshotId: runtime.sourceSnapshotId,
  sourceDigest: runtime.sourceDigest
});

const routeRegistry: RouteRegistry = {
  staticPaths: siteConfig.staticRoutes,
  workPaths: runtime.routeRegistry.workPaths,
  sitemapPaths: [...siteConfig.staticRoutes, ...runtime.routeRegistry.workPaths],
  legacyRedirects: runtime.legacyRedirects
};

export const getRouteRegistry = (): RouteRegistry => routeRegistry;
export const getSiteContent = (): SiteContent => siteConfig;
export const getCatalogFixtures = (): CatalogFixtures => runtime.fixtures;
