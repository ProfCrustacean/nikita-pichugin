import content from "@data/site-content.json";
import type { Artwork, SiteContent } from "./schema";

export const siteContent = content as SiteContent;

export function getArtworkBySlug(slug: string): Artwork | undefined {
  return siteContent.artworks.find((artwork) => artwork.slug === slug);
}

export function getYears(): string[] {
  const years = new Set(siteContent.artworks.map((artwork) => artwork.year).filter(Boolean));
  return Array.from(years).sort((a, b) => b.localeCompare(a, "ru"));
}

export function getArtworkImage(artwork: Artwork) {
  return artwork.images[0];
}

export function getAdjacentArtwork(slug: string) {
  const index = siteContent.artworks.findIndex((artwork) => artwork.slug === slug);
  if (index < 0) {
    return { previous: undefined, next: undefined };
  }

  return {
    previous: siteContent.artworks[index - 1],
    next: siteContent.artworks[index + 1]
  };
}
