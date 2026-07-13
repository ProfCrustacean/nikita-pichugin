import type { JourneyCopy } from "../journey/journey-types";

interface StaticJourneySceneConfig {
  source: "static";
  image: string;
  alt: string;
  position: string;
  width: number;
  height: number;
}

interface WorkJourneySceneConfig {
  source: "work";
  workId: string;
  alt: string;
  position: string;
}

export interface HomeConfig {
  seo: {
    description: string;
    siteName: string;
    personName: string;
    jobTitle: string;
  };
  hero: {
    workId: string;
    image: string;
    firstName: string;
    lastName: string;
    strapline: string;
  };
  intro: {
    kicker: string;
    headingLines: readonly [string, string];
    body: string;
    cta: string;
    href: string;
  };
  journey: {
    workIds: readonly string[];
    scenes: readonly (StaticJourneySceneConfig | WorkJourneySceneConfig)[];
    copy: JourneyCopy;
  };
  collection: {
    workIds: readonly string[];
    kicker: string;
    heading: string;
    description: string;
    cta: string;
    href: string;
  };
  studio: {
    portraitAlt: string;
    kicker: string;
    heading: string;
    body: string;
    cta: string;
    href: string;
  };
}

export const homeConfig = {
  seo: {
    description: "Мастерская художника Никиты Пичугина: живопись, собрание работ и дорога сквозь пейзаж.",
    siteName: "Никита Пичугин — мастерская художника",
    personName: "Никита Пичугин",
    jobTitle: "Художник"
  },
  hero: {
    workId: "work_e78336cb6f7d8e6e",
    image: "/site/home-hero.webp",
    firstName: "Никита",
    lastName: "Пичугин",
    strapline: "Мастерская художника"
  },
  intro: {
    kicker: "Избранное",
    headingLines: ["Свет, тишина", "и память места."],
    body: "Свет меняет знакомые мотивы: дорогу, воду, снег и небо.",
    cta: "Начать путь",
    href: "#journey"
  },
  journey: {
    workIds: [
      "work_547fc73680582b86",
      "work_2d7f2bbb431fa546",
      "work_38ae0a6796e12026",
      "work_30d1479ac101aae6",
      "work_1696e001498f0ef4",
      "work_5c6e922b751b10ba"
    ],
    scenes: [
      { source: "static", image: "/site/journey/road-to-church.webp", alt: "Летняя дорога к сельской церкви", position: "54% 48%", width: 1637, height: 1178 },
      { source: "static", image: "/site/journey/village-road.webp", alt: "Светлая дорога через деревню", position: "58% 48%", width: 2142, height: 1600 },
      { source: "static", image: "/site/journey/church-field.webp", alt: "Церковь среди открытых полей", position: "50% 52%", width: 1873, height: 1600 },
      { source: "work", workId: "work_5c6e922b751b10ba", alt: "Мир мастерской", position: "50% 45%" }
    ],
    copy: {
      ariaLabel: "Дорога через пейзажи к мастерской художника",
      introKicker: "Дорога к мастерской",
      introTitle: "Идти на свет.",
      introBody: "Листайте вниз. Картины появятся вдоль дороги.",
      captionCta: "Смотреть работу",
      outroKicker: "У порога",
      outroLines: ["Дальше —", "мастерская."],
      routeStart: "Поле",
      routeEnd: "Мастерская",
      fallbackTitle: "Избранные работы"
    }
  },
  collection: {
    workIds: ["work_f1ceaad48a110729", "work_550dd44ad5709fe5", "work_dc8619551aa0ca00"],
    kicker: "Собрание",
    heading: "Живопись и работы на бумаге.",
    description: "Для работ с известными данными указаны год, материалы и размер.",
    cta: "Открыть собрание",
    href: "/works/"
  },
  studio: {
    portraitAlt: "Портрет Никиты Пичугина",
    kicker: "Художник",
    heading: "Внутри мастерской.",
    body: "Здесь — краски, кисти, инструменты и повседневные вещи художника.",
    cta: "Открыть мастерскую",
    href: "/studio/"
  }
} as const satisfies HomeConfig;
