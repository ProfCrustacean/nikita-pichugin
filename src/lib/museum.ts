import { readFileSync } from "node:fs";
import path from "node:path";

export type MuseumStatus = "known" | "unknown" | "not_applicable" | "not_visible" | "needs_owner_input";

export interface MuseumAsset {
  assetId: string;
  sha256: string;
  originalPath: string;
  previewPath: string;
  sourceFilename: string;
  mimeType: string;
  byteSize: number;
  widthPx: number;
  heightPx: number;
  previewWidthPx: number;
  previewHeightPx: number;
  visualClass: string;
  reviewStatus: string;
}

interface Provenance {
  method: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  confidence: string;
  reviewStatus: string;
}

export interface MuseumTitle {
  text: string;
  language: "ru" | "en";
  type: "source_stated" | "cataloguer_supplied" | "translated" | "technical_identifier" | string;
  preferred: boolean;
  provenance: Provenance;
}

export interface MuseumRecordSource {
  sourcePageUrl: string;
  collection: string;
  rawLabel: string | null;
  wpMediaId: number | null;
  wpPortfolioId: number | null;
}

export interface MuseumWork {
  schemaVersion: string;
  workId: string;
  publicSlug: string;
  recordType: "artwork" | "photographic_work";
  objectWorkType: "painting" | "work on paper" | "photograph" | string;
  creator: {
    displayName: string;
    role: string;
  };
  titles: MuseumTitle[];
  displayTitle: { ru: string; en: string };
  creation: {
    displayDate: string | null;
    earliestYear: number | null;
    latestYear: number | null;
    dateQualifier: string | null;
    place: string | null;
    status: MuseumStatus;
  };
  capture: {
    displayDate: string | null;
    filenameDateCandidate: string | null;
    exifDate: string | null;
    status: MuseumStatus;
  };
  physicalDescription: {
    materialsTechniquesDisplay: string | null;
    support: string | null;
    techniques: string[];
    dimensions: {
      display: string | null;
      values: number[];
      unit: string | null;
      status: MuseumStatus;
    };
    status: MuseumStatus;
  };
  subjects: {
    genre: string[];
    general: string[];
    specific: string[];
    depictedPeople: string[];
    depictedPlaces: string[];
    season: string | null;
    timeOfDay: string | null;
    keywords: string[];
  };
  description: { ru: string; en: string };
  inscriptions: Array<Record<string, unknown>>;
  history: Record<string, { status: MuseumStatus; value: unknown }>;
  rights: Record<string, { status: MuseumStatus; value: unknown }>;
  assetIds: string[];
  relatedWorkIds: string[];
  recordSource: MuseumRecordSource[];
  fieldStatus: Record<string, MuseumStatus>;
  qualityControl: {
    completenessScore: number;
    reviewStatus: string;
    warnings: string[];
  };
}

interface MuseumSiteContent {
  brand: { ru: string; en: string };
  introduction: { ru: string; en: string };
  photoWorksIntroduction: string;
  exhibitionTourUrl: string;
  contact: {
    phone: string;
    phoneHref: string;
    email: string;
    vk: string;
    telegram: string;
  };
  portraitAssetId: string;
}

const projectRoot = process.cwd();

function readJsonLines<T>(relativePath: string): T[] {
  return readFileSync(path.join(projectRoot, relativePath), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

const works = readJsonLines<MuseumWork>("content-export/data/works.jsonl");
const assets = readJsonLines<MuseumAsset>("content-export/data/assets.jsonl");
export const museumSiteContent = JSON.parse(
  readFileSync(path.join(projectRoot, "content-export/data/site-content.json"), "utf8")
) as MuseumSiteContent;
const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
const workById = new Map(works.map((work) => [work.workId, work]));
const workBySlug = new Map(works.map((work) => [work.publicSlug, work]));
const artworkTitleCounts = new Map<string, number>();
for (const work of works) {
  if (work.recordType !== "artwork") continue;
  artworkTitleCounts.set(work.displayTitle.ru, (artworkTitleCounts.get(work.displayTitle.ru) ?? 0) + 1);
}

export const museumWorks = works;
export const museumAssets = assets;
export const artworkWorks = works.filter((work) => work.recordType === "artwork");
export const observationWorks = works.filter((work) => work.recordType === "photographic_work");

export function getWorkById(workId: string): MuseumWork | undefined {
  return workById.get(workId);
}

export function getWorkBySlug(slug: string): MuseumWork | undefined {
  return workBySlug.get(slug);
}

export function getWorkAssets(work: MuseumWork): MuseumAsset[] {
  return work.assetIds.map((assetId) => assetById.get(assetId)).filter(Boolean) as MuseumAsset[];
}

export function getAssetById(assetId: string): MuseumAsset | undefined {
  return assetById.get(assetId);
}

export function getPrimaryAsset(work: MuseumWork): MuseumAsset {
  const workAssets = getWorkAssets(work);
  const preferredClass = work.recordType === "photographic_work"
    ? "photographic_work"
    : "artwork_reproduction";
  const primary = workAssets.find((asset) => asset.visualClass === preferredClass);
  if (!primary) throw new Error(`${work.workId} has no ${preferredClass} primary asset`);
  return primary;
}

export function getPreviewPath(asset: MuseumAsset): string {
  return `/museum/previews/${path.basename(asset.previewPath)}`;
}

export function getWorkHref(work: MuseumWork): string {
  return `/works/${work.publicSlug}/`;
}

export function getWorkTitleType(work: MuseumWork): MuseumTitle["type"] {
  return work.titles.find((title) => title.language === "ru" && title.preferred)?.type ?? "cataloguer_supplied";
}

export function hasCataloguerDescriptiveTitle(work: MuseumWork): boolean {
  return getWorkTitleType(work) === "cataloguer_supplied" &&
    !work.titles.some((title) => title.language === "ru" && title.type === "source_stated");
}

export function getWorkCollections(work: MuseumWork): string[] {
  return Array.from(new Set(work.recordSource.map((source) => {
    if (source.collection === "home.feed") return "feed";
    if (source.collection.startsWith("home.archive")) return "archive";
    if (source.collection === "home.unsorted") return "unsorted";
    if (source.collection.startsWith("portfolio")) return "gallery";
    if (source.collection === "photoworks") return "observations";
    return source.collection;
  })));
}

export function getWorkDate(work: MuseumWork): string {
  if (work.creation.displayDate) return work.creation.displayDate;
  if (work.recordType === "photographic_work" && work.capture.displayDate) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date(work.capture.displayDate));
  }
  return work.recordType === "photographic_work"
    ? "Дата съёмки не установлена"
    : "Год не установлен";
}

export function getKnownWorkDate(work: MuseumWork): string | null {
  if (work.creation.displayDate) return work.creation.displayDate;
  if (work.recordType === "photographic_work" && work.capture.status === "known" && work.capture.displayDate) {
    return getWorkDate(work);
  }
  return null;
}

export function getWorkDateForSentence(work: MuseumWork): string | null {
  const date = getKnownWorkDate(work);
  return date?.replace(/\s+г\.$/u, " года") ?? null;
}

export function getWorkTypeLabel(work: MuseumWork): string {
  if (work.objectWorkType === "painting") return "Живопись";
  if (work.objectWorkType === "work on paper") return "Работа на бумаге";
  return "Фотокомпозиция";
}

export function getPublicTitle(work: MuseumWork): string {
  return work.recordType === "photographic_work" ? "Фотокомпозиция" : work.displayTitle.ru;
}

export function getPublicTitleEn(work: MuseumWork): string {
  return work.recordType === "photographic_work" ? "Photographic Composition" : work.displayTitle.en;
}

export function getPublicDescription(work: MuseumWork): string | null {
  const description = work.description?.ru?.trim();
  if (!description) return null;
  if (
    description.startsWith("Живописная работа Никиты Пичугина") ||
    description.startsWith("Фотографическая работа Никиты Пичугина") ||
    description.includes("Метаданные зафиксированы по подписи")
  ) {
    return null;
  }
  return description;
}

export function getWorkCardQualifier(work: MuseumWork): string | null {
  if (work.recordType !== "artwork" || (artworkTitleCounts.get(work.displayTitle.ru) ?? 0) < 2) return null;
  const parts = [
    work.physicalDescription.status === "known" ? work.physicalDescription.materialsTechniquesDisplay : null,
    work.physicalDescription.dimensions.status === "known" && work.physicalDescription.dimensions.display
      ? `${work.physicalDescription.dimensions.display}${work.physicalDescription.dimensions.unit === "cm" ? " см" : ""}`
      : null
  ].filter(Boolean);
  return parts.join(" · ") || null;
}

export function getWorkSearchText(work: MuseumWork): string {
  return [
    getPublicTitle(work),
    work.creation.displayDate,
    work.physicalDescription.materialsTechniquesDisplay,
    ...work.subjects.genre,
    ...work.subjects.specific,
    ...work.subjects.keywords
  ].filter(Boolean).join(" ").toLocaleLowerCase("ru-RU");
}

export function getAdjacentWork(work: MuseumWork): { previous?: MuseumWork; next?: MuseumWork } {
  const collection = work.recordType === "artwork" ? artworkWorks : observationWorks;
  const index = collection.findIndex((candidate) => candidate.workId === work.workId);
  return {
    previous: index > 0 ? collection[index - 1] : undefined,
    next: index >= 0 && index < collection.length - 1 ? collection[index + 1] : undefined
  };
}

export function getRelatedWorks(work: MuseumWork): MuseumWork[] {
  return work.relatedWorkIds.map((workId) => workById.get(workId)).filter(Boolean) as MuseumWork[];
}
