import { catalogSchema } from "./museum-schema.mjs";

export const SITE_RUNTIME_SCHEMA_VERSION = "1.0.0";
const TRAILING_SLASH_PATH_PATTERN = "^/(?:[^?#]*/)?$";
const LOCAL_HREF_PATTERN = "^/(?:[^?#]*/)?(?:#[A-Za-z][A-Za-z0-9._:-]*)?$";

const pickObjectProperties = (schema, propertyNames) => ({
  ...schema,
  required: propertyNames,
  properties: Object.fromEntries(propertyNames.map((name) => {
    const property = schema.properties[name];
    if (!property) throw new Error(`Unknown schema property: ${name}`);
    return [name, property];
  }))
});

const sourceWork = catalogSchema.$defs.work;
const runtimeTitle = pickObjectProperties(sourceWork.properties.titles.items, [
  "language",
  "type",
  "preferred"
]);
const runtimeCreation = pickObjectProperties(sourceWork.properties.creation, [
  "displayDate",
  "earliestYear",
  "latestYear",
  "status"
]);
const runtimeCapture = pickObjectProperties(sourceWork.properties.capture, [
  "displayDate",
  "status"
]);
const runtimeDimensions = pickObjectProperties(sourceWork.properties.physicalDescription.properties.dimensions, [
  "display",
  "unit",
  "status"
]);
const runtimePhysicalDescription = pickObjectProperties(sourceWork.properties.physicalDescription, [
  "materialsTechniquesDisplay",
  "dimensions",
  "status"
]);
runtimePhysicalDescription.properties.dimensions = runtimeDimensions;
const runtimeSubjects = pickObjectProperties(sourceWork.properties.subjects, [
  "genre",
  "specific",
  "keywords"
]);
const runtimeWork = pickObjectProperties(sourceWork, [
  "workId",
  "publicSlug",
  "recordType",
  "objectWorkType",
  "titles",
  "displayTitle",
  "creation",
  "capture",
  "physicalDescription",
  "subjects",
  "description",
  "assetIds",
  "relatedWorkIds",
  "recordSource"
]);
runtimeWork.properties.titles = {
  ...sourceWork.properties.titles,
  items: runtimeTitle
};
runtimeWork.properties.creation = runtimeCreation;
runtimeWork.properties.capture = runtimeCapture;
runtimeWork.properties.physicalDescription = runtimePhysicalDescription;
runtimeWork.properties.subjects = runtimeSubjects;
runtimeWork.properties.description = {
  type: "object",
  additionalProperties: false,
  required: ["ru"],
  properties: { ru: { type: "string", minLength: 1 } }
};
runtimeWork.properties.recordSource = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["collection"],
    properties: {
      collection: { type: "string", minLength: 1 }
    }
  }
};

const runtimeAsset = pickObjectProperties(catalogSchema.$defs.asset, [
  "assetId",
  "previewPath",
  "previewWidthPx",
  "previewHeightPx",
  "visualClass"
]);

const counts = {
  type: "object",
  additionalProperties: false,
  required: [
    "assets",
    "works",
    "artworkWorks",
    "photographicWorks",
    "placements",
    "authorities",
    "needsReview",
    "needsOwnerInput"
  ],
  properties: Object.fromEntries([
    "assets",
    "works",
    "artworkWorks",
    "photographicWorks",
    "placements",
    "authorities",
    "needsReview",
    "needsOwnerInput"
  ].map((name) => [name, { type: "integer", minimum: 0 }]))
};

const contact = {
  type: "object",
  additionalProperties: false,
  required: ["phone", "phoneHref", "email", "vk", "telegram"],
  properties: {
    phone: { type: "string", minLength: 1 },
    phoneHref: { type: "string", pattern: "^\\+[0-9]+$" },
    email: { type: "string", format: "email" },
    vk: { type: "string", format: "uri" },
    telegram: { type: "string", format: "uri" }
  }
};

export const siteConfigSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "brand",
    "defaultDescription",
    "footerInquiryLabel",
    "exhibitionTourHref",
    "navigation",
    "contact",
    "portraitAssetId",
    "staticRoutes"
  ],
  properties: {
    schemaVersion: { const: SITE_RUNTIME_SCHEMA_VERSION },
    brand: { $ref: "#/$defs/localizedText" },
    defaultDescription: { type: "string", minLength: 1 },
    footerInquiryLabel: { type: "string", minLength: 1 },
    exhibitionTourHref: { type: "string", pattern: LOCAL_HREF_PATTERN },
    navigation: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "href"],
        properties: {
          label: { type: "string", minLength: 1 },
          href: { type: "string", pattern: LOCAL_HREF_PATTERN }
        }
      }
    },
    contact,
    portraitAssetId: { type: "string", pattern: "^asset_[a-f0-9]{16}$" },
    staticRoutes: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { type: "string", pattern: TRAILING_SLASH_PATH_PATTERN }
    }
  }
};

const redirect = {
  type: "object",
  additionalProperties: false,
  required: ["source", "destination"],
  properties: {
    source: { type: "string", pattern: TRAILING_SLASH_PATH_PATTERN },
    destination: { type: "string", pattern: TRAILING_SLASH_PATH_PATTERN }
  }
};

const stringIndex = {
  type: "object",
  additionalProperties: { type: "integer", minimum: 0 }
};

export const siteRuntimeSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `https://nikitapichugin.ru/schemas/site-runtime-${SITE_RUNTIME_SCHEMA_VERSION}.json`,
  title: "Nikita Pichugin deterministic site runtime bundle",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "sourceSnapshotId",
    "sourceDigest",
    "manifest",
    "counts",
    "works",
    "assets",
    "indexes",
    "legacyRedirects",
    "fixtures",
    "routeRegistry"
  ],
  properties: {
    schemaVersion: { const: SITE_RUNTIME_SCHEMA_VERSION },
    sourceSnapshotId: { type: "string", minLength: 8 },
    sourceDigest: { type: "string", pattern: "^[a-f0-9]{64}$" },
    manifest: { $ref: "#/$defs/manifest" },
    counts,
    works: { type: "array", minItems: 1, items: { $ref: "#/$defs/runtimeWork" } },
    assets: { type: "array", minItems: 1, items: { $ref: "#/$defs/runtimeAsset" } },
    indexes: {
      type: "object",
      additionalProperties: false,
      required: ["workIdToIndex", "workSlugToIndex", "assetIdToIndex"],
      properties: {
        workIdToIndex: stringIndex,
        workSlugToIndex: stringIndex,
        assetIdToIndex: stringIndex
      }
    },
    legacyRedirects: { type: "array", minItems: 3, items: redirect },
    fixtures: {
      type: "object",
      additionalProperties: false,
      required: ["artworkSlug", "photographicWorkSlug", "multiAssetWorkSlug"],
      properties: {
        artworkSlug: { type: "string", minLength: 1 },
        photographicWorkSlug: { type: "string", minLength: 1 },
        multiAssetWorkSlug: { type: "string", minLength: 1 }
      }
    },
    routeRegistry: {
      type: "object",
      additionalProperties: false,
      required: ["workPaths"],
      properties: {
        workPaths: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", pattern: "^/works/.+/$" } }
      }
    }
  },
  $defs: {
    ...catalogSchema.$defs,
    runtimeWork,
    runtimeAsset
  }
};
