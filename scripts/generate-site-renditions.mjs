import { mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const exportRoot = path.join(projectRoot, "content-export");
const outputRoot = path.join(projectRoot, "public", "site");

const renditions = [
  { workId: "work_e78336cb6f7d8e6e", filename: "home-hero.webp", width: 2400 },
  { workId: "work_f1ceaad48a110729", filename: "works-hero.webp", width: 2400 },
  { workId: "work_550dd44ad5709fe5", filename: "contact-hero.webp", width: 2000 }
];

const readJsonLines = async (relativePath) => (await readFile(path.join(exportRoot, relativePath), "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const [works, assets] = await Promise.all([
  readJsonLines("data/works.jsonl"),
  readJsonLines("data/assets.jsonl")
]);
const workById = new Map(works.map((work) => [work.workId, work]));
const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));

await mkdir(outputRoot, { recursive: true });
const expected = new Set(renditions.map((rendition) => rendition.filename));

for (const rendition of renditions) {
  const work = workById.get(rendition.workId);
  if (!work) throw new Error(`[site:renditions] missing work ${rendition.workId}`);
  const asset = work.assetIds
    .map((assetId) => assetById.get(assetId))
    .find((candidate) => candidate?.visualClass === "artwork_reproduction");
  if (!asset) throw new Error(`[site:renditions] ${rendition.workId} has no artwork reproduction`);

  const source = path.join(exportRoot, asset.originalPath);
  const destination = path.join(outputRoot, rendition.filename);
  if (!existsSync(source)) {
    if (!existsSync(destination)) {
      throw new Error(`[site:renditions] missing source and committed rendition for ${rendition.workId}`);
    }
    continue;
  }
  const temporary = `${destination}.tmp`;
  await sharp(source)
    .rotate()
    .resize({ width: rendition.width, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, effort: 5 })
    .toFile(temporary);
  await rename(temporary, destination);
}

for (const filename of await readdir(outputRoot)) {
  if (filename.endsWith(".webp") && !expected.has(filename)) {
    await rm(path.join(outputRoot, filename));
  }
}

console.log(`[site:renditions] wrote ${renditions.length} high-resolution hero images`);
