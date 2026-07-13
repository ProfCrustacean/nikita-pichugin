import { describe, expect, it } from "vitest";
import {
  buildCatalogFilterView,
  createCatalogFilterState,
  reduceCatalogFilterState
} from "../src/features/catalog/catalog-model.ts";

const items = [
  { id: "spring", type: "painting", decade: "2020", genres: ["landscape"], search: "весна поле" },
  { id: "paper", type: "work on paper", decade: "2010", genres: ["cityscape"], search: "гурзуф улица" },
  { id: "still-life", type: "painting", decade: "2020", genres: ["still life"], search: "сирень окно" }
];

describe("catalog filter model", () => {
  it("combines type, decade, genre and normalized search filters", () => {
    let state = createCatalogFilterState();
    state = reduceCatalogFilterState(state, { type: "set-type", value: "painting" });
    state = reduceCatalogFilterState(state, { type: "set-decade", value: "2020" });
    state = reduceCatalogFilterState(state, { type: "set-genre", value: "landscape" });
    state = reduceCatalogFilterState(state, { type: "set-query", value: "  ВЕСНА " });

    const view = buildCatalogFilterView(items, state, { isMobile: false });
    expect(view.matchedCount).toBe(1);
    expect(view.visibility.get("spring")).toBe(true);
    expect(view.visibility.get("paper")).toBe(false);
    expect(view.resetHidden).toBe(false);
  });

  it("pages mobile results in explicit groups of 30 and leaves desktop unpaged", () => {
    const manyItems = Array.from({ length: 65 }, (_, index) => ({
      id: String(index),
      type: "painting",
      decade: "2020",
      genres: ["landscape"],
      search: `работа ${index}`
    }));
    let state = createCatalogFilterState(30);
    let mobile = buildCatalogFilterView(manyItems, state, { isMobile: true, pageSize: 30 });
    expect(mobile.shownCount).toBe(30);
    expect(mobile.remainingCount).toBe(35);
    expect(mobile.moreLabel).toBe("Показать ещё 30");

    state = reduceCatalogFilterState(state, { type: "show-more" }, 30);
    mobile = buildCatalogFilterView(manyItems, state, { isMobile: true, pageSize: 30 });
    expect(mobile.shownCount).toBe(60);
    expect(mobile.remainingCount).toBe(5);
    expect(mobile.moreLabel).toBe("Показать ещё 5");

    const desktop = buildCatalogFilterView(manyItems, createCatalogFilterState(30), {
      isMobile: false,
      pageSize: 30
    });
    expect(desktop.shownCount).toBe(65);
    expect(desktop.moreHidden).toBe(true);
  });

  it("exposes a stable empty-result state and reset restores all items", () => {
    let state = reduceCatalogFilterState(createCatalogFilterState(), {
      type: "set-query",
      value: "несуществующая работа"
    });
    const empty = buildCatalogFilterView(items, state, { isMobile: false });
    expect(empty).toMatchObject({ matchedCount: 0, shownCount: 0, empty: true, countLabel: "работ" });

    state = reduceCatalogFilterState(state, { type: "reset" });
    const restored = buildCatalogFilterView(items, state, { isMobile: false });
    expect(restored).toMatchObject({ matchedCount: 3, shownCount: 3, empty: false, resetHidden: true });
  });
});
