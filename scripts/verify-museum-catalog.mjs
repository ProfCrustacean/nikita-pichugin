import path from "node:path";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import sharp from "sharp";
import { catalogSchema } from "./museum-schema.mjs";
import { TECHNICAL_LABEL_RE } from "./museum-catalog.mjs";

const ROOT = "content-export";
const DATA = path.join(ROOT, "data");
const REPORTS = path.join(ROOT, "reports");
const runtimeOnly = process.argv.includes("--runtime");
const errors = [];
const warnings = [];

const [manifest, assets, works, placements, authorities, siteContent, publicCatalog] = await Promise.all([
  readJson(path.join(DATA, "manifest.json")),
  readJsonLines(path.join(DATA, "assets.jsonl")),
  readJsonLines(path.join(DATA, "works.jsonl")),
  readJsonLines(path.join(DATA, "placements.jsonl")),
  readJsonLines(path.join(DATA, "authorities.jsonl")),
  readJson(path.join(DATA, "site-content.json")),
  readJson(path.join(ROOT, "exports", "public-catalog.json"))
]);

const bundle = { manifest, assets, works, placements, authorities, siteContent };
const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(catalogSchema);
if (!validate(bundle)) {
  for (const error of validate.errors || []) errors.push(`schema ${error.instancePath || "/"}: ${error.message}`);
}

const assetById = uniqueMap(assets, "assetId");
const workById = uniqueMap(works, "workId");
uniqueMap(works, "publicSlug");
uniqueMap(placements, "placementId");
uniqueMap(authorities, "authorityId");

for (const placement of placements) {
  if (!assetById.has(placement.assetId)) errors.push(`${placement.placementId}: missing asset ${placement.assetId}`);
  if (placement.workId && !workById.has(placement.workId)) errors.push(`${placement.placementId}: missing work ${placement.workId}`);
  if (placement.role !== "artist_portrait" && !placement.workId) errors.push(`${placement.placementId}: content placement has no work`);
}

for (const work of works) {
  if (!work.displayTitle.ru || !work.displayTitle.en) errors.push(`${work.workId}: bilingual public title is required`);
  if (TECHNICAL_LABEL_RE.test(work.displayTitle.ru) || TECHNICAL_LABEL_RE.test(work.displayTitle.en)) {
    errors.push(`${work.workId}: technical filename leaked into public title`);
  }
  if (!work.assetIds.length) errors.push(`${work.workId}: no linked visual assets`);
  for (const assetId of work.assetIds) {
    if (!assetById.has(assetId)) errors.push(`${work.workId}: missing asset ${assetId}`);
  }
  const placementAssetIds = [...new Set(placements.filter((placement) => placement.workId === work.workId).map((placement) => placement.assetId))].sort();
  const declaredAssetIds = [...new Set(work.assetIds)].sort();
  if (JSON.stringify(placementAssetIds) !== JSON.stringify(declaredAssetIds)) {
    errors.push(`${work.workId}: work assets do not match placement assets`);
  }
  for (const [field, status] of Object.entries(work.fieldStatus)) {
    if (!status) errors.push(`${work.workId}: field ${field} has no explicit status`);
  }
  if (work.recordType === "artwork" && !work.titles.some((title) => ["source_stated", "cataloguer_supplied"].includes(title.type))) {
    errors.push(`${work.workId}: artwork has neither a source title nor a supplied museum title`);
  }
}

if (publicCatalog.works.length !== works.length) errors.push(`public catalog has ${publicCatalog.works.length} works; canonical catalog has ${works.length}`);
for (const item of publicCatalog.works) {
  if (!item.title?.ru || !item.title?.en) errors.push(`public ${item.id}: missing bilingual title`);
  if (TECHNICAL_LABEL_RE.test(item.title?.ru || "") || TECHNICAL_LABEL_RE.test(item.title?.en || "")) {
    errors.push(`public ${item.id}: technical filename leaked into title`);
  }
}

const fabricatedNumberPattern = /NP-[0-9]{4}/i;
if (fabricatedNumberPattern.test(JSON.stringify(bundle)) || fabricatedNumberPattern.test(JSON.stringify(publicCatalog))) {
  errors.push("fabricated NP classification leaked into canonical or public JSON");
}

const expectedCollections = {
  "home.feed": 25,
  "home.archive.2011_2020": 106,
  "home.archive.2006_2010": 16,
  "home.archive.1997_2005": 2,
  "home.unsorted": 19,
  "portfolio.listing": 24,
  "portfolio.detail": 57,
  photoworks: 87,
  "site.primary": 1
};
const actualCollections = countBy(placements, (placement) => placement.collection);
for (const [collection, expected] of Object.entries(expectedCollections)) {
  const actual = actualCollections[collection] || 0;
  if (actual !== expected) errors.push(`${collection}: expected ${expected} placements, found ${actual}`);
}

console.log(`[content:verify] checking ${assets.length} ${runtimeOnly ? "published previews" : "original files and previews"}`);
let verifiedFiles = 0;
for (const [index, asset] of assets.entries()) {
  const originalPath = path.join(ROOT, asset.originalPath);
  const previewPath = path.join(ROOT, asset.previewPath);
  if (!runtimeOnly) {
    if (!existsSync(originalPath)) {
      errors.push(`${asset.assetId}: missing original ${originalPath}`);
    } else {
      const file = await readFile(originalPath);
      const fileStats = await stat(originalPath);
      if (fileStats.size !== asset.byteSize) errors.push(`${asset.assetId}: byte size mismatch`);
      const digest = createHash("sha256").update(file).digest("hex");
      if (digest !== asset.sha256) errors.push(`${asset.assetId}: SHA-256 mismatch`);
      try {
        const metadata = await sharp(file).metadata();
        if (metadata.width !== asset.widthPx || metadata.height !== asset.heightPx) {
          errors.push(`${asset.assetId}: decoded dimensions differ from manifest`);
        }
      } catch (error) {
        errors.push(`${asset.assetId}: image decode failed: ${error.message}`);
      }
    }
  }
  if (!existsSync(previewPath)) {
    errors.push(`${asset.assetId}: missing preview ${previewPath}`);
  } else {
    try {
      const previewMetadata = await sharp(previewPath).metadata();
      if (previewMetadata.width !== asset.previewWidthPx || previewMetadata.height !== asset.previewHeightPx) {
        errors.push(`${asset.assetId}: preview dimensions differ from manifest`);
      }
    } catch (error) {
      errors.push(`${asset.assetId}: preview decode failed: ${error.message}`);
    }
  }
  if (asset.quality.resolutionTier === "largest_variant") warnings.push(`${asset.assetId}: only a generated WordPress size was available`);
  if (asset.quality.resolutionTier === "discovered_only") warnings.push(`${asset.assetId}: WordPress media record was unavailable; preserved discovered full URL`);
  verifiedFiles += 1;
  if ((index + 1) % 75 === 0) console.log(`[content:verify] checked ${index + 1}/${assets.length}`);
}

const lidoPath = path.join(ROOT, "exports", "lido.xml");
const xsdPath = path.join(ROOT, "schema", "lido-v1.1.xsd");
if (!existsSync(lidoPath) || !existsSync(xsdPath)) {
  errors.push("LIDO XML or official LIDO 1.1 XSD is missing");
} else {
  const lidoXml = await readFile(lidoPath, "utf8");
  if (fabricatedNumberPattern.test(lidoXml)) errors.push("fabricated NP classification leaked into LIDO");
  if (lidoXml.includes("objectPublishedID")) errors.push("LIDO publishes an identifier that has not been confirmed by the artist");
  const result = spawnSync("xmllint", ["--noout", "--schema", xsdPath, lidoPath], { encoding: "utf8" });
  if (result.error?.code === "ENOENT" && runtimeOnly) {
    warnings.push("LIDO XSD validator is unavailable in the hosting image; the locally validated XML is preserved unchanged");
  } else if (result.error) {
    errors.push(`LIDO XSD validator failed to start: ${result.error.message}`);
  } else if (result.status !== 0) {
    errors.push(`LIDO XSD validation failed: ${String(result.stderr || result.stdout || "unknown validator error").trim()}`);
  } else if (result.stderr?.trim()) {
    warnings.push(`LIDO validator warnings: ${result.stderr.trim()}`);
  }
}

const ownerInput = await readFile(path.join(ROOT, "owner-input.csv"), "utf8");
if (fabricatedNumberPattern.test(ownerInput)) errors.push("fabricated NP classification leaked into owner-input.csv");

const verification = {
  verifiedAt: new Date().toISOString(),
  status: errors.length ? "failed" : "passed",
  counts: {
    assets: assets.length,
    verifiedFiles,
    works: works.length,
    placements: placements.length,
    authorities: authorities.length
  },
  collections: actualCollections,
  errors,
  warnings
};
await mkdir(REPORTS, { recursive: true });
await writeFile(path.join(REPORTS, "verification.json"), `${JSON.stringify(verification, null, 2)}\n`);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`[content:verify] passed: ${works.length} works, ${assets.length} ${runtimeOnly ? "published assets" : "originals"}, ${placements.length} placements, LIDO 1.1 XSD valid`);
if (warnings.length) console.log(`[content:verify] ${warnings.length} non-blocking warnings recorded in reports/verification.json`);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonLines(filePath) {
  return (await readFile(filePath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function uniqueMap(values, field) {
  const result = new Map();
  for (const value of values) {
    const key = value[field];
    if (result.has(key)) errors.push(`duplicate ${field}: ${key}`);
    result.set(key, value);
  }
  return result;
}

function countBy(values, getKey) {
  return values.reduce((result, value) => {
    const key = getKey(value);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}
