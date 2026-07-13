import {
  artworkWorks,
  getAssetById,
  getPreviewPath,
  getPrimaryAsset,
  getWorkById,
  getWorkHref,
  museumSiteContent,
  type MuseumAsset,
  type MuseumWork
} from "../../lib/museum";
import type { JourneyScene, JourneyWork } from "../journey/journey-types";
import { homeConfig } from "./home-config";

export interface HomeImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface HomeCollectionWork {
  title: string;
  date: string | null;
  href: string;
  image: HomeImage;
}

export interface HomePageModel {
  seo: {
    description: string;
    image: string;
    imageAlt: string;
    jsonLd: Record<string, unknown>;
  };
  hero: typeof homeConfig.hero & { workTitle: string; width: number; height: number };
  intro: typeof homeConfig.intro;
  journey: { works: JourneyWork[]; scenes: JourneyScene[]; copy: typeof homeConfig.journey.copy };
  collection: typeof homeConfig.collection & { workCount: number; works: HomeCollectionWork[] };
  studio: typeof homeConfig.studio & { portrait: HomeImage };
}

function requireWork(workId: string): MuseumWork {
  const work = getWorkById(workId);
  if (!work) throw new Error(`Missing homepage work ${workId}`);
  return work;
}

function requireAsset(assetId: string): MuseumAsset {
  const asset = getAssetById(assetId);
  if (!asset) throw new Error(`Missing homepage asset ${assetId}`);
  return asset;
}

function toJourneyWork(work: MuseumWork): JourneyWork {
  const asset = getPrimaryAsset(work);
  return {
    title: work.displayTitle.ru,
    image: getPreviewPath(asset),
    alt: work.displayTitle.ru,
    aspect: asset.previewWidthPx / asset.previewHeightPx,
    width: asset.previewWidthPx,
    height: asset.previewHeightPx,
    href: getWorkHref(work)
  };
}

function toCollectionWork(work: MuseumWork): HomeCollectionWork {
  const asset = getPrimaryAsset(work);
  return {
    title: work.displayTitle.ru,
    date: work.creation.displayDate,
    href: getWorkHref(work),
    image: {
      src: getPreviewPath(asset),
      alt: "",
      width: asset.previewWidthPx,
      height: asset.previewHeightPx
    }
  };
}

export function buildHomePageModel(siteUrl: URL): HomePageModel {
  const heroWork = requireWork(homeConfig.hero.workId);
  const heroAsset = getPrimaryAsset(heroWork);
  const portraitAsset = requireAsset(museumSiteContent.portraitAssetId);
  const portraitPath = getPreviewPath(portraitAsset);
  const scenes = homeConfig.journey.scenes.map((scene): JourneyScene => {
    if (scene.source === "static") return scene;
    const asset = getPrimaryAsset(requireWork(scene.workId));
    return {
      image: getPreviewPath(asset),
      alt: scene.alt,
      position: scene.position,
      width: asset.previewWidthPx,
      height: asset.previewHeightPx
    };
  });

  return {
    seo: {
      description: homeConfig.seo.description,
      image: homeConfig.hero.image,
      imageAlt: heroWork.displayTitle.ru,
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            name: homeConfig.seo.siteName,
            url: new URL("/", siteUrl).href,
            inLanguage: "ru"
          },
          {
            "@type": "Person",
            name: homeConfig.seo.personName,
            url: new URL("/studio/", siteUrl).href,
            image: new URL(portraitPath, siteUrl).href,
            jobTitle: homeConfig.seo.jobTitle
          }
        ]
      }
    },
    hero: {
      ...homeConfig.hero,
      workTitle: heroWork.displayTitle.ru,
      width: heroAsset.previewWidthPx,
      height: heroAsset.previewHeightPx
    },
    intro: homeConfig.intro,
    journey: {
      works: homeConfig.journey.workIds.map(requireWork).map(toJourneyWork),
      scenes,
      copy: homeConfig.journey.copy
    },
    collection: {
      ...homeConfig.collection,
      workCount: artworkWorks.length,
      works: homeConfig.collection.workIds.map(requireWork).map(toCollectionWork)
    },
    studio: {
      ...homeConfig.studio,
      portrait: {
        src: portraitPath,
        alt: homeConfig.studio.portraitAlt,
        width: portraitAsset.previewWidthPx,
        height: portraitAsset.previewHeightPx
      }
    }
  };
}
