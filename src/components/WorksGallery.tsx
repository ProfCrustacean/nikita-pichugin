import { useMemo, useState } from "react";
import type { Artwork } from "@lib/schema";

interface WorksGalleryProps {
  artworks: Artwork[];
  titleMode?: "split" | "normal";
  standalone?: boolean;
}

export default function WorksGallery({ artworks, titleMode = "normal", standalone = false }: WorksGalleryProps) {
  const years = useMemo(() => Array.from(new Set(artworks.map((artwork) => artwork.year).filter(Boolean))).sort().reverse(), [artworks]);
  const recentYears = useMemo(() => years.slice(0, 4), [years]);
  const filters = ["Все", ...years, "Архив"];
  const defaultFilter = years[0] || "Все";
  const [filter, setFilter] = useState(defaultFilter);
  const filtered = useMemo(() => {
    if (filter === "Все") return artworks;
    if (filter === "Архив") return artworks.filter((artwork) => !recentYears.includes(artwork.year));
    return artworks.filter((artwork) => artwork.year === filter);
  }, [artworks, filter, recentYears]);
  const [activeSlug, setActiveSlug] = useState(() => {
    const firstOfDefaultYear = artworks.find((artwork) => artwork.year === defaultFilter);
    return firstOfDefaultYear?.slug || artworks[0]?.slug;
  });
  const active = filtered.find((artwork) => artwork.slug === activeSlug) || filtered[0] || artworks[0];
  const activeImage = active.images[0];
  const activeIndex = filtered.findIndex((artwork) => artwork.slug === active.slug) + 1;
  const activeMeta = [active.medium, active.dimensions, active.year && `${active.year} г.`].filter(Boolean).join(" / ");
  const filterLabel = filter === "Все" ? "Все годы" : filter === "Архив" ? "Архив без года" : `${filter} год`;

  return (
    <section
      id="works"
      className={`section archive-performance ${standalone ? "archive-performance--standalone" : ""}`}
      aria-labelledby="works-title"
      data-keyboard-gallery
      data-keyboard-mode="click"
    >
      <div className="section__inner works-stage works-stage--archive">
        <div className="archive-performance__heading">
          <span className="rule-label">Архив работ</span>
          <h2 id="works-title" className={`section-title ${titleMode === "split" ? "section-title--split" : ""}`}>
            Работы
          </h2>
          <span className="cyan-rule"></span>
          <p className="archive-performance__lead">Выберите год, затем листайте все работы этого года как открытую подборку.</p>
        </div>

        <div className="works-stage__filters archive-years" aria-label="Фильтр по году">
          {filters.map((item) => {
            const next =
              item === "Все"
                ? artworks[0]
                : item === "Архив"
                  ? artworks.find((artwork) => !recentYears.includes(artwork.year))
                  : artworks.find((artwork) => artwork.year === item);
            const count =
              item === "Все"
                ? artworks.length
                : item === "Архив"
                  ? artworks.filter((artwork) => !recentYears.includes(artwork.year)).length
                  : artworks.filter((artwork) => artwork.year === item).length;

            return (
              <button
                className="filter-button"
                key={item}
                type="button"
                aria-pressed={filter === item}
                onClick={() => {
                  setFilter(item);
                  if (next) setActiveSlug(next.slug);
                }}
                disabled={!next}
              >
                <span>{item}</span>
                <small>{String(count).padStart(2, "0")}</small>
              </button>
            );
          })}
        </div>

        <div className="archive-year-summary" aria-live="polite">
          <span>{filterLabel}</span>
          <strong>{filtered.length} работ</strong>
        </div>

        <div className="archive-focus" aria-live="polite">
          <div className="archive-focus__media">
            {activeImage && (
              <img
                src={activeImage.localPath}
                alt={activeImage.alt || active.title}
                width={activeImage.width}
                height={activeImage.height}
                loading="eager"
              />
            )}
            <span className="archive-focus__number">{String(Math.max(activeIndex, 1)).padStart(2, "0")}</span>
          </div>
          <aside className="work-inspector archive-focus__copy" aria-label="Выбранная работа">
            <span className="rule-label">Выбранная работа</span>
            <h3>{active.title}</h3>
            <p className="work-inspector__detail">{activeMeta || "Метаданные на старом сайте не указаны."}</p>
            <p className="work-inspector__description">{active.description || "Описание на старом сайте не указано."}</p>
            <a className="outline-button" href={`/portfolios/${active.slug}/`}>
              <span>Открыть работу</span>
              <span aria-hidden="true">→</span>
            </a>
          </aside>
        </div>

        <div className="archive-index" aria-label={`Работы: ${filterLabel}`}>
          {filtered.map((artwork, index) => (
            <button
              className="archive-index__row"
              key={artwork.slug}
              type="button"
              aria-current={artwork.slug === active.slug ? "true" : undefined}
              data-keyboard-item
              data-keyboard-active={artwork.slug === active.slug ? "true" : undefined}
              onFocus={() => setActiveSlug(artwork.slug)}
              onMouseEnter={() => setActiveSlug(artwork.slug)}
              onClick={() => setActiveSlug(artwork.slug)}
            >
              {artwork.images[0] && (
                <img
                  src={artwork.images[0].localPath}
                  alt=""
                  width={artwork.images[0].width}
                  height={artwork.images[0].height}
                  loading={index < 8 ? "eager" : "lazy"}
                />
              )}
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{artwork.title}</strong>
              <em>{artwork.year || "Архив"}</em>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
