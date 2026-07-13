const FIRST_WORK_CENTER = 0.145;
const LAST_WORK_CENTER = 0.79;

export interface JourneySceneFrame {
  opacity: number;
  local: number;
  shouldLoad: boolean;
}

export interface JourneyWorkFrame {
  opacity: number;
  scale: number;
  x: number;
  y: number;
  rotateY: number;
  rotateZ: number;
  blur: number;
  saturation: number;
}

export interface JourneyFrame {
  progress: number;
  roadX: number;
  roadY: number;
  roadScale: number;
  introOpacity: number;
  introShift: number;
  outroOpacity: number;
  outroShift: number;
  scenes: JourneySceneFrame[];
  works: JourneyWorkFrame[];
  activeIndex: number;
  captionOpacity: number;
  chapter: "road" | "studio";
}

export const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

export const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

export const smoothstep = (edge0: number, edge1: number, value: number) => {
  const amount = clamp((value - edge0) / (edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
};

export function getJourneyProgress(rootTop: number, rootHeight: number, viewportHeight: number) {
  return clamp(-rootTop / Math.max(1, rootHeight - viewportHeight));
}

export function getWorkCenter(index: number, workCount: number) {
  const centerStep = workCount > 1 ? (LAST_WORK_CENTER - FIRST_WORK_CENTER) / (workCount - 1) : 0;
  return FIRST_WORK_CENTER + centerStep * index;
}

export function getJourneyFrame(
  progressValue: number,
  workSides: readonly number[],
  sceneCount: number,
  mobile: boolean
): JourneyFrame {
  const progress = clamp(progressValue);
  const scenePosition = progress * Math.max(0, sceneCount - 1);
  const sceneBase = Math.floor(scenePosition);
  const sceneBlend = smoothstep(0.08, 0.92, scenePosition - sceneBase);
  const scenes = Array.from({ length: sceneCount }, (_, index) => ({
    opacity: index <= sceneBase ? 1 : index === sceneBase + 1 ? sceneBlend : 0,
    local: clamp(scenePosition - index + 1),
    shouldLoad: index <= sceneBase + 1
  }));

  let activeIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const works = workSides.map((side, index) => {
    const center = getWorkCenter(index, workSides.length);
    const local = (progress - center) / (mobile ? 0.115 : 0.125);
    const approach = smoothstep(-1.12, 0, local);
    const departure = smoothstep(0, 1.02, local);
    const opacity = smoothstep(-1.18, -0.74, local) * (1 - smoothstep(0.22, 0.76, local));
    const focusX = mobile ? 0 : side * 16;
    const distance = Math.abs(progress - center);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      activeIndex = index;
    }

    return {
      opacity,
      scale: 0.19 + approach * 0.73 + departure * (mobile ? 0.38 : 0.44),
      x: local <= 0
        ? mix(side * (mobile ? 2 : 3), focusX, approach)
        : mix(focusX, side * (mobile ? 66 : 58), departure),
      y: local <= 0 ? mix(-8, -3, approach) : mix(-3, 15, departure),
      rotateY: local <= 0
        ? side * (mobile ? 0 : -15) * (1 - approach)
        : side * (mobile ? 0 : 9) * departure,
      rotateZ: side * (-1.2 * (1 - approach) + 1.1 * departure),
      blur: (1 - approach) * 1.2 + departure * 2.8,
      saturation: 0.84 + approach * 0.16
    };
  });

  const introAmount = smoothstep(0.02, 0.12, progress);
  const outroOpacity = smoothstep(0.865, 0.935, progress);
  const activeOpacity = works[activeIndex]?.opacity ?? 0;

  return {
    progress,
    roadX: mix(-2, 2, progress),
    roadY: mix(0, 5, progress),
    roadScale: mix(1, 1.24, progress),
    introOpacity: 1 - smoothstep(0.025, 0.105, progress),
    introShift: mix(0, -4, introAmount),
    outroOpacity,
    outroShift: mix(4, 0, outroOpacity),
    scenes,
    works,
    activeIndex,
    captionOpacity: progress < 0.1 || progress > 0.88 ? 0 : Math.min(1, activeOpacity * 1.1),
    chapter: progress > 0.86 ? "studio" : "road"
  };
}
