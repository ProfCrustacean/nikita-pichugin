import { formatWorksCountRu } from "../../lib/format";
import { getWorkSearchText, type MuseumWork } from "../../lib/museum";

export const CATALOG_BROWSER_CONFIG = {
  pageSize: 30,
  mobileMedia: "(max-width: 620px)"
} as const;

export const CATALOG_GENRE_LABELS = {
  landscape: "Пейзаж",
  "still life": "Натюрморт",
  interior: "Интерьер",
  cityscape: "Город",
  portrait: "Портрет"
} as const;

export interface CatalogItemModel {
  work: MuseumWork;
  id: string;
  type: string;
  decade: string;
  genres: string[];
  search: string;
}

export interface CatalogBrowserModel {
  items: CatalogItemModel[];
  decades: string[];
  genres: Array<{ value: string; label: string }>;
  counts: {
    all: number;
    painting: number;
    workOnPaper: number;
  };
}

export interface CatalogFilterItem {
  id: string;
  type: string;
  decade: string;
  genres: readonly string[];
  search: string;
}

export interface CatalogFilterState {
  type: string;
  decade: string;
  genre: string;
  query: string;
  visibleLimit: number;
}

export type CatalogFilterAction =
  | { type: "set-type"; value: string }
  | { type: "set-decade"; value: string }
  | { type: "set-genre"; value: string }
  | { type: "set-query"; value: string }
  | { type: "show-more" }
  | { type: "reset" }
  | { type: "reset-page" };

export interface CatalogFilterView {
  visibility: Map<string, boolean>;
  matchedCount: number;
  shownCount: number;
  remainingCount: number;
  countLabel: string;
  empty: boolean;
  resetHidden: boolean;
  moreHidden: boolean;
  moreLabel: string;
}

export function publicCatalogGenre(genre: string): string {
  return ["seascape", "architectural landscape"].includes(genre) ? "landscape" : genre;
}

export function catalogDecade(work: MuseumWork): string {
  return work.creation.earliestYear
    ? `${Math.floor(work.creation.earliestYear / 10) * 10}`
    : "unknown";
}

export function buildCatalogBrowserModel(works: readonly MuseumWork[]): CatalogBrowserModel {
  const sortedWorks = [...works].sort((a, b) => {
    const yearA = a.creation.latestYear ?? -1;
    const yearB = b.creation.latestYear ?? -1;
    return yearB - yearA || a.publicSlug.localeCompare(b.publicSlug, "ru");
  });
  const decades = Array.from(new Set(works.map(catalogDecade))).sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return Number(b) - Number(a);
  });
  const genres = Array.from(new Set(works.flatMap((work) => work.subjects.genre.map(publicCatalogGenre))))
    .filter((genre): genre is keyof typeof CATALOG_GENRE_LABELS => genre in CATALOG_GENRE_LABELS)
    .sort((a, b) => CATALOG_GENRE_LABELS[a].localeCompare(CATALOG_GENRE_LABELS[b], "ru"))
    .map((value) => ({ value, label: CATALOG_GENRE_LABELS[value] }));

  return {
    items: sortedWorks.map((work) => ({
      work,
      id: work.workId,
      type: work.objectWorkType,
      decade: catalogDecade(work),
      genres: work.subjects.genre.map(publicCatalogGenre),
      search: getWorkSearchText(work)
    })),
    decades,
    genres,
    counts: {
      all: works.length,
      painting: works.filter((work) => work.objectWorkType === "painting").length,
      workOnPaper: works.filter((work) => work.objectWorkType === "work on paper").length
    }
  };
}

export function createCatalogFilterState(pageSize: number = CATALOG_BROWSER_CONFIG.pageSize): CatalogFilterState {
  return {
    type: "all",
    decade: "all",
    genre: "all",
    query: "",
    visibleLimit: pageSize
  };
}

export function reduceCatalogFilterState(
  state: CatalogFilterState,
  action: CatalogFilterAction,
  pageSize: number = CATALOG_BROWSER_CONFIG.pageSize
): CatalogFilterState {
  switch (action.type) {
    case "set-type":
      return { ...state, type: action.value, visibleLimit: pageSize };
    case "set-decade":
      return { ...state, decade: action.value, visibleLimit: pageSize };
    case "set-genre":
      return { ...state, genre: action.value, visibleLimit: pageSize };
    case "set-query":
      return { ...state, query: action.value.trim().toLocaleLowerCase("ru-RU"), visibleLimit: pageSize };
    case "show-more":
      return { ...state, visibleLimit: state.visibleLimit + pageSize };
    case "reset-page":
      return { ...state, visibleLimit: pageSize };
    case "reset":
      return createCatalogFilterState(pageSize);
  }
}

export function workCountLabel(value: number): string {
  return formatWorksCountRu(value).replace(`${value} `, "");
}

export function buildCatalogFilterView(
  items: readonly CatalogFilterItem[],
  state: CatalogFilterState,
  options: { isMobile: boolean; pageSize?: number }
): CatalogFilterView {
  const pageSize = options.pageSize ?? CATALOG_BROWSER_CONFIG.pageSize;
  const visibility = new Map<string, boolean>();
  let matchedCount = 0;
  let shownCount = 0;

  for (const item of items) {
    const matches = (state.type === "all" || item.type === state.type) &&
      (state.decade === "all" || item.decade === state.decade) &&
      (state.genre === "all" || item.genres.includes(state.genre)) &&
      (!state.query || item.search.includes(state.query));
    if (matches) matchedCount += 1;
    const withinMobilePage = !options.isMobile || shownCount < state.visibleLimit;
    const visible = matches && withinMobilePage;
    visibility.set(item.id, visible);
    if (visible) shownCount += 1;
  }

  const remainingCount = Math.max(0, matchedCount - shownCount);
  const hasActiveFilters = state.type !== "all" || state.decade !== "all" ||
    state.genre !== "all" || Boolean(state.query);

  return {
    visibility,
    matchedCount,
    shownCount,
    remainingCount,
    countLabel: workCountLabel(matchedCount),
    empty: matchedCount === 0,
    resetHidden: !hasActiveFilters,
    moreHidden: !options.isMobile || remainingCount === 0,
    moreLabel: remainingCount > pageSize ? `Показать ещё ${pageSize}` : `Показать ещё ${remainingCount}`
  };
}
