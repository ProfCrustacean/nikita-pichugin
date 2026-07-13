import { acquireDocumentScrollLock } from "./scroll-lock";

interface HeaderOptions {
  inertTargets?: readonly HTMLElement[];
}

export function initHeader(root: HTMLElement, options: HeaderOptions = {}): () => void {
  const button = root.querySelector<HTMLButtonElement>("[data-site-menu-button]");
  const navigation = root.querySelector<HTMLElement>("[data-site-navigation]");
  const buttonLabel = button?.querySelector<HTMLElement>(".sr-only");
  if (!button || !navigation || root.dataset.bound === "true") return () => {};

  root.dataset.bound = "true";
  let menuFocusTimer: number | undefined;
  let releaseScrollLock: (() => void) | undefined;

  const updateHeader = () => root.classList.toggle("is-scrolled", window.scrollY > 24);
  const setBackgroundInert = (inert: boolean) => {
    options.inertTargets?.forEach((target) => { target.inert = inert; });
  };
  const closeMenu = (restoreFocus = false) => {
    if (menuFocusTimer !== undefined) window.clearTimeout(menuFocusTimer);
    menuFocusTimer = undefined;
    root.classList.remove("is-menu-open");
    document.documentElement.classList.remove("sunday-menu-open");
    releaseScrollLock?.();
    releaseScrollLock = undefined;
    button.setAttribute("aria-expanded", "false");
    if (buttonLabel) buttonLabel.textContent = "Открыть меню";
    setBackgroundInert(false);
    if (restoreFocus) button.focus();
  };
  const openMenu = () => {
    root.classList.add("is-menu-open");
    document.documentElement.classList.add("sunday-menu-open");
    releaseScrollLock = acquireDocumentScrollLock("site-menu");
    button.setAttribute("aria-expanded", "true");
    if (buttonLabel) buttonLabel.textContent = "Закрыть меню";
    setBackgroundInert(true);
    menuFocusTimer = window.setTimeout(() => {
      menuFocusTimer = undefined;
      if (root.classList.contains("is-menu-open") && document.activeElement === button) {
        navigation.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
      }
    }, 320);
  };
  const toggleMenu = () => root.classList.contains("is-menu-open") ? closeMenu(true) : openMenu();
  const closeFromNavigation = () => closeMenu(false);
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && root.classList.contains("is-menu-open")) closeMenu(true);
    if (event.key !== "Tab" || !root.classList.contains("is-menu-open")) return;

    const focusable = Array.from(root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"))
      .filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  button.addEventListener("click", toggleMenu);
  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeFromNavigation));
  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("keydown", handleKeydown);
  updateHeader();

  return () => {
    closeMenu(false);
    button.removeEventListener("click", toggleMenu);
    navigation.querySelectorAll("a").forEach((link) => link.removeEventListener("click", closeFromNavigation));
    window.removeEventListener("scroll", updateHeader);
    window.removeEventListener("keydown", handleKeydown);
    delete root.dataset.bound;
  };
}
