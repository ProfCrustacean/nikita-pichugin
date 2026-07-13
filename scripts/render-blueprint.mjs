export function validateRedirects(redirects) {
  if (!Array.isArray(redirects) || redirects.length === 0) throw new Error("Render redirects are required");
  const sources = new Set();
  for (const redirect of redirects) {
    for (const key of ["source", "destination"]) {
      const value = redirect?.[key];
      if (typeof value !== "string" || !value.startsWith("/") || /[\r\n]/.test(value)) {
        throw new Error(`Invalid Render redirect ${key}: ${JSON.stringify(value)}`);
      }
    }
    if (sources.has(redirect.source)) throw new Error(`Duplicate Render redirect: ${redirect.source}`);
    sources.add(redirect.source);
  }
}

export function formatRenderBlueprint(redirects) {
  validateRedirects(redirects);
  const routes = redirects.map(({ source, destination }) => [
    "      - type: redirect",
    `        source: ${source}`,
    `        destination: ${destination}`
  ].join("\n")).join("\n");

  return [
    "services:",
    "  - type: web",
    "    name: nikita-pichugin",
    "    runtime: static",
    "    buildCommand: npm run build:deploy",
    "    staticPublishPath: ./dist",
    "    routes:",
    routes,
    ""
  ].join("\n");
}
