export type TourCleanup = () => void;

export interface TourOptions {
  backHref: string;
}

export function initTour(root: HTMLElement, options: TourOptions): TourCleanup {
  const intro = root.querySelector<HTMLElement>("[data-tour-intro]");
  const enter = root.querySelector<HTMLButtonElement>("[data-tour-enter]");
  const frame = root.querySelector<HTMLIFrameElement>("[data-tour-frame]");
  const loading = root.querySelector<HTMLElement>("[data-tour-loading]");
  if (!intro || !enter || !frame || root.dataset.bound === "true") return () => {};

  root.dataset.bound = "true";
  let hideTimer: number | undefined;
  const initialState = {
    loaded: root.dataset.loaded,
    started: root.dataset.started,
    introHidden: intro.hidden,
    introAriaHidden: intro.getAttribute("aria-hidden"),
    frameTabIndex: frame.getAttribute("tabindex"),
    loadingHidden: loading?.hidden
  };

  const markLoaded = () => {
    root.dataset.loaded = "true";
    if (loading) loading.hidden = true;
  };
  const enterTour = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.dataset.started = "true";
    frame.tabIndex = 0;
    frame.focus({ preventScroll: true });
    intro.setAttribute("aria-hidden", "true");
    hideTimer = window.setTimeout(() => { intro.hidden = true; }, reduceMotion ? 0 : 760);
  };
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && root.dataset.started !== "true") window.location.assign(options.backHref);
  };

  frame.addEventListener("load", markLoaded);
  enter.addEventListener("click", enterTour);
  window.addEventListener("keydown", handleKeydown);
  if (frame.contentDocument?.readyState === "complete") markLoaded();

  return () => {
    if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    frame.removeEventListener("load", markLoaded);
    enter.removeEventListener("click", enterTour);
    window.removeEventListener("keydown", handleKeydown);
    restoreDataset(root, "loaded", initialState.loaded);
    restoreDataset(root, "started", initialState.started);
    intro.hidden = initialState.introHidden;
    if (initialState.introAriaHidden === null) intro.removeAttribute("aria-hidden");
    else intro.setAttribute("aria-hidden", initialState.introAriaHidden);
    if (initialState.frameTabIndex === null) frame.removeAttribute("tabindex");
    else frame.setAttribute("tabindex", initialState.frameTabIndex);
    if (loading && initialState.loadingHidden !== undefined) loading.hidden = initialState.loadingHidden;
    delete root.dataset.bound;
  };
}

function restoreDataset(root: HTMLElement, key: "loaded" | "started", value: string | undefined) {
  if (value === undefined) delete root.dataset[key];
  else root.dataset[key] = value;
}
