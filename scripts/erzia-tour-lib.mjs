import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..");
export const TOUR_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "public",
  "tours",
  "erzia-pichugin",
);
export const INVENTORY_PATH = path.join(SCRIPT_DIR, "erzia-tour.inventory.json");
export const SOURCE_BASE_URL = "https://erzia-museum.ru/saransk-museum/";
export const SOURCE_MANIFEST_PATH = "05.manifest";
export const EXPECTED_SOURCE_FILE_COUNT = 103;
export const EXPECTED_MANIFEST_ENTRY_COUNT = 101;

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function comparePaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function assertSafeRelativePath(relativePath) {
  if (
    !relativePath ||
    relativePath.includes("\\") ||
    relativePath.includes("\0") ||
    relativePath.includes("?") ||
    relativePath.includes("#") ||
    path.posix.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath.split("/").includes("..")
  ) {
    throw new Error(`Unsafe tour path: ${JSON.stringify(relativePath)}`);
  }

  return relativePath;
}

export function parseCacheManifest(manifestText) {
  const lines = manifestText.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "CACHE MANIFEST") {
    throw new Error("Source 05.manifest does not start with CACHE MANIFEST");
  }

  let section = "CACHE";
  const entries = [];

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (/^(CACHE|NETWORK|FALLBACK):$/.test(line)) {
      section = line.slice(0, -1);
      continue;
    }

    if (section !== "CACHE") continue;
    entries.push(assertSafeRelativePath(line));
  }

  const unique = new Set(entries);
  if (unique.size !== entries.length) {
    throw new Error("Source 05.manifest contains duplicate CACHE entries");
  }

  return entries;
}

export async function listFilesRecursively(directory) {
  const files = [];

  async function visit(currentDirectory, prefix) {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    entries.sort((left, right) => comparePaths(left.name, right.name));

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);
      const relativePath = prefix
        ? path.posix.join(prefix, entry.name)
        : entry.name;
      const stats = await lstat(absolutePath);

      if (stats.isSymbolicLink()) {
        throw new Error(`Tour bundle must not contain symlinks: ${relativePath}`);
      }
      if (stats.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (stats.isFile()) {
        files.push(relativePath);
      } else {
        throw new Error(`Unsupported tour bundle entry: ${relativePath}`);
      }
    }
  }

  await visit(directory, "");
  return files.sort(comparePaths);
}

export async function describeFile(directory, relativePath) {
  const buffer = await readFile(path.join(directory, relativePath));
  return {
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
  };
}

export function formatInventory(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}
