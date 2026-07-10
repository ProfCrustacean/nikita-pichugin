import { describe, expect, it } from "vitest";
import {
  fallbackDisplayTitle,
  isTechnicalLabel,
  labelKind,
  makeGridRequestBody,
  parseAjaxGridItems,
  parseFilenameDateCandidate,
  parseGridRequests,
  parseMuseumLabel,
  stableId
} from "../scripts/museum-catalog.mjs";

describe("museum catalog parsers", () => {
  it("does not interpret technical filenames as artwork titles or creation years", () => {
    expect(parseMuseumLabel("photo_2026-06-25_13-44-42")).toMatchObject({
      title: null,
      creationYear: null,
      filenameDateCandidate: "2026-06-25T13:44:42",
      labelKind: "technical_filename"
    });
    expect(isTechnicalLabel("DSC05234444")).toBe(true);
    expect(labelKind("IMG_7210")).toBe("technical_filename");
  });

  it("parses source title, dimensions, abbreviated materials and year", () => {
    expect(parseMuseumLabel("Замоскворечье. 50 х 73 х.м. 2025")).toMatchObject({
      title: "Замоскворечье",
      creationYear: 2025,
      materials: {
        display: "Холст, масло",
        support: "холст",
        techniques: ["масло"]
      },
      dimensions: {
        display: "50 × 73",
        values: [50, 73],
        unit: "cm",
        axisOrder: "source_order_unknown"
      }
    });
  });

  it("parses archive captions with quoted titles", () => {
    expect(parseMuseumLabel("«Салют осени» 2015. Картон, масло. 50х70")).toMatchObject({
      title: "Салют осени",
      creationYear: 2015,
      materials: {
        display: "Картон, масло",
        support: "картон",
        techniques: ["масло"]
      },
      dimensions: { values: [50, 70] }
    });
  });

  it("keeps dimension-only labels untitled", () => {
    expect(parseMuseumLabel("62 х 83 бумага. тушь. 2025")).toMatchObject({
      title: null,
      creationYear: 2025,
      materials: { support: "бумага", techniques: ["тушь"] },
      dimensions: { values: [62, 83] }
    });
  });

  it("extracts Visual Composer request settings and items", () => {
    const page = `<div class="vc_masonry_media_grid" data-vc-grid-settings='{"page_id":4,"style":"all-masonry","shortcode_id":"abc","tag":"vc_masonry_media_grid"}' data-vc-request="https://nikitapichugin.ru/wp-admin/admin-ajax.php" data-vc-post-id="4" data-vc-public-nonce="nonce"></div>`;
    const [request] = parseGridRequests(page);
    expect(request).toMatchObject({ index: 0, nonce: "nonce", postId: 4 });
    expect(makeGridRequestBody(request).get("data[shortcode_id]")).toBe("abc");

    const response = `<div class="vc_grid-item"><a href="http://nikitapichugin.ru/wp-content/uploads/a-1024x700.jpg" title="«Весна» 2013. Холст, масло. 30×50"></a><h4>«Весна» 2013. Холст, масло. 30×50</h4></div>`;
    expect(parseAjaxGridItems(response)).toEqual([
      {
        index: 0,
        rawLabel: '"Весна" 2013. Холст, масло. 30×50',
        discoveredUrl: "https://nikitapichugin.ru/wp-content/uploads/a-1024x700.jpg"
      }
    ]);
  });

  it("provides bilingual nontechnical fallback titles and stable IDs", () => {
    expect(fallbackDisplayTitle({ recordType: "artwork" })).toEqual({
      ru: "Живописная композиция",
      en: "Painted Composition"
    });
    expect(fallbackDisplayTitle({ recordType: "photographic_work", filenameDateCandidate: "2016-10-26T10:47:00" })).toEqual({
      ru: "Фотокомпозиция",
      en: "Photographic Composition"
    });
    expect(stableId("work", "portfolio:15578")).toMatch(/^work_[a-f0-9]{16}$/);
  });

  it("parses filename dates independently", () => {
    expect(parseFilenameDateCandidate("2016-10-20 13.54")).toBe("2016-10-20T13:54:00");
  });
});
