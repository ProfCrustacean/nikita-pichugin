import { getJourneyFrame, getJourneyProgress } from "./journey-math";
import type { JourneyClientWork } from "./journey-types";

export interface LandscapeJourneyOptions {
  onActiveChange?: (active: boolean) => void;
  reducedMotion?: boolean;
}

const noCleanup = () => {};

export function initLandscapeJourney(
  root: HTMLElement,
  options: LandscapeJourneyOptions = {}
): () => void {
  if (root.dataset.landscapeBound === "true") return noCleanup;
  root.dataset.landscapeBound = "true";

  const works = root.dataset.works
    ? JSON.parse(root.dataset.works) as JourneyClientWork[]
    : [];
  const workElements = Array.from(root.querySelectorAll<HTMLElement>("[data-journey-work]"));
  const sceneElements = Array.from(root.querySelectorAll<HTMLElement>("[data-journey-scene]"));
  const intro = root.querySelector<HTMLElement>("[data-journey-intro]");
  const outro = root.querySelector<HTMLElement>("[data-journey-outro]");
  const caption = root.querySelector<HTMLElement>("[data-journey-caption]");
  const captionNumber = root.querySelector<HTMLElement>("[data-journey-number]");
  const captionTitle = root.querySelector<HTMLElement>("[data-journey-title]");
  const captionLink = root.querySelector<HTMLAnchorElement>("[data-journey-open]");
  const progress = root.querySelector<HTMLElement>("[data-journey-progress]");
  const roadLight = root.querySelector<HTMLElement>("[data-road-light]");
  const reducedMotion = options.reducedMotion
    ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion || !works.length || !sceneElements.length) {
    root.dataset.landscapeStatus = "fallback";
    return () => delete root.dataset.landscapeBound;
  }

  let activeIndex = -1;
  let animationFrame = 0;

  const render = () => {
    animationFrame = 0;
    const bounds = root.getBoundingClientRect();
    const mobile = window.innerWidth <= 720;
    const frame = getJourneyFrame(
      getJourneyProgress(bounds.top, root.offsetHeight, window.innerHeight),
      workElements.map((element) => Number(element.dataset.side ?? 1)),
      sceneElements.length,
      mobile
    );

    root.style.setProperty("--journey-progress", String(frame.progress));
    progress?.style.setProperty("transform", `scaleX(${frame.progress})`);
    roadLight?.style.setProperty(
      "transform",
      `translate3d(${frame.roadX}vw, ${frame.roadY}vh, 0) scale(${frame.roadScale})`
    );

    frame.scenes.forEach((sceneFrame, index) => {
      const scene = sceneElements[index];
      scene.style.opacity = String(sceneFrame.opacity);
      const image = scene.querySelector<HTMLElement>("img");
      if (sceneFrame.shouldLoad && image?.dataset.src && !image.getAttribute("src")) {
        image.setAttribute("src", image.dataset.src);
      }
      image?.style.setProperty(
        "transform",
        `translate3d(${(index % 2 === 0 ? -1 : 1) * sceneFrame.local * 1.8}vw, ${sceneFrame.local * 1.5}vh, 0) scale(${1.035 + sceneFrame.local * 0.085})`
      );
    });

    intro?.style.setProperty("opacity", String(frame.introOpacity));
    intro?.style.setProperty(
      "transform",
      mobile
        ? `translate3d(0, ${frame.introShift}vh, 0)`
        : `translate3d(0, calc(-50% + ${frame.introShift}vh), 0)`
    );
    outro?.style.setProperty("opacity", String(frame.outroOpacity));
    outro?.style.setProperty(
      "transform",
      `translate3d(0, calc(-50% + ${frame.outroShift}vh), 0)`
    );

    frame.works.forEach((workFrame, index) => {
      const element = workElements[index];
      element.style.opacity = String(workFrame.opacity);
      element.style.filter = `blur(${workFrame.blur}px) saturate(${workFrame.saturation})`;
      element.style.transform = `translate3d(calc(-50% + ${workFrame.x}vw), calc(-50% + ${workFrame.y}vh), 0) rotateY(${workFrame.rotateY}deg) rotateZ(${workFrame.rotateZ}deg) scale(${workFrame.scale})`;
    });

    if (frame.activeIndex !== activeIndex) {
      activeIndex = frame.activeIndex;
      const activeWork = works[activeIndex];
      if (captionNumber) captionNumber.textContent = String(activeIndex + 1).padStart(2, "0");
      if (captionTitle) captionTitle.textContent = activeWork.title;
      if (captionLink) captionLink.href = activeWork.href;
      root.dataset.activeSide = workElements[activeIndex]?.dataset.side ?? "1";
      caption?.classList.remove("is-changing");
      void caption?.offsetWidth;
      caption?.classList.add("is-changing");
    }

    caption?.style.setProperty("opacity", String(frame.captionOpacity));
    root.dataset.landscapeChapter = frame.chapter;
    const journeyIsActive = bounds.top <= 76 && bounds.bottom > window.innerHeight * 0.55;
    options.onActiveChange?.(journeyIsActive);
  };

  const requestRender = () => {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(render);
  };

  window.addEventListener("scroll", requestRender, { passive: true });
  window.addEventListener("resize", requestRender, { passive: true });
  render();
  root.dataset.landscapeStatus = "ready";

  return () => {
    window.removeEventListener("scroll", requestRender);
    window.removeEventListener("resize", requestRender);
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    options.onActiveChange?.(false);
    delete root.dataset.landscapeBound;
  };
}
