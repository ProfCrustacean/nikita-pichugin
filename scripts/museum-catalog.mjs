import { createHash } from "node:crypto";
import path from "node:path";
import * as cheerio from "cheerio";
import sharp from "sharp";
import { decodeText } from "./wordpress-content.mjs";
import { SCHEMA_VERSION } from "./museum-schema.mjs";

export const TECHNICAL_LABEL_RE = /^(?:photo|img|dsc|image|pxl|mvimg)(?:[_-]|\d|$)/i;
export const DATE_FILENAME_RE = /^(?:19|20)\d{2}[-_.]\d{1,2}[-_.]\d{1,2}(?:[ _-]\d{1,2}[.:_-]\d{1,2})?/i;

const TITLE_TRANSLATIONS = new Map(
  Object.entries({
    "9 мая": "9 May",
    "Апрель. Тавла": "April. Tavla",
    "Абстрактная композиция": "Abstract Composition",
    "Бабье лето": "Indian Summer",
    "Банька": "Bathhouse",
    "Банька по черному": "Black-Smoke Bathhouse",
    "Берёзовый ситец": "Birch Chintz",
    "Бесконечность": "Infinity",
    "Болдино": "Boldino",
    "Бузина": "Elderberry",
    "В тишине": "In Silence",
    "Весенний день": "Spring Day",
    "Весенний вечер": "Spring Evening",
    "Весенний звон": "Spring Chimes",
    "Весенняя лазурь": "Spring Azure",
    "Весна": "Spring",
    "Весна в Макаровке": "Spring in Makarovka",
    "Весна в Палехе": "Spring in Palekh",
    "Весна в Тавле": "Spring in Tavla",
    "Весна в Юрьевце": "Spring in Yuryevets",
    "Весна в с. Тавла": "Spring in the Village of Tavla",
    "Весна за окном": "Spring Outside the Window",
    "Весна звенит": "Spring Is Ringing",
    "Вербное Воскресенье": "Palm Sunday",
    "Вербное воскресение": "Palm Sunday",
    "Вечерний звон": "Evening Bells",
    "Время застыло": "Time Stood Still",
    "Воскресный день в Коломне": "Sunday in Kolomna",
    "Выход": "Exit",
    "Гурзуф": "Gurzuf",
    "Дары лета": "Gifts of Summer",
    "Дыхание весны": "Breath of Spring",
    "Дыхание лета": "Breath of Summer",
    "Догорает день": "The Day Is Fading",
    "Дубовая роща": "Oak Grove",
    "Дунилово": "Dunilovo",
    "Заволжье": "The Trans-Volga Region",
    "Закат в Домнино": "Sunset in Domnino",
    "Замоскворечье": "Zamoskvorechye",
    "Запахи весны": "Scents of Spring",
    "Зимнее безмолвие": "Winter Silence",
    "Зимние хризантемы": "Winter Chrysanthemums",
    "Зимняя дорога": "Winter Road",
    "Зимний пейзаж": "Winter Landscape",
    "Из прошлого": "From the Past",
    "Июль": "July",
    "Калина красная": "Red Viburnum",
    "Капель": "Thaw Drip",
    "Клуб строителей": "Builders' Club",
    "Конец марта": "End of March",
    "Краски осени": "Colors of Autumn",
    "Крещенские морозы": "Epiphany Frosts",
    "Крещенское утро в Коломне": "Epiphany Morning in Kolomna",
    "Кубышки": "Yellow Water Lilies",
    "Кувшинки": "Water Lilies",
    "Лапти": "Bast Shoes",
    "Летний вечер в Юрьевце": "Summer Evening in Yuryevets",
    "Летний день": "Summer Day",
    "Лето в Тавле": "Summer in Tavla",
    "Листопад": "Falling Leaves",
    "Львовка. Усадьба Пушкиных": "Lvovka. The Pushkin Estate",
    "Март": "March",
    "Меланхолия": "Melancholy",
    "Мир мастерской": "The World of the Studio",
    "Мой номер 35": "My Number 35",
    "Мост в Палехе": "Bridge in Palekh",
    "Мостик": "Footbridge",
    "На закате дня": "At Sunset",
    "На мгновенье стало тихо": "For a Moment It Became Quiet",
    "На мнгновенье стало тихо": "For a Moment It Became Quiet",
    "На утро выпал снег": "Snow Fell by Morning",
    "Надвигается гроза": "A Storm Approaches",
    "Нарциссы": "Daffodils",
    "Натюрморт с гранатом": "Still Life with Pomegranate",
    "Натюрморт с пионами": "Still Life with Peonies",
    "Натюрморт с сиренью": "Still Life with Lilacs",
    "Начало весны": "Early Spring",
    "Ночной дозор": "Night Watch",
    "Облепиха": "Sea Buckthorn",
    "Ожидание": "Waiting",
    "Осеннее безмолвие": "Autumn Silence",
    "Опавших листьев покрывало": "A Blanket of Fallen Leaves",
    "Осенние солнце": "Autumn Sun",
    "Осенняя симфония": "Autumn Symphony",
    "Осень на суре": "Autumn on the Sura",
    "Отражение": "Reflection",
    "Первый снег": "First Snow",
    "Пионы": "Peonies",
    "Повеяло весной": "A Hint of Spring",
    "Повеяло теплом": "Warmth in the Air",
    "Погост": "Churchyard",
    "Полдень": "Midday",
    "Полевой букет": "Wildflower Bouquet",
    "Пора дождей": "Rainy Season",
    "Пора сирени": "Lilac Season",
    "Предчувствие": "Premonition",
    "Пробуждение": "Awakening",
    "Проталины": "Thaw Patches",
    "Разлив на Инсаре": "Flood on the Insar",
    "Река Cура": "Sura River",
    "Река Люлех": "Lyulekh River",
    "Родное окно": "Familiar Window",
    "Русский пейзаж. Домнино": "Russian Landscape. Domnino",
    "Рябиновый звон": "Rowan Chimes",
    "Рябиновый цвет": "Rowan Blossom",
    "Салют осени": "Salute to Autumn",
    "Саранска": "Saranska",
    "Саранский дворик": "Saransk Courtyard",
    "Сентябрь": "September",
    "Сирень": "Lilacs",
    "Сквозь пыльное стекло": "Through the Dusty Glass",
    "Снег сошел": "The Snow Has Melted",
    "Солнце Августа": "August Sun",
    "Средиземное море": "Mediterranean Sea",
    "Старая деревня": "Old Village",
    "Старая усадьба": "Old Estate",
    "Старинный дом в Дунилово": "Old House in Dunilovo",
    "Стынет": "Growing Cold",
    "Тает снег": "The Snow Is Melting",
    "Талая вода": "Meltwater",
    "Тихий омут": "Still Waters",
    "Тёплый день": "Warm Day",
    "Улица Саранская": "Saranskaya Street",
    "Утро августа": "August Morning",
    "Утро в мастерской": "Morning in the Studio",
    "Утро в мастерской художника": "Morning in the Artist's Studio",
    "Утро сентября": "September Morning",
    "Уходит век": "The Passing Century",
    "Уходит осень": "Autumn Is Leaving",
    "Февральская лазурь": "February Azure",
    "Февральский снег": "February Snow",
    "Хризантемы": "Chrysanthemums",
    "Цветут сады": "Orchards in Bloom",
    "Черёмуха": "Bird Cherry",
    "Шум берёз": "Rustle of Birches",
    "Шуя": "Shuya",
    "Эдюд": "Study",
    "Этюд": "Study",
    "Юрьевец": "Yuryevets",
    "Яблочный спас": "Apple Feast of the Saviour"
  })
);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableId(prefix, value) {
  return `${prefix}_${sha256(value).slice(0, 16)}`;
}

export function normalizeUrl(value = "") {
  try {
    const url = new URL(decodeText(value).replaceAll("\\/", "/").replace(/^http:\/\//i, "https://"));
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

export function canonicalDerivativeUrl(value = "") {
  const normalized = normalizeUrl(value);
  return normalized.replace(/-\d+x\d+(?=\.[a-z0-9]+(?:\?|$))/i, "");
}

export function isTechnicalLabel(value = "") {
  return TECHNICAL_LABEL_RE.test(decodeText(value));
}

export function labelKind(value = "") {
  const label = decodeText(value);
  if (!label) return "missing";
  if (isTechnicalLabel(label)) return "technical_filename";
  if (DATE_FILENAME_RE.test(label)) return "date_filename";
  return "source_caption";
}

export function parseFilenameDateCandidate(value = "") {
  const label = decodeText(value);
  const match = label.match(/((?:19|20)\d{2})[-_.](\d{1,2})[-_.](\d{1,2})(?:[ _-](\d{1,2})[.:_-](\d{1,2})(?:[.:_-](\d{1,2}))?)?/);
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
  const date = new Date(`${iso}Z`);
  return Number.isNaN(date.valueOf()) ? null : iso;
}

export function parseMuseumLabel(rawValue = "") {
  const raw = decodeText(rawValue);
  const kind = labelKind(raw);
  const technical = kind === "technical_filename" || kind === "date_filename";
  const filenameDateCandidate = technical ? parseFilenameDateCandidate(raw) : null;

  const dimensionsMatch = raw.match(/(\d{1,3}(?:[.,]\d+)?)\s*[xх×]\s*(\d{1,3}(?:[.,]\d+)?)(?:\s*[xх×]\s*(\d{1,3}(?:[.,]\d+)?))?/i);
  const values = dimensionsMatch
    ? dimensionsMatch.slice(1, 4).filter(Boolean).map((value) => Number(value.replace(",", ".")))
    : [];
  const dimensionsDisplay = dimensionsMatch ? dimensionsMatch[0].replace(/[xх×]/gi, " × ").replace(/\s+/g, " ") : null;

  const yearMatches = [...raw.matchAll(/\b((?:19|20)\d{2})\s*г?\.?/gi)].map((match) => Number(match[1]));
  const creationYear = technical ? null : yearMatches.at(-1) || null;

  const normalizedAbbreviations = raw
    .replace(/(^|[^а-яё])х\s*[./]\s*м\.?(?=$|[^а-яё])/giu, "$1холст, масло")
    .replace(/(^|[^а-яё])к\s*[./]\s*м\.?(?=$|[^а-яё])/giu, "$1картон, масло")
    .replace(/(^|[^а-яё])б\s*[./]\s*т\.?(?=$|[^а-яё])/giu, "$1бумага, тушь");
  const mediumTokens = [
    "холст",
    "картон",
    "бумага",
    "оргалит",
    "дерево",
    "масло",
    "акрил",
    "темпера",
    "акварель",
    "тушь",
    "гуашь",
    "пастель",
    "уголь",
    "карандаш"
  ];
  const foundMaterials = mediumTokens.filter((token) => new RegExp(`(^|[^а-яё])${token}(?=$|[^а-яё])`, "iu").test(normalizedAbbreviations));
  const support = foundMaterials.find((token) => ["холст", "картон", "бумага", "оргалит", "дерево"].includes(token)) || null;
  const techniques = foundMaterials.filter((token) => !["холст", "картон", "бумага", "оргалит", "дерево"].includes(token));
  const materialsDisplay = foundMaterials.length
    ? foundMaterials.map((token, index) => (index === 0 ? capitalize(token) : token)).join(", ")
    : null;

  let title = null;
  if (!technical) {
    const quoted = raw.match(/[«"]\s*([^»"]+?)\s*[»"]/);
    if (quoted) {
      title = decodeText(quoted[1]);
    } else {
      let prefix = raw;
      const boundaries = [
        dimensionsMatch?.index,
        raw.search(/\b(?:19|20)\d{2}\b/),
        raw.search(/\b(?:холст|картон|бумага|оргалит|дерево|масло|акрил|темпера|акварель|тушь|гуашь|пастель)\b/i),
        raw.search(/\b[хкб]\s*[./]\s*[мт]\.?\b/i)
      ].filter((value) => Number.isInteger(value) && value >= 0);
      if (boundaries.length) prefix = raw.slice(0, Math.min(...boundaries));
      prefix = prefix.replace(/^[«"'\s]+|[»"'.,;:\s]+$/g, "").trim();
      if (prefix && !/^\d/.test(prefix)) title = prefix;
    }
  }

  return {
    raw,
    labelKind: kind,
    title,
    creationYear,
    filenameDateCandidate,
    materials: {
      display: materialsDisplay,
      support,
      techniques
    },
    dimensions: {
      display: dimensionsDisplay,
      values,
      unit: dimensionsMatch ? "cm" : null,
      axisOrder: "source_order_unknown"
    }
  };
}

export function parseAjaxGridItems(html = "") {
  const $ = cheerio.load(html);
  const items = [];
  $(".vc_grid-item").each((index, element) => {
    const node = $(element);
    const link = node.find("a[href*='/wp-content/uploads/']").first();
    const image = node.find("img").first();
    const rawLabel = decodeText(node.find("h4").first().text() || link.attr("title") || image.attr("alt") || "");
    const discoveredUrl = normalizeUrl(link.attr("href") || image.attr("src") || "");
    if (discoveredUrl) items.push({ index, rawLabel, discoveredUrl });
  });
  return items;
}

export function parseGridRequests(homeHtml = "") {
  const $ = cheerio.load(homeHtml);
  return $(".vc_masonry_media_grid")
    .toArray()
    .map((element, index) => {
      const node = $(element);
      let settings = {};
      try {
        settings = JSON.parse(node.attr("data-vc-grid-settings") || "{}");
      } catch {
        settings = {};
      }
      return {
        index,
        requestUrl: normalizeUrl(node.attr("data-vc-request") || ""),
        nonce: node.attr("data-vc-public-nonce") || "",
        postId: Number(node.attr("data-vc-post-id") || settings.page_id || 0),
        settings
      };
    });
}

export function makeGridRequestBody(request) {
  const params = new URLSearchParams();
  params.set("action", "vc_get_vc_grid_data");
  params.set("vc_action", "vc_get_vc_grid_data");
  params.set("tag", request.settings.tag || "vc_masonry_media_grid");
  params.set("data[visible_pages]", "5");
  for (const [key, value] of Object.entries(request.settings)) {
    params.set(`data[${key}]`, String(value));
  }
  params.set("vc_post_id", String(request.postId));
  params.set("_vcnonce", request.nonce);
  return params;
}

export function translateTitleToEnglish(title = "") {
  const normalized = decodeText(title);
  if (TITLE_TRANSLATIONS.has(normalized)) return TITLE_TRANSLATIONS.get(normalized);
  const direct = [...TITLE_TRANSLATIONS.entries()].find(([key]) => key.toLocaleLowerCase("ru-RU") === normalized.toLocaleLowerCase("ru-RU"));
  if (direct) return direct[1];
  return transliterateRussian(normalized) || "Catalogued Work";
}

export function transliterateRussian(value = "") {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
  };
  return [...value]
    .map((character) => {
      const lower = character.toLocaleLowerCase("ru-RU");
      if (!(lower in map)) return character;
      const result = map[lower];
      return character === lower ? result : capitalize(result);
    })
    .join("");
}

export function fallbackDisplayTitle({ recordType }) {
  return recordType === "photographic_work"
    ? { ru: "Фотокомпозиция", en: "Photographic Composition" }
    : { ru: "Живописная композиция", en: "Painted Composition" };
}

export function inferSubjects(title = "", recordType = "artwork") {
  const normalized = title.toLocaleLowerCase("ru-RU");
  const genre = [];
  const general = [];
  const specific = [];
  let season = null;
  let timeOfDay = null;

  if (recordType === "photographic_work") {
    genre.push("photography");
    general.push("photographic work");
  } else {
    general.push("painting");
  }
  if (/натюрморт|букет|цвет|сирен|пион|нарцисс|хризантем|яблоч|дары лета|лапти/.test(normalized)) {
    genre.push("still life");
    specific.push("still life subject");
  }
  if (/пейзаж|весн|осен|зим|снег|река|сура|деревн|рощ|дорог|гроза|дожд|погост|юрьев|коломн|болдино|тавл|заволжь|март/.test(normalized)) {
    genre.push("landscape");
    specific.push("landscape subject");
  }
  if (/мастерск|окно|двер|комнат|интерьер/.test(normalized)) {
    genre.push("interior");
    specific.push("interior subject");
  }
  if (/весн|март/.test(normalized)) season = "spring";
  else if (/лет|август/.test(normalized)) season = "summer";
  else if (/осен|сентябр/.test(normalized)) season = "autumn";
  else if (/зим|снег|феврал|крещен/.test(normalized)) season = "winter";
  if (/утро/.test(normalized)) timeOfDay = "morning";
  else if (/полдень/.test(normalized)) timeOfDay = "midday";
  else if (/вечер|закат/.test(normalized)) timeOfDay = "evening";
  else if (/ноч/.test(normalized)) timeOfDay = "night";

  const unique = (values) => [...new Set(values)];
  return {
    genre: unique(genre.length ? genre : [recordType === "photographic_work" ? "photography" : "painting"]),
    general: unique(general),
    specific: unique(specific),
    depictedPeople: [],
    depictedPlaces: [],
    season,
    timeOfDay,
    keywords: unique([...genre, ...specific, ...(season ? [season] : []), ...(timeOfDay ? [timeOfDay] : [])]),
    provenance: makeProvenance({
      method: "cataloguer_supplied",
      confidence: specific.length ? "medium" : "low",
      reviewStatus: specific.length ? "verified" : "needs_review",
      sourceLabel: title || null
    })
  };
}

export function makeProvenance({ method, sourceUrl = null, sourceLabel = null, confidence = "high", reviewStatus = "verified" }) {
  return { method, sourceUrl, sourceLabel, confidence, reviewStatus };
}

export function makeUnknownHistory() {
  const unknown = (status = "needs_owner_input") => ({ status, value: null });
  return {
    condition: unknown("not_visible"),
    provenance: unknown(),
    currentOwner: unknown(),
    currentLocation: unknown(),
    exhibitions: unknown(),
    bibliography: unknown()
  };
}

export function makeUnknownRights() {
  const unknown = () => ({ status: "needs_owner_input", value: null });
  return {
    workCopyright: unknown(),
    imageCopyright: unknown(),
    creditLine: unknown(),
    usageTerms: unknown()
  };
}

export function makeDescription({ displayTitle, recordType, sourceTitle, supplied }) {
  if (recordType === "photographic_work") {
    return {
      ru: `Фотографическая работа Никиты Пичугина, каталогизированная под названием «${displayTitle.ru}».`,
      en: `A photographic work by Nikita Pichugin catalogued as “${displayTitle.en}”.`
    };
  }
  if (supplied) {
    return {
      ru: `Живописная работа Никиты Пичугина. Описательное название «${displayTitle.ru}» присвоено при каталогизации; авторское название на официальном сайте не указано.`,
      en: `A painting by Nikita Pichugin. The descriptive title “${displayTitle.en}” was supplied during cataloguing; no artist-given title is stated on the official website.`
    };
  }
  return {
    ru: `Живописная работа Никиты Пичугина «${sourceTitle}». Метаданные зафиксированы по подписи на официальном сайте художника.`,
    en: `A painting by Nikita Pichugin titled “${displayTitle.en}”. The metadata is based on the caption published on the artist’s official website.`
  };
}

export async function calculatePerceptualHash(buffer) {
  const { data } = await sharp(buffer).rotate().resize(9, 8, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const left = data[row * 9 + column];
      const right = data[row * 9 + column + 1];
      bits += left > right ? "1" : "0";
    }
  }
  return bits.match(/.{1,4}/g).map((chunk) => Number.parseInt(chunk, 2).toString(16)).join("");
}

export function hammingDistance(hashA, hashB) {
  if (!hashA || !hashB || hashA.length !== hashB.length) return Number.POSITIVE_INFINITY;
  const a = BigInt(`0x${hashA}`);
  const b = BigInt(`0x${hashB}`);
  let value = a ^ b;
  let count = 0;
  while (value > 0n) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

export function fileExtensionFor(mimeType, sourceUrl) {
  const byMime = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/tiff": ".tif",
    "image/gif": ".gif"
  };
  if (byMime[mimeType]) return byMime[mimeType];
  const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase();
  return /^\.(?:jpe?g|png|webp|tiff?|gif)$/.test(extension) ? extension.replace(".jpeg", ".jpg").replace(".tiff", ".tif") : ".img";
}

export function jsonLines(records) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

export function uniqueBy(values, getKey) {
  const seen = new Set();
  return values.filter((value) => {
    const key = getKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function xmlEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function baseRecord() {
  return { schemaVersion: SCHEMA_VERSION };
}

function capitalize(value = "") {
  return value ? `${value[0].toLocaleUpperCase("ru-RU")}${value.slice(1)}` : value;
}
