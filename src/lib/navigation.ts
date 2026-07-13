import { museumSiteContent } from "@lib/museum";

export const siteNavigation = [
  ...museumSiteContent.navigation
] as const;
