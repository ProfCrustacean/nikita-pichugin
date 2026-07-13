import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  OUTPUT_JSON,
  RAW_ROOT,
  WORDPRESS_BASE_URL,
  decodeText,
  extractImageUrlsFromHtml,
  fetchJson,
  fetchText,
  localizeImage,
  localizeImages,
  normalizePhone,
  parseArtworkDetails,
  parseEnviraImages,
  parseSitemapImages,
  parseVcIncludeIds,
  phoneHref,
  contentTitleFromMedia,
  stripNavigationNoise,
  textFromHtml,
  unique,
  writeJson
} from "./wordpress-content.mjs";

const PAGE_IDS = {
  home: 4,
  photoWorks: 7293,
  contact: 4547
};

const PORTRAIT_SOURCE_URL = `${WORDPRESS_BASE_URL}/wp-content/uploads/2024/06/photo_2024-06-21_21-32-35.jpg`;

const NAVIGATION = [
  { label: "Главная", href: "/" },
  { label: "Галерея", href: "/portfolio/galereya-rabot-hudozhnika-nikity-pichugina/" },
  { label: "Фотоработы", href: "/masterskaya-nikity-pichugina/" },
  { label: "Контакты", href: "/contact-info/" }
];

async function main() {
  console.log("[import-content] fetching WordPress content");
  const [home, photoWorksPage, contactPage, portfolios, entries, sitemapXml, homeHtml] = await Promise.all([
    fetchJson(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/pages/${PAGE_IDS.home}`),
    fetchJson(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/pages/${PAGE_IDS.photoWorks}`),
    fetchJson(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/pages/${PAGE_IDS.contact}`),
    fetchJson(
      `${WORDPRESS_BASE_URL}/wp-json/wp/v2/dt_portfolios?per_page=100&_fields=id,slug,title,content,portfolio_entries,aioseo_head_json,link`
    ),
    fetchJson(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/portfolio_entries?per_page=100&_fields=id,name,slug,count,link`),
    fetchText(`${WORDPRESS_BASE_URL}/dt_portfolios-sitemap.xml`),
    fetchText(`${WORDPRESS_BASE_URL}/`)
  ]);

  await mkdir(RAW_ROOT, { recursive: true });
  await writeFile(path.join(RAW_ROOT, "home.html"), homeHtml);
  await writeFile(path.join(RAW_ROOT, "dt_portfolios-sitemap.xml"), sitemapXml);
  await writeFile(path.join(RAW_ROOT, "portfolios.json"), `${JSON.stringify(portfolios, null, 2)}\n`);

  const entryYearById = new Map(entries.map((entry) => [entry.id, /^\d{4}$/.test(entry.name) ? entry.name : ""]));
  const sitemapImagesBySlug = parseSitemapImages(sitemapXml);

  const artworks = [];
  for (const [index, portfolio] of portfolios.entries()) {
    const title = decodeText(portfolio.title?.rendered);
    const sourceText =
      portfolio.aioseo_head_json?.["og:description"] ||
      portfolio.aioseo_head_json?.description ||
      textFromHtml(portfolio.content?.rendered || "");
    const taxonomyYear = (portfolio.portfolio_entries || []).map((id) => entryYearById.get(id)).find(Boolean) || "";
    const details = parseArtworkDetails({ title, text: sourceText, year: taxonomyYear });
    const schemaImage = portfolio.aioseo_head_json?.schema?.["@graph"]?.find((node) => node["@type"] === "WebPage")?.image?.url;
    const htmlImages = extractImageUrlsFromHtml(portfolio.content?.rendered || "");
    const imageUrls = unique([schemaImage, ...(sitemapImagesBySlug.get(portfolio.slug) || []), ...htmlImages]);
    const images = await localizeImages(imageUrls, "artworks", portfolio.slug);

    artworks.push({
      wpId: portfolio.id,
      slug: portfolio.slug,
      title,
      year: details.year,
      medium: details.medium,
      dimensions: details.dimensions,
      description: details.description,
      images,
      sourcePageUrl: portfolio.link || `${WORDPRESS_BASE_URL}/portfolios/${portfolio.slug}/`,
      order: index
    });
  }
  sanitizeArtworkDescriptions(artworks);

  const contact = parseContact(contactPage.content?.rendered || "", homeHtml);
  const photoWorks = await parsePhotoWorks(photoWorksPage.content?.rendered || "");
  const homeGallery = await parseHomeGallery(homeHtml);
  const portrait = await localizeImage({
    sourceUrl: PORTRAIT_SOURCE_URL,
    kind: "home-portrait",
    ownerSlug: "nikita-pichugin",
    index: 0,
    alt: "Никита Пичугин в мастерской",
    caption: "Портрет художника"
  });
  const intro = extractIntro(home.content?.rendered || "", homeHtml);
  const virtualTourPath = "/exhibitions/erzia/";

  const siteContent = {
    brand: {
      name: "Никита Пичугин",
      description: "Официальный сайт художника"
    },
    intro: {
      text: intro.text,
      englishText: intro.englishText,
      virtualTourPath
    },
    portrait,
    navigation: NAVIGATION,
    highlights: artworks.slice(0, 5).map((artwork) => artwork.slug),
    artworks,
    homeGallery,
    photoWorks,
    contact,
    source: {
      importedAt: new Date().toISOString(),
      wordpressBaseUrl: WORDPRESS_BASE_URL,
      pages: {
        home: `${WORDPRESS_BASE_URL}/`,
        homeGallery: `${WORDPRESS_BASE_URL}/`,
        works: `${WORDPRESS_BASE_URL}/portfolio/galereya-rabot-hudozhnika-nikity-pichugina/`,
        photoWorks: `${WORDPRESS_BASE_URL}/masterskaya-nikity-pichugina/`,
        contact: `${WORDPRESS_BASE_URL}/contact-info/`,
        portfoliosSitemap: `${WORDPRESS_BASE_URL}/dt_portfolios-sitemap.xml`
      }
    }
  };

  await writeJson(OUTPUT_JSON, siteContent);
  console.log(
    `[import-content] wrote ${OUTPUT_JSON}: ${artworks.length} artworks, ${homeGallery.images.length} home media, ${photoWorks.images.length} photoworks`
  );
}

function extractIntro(restHtml, fallbackHtml) {
  const text = textFromHtml(restHtml || fallbackHtml);
  const ru = text.match(/Здравствуйте![^.]+\. Добро пожаловать на мой сайт\./);
  const en = text.match(/Hello![^.]+\. Welcome to my website\./);
  return {
    text: ru?.[0] || "Здравствуйте! Меня зовут Никита Пичугин, я художник. Добро пожаловать на мой сайт.",
    englishText: en?.[0] || "Hello! My name is Nikita Pichugin, I am an artist. Welcome to my website."
  };
}

function parseContact(restHtml, fallbackHtml) {
  const html = restHtml || fallbackHtml;
  const text = textFromHtml(html);
  const phone = normalizePhone(text.match(/8\s*\(?927\)?\s*177[-\s]*68[-\s]*78/)?.[0] || "8 (927) 177-68-78");
  const email = decodeText(html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "x-tarmit@yandex.ru");
  const social = [];
  for (const [label, pattern] of [
    ["Вконтакте", /https:\/\/vk\.com\/[^"'\s<]+/],
    ["Telegram", /https:\/\/t\.me\/[^"'\s<]+/]
  ]) {
    const match = html.match(pattern);
    if (match) {
      social.push({ label, href: match[0] });
    }
  }

  return {
    description: "Контактная информация по вопросам организации выставок и приобретению работ.",
    phone,
    phoneHref: phoneHref(phone),
    email,
    emailHref: `mailto:${email}`,
    social
  };
}

function sanitizeArtworkDescriptions(artworks) {
  const titles = artworks.map((artwork) => artwork.title).filter(Boolean);

  for (const artwork of artworks) {
    let description = stripNavigationNoise(artwork.description || "")
      .replace(/(^|\s)года(?=$|[\s.!?])/gi, " ")
      .replace(/(^|\s)ода(?=$|[\s.!?])/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    for (const title of titles) {
      if (title === artwork.title) {
        continue;
      }
      const lowerTitle = title.toLocaleLowerCase("ru-RU");
      if (description.toLocaleLowerCase("ru-RU").startsWith(`${lowerTitle} `)) {
        description = description.slice(title.length).trim();
      }
    }

    artwork.description = description.replace(/^[.,;:\s]+|[.,;:\s]+$/g, "").replace(/\s+/g, " ").trim();
  }
}

async function parsePhotoWorks(restHtml) {
  const intro = extractPhotoIntro(restHtml);

  const ids = parseVcIncludeIds(restHtml).filter((id) => id >= 15000);
  const media = await fetchMediaByIds(ids);
  const images = [
    ...media.map((item) => ({
      sourceUrl: item.source_url,
      title: decodeText(item.title?.rendered || item.slug),
      alt: decodeText(item.alt_text || item.title?.rendered || ""),
      caption: textFromHtml(item.caption?.rendered || "")
    }))
  ];

  return {
    intro: unique(intro),
    images: await localizeImages(uniqueImages(images), "photoworks", "photoworks")
  };
}

function extractPhotoIntro(restHtml) {
  const text = textFromHtml(restHtml)
    .replace(/^.*?Фотоработы\s*/i, "")
    .replace(/света\s+Бесполезное/i, "света. Бесполезное")
    .replace(/\bvc_gid:[^\s]+/gi, " ")
    .replace(/\b\d{5}(?:,\d{5})+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = text
    .split(/(?<=\.)\s+|(?<=\!)\s+|(?<=\?)\s+/)
    .map((sentence) => stripNavigationNoise(sentence).replace(/[.;:\s]+$/g, ".").trim())
    .filter((sentence) => sentence.length > 24 && !/^\d/.test(sentence));

  const result = [];
  for (const sentence of sentences) {
    const normalized = sentence.replace(/\.$/, "").toLocaleLowerCase("ru-RU");
    if (result.some((existing) => existing.toLocaleLowerCase("ru-RU").includes(normalized))) {
      continue;
    }
    result.push(sentence);
  }

  return result.slice(0, 3);
}

async function parseHomeGallery(homeHtml) {
  const images = parseEnviraImages(homeHtml);
  const localized = [];

  for (const [index, image] of images.entries()) {
    const title =
      [image.title, image.caption, image.alt]
        .map((value) => contentTitleFromMedia(value || ""))
        .find(Boolean) || "";
    const sourceUrl = image.sourceUrl;
    const year = title.match(/((?:19|20)\d{2})/)?.[1] || "";
    const displayTitle = title;
    const caption = contentTitleFromMedia(image.caption || "");
    const asset = await localizeImage({
      sourceUrl,
      kind: "home-gallery",
      ownerSlug: "lenta-na-glavnoj",
      index,
      alt: title || "Лента на главной",
      caption
    });

    localized.push({
      ...asset,
      wpId: image.id || 0,
      title,
      displayTitle,
      year,
      kind: "artwork"
    });
  }

  return {
    title: "Лента на главной",
    summary: "25 изображений из публичной галереи художника.",
    images: localized
  };
}

async function fetchMediaByIds(ids) {
  const results = [];
  for (let start = 0; start < ids.length; start += 100) {
    const chunk = ids.slice(start, start + 100);
    if (chunk.length === 0) {
      continue;
    }
    const response = await fetchJson(
      `${WORDPRESS_BASE_URL}/wp-json/wp/v2/media?per_page=100&include=${chunk.join(",")}&_fields=id,slug,title,alt_text,caption,source_url,media_details`
    );
    results.push(...response);
  }
  const byId = new Map(results.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function uniqueImages(images) {
  const seen = new Set();
  return images.filter((image) => {
    if (!image.sourceUrl || seen.has(image.sourceUrl)) {
      return false;
    }
    seen.add(image.sourceUrl);
    return true;
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
