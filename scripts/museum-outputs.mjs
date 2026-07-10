import { SCHEMA_VERSION } from "./museum-schema.mjs";
import { xmlEscape } from "./museum-catalog.mjs";

export function buildPublicCatalog({ generatedAt, works, assets }) {
  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    artist: {
      authorityId: "person_nikita_pichugin",
      displayName: { ru: "Никита Пичугин", en: "Nikita Pichugin" }
    },
    works: works.map((work) => ({
      id: work.workId,
      slug: work.publicSlug,
      type: work.recordType,
      objectWorkType: work.objectWorkType,
      title: work.displayTitle,
      date: work.creation.displayDate,
      dateStatus: work.creation.status,
      materialsTechniques: work.physicalDescription.materialsTechniquesDisplay,
      materialsStatus: work.physicalDescription.status,
      dimensions: work.physicalDescription.dimensions.display,
      dimensionsStatus: work.physicalDescription.dimensions.status,
      subjects: work.subjects,
      description: work.description,
      images: work.assetIds
        .map((assetId) => assetById.get(assetId))
        .filter(Boolean)
        .map((asset) => ({
          assetId: asset.assetId,
          originalPath: `../${asset.originalPath}`,
          previewPath: `../${asset.previewPath}`,
          width: asset.widthPx,
          height: asset.heightPx,
          visualClass: asset.visualClass,
          reviewStatus: asset.reviewStatus
        })),
      metadataStatus: work.fieldStatus,
      reviewStatus: work.qualityControl.reviewStatus
    }))
  };
}

export function buildOwnerInputCsv(works) {
  const header = [
    "recordId",
    "publicSlug",
    "titleRu",
    "field",
    "currentStatus",
    "valueToConfirm",
    "note"
  ];
  const rows = [];
  for (const work of works) {
    const candidates = [
      ["artistInventoryNumber", work.artistInventoryNumber.status, "Укажите настоящий авторский или музейный номер, если он существует и может быть опубликован."],
      ["artistTitle", work.titles.some((title) => title.language === "ru" && title.type === "source_stated") ? "known" : "needs_owner_input", "Подтвердите авторское название, если оно существует."],
      ["creationDate", work.creation.status, "Укажите год или диапазон создания."],
      ["materialsTechniques", work.physicalDescription.status, "Укажите основу и технику."],
      ["dimensions", work.physicalDescription.dimensions.status, "Укажите размеры в сантиметрах и порядок осей."],
      ["inscriptions", work.fieldStatus.inscriptions, "Укажите подпись, дату и другие надписи на работе или подтвердите их отсутствие."],
      ["condition", work.history.condition.status, "Добавьте сведения о состоянии, если они известны."],
      ["currentOwner", work.history.currentOwner.status, "Укажите владельца, если это можно публиковать."],
      ["currentLocation", work.history.currentLocation.status, "Укажите местонахождение, если это можно публиковать."],
      ["exhibitions", work.history.exhibitions.status, "Добавьте выставки или подтвердите их отсутствие."],
      ["bibliography", work.history.bibliography.status, "Добавьте публикации или подтвердите их отсутствие."],
      ["workCopyright", work.rights.workCopyright.status, "Подтвердите правообладателя произведения."],
      ["imageCopyright", work.rights.imageCopyright.status, "Подтвердите правообладателя репродукции."]
    ];
    for (const [field, currentStatus, note] of candidates) {
      if (currentStatus !== "known") {
        rows.push([work.workId, work.publicSlug, work.displayTitle.ru, field, currentStatus, "", note]);
      }
    }
  }
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function buildReviewHtml({ generatedAt, works, assets, placements }) {
  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const placementsByWork = new Map();
  for (const placement of placements) {
    if (!placement.workId) continue;
    if (!placementsByWork.has(placement.workId)) placementsByWork.set(placement.workId, []);
    placementsByWork.get(placement.workId).push(placement);
  }

  const cards = works
    .map((work) => {
      const workAssets = work.assetIds.map((assetId) => assetById.get(assetId)).filter(Boolean);
      const first = workAssets[0];
      const workPlacements = placementsByWork.get(work.workId) || [];
      const rawLabels = [...new Set(workPlacements.map((item) => item.rawLabel).filter(Boolean))];
      const missing = Object.entries(work.fieldStatus)
        .filter(([, value]) => value !== "known" && value !== "not_applicable")
        .map(([key]) => key);
      return `<article class="card" data-type="${xmlEscape(work.recordType)}" data-review="${xmlEscape(work.qualityControl.reviewStatus)}">
        <a class="image" href="../${xmlEscape(first?.originalPath || "")}">
          ${first ? `<img src="../${xmlEscape(first.previewPath)}" alt="${xmlEscape(work.displayTitle.ru)}" loading="lazy">` : ""}
        </a>
        <div class="body">
          <div class="eyebrow">${xmlEscape(work.recordType)} · ${xmlEscape(work.workId)}</div>
          <h2>${xmlEscape(work.displayTitle.ru)}</h2>
          <p class="en">${xmlEscape(work.displayTitle.en)}</p>
          <dl>
            <div><dt>Дата</dt><dd>${xmlEscape(work.creation.displayDate || work.creation.status)}</dd></div>
            <div><dt>Материалы</dt><dd>${xmlEscape(work.physicalDescription.materialsTechniquesDisplay || work.physicalDescription.status)}</dd></div>
            <div><dt>Размеры</dt><dd>${xmlEscape(work.physicalDescription.dimensions.display || work.physicalDescription.dimensions.status)}</dd></div>
            <div><dt>Файлы</dt><dd>${workAssets.length}</dd></div>
          </dl>
          <p>${xmlEscape(work.description.ru)}</p>
          ${rawLabels.length ? `<details><summary>Исходные подписи</summary><ul>${rawLabels.map((label) => `<li>${xmlEscape(label)}</li>`).join("")}</ul></details>` : ""}
          <div class="tags">${missing.map((field) => `<span>${xmlEscape(field)}</span>`).join("")}</div>
        </div>
      </article>`;
    })
    .join("\n");

  const counts = {
    works: works.length,
    assets: assets.length,
    needsReview: works.filter((work) => work.qualityControl.reviewStatus !== "verified").length
  };

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%231c1917'/%3E%3Cpath d='M18 46V18h8l12 18V18h8v28h-8L26 28v18z' fill='%23f5f5f4'/%3E%3C/svg%3E">
  <title>Проверка музейного каталога Никиты Пичугина</title>
  <style>
    :root{color-scheme:light;--ink:#171713;--muted:#6d6c62;--paper:#f4f1e8;--line:#d6d0c0;--accent:#8f2d1f}*{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    header{position:sticky;top:0;z-index:3;padding:20px clamp(18px,4vw,64px);background:rgba(244,241,232,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(14px)}
    h1{margin:0 0 8px;font:500 clamp(25px,4vw,48px)/1.05 Georgia,serif}.meta{color:var(--muted)}
    .filters{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.filters button{border:1px solid var(--line);border-radius:99px;background:transparent;padding:8px 13px;cursor:pointer}.filters button.active{background:var(--ink);color:var(--paper)}
    main{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:1px;background:var(--line);border-bottom:1px solid var(--line)}
    .card{background:var(--paper);min-width:0}.card[hidden]{display:none}.image{display:block;aspect-ratio:4/3;background:#ddd8ca;overflow:hidden}.image img{width:100%;height:100%;object-fit:contain;display:block}.body{padding:20px}.eyebrow{color:var(--accent);font-size:12px;letter-spacing:.08em;text-transform:uppercase}
    h2{font:500 25px/1.1 Georgia,serif;margin:8px 0 3px}.en{color:var(--muted);margin:0 0 16px}dl{border-top:1px solid var(--line);margin:0 0 14px}dl div{display:grid;grid-template-columns:90px 1fr;border-bottom:1px solid var(--line);padding:6px 0}dt{color:var(--muted)}dd{margin:0}.tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:14px}.tags span{font-size:11px;border:1px solid var(--line);padding:3px 7px;border-radius:99px}details{color:var(--muted)}
  </style>
</head>
<body>
  <header>
    <h1>Музейный каталог</h1>
    <div class="meta">${counts.works} работ · ${counts.assets} оригинальных файлов · ${counts.needsReview} записей требуют уточнения · ${xmlEscape(generatedAt)}</div>
    <nav class="filters" aria-label="Фильтры">
      <button class="active" data-filter="all">Все</button>
      <button data-filter="artwork">Картины</button>
      <button data-filter="photographic_work">Фотоработы</button>
      <button data-filter="needs_review">Нужна проверка</button>
    </nav>
  </header>
  <main>${cards}</main>
  <script>
    const buttons=[...document.querySelectorAll('[data-filter]')];
    const cards=[...document.querySelectorAll('.card')];
    for(const button of buttons)button.addEventListener('click',()=>{buttons.forEach(x=>x.classList.remove('active'));button.classList.add('active');const value=button.dataset.filter;for(const card of cards)card.hidden=value!=='all'&&card.dataset.type!==value&&card.dataset.review!==value;});
  </script>
</body>
</html>`;
}

export function buildLidoXml(works, assets) {
  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const records = works.map((work) => buildLidoRecord(work, assetById)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<lido:lidoWrap xmlns:lido="http://www.lido-schema.org" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.lido-schema.org https://lido-schema.org/schema/v1.1/lido-v1.1.xsd" lido:relatedencoding="LIDO 1.1">
${records}
</lido:lidoWrap>\n`;
}

function buildLidoRecord(work, assetById) {
  const dimensions = work.physicalDescription.dimensions;
  const resources = work.assetIds
    .map((assetId) => assetById.get(assetId))
    .filter(Boolean)
    .map((asset) => `
        <lido:resourceSet>
          <lido:resourceID lido:type="http://terminology.lido-schema.org/identifier_type/uri">${xmlEscape(asset.assetId)}</lido:resourceID>
          <lido:resourceRepresentation lido:type="http://terminology.lido-schema.org/resourceRepresentation_type/provided_representation">
            <lido:linkResource lido:formatResource="${xmlEscape(asset.mimeType)}">../${xmlEscape(asset.originalPath)}</lido:linkResource>
          </lido:resourceRepresentation>
          <lido:resourceType><lido:term xml:lang="en">digital image</lido:term></lido:resourceType>
        </lido:resourceSet>`)
    .join("");
  const eventDate = work.creation.earliestYear
    ? `<lido:eventDate><lido:displayDate xml:lang="ru">${xmlEscape(work.creation.displayDate)}</lido:displayDate><lido:date><lido:earliestDate>${work.creation.earliestYear}</lido:earliestDate><lido:latestDate>${work.creation.latestYear}</lido:latestDate></lido:date></lido:eventDate>`
    : "";
  const measurements = dimensions.values.length
    ? `<lido:objectMeasurementsWrap><lido:objectMeasurementsSet><lido:displayObjectMeasurements xml:lang="ru">${xmlEscape(dimensions.display)}</lido:displayObjectMeasurements><lido:objectMeasurements>${dimensions.values
        .map((value, index) => `<lido:measurementsSet><lido:measurementType>${index === 0 ? "dimension 1" : `dimension ${index + 1}`}</lido:measurementType><lido:measurementUnit>cm</lido:measurementUnit><lido:measurementValue>${value}</lido:measurementValue></lido:measurementsSet>`)
        .join("")}</lido:objectMeasurements></lido:objectMeasurementsSet></lido:objectMeasurementsWrap>`
    : "";
  const materials = work.physicalDescription.materialsTechniquesDisplay
    ? `<lido:objectMaterialsTechWrap><lido:objectMaterialsTechSet><lido:displayMaterialsTech xml:lang="ru">${xmlEscape(work.physicalDescription.materialsTechniquesDisplay)}</lido:displayMaterialsTech></lido:objectMaterialsTechSet></lido:objectMaterialsTechWrap>`
    : "";

  return `  <lido:lido>
    <lido:lidoRecID lido:type="http://terminology.lido-schema.org/identifier_type/local_identifier">${xmlEscape(work.workId)}</lido:lidoRecID>
    <lido:descriptiveMetadata xml:lang="ru">
      <lido:objectClassificationWrap>
        <lido:objectWorkTypeWrap><lido:objectWorkType><lido:term xml:lang="ru">${xmlEscape(work.objectWorkType)}</lido:term></lido:objectWorkType></lido:objectWorkTypeWrap>
        <lido:classificationWrap>${work.classification.map((value) => `<lido:classification><lido:term xml:lang="en">${xmlEscape(value)}</lido:term></lido:classification>`).join("")}</lido:classificationWrap>
      </lido:objectClassificationWrap>
      <lido:objectIdentificationWrap>
        <lido:titleWrap>
          <lido:titleSet lido:pref="http://terminology.lido-schema.org/preference/most_preferred"><lido:appellationValue xml:lang="ru">${xmlEscape(work.displayTitle.ru)}</lido:appellationValue></lido:titleSet>
          <lido:titleSet><lido:appellationValue xml:lang="en">${xmlEscape(work.displayTitle.en)}</lido:appellationValue></lido:titleSet>
        </lido:titleWrap>
        <lido:objectDescriptionWrap><lido:objectDescriptionSet><lido:descriptiveNoteValue xml:lang="ru">${xmlEscape(work.description.ru)}</lido:descriptiveNoteValue><lido:descriptiveNoteValue xml:lang="en">${xmlEscape(work.description.en)}</lido:descriptiveNoteValue></lido:objectDescriptionSet></lido:objectDescriptionWrap>
        ${measurements}
        ${materials}
      </lido:objectIdentificationWrap>
      <lido:eventWrap><lido:eventSet><lido:event><lido:eventType><lido:term xml:lang="en">creation</lido:term></lido:eventType><lido:eventActor><lido:actorInRole><lido:actor><lido:nameActorSet><lido:appellationValue xml:lang="ru">Никита Пичугин</lido:appellationValue></lido:nameActorSet></lido:actor><lido:roleActor><lido:term xml:lang="en">${work.recordType === "photographic_work" ? "photographer" : "artist"}</lido:term></lido:roleActor></lido:actorInRole></lido:eventActor>${eventDate}</lido:event></lido:eventSet></lido:eventWrap>
      <lido:objectRelationWrap><lido:subjectWrap><lido:subjectSet><lido:displaySubject xml:lang="en">${xmlEscape(work.subjects.keywords.join(", ") || "undetermined")}</lido:displaySubject></lido:subjectSet></lido:subjectWrap></lido:objectRelationWrap>
    </lido:descriptiveMetadata>
    <lido:administrativeMetadata xml:lang="en">
      <lido:recordWrap><lido:recordID lido:type="http://terminology.lido-schema.org/identifier_type/local_identifier">${xmlEscape(work.workId)}</lido:recordID><lido:recordType><lido:term>item</lido:term></lido:recordType><lido:recordSource><lido:legalBodyName><lido:appellationValue>Nikita Pichugin official website content export</lido:appellationValue></lido:legalBodyName></lido:recordSource></lido:recordWrap>
      <lido:resourceWrap>${resources}
      </lido:resourceWrap>
    </lido:administrativeMetadata>
  </lido:lido>`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
