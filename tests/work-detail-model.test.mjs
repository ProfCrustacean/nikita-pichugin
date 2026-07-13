import { describe, expect, it } from "vitest";
import { getWorkById, museumWorks } from "../src/lib/museum.ts";
import { buildWorkDetailPageModel } from "../src/features/work-detail/work-detail-model.ts";

function build(workId) {
  const work = getWorkById(workId);
  if (!work) throw new Error(`Missing fixture ${workId}`);
  return buildWorkDetailPageModel(work, {
    pageUrl: `https://nikita-pichugin.onrender.com/works/${work.publicSlug}/`,
    assetOrigin: "https://nikita-pichugin.onrender.com",
    works: museumWorks
  });
}

describe("work detail page model", () => {
  it("builds painting metadata, SEO and adjacent navigation", () => {
    const model = build("work_081413fef644d0de");
    expect(model).toMatchObject({
      publicTitle: "Отражение",
      pageTitle: "Отражение",
      isPhotographic: false,
      typeLabel: "Живопись",
      backHref: "/works/"
    });
    expect(model.metadata.map((item) => item.label)).toEqual(["Год", "Материал и техника", "Размер"]);
    expect(model.seoDescription).toContain("«Отражение». Никита Пичугин, 2023.");
    expect(model.jsonLd).toMatchObject({
      "@type": "VisualArtwork",
      name: "Отражение",
      dateCreated: "2023"
    });
    expect(model.pager.previous || model.pager.next).toBeTruthy();
  });

  it("uses neutral photographic titles and the known capture date in SEO", () => {
    const model = build("work_003d31ab81abc33a");
    expect(model.publicTitle).toBe("Фотокомпозиция");
    expect(model.isPhotographic).toBe(true);
    expect(model.backHref).toBe("/studio/#photocompositions");
    expect(model.pageTitle).toMatch(/^Фотокомпозиция, /u);
    expect(model.metadata[0].label).toBe("Дата съёмки");
    expect(model.jsonLd.dateCreated).toBe("2020-07-07");
  });

  it("omits unavailable physical metadata instead of inventing it", () => {
    const model = build("work_5c6e922b751b10ba");
    expect(model.publicTitle).toBe("Мир мастерской");
    expect(model.metadata).toEqual([{ label: "Год", value: "2023" }]);
    expect(model.jsonLd).not.toHaveProperty("artMedium");
  });

  it("separates alternate reproductions from associated-material galleries", () => {
    const model = build("work_85f760db95a5a9ba");
    expect(model.publicTitle).toBe("Предчувствие");
    expect(model.secondaryReproductions).toHaveLength(1);
    expect(model.associatedAssets).toHaveLength(3);
    const ids = [
      model.primaryMedia.assetId,
      ...model.secondaryReproductions.map((media) => media.assetId),
      ...model.associatedAssets.map((media) => media.assetId)
    ];
    expect(new Set(ids).size).toBe(5);
    expect(model.secondaryReproductions[0].src).toMatch(/^\/museum\/previews\//u);
    expect(model.associatedAssets[0].alt).toContain("Предчувствие");
  });
});
