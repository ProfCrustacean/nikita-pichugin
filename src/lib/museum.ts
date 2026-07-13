import {
  getAsset,
  getSiteContent,
  getWorkById as findWorkById,
  getWorkBySlug as findWorkBySlug,
  listAssets,
  listWorks
} from "../domain/catalog/repository";
import type {
  AssetView,
  MuseumStatus,
  WorkDetail,
  WorkRecordSource,
  WorkTitle
} from "../domain/catalog/model";

export type MuseumAsset = AssetView;
export type MuseumWork = WorkDetail;
export type MuseumRecordSource = WorkRecordSource;
export type MuseumTitle = WorkTitle;
export type { MuseumStatus };

export const museumWorks: MuseumWork[] = [...listWorks()];
export const museumAssets: MuseumAsset[] = [...listAssets()];
export const museumSiteContent = getSiteContent();
export const artworkWorks = museumWorks.filter((work) => work.recordType === "artwork");
export const observationWorks = museumWorks.filter((work) => work.recordType === "photographic_work");

export const getWorkById = findWorkById;
export const getWorkBySlug = findWorkBySlug;
export const getAssetById = getAsset;

export {
  getAdjacentWork,
  getKnownWorkDate,
  getPreviewPath,
  getPrimaryAsset,
  getPublicDescription,
  getPublicTitle,
  getPublicTitleEn,
  getRelatedWorks,
  getWorkAssets,
  getWorkCardQualifier,
  getWorkCollections,
  getWorkDate,
  getWorkDateForSentence,
  getWorkHref,
  getWorkSearchText,
  getWorkTitleType,
  getWorkTypeLabel,
  hasCataloguerDescriptiveTitle
} from "../domain/catalog/selectors";
