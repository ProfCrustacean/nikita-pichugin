import { describe, expect, it } from "vitest";
import {
  getJourneyFrame,
  getJourneyProgress,
  getWorkCenter
} from "../src/features/journey/journey-math.ts";

const workSides = [-1, 1, -1, 1, -1, 1];

describe("landscape journey math", () => {
  it("maps the scrollable distance to a clamped zero-to-one progress", () => {
    expect(getJourneyProgress(0, 7000, 1000)).toBe(0);
    expect(getJourneyProgress(-3000, 7000, 1000)).toBe(0.5);
    expect(getJourneyProgress(-6000, 7000, 1000)).toBe(1);
    expect(getJourneyProgress(400, 7000, 1000)).toBe(0);
    expect(getJourneyProgress(-9000, 7000, 1000)).toBe(1);
  });

  it("starts with the intro and finishes at the studio on desktop and mobile", () => {
    for (const mobile of [false, true]) {
      const start = getJourneyFrame(0, workSides, 4, mobile);
      expect(start).toMatchObject({
        progress: 0,
        activeIndex: 0,
        introOpacity: 1,
        outroOpacity: 0,
        captionOpacity: 0,
        chapter: "road"
      });

      const finish = getJourneyFrame(1, workSides, 4, mobile);
      expect(finish).toMatchObject({
        progress: 1,
        activeIndex: workSides.length - 1,
        introOpacity: 0,
        outroOpacity: 1,
        captionOpacity: 0,
        chapter: "studio"
      });
      expect(finish.scenes.at(-1)).toMatchObject({ opacity: 1, local: 1, shouldLoad: true });
    }
  });

  it("centers every work at full opacity with desktop and mobile geometry", () => {
    workSides.forEach((side, index) => {
      const center = getWorkCenter(index, workSides.length);
      const desktop = getJourneyFrame(center, workSides, 4, false);
      const mobile = getJourneyFrame(center, workSides, 4, true);

      expect(desktop.activeIndex).toBe(index);
      expect(mobile.activeIndex).toBe(index);
      expect(desktop.works[index]).toMatchObject({ opacity: 1, x: side * 16, y: -3 });
      expect(mobile.works[index]).toMatchObject({ opacity: 1, x: 0, y: -3 });
      expect(desktop.works[index].scale).toBeCloseTo(0.92);
      expect(mobile.works[index].scale).toBeCloseTo(0.92);
      expect(mobile.works[index].rotateY).toBeCloseTo(0);
    });
  });

  it("uses the established desktop and mobile departure distances", () => {
    const desktopFinish = getJourneyFrame(1, workSides, 4, false).works.at(-1);
    const mobileFinish = getJourneyFrame(1, workSides, 4, true).works.at(-1);

    expect(desktopFinish?.x).toBe(58);
    expect(mobileFinish?.x).toBe(66);
  });
});
