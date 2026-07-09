import * as cheerio from "cheerio";
import he from "he";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";

export const WORDPRESS_BASE_URL = "https://nikitapichugin.ru";
export const OUTPUT_JSON = "src/data/site-content.json";
export const IMAGE_ROOT = "public/content/images";
export const IMAGE_SOURCE_ROOT = "content/image-sources";
export const RAW_ROOT = "content/raw";

const HEADERS = {
  "user-agent": "Codex content importer for nikitapichugin.ru rebuild"
};

export function decodeText(value = "") {
  return he
    .decode(String(value))
    .replace(/\u00a0/g, " ")
    .replace(/[«»]/g, '"')
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripNavigationNoise(value = "") {
  return decodeText(value)
    .replace(/Prev\s*Entry\s*Next\s*Entry/gi, " ")
    .replace(/Prev\s*Entry|Next\s*Entry|Portfolio/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isTechnicalMediaTitle(value = "") {
  const title = stripNavigationNoise(value);
  return /^(?:photo|img|dsc|image)[_-]?\d/i.test(title) || /^portfolio-image$/i.test(title);
}

export function contentTitleFromMedia(value = "") {
  const title = stripNavigationNoise(value);
  return isTechnicalMediaTitle(title) ? "" : title;
}

export function stripShortcodes(value = "") {
  return decodeText(value)
    .replace(/\[\/?vc_[^\]]*\]/g, " ")
    .replace(/\[\/?dt_[^\]]*\]/g, " ")
    .replace(/\[\/?[a-z0-9_-]+[^\]]*\]/gi, " ");
}

export function textFromHtml(html = "") {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return stripShortcodes($.root().text())
    .replace(/Prev\s*Entry\s*Next\s*Entry/gi, " ")
    .replace(/Prev\s*Entry|Next\s*Entry|Portfolio/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value = "") {
  return decodeText(value)
    .toLowerCase()
    .replace(/ё/g, "e")
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function extractImageUrlsFromHtml(html = "") {
  const urls = [];
  const $ = cheerio.load(html);
  $("img").each((_, element) => {
    urls.push($(element).attr("src"));
    urls.push($(element).attr("data-src"));
  });
  $("a").each((_, element) => {
    const href = $(element).attr("href");
    if (href?.includes("/wp-content/uploads/")) {
      urls.push(href);
    }
  });
  for (const match of html.matchAll(/https?:\\?\/\\?\/nikitapichugin\.ru\\?\/wp-content\\?\/uploads\\?\/[^"' )<]+/g)) {
    urls.push(match[0].replaceAll("\\/", "/"));
  }
  return unique(urls.map((url) => decodeText(url || "").replace(/^http:\/\//, "https://")));
}

export function parseVcIncludeIds(html = "") {
  const decoded = he.decode(html);
  const ids = new Set();
  for (const pattern of [/include=["»]([^"»″]+)["»″]/g, /image=["»](\d+)["»″]/g]) {
    for (const match of decoded.matchAll(pattern)) {
      for (const id of match[1].split(",")) {
        const numeric = Number.parseInt(id.trim(), 10);
        if (Number.isFinite(numeric)) {
          ids.add(numeric);
        }
      }
    }
  }
  return Array.from(ids);
}

export function parseEnviraImages(html = "") {
  const decoded = he.decode(html);
  const galleries = [];
  for (const match of decoded.matchAll(/data-gallery-images='([^']+)'/g)) {
    try {
      const parsed = JSON.parse(match[1].replace(/&quot;/g, '"'));
      if (Array.isArray(parsed)) {
        galleries.push(...parsed);
      }
    } catch {
      // Envira markup is only a fallback source, so malformed embedded JSON is non-fatal.
    }
  }
  return galleries
    .map((image) => ({
      id: Number(image.id || image["data-envira-item-id"] || 0),
      sourceUrl: image.src || image.full || image.link,
      title: decodeText(image.title || image.opts?.title || ""),
      alt: decodeText(image.alt || ""),
      caption: decodeText(image.caption || "")
    }))
    .filter((image) => image.sourceUrl);
}

export function parseSitemapImages(xml = "") {
  const $ = cheerio.load(xml, { xmlMode: true });
  const map = new Map();
  $("url").each((_, node) => {
    const pageUrl = decodeText($(node).find("loc").first().text());
    const slug = pageUrl.replace(/\/$/, "").split("/").pop();
    const images = [];
    $(node)
      .find("image\\:loc")
      .each((__, imageNode) => images.push(decodeText($(imageNode).text())));
    if (slug && images.length > 0) {
      map.set(slug, unique(images));
    }
  });
  return map;
}

export function parseArtworkDetails({ title, text, year = "" }) {
  const cleanTitle = decodeText(title);
  let clean = stripNavigationNoise(text)
    .replace(new RegExp(`^${escapeRegExp(cleanTitle)}\\s*`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();

  const dimensionsMatch = clean.match(/(\d{1,3})\s*[xх×]\s*(\d{1,3})(?:\s*[xх×]\s*(\d{1,3}))?/i);
  const dimensions = dimensionsMatch
    ? dimensionsMatch[3]
      ? `${dimensionsMatch[1]} x ${dimensionsMatch[2]} x ${dimensionsMatch[3]}`
      : `${dimensionsMatch[1]} x ${dimensionsMatch[2]}`
    : "";

  const yearRangeMatch = clean.match(/\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2})\b/i);
  const yearMatch = clean.match(/\b((?:19|20)\d{2})\s*г?\.?/i);
  const resolvedYear = year || yearRangeMatch?.[1] || yearMatch?.[1] || "";

  const sentences = clean
    .split(/(?<=\.)\s+|(?<=\!)\s+|(?<=\?)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const mediumSentence =
    sentences.find((sentence) => /холст|масло|акрил|картон|темпера|бумага|акварель|тушь/i.test(sentence)) || "";
  const medium = mediumSentence
    .replace(/\b\d{1,3}\s*[xх×]\s*\d{1,3}(?:\s*[xх×]\s*\d{1,3})?\b/gi, "")
    .replace(/\b(?:19|20)\d{2}\s*г?\.?/gi, "")
    .replace(/[.,;:\s]+$/g, "")
    .trim();

  if (mediumSentence) {
    clean = clean.replace(mediumSentence, " ");
  }
  if (dimensions) {
    clean = clean.replace(dimensionsMatch[0], " ");
  }
  if (yearRangeMatch) {
    clean = clean.replace(yearRangeMatch[0], " ");
  }
  if (resolvedYear) {
    clean = clean.replace(new RegExp(`(^|\\s)${resolvedYear}\\s*года(?=$|[\\s.!?])`, "i"), " ");
    clean = clean.replace(new RegExp(`\\b${resolvedYear}\\s*г?\\.?`, "i"), " ");
  }
  const description = stripNavigationNoise(clean)
    .replace(/^[.,;:\s]+/g, "")
    .replace(/[.,;:\s]+$/g, "")
    .replace(/(^|\s)(?:19|20)\d{2}\s*года(?=$|[\s.!?])/gi, " ")
    .replace(/(^|\s)года(?=$|[\s.!?])/gi, " ")
    .replace(/(^|\s)ода(?=$|[\s.!?])/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    year: resolvedYear,
    medium,
    dimensions,
    description
  };
}

export function normalizePhone(value = "") {
  return decodeText(value).replace(/\s+/g, " ").trim();
}

export function phoneHref(value = "") {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  return `tel:+${digits.startsWith("8") && digits.length === 11 ? `7${digits.slice(1)}` : digits}`;
}

export async function fetchJson(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchText(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(`${filePath}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function localizeImage({ sourceUrl, kind, ownerSlug, index, alt = "", caption = "" }) {
  const safeOwner = slugify(ownerSlug) || "asset";
  const localDir = path.join(IMAGE_ROOT, kind, safeOwner);
  const sourceDir = path.join(IMAGE_SOURCE_ROOT, kind, safeOwner);
  const filename = `${String(index + 1).padStart(2, "0")}.webp`;
  const outputPath = path.join(localDir, filename);
  const sourceMetaPath = path.join(sourceDir, `${filename}.json`);

  await mkdir(localDir, { recursive: true });
  await mkdir(sourceDir, { recursive: true });

  let cachedSourceUrl = "";
  if (existsSync(sourceMetaPath)) {
    try {
      cachedSourceUrl = JSON.parse(await readFile(sourceMetaPath, "utf8")).sourceUrl || "";
    } catch {
      cachedSourceUrl = "";
    }
  }

  if (!existsSync(outputPath) || cachedSourceUrl !== sourceUrl) {
    const response = await fetch(sourceUrl, { headers: HEADERS });
    if (!response.ok) {
      throw new Error(`Failed to download ${sourceUrl}: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await sharp(buffer)
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toFile(outputPath);
  }

  const metadata = await sharp(outputPath).metadata();
  await writeFile(
    sourceMetaPath,
    `${JSON.stringify(
      {
        localPath: `/${outputPath.replace(/^public\//, "")}`,
        sourceUrl,
        width: metadata.width || 0,
        height: metadata.height || 0
      },
      null,
      2
    )}\n`
  );

  return {
    localPath: `/${outputPath.replace(/^public\//, "")}`,
    sourceUrl,
    width: metadata.width || 0,
    height: metadata.height || 0,
    alt: decodeText(alt),
    caption: decodeText(caption)
  };
}

export async function localizeImages(images, kind, ownerSlug) {
  const localized = [];
  for (const [index, image] of images.entries()) {
    const sourceUrl = typeof image === "string" ? image : image.sourceUrl;
    if (!sourceUrl) {
      continue;
    }
    try {
      localized.push(
        await localizeImage({
          sourceUrl,
          kind,
          ownerSlug,
          index,
          alt: typeof image === "string" ? ownerSlug : image.alt || image.title || ownerSlug,
          caption: typeof image === "string" ? "" : image.caption || image.title || ""
        })
      );
    } catch (error) {
      console.warn(`[import-content] skipped image ${sourceUrl}: ${error.message}`);
    }
  }
  return localized;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
