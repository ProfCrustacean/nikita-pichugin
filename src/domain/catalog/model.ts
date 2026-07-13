export type MuseumStatus = "known" | "unknown" | "not_applicable" | "not_visible" | "needs_owner_input";
export interface WorkTitle {
  language: "ru" | "en";
  type: "source_stated" | "cataloguer_supplied" | "translated" | "alternative" | "technical_identifier";
  preferred: boolean;
}

export interface WorkRecordSource {
  collection: string;
}

export interface WorkDetail {
  workId: string;
  publicSlug: string;
  recordType: "artwork" | "photographic_work";
  objectWorkType: string;
  titles: WorkTitle[];
  displayTitle: { ru: string; en: string };
  creation: {
    displayDate: string | null;
    earliestYear: number | null;
    latestYear: number | null;
    status: MuseumStatus;
  };
  capture: {
    displayDate: string | null;
    status: MuseumStatus;
  };
  physicalDescription: {
    materialsTechniquesDisplay: string | null;
    dimensions: {
      display: string | null;
      unit: string | null;
      status: MuseumStatus;
    };
    status: MuseumStatus;
  };
  subjects: {
    genre: string[];
    specific: string[];
    keywords: string[];
  };
  description: { ru: string };
  assetIds: string[];
  relatedWorkIds: string[];
  recordSource: WorkRecordSource[];
}

export type WorkSummary = WorkDetail;

export type AssetVisualClass =
  | "artwork_reproduction"
  | "photographic_work"
  | "studio_or_process_photo"
  | "context_or_reference_photo"
  | "artist_portrait"
  | "site_graphic"
  | "unknown";

export interface AssetView {
  assetId: string;
  previewPath: string;
  previewWidthPx: number;
  previewHeightPx: number;
  visualClass: AssetVisualClass;
}

export interface CatalogCounts {
  assets: number;
  works: number;
  artworkWorks: number;
  photographicWorks: number;
  placements: number;
  authorities: number;
  needsReview: number;
  needsOwnerInput: number;
}

export interface SourceManifest {
  schemaVersion: string;
  sourceBaseUrl: string;
  snapshotId: string;
  generatedAt: string;
  counts: CatalogCounts;
  sourceBaselines: Record<string, number>;
  errors: string[];
  warnings: string[];
}

export interface CatalogManifest extends SourceManifest {
  runtimeSchemaVersion: string;
  sourceSnapshotId: string;
  sourceDigest: string;
}

export interface SiteContent {
  schemaVersion: string;
  brand: { ru: string; en: string };
  defaultDescription: string;
  footerInquiryLabel: string;
  exhibitionTourPath: string;
  navigation: Array<{ label: string; href: string }>;
  contact: {
    phone: string;
    phoneHref: string;
    email: string;
    vk: string;
    telegram: string;
  };
  portraitAssetId: string;
  staticRoutes: string[];
}

export interface LegacyRedirect {
  source: string;
  destination: string;
}

export interface RouteRegistry {
  staticPaths: readonly string[];
  workPaths: readonly string[];
  sitemapPaths: readonly string[];
  legacyRedirects: readonly LegacyRedirect[];
}

export interface CatalogFixtures {
  artworkSlug: string;
  photographicWorkSlug: string;
  multiAssetWorkSlug: string;
}

export interface SiteRuntimeBundle {
  schemaVersion: string;
  sourceSnapshotId: string;
  sourceDigest: string;
  manifest: SourceManifest;
  counts: CatalogCounts;
  works: WorkDetail[];
  assets: AssetView[];
  indexes: {
    workIdToIndex: Record<string, number>;
    workSlugToIndex: Record<string, number>;
    assetIdToIndex: Record<string, number>;
  };
  legacyRedirects: LegacyRedirect[];
  fixtures: CatalogFixtures;
  routeRegistry: Pick<RouteRegistry, "workPaths">;
}
