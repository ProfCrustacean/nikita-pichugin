export interface ImageAsset {
  localPath: string;
  sourceUrl: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

export interface HomeGalleryAsset extends ImageAsset {
  wpId: number;
  title: string;
  displayTitle: string;
  year: string;
  kind: "artwork";
}

export interface Artwork {
  wpId: number;
  slug: string;
  title: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  images: ImageAsset[];
  sourcePageUrl: string;
}

export interface NavigationItem {
  label: string;
  href: string;
}

export interface ContactLink {
  label: string;
  href: string;
}

export interface SiteContent {
  brand: {
    name: string;
    description: string;
  };
  intro: {
    text: string;
    englishText: string;
    virtualTourUrl: string;
  };
  portrait: ImageAsset;
  navigation: NavigationItem[];
  highlights: string[];
  artworks: Artwork[];
  homeGallery: {
    title: string;
    summary: string;
    images: HomeGalleryAsset[];
  };
  photoWorks: {
    intro: string[];
    images: ImageAsset[];
  };
  contact: {
    description: string;
    phone: string;
    phoneHref: string;
    email: string;
    emailHref: string;
    social: ContactLink[];
  };
  source: {
    importedAt: string;
    wordpressBaseUrl: string;
    pages: Record<string, string>;
  };
}
