import type { APIRoute } from "astro";
import { getRouteRegistry } from "../domain/catalog/repository";

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL("https://nikita-pichugin.onrender.com");
  const paths = getRouteRegistry().sitemapPaths;
  const urls = paths.map((pathname) => `  <url><loc>${new URL(pathname, base).href}</loc></url>`).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
