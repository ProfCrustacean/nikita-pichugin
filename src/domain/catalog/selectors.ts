import { getAsset, getWorkById, listWorks } from "./repository";
import type { AssetView, WorkDetail, WorkTitle } from "./model";

const allWorks = listWorks();
const artworkWorks = allWorks.filter((work) => work.recordType === "artwork");
const observationWorks = allWorks.filter((work) => work.recordType === "photographic_work");
const artworkTitleCounts = new Map<string, number>();
for (const work of artworkWorks) {
  artworkTitleCounts.set(work.displayTitle.ru, (artworkTitleCounts.get(work.displayTitle.ru) ?? 0) + 1);
}

export function getWorkAssets(work: WorkDetail): AssetView[] {
  return work.assetIds.map(getAsset).filter((asset): asset is AssetView => Boolean(asset));
}

export function getPrimaryAsset(work: WorkDetail): AssetView {
  const preferredClass = work.recordType === "photographic_work"
    ? "photographic_work"
    : "artwork_reproduction";
  const primary = getWorkAssets(work).find((asset) => asset.visualClass === preferredClass);
  if (!primary) throw new Error(`${work.workId} has no ${preferredClass} primary asset`);
  return primary;
}

export function getPreviewPath(asset: AssetView): string {
  const filename = asset.previewPath.slice(asset.previewPath.lastIndexOf("/") + 1);
  if (!filename) throw new Error(`${asset.assetId} has an invalid preview path`);
  return `/museum/previews/${filename}`;
}

export const getWorkHref = (work: WorkDetail): string => `/works/${work.publicSlug}/`;

export function getWorkTitleType(work: WorkDetail): WorkTitle["type"] {
  return work.titles.find((title) => title.language === "ru" && title.preferred)?.type ?? "cataloguer_supplied";
}

export function hasCataloguerDescriptiveTitle(work: WorkDetail): boolean {
  return getWorkTitleType(work) === "cataloguer_supplied" &&
    !work.titles.some((title) => title.language === "ru" && title.type === "source_stated");
}

export function getWorkCollections(work: WorkDetail): string[] {
  return Array.from(new Set(work.recordSource.map((source) => {
    if (source.collection === "home.feed") return "feed";
    if (source.collection.startsWith("home.archive")) return "archive";
    if (source.collection === "home.unsorted") return "unsorted";
    if (source.collection.startsWith("portfolio")) return "gallery";
    if (source.collection === "photoworks") return "observations";
    return source.collection;
  })));
}

export function getWorkDate(work: WorkDetail): string {
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

export function getKnownWorkDate(work: WorkDetail): string | null {
  if (work.creation.displayDate) return work.creation.displayDate;
  if (work.recordType === "photographic_work" && work.capture.status === "known" && work.capture.displayDate) {
    return getWorkDate(work);
  }
  return null;
}

export function getWorkDateForSentence(work: WorkDetail): string | null {
  return getKnownWorkDate(work)?.replace(/\s+г\.$/u, " года") ?? null;
}

export function getWorkTypeLabel(work: WorkDetail): string {
  if (work.objectWorkType === "painting") return "Живопись";
  if (work.objectWorkType === "work on paper") return "Работа на бумаге";
  return "Фотокомпозиция";
}

export const getPublicTitle = (work: WorkDetail): string =>
  work.recordType === "photographic_work" ? "Фотокомпозиция" : work.displayTitle.ru;

export const getPublicTitleEn = (work: WorkDetail): string =>
  work.recordType === "photographic_work" ? "Photographic Composition" : work.displayTitle.en;

export function getPublicDescription(work: WorkDetail): string | null {
  const description = work.description?.ru?.trim();
  if (!description) return null;
  if (
    description.startsWith("Живописная работа Никиты Пичугина") ||
    description.startsWith("Фотографическая работа Никиты Пичугина") ||
    description.includes("Метаданные зафиксированы по подписи")
  ) return null;
  return description;
}

export function getWorkCardQualifier(work: WorkDetail): string | null {
  if (work.recordType !== "artwork" || (artworkTitleCounts.get(work.displayTitle.ru) ?? 0) < 2) return null;
  const parts = [
    work.physicalDescription.status === "known" ? work.physicalDescription.materialsTechniquesDisplay : null,
    work.physicalDescription.dimensions.status === "known" && work.physicalDescription.dimensions.display
      ? `${work.physicalDescription.dimensions.display}${work.physicalDescription.dimensions.unit === "cm" ? " см" : ""}`
      : null
  ].filter(Boolean);
  return parts.join(" · ") || null;
}

export function getWorkSearchText(work: WorkDetail): string {
  return [
    getPublicTitle(work),
    work.creation.displayDate,
    work.physicalDescription.materialsTechniquesDisplay,
    ...work.subjects.genre,
    ...work.subjects.specific,
    ...work.subjects.keywords
  ].filter(Boolean).join(" ").toLocaleLowerCase("ru-RU");
}

export function getAdjacentWork(work: WorkDetail): { previous?: WorkDetail; next?: WorkDetail } {
  const collection = work.recordType === "artwork" ? artworkWorks : observationWorks;
  const index = collection.findIndex((candidate) => candidate.workId === work.workId);
  return {
    previous: index > 0 ? collection[index - 1] : undefined,
    next: index >= 0 && index < collection.length - 1 ? collection[index + 1] : undefined
  };
}

export function getRelatedWorks(work: WorkDetail): WorkDetail[] {
  return work.relatedWorkIds.map(getWorkById).filter((related): related is WorkDetail => Boolean(related));
}
