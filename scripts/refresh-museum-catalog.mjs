import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";
import exifr from "exifr";
import {
  WORDPRESS_BASE_URL,
  decodeText,
  extractImageUrlsFromHtml,
  fetchJson,
  fetchText,
  parseArtworkDetails,
  parseEnviraImages,
  parseSitemapImages,
  parseVcIncludeIds,
  slugify,
  textFromHtml
} from "./wordpress-content.mjs";
import { catalogSchema, SCHEMA_VERSION } from "./museum-schema.mjs";
import {
  baseRecord,
  calculatePerceptualHash,
  canonicalDerivativeUrl,
  fallbackDisplayTitle,
  fileExtensionFor,
  hammingDistance,
  inferSubjects,
  jsonLines,
  labelKind,
  makeDescription,
  makeGridRequestBody,
  makeProvenance,
  makeUnknownHistory,
  makeUnknownRights,
  normalizeUrl,
  parseAjaxGridItems,
  parseGridRequests,
  parseMuseumLabel,
  sha256,
  stableId,
  transliterateRussian,
  translateTitleToEnglish,
  uniqueBy
} from "./museum-catalog.mjs";
import {
  buildLidoXml,
  buildOwnerInputCsv,
  buildPublicCatalog,
  buildReviewHtml
} from "./museum-outputs.mjs";

const EXPORT_ROOT = "content-export";
const DATA_DIR = path.join(EXPORT_ROOT, "data");
const MEDIA_ORIGINALS_DIR = path.join(EXPORT_ROOT, "media", "originals");
const MEDIA_PREVIEWS_DIR = path.join(EXPORT_ROOT, "media", "previews");
const EXPORTS_DIR = path.join(EXPORT_ROOT, "exports");
const REPORTS_DIR = path.join(EXPORT_ROOT, "reports");
const SCHEMA_DIR = path.join(EXPORT_ROOT, "schema");
const OVERRIDES_PATH = "content/museum/editorial-overrides.json";
const PAGE_IDS = { home: 4, photoWorks: 7293, contact: 4547 };
const PORTRAIT_URL = `${WORDPRESS_BASE_URL}/wp-content/uploads/2024/06/photo_2024-06-21_21-32-35.jpg`;
const USER_AGENT = "Codex museum catalog exporter for nikitapichugin.ru";
const GRID_COLLECTIONS = [
  "home.archive.2011_2020",
  "home.archive.2006_2010",
  "home.archive.1997_2005",
  "home.unsorted"
];
const COLLECTION_PRIORITY = [
  "portfolio.listing",
  "home.feed",
  "home.archive.2011_2020",
  "home.archive.2006_2010",
  "home.archive.1997_2005",
  "home.unsorted",
  "photoworks",
  "site.primary",
  "portfolio.detail"
];

const generatedAt = new Date().toISOString();
const snapshotId = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const rawDir = path.join(EXPORT_ROOT, "raw", snapshotId);

await ensureDirectories();
const overrides = await readJsonIfExists(OVERRIDES_PATH, { works: {}, assets: {} });
const existingAssets = await readJsonLinesIfExists(path.join(DATA_DIR, "assets.jsonl"));
const existingAssetBySourceUrl = new Map();
for (const asset of existingAssets) {
  for (const source of asset.sourceUrls || []) existingAssetBySourceUrl.set(source.url, asset);
  if (asset.quality?.selectedSourceUrl) existingAssetBySourceUrl.set(asset.quality.selectedSourceUrl, asset);
}

console.log("[content:refresh] fetching primary WordPress sources");
const [homeHtml, photoWorksPage, contactPage, portfolios, portfolioEntries, portfolioSitemap, galleryHtml] = await Promise.all([
  fetchText(`${WORDPRESS_BASE_URL}/`),
  fetchJson(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/pages/${PAGE_IDS.photoWorks}?_fields=id,slug,title,content,link,date,modified`),
  fetchJson(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/pages/${PAGE_IDS.contact}?_fields=id,slug,title,content,link,date,modified`),
  fetchJson(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/dt_portfolios?per_page=100&_fields=id,slug,title,content,portfolio_entries,aioseo_head_json,link,date,modified`),
  fetchJson(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/portfolio_entries?per_page=100&_fields=id,name,slug,count,link`),
  fetchText(`${WORDPRESS_BASE_URL}/dt_portfolios-sitemap.xml`),
  fetchText(`${WORDPRESS_BASE_URL}/portfolio/galereya-rabot-hudozhnika-nikity-pichugina/`)
]);

await Promise.all([
  writeText(path.join(rawDir, "home.html"), homeHtml),
  writeJson(path.join(rawDir, "page-photoworks.json"), photoWorksPage),
  writeJson(path.join(rawDir, "page-contact.json"), contactPage),
  writeJson(path.join(rawDir, "portfolios.json"), portfolios),
  writeJson(path.join(rawDir, "portfolio-entries.json"), portfolioEntries),
  writeText(path.join(rawDir, "dt_portfolios-sitemap.xml"), portfolioSitemap),
  writeText(path.join(rawDir, "portfolio-gallery.html"), galleryHtml)
]);

const gridRequests = parseGridRequests(homeHtml);
if (gridRequests.length !== 4) {
  throw new Error(`Expected four Visual Composer grids on the home page, found ${gridRequests.length}`);
}

console.log("[content:refresh] fetching four dynamic home-page grids");
const gridResults = [];
for (const request of gridRequests) {
  const responseHtml = await fetchGrid(request);
  await writeText(path.join(rawDir, `home-grid-${request.index}.html`), responseHtml);
  gridResults.push({ request, html: responseHtml, items: parseAjaxGridItems(responseHtml) });
}

console.log("[content:refresh] fetching WordPress media library for original-file resolution");
const media = await fetchAllMedia(rawDir);
const mediaIndex = buildMediaIndex(media);
const sourceWarnings = [];

const homeFeed = parseEnviraImages(homeHtml);
const sitemapImages = parseSitemapImages(portfolioSitemap);
const entryYearById = new Map(portfolioEntries.map((entry) => [entry.id, /^\d{4}$/.test(entry.name) ? Number(entry.name) : null]));
const placementDrafts = [];

for (const [index, image] of homeFeed.entries()) {
  const discoveredUrl = normalizeUrl(image.sourceUrl);
  const rawLabel = decodeText(image.title || image.caption || image.alt || "");
  const parsed = parseMuseumLabel(rawLabel);
  placementDrafts.push(
    makePlacementDraft({
      collection: "home.feed",
      sourcePageUrl: `${WORDPRESS_BASE_URL}/`,
      sourceOrder: index,
      rawLabel,
      discoveredUrl,
      wpMediaId: image.id || null,
      role: "home_feed_artwork",
      visualClass: "artwork_reproduction",
      workSourceKey: `home.feed:${image.id || canonicalDerivativeUrl(discoveredUrl)}`,
      parsed
    })
  );
}

for (const [gridIndex, result] of gridResults.entries()) {
  const collection = GRID_COLLECTIONS[gridIndex];
  for (const item of result.items) {
    const parsed = parseMuseumLabel(item.rawLabel);
    const prefix = collection === "home.unsorted" ? "home.unsorted" : "home.archive";
    placementDrafts.push(
      makePlacementDraft({
        collection,
        sourcePageUrl: `${WORDPRESS_BASE_URL}/`,
        sourceOrder: item.index,
        rawLabel: item.rawLabel,
        discoveredUrl: item.discoveredUrl,
        wpMediaId: mediaIndex.byExact.get(item.discoveredUrl)?.id || null,
        role: collection === "home.unsorted" ? "unsorted_artwork" : "archive_artwork",
        visualClass: "artwork_reproduction",
        workSourceKey: `${prefix}:${canonicalDerivativeUrl(item.discoveredUrl)}`,
        parsed
      })
    );
  }
}

for (const portfolio of portfolios) {
  const title = decodeText(portfolio.title?.rendered || portfolio.slug);
  const taxonomyYear = (portfolio.portfolio_entries || []).map((id) => entryYearById.get(id)).find(Boolean) || null;
  const sourceText =
    portfolio.aioseo_head_json?.["og:description"] ||
    portfolio.aioseo_head_json?.description ||
    textFromHtml(portfolio.content?.rendered || "");
  const details = parseArtworkDetails({ title, text: sourceText, year: taxonomyYear ? String(taxonomyYear) : "" });
  const parsed = parseMuseumLabel(
    `«${title}»${details.year ? ` ${details.year}.` : ""}${details.medium ? ` ${details.medium}.` : ""}${details.dimensions ? ` ${details.dimensions}` : ""}`
  );
  const schemaImage = portfolio.aioseo_head_json?.schema?.["@graph"]?.find((node) => node["@type"] === "WebPage")?.image?.url;
  const imageCandidates = [
    ...(sitemapImages.get(portfolio.slug) || []),
    schemaImage,
    ...extractImageUrlsFromHtml(portfolio.content?.rendered || "")
  ].filter(Boolean);
  const images = uniqueBy(
    imageCandidates.map((url) => {
      const normalized = normalizeUrl(url);
      const mediaItem = mediaIndex.byExact.get(normalized) || mediaIndex.byCanonical.get(canonicalDerivativeUrl(normalized)) || null;
      return { discoveredUrl: normalized, mediaItem };
    }),
    ({ discoveredUrl, mediaItem }) => mediaItem ? `media:${mediaItem.id}` : canonicalDerivativeUrl(discoveredUrl)
  );
  for (const [index, image] of images.entries()) {
    placementDrafts.push(
      makePlacementDraft({
        collection: index === 0 ? "portfolio.listing" : "portfolio.detail",
        sourcePageUrl: portfolio.link || `${WORDPRESS_BASE_URL}/portfolios/${portfolio.slug}/`,
        sourceOrder: index,
        rawLabel: title,
        discoveredUrl: image.discoveredUrl,
        wpMediaId: image.mediaItem?.id || null,
        role: index === 0 ? "portfolio_cover" : "portfolio_related_visual",
        visualClass: index === 0 ? "artwork_reproduction" : "unknown",
        workSourceKey: `portfolio:${portfolio.id}`,
        parsed,
        sourceData: {
          wpPortfolioId: portfolio.id,
          slug: portfolio.slug,
          description: details.description || null,
          modified: portfolio.modified || null
        }
      })
    );
  }
}

const photoWorkIds = parseVcIncludeIds(photoWorksPage.content?.rendered || "").filter((id) => id >= 15000);
const unresolvedPhotoWorkIds = photoWorkIds.filter((id) => !mediaIndex.byId.has(id));
if (unresolvedPhotoWorkIds.length) {
  sourceWarnings.push(`Photoworks page references unavailable WordPress media IDs: ${unresolvedPhotoWorkIds.join(", ")}`);
}
for (const [index, mediaId] of photoWorkIds.entries()) {
  const mediaItem = mediaIndex.byId.get(mediaId);
  if (!mediaItem) continue;
  const rawLabel = decodeText(mediaItem.title?.rendered || mediaItem.slug || "");
  placementDrafts.push(
    makePlacementDraft({
      collection: "photoworks",
      sourcePageUrl: `${WORDPRESS_BASE_URL}/masterskaya-nikity-pichugina/`,
      sourceOrder: index,
      rawLabel,
      discoveredUrl: normalizeUrl(mediaItem.source_url),
      wpMediaId: mediaId,
      role: "photographic_work",
      visualClass: "photographic_work",
      workSourceKey: `photowork:${mediaId}`,
      parsed: parseMuseumLabel(rawLabel)
    })
  );
}

placementDrafts.push(
  makePlacementDraft({
    collection: "site.primary",
    sourcePageUrl: `${WORDPRESS_BASE_URL}/`,
    sourceOrder: 0,
    rawLabel: "Никита Пичугин в мастерской",
    discoveredUrl: PORTRAIT_URL,
    wpMediaId: mediaIndex.byExact.get(PORTRAIT_URL)?.id || null,
    role: "artist_portrait",
    visualClass: "artist_portrait",
    workSourceKey: null,
    parsed: parseMuseumLabel("")
  })
);

const errors = [];
const warnings = [...sourceWarnings];
const downloadGroups = groupDownloadPlans(placementDrafts, mediaIndex);
console.log(`[content:refresh] downloading ${downloadGroups.length} highest-quality source files`);
const processedGroups = await mapWithConcurrency(downloadGroups, 5, async (group, index) => {
  try {
    const result = await downloadAsset(group);
    if ((index + 1) % 20 === 0 || index + 1 === downloadGroups.length) {
      console.log(`[content:refresh] downloaded ${index + 1}/${downloadGroups.length}`);
    }
    return result;
  } catch (error) {
    errors.push(`${group.primaryKey}: ${error.message}`);
    return null;
  }
});

const consolidated = consolidateAssets(processedGroups.filter(Boolean));
const assets = consolidated.assets;
for (const draft of placementDrafts) {
  draft.assetId = consolidated.downloadKeyToAssetId.get(draft.downloadKey) || null;
}

assignNearDuplicateGroups(assets);
applyAssetOverrides(assets, overrides.assets || {});

const validDrafts = placementDrafts.filter((draft) => draft.assetId);
const aliases = buildWorkAliases(validDrafts);
for (const draft of validDrafts) {
  if (draft.workSourceKey) draft.workSourceKey = aliases.get(draft.workSourceKey) || draft.workSourceKey;
}

const workDraftGroups = groupWorkDrafts(validDrafts);

const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
const works = [...workDraftGroups.entries()]
  .map(([sourceKey, drafts]) => buildWork({ sourceKey, drafts, assetById, override: overrides.works?.[sourceKey] || null }));
const publicSlugMapPath = path.join("content", "museum", "public-slug-map.json");
const publicSlugMap = await readJsonIfExists(publicSlugMapPath, {});
assignPublicSlugs(works, publicSlugMap);
works.sort((a, b) => a.publicSlug.localeCompare(b.publicSlug));
const workIdBySourceKey = new Map(works.map((work) => [work.sourceKey, work.workId]));

const placements = validDrafts.map((draft) => ({
  ...baseRecord(),
  placementId: stableId("placement", `${draft.collection}|${draft.sourceOrder}|${draft.discoveredUrl}|${draft.workSourceKey || "none"}`),
  assetId: draft.assetId,
  workId: draft.workSourceKey ? workIdBySourceKey.get(draft.workSourceKey) || null : null,
  collection: draft.collection,
  sourcePageUrl: draft.sourcePageUrl,
  sourceOrder: draft.sourceOrder,
  rawLabel: draft.rawLabel || null,
  labelKind: labelKind(draft.rawLabel || ""),
  role: draft.role,
  wpMediaId: draft.wpMediaId || null
}));

for (const work of works) {
  work.assetIds = [...new Set(placements.filter((placement) => placement.workId === work.workId).map((placement) => placement.assetId))];
}

const authorities = buildAuthorities(works);
const siteContent = buildSiteContent({ homeHtml, photoWorksPage, contactPage, portraitAssetId: placements.find((item) => item.role === "artist_portrait")?.assetId || null });

const sourceBaselines = {
  homeFeed: homeFeed.length,
  homeArchive2011To2020: gridResults[0].items.length,
  homeArchive2006To2010: gridResults[1].items.length,
  homeArchive1997To2005: gridResults[2].items.length,
  homeUnsorted: gridResults[3].items.length,
  portfolios: portfolios.length,
  portfolioVisualReferences: placements.filter((placement) => placement.collection.startsWith("portfolio.")).length,
  photoWorkIncludeIds: photoWorkIds.length,
  photoWorksResolved: photoWorkIds.filter((id) => mediaIndex.byId.has(id)).length,
  wordpressMediaFetched: media.length
};
checkSourceBaselines(sourceBaselines, warnings);

const manifest = {
  schemaVersion: SCHEMA_VERSION,
  sourceBaseUrl: WORDPRESS_BASE_URL,
  snapshotId,
  generatedAt,
  counts: {
    assets: assets.length,
    works: works.length,
    artworkWorks: works.filter((work) => work.recordType === "artwork").length,
    photographicWorks: works.filter((work) => work.recordType === "photographic_work").length,
    placements: placements.length,
    authorities: authorities.length,
    needsReview: works.filter((work) => work.qualityControl.reviewStatus !== "verified").length,
    needsOwnerInput: works.filter((work) => Object.values(work.fieldStatus).includes("needs_owner_input")).length
  },
  sourceBaselines,
  errors,
  warnings
};

const publicCatalog = buildPublicCatalog({ generatedAt, works, assets });
console.log("[content:refresh] writing canonical catalog and reports");
await Promise.all([
  writeJson(path.join(DATA_DIR, "manifest.json"), manifest),
  writeText(path.join(DATA_DIR, "assets.jsonl"), jsonLines(assets)),
  writeText(path.join(DATA_DIR, "works.jsonl"), jsonLines(works)),
  writeText(path.join(DATA_DIR, "placements.jsonl"), jsonLines(placements)),
  writeText(path.join(DATA_DIR, "authorities.jsonl"), jsonLines(authorities)),
  writeJson(path.join(DATA_DIR, "site-content.json"), siteContent),
  writeJson(publicSlugMapPath, publicSlugMap),
  writeJson(path.join(SCHEMA_DIR, "catalog.schema.json"), catalogSchema),
  writeJson(path.join(EXPORTS_DIR, "public-catalog.json"), publicCatalog),
  writeText(path.join(EXPORTS_DIR, "lido.xml"), buildLidoXml(works, assets)),
  writeText(path.join(EXPORT_ROOT, "owner-input.csv"), buildOwnerInputCsv(works)),
  writeText(path.join(EXPORT_ROOT, "README.md"), buildReadme(manifest)),
  writeText(path.join(REPORTS_DIR, "review.html"), buildReviewHtml({ generatedAt, works, assets, placements })),
  writeText(path.join(REPORTS_DIR, "summary.md"), buildSummary({ manifest, works, assets, placements })),
  writeJson(path.join(rawDir, "resolved-source-bundle.json"), {
    homeFeed,
    grids: gridResults.map((result, index) => ({ collection: GRID_COLLECTIONS[index], items: result.items })),
    photoWorkIds
  })
]);

try {
  const lidoXsd = await fetchText("https://lido-schema.org/schema/v1.1/lido-v1.1.xsd");
  await writeText(path.join(SCHEMA_DIR, "lido-v1.1.xsd"), lidoXsd);
} catch (error) {
  warnings.push(`Could not cache official LIDO XSD: ${error.message}`);
}

if (errors.length) {
  console.error(`[content:refresh] completed with ${errors.length} download errors; run npm run content:verify for details`);
  process.exitCode = 1;
} else {
  console.log(`[content:refresh] complete: ${works.length} works, ${assets.length} unique original files, ${placements.length} placements`);
}

function makePlacementDraft({
  collection,
  sourcePageUrl,
  sourceOrder,
  rawLabel,
  discoveredUrl,
  wpMediaId,
  role,
  visualClass,
  workSourceKey,
  parsed,
  sourceData = null
}) {
  return {
    collection,
    sourcePageUrl,
    sourceOrder,
    rawLabel: rawLabel || "",
    discoveredUrl: normalizeUrl(discoveredUrl),
    wpMediaId,
    role,
    visualClass,
    workSourceKey,
    parsed,
    sourceData,
    downloadKey: null,
    assetId: null
  };
}

async function ensureDirectories() {
  await Promise.all(
    [DATA_DIR, MEDIA_ORIGINALS_DIR, MEDIA_PREVIEWS_DIR, EXPORTS_DIR, REPORTS_DIR, SCHEMA_DIR, rawDir].map((directory) => mkdir(directory, { recursive: true }))
  );
}

async function fetchGrid(request) {
  const response = await fetch(request.requestUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": USER_AGENT,
      referer: `${WORDPRESS_BASE_URL}/`
    },
    body: makeGridRequestBody(request)
  });
  if (!response.ok) throw new Error(`Grid ${request.index} failed: ${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchAllMedia(outputDir) {
  const fields = "id,slug,title,alt_text,caption,description,source_url,mime_type,media_details,date,modified";
  const first = await fetchJsonResponse(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/media?per_page=100&page=1&_fields=${fields}`);
  const totalPages = Number(first.response.headers.get("x-wp-totalpages") || 1);
  const pages = [first.data];
  await writeJson(path.join(outputDir, "media-page-1.json"), first.data);
  for (let page = 2; page <= totalPages; page += 1) {
    const result = await fetchJsonResponse(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/media?per_page=100&page=${page}&_fields=${fields}`);
    pages.push(result.data);
    await writeJson(path.join(outputDir, `media-page-${page}.json`), result.data);
  }
  return pages.flat();
}

async function fetchJsonResponse(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return { response, data: await response.json() };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError.message}`);
}

function buildMediaIndex(mediaItems) {
  const byId = new Map();
  const byExact = new Map();
  const byCanonical = new Map();
  for (const item of mediaItems) {
    byId.set(item.id, item);
    const urls = [normalizeUrl(item.source_url)];
    for (const size of Object.values(item.media_details?.sizes || {})) urls.push(normalizeUrl(size.source_url));
    const originalImage = item.media_details?.original_image;
    if (originalImage) {
      const source = new URL(normalizeUrl(item.source_url));
      source.pathname = `${source.pathname.slice(0, source.pathname.lastIndexOf("/") + 1)}${originalImage}`;
      item._originalUrl = source.href;
      urls.push(item._originalUrl);
    }
    for (const url of urls.filter(Boolean)) {
      byExact.set(url, item);
      const canonical = canonicalDerivativeUrl(url);
      if (!byCanonical.has(canonical)) byCanonical.set(canonical, item);
    }
  }
  return { byId, byExact, byCanonical, all: mediaItems };
}

function resolveDownloadPlan(draft, mediaIndexValue) {
  const discovered = normalizeUrl(draft.discoveredUrl);
  const mediaItem = mediaIndexValue.byExact.get(discovered) || mediaIndexValue.byCanonical.get(canonicalDerivativeUrl(discovered)) || null;
  const candidates = [];
  if (mediaItem?._originalUrl) candidates.push({ url: mediaItem._originalUrl, tier: "wordpress_original", role: "wordpress_original" });
  if (mediaItem?.source_url) candidates.push({ url: normalizeUrl(mediaItem.source_url), tier: "source_full", role: "wordpress_source" });
  const sizes = Object.values(mediaItem?.media_details?.sizes || {}).sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0));
  if (sizes[0]?.source_url) candidates.push({ url: normalizeUrl(sizes[0].source_url), tier: "largest_variant", role: "wordpress_source" });
  candidates.push({ url: discovered, tier: "discovered_only", role: "discovered" });
  return {
    mediaItem,
    candidates: uniqueBy(candidates.filter((candidate) => candidate.url), (candidate) => candidate.url)
  };
}

function groupDownloadPlans(drafts, mediaIndexValue) {
  const groups = new Map();
  for (const draft of drafts) {
    const plan = resolveDownloadPlan(draft, mediaIndexValue);
    const primaryKey = plan.candidates[0]?.url || draft.discoveredUrl;
    draft.downloadKey = primaryKey;
    if (!groups.has(primaryKey)) groups.set(primaryKey, { primaryKey, candidates: plan.candidates, mediaItem: plan.mediaItem, drafts: [] });
    groups.get(primaryKey).drafts.push(draft);
  }
  return [...groups.values()];
}

async function downloadAsset(group) {
  const cached = group.candidates.map((candidate) => existingAssetBySourceUrl.get(candidate.url)).find(Boolean);
  if (cached && existsSync(path.join(EXPORT_ROOT, cached.originalPath)) && existsSync(path.join(EXPORT_ROOT, cached.previewPath))) {
    const asset = structuredClone(cached);
    const previewMetadata = await sharp(path.join(EXPORT_ROOT, cached.previewPath)).metadata();
    if (!previewMetadata.width || !previewMetadata.height) throw new Error(`${asset.assetId}: preview decoder returned no dimensions`);
    asset.schemaVersion = SCHEMA_VERSION;
    asset.previewWidthPx = previewMetadata.width;
    asset.previewHeightPx = previewMetadata.height;
    asset.sourceUrls = uniqueBy(
      [...asset.sourceUrls, ...group.drafts.map((draft) => ({ url: draft.discoveredUrl, role: "discovered" }))],
      (item) => `${item.url}|${item.role}`
    );
    asset.wpMediaIds = [...new Set([...asset.wpMediaIds, group.mediaItem?.id, ...group.drafts.map((draft) => draft.wpMediaId)].filter(Number.isFinite))];
    asset.visualClass = preferredVisualClass([asset.visualClass, ...group.drafts.map((draft) => draft.visualClass)]);
    asset.classConfidence = asset.visualClass === "unknown" ? "low" : "high";
    asset.reviewStatus = asset.visualClass === "unknown" ? "needs_review" : "verified";
    return { downloadKey: group.primaryKey, asset };
  }

  let selected = null;
  let buffer = null;
  let mimeType = null;
  let metadata = null;
  const failures = [];
  for (const candidate of group.candidates) {
    try {
      const response = await fetch(candidate.url, { headers: { "user-agent": USER_AGENT } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      mimeType = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
      if (!mimeType.startsWith("image/")) throw new Error(`unexpected content type ${mimeType || "missing"}`);
      buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) throw new Error("empty response");
      metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) throw new Error("image decoder returned no dimensions");
      selected = candidate;
      break;
    } catch (error) {
      failures.push(`${candidate.url}: ${error.message}`);
    }
  }
  if (!selected || !buffer || !metadata) throw new Error(failures.join(" | "));

  const digest = sha256(buffer);
  const extension = fileExtensionFor(mimeType, selected.url);
  const originalRelativePath = `media/originals/${digest}${extension}`;
  const previewRelativePath = `media/previews/${digest}.webp`;
  const originalPath = path.join(EXPORT_ROOT, originalRelativePath);
  const previewPath = path.join(EXPORT_ROOT, previewRelativePath);
  if (!existsSync(originalPath)) await writeFile(originalPath, buffer);
  if (!existsSync(previewPath)) {
    const preview = await sharp(buffer).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    await writeFile(previewPath, preview);
  }
  const previewMetadata = await sharp(previewPath).metadata();
  if (!previewMetadata.width || !previewMetadata.height) throw new Error(`${digest}: preview decoder returned no dimensions`);

  const exif = await extractExif(buffer);
  const sourceUrls = uniqueBy(
    [
      ...group.drafts.map((draft) => ({ url: draft.discoveredUrl, role: "discovered" })),
      ...(group.mediaItem?.source_url ? [{ url: normalizeUrl(group.mediaItem.source_url), role: "wordpress_source" }] : []),
      ...(group.mediaItem?._originalUrl ? [{ url: group.mediaItem._originalUrl, role: "wordpress_original" }] : []),
      { url: selected.url, role: "downloaded" }
    ],
    (item) => `${item.url}|${item.role}`
  );
  const visualClass = preferredVisualClass(group.drafts.map((draft) => draft.visualClass));
  return {
    downloadKey: group.primaryKey,
    asset: {
      ...baseRecord(),
      assetId: `asset_${digest.slice(0, 16)}`,
      sha256: digest,
      perceptualHash: await calculatePerceptualHash(buffer),
      originalPath: originalRelativePath,
      previewPath: previewRelativePath,
      sourceFilename: decodeURIComponent(new URL(selected.url).pathname.split("/").pop() || `${digest}${extension}`),
      mimeType,
      byteSize: buffer.length,
      widthPx: metadata.width,
      heightPx: metadata.height,
      previewWidthPx: previewMetadata.width,
      previewHeightPx: previewMetadata.height,
      orientation: metadata.orientation || null,
      color: {
        space: metadata.space || null,
        channels: metadata.channels || null,
        hasIccProfile: Boolean(metadata.icc),
        isOpaque: typeof metadata.hasAlpha === "boolean" ? !metadata.hasAlpha : null
      },
      exif,
      wpMediaIds: [...new Set([group.mediaItem?.id, ...group.drafts.map((draft) => draft.wpMediaId)].filter(Number.isFinite))],
      sourceUrls,
      visualClass,
      classConfidence: visualClass === "unknown" ? "low" : "high",
      reviewStatus: visualClass === "unknown" ? "needs_review" : "verified",
      possibleDuplicateGroup: null,
      quality: {
        resolutionTier: selected.tier,
        selectedSourceUrl: selected.url,
        decoded: true
      },
      rights: {
        status: "needs_owner_input",
        copyrightHolder: null,
        usageTerms: null
      }
    }
  };
}

async function extractExif(buffer) {
  try {
    const data = await exifr.parse(buffer, {
      pick: ["Make", "Model", "LensModel", "DateTimeOriginal", "CreateDate", "ModifyDate", "Artist", "Copyright", "ImageDescription", "GPSLatitude", "GPSLongitude"]
    });
    const result = {};
    for (const [key, value] of Object.entries(data || {})) {
      result[key] = value instanceof Date ? value.toISOString() : value;
    }
    return result;
  } catch {
    return {};
  }
}

function preferredVisualClass(classes) {
  const preference = ["artwork_reproduction", "photographic_work", "artist_portrait", "studio_or_process_photo", "context_or_reference_photo", "site_graphic", "unknown"];
  return preference.find((value) => classes.includes(value)) || "unknown";
}

function consolidateAssets(processed) {
  const bySha = new Map();
  const downloadKeyToAssetId = new Map();
  for (const item of processed) {
    const existing = bySha.get(item.asset.sha256);
    if (!existing) {
      bySha.set(item.asset.sha256, item.asset);
      downloadKeyToAssetId.set(item.downloadKey, item.asset.assetId);
      continue;
    }
    existing.sourceUrls = uniqueBy([...existing.sourceUrls, ...item.asset.sourceUrls], (value) => `${value.url}|${value.role}`);
    existing.wpMediaIds = [...new Set([...existing.wpMediaIds, ...item.asset.wpMediaIds])];
    existing.visualClass = preferredVisualClass([existing.visualClass, item.asset.visualClass]);
    existing.classConfidence = existing.visualClass === "unknown" ? "low" : "high";
    existing.reviewStatus = existing.visualClass === "unknown" ? "needs_review" : "verified";
    downloadKeyToAssetId.set(item.downloadKey, existing.assetId);
  }
  return { assets: [...bySha.values()].sort((a, b) => a.assetId.localeCompare(b.assetId)), downloadKeyToAssetId };
}

function assignNearDuplicateGroups(assets) {
  let groupIndex = 0;
  for (let left = 0; left < assets.length; left += 1) {
    for (let right = left + 1; right < assets.length; right += 1) {
      const a = assets[left];
      const b = assets[right];
      if (Math.abs(a.widthPx / a.heightPx - b.widthPx / b.heightPx) > 0.08) continue;
      if (hammingDistance(a.perceptualHash, b.perceptualHash) > 3) continue;
      const group = a.possibleDuplicateGroup || b.possibleDuplicateGroup || `near_duplicate_${String(++groupIndex).padStart(3, "0")}`;
      a.possibleDuplicateGroup = group;
      b.possibleDuplicateGroup = group;
    }
  }
}

function applyAssetOverrides(assets, assetOverrides) {
  for (const asset of assets) {
    const override = assetOverrides[asset.assetId] || asset.sourceUrls.map((item) => assetOverrides[item.url]).find(Boolean);
    if (!override) continue;
    if (override.visualClass) asset.visualClass = override.visualClass;
    if (override.reviewStatus) asset.reviewStatus = override.reviewStatus;
    if (override.classConfidence) asset.classConfidence = override.classConfidence;
  }
}

function buildWorkAliases(drafts) {
  const aliases = new Map();
  const byAsset = new Map();
  for (const draft of drafts) {
    if (!draft.workSourceKey || draft.visualClass !== "artwork_reproduction") continue;
    if (!byAsset.has(draft.assetId)) byAsset.set(draft.assetId, new Set());
    byAsset.get(draft.assetId).add(draft.workSourceKey);
  }
  for (const keysSet of byAsset.values()) {
    const keys = [...keysSet];
    if (keys.length < 2) continue;
    const portfolios = keys.filter((key) => key.startsWith("portfolio:"));
    if (portfolios.length > 1) continue;
    const canonical = portfolios[0] || keys.sort(compareSourceKeys)[0];
    for (const key of keys) aliases.set(key, canonical);
  }
  return aliases;
}

function compareSourceKeys(a, b) {
  const priority = (value) => {
    if (value.startsWith("portfolio:")) return 0;
    if (value.startsWith("home.archive:")) return 1;
    if (value.startsWith("home.feed:")) return 2;
    if (value.startsWith("home.unsorted:")) return 3;
    return 4;
  };
  return priority(a) - priority(b) || a.localeCompare(b);
}

function groupWorkDrafts(drafts) {
  const groups = new Map();
  for (const draft of drafts) {
    if (!draft.workSourceKey) continue;
    if (!groups.has(draft.workSourceKey)) groups.set(draft.workSourceKey, []);
    groups.get(draft.workSourceKey).push(draft);
  }
  return new Map([...groups.entries()].sort(([a, draftsA], [b, draftsB]) => compareWorkGroups(a, draftsA, b, draftsB)));
}

function compareWorkGroups(keyA, draftsA, keyB, draftsB) {
  const collectionA = Math.min(...draftsA.map((draft) => COLLECTION_PRIORITY.indexOf(draft.collection)).filter((value) => value >= 0));
  const collectionB = Math.min(...draftsB.map((draft) => COLLECTION_PRIORITY.indexOf(draft.collection)).filter((value) => value >= 0));
  return collectionA - collectionB || Math.min(...draftsA.map((draft) => draft.sourceOrder)) - Math.min(...draftsB.map((draft) => draft.sourceOrder)) || keyA.localeCompare(keyB);
}

function assignPublicSlugs(works, publicSlugMap) {
  const reserved = new Set(Object.values(publicSlugMap));
  for (const work of works) {
    if (publicSlugMap[work.workId] && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicSlugMap[work.workId])) {
      reserved.delete(publicSlugMap[work.workId]);
      delete publicSlugMap[work.workId];
    }
    if (!publicSlugMap[work.workId]) {
      const base = slugify(transliterateRussian(work.displayTitle.ru)) || (work.recordType === "photographic_work" ? "fotokompozitsiya" : "rabota");
      const hash = work.workId.replace(/^work_/, "").slice(0, 8);
      let candidate = `${base}-${hash}`;
      let suffix = 2;
      while (reserved.has(candidate)) candidate = `${base}-${hash}-${suffix++}`;
      publicSlugMap[work.workId] = candidate;
      reserved.add(candidate);
    }
    work.publicSlug = publicSlugMap[work.workId];
  }
}

function buildWork({ sourceKey, drafts, assetById, override }) {
  const sortedDrafts = [...drafts].sort((a, b) => COLLECTION_PRIORITY.indexOf(a.collection) - COLLECTION_PRIORITY.indexOf(b.collection) || a.sourceOrder - b.sourceOrder);
  const recordType = sourceKey.startsWith("photowork:") ? "photographic_work" : "artwork";
  const sourceTitleDraft = sortedDrafts.find((draft) => draft.parsed.title);
  const sourceTitle = sourceTitleDraft?.parsed.title || null;
  const filenameDateCandidate = sortedDrafts.map((draft) => draft.parsed.filenameDateCandidate).find(Boolean) || null;
  const fallbackTitle = fallbackDisplayTitle({ recordType, filenameDateCandidate });
  const displayTitle = {
    ru: override?.titleRu || sourceTitle || fallbackTitle.ru,
    en: override?.titleEn || (sourceTitle ? translateTitleToEnglish(sourceTitle) : fallbackTitle.en)
  };
  const supplied = !sourceTitle;
  const normalizedSourceTitle = Boolean(sourceTitle && override?.titleRu && override.titleRu !== sourceTitle);
  const sourceTitleProvenance = sourceTitleDraft
    ? makeProvenance({ method: "source_text", sourceUrl: sourceTitleDraft.sourcePageUrl, sourceLabel: sourceTitleDraft.rawLabel, confidence: "high", reviewStatus: "verified" })
    : null;
  const titleProvenance = supplied || normalizedSourceTitle
    ? makeProvenance({
        method: "cataloguer_supplied",
        confidence: override?.titleRu ? "high" : "low",
        reviewStatus: override?.reviewStatus || "needs_review",
        sourceLabel: sourceTitle || sortedDrafts[0]?.rawLabel || null
      })
    : sourceTitleProvenance;
  const titles = [
    { text: displayTitle.ru, language: "ru", type: supplied || normalizedSourceTitle ? "cataloguer_supplied" : "source_stated", preferred: true, provenance: titleProvenance },
    { text: displayTitle.en, language: "en", type: "translated", preferred: true, provenance: makeProvenance({ method: "cataloguer_supplied", confidence: override?.titleEn ? "medium" : "low", reviewStatus: override?.titleEn ? "verified" : "needs_review", sourceLabel: displayTitle.ru }) }
  ];
  if (normalizedSourceTitle) {
    titles.push({ text: sourceTitle, language: "ru", type: "source_stated", preferred: false, provenance: sourceTitleProvenance });
  }
  for (const technical of [...new Set(sortedDrafts.filter((draft) => ["technical_filename", "date_filename"].includes(labelKind(draft.rawLabel))).map((draft) => draft.rawLabel).filter(Boolean))]) {
    titles.push({ text: technical, language: "ru", type: "technical_identifier", preferred: false, provenance: makeProvenance({ method: "source_metadata", confidence: "high", reviewStatus: "verified", sourceLabel: technical }) });
  }

  const yearDraft = sortedDrafts.find((draft) => draft.parsed.creationYear);
  const year = yearDraft?.parsed.creationYear || null;
  const materialDraft = sortedDrafts.find((draft) => draft.parsed.materials.display);
  const dimensionDraft = sortedDrafts.find((draft) => draft.parsed.dimensions.values.length);
  const assetIds = [...new Set(sortedDrafts.map((draft) => draft.assetId).filter(Boolean))];
  const exifDate = assetIds.map((id) => assetById.get(id)?.exif?.DateTimeOriginal || assetById.get(id)?.exif?.CreateDate).find(Boolean) || null;
  const support = materialDraft?.parsed.materials.support || null;
  const techniques = materialDraft?.parsed.materials.techniques || [];
  const objectWorkType = recordType === "photographic_work" ? "photograph" : support === "бумага" && techniques.some((value) => ["акварель", "тушь", "гуашь", "пастель", "уголь", "карандаш"].includes(value)) ? "work on paper" : "painting";
  const subjects = override?.subjects
    ? { ...inferSubjects(displayTitle.ru, recordType), ...override.subjects, provenance: makeProvenance({ method: "visual_observation", confidence: "medium", reviewStatus: override.reviewStatus || "verified" }) }
    : inferSubjects(displayTitle.ru, recordType);
  const description = {
    ...makeDescription({ displayTitle, recordType, sourceTitle, supplied }),
    ...(override?.descriptionRu ? { ru: override.descriptionRu } : {}),
    ...(override?.descriptionEn ? { en: override.descriptionEn } : {})
  };
  const physicalStatus = recordType === "photographic_work" ? "known" : materialDraft ? "known" : "unknown";
  const dimensionsStatus = recordType === "photographic_work" ? "not_applicable" : dimensionDraft ? "known" : "unknown";
  const fieldStatus = {
    creator: "known",
    objectWorkType: "known",
    preferredTitle: "known",
    artistTitle: sourceTitle ? "known" : "needs_owner_input",
    artistInventoryNumber: "needs_owner_input",
    creationDate: year ? "known" : "unknown",
    materialsTechniques: physicalStatus,
    dimensions: dimensionsStatus,
    subjects: subjects.specific.length || override?.subjects ? "known" : "unknown",
    inscriptions: override?.inscriptions?.length ? "known" : "not_visible",
    provenance: "needs_owner_input",
    currentOwner: "needs_owner_input",
    currentLocation: "needs_owner_input",
    exhibitions: "needs_owner_input",
    bibliography: "needs_owner_input",
    rights: "needs_owner_input"
  };
  const knownCore = ["creator", "objectWorkType", "preferredTitle", "creationDate", "materialsTechniques", "dimensions", "subjects"].filter((key) => fieldStatus[key] === "known").length;
  const warnings = [];
  if (supplied && !override?.titleRu) warnings.push("generic_cataloguer_title_needs_visual_refinement");
  if (!year && recordType === "artwork") warnings.push("creation_date_unknown");
  if (!materialDraft && recordType === "artwork") warnings.push("materials_techniques_unknown");
  if (!dimensionDraft && recordType === "artwork") warnings.push("dimensions_unknown");
  const reviewStatus = override?.reviewStatus || (warnings.length ? "needs_review" : "needs_owner_input");

  return {
    ...baseRecord(),
    workId: stableId("work", sourceKey),
    sourceKey,
    publicSlug: null,
    catalogLevel: "item",
    artistInventoryNumber: {
      value: null,
      status: "needs_owner_input",
      provenance: makeProvenance({ method: "system", confidence: "high", reviewStatus: "needs_owner_input" })
    },
    recordType,
    objectWorkType,
    classification: recordType === "photographic_work" ? ["visual work", "photography"] : ["visual work", objectWorkType],
    creator: {
      authorityId: "person_nikita_pichugin",
      displayName: "Никита Пичугин",
      role: recordType === "photographic_work" ? "photographer" : "artist",
      attributionQualifier: "attributed_on_official_site",
      provenance: makeProvenance({ method: "source_text", sourceUrl: sortedDrafts[0].sourcePageUrl, confidence: "high", reviewStatus: "verified" })
    },
    titles,
    displayTitle,
    creation: {
      displayDate: year ? String(year) : null,
      earliestYear: year,
      latestYear: year,
      dateQualifier: null,
      place: null,
      status: year ? "known" : "unknown",
      provenance: yearDraft
        ? makeProvenance({ method: "source_text", sourceUrl: yearDraft.sourcePageUrl, sourceLabel: yearDraft.rawLabel, confidence: "high", reviewStatus: "verified" })
        : makeProvenance({ method: "system", confidence: "high", reviewStatus: "needs_owner_input" })
    },
    capture: {
      displayDate: exifDate || filenameDateCandidate,
      filenameDateCandidate,
      exifDate,
      status: exifDate ? "known" : filenameDateCandidate ? "unknown" : recordType === "photographic_work" ? "unknown" : "not_applicable",
      provenance: exifDate
        ? makeProvenance({ method: "exif", confidence: "high", reviewStatus: "verified" })
        : filenameDateCandidate
          ? makeProvenance({ method: "source_metadata", sourceLabel: filenameDateCandidate, confidence: "low", reviewStatus: "needs_review" })
          : makeProvenance({ method: "system", confidence: "high", reviewStatus: recordType === "photographic_work" ? "needs_owner_input" : "verified" })
    },
    physicalDescription: {
      materialsTechniquesDisplay: recordType === "photographic_work" ? "Цифровая фотография" : materialDraft?.parsed.materials.display || null,
      support: recordType === "photographic_work" ? "digital image" : support,
      techniques: recordType === "photographic_work" ? ["digital photography"] : techniques,
      dimensions: {
        display: dimensionDraft?.parsed.dimensions.display || null,
        values: dimensionDraft?.parsed.dimensions.values || [],
        unit: dimensionDraft?.parsed.dimensions.unit || null,
        axisOrder: "source_order_unknown",
        extent: null,
        qualifier: null,
        status: dimensionsStatus
      },
      status: physicalStatus,
      provenance: materialDraft
        ? makeProvenance({ method: "source_text", sourceUrl: materialDraft.sourcePageUrl, sourceLabel: materialDraft.rawLabel, confidence: "high", reviewStatus: "verified" })
        : recordType === "photographic_work"
          ? makeProvenance({ method: "source_metadata", sourceUrl: sortedDrafts[0].sourcePageUrl, confidence: "high", reviewStatus: "verified" })
          : makeProvenance({ method: "system", confidence: "high", reviewStatus: "needs_owner_input" })
    },
    subjects,
    description,
    inscriptions: override?.inscriptions || [],
    history: makeUnknownHistory(),
    rights: makeUnknownRights(),
    assetIds,
    relatedWorkIds: [],
    recordSource: sortedDrafts.map((draft) => ({
      sourcePageUrl: draft.sourcePageUrl,
      collection: draft.collection,
      rawLabel: draft.rawLabel || null,
      wpMediaId: draft.wpMediaId || null,
      wpPortfolioId: draft.sourceData?.wpPortfolioId || null
    })),
    fieldStatus,
    qualityControl: {
      completenessScore: Number((knownCore / 7).toFixed(2)),
      reviewStatus,
      warnings
    }
  };
}

function buildAuthorities(works) {
  const values = [
    authority("person_nikita_pichugin", "person", "Никита Пичугин", "Nikita Pichugin", null, "Official artist website"),
    authority("work_type_painting", "work_type", "картина", "painting", "http://vocab.getty.edu/aat/300033618", "Getty Art & Architecture Thesaurus"),
    authority("work_type_work_on_paper", "work_type", "работа на бумаге", "work on paper", null, "Local CDWA-aligned vocabulary"),
    authority("work_type_photograph", "work_type", "фотография", "photograph", "http://vocab.getty.edu/aat/300046300", "Getty Art & Architecture Thesaurus")
  ];
  const categoryMap = {
    genre: "genre",
    general: "subject",
    specific: "subject",
    techniques: "technique"
  };
  for (const work of works) {
    for (const [field, type] of Object.entries(categoryMap)) {
      const sourceValues = field === "techniques" ? work.physicalDescription.techniques : work.subjects[field];
      for (const value of sourceValues || []) {
        const id = `${type}_${sha256(value).slice(0, 12)}`;
        values.push(authority(id, type, value, value, null, "Local CDWA-aligned controlled vocabulary"));
      }
    }
    if (work.physicalDescription.support) {
      const value = work.physicalDescription.support;
      values.push(authority(`material_${sha256(value).slice(0, 12)}`, "material", value, value, null, "Local CDWA-aligned controlled vocabulary"));
    }
  }
  return uniqueBy(values, (value) => value.authorityId).sort((a, b) => a.authorityId.localeCompare(b.authorityId));
}

function authority(authorityId, type, ru, en, externalUri, source) {
  const mappedUri = externalUri || externalUriFor(type, ru) || externalUriFor(type, en);
  return {
    ...baseRecord(),
    authorityId,
    type,
    preferredLabel: { ru, en },
    alternativeLabels: [],
    externalUri: mappedUri,
    source: mappedUri ? "Getty Art & Architecture Thesaurus" : source
  };
}

function externalUriFor(type, value) {
  const key = `${type}:${String(value).toLocaleLowerCase("ru-RU")}`;
  const mappings = {
    "material:холст": "http://vocab.getty.edu/aat/300014078",
    "material:canvas": "http://vocab.getty.edu/aat/300014078",
    "technique:масло": "http://vocab.getty.edu/aat/300178684",
    "technique:oil painting": "http://vocab.getty.edu/aat/300178684",
    "technique:акварель": "http://vocab.getty.edu/aat/300389895",
    "technique:watercolor painting": "http://vocab.getty.edu/aat/300389895",
    "technique:гуашь": "http://vocab.getty.edu/aat/300404215",
    "technique:gouache": "http://vocab.getty.edu/aat/300404215"
  };
  return mappings[key] || null;
}

function buildSiteContent({ homeHtml, photoWorksPage, contactPage, portraitAssetId }) {
  const homeText = textFromHtml(homeHtml);
  const photoText = textFromHtml(photoWorksPage.content?.rendered || "");
  const contactHtml = contactPage.content?.rendered || "";
  const contactText = textFromHtml(contactHtml);
  return {
    schemaVersion: SCHEMA_VERSION,
    brand: { ru: "Никита Пичугин", en: "Nikita Pichugin" },
    introduction: {
      ru: homeText.match(/Здравствуйте![^.]+\. Добро пожаловать на мой сайт\./)?.[0] || "Здравствуйте! Меня зовут Никита Пичугин, я художник. Добро пожаловать на мой сайт.",
      en: homeText.match(/Hello![^.]+\. Welcome to my website\./)?.[0] || "Hello! My name is Nikita Pichugin, I am an artist. Welcome to my website."
    },
    photoWorksIntroduction: photoText
      .replace(/^.*?Фотоработы\s*/i, "")
      .replace(/\bvc_gid:[^\s]+/gi, " ")
      .replace(/\b\d{5}(?:,\d{5})+\b/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    exhibitionTourUrl: homeHtml.match(/https:\/\/erzia-museum\.ru\/stranicy\/12029\/?/)?.[0] || null,
    contact: {
      phone: contactText.match(/8\s*\(?927\)?\s*177[-\s]*68[-\s]*78/)?.[0]?.replace(/\s+/g, " ") || null,
      phoneHref: "+79271776878",
      email: contactHtml.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null,
      vk: contactHtml.match(/https:\/\/vk\.com\/[^"'\s<]+/)?.[0] || null,
      telegram: contactHtml.match(/https:\/\/t\.me\/[^"'\s<]+/)?.[0] || null
    },
    portraitAssetId,
    sourcePages: {
      home: `${WORDPRESS_BASE_URL}/`,
      portfolio: `${WORDPRESS_BASE_URL}/portfolio/galereya-rabot-hudozhnika-nikity-pichugina/`,
      photoWorks: `${WORDPRESS_BASE_URL}/masterskaya-nikity-pichugina/`,
      contact: `${WORDPRESS_BASE_URL}/contact-info/`
    }
  };
}

function checkSourceBaselines(counts, warningList) {
  const expected = {
    homeFeed: 25,
    homeArchive2011To2020: 106,
    homeArchive2006To2010: 16,
    homeArchive1997To2005: 2,
    homeUnsorted: 19,
    portfolios: 24,
    portfolioVisualReferences: 81,
    photoWorksResolved: 87
  };
  for (const [key, value] of Object.entries(expected)) {
    if (counts[key] !== value) warningList.push(`Live source drift: ${key} expected ${value}, found ${counts[key]}`);
  }
}

function buildSummary({ manifest, works, assets, placements }) {
  const byCollection = Object.entries(
    placements.reduce((accumulator, placement) => {
      accumulator[placement.collection] = (accumulator[placement.collection] || 0) + 1;
      return accumulator;
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b));
  const rows = byCollection.map(([collection, count]) => `| ${collection} | ${count} |`).join("\n");
  return `# Museum Catalog Export\n\nGenerated: ${manifest.generatedAt}\n\n## Counts\n\n- Works: ${works.length}\n- Original assets: ${assets.length}\n- Placements: ${placements.length}\n- Records needing review: ${manifest.counts.needsReview}\n- Records needing owner input: ${manifest.counts.needsOwnerInput}\n\n## Placements by collection\n\n| Collection | Count |\n| --- | ---: |\n${rows}\n\n## Warnings\n\n${manifest.warnings.length ? manifest.warnings.map((warning) => `- ${warning}`).join("\n") : "None."}\n\n## Errors\n\n${manifest.errors.length ? manifest.errors.map((error) => `- ${error}`).join("\n") : "None."}\n`;
}

function buildReadme(manifest) {
  return `# Контент-архив Никиты Пичугина\n\nЭто независимый от текущего сайта музейно структурированный архив. Он разделяет произведения, цифровые файлы и места их показа на старом WordPress-сайте. Выдуманная авторская или музейная нумерация не используется; \`workId\` служит только внутренней технической связью.\n\n## Что открывать\n\n- \`reports/review.html\` — визуальная проверка записей.\n- \`exports/public-catalog.json\` — готовые данные для будущего сайта; технические имена файлов не используются как заголовки.\n- \`owner-input.csv\` — только сведения, которые невозможно достоверно восстановить с сайта.\n- \`data/works.jsonl\` — музейно структурированные карточки произведений.\n- \`data/assets.jsonl\` — метаданные оригинальных файлов.\n- \`data/placements.jsonl\` — исходные разделы и порядок показа.\n- \`exports/lido.xml\` — обменный файл LIDO 1.1.\n\n## Медиа\n\n- \`media/originals/\` содержит сохранённые исходники без перекодирования.\n- \`media/previews/\` содержит отдельные WebP-превью для просмотра.\n\n## Проверка\n\nСнимок: \`${manifest.snapshotId}\`. В архиве ${manifest.counts.works} произведений, ${manifest.counts.assets} уникальных оригиналов и ${manifest.counts.placements} размещения. Проверка запускается командой \`npm run content:verify\` из корня проекта.\n`;
}

async function mapWithConcurrency(values, concurrency, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  async function run() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, run));
  return results;
}

async function readJsonIfExists(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonLinesIfExists(filePath) {
  if (!existsSync(filePath)) return [];
  return (await readFile(filePath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function writeText(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value);
}

async function writeJson(filePath, value) {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
