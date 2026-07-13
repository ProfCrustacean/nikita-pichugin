import { museumSiteContent } from "@lib/museum";

export const siteNavigation = [
  { label: "Работы", href: "/works/" },
  { label: "Архив", href: "/archive/" },
  { label: "Выставка", href: museumSiteContent.exhibitionTourPath },
  { label: "Мастерская", href: "/studio/" },
  { label: "Контакты", href: "/contact/" }
] as const;
