import {
  getAssetById,
  getPreviewPath,
  museumAssets,
  museumSiteContent,
  observationWorks,
  type MuseumAsset,
  type MuseumWork
} from "@lib/museum";

const processImageAssetIds = [
  "asset_08ac8803d649faaf",
  "asset_174f128d44438c22",
  "asset_1b3d75f817a204bf",
  "asset_310b6ce3e51ffd6d",
  "asset_6d54118d52c52bb2",
  "asset_7d16ead8bfee2494",
  "asset_8602da5950efa51b",
  "asset_966adab31ca2accb",
  "asset_cad10fc3fab6fa13",
  "asset_cfb5cc509c885bf8",
  "asset_e76222b77938079e"
] as const;
const processImageAssetIdSet = new Set<string>(processImageAssetIds);

const processAltByAssetId = {
  asset_08ac8803d649faaf: "Стеклянные банки, бутылки и воронки на рабочем столе",
  asset_174f128d44438c22: "Тюбики краски, кисти и палитры на рабочем столе",
  asset_1b3d75f817a204bf: "Мастерская с мольбертом, кистями и палитрой у окна",
  asset_310b6ce3e51ffd6d: "Мастихины и тюбик краски на палитре",
  asset_6d54118d52c52bb2: "Использованные тюбики масляной краски",
  asset_7d16ead8bfee2494: "Часы и стеклянные бутылки на подоконнике",
  asset_8602da5950efa51b: "Рабочий стол и мольберт у окна мастерской",
  asset_966adab31ca2accb: "Деревянный мольберт с небольшой работой и палитрой",
  asset_cad10fc3fab6fa13: "Тюбики краски и мастихины на рабочем столе",
  asset_cfb5cc509c885bf8: "Кисти в банках у окна",
  asset_e76222b77938079e: "Кисти, бутылки и лейка на подоконнике мастерской"
} satisfies Record<(typeof processImageAssetIds)[number], string>;

export interface StudioImageView {
  assetId: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface StudioPageModel {
  portrait: StudioImageView;
  processImages: readonly StudioImageView[];
  observationWorks: MuseumWork[];
  exhibitionTourHref: string;
}

function imageView(asset: MuseumAsset, alt: string): StudioImageView {
  return {
    assetId: asset.assetId,
    src: getPreviewPath(asset),
    alt,
    width: asset.previewWidthPx,
    height: asset.previewHeightPx
  };
}

export function buildStudioPageModel(): StudioPageModel {
  const portrait = getAssetById(museumSiteContent.portraitAssetId);
  if (!portrait) throw new Error(`Missing studio portrait ${museumSiteContent.portraitAssetId}`);

  const processImages = processImageAssetIds.map((assetId) => {
    const asset = getAssetById(assetId);
    if (!asset || asset.visualClass !== "studio_or_process_photo") {
      throw new Error(`Missing configured studio process image ${assetId}`);
    }
    return imageView(asset, processAltByAssetId[assetId]);
  });
  const unconfiguredProcessAssets = museumAssets.filter(
    (asset) => asset.visualClass === "studio_or_process_photo" && !processImageAssetIdSet.has(asset.assetId)
  );
  if (unconfiguredProcessAssets.length > 0) {
    throw new Error(`Studio process image ${unconfiguredProcessAssets[0].assetId} needs an intentional order and alt text`);
  }

  return {
    portrait: imageView(portrait, "Портрет Никиты Пичугина"),
    processImages,
    observationWorks,
    exhibitionTourHref: museumSiteContent.exhibitionTourHref
  };
}
