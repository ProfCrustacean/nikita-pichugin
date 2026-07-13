export interface JourneyWork {
  title: string;
  image: string;
  alt: string;
  aspect: number;
  width: number;
  height: number;
  href: string;
}

export interface JourneyClientWork {
  title: string;
  href: string;
}

export interface JourneyScene {
  image: string;
  alt: string;
  position?: string;
  width: number;
  height: number;
}

export interface JourneyCopy {
  ariaLabel: string;
  introKicker: string;
  introTitle: string;
  introBody: string;
  captionCta: string;
  outroKicker: string;
  outroLines: readonly [string, string];
  routeStart: string;
  routeEnd: string;
  fallbackTitle: string;
}
