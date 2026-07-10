import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mediaRoot = path.join(projectRoot, "content-export", "media");
const publicRoot = path.join(projectRoot, "public", "museum");

async function copyDirectory(sourceDirectory, targetDirectory) {
  await mkdir(targetDirectory, { recursive: true });
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  const sourceNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  let copied = 0;
  let unchanged = 0;
  let removed = 0;

  for (const entry of await readdir(targetDirectory, { withFileTypes: true })) {
    if (entry.isFile() && !sourceNames.has(entry.name)) {
      await rm(path.join(targetDirectory, entry.name));
      removed += 1;
    }
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);
    const [sourceHash, targetHash] = await Promise.all([
      digestFile(sourcePath),
      digestFile(targetPath).catch(() => null)
    ]);
    if (targetHash === sourceHash) {
      unchanged += 1;
      continue;
    }

    const temporaryPath = `${targetPath}.${process.pid}.tmp`;
    await copyFile(sourcePath, temporaryPath);
    await rename(temporaryPath, targetPath);
    copied += 1;
  }

  return { copied, unchanged, removed, total: sourceNames.size };
}

async function digestFile(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

const previews = await copyDirectory(
  path.join(mediaRoot, "previews"),
  path.join(publicRoot, "previews")
);

console.log(
  `[museum:sync] previews ${previews.total} (${previews.copied} copied, ${previews.removed} removed)`
);
