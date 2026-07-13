import {
  getKnownWorkDate,
  getPreviewPath,
  getPrimaryAsset,
  getPublicDescription,
  getPublicTitle,
  getWorkAssets,
  getWorkDate,
  getWorkDateForSentence,
  getWorkHref,
  getWorkTypeLabel,
  hasCataloguerDescriptiveTitle,
  type MuseumAsset,
  type MuseumWork
} from "../../lib/museum";

export interface WorkDetailMetadata {
  label: string;
  value: string;
}

export interface WorkDetailPagerItem {
  href: string;
  title: string;
}

export interface WorkDetailMediaItem {
  assetId: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: string;
}

export interface WorkDetailPageModel {
  publicTitle: string;
  pageTitle: string;
  seoDescription: string;
  jsonLd: Record<string, unknown>;
  isPhotographic: boolean;
  typeLabel: string;
  backHref: string;
  backLabel: string;
  titleIsEditorial: boolean;
  description: string | null;
  metadata: WorkDetailMetadata[];
  primaryMedia: WorkDetailMediaItem;
  secondaryReproductions: WorkDetailMediaItem[];
  associatedAssets: WorkDetailMediaItem[];
  relatedWorks: MuseumWork[];
  pager: {
    previous?: WorkDetailPagerItem;
    next?: WorkDetailPagerItem;
  };
}

export interface WorkDetailBuildContext {
  pageUrl: URL | string;
  assetOrigin?: URL | string;
  works: readonly MuseumWork[];
}

function getPager(work: MuseumWork, works: readonly MuseumWork[]): WorkDetailPageModel["pager"] {
  const collection = works.filter((candidate) => candidate.recordType === work.recordType);
  const index = collection.findIndex((candidate) => candidate.workId === work.workId);
  const previous = index > 0 ? collection[index - 1] : undefined;
  const next = index >= 0 && index < collection.length - 1 ? collection[index + 1] : undefined;
  return {
    ...(previous ? { previous: { href: getWorkHref(previous), title: getPublicTitle(previous) } } : {}),
    ...(next ? { next: { href: getWorkHref(next), title: getPublicTitle(next) } } : {})
  };
}

function mediaItem(asset: MuseumAsset, alt: string, caption: string): WorkDetailMediaItem {
  return {
    assetId: asset.assetId,
    src: getPreviewPath(asset),
    alt,
    width: asset.previewWidthPx,
    height: asset.previewHeightPx,
    caption
  };
}

export function buildWorkDetailPageModel(
  work: MuseumWork,
  context: WorkDetailBuildContext
): WorkDetailPageModel {
  const allWorks = context.works;
  const pageUrl = context.pageUrl instanceof URL ? context.pageUrl : new URL(context.pageUrl);
  const assetOrigin = context.assetOrigin ?? pageUrl.origin;
  const publicTitle = getPublicTitle(work);
  const assets = getWorkAssets(work);
  const primaryAsset = getPrimaryAsset(work);
  const secondaryReproductions = assets
    .filter((asset) => asset.assetId !== primaryAsset.assetId && asset.visualClass === "artwork_reproduction")
    .map((asset) => mediaItem(asset, `Другое изображение работы «${publicTitle}»`, "Другое изображение работы"));
  const associatedAssets = assets
    .filter((asset) => asset.assetId !== primaryAsset.assetId && asset.visualClass !== "artwork_reproduction")
    .map((asset) => mediaItem(
      asset,
      `Материал, опубликованный вместе с работой «${publicTitle}»`,
      "Связанное изображение"
    ));
  const description = getPublicDescription(work);
  const firstGenre = work.subjects.genre.find((genre) => !["painting", "photography"].includes(genre));
  const relatedWorks = allWorks
    .filter((candidate) =>
      candidate.workId !== work.workId &&
      candidate.recordType === work.recordType &&
      (firstGenre ? candidate.subjects.genre.includes(firstGenre) : candidate.objectWorkType === work.objectWorkType)
    )
    .slice(0, 3);
  const knownDate = getKnownWorkDate(work);
  const dimensions = work.physicalDescription.dimensions.display
    ? `${work.physicalDescription.dimensions.display}${work.physicalDescription.dimensions.unit === "cm" ? " см" : ""}`
    : null;
  const metadata = [
    {
      label: work.recordType === "photographic_work" ? "Дата съёмки" : "Год",
      value: knownDate,
      show: Boolean(knownDate)
    },
    {
      label: "Материал и техника",
      value: work.physicalDescription.materialsTechniquesDisplay,
      show: work.physicalDescription.status === "known"
    },
    {
      label: "Размер",
      value: dimensions,
      show: work.physicalDescription.dimensions.status === "known"
    }
  ]
    .filter((item): item is { label: string; value: string; show: true } => item.show && Boolean(item.value))
    .map(({ label, value }) => ({ label, value }));
  const sentenceDate = getWorkDateForSentence(work);
  const seoDescription = work.recordType === "photographic_work"
    ? `Фотокомпозиция Никиты Пичугина.${sentenceDate ? ` Дата съёмки: ${sentenceDate}.` : ""}`
    : [
        `«${publicTitle}». Никита Пичугин${work.creation.displayDate ? `, ${work.creation.displayDate}` : ""}.`,
        work.physicalDescription.status === "known" && work.physicalDescription.materialsTechniquesDisplay
          ? `${work.physicalDescription.materialsTechniquesDisplay}.`
          : null,
        work.physicalDescription.dimensions.status === "known" && dimensions ? `${dimensions}.` : null
      ].filter(Boolean).join(" ");
  const pageTitle = work.recordType === "photographic_work" && knownDate
    ? `${publicTitle}, ${knownDate}`
    : publicTitle;
  const imagePath = getPreviewPath(primaryAsset);
  const primaryMedia = mediaItem(primaryAsset, publicTitle, getWorkDate(work));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: publicTitle,
    url: pageUrl.href,
    image: new URL(imagePath, assetOrigin).href,
    creator: { "@type": "Person", name: "Никита Пичугин" },
    artform: getWorkTypeLabel(work),
    inLanguage: "ru",
    ...(work.creation.displayDate ? { dateCreated: work.creation.displayDate } : {}),
    ...(work.recordType === "photographic_work" && work.capture.status === "known" && work.capture.displayDate
      ? { dateCreated: work.capture.displayDate.slice(0, 10) }
      : {}),
    ...(work.physicalDescription.status === "known" && work.physicalDescription.materialsTechniquesDisplay
      ? { artMedium: work.physicalDescription.materialsTechniquesDisplay }
      : {}),
    description: seoDescription
  };

  return {
    publicTitle,
    pageTitle,
    seoDescription,
    jsonLd,
    isPhotographic: work.recordType === "photographic_work",
    typeLabel: getWorkTypeLabel(work),
    backHref: work.recordType === "artwork" ? "/works/" : "/studio/#photocompositions",
    backLabel: work.recordType === "artwork" ? "Назад к собранию" : "Назад к фотокомпозициям",
    titleIsEditorial: hasCataloguerDescriptiveTitle(work),
    description,
    metadata,
    primaryMedia,
    secondaryReproductions,
    associatedAssets,
    relatedWorks,
    pager: getPager(work, allWorks)
  };
}
