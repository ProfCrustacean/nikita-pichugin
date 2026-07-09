import { readJson } from "./wordpress-content.mjs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const content = await readJson("src/data/site-content.json");
const errors = [];

function requireValue(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

requireValue(content.brand?.name === "Никита Пичугин", "brand.name must be present");
requireValue(content.intro?.text?.length > 20, "intro text must be present");
requireValue(content.contact?.phoneHref?.startsWith("tel:"), "contact phone href must be tel:");
requireValue(content.contact?.emailHref?.startsWith("mailto:"), "contact email href must be mailto:");
requireValue(Array.isArray(content.artworks), "artworks must be an array");
requireValue(content.artworks.length === 24, `expected 24 artworks, got ${content.artworks?.length || 0}`);
requireValue(content.homeGallery?.images?.length >= 20, "expected at least 20 home gallery images");
requireValue(content.photoWorks?.images?.length >= 80, "expected at least 80 photowork images");
requireValue(Boolean(content.intro?.englishText), "intro english text must be present");

const seenImagePaths = new Set();

function requireImageFile(image, label) {
  requireValue(image.localPath?.startsWith("/content/images/"), `${label}: invalid localPath`);
  requireValue(image.sourceUrl?.startsWith("https://"), `${label}: invalid sourceUrl`);
  requireValue(image.width > 0 && image.height > 0, `${label}: invalid image dimensions`);
  if (image.localPath?.startsWith("/")) {
    const filePath = path.join("public", image.localPath);
    requireValue(existsSync(filePath), `${label}: local image file missing at ${filePath}`);
    const sourceMetaPath = `${image.localPath.replace(/^\/content\/images\//, "content/image-sources/")}.json`;
    requireValue(existsSync(sourceMetaPath), `${label}: source metadata missing at ${sourceMetaPath}`);
    if (existsSync(sourceMetaPath)) {
      const sourceMeta = JSON.parse(readFileSync(sourceMetaPath, "utf8"));
      requireValue(sourceMeta.sourceUrl === image.sourceUrl, `${label}: local image source mismatch for ${image.localPath}`);
    }
  }
  requireValue(!seenImagePaths.has(image.localPath), `${label}: duplicate localPath ${image.localPath}`);
  seenImagePaths.add(image.localPath);
}

requireImageFile(content.portrait || {}, "portrait");

for (const artwork of content.artworks || []) {
  requireValue(Number.isFinite(artwork.wpId), `${artwork.slug}: wpId missing`);
  requireValue(Boolean(artwork.slug), `${artwork.wpId}: slug missing`);
  requireValue(Boolean(artwork.title), `${artwork.slug}: title missing`);
  requireValue(Boolean(artwork.sourcePageUrl), `${artwork.slug}: sourcePageUrl missing`);
  requireValue(Array.isArray(artwork.images) && artwork.images.length > 0, `${artwork.slug}: image missing`);
  requireValue(!/Prev\s*Entry|Next\s*Entry|Portfolio/i.test(artwork.medium || ""), `${artwork.slug}: medium contains WordPress navigation noise`);
  requireValue(!/Prev\s*Entry|Next\s*Entry|Portfolio/i.test(artwork.description || ""), `${artwork.slug}: description contains WordPress navigation noise`);
  for (const image of artwork.images || []) {
    requireImageFile(image, artwork.slug);
  }
}

for (const [index, image] of (content.homeGallery?.images || []).entries()) {
  requireValue(image.kind === "artwork", `homeGallery ${index}: invalid kind`);
  requireValue(image.displayTitle === image.title, `homeGallery ${index}: displayTitle must mirror source title`);
  requireValue(!/^photo_/i.test(image.title || ""), `homeGallery ${index}: technical media filename leaked into title`);
  requireValue(image.displayTitle !== "Кадр мастерской", `homeGallery ${index}: invented studio title leaked into displayTitle`);
  requireImageFile(image, `homeGallery ${index}`);
}

for (const sentence of content.photoWorks?.intro || []) {
  requireValue(!sentence.includes("[vc_"), "photoworks intro contains shortcode text");
}

for (const [index, image] of (content.photoWorks?.images || []).entries()) {
  requireImageFile(image, `photowork ${index}`);
}

for (const [index, image] of (content.homeGallery?.images || []).entries()) {
  for (const photo of content.photoWorks?.images || []) {
    requireValue(
      image.sourceUrl !== photo.sourceUrl,
      `homeGallery ${index}: sourceUrl is duplicated inside photoworks instead of being classified separately`
    );
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `[validate-content] ok: ${content.artworks.length} artworks, ${content.photoWorks.images.length} photoworks`
);
