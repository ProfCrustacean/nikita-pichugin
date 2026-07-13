import { acquireDocumentScrollLock } from "../shell/scroll-lock";
import {
  buildCatalogFilterView,
  CATALOG_BROWSER_CONFIG,
  createCatalogFilterState,
  reduceCatalogFilterState,
  type CatalogFilterAction,
  type CatalogFilterItem
} from "./catalog-model";

export interface CatalogControllerOptions {
  pageSize?: number;
  mobileMedia?: string;
}

export function initCatalogBrowser(root: HTMLElement, options: CatalogControllerOptions = {}): () => void {
  const pageSize = options.pageSize ?? CATALOG_BROWSER_CONFIG.pageSize;
  const mobileMedia = options.mobileMedia ?? CATALOG_BROWSER_CONFIG.mobileMedia;
  const view = root.ownerDocument.defaultView;
  if (!view || root.dataset.bound === "true") return () => {};

  const itemElements = Array.from(root.querySelectorAll<HTMLElement>("[data-catalog-item]"));
  const items: CatalogFilterItem[] = itemElements.map((item, index) => ({
    id: String(index),
    type: item.dataset.type ?? "",
    decade: item.dataset.decade ?? "unknown",
    genres: (item.dataset.genres ?? "").split("|").filter(Boolean),
    search: item.dataset.search ?? ""
  }));
  const typeButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-type]"));
  const search = root.querySelector<HTMLInputElement>("[data-catalog-search]");
  const decade = root.querySelector<HTMLSelectElement>("[data-catalog-decade]");
  const genre = root.querySelector<HTMLSelectElement>("[data-catalog-genre]");
  const count = root.querySelector<HTMLElement>("[data-catalog-count]");
  const label = root.querySelector<HTMLElement>("[data-catalog-count-label]");
  const empty = root.querySelector<HTMLElement>("[data-catalog-empty]");
  const reset = root.querySelector<HTMLButtonElement>("[data-catalog-reset]");
  const more = root.querySelector<HTMLButtonElement>("[data-catalog-more]");
  const filterToggle = root.querySelector<HTMLButtonElement>("[data-catalog-filter-toggle]");
  const filterClose = root.querySelector<HTMLButtonElement>("[data-catalog-filter-close]");
  const mobileQuery = view.matchMedia(mobileMedia);
  const cleanups: Array<() => void> = [];
  let filterLockRelease: (() => void) | null = null;
  let state = createCatalogFilterState(pageSize);

  root.dataset.bound = "true";

  const listen = (target: EventTarget | null, event: string, handler: EventListener) => {
    if (!target) return;
    target.addEventListener(event, handler);
    cleanups.push(() => target.removeEventListener(event, handler));
  };

  const setFiltersOpen = (open: boolean, restoreFocus = true) => {
    root.dataset.filtersOpen = String(open);
    filterToggle?.setAttribute("aria-expanded", String(open));
    root.ownerDocument.documentElement.classList.toggle("catalog-filters-open", open);
    if (open && !filterLockRelease) filterLockRelease = acquireDocumentScrollLock("catalog-filters");
    if (!open && filterLockRelease) {
      filterLockRelease();
      filterLockRelease = null;
    }
    if (!open && restoreFocus) filterToggle?.focus();
  };

  const render = () => {
    const result = buildCatalogFilterView(items, state, { isMobile: mobileQuery.matches, pageSize });
    itemElements.forEach((item, index) => {
      item.hidden = !result.visibility.get(items[index].id);
    });
    if (count) count.textContent = String(result.matchedCount);
    if (label) label.textContent = result.countLabel;
    if (empty) empty.hidden = !result.empty;
    if (reset) reset.hidden = result.resetHidden;
    if (more) {
      more.hidden = result.moreHidden;
      more.textContent = result.moreLabel;
    }
  };

  const dispatch = (action: CatalogFilterAction) => {
    state = reduceCatalogFilterState(state, action, pageSize);
    render();
  };

  typeButtons.forEach((button) => listen(button, "click", () => {
    dispatch({ type: "set-type", value: button.dataset.type ?? "all" });
    typeButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
  }));
  listen(search, "input", () => dispatch({ type: "set-query", value: search?.value ?? "" }));
  listen(decade, "change", () => dispatch({ type: "set-decade", value: decade?.value ?? "all" }));
  listen(genre, "change", () => dispatch({ type: "set-genre", value: genre?.value ?? "all" }));
  listen(reset, "click", () => {
    state = reduceCatalogFilterState(state, { type: "reset" }, pageSize);
    typeButtons.forEach((button, index) => button.setAttribute("aria-pressed", String(index === 0)));
    if (search) search.value = "";
    if (decade) decade.value = "all";
    if (genre) genre.value = "all";
    render();
  });
  listen(more, "click", () => dispatch({ type: "show-more" }));
  listen(filterToggle, "click", () => setFiltersOpen(true));
  listen(filterClose, "click", () => setFiltersOpen(false));
  listen(view, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape" && root.dataset.filtersOpen === "true") setFiltersOpen(false);
  });
  listen(mobileQuery, "change", () => {
    setFiltersOpen(false);
    dispatch({ type: "reset-page" });
  });

  root.dataset.catalogReady = "true";
  render();

  return () => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    setFiltersOpen(false, false);
    delete root.dataset.bound;
    delete root.dataset.catalogReady;
    delete root.dataset.filtersOpen;
  };
}
