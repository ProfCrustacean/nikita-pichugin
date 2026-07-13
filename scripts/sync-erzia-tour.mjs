import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  EXPECTED_MANIFEST_ENTRY_COUNT,
  EXPECTED_SOURCE_FILE_COUNT,
  INVENTORY_PATH,
  SOURCE_BASE_URL,
  SOURCE_MANIFEST_PATH,
  TOUR_DIRECTORY,
  comparePaths,
  formatInventory,
  parseCacheManifest,
  sha256,
} from "./erzia-tour-lib.mjs";
import { verifyErziaTour } from "./verify-erzia-tour.mjs";

const DOWNLOAD_CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_ATTEMPTS = 3;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function pathExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error?.code === "EISDIR") return true;
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function fetchSourceFile(relativePath) {
  const sourceUrl = new URL(relativePath, SOURCE_BASE_URL);
  const sourceBase = new URL(SOURCE_BASE_URL);
  let lastError;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          Accept: "*/*",
          "User-Agent": "Nikita-Pichugin-site-tour-sync/1.0",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const finalUrl = new URL(response.url);
      if (
        finalUrl.origin !== sourceBase.origin ||
        !finalUrl.pathname.startsWith(sourceBase.pathname)
      ) {
        throw new Error(`Unexpected cross-origin redirect to ${finalUrl.href}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS) await sleep(250 * attempt);
    }
  }

  throw new Error(
    `Failed to fetch ${sourceUrl.href}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function localizeIndex(sourceBuffer) {
  const source = sourceBuffer.toString("utf8");
  let localized = source;

  localized = localized.replace(
    /<html\s+manifest="05\.manifest">/i,
    '<html lang="ru">',
  );
  localized = localized.replace(
    /<title>[\s\S]*?<\/title>/i,
    "<title>Виртуальный тур по выставке Никиты Пичугина</title>",
  );
  localized = localized.replace(
    /(<meta\s+name="viewport"[^>]*\/?>)/i,
    `$1\n\t\t<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">`,
  );
  localized = localized.replace(
    /(<div\s+id="container"[^>]*>)[\s\S]*?(<\/div>)/i,
    "$1\n\t\tДля просмотра виртуального тура нужен современный браузер с поддержкой WebGL.\n\t\t$2",
  );
  localized = localized.replace(
    /<noscript>[\s\S]*?<\/noscript>/i,
    "<noscript>\n\t\t\t<p><b>Для просмотра виртуального тура включите JavaScript.</b></p>\n\t\t</noscript>",
  );

  if (localized === source) {
    throw new Error("Source index.html did not match the expected localization rules");
  }
  if (/<html\b[^>]*\bmanifest\s*=/i.test(localized)) {
    throw new Error("Failed to remove obsolete AppCache manifest attribute");
  }
  if (/(?:https?:\/\/)?(?:www\.)?k360\.ru/i.test(localized)) {
    throw new Error("Failed to remove visible k360 reference from index.html");
  }

  return Buffer.from(localized, "utf8");
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return results;
}

async function buildBundle(temporaryDirectory) {
  const manifestBuffer = await fetchSourceFile(SOURCE_MANIFEST_PATH);
  const manifestEntries = parseCacheManifest(manifestBuffer.toString("utf8"));

  if (manifestEntries.length !== EXPECTED_MANIFEST_ENTRY_COUNT) {
    throw new Error(
      `Source manifest changed: expected ${EXPECTED_MANIFEST_ENTRY_COUNT} entries, found ${manifestEntries.length}`,
    );
  }

  const sourcePaths = [SOURCE_MANIFEST_PATH, "index.html", ...manifestEntries]
    .filter((relativePath, index, values) => values.indexOf(relativePath) === index)
    .sort(comparePaths);

  if (sourcePaths.length !== EXPECTED_SOURCE_FILE_COUNT) {
    throw new Error(
      `Source package changed: expected ${EXPECTED_SOURCE_FILE_COUNT} files, found ${sourcePaths.length}`,
    );
  }

  const downloaded = new Map([[SOURCE_MANIFEST_PATH, manifestBuffer]]);
  const pathsToFetch = sourcePaths.filter(
    (relativePath) => relativePath !== SOURCE_MANIFEST_PATH,
  );
  const fetched = await mapWithConcurrency(
    pathsToFetch,
    DOWNLOAD_CONCURRENCY,
    async (relativePath) => [relativePath, await fetchSourceFile(relativePath)],
  );
  for (const [relativePath, buffer] of fetched) downloaded.set(relativePath, buffer);

  const inventoryEntries = [];
  for (const relativePath of sourcePaths) {
    const sourceBuffer = downloaded.get(relativePath);
    if (!sourceBuffer?.length) throw new Error(`Source returned an empty file: ${relativePath}`);

    const publishedBuffer =
      relativePath === "index.html" ? localizeIndex(sourceBuffer) : sourceBuffer;
    const destination = path.join(temporaryDirectory, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, publishedBuffer, { mode: 0o644 });

    inventoryEntries.push({
      path: relativePath,
      sourceBytes: sourceBuffer.byteLength,
      sourceSha256: sha256(sourceBuffer),
      publishedBytes: publishedBuffer.byteLength,
      publishedSha256: sha256(publishedBuffer),
      ...(relativePath === "index.html"
        ? { transform: "localized-index-v1" }
        : {}),
    });
  }

  return {
    schemaVersion: 1,
    sourceBaseUrl: SOURCE_BASE_URL,
    sourceManifest: SOURCE_MANIFEST_PATH,
    expectedFileCount: EXPECTED_SOURCE_FILE_COUNT,
    files: inventoryEntries,
  };
}

async function installAtomically(temporaryDirectory, temporaryInventoryPath) {
  const bundleBackup = `${TOUR_DIRECTORY}.previous-${process.pid}`;
  const inventoryBackup = `${INVENTORY_PATH}.previous-${process.pid}`;
  const hadBundle = await pathExists(TOUR_DIRECTORY);
  const hadInventory = await pathExists(INVENTORY_PATH);

  await rm(bundleBackup, { recursive: true, force: true });
  await rm(inventoryBackup, { force: true });

  try {
    if (hadBundle) await rename(TOUR_DIRECTORY, bundleBackup);
    if (hadInventory) await rename(INVENTORY_PATH, inventoryBackup);
    await rename(temporaryDirectory, TOUR_DIRECTORY);
    await rename(temporaryInventoryPath, INVENTORY_PATH);
    await rm(bundleBackup, { recursive: true, force: true });
    await rm(inventoryBackup, { force: true });
  } catch (error) {
    await rm(TOUR_DIRECTORY, { recursive: true, force: true });
    await rm(INVENTORY_PATH, { force: true });
    if (hadBundle && (await pathExists(bundleBackup))) {
      await rename(bundleBackup, TOUR_DIRECTORY);
    }
    if (hadInventory && (await pathExists(inventoryBackup))) {
      await rename(inventoryBackup, INVENTORY_PATH);
    }
    throw error;
  }
}

async function syncErziaTour() {
  const parentDirectory = path.dirname(TOUR_DIRECTORY);
  const temporaryDirectory = path.join(
    parentDirectory,
    `.erzia-pichugin.sync-${process.pid}`,
  );
  const temporaryInventoryPath = `${INVENTORY_PATH}.sync-${process.pid}`;

  await mkdir(parentDirectory, { recursive: true });
  await rm(temporaryDirectory, { recursive: true, force: true });
  await rm(temporaryInventoryPath, { force: true });

  try {
    const inventory = await buildBundle(temporaryDirectory);
    await writeFile(temporaryInventoryPath, formatInventory(inventory), {
      encoding: "utf8",
      mode: 0o644,
    });

    await verifyErziaTour({
      tourDirectory: temporaryDirectory,
      inventoryPath: temporaryInventoryPath,
    });
    await installAtomically(temporaryDirectory, temporaryInventoryPath);

    const result = await verifyErziaTour();
    return { ...result, event: "erzia_tour_synced" };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
    await rm(temporaryInventoryPath, { force: true });
  }
}

async function main() {
  try {
    console.log(JSON.stringify(await syncErziaTour()));
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "erzia_tour_sync_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
