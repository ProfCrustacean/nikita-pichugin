import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { catalogSchema } from "./museum-schema.mjs";
import {
  SITE_RUNTIME_SCHEMA_VERSION,
  siteConfigSchema,
  siteRuntimeSchema
} from "./site-runtime-schema.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(scriptDirectory, "..");
export const SITE_RUNTIME_PATH = path.join("src", "generated", "site-runtime.json");
export const SITE_CONFIG_PATH = path.join("src", "config", "site-config.json");

const CANONICAL_FILES = [
  ["manifest", "manifest.json", "json"],
  ["assets", "assets.jsonl", "jsonl"],
  ["works", "works.jsonl", "jsonl"],
  ["placements", "placements.jsonl", "jsonl"],
  ["authorities", "authorities.jsonl", "jsonl"],
  ["siteContent", "site-content.json", "json"]
];

const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);
const validateCanonicalSchema = ajv.compile(catalogSchema);
const validateRuntimeSchema = ajv.compile(siteRuntimeSchema);
const validateSiteConfigSchema = ajv.compile({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  ...siteConfigSchema,
  $defs: { localizedText: catalogSchema.$defs.localizedText }
});

const parseJsonLines = (source, label) => source
  .split(/\r?\n/u)
  .filter((line) => line.trim())
  .map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${label}:${index + 1}: ${error.message}`);
    }
  });

const formatSchemaErrors = (label, errors = []) => errors
  .map((error) => `${label}${error.instancePath || "/"}: ${error.message}`);

const pathnameFromLocalHref = (href) => new URL(href, "https://nikitapichugin.ru").pathname;

export function validateSiteConfig(siteConfig, { assets = [] } = {}) {
  if (!validateSiteConfigSchema(siteConfig)) {
    return formatSchemaErrors("site-config", validateSiteConfigSchema.errors);
  }

  const errors = [];
  const staticRoutes = new Set(siteConfig.staticRoutes);
  const navigationHrefs = new Set();
  if (!staticRoutes.has("/")) errors.push("site-config/staticRoutes: homepage route is required");
  const exhibitionTourPathname = pathnameFromLocalHref(siteConfig.exhibitionTourHref);
  if (!staticRoutes.has(exhibitionTourPathname)) {
    errors.push(`site-config/exhibitionTourHref: pathname is not registered: ${exhibitionTourPathname}`);
  }
  for (const item of siteConfig.navigation) {
    const pathname = pathnameFromLocalHref(item.href);
    if (!staticRoutes.has(pathname)) {
      errors.push(`site-config/navigation: pathname is not registered: ${pathname}`);
    }
    if (navigationHrefs.has(item.href)) {
      errors.push(`site-config/navigation: duplicate route: ${item.href}`);
    }
    navigationHrefs.add(item.href);
  }
  if (assets.length > 0 && !assets.some((asset) => asset.assetId === siteConfig.portraitAssetId)) {
    errors.push(`site-config/portraitAssetId: missing asset ${siteConfig.portraitAssetId}`);
  }
  return errors;
}

const pathnameFromUrl = (url) => {
  const pathname = new URL(url).pathname;
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
};

const uniqueIndex = (records, key, label) => {
  const index = {};
  records.forEach((record, position) => {
    const value = record[key];
    if (Object.hasOwn(index, value)) throw new Error(`Duplicate ${label}: ${value}`);
    index[value] = position;
  });
  return index;
};

const projectWork = (work) => ({
  workId: work.workId,
  publicSlug: work.publicSlug,
  recordType: work.recordType,
  objectWorkType: work.objectWorkType,
  titles: work.titles.map(({ language, type, preferred }) => ({ language, type, preferred })),
  displayTitle: work.displayTitle,
  creation: {
    displayDate: work.creation.displayDate,
    earliestYear: work.creation.earliestYear,
    latestYear: work.creation.latestYear,
    status: work.creation.status
  },
  capture: {
    displayDate: work.capture.displayDate,
    status: work.capture.status
  },
  physicalDescription: {
    materialsTechniquesDisplay: work.physicalDescription.materialsTechniquesDisplay,
    dimensions: {
      display: work.physicalDescription.dimensions.display,
      unit: work.physicalDescription.dimensions.unit,
      status: work.physicalDescription.dimensions.status
    },
    status: work.physicalDescription.status
  },
  subjects: {
    genre: work.subjects.genre,
    specific: work.subjects.specific,
    keywords: work.subjects.keywords
  },
  description: { ru: work.description.ru },
  assetIds: work.assetIds,
  relatedWorkIds: work.relatedWorkIds,
  recordSource: work.recordSource.map(({ collection }) => ({ collection }))
});

const projectAsset = (asset) => ({
  assetId: asset.assetId,
  previewPath: asset.previewPath,
  previewWidthPx: asset.previewWidthPx,
  previewHeightPx: asset.previewHeightPx,
  visualClass: asset.visualClass
});

export function deriveLegacyRedirects(works, siteContent) {
  const redirects = new Map([
    [pathnameFromUrl(siteContent.sourcePages.portfolio), "/works/"],
    [pathnameFromUrl(siteContent.sourcePages.photoWorks), "/studio/"],
    [pathnameFromUrl(siteContent.sourcePages.contact), "/contact/"]
  ]);

  for (const work of works) {
    for (const source of work.recordSource) {
      if (!source.collection.startsWith("portfolio.")) continue;
      const pathname = pathnameFromUrl(source.sourcePageUrl);
      if (!pathname.startsWith("/portfolios/")) continue;
      const destination = `/works/${work.publicSlug}/`;
      const existing = redirects.get(pathname);
      if (existing && existing !== destination) {
        throw new Error(`Conflicting legacy redirect: ${pathname} -> ${existing} or ${destination}`);
      }
      redirects.set(pathname, destination);
    }
  }

  const fixedSources = new Set([
    pathnameFromUrl(siteContent.sourcePages.portfolio),
    pathnameFromUrl(siteContent.sourcePages.photoWorks),
    pathnameFromUrl(siteContent.sourcePages.contact)
  ]);
  const fixed = [...redirects]
    .filter(([source]) => fixedSources.has(source))
    .map(([source, destination]) => ({ source, destination }));
  const portfolio = [...redirects]
    .filter(([source]) => !fixedSources.has(source))
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([source, destination]) => ({ source, destination }));
  return [...fixed, ...portfolio];
}

export async function loadCanonicalCatalog(projectRoot = PROJECT_ROOT) {
  const dataRoot = path.join(projectRoot, "content-export", "data");
  const loaded = {};
  const digest = createHash("sha256");

  for (const [key, filename, format] of CANONICAL_FILES) {
    const source = await readFile(path.join(dataRoot, filename), "utf8");
    digest.update(filename);
    digest.update("\0");
    digest.update(source);
    digest.update("\0");
    loaded[key] = format === "jsonl" ? parseJsonLines(source, filename) : JSON.parse(source);
  }
  const siteConfigSource = await readFile(path.join(projectRoot, SITE_CONFIG_PATH), "utf8");
  loaded.siteConfig = JSON.parse(siteConfigSource);
  const siteConfigErrors = validateSiteConfig(loaded.siteConfig, { assets: loaded.assets });
  if (siteConfigErrors.length > 0) {
    throw new Error(siteConfigErrors.join("\n"));
  }

  const bundle = {
    manifest: loaded.manifest,
    assets: loaded.assets,
    works: loaded.works,
    placements: loaded.placements,
    authorities: loaded.authorities,
    siteContent: loaded.siteContent
  };
  if (!validateCanonicalSchema(bundle)) {
    throw new Error(formatSchemaErrors("canonical", validateCanonicalSchema.errors).join("\n"));
  }

  return { ...bundle, siteConfig: loaded.siteConfig, sourceDigest: digest.digest("hex") };
}

function assertSourceParity(source) {
  const artworkWorks = source.works.filter((work) => work.recordType === "artwork").length;
  const photographicWorks = source.works.filter((work) => work.recordType === "photographic_work").length;
  const actualCounts = {
    assets: source.assets.length,
    works: source.works.length,
    artworkWorks,
    photographicWorks,
    placements: source.placements.length,
    authorities: source.authorities.length
  };
  for (const [name, actual] of Object.entries(actualCounts)) {
    if (source.manifest.counts[name] !== actual) {
      throw new Error(`Source count mismatch for ${name}: manifest ${source.manifest.counts[name]}, actual ${actual}`);
    }
  }
}

export function buildSiteRuntime(source) {
  assertSourceParity(source);
  const works = source.works.map(projectWork);
  const assets = source.assets.map(projectAsset);
  const siteConfigErrors = validateSiteConfig(source.siteConfig, { assets });
  if (siteConfigErrors.length > 0) throw new Error(siteConfigErrors.join("\n"));
  const workPaths = works.map((work) => `/works/${work.publicSlug}/`);
  const artwork = works.find((work) => work.recordType === "artwork");
  const photographicWork = works.find((work) => work.recordType === "photographic_work");
  const multiAssetWork = works.find((work) => work.assetIds.length > 1);
  if (!artwork || !photographicWork || !multiAssetWork) {
    throw new Error("Catalog fixtures require an artwork, a photographic work, and a work with multiple assets");
  }

  const runtime = {
    schemaVersion: SITE_RUNTIME_SCHEMA_VERSION,
    sourceSnapshotId: source.manifest.snapshotId,
    sourceDigest: source.sourceDigest,
    manifest: source.manifest,
    counts: source.manifest.counts,
    works,
    assets,
    indexes: {
      workIdToIndex: uniqueIndex(works, "workId", "work ID"),
      workSlugToIndex: uniqueIndex(works, "publicSlug", "work slug"),
      assetIdToIndex: uniqueIndex(assets, "assetId", "asset ID")
    },
    legacyRedirects: deriveLegacyRedirects(source.works, source.siteContent),
    fixtures: {
      artworkSlug: artwork.publicSlug,
      photographicWorkSlug: photographicWork.publicSlug,
      multiAssetWorkSlug: multiAssetWork.publicSlug
    },
    routeRegistry: {
      workPaths
    }
  };

  assertValidSiteRuntime(runtime);
  return runtime;
}

export function validateSiteRuntime(runtime) {
  const errors = [];
  if (!validateRuntimeSchema(runtime)) {
    errors.push(...formatSchemaErrors("runtime", validateRuntimeSchema.errors));
    return errors;
  }

  if (runtime.sourceSnapshotId !== runtime.manifest.snapshotId) {
    errors.push("runtime/sourceSnapshotId: must match manifest.snapshotId");
  }
  if (JSON.stringify(runtime.counts) !== JSON.stringify(runtime.manifest.counts)) {
    errors.push("runtime/counts: must match manifest.counts");
  }
  if (runtime.counts.works !== runtime.works.length) errors.push("runtime/works: count mismatch");
  if (runtime.counts.assets !== runtime.assets.length) errors.push("runtime/assets: count mismatch");
  if (runtime.counts.artworkWorks !== runtime.works.filter((work) => work.recordType === "artwork").length) {
    errors.push("runtime/works: artwork count mismatch");
  }
  if (runtime.counts.photographicWorks !== runtime.works.filter((work) => work.recordType === "photographic_work").length) {
    errors.push("runtime/works: photographic work count mismatch");
  }

  const assetIds = new Set(runtime.assets.map((asset) => asset.assetId));
  const workIds = new Set(runtime.works.map((work) => work.workId));
  for (const work of runtime.works) {
    for (const assetId of work.assetIds) {
      if (!assetIds.has(assetId)) errors.push(`runtime/works/${work.workId}: missing asset ${assetId}`);
    }
    for (const workId of work.relatedWorkIds) {
      if (!workIds.has(workId)) errors.push(`runtime/works/${work.workId}: missing related work ${workId}`);
    }
    const primaryClass = work.recordType === "artwork" ? "artwork_reproduction" : "photographic_work";
    if (!work.assetIds.some((assetId) => runtime.assets[runtime.indexes.assetIdToIndex[assetId]]?.visualClass === primaryClass)) {
      errors.push(`runtime/works/${work.workId}: no ${primaryClass} primary asset`);
    }
  }

  const expectedWorkPaths = runtime.works.map((work) => `/works/${work.publicSlug}/`);
  if (JSON.stringify(runtime.routeRegistry.workPaths) !== JSON.stringify(expectedWorkPaths)) {
    errors.push("runtime/routeRegistry: work paths are stale");
  }
  for (const [name, records, key] of [
    ["workIdToIndex", runtime.works, "workId"],
    ["workSlugToIndex", runtime.works, "publicSlug"],
    ["assetIdToIndex", runtime.assets, "assetId"]
  ]) {
    for (const [value, position] of Object.entries(runtime.indexes[name])) {
      if (records[position]?.[key] !== value) errors.push(`runtime/indexes/${name}: stale entry ${value}`);
    }
    if (Object.keys(runtime.indexes[name]).length !== records.length) {
      errors.push(`runtime/indexes/${name}: entry count mismatch`);
    }
  }

  const redirectSources = new Set();
  for (const redirect of runtime.legacyRedirects) {
    if (redirectSources.has(redirect.source)) errors.push(`runtime/legacyRedirects: duplicate ${redirect.source}`);
    redirectSources.add(redirect.source);
  }
  return errors;
}

export function assertValidSiteRuntime(runtime) {
  const errors = validateSiteRuntime(runtime);
  if (errors.length) throw new Error(errors.join("\n"));
}

export const serializeSiteRuntime = (runtime) => `${JSON.stringify(runtime)}\n`;

export async function generateSiteRuntime({ projectRoot = PROJECT_ROOT, check = false } = {}) {
  const source = await loadCanonicalCatalog(projectRoot);
  const runtime = buildSiteRuntime(source);
  const serialized = serializeSiteRuntime(runtime);
  const outputPath = path.join(projectRoot, SITE_RUNTIME_PATH);

  if (check) {
    const current = await readFile(outputPath, "utf8").catch(() => null);
    if (current !== serialized) throw new Error(`${SITE_RUNTIME_PATH} is stale; run the generator`);
    return { runtime, outputPath, changed: false };
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp`;
  await writeFile(temporaryPath, serialized);
  await rename(temporaryPath, outputPath);
  return { runtime, outputPath, changed: true };
}
