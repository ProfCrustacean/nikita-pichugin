import { describe, expect, it } from "vitest";
import {
  parseArtworkDetails,
  parseEnviraImages,
  parseSitemapImages,
  parseVcIncludeIds,
  textFromHtml
} from "../scripts/wordpress-content.mjs";

describe("WordPress content parsers", () => {
  it("extracts Visual Composer media IDs", () => {
    const html =
      '[vc_single_image image=&#187;15460&#8243;][vc_masonry_media_grid include=&#187;15501,15499,15498&#8243;]';
    expect(parseVcIncludeIds(html)).toEqual([15501, 15499, 15498, 15460]);
  });

  it("extracts Envira gallery JSON", () => {
    const html =
      "<div data-gallery-images='[{\"id\":15981,\"src\":\"https://nikitapichugin.ru/wp-content/uploads/a.jpg\",\"title\":\"Этюд\"}]'></div>";
    expect(parseEnviraImages(html)).toEqual([
      {
        id: 15981,
        sourceUrl: "https://nikitapichugin.ru/wp-content/uploads/a.jpg",
        title: "Этюд",
        alt: "",
        caption: ""
      }
    ]);
  });

  it("extracts sitemap images by portfolio slug", () => {
    const xml = `<?xml version="1.0"?><urlset xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><url><loc>https://nikitapichugin.ru/portfolios/dyhanie-leta/</loc><image:image><image:loc>https://nikitapichugin.ru/wp-content/uploads/a.jpg</image:loc></image:image></url></urlset>`;
    expect(parseSitemapImages(xml).get("dyhanie-leta")).toEqual([
      "https://nikitapichugin.ru/wp-content/uploads/a.jpg"
    ]);
  });

  it("normalizes artwork metadata", () => {
    expect(
      parseArtworkDetails({
        title: "На мгновенье стало тихо",
        text: "На мгновенье стало тихо Холст, масло. 90х80. 2023 г. Через несколько мгновений шум возобновится",
        year: ""
      })
    ).toMatchObject({
      year: "2023",
      medium: "Холст, масло",
      dimensions: "90 x 80",
      description: "Через несколько мгновений шум возобновится"
    });
  });

  it("removes WordPress navigation noise from artwork metadata", () => {
    expect(
      parseArtworkDetails({
        title: "Отражение",
        text: "Отражение Мир. Картон, масло 100х70 Prev EntryNext Entry",
        year: "2023"
      })
    ).toMatchObject({
      year: "2023",
      medium: "Картон, масло",
      dimensions: "100 x 70",
      description: "Мир"
    });
  });

  it("does not turn a year range into description text", () => {
    expect(
      parseArtworkDetails({
        title: "Сквозь пыльное стекло",
        text: "Сквозь пыльное стекло Холст, масло. 2022-2023. Prev EntryNext Entry",
        year: "2022"
      })
    ).toMatchObject({
      year: "2022",
      medium: "Холст, масло",
      description: ""
    });
  });

  it("strips shortcode-heavy HTML into readable text", () => {
    expect(textFromHtml("<p>[vc_column_text]Фиксируя мир[/vc_column_text]</p>")).toBe("Фиксируя мир");
  });
});
