import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  EXPECTED_MANIFEST_ENTRY_COUNT,
  EXPECTED_SOURCE_FILE_COUNT,
  INVENTORY_PATH,
  SOURCE_MANIFEST_PATH,
  TOUR_DIRECTORY,
  comparePaths,
  describeFile,
  listFilesRecursively,
  parseCacheManifest,
} from "./erzia-tour-lib.mjs";

const REQUIRED_ROOT_FILES = [
  SOURCE_MANIFEST_PATH,
  "index.html",
  "museum-01.xml",
  "pano2vr_player.js",
  "skin.js",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSamePaths(actual, expected, label) {
  assert(
    actual.length === expected.length,
    `${label}: expected ${expected.length} paths, found ${actual.length}`,
  );

  for (let index = 0; index < expected.length; index += 1) {
    assert(
      actual[index] === expected[index],
      `${label}: path mismatch at index ${index}: expected ${expected[index]}, found ${actual[index]}`,
    );
  }
}

function collectXmlReferences(xml) {
  const references = new Set();
  for (const match of xml.matchAll(/\b[a-zA-Z0-9_]*url="([^"]+)"/g)) {
    const reference = match[1];
    if (!reference || reference.startsWith("{") || /^[a-z]+:/i.test(reference)) {
      continue;
    }
    references.add(reference);
  }
  return [...references].sort(comparePaths);
}

function collectSkinReferences(skin) {
  return [
    ...new Set(
      [...skin.matchAll(/["'](images\/[a-zA-Z0-9_.\/-]+)["']/g)].map(
        (match) => match[1],
      ),
    ),
  ].sort(comparePaths);
}

function assertImageSignature(relativePath, buffer) {
  if (relativePath.endsWith(".jpg")) {
    assert(
      buffer.length >= 4 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer.at(-2) === 0xff &&
        buffer.at(-1) === 0xd9,
      `Invalid JPEG signature: ${relativePath}`,
    );
  }

  if (relativePath.endsWith(".png")) {
    const signature = buffer.subarray(0, 8).toString("hex");
    assert(signature === "89504e470d0a1a0a", `Invalid PNG signature: ${relativePath}`);
  }
}

export async function verifyErziaTour({
  tourDirectory = TOUR_DIRECTORY,
  inventoryPath = INVENTORY_PATH,
} = {}) {
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));

  assert(inventory.schemaVersion === 1, "Unsupported Erzia tour inventory schema");
  assert(
    inventory.expectedFileCount === EXPECTED_SOURCE_FILE_COUNT,
    `Inventory expectedFileCount must be ${EXPECTED_SOURCE_FILE_COUNT}`,
  );
  assert(Array.isArray(inventory.files), "Inventory files must be an array");
  assert(
    inventory.files.length === EXPECTED_SOURCE_FILE_COUNT,
    `Inventory must describe ${EXPECTED_SOURCE_FILE_COUNT} files`,
  );

  const inventoryPaths = inventory.files.map((entry) => entry.path);
  const sortedInventoryPaths = [...inventoryPaths].sort(comparePaths);
  assertSamePaths(inventoryPaths, sortedInventoryPaths, "Inventory ordering");
  assert(
    new Set(inventoryPaths).size === inventoryPaths.length,
    "Inventory contains duplicate paths",
  );

  const publishedPaths = await listFilesRecursively(tourDirectory);
  assertSamePaths(publishedPaths, inventoryPaths, "Published tour inventory");

  for (const requiredPath of REQUIRED_ROOT_FILES) {
    assert(publishedPaths.includes(requiredPath), `Missing required tour file: ${requiredPath}`);
  }

  let totalBytes = 0;
  for (const entry of inventory.files) {
    assert(typeof entry.sourceBytes === "number", `Missing sourceBytes: ${entry.path}`);
    assert(
      /^[a-f0-9]{64}$/.test(entry.sourceSha256),
      `Invalid sourceSha256: ${entry.path}`,
    );
    assert(typeof entry.publishedBytes === "number", `Missing publishedBytes: ${entry.path}`);
    assert(
      /^[a-f0-9]{64}$/.test(entry.publishedSha256),
      `Invalid publishedSha256: ${entry.path}`,
    );

    if (entry.path === "index.html") {
      assert(
        entry.transform === "localized-index-v1",
        "Localized index transformation is not recorded in the inventory",
      );
    } else {
      assert(
        entry.sourceBytes === entry.publishedBytes &&
          entry.sourceSha256 === entry.publishedSha256,
        `Unrecorded source transformation: ${entry.path}`,
      );
    }

    const description = await describeFile(tourDirectory, entry.path);
    assert(description.bytes > 0, `Empty tour file: ${entry.path}`);
    assert(
      description.bytes === entry.publishedBytes,
      `Byte count mismatch for ${entry.path}`,
    );
    assert(
      description.sha256 === entry.publishedSha256,
      `SHA-256 mismatch for ${entry.path}`,
    );
    totalBytes += description.bytes;

    if (/\.(?:jpg|png)$/.test(entry.path)) {
      assertImageSignature(
        entry.path,
        await readFile(path.join(tourDirectory, entry.path)),
      );
    }
  }

  const manifest = await readFile(
    path.join(tourDirectory, SOURCE_MANIFEST_PATH),
    "utf8",
  );
  const manifestEntries = parseCacheManifest(manifest).sort(comparePaths);
  assert(
    manifestEntries.length === EXPECTED_MANIFEST_ENTRY_COUNT,
    `Expected ${EXPECTED_MANIFEST_ENTRY_COUNT} manifest entries, found ${manifestEntries.length}`,
  );
  const expectedManifestEntries = publishedPaths
    .filter((relativePath) => ![SOURCE_MANIFEST_PATH, "index.html"].includes(relativePath))
    .sort(comparePaths);
  assertSamePaths(manifestEntries, expectedManifestEntries, "Cache manifest coverage");

  const index = await readFile(path.join(tourDirectory, "index.html"), "utf8");
  assert(!/<html\b[^>]*\bmanifest\s*=/i.test(index), "Obsolete AppCache manifest attribute remains");
  assert(/<html\s+lang="ru">/i.test(index), "Tour index must declare Russian language");
  assert(
    /<title>Виртуальный тур по выставке Никиты Пичугина<\/title>/.test(index),
    "Tour index has an unexpected visible title",
  );
  assert(
    /http-equiv="Content-Security-Policy"/i.test(index),
    "Tour index is missing its self-only Content Security Policy",
  );

  const visibleContainer = index.match(
    /<div\s+id="container"[^>]*>([\s\S]*?)<\/div>/i,
  )?.[1];
  assert(visibleContainer, "Tour index container fallback is missing");
  assert(!/<a\b/i.test(visibleContainer), "Tour fallback must not contain external links");

  const textFiles = publishedPaths.filter((relativePath) =>
    /\.(?:html|js|xml|manifest)$/.test(relativePath),
  );
  for (const relativePath of textFiles) {
    const contents = await readFile(path.join(tourDirectory, relativePath), "utf8");
    assert(
      !/(?:https?:\/\/)?(?:www\.)?k360\.ru/i.test(contents),
      `Public tour file contains a k360 reference: ${relativePath}`,
    );
    assert(
      !/https?:\/\/(?:[^/]+\.)?erzia-museum\.ru/i.test(contents),
      `Public tour file contains an Erzia source URL: ${relativePath}`,
    );
  }

  const xml = await readFile(path.join(tourDirectory, "museum-01.xml"), "utf8");
  const nodeIds = [...xml.matchAll(/<panorama\b[^>]*\bid="([^"]+)"/g)].map(
    (match) => match[1],
  );
  const hotspotTargets = [...xml.matchAll(/<hotspot\b[^>]*\burl="\{([^}]+)\}"/g)].map(
    (match) => match[1],
  );
  assert(nodeIds.length === 5, `Expected 5 panorama nodes, found ${nodeIds.length}`);
  assert(hotspotTargets.length === 8, `Expected 8 hotspot transitions, found ${hotspotTargets.length}`);
  for (const target of hotspotTargets) {
    assert(nodeIds.includes(target), `Hotspot points to missing panorama node: ${target}`);
  }

  const localReferences = [
    ...collectXmlReferences(xml),
    ...collectSkinReferences(
      await readFile(path.join(tourDirectory, "skin.js"), "utf8"),
    ),
  ];
  for (const reference of new Set(localReferences)) {
    assert(publishedPaths.includes(reference), `Tour references a missing file: ${reference}`);
  }

  return {
    event: "erzia_tour_verified",
    files: publishedPaths.length,
    bytes: totalBytes,
    panoramaNodes: nodeIds.length,
    hotspotTransitions: hotspotTargets.length,
    localReferences: new Set(localReferences).size,
  };
}

async function main() {
  try {
    console.log(JSON.stringify(await verifyErziaTour()));
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "erzia_tour_verification_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
