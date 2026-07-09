import * as cheerio from "cheerio";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  WORDPRESS_BASE_URL,
  decodeText,
  extractImageUrlsFromHtml,
  fetchText,
  parseArtworkDetails,
  parseEnviraImages,
  parseSitemapImages,
  parseVcIncludeIds,
  contentTitleFromMedia,
  stripNavigationNoise,
  textFromHtml,
  unique
} from "./wordpress-content.mjs";

const OUTPUT_DIR = "content/audit";
const INVENTORY_JSON = path.join(OUTPUT_DIR, "live-content-inventory.json");
const INVENTORY_MD = path.join(OUTPUT_DIR, "live-content-inventory.md");
const ASSETS_CSV = path.join(OUTPUT_DIR, "live-content-assets.csv");

const PAGE_IDS = {
  home: 4,
  photoWorks: 7293,
  contact: 4547,
  worksArchive: 14484
};

const SITEMAPS = {
  root: `${WORDPRESS_BASE_URL}/sitemap.xml`,
  pages: `${WORDPRESS_BASE_URL}/page-sitemap.xml`,
  products: `${WORDPRESS_BASE_URL}/product-sitemap.xml`,
  portfolios: `${WORDPRESS_BASE_URL}/dt_portfolios-sitemap.xml`,
  envira: `${WORDPRESS_BASE_URL}/envira-sitemap.xml`
};

const PRIMARY_SECTION_URLS = new Set([
  `${WORDPRESS_BASE_URL}/`,
  `${WORDPRESS_BASE_URL}/portfolio/galereya-rabot-hudozhnika-nikity-pichugina/`,
  `${WORDPRESS_BASE_URL}/masterskaya-nikity-pichugina/`,
  `${WORDPRESS_BASE_URL}/contact-info/`,
  `${WORDPRESS_BASE_URL}/envira/lenta-na-glavnoj/`
]);

async function main() {
  console.log("[classify-live-content] fetching WordPress source data");

  const [sitemapIndex, pageSitemap, productSitemap, portfolioSitemap, enviraSitemap, pages, products, portfolios, entries, media] =
    await Promise.all([
      fetchText(SITEMAPS.root),
      fetchText(SITEMAPS.pages),
      fetchText(SITEMAPS.products),
      fetchText(SITEMAPS.portfolios),
      fetchText(SITEMAPS.envira),
      fetchCollection("pages", "id,slug,title,link,content,excerpt,date,modified,menu_order,status"),
      fetchCollection("product", "id,slug,title,link,content,excerpt,date,modified"),
      fetchCollection("dt_portfolios", "id,slug,title,link,content,portfolio_entries,aioseo_head_json,date,modified,menu_order"),
      fetchCollection("portfolio_entries", "id,name,slug,count,link"),
      fetchCollection("media", "id,slug,title,alt_text,caption,source_url,media_details,mime_type,date,modified,link,post")
    ]);
  const restHeaderTotals = await probeRestHeaderTotals(["pages", "product", "dt_portfolios", "media"]);

  const liveHtml = {
    home: await fetchText(`${WORDPRESS_BASE_URL}/`),
    worksArchive: await fetchText(`${WORDPRESS_BASE_URL}/portfolio/galereya-rabot-hudozhnika-nikity-pichugina/`),
    photoWorks: await fetchText(`${WORDPRESS_BASE_URL}/masterskaya-nikity-pichugina/`)
  };

  const sitemapEntries = {
    root: parseSitemapIndex(sitemapIndex),
    pages: parseUrlSitemap(pageSitemap),
    products: parseUrlSitemap(productSitemap),
    portfolios: parseUrlSitemap(portfolioSitemap),
    envira: parseUrlSitemap(enviraSitemap)
  };

  const mediaIndex = buildMediaIndex(media);
  const assetMap = new Map();
  const entryYearById = new Map(entries.map((entry) => [entry.id, /^\d{4}$/.test(entry.name) ? entry.name : ""]));
  const sitemapImagesBySlug = parseSitemapImages(portfolioSitemap);

  registerSitemapImageReferences(assetMap, sitemapEntries);

  const artworks = portfolios.map((portfolio, index) => {
    const title = decodeText(portfolio.title?.rendered);
    const text = sourceTextForPortfolio(portfolio);
    const taxonomyYear = (portfolio.portfolio_entries || []).map((id) => entryYearById.get(id)).find(Boolean) || "";
    const details = parseArtworkDetails({ title, text, year: taxonomyYear });
    const schemaImage = portfolio.aioseo_head_json?.schema?.["@graph"]?.find((node) => node["@type"] === "WebPage")?.image?.url;
    const htmlImages = uniqueByCanonical(extractImageUrlsFromHtml(portfolio.content?.rendered || ""));
    const sitemapImages = uniqueByCanonical(sitemapImagesBySlug.get(portfolio.slug) || []);
    const trustedImageUrls = uniqueByCanonical([schemaImage, ...sitemapImages]);
    const trustedCanonicals = new Set(trustedImageUrls.map((sourceUrl) => canonicalUploadUrl(sourceUrl)));
    const htmlExtraImages = htmlImages.filter((sourceUrl) => !trustedCanonicals.has(canonicalUploadUrl(sourceUrl)));
    const imageRefs = trustedImageUrls.map((sourceUrl, imageIndex) => {
      const occurrence = {
        section: "artwork.detail",
        source: sitemapImages.some((url) => canonicalUploadUrl(url) === canonicalUploadUrl(sourceUrl))
          ? "dt_portfolios-sitemap"
          : "dt_portfolio-schema",
        ownerType: "artwork",
        ownerId: portfolio.id,
        ownerSlug: portfolio.slug,
        ownerTitle: title,
        ownerUrl: portfolio.link || `${WORDPRESS_BASE_URL}/portfolios/${portfolio.slug}/`,
        imageIndex,
        role: imageIndex === 0 ? "primary_or_first_detail_image" : "detail_image",
        inPrimaryScope: true
      };
      registerAsset(assetMap, sourceUrl, occurrence);
      return {
        sourceUrl,
        canonicalUrl: canonicalUploadUrl(sourceUrl),
        role: occurrence.role
      };
    });
    const htmlReferenceRefs = htmlExtraImages.map((sourceUrl, imageIndex) => {
      registerAsset(assetMap, sourceUrl, {
        section: "artwork.detail_html_reference",
        source: "dt_portfolio-rest-content-raw-upload-reference",
        ownerType: "artwork",
        ownerId: portfolio.id,
        ownerSlug: portfolio.slug,
        ownerTitle: title,
        ownerUrl: portfolio.link || `${WORDPRESS_BASE_URL}/portfolios/${portfolio.slug}/`,
        imageIndex,
        role: "raw_html_reference_not_in_sitemap_or_schema",
        inPrimaryScope: false
      });
      return {
        sourceUrl,
        canonicalUrl: canonicalUploadUrl(sourceUrl),
        role: "raw_html_reference_not_in_sitemap_or_schema"
      };
    });

    return {
      wpId: portfolio.id,
      slug: portfolio.slug,
      title,
      sourcePageUrl: portfolio.link || `${WORDPRESS_BASE_URL}/portfolios/${portfolio.slug}/`,
      order: index,
      modified: portfolio.modified || "",
      taxonomyYear,
      year: details.year,
      medium: details.medium,
      dimensions: details.dimensions,
      objectType: classifyArtworkObject(details.medium),
      description: sanitizeDescription(details.description),
      images: imageRefs,
      htmlExtraImageReferences: htmlReferenceRefs,
      imageCount: imageRefs.length,
      sourceImageCounts: {
        schemaImage: schemaImage ? 1 : 0,
        sitemapImages: sitemapImages.length,
        rawHtmlCanonicalUploadReferences: htmlImages.length,
        rawHtmlExtraReferences: htmlReferenceRefs.length
      },
      metadataCompleteness: completeness({
        title,
        year: details.year,
        medium: details.medium,
        dimensions: details.dimensions,
        images: imageRefs.length > 0
      }),
      notes: artworkNotes(portfolio.slug, title, details, imageRefs)
    };
  });

  const homeGallery = classifyHomeGallery(liveHtml.home, assetMap);
  const homePageVisuals = classifyPageUploadReferences({
    html: liveHtml.home,
    sourcePageUrl: `${WORDPRESS_BASE_URL}/`,
    section: "home.page_html",
    assetMap,
    knownUrls: new Set(homeGallery.images.map((image) => canonicalUploadUrl(image.sourceUrl)))
  });
  const worksArchiveImages = classifyPageUploadReferences({
    html: liveHtml.worksArchive,
    sourcePageUrl: `${WORDPRESS_BASE_URL}/portfolio/galereya-rabot-hudozhnika-nikity-pichugina/`,
    section: "works.archive_html",
    assetMap
  });
  const photoWorks = await classifyPhotoWorks(pages.find((page) => page.id === PAGE_IDS.photoWorks), mediaIndex, assetMap);
  const productSitemapByUrl = new Map(sitemapEntries.products.map((entry) => [normalizeUrl(entry.loc), entry]));
  const productsInventory = products.map((product) => classifyProduct(product, assetMap, productSitemapByUrl.get(normalizeUrl(product.link))));

  registerAllMediaAttachments(assetMap, mediaIndex);
  const assets = finalizeAssets(assetMap, mediaIndex);

  const summary = buildSummary({
    sitemapEntries,
    pages,
    products,
    portfolios,
    media,
    artworks,
    homeGallery,
    homePageVisuals,
    worksArchiveImages,
    photoWorks,
    productsInventory,
    assets,
    restHeaderTotals
  });

  const inventory = {
    generatedAt: new Date().toISOString(),
    source: {
      wordpressBaseUrl: WORDPRESS_BASE_URL,
      restApi: `${WORDPRESS_BASE_URL}/wp-json`,
      sitemaps: SITEMAPS,
      pageIds: PAGE_IDS
    },
    summary,
    artworks,
    homeGallery,
    homePageVisuals,
    worksArchiveImages,
    photoWorks,
    products: productsInventory,
    assets
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(INVENTORY_JSON, `${JSON.stringify(inventory, null, 2)}\n`);
  await writeFile(INVENTORY_MD, renderMarkdown(inventory));
  await writeFile(ASSETS_CSV, renderAssetsCsv(assets));

  console.log(
    `[classify-live-content] wrote ${INVENTORY_JSON}: ${artworks.length} artworks, ${homeGallery.images.length} home feed images, ${photoWorks.images.length} photoworks, ${assets.length} classified assets`
  );
}

async function fetchCollection(type, fields) {
  const results = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = `${WORDPRESS_BASE_URL}/wp-json/wp/v2/${type}?per_page=100&page=${page}&_fields=${encodeURIComponent(fields)}`;
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    totalPages = Number.parseInt(response.headers.get("x-wp-totalpages") || "1", 10);
    results.push(...(await response.json()));
    page += 1;
  } while (page <= totalPages);
  return results;
}

async function fetchWithRetry(url, attempts = 4) {
  let lastResponse;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResponse = await fetch(url, { headers: { "user-agent": "Codex live source classifier for nikitapichugin.ru" } });
    if (lastResponse.ok || (lastResponse.status < 500 && lastResponse.status !== 429)) {
      return lastResponse;
    }
    await sleep(500 * attempt);
  }
  return lastResponse;
}

async function probeRestHeaderTotals(types) {
  const totals = {};
  for (const type of types) {
    const response = await fetchWithRetry(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/${type}?per_page=1`);
    totals[type] = Number.parseInt(response.headers.get("x-wp-total") || "0", 10);
  }
  return totals;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSitemapIndex(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("sitemap")
    .toArray()
    .map((node) => ({
      loc: decodeText($(node).find("loc").first().text()),
      lastmod: decodeText($(node).find("lastmod").first().text())
    }));
}

function parseUrlSitemap(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("url")
    .toArray()
    .map((node) => {
      const images = [];
      $(node)
        .find("image\\:loc")
        .each((_, imageNode) => images.push(decodeText($(imageNode).text())));
      return {
        loc: decodeText($(node).find("loc").first().text()),
        lastmod: decodeText($(node).find("lastmod").first().text()),
        images: unique(images)
      };
    });
}

function buildMediaIndex(media) {
  const byExactUrl = new Map();
  const byCanonicalUrl = new Map();
  for (const item of media) {
    const urls = [item.source_url];
    for (const size of Object.values(item.media_details?.sizes || {})) {
      urls.push(size.source_url);
    }
    for (const url of urls.filter(Boolean)) {
      byExactUrl.set(normalizeUrl(url), item);
      byCanonicalUrl.set(canonicalUploadUrl(url), item);
    }
  }
  return { all: media, byExactUrl, byCanonicalUrl };
}

function registerSitemapImageReferences(assetMap, sitemapEntries) {
  for (const [sitemapName, entries] of Object.entries(sitemapEntries)) {
    if (sitemapName === "root") continue;
    for (const entry of entries) {
      const context = contextForPageUrl(entry.loc);
      for (const [imageIndex, sourceUrl] of entry.images.entries()) {
        registerAsset(assetMap, sourceUrl, {
          section: context.section,
          source: `${sitemapName}-sitemap`,
          ownerType: context.ownerType,
          ownerSlug: context.ownerSlug,
          ownerTitle: context.ownerTitle,
          ownerUrl: entry.loc,
          imageIndex,
          role: context.role,
          inPrimaryScope: context.inPrimaryScope
        });
      }
    }
  }
}

function registerAsset(assetMap, sourceUrl, occurrence) {
  const normalized = normalizeUrl(sourceUrl);
  if (!normalized || !normalized.includes("/wp-content/uploads/")) return null;
  const canonicalUrl = canonicalUploadUrl(normalized);
  if (!assetMap.has(canonicalUrl)) {
    assetMap.set(canonicalUrl, {
      canonicalUrl,
      sourceUrls: [],
      occurrences: []
    });
  }
  const record = assetMap.get(canonicalUrl);
  if (!record.sourceUrls.includes(normalized)) {
    record.sourceUrls.push(normalized);
  }
  record.occurrences.push({
    ...occurrence,
    sourceUrl: normalized
  });
  return record;
}

function registerAllMediaAttachments(assetMap, mediaIndex) {
  for (const media of mediaIndex.all) {
    const canonicalUrl = canonicalUploadUrl(media.source_url);
    if (!assetMap.has(canonicalUrl)) {
      assetMap.set(canonicalUrl, {
        canonicalUrl,
        sourceUrls: [normalizeUrl(media.source_url)],
        occurrences: [
          {
            section: "wp.media_library_unreferenced",
            source: "wp-rest-media",
            ownerType: "media_attachment",
            ownerId: media.id,
            ownerSlug: media.slug,
            ownerTitle: decodeText(media.title?.rendered || media.slug),
            ownerUrl: media.link || "",
            imageIndex: 0,
            role: "available_via_media_rest_only",
            inPrimaryScope: false,
            sourceUrl: normalizeUrl(media.source_url)
          }
        ]
      });
    }
  }
}

function finalizeAssets(assetMap, mediaIndex) {
  return Array.from(assetMap.values())
    .map((asset) => {
      const media = mediaIndex.byCanonicalUrl.get(asset.canonicalUrl) || mediaIndex.byExactUrl.get(asset.sourceUrls[0]);
      const occurrences = dedupeOccurrences(asset.occurrences);
      const classification = classifyAsset({ occurrences });
      return {
        canonicalUrl: asset.canonicalUrl,
        sourceUrls: unique(asset.sourceUrls),
        wpMediaId: media?.id || 0,
        title: decodeText(media?.title?.rendered || occurrences.find((item) => item.ownerTitle)?.ownerTitle || filenameTitle(asset.canonicalUrl)),
        alt: decodeText(media?.alt_text || ""),
        caption: textFromHtml(media?.caption?.rendered || ""),
        mimeType: media?.mime_type || guessMime(asset.canonicalUrl),
        width: media?.media_details?.width || 0,
        height: media?.media_details?.height || 0,
        date: media?.date || "",
        modified: media?.modified || "",
        link: media?.link || "",
        classification,
        occurrences
      };
    })
    .sort((a, b) => {
      if (a.classification.inPrimaryScope !== b.classification.inPrimaryScope) {
        return a.classification.inPrimaryScope ? -1 : 1;
      }
      return a.canonicalUrl.localeCompare(b.canonicalUrl);
    });
}

function dedupeOccurrences(occurrences) {
  const seen = new Set();
  const result = [];
  for (const occurrence of occurrences) {
    const key = [
      occurrence.section,
      occurrence.source,
      occurrence.ownerType,
      occurrence.ownerId || "",
      occurrence.ownerSlug || "",
      occurrence.ownerUrl || "",
      occurrence.imageIndex,
      occurrence.sourceUrl
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(occurrence);
  }
  return result;
}

function classifyAsset({ occurrences }) {
  const sections = new Set(occurrences.map((item) => item.section));
  const primary = occurrences.some((item) => item.inPrimaryScope);

  if (sections.has("photoworks.vc_media_grid")) {
    return { kind: "photowork", scope: "primary", confidence: "high", inPrimaryScope: true };
  }
  if (sections.has("artwork.detail")) {
    return { kind: "artwork_detail_image", scope: "primary", confidence: "high", inPrimaryScope: true };
  }
  if (sections.has("artwork.detail_html_reference")) {
    return { kind: "artwork_detail_html_extra_reference", scope: "primary_reference_review", confidence: "medium", inPrimaryScope: false };
  }
  if (sections.has("works.archive")) {
    return { kind: "artwork_archive_thumbnail", scope: "primary", confidence: "medium", inPrimaryScope: true };
  }
  if (sections.has("home.envira_lenta")) {
    return { kind: "home_artwork_feed_item", scope: "primary", confidence: "medium", inPrimaryScope: true };
  }
  if (sections.has("home.page_html")) {
    return { kind: "home_page_visual_asset", scope: "primary", confidence: "medium", inPrimaryScope: true };
  }
  if (sections.has("shop.product")) {
    return { kind: "shop_product_or_demo_asset", scope: "public_secondary", confidence: "medium", inPrimaryScope: false };
  }
  if (Array.from(sections).some((section) => section.startsWith("demo."))) {
    return { kind: "theme_demo_or_shortcode_asset", scope: "public_demo", confidence: "high", inPrimaryScope: false };
  }
  if (!primary && sections.has("wp.media_library_unreferenced")) {
    return { kind: "unreferenced_media_attachment", scope: "rest_media_library", confidence: "medium", inPrimaryScope: false };
  }
  return { kind: "unclassified_public_upload", scope: primary ? "primary" : "public_secondary", confidence: "low", inPrimaryScope: primary };
}

function sourceTextForPortfolio(portfolio) {
  return (
    portfolio.aioseo_head_json?.["og:description"] ||
    portfolio.aioseo_head_json?.description ||
    textFromHtml(portfolio.content?.rendered || "")
  );
}

function classifyArtworkObject(medium) {
  const normalized = medium.toLocaleLowerCase("ru-RU");
  if (/бумага|акварель|тушь|гуашь|пастель/.test(normalized)) return "work_on_paper";
  if (/холст|масло|акрил|темпера|картон/.test(normalized)) return "painting_or_mixed_media";
  return "unknown_artwork_object";
}

function sanitizeDescription(description) {
  return stripNavigationNoise(description || "")
    .replace(/\s+/g, " ")
    .replace(/^[.,;:\s]+|[.,;:\s]+$/g, "")
    .trim();
}

function completeness(fields) {
  const required = ["title", "year", "medium", "dimensions", "images"];
  const missing = required.filter((field) => !fields[field]);
  return {
    required,
    missing,
    score: Number(((required.length - missing.length) / required.length).toFixed(2))
  };
}

function artworkNotes(slug, title, details, images) {
  const notes = [];
  if (!details.year) notes.push("year_missing");
  if (!details.medium) notes.push("medium_missing");
  if (!details.dimensions) notes.push("dimensions_missing");
  if (images.length === 0) notes.push("images_missing");
  if (slug === "dver" && title === "Ожидание") notes.push("slug_title_mismatch_dver_title_ozhidanie");
  if (slug === "s-kraskami" && title === "9 мая") notes.push("slug_title_mismatch_s_kraskami_title_9_maya");
  if (/мнгнов/i.test(title)) notes.push("source_title_typo_mngnovenie");
  return notes;
}

function classifyHomeGallery(homeHtml, assetMap) {
  const images = parseEnviraImages(homeHtml).map((image, index) => {
    const sourceUrl = normalizeUrl(image.sourceUrl);
    const title =
      [image.title, image.caption, image.alt]
        .map((value) => contentTitleFromMedia(value || ""))
        .find(Boolean) || "";
    const year = title.match(/((?:19|20)\d{2})/)?.[1] || "";
    const kind = "home_artwork_feed_item";
    registerAsset(assetMap, sourceUrl, {
      section: "home.envira_lenta",
      source: "home-html-envira-data-gallery-images",
      ownerType: "envira_gallery",
      ownerId: image.id || 0,
      ownerSlug: "lenta-na-glavnoj",
      ownerTitle: "Лента на главной",
      ownerUrl: `${WORDPRESS_BASE_URL}/envira/lenta-na-glavnoj/`,
      imageIndex: index,
      role: kind,
      inPrimaryScope: true
    });

    return {
      index,
      wpMediaId: image.id || 0,
      sourceUrl,
      canonicalUrl: canonicalUploadUrl(sourceUrl),
      title,
      alt: image.alt || "",
      caption: image.caption || "",
      year,
      kind,
      source: "Envira data-gallery-images on home page"
    };
  });

  return {
    title: "Лента на главной",
    sourcePageUrl: `${WORDPRESS_BASE_URL}/`,
    sourceGalleryUrl: `${WORDPRESS_BASE_URL}/envira/lenta-na-glavnoj/`,
    images
  };
}

function classifyPageUploadReferences({ html, sourcePageUrl, section, assetMap, knownUrls = new Set() }) {
  const urls = extractImageUrlsFromHtml(html).filter((url) => !knownUrls.has(canonicalUploadUrl(url)));
  return unique(urls).map((sourceUrl, index) => {
    const context = contextForPageUrl(sourcePageUrl);
    registerAsset(assetMap, sourceUrl, {
      section,
      source: "live-page-html-upload-reference",
      ownerType: context.ownerType,
      ownerSlug: context.ownerSlug,
      ownerTitle: context.ownerTitle,
      ownerUrl: sourcePageUrl,
      imageIndex: index,
      role: section === "works.archive_html" ? "archive_or_listing_image" : "page_visual_reference",
      inPrimaryScope: true
    });
    return {
      index,
      sourceUrl: normalizeUrl(sourceUrl),
      canonicalUrl: canonicalUploadUrl(sourceUrl),
      role: section === "works.archive_html" ? "archive_or_listing_image" : "page_visual_reference"
    };
  });
}

async function classifyPhotoWorks(photoWorksPage, mediaIndex, assetMap) {
  const html = photoWorksPage?.content?.rendered || "";
  const ids = parseVcIncludeIds(html).filter((id) => id >= 15000);
  const images = ids
    .map((id, index) => {
      const media = mediaIndex.all.find((item) => item.id === id);
      if (!media) return null;
      registerAsset(assetMap, media.source_url, {
        section: "photoworks.vc_media_grid",
        source: "photoWorks-page-vc-masonry-media-grid-include",
        ownerType: "page",
        ownerId: PAGE_IDS.photoWorks,
        ownerSlug: "masterskaya-nikity-pichugina",
        ownerTitle: "Фотоработы Никиты Пичугина",
        ownerUrl: `${WORDPRESS_BASE_URL}/masterskaya-nikity-pichugina/`,
        imageIndex: index,
        role: "photowork",
        inPrimaryScope: true
      });
      return {
        index,
        wpMediaId: id,
        sourceUrl: normalizeUrl(media.source_url),
        canonicalUrl: canonicalUploadUrl(media.source_url),
        title: decodeText(media.title?.rendered || media.slug),
        alt: decodeText(media.alt_text || ""),
        caption: textFromHtml(media.caption?.rendered || ""),
        width: media.media_details?.width || 0,
        height: media.media_details?.height || 0,
        date: media.date || "",
        modified: media.modified || ""
      };
    })
    .filter(Boolean);

  return {
    title: "Фотоработы Никиты Пичугина",
    sourcePageUrl: `${WORDPRESS_BASE_URL}/masterskaya-nikity-pichugina/`,
    intro: extractPhotoIntro(html),
    includeIds: ids,
    images
  };
}

function extractPhotoIntro(restHtml) {
  return textFromHtml(restHtml)
    .replace(/^.*?Фотоработы\s*/i, "")
    .replace(/\bvc_gid:[^\s]+/gi, " ")
    .replace(/\b\d{5}(?:,\d{5})+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=\.)\s+/)
    .map((sentence) => stripNavigationNoise(sentence).trim())
    .filter((sentence) => sentence.length > 24)
    .slice(0, 3);
}

function classifyProduct(product, assetMap, sitemapEntry) {
  const urls = uniqueByCanonical([
    ...extractImageUrlsFromHtml(`${product.content?.rendered || ""} ${product.excerpt?.rendered || ""}`),
    ...(sitemapEntry?.images || [])
  ]);
  for (const [index, sourceUrl] of urls.entries()) {
    registerAsset(assetMap, sourceUrl, {
      section: "shop.product",
      source: "product-rest-content-or-product-sitemap",
      ownerType: "product",
      ownerId: product.id,
      ownerSlug: product.slug,
      ownerTitle: decodeText(product.title?.rendered),
      ownerUrl: product.link,
      imageIndex: index,
      role: "product_image",
      inPrimaryScope: false
    });
  }
  return {
    wpId: product.id,
    slug: product.slug,
    title: decodeText(product.title?.rendered),
    sourcePageUrl: product.link,
    modified: product.modified || "",
    classification: "shop_or_theme_demo_product",
    inPrimaryScope: false,
    images: unique(urls).map((sourceUrl, index) => ({
      index,
      sourceUrl: normalizeUrl(sourceUrl),
      canonicalUrl: canonicalUploadUrl(sourceUrl)
    }))
  };
}

function contextForPageUrl(pageUrl) {
  const url = normalizeUrl(pageUrl);
  const pathname = new URL(url).pathname;
  if (url === `${WORDPRESS_BASE_URL}/`) {
    return {
      section: "home.page",
      ownerType: "page",
      ownerId: PAGE_IDS.home,
      ownerSlug: "home",
      ownerTitle: "Главная страница",
      role: "home_page_sitemap_image",
      inPrimaryScope: true
    };
  }
  if (pathname === "/envira/lenta-na-glavnoj/") {
    return {
      section: "home.envira_lenta",
      ownerType: "envira_gallery",
      ownerSlug: "lenta-na-glavnoj",
      ownerTitle: "Лента на главной",
      role: "envira_gallery_image",
      inPrimaryScope: true
    };
  }
  if (pathname === "/portfolio/galereya-rabot-hudozhnika-nikity-pichugina/") {
    return {
      section: "works.archive",
      ownerType: "page",
      ownerId: PAGE_IDS.worksArchive,
      ownerSlug: "galereya-rabot-hudozhnika-nikity-pichugina",
      ownerTitle: "Галерея работ художника Никиты Пичугина",
      role: "works_archive_thumbnail",
      inPrimaryScope: true
    };
  }
  if (pathname === "/masterskaya-nikity-pichugina/") {
    return {
      section: "photoworks.page",
      ownerType: "page",
      ownerId: PAGE_IDS.photoWorks,
      ownerSlug: "masterskaya-nikity-pichugina",
      ownerTitle: "Фотоработы Никиты Пичугина",
      role: "photoworks_page_sitemap_image",
      inPrimaryScope: true
    };
  }
  if (pathname.startsWith("/portfolios/")) {
    return {
      section: "artwork.detail",
      ownerType: "artwork",
      ownerSlug: pathname.replace(/^\/portfolios\//, "").replace(/\/$/, ""),
      ownerTitle: "",
      role: "artwork_detail_sitemap_image",
      inPrimaryScope: true
    };
  }
  if (pathname.startsWith("/product/")) {
    return {
      section: "shop.product",
      ownerType: "product",
      ownerSlug: pathname.replace(/^\/product\//, "").replace(/\/$/, ""),
      ownerTitle: "",
      role: "product_sitemap_image",
      inPrimaryScope: false
    };
  }
  if (isDemoOrSecondaryPage(pathname)) {
    return {
      section: "demo.theme_or_shortcode_page",
      ownerType: "page",
      ownerSlug: pathname.replace(/^\/|\/$/g, ""),
      ownerTitle: "",
      role: "theme_demo_sitemap_image",
      inPrimaryScope: false
    };
  }
  return {
    section: PRIMARY_SECTION_URLS.has(url) ? "primary.unknown_page" : "secondary.public_page",
    ownerType: "page",
    ownerSlug: pathname.replace(/^\/|\/$/g, "") || "home",
    ownerTitle: "",
    role: "public_page_sitemap_image",
    inPrimaryScope: PRIMARY_SECTION_URLS.has(url)
  };
}

function isDemoOrSecondaryPage(pathname) {
  return /^\/(?:shortcodes|portfolio\/(?!galereya-rabot-hudozhnika-nikity-pichugina)|home-ii|home-iii|landing|about-us-ii|blog|test|shop|cart|checkout|my-account|wishlist|contact-us|contacts|footer|footer-portfolio|coming-soon|not-found)\b/.test(
    pathname
  );
}

function buildSummary({
  sitemapEntries,
  pages,
  products,
  portfolios,
  media,
  artworks,
  homeGallery,
  homePageVisuals,
  worksArchiveImages,
  photoWorks,
  productsInventory,
  assets,
  restHeaderTotals
}) {
  const byKind = countBy(assets, (asset) => asset.classification.kind);
  const bySection = countOccurrencesBySection(assets);
  const primaryAssets = assets.filter((asset) => asset.classification.inPrimaryScope);
  const unreferenced = assets.filter((asset) => asset.classification.kind === "unreferenced_media_attachment");
  return {
    sourceCounts: {
      sitemapChildren: sitemapEntries.root.length,
      publicPagesRestHeaderTotal: restHeaderTotals.pages,
      publicPagesFetched: pages.length,
      publicProductsRestHeaderTotal: restHeaderTotals.product,
      publicProductsFetched: products.length,
      publicPortfolioEntriesRestHeaderTotal: restHeaderTotals.dt_portfolios,
      publicPortfolioEntriesFetched: portfolios.length,
      publicMediaAttachmentsRestHeaderTotal: restHeaderTotals.media,
      publicMediaAttachmentsFetched: media.length
    },
    primaryContentCounts: {
      artworks: artworks.length,
      artworkDetailImages: sum(artworks.map((artwork) => artwork.imageCount)),
      homeEnviraImages: homeGallery.images.length,
      homeExtraUploadReferences: homePageVisuals.length,
      worksArchiveUploadReferences: worksArchiveImages.length,
      photoWorks: photoWorks.images.length
    },
    secondaryContentCounts: {
      shopOrDemoProducts: productsInventory.length,
      shopOrDemoProductImages: sum(productsInventory.map((product) => product.images.length)),
      demoOrSecondaryPageImageOccurrences: sitemapEntries.pages
        .filter((entry) => isDemoOrSecondaryPage(new URL(entry.loc).pathname))
        .reduce((total, entry) => total + entry.images.length, 0)
    },
    classifiedAssets: {
      totalUniqueCanonicalUploads: assets.length,
      primaryScopeUniqueAssets: primaryAssets.length,
      unreferencedMediaAttachments: unreferenced.length,
      byKind,
      bySection
    },
    sourceWarnings: buildSourceWarnings({ artworks, photoWorks, pages, products, media, assets, restHeaderTotals })
  };
}

function buildSourceWarnings({ artworks, photoWorks, pages, products, media, assets, restHeaderTotals }) {
  const warnings = [];
  const duplicateTitles = duplicateValues(artworks.map((artwork) => artwork.title));
  for (const title of duplicateTitles) {
    warnings.push({
      code: "duplicate_artwork_title",
      severity: "high",
      detail: `Several dt_portfolios share title "${title}".`,
      affected: artworks.filter((artwork) => artwork.title === title).map((artwork) => artwork.slug)
    });
  }
  for (const artwork of artworks) {
    for (const note of artwork.notes) {
      warnings.push({
        code: note,
        severity: note.includes("mismatch") ? "medium" : "low",
        detail: `${artwork.slug}: ${artwork.title}`,
        affected: [artwork.slug]
      });
    }
  }
  if (photoWorks.images.length > 0) {
    warnings.push({
      code: "photoworks_not_visible_in_sitemap_images",
      severity: "medium",
      detail: "Photoworks are embedded as Visual Composer media IDs; page sitemap reports zero image entries.",
      affected: ["masterskaya-nikity-pichugina"]
    });
  }
  if (pages.length > 4 || products.length > 0) {
    warnings.push({
      code: "wp_contains_public_demo_shop_pages",
      severity: "medium",
      detail: `REST exposes ${pages.length} pages and ${products.length} products; most are theme demo/shop pages outside the artist-site primary scope.`,
      affected: ["wp/v2/pages", "wp/v2/product"]
    });
  }
  const unreferenced = assets.filter((asset) => asset.classification.kind === "unreferenced_media_attachment").length;
  if (unreferenced > 0) {
    warnings.push({
      code: "large_unreferenced_media_library",
      severity: "low",
      detail: `${unreferenced} media attachments are public through REST but were not referenced by primary pages or public sitemaps.`,
      affected: ["wp/v2/media"]
    });
  }
  if (restHeaderTotals.media && restHeaderTotals.media !== media.length) {
    warnings.push({
      code: "wp_media_rest_header_total_differs_from_fetchable_records",
      severity: "low",
      detail: `wp/v2/media reports ${restHeaderTotals.media} records in headers; paginated fetch returned source records separately in summary.`,
      affected: ["wp/v2/media"]
    });
  }
  return warnings;
}

function renderMarkdown(inventory) {
  const lines = [];
  lines.push("# Live WordPress Content Inventory");
  lines.push("");
  lines.push(`Generated: ${inventory.generatedAt}`);
  lines.push(`Source: ${inventory.source.wordpressBaseUrl}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("| --- | ---: |");
  for (const [key, value] of Object.entries(flattenCounts(inventory.summary))) {
    lines.push(`| ${escapeMd(key)} | ${value} |`);
  }
  lines.push("");
  lines.push("## Source Warnings");
  lines.push("");
  lines.push("| Severity | Code | Detail | Affected |");
  lines.push("| --- | --- | --- | --- |");
  for (const warning of inventory.summary.sourceWarnings) {
    lines.push(
      `| ${warning.severity} | ${escapeMd(warning.code)} | ${escapeMd(warning.detail)} | ${escapeMd(warning.affected.join(", "))} |`
    );
  }
  lines.push("");
  lines.push("## Artworks / Paintings");
  lines.push("");
  lines.push("| # | WP ID | Slug | Title | Type | Year | Medium | Dimensions | Images | Notes |");
  lines.push("| ---: | ---: | --- | --- | --- | --- | --- | --- | ---: | --- |");
  for (const artwork of inventory.artworks) {
    lines.push(
      `| ${artwork.order + 1} | ${artwork.wpId} | ${escapeMd(artwork.slug)} | ${escapeMd(artwork.title)} | ${escapeMd(artwork.objectType)} | ${escapeMd(artwork.year)} | ${escapeMd(artwork.medium)} | ${escapeMd(artwork.dimensions)} | ${artwork.imageCount} | ${escapeMd(artwork.notes.join(", "))} |`
    );
  }
  lines.push("");
  lines.push("## Home Envira Gallery");
  lines.push("");
  lines.push("| # | Media ID | Kind | Year | Title | URL |");
  lines.push("| ---: | ---: | --- | --- | --- | --- |");
  for (const image of inventory.homeGallery.images) {
    lines.push(
      `| ${image.index + 1} | ${image.wpMediaId} | ${escapeMd(image.kind)} | ${escapeMd(image.year)} | ${escapeMd(image.title)} | ${escapeMd(image.sourceUrl)} |`
    );
  }
  lines.push("");
  lines.push("## Photoworks");
  lines.push("");
  lines.push("| # | Media ID | Title | Size | URL |");
  lines.push("| ---: | ---: | --- | --- | --- |");
  for (const image of inventory.photoWorks.images) {
    lines.push(
      `| ${image.index + 1} | ${image.wpMediaId} | ${escapeMd(image.title)} | ${image.width}x${image.height} | ${escapeMd(image.sourceUrl)} |`
    );
  }
  lines.push("");
  lines.push("## Public Products / Demo Shop");
  lines.push("");
  lines.push("| WP ID | Slug | Title | Images | Scope |");
  lines.push("| ---: | --- | --- | ---: | --- |");
  for (const product of inventory.products) {
    lines.push(
      `| ${product.wpId} | ${escapeMd(product.slug)} | ${escapeMd(product.title)} | ${product.images.length} | ${product.inPrimaryScope ? "primary" : "secondary/demo"} |`
    );
  }
  lines.push("");
  lines.push(`Full asset-level classification is in \`${ASSETS_CSV}\` and \`${INVENTORY_JSON}\`.`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderAssetsCsv(assets) {
  const header = [
    "canonicalUrl",
    "wpMediaId",
    "kind",
    "scope",
    "inPrimaryScope",
    "confidence",
    "title",
    "width",
    "height",
    "sections",
    "owners",
    "sourceUrls"
  ];
  const rows = assets.map((asset) => [
    asset.canonicalUrl,
    asset.wpMediaId,
    asset.classification.kind,
    asset.classification.scope,
    asset.classification.inPrimaryScope,
    asset.classification.confidence,
    asset.title,
    asset.width,
    asset.height,
    unique(asset.occurrences.map((item) => item.section)).join(";"),
    unique(asset.occurrences.map((item) => item.ownerSlug || item.ownerTitle || item.ownerUrl).filter(Boolean)).join(";"),
    asset.sourceUrls.join(";")
  ]);
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function flattenCounts(summary) {
  const result = {};
  for (const [group, values] of Object.entries(summary)) {
    if (group === "sourceWarnings") continue;
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "object" && value !== null) {
        for (const [subKey, subValue] of Object.entries(value)) {
          result[`${group}.${key}.${subKey}`] = subValue;
        }
      } else {
        result[`${group}.${key}`] = value;
      }
    }
  }
  return result;
}

function countBy(items, getKey) {
  return items.reduce((accumulator, item) => {
    const key = getKey(item);
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function countOccurrencesBySection(assets) {
  const counts = {};
  for (const asset of assets) {
    for (const occurrence of asset.occurrences) {
      counts[occurrence.section] = (counts[occurrence.section] || 0) + 1;
    }
  }
  return counts;
}

function duplicateValues(values) {
  const counts = countBy(values, (value) => value);
  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function uniqueByCanonical(urls) {
  const seen = new Set();
  const result = [];
  for (const url of urls.filter(Boolean)) {
    const canonical = canonicalUploadUrl(url);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    result.push(normalizeUrl(url));
  }
  return result;
}

function canonicalUploadUrl(url) {
  const normalized = normalizeUrl(url).replace(/\?.*$/, "");
  return normalized.replace(/-\d{2,5}x\d{2,5}(?=\.(?:jpe?g|png|gif|webp)$)/i, "");
}

function normalizeUrl(url = "") {
  const decoded = decodeText(url).replaceAll("\\/", "/").replace(/^http:\/\//, "https://");
  try {
    const parsed = new URL(decoded, WORDPRESS_BASE_URL);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return decoded;
  }
}

function filenameTitle(url) {
  return decodeURIComponent(normalizeUrl(url).split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
}

function guessMime(url) {
  if (/\.png$/i.test(url)) return "image/png";
  if (/\.webp$/i.test(url)) return "image/webp";
  if (/\.gif$/i.test(url)) return "image/gif";
  return "image/jpeg";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMd(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
