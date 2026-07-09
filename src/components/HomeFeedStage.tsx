import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HomeGalleryAsset, SiteContent } from "@lib/schema";

interface HomeFeedStageProps {
  gallery: SiteContent["homeGallery"];
}

interface FeedEntry extends HomeGalleryAsset {
  entryId: string;
  sequence: number;
}

interface HoverGate {
  consumedEntryId: string | null;
  activationX: number;
  activationY: number;
  hasMovedAfterConsume: boolean;
  hasLeftBoundary: boolean;
  lockedUntil: number;
}

const KIND_LABEL: Record<HomeGalleryAsset["kind"], string> = {
  artwork: "Работа"
};

const EMPTY_HOVER_GATE: HoverGate = {
  consumedEntryId: null,
  activationX: 0,
  activationY: 0,
  hasMovedAfterConsume: false,
  hasLeftBoundary: true,
  lockedUntil: 0
};
const HOVER_REARM_MOVEMENT_PX = 2;
const HOVER_LOCK_SETTLE_MS = 460;
const CENTERING_ANIMATION_MS = 560;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function createMixedEntries(images: HomeGalleryAsset[]): FeedEntry[] {
  return images.map((image, index) => ({
    ...image,
    entryId: `${image.kind}-${image.wpId}-${index}`,
    sequence: index + 1
  }));
}

function chooseDefaultEntry(entries: FeedEntry[]) {
  return entries[0];
}

function buildFilters(entries: FeedEntry[]) {
  const years = Array.from(new Set(entries.map((entry) => entry.year).filter(Boolean))).sort((a, b) => b.localeCompare(a, "ru"));
  const hasArchive = entries.some((entry) => !entry.year);
  return ["Все", ...years, ...(hasArchive ? ["Архив"] : [])];
}

function clampScrollLeft(value: number, railNode: HTMLElement) {
  return Math.max(0, Math.min(value, railNode.scrollWidth - railNode.clientWidth));
}

function getCenteredScrollLeft(activeNode: HTMLElement, railNode: HTMLElement) {
  const targetLeft = activeNode.offsetLeft - (railNode.clientWidth - activeNode.offsetWidth) / 2;
  return clampScrollLeft(targetLeft, railNode);
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function scrollActiveNodeToCenter(activeNode: HTMLElement, railNode: HTMLElement) {
  railNode.scrollLeft = getCenteredScrollLeft(activeNode, railNode);
}

export default function HomeFeedStage({ gallery }: HomeFeedStageProps) {
  const entries = useMemo(() => createMixedEntries(gallery.images), [gallery.images]);
  const filters = useMemo(() => buildFilters(entries), [entries]);
  const [filter, setFilter] = useState("Все");
  const filteredEntries = useMemo(() => {
    if (filter === "Все") return entries;
    if (filter === "Архив") return entries.filter((entry) => !entry.year);
    return entries.filter((entry) => entry.year === filter);
  }, [entries, filter]);
  const [activeId, setActiveId] = useState(() => chooseDefaultEntry(entries)?.entryId || "");
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const hoverGateRef = useRef<HoverGate>({ ...EMPTY_HOVER_GATE });
  const centeringFrameRef = useRef<number | null>(null);

  const activeEntry = filteredEntries.find((entry) => entry.entryId === activeId) || chooseDefaultEntry(filteredEntries) || entries[0];
  const activeFilteredIndex = Math.max(
    filteredEntries.findIndex((entry) => entry.entryId === activeEntry?.entryId),
    0
  );
  const activeGlobalIndex = Math.max(
    entries.findIndex((entry) => entry.entryId === activeEntry?.entryId),
    0
  );

  function clearCenteringTimers() {
    if (centeringFrameRef.current !== null) {
      window.cancelAnimationFrame(centeringFrameRef.current);
      centeringFrameRef.current = null;
    }
  }

  useIsomorphicLayoutEffect(() => {
    if (!activeEntry) return;
    const activeNode = itemRefs.current[activeEntry.entryId];
    const railNode = activeNode?.parentElement;
    if (!activeNode || !railNode) return;

    clearCenteringTimers();

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const previousScrollSnapType = railNode.style.scrollSnapType;
    railNode.style.scrollSnapType = "none";

    if (prefersReducedMotion) {
      scrollActiveNodeToCenter(activeNode, railNode);
      railNode.style.scrollSnapType = previousScrollSnapType;
      return;
    }

    const startLeft = railNode.scrollLeft;
    const targetLeft = getCenteredScrollLeft(activeNode, railNode);
    const distance = targetLeft - startLeft;

    if (Math.abs(distance) < 1) {
      railNode.scrollLeft = targetLeft;
      railNode.style.scrollSnapType = previousScrollSnapType;
      return;
    }

    const startedAt = window.performance.now();

    const animateCentering = (now: number) => {
      const progress = Math.min((now - startedAt) / CENTERING_ANIMATION_MS, 1);
      railNode.scrollLeft = startLeft + distance * easeOutCubic(progress);

      if (progress < 1) {
        centeringFrameRef.current = window.requestAnimationFrame(animateCentering);
      } else {
        railNode.scrollLeft = targetLeft;
        railNode.style.scrollSnapType = previousScrollSnapType;
        centeringFrameRef.current = null;
      }
    };

    centeringFrameRef.current = window.requestAnimationFrame(animateCentering);

    return () => {
      clearCenteringTimers();
      railNode.style.scrollSnapType = previousScrollSnapType;
    };
  }, [activeEntry]);

  function resetHoverGate() {
    hoverGateRef.current = { ...EMPTY_HOVER_GATE };
  }

  function consumeHover(entryId: string, event: React.PointerEvent<HTMLElement>) {
    hoverGateRef.current = {
      consumedEntryId: entryId,
      activationX: event.clientX,
      activationY: event.clientY,
      hasMovedAfterConsume: false,
      hasLeftBoundary: false,
      lockedUntil: window.performance.now() + HOVER_LOCK_SETTLE_MS
    };
  }

  function isPointInsideEntry(entryId: string, x: number, y: number) {
    const node = itemRefs.current[entryId];
    if (!node) return false;
    const rect = node.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function markHoverBoundaryLeft(event: React.PointerEvent<HTMLElement>) {
    let gate = hoverGateRef.current;
    if (!gate.consumedEntryId || gate.hasLeftBoundary) return;
    const consumedEntryId = gate.consumedEntryId;
    if (window.performance.now() < gate.lockedUntil) return;

    const movement = Math.hypot(event.clientX - gate.activationX, event.clientY - gate.activationY);
    if (movement < HOVER_REARM_MOVEMENT_PX) return;
    if (!gate.hasMovedAfterConsume) {
      gate = {
        ...gate,
        hasMovedAfterConsume: true
      };
      hoverGateRef.current = gate;
    }
    if (!gate.hasMovedAfterConsume) return;
    if (!isPointInsideEntry(consumedEntryId, event.clientX, event.clientY)) {
      hoverGateRef.current = {
        ...gate,
        hasLeftBoundary: true
      };
    }
  }

  function selectEntry(entryId: string) {
    resetHoverGate();
    setActiveId(entryId);
  }

  function applyFilter(nextFilter: string) {
    const nextEntries =
      nextFilter === "Все"
        ? entries
        : nextFilter === "Архив"
          ? entries.filter((entry) => !entry.year)
          : entries.filter((entry) => entry.year === nextFilter);
    resetHoverGate();
    setFilter(nextFilter);
    setActiveId(chooseDefaultEntry(nextEntries)?.entryId || "");
  }

  function moveActive(direction: 1 | -1) {
    if (filteredEntries.length === 0) return;
    const nextIndex = (activeFilteredIndex + direction + filteredEntries.length) % filteredEntries.length;
    resetHoverGate();
    setActiveId(filteredEntries[nextIndex].entryId);
  }

  function handleRailKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveActive(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveActive(-1);
    }
    if (event.key === "Home" && filteredEntries[0]) {
      event.preventDefault();
      selectEntry(filteredEntries[0].entryId);
    }
    if (event.key === "End" && filteredEntries[filteredEntries.length - 1]) {
      event.preventDefault();
      selectEntry(filteredEntries[filteredEntries.length - 1].entryId);
    }
  }

  function handleCardPointerEnter(entry: FeedEntry, event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch") return;
    if (entry.entryId === activeEntry.entryId) return;

    const gate = hoverGateRef.current;
    if (gate.consumedEntryId && !gate.hasLeftBoundary) {
      const movement = Math.hypot(event.clientX - gate.activationX, event.clientY - gate.activationY);
      const leftConsumedBoundary = movement >= HOVER_REARM_MOVEMENT_PX && !isPointInsideEntry(gate.consumedEntryId, event.clientX, event.clientY);
      if (!leftConsumedBoundary) return;
      hoverGateRef.current = {
        ...gate,
        hasMovedAfterConsume: true,
        hasLeftBoundary: true
      };
    }

    setActiveId(entry.entryId);
    consumeHover(entry.entryId, event);
  }

  function handleCardPointerLeave(entry: FeedEntry, event: React.PointerEvent<HTMLButtonElement>) {
    if (hoverGateRef.current.consumedEntryId !== entry.entryId) return;
    markHoverBoundaryLeft(event);
  }

  if (!activeEntry) return null;

  const sourceTitle = activeEntry.caption || activeEntry.title || activeEntry.displayTitle;
  const progress = entries.length ? (activeGlobalIndex / Math.max(entries.length - 1, 1)) * 100 : 0;

  return (
    <section
      className="section home-feed lenta-stage"
      id="lenta"
      aria-labelledby="home-feed-title"
      data-keyboard-gallery
      data-keyboard-mode="click"
      data-keyboard-local-keys
      data-keyboard-managed-scroll
    >
      <div className="lenta-stage__shell">
        <div className="lenta-stage__title-block">
          <span className="rule-label">Лента на главной</span>
          <h2 id="home-feed-title" className="lenta-stage__title" aria-label={gallery.title}>
            <span>Лен</span>
            <span>та</span>
          </h2>
          <p>{gallery.summary}</p>
          <div className="lenta-stage__hint" aria-hidden="true">
            <span className="scroll-icon"></span>
            <span>Влево / вправо</span>
          </div>
        </div>

        <div className="lenta-stage__main">
          <div className="lenta-stage__topline" aria-hidden="true">
            {entries.map((entry, index) => (
              <span key={entry.entryId}>{String(index + 1).padStart(3, "0")}</span>
            ))}
          </div>

          <div className="lenta-stage__filters" aria-label="Фильтр ленты по году">
            {filters.map((item) => {
              const count =
                item === "Все"
                  ? entries.length
                  : item === "Архив"
                    ? entries.filter((entry) => !entry.year).length
                    : entries.filter((entry) => entry.year === item).length;
              return (
                <button
                  key={item}
                  type="button"
                  className="lenta-stage__filter"
                  aria-pressed={filter === item}
                  onClick={() => applyFilter(item)}
                >
                  <span>{item}</span>
                  <small>{String(count).padStart(2, "0")}</small>
                </button>
              );
            })}
          </div>

          <div className="lenta-stage__viewport" onKeyDown={handleRailKeyDown} onPointerMove={markHoverBoundaryLeft} onPointerLeave={markHoverBoundaryLeft}>
            <div className="lenta-stage__floor" aria-hidden="true"></div>
            <div className="lenta-stage__rail" aria-label={gallery.title} tabIndex={0}>
              {filteredEntries.map((entry, index) => {
                const offset = index - activeFilteredIndex;
                const isActive = entry.entryId === activeEntry.entryId;
                const absOffset = Math.abs(offset);
                const depthClass = absOffset > 3 ? "lenta-card--far" : `lenta-card--offset-${offset}`;

                return (
                  <button
                    key={entry.entryId}
                    ref={(node) => {
                      itemRefs.current[entry.entryId] = node;
                    }}
                    type="button"
                    className={`lenta-card ${depthClass}`}
                    aria-current={isActive ? "true" : undefined}
                    data-keyboard-item
                    data-keyboard-active={isActive ? "true" : undefined}
                    data-kind={entry.kind}
                    data-year={entry.year || "archive"}
                    onClick={() => selectEntry(entry.entryId)}
                    onFocus={() => selectEntry(entry.entryId)}
                    onPointerEnter={(event) => handleCardPointerEnter(entry, event)}
                    onPointerLeave={(event) => handleCardPointerLeave(entry, event)}
                  >
                    <span className="lenta-card__year">{entry.year || "Архив"}</span>
                    <img
                      src={entry.localPath}
                      alt={entry.alt || entry.displayTitle || "Изображение из ленты главной"}
                      width={entry.width}
                      height={entry.height}
                      loading={index < 6 ? "eager" : "lazy"}
                    />
                    <span className="lenta-card__caption">
                      <small>{KIND_LABEL[entry.kind]}</small>
                      {entry.displayTitle && <strong>{entry.displayTitle}</strong>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lenta-stage__progress" aria-label={`Элемент ${activeGlobalIndex + 1} из ${entries.length}`}>
            <span>
              {String(activeGlobalIndex + 1).padStart(2, "0")} / {String(entries.length).padStart(2, "0")}
            </span>
            <div className="lenta-stage__progress-track" aria-hidden="true">
              <i style={{ width: `${progress}%` }}></i>
              {entries.map((entry) => (
                <b key={entry.entryId}></b>
              ))}
            </div>
            <small>работа в ленте</small>
          </div>
        </div>

        <aside className="lenta-inspector" aria-label="Выбранный элемент ленты">
          <span className="rule-label">Выбрано</span>
          {activeEntry.displayTitle && <h3>{activeEntry.displayTitle}</h3>}
          {activeEntry.displayTitle && <span className="cyan-rule"></span>}
          <dl>
            <div>
              <dt>Тип</dt>
              <dd>{KIND_LABEL[activeEntry.kind]}</dd>
            </div>
            <div>
              <dt>Год</dt>
              <dd>{activeEntry.year || "Архив"}</dd>
            </div>
            {sourceTitle && (
              <div>
                <dt>Источник</dt>
                <dd>{sourceTitle}</dd>
              </div>
            )}
          </dl>
          <a className="outline-button" href={activeEntry.localPath} target="_blank" rel="noreferrer">
            <span>Открыть работу</span>
            <span aria-hidden="true">→</span>
          </a>
        </aside>
      </div>
    </section>
  );
}
