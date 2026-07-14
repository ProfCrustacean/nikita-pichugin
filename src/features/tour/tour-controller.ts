export type TourCleanup = () => void;

export function initTour(root: HTMLElement): TourCleanup {
  const intro = root.querySelector<HTMLElement>("[data-tour-intro]");
  const enter = root.querySelector<HTMLButtonElement>("[data-tour-enter]");
  const exit = root.querySelector<HTMLButtonElement>("[data-tour-exit]");
  const frame = root.querySelector<HTMLIFrameElement>("[data-tour-frame]");
  const loading = root.querySelector<HTMLElement>("[data-tour-loading]");
  if (!intro || !enter || !exit || !frame || !loading || root.dataset.bound === "true") return () => {};

  root.dataset.bound = "true";
  let hideTimer: number | undefined;
  let scrollRestoreTimer: number | undefined;
  let frameWindow: Window | null = null;
  let activationScrollY: number | undefined;
  const initialState = {
    loaded: root.dataset.loaded,
    started: root.dataset.started,
    introHidden: intro.hidden,
    introAriaHidden: intro.getAttribute("aria-hidden"),
    exitHidden: exit.hidden,
    frameTabIndex: frame.getAttribute("tabindex"),
    frameSrc: frame.getAttribute("src"),
    loadingHidden: loading.hidden
  };

  const removeFrameKeydown = () => {
    frameWindow?.removeEventListener("keydown", handleKeydown, true);
    frameWindow = null;
  };
  const bindFrameKeydown = () => {
    removeFrameKeydown();
    try {
      frameWindow = frame.contentWindow;
      frameWindow?.addEventListener("keydown", handleKeydown, true);
    } catch {
      frameWindow = null;
    }
  };
  const markLoaded = () => {
    root.dataset.loaded = "true";
    loading.hidden = true;
    bindFrameKeydown();
    if (root.dataset.started === "true" && activationScrollY !== undefined) {
      const scrollY = activationScrollY;
      scrollRestoreTimer = window.setTimeout(() => {
        const previousBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, scrollY);
        document.documentElement.style.scrollBehavior = previousBehavior;
      }, 0);
    }
  };
  const enterTour = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    activationScrollY = window.scrollY;
    if (!frame.getAttribute("src")) {
      const source = frame.dataset.tourSrc;
      if (!source) return;
      loading.hidden = false;
      frame.src = source;
    }
    root.dataset.started = "true";
    frame.tabIndex = 0;
    exit.hidden = false;
    intro.setAttribute("aria-hidden", "true");
    hideTimer = window.setTimeout(() => { intro.hidden = true; }, reduceMotion ? 0 : 760);
    exit.focus({ preventScroll: true });
  };
  const leaveTour = () => {
    if (root.dataset.started !== "true") return;
    if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    if (scrollRestoreTimer !== undefined) window.clearTimeout(scrollRestoreTimer);
    hideTimer = undefined;
    scrollRestoreTimer = undefined;
    activationScrollY = undefined;
    delete root.dataset.started;
    intro.hidden = false;
    intro.removeAttribute("aria-hidden");
    exit.hidden = true;
    frame.tabIndex = -1;
    enter.focus({ preventScroll: true });
  };
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || root.dataset.started !== "true") return;
    event.preventDefault();
    leaveTour();
  };

  frame.addEventListener("load", markLoaded);
  enter.addEventListener("click", enterTour);
  exit.addEventListener("click", leaveTour);
  window.addEventListener("keydown", handleKeydown);

  return () => {
    if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    if (scrollRestoreTimer !== undefined) window.clearTimeout(scrollRestoreTimer);
    removeFrameKeydown();
    frame.removeEventListener("load", markLoaded);
    enter.removeEventListener("click", enterTour);
    exit.removeEventListener("click", leaveTour);
    window.removeEventListener("keydown", handleKeydown);
    restoreDataset(root, "loaded", initialState.loaded);
    restoreDataset(root, "started", initialState.started);
    intro.hidden = initialState.introHidden;
    exit.hidden = initialState.exitHidden;
    if (initialState.introAriaHidden === null) intro.removeAttribute("aria-hidden");
    else intro.setAttribute("aria-hidden", initialState.introAriaHidden);
    if (initialState.frameTabIndex === null) frame.removeAttribute("tabindex");
    else frame.setAttribute("tabindex", initialState.frameTabIndex);
    if (initialState.frameSrc === null) frame.removeAttribute("src");
    else frame.setAttribute("src", initialState.frameSrc);
    loading.hidden = initialState.loadingHidden;
    delete root.dataset.bound;
  };
}

function restoreDataset(root: HTMLElement, key: "loaded" | "started", value: string | undefined) {
  if (value === undefined) delete root.dataset[key];
  else root.dataset[key] = value;
}
