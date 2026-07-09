# Live WordPress Content Inventory

Generated: 2026-07-09T12:03:27.281Z
Source: https://nikitapichugin.ru

## Summary

| Metric | Count |
| --- | ---: |
| sourceCounts.sitemapChildren | 11 |
| sourceCounts.publicPagesRestHeaderTotal | 66 |
| sourceCounts.publicPagesFetched | 66 |
| sourceCounts.publicProductsRestHeaderTotal | 22 |
| sourceCounts.publicProductsFetched | 22 |
| sourceCounts.publicPortfolioEntriesRestHeaderTotal | 24 |
| sourceCounts.publicPortfolioEntriesFetched | 24 |
| sourceCounts.publicMediaAttachmentsRestHeaderTotal | 760 |
| sourceCounts.publicMediaAttachmentsFetched | 683 |
| primaryContentCounts.artworks | 24 |
| primaryContentCounts.artworkDetailImages | 76 |
| primaryContentCounts.homeEnviraImages | 25 |
| primaryContentCounts.homeExtraUploadReferences | 37 |
| primaryContentCounts.worksArchiveUploadReferences | 29 |
| primaryContentCounts.photoWorks | 87 |
| secondaryContentCounts.shopOrDemoProducts | 22 |
| secondaryContentCounts.shopOrDemoProductImages | 24 |
| secondaryContentCounts.demoOrSecondaryPageImageOccurrences | 159 |
| classifiedAssets.totalUniqueCanonicalUploads | 734 |
| classifiedAssets.primaryScopeUniqueAssets | 189 |
| classifiedAssets.unreferencedMediaAttachments | 424 |
| classifiedAssets.byKind.artwork_detail_image | 47 |
| classifiedAssets.byKind.home_page_visual_asset | 30 |
| classifiedAssets.byKind.photowork | 87 |
| classifiedAssets.byKind.home_artwork_feed_item | 25 |
| classifiedAssets.byKind.unreferenced_media_attachment | 424 |
| classifiedAssets.byKind.shop_product_or_demo_asset | 20 |
| classifiedAssets.byKind.theme_demo_or_shortcode_asset | 92 |
| classifiedAssets.byKind.artwork_detail_html_extra_reference | 9 |
| classifiedAssets.bySection.works.archive | 24 |
| classifiedAssets.bySection.demo.theme_or_shortcode_page | 159 |
| classifiedAssets.bySection.artwork.detail | 152 |
| classifiedAssets.bySection.works.archive_html | 29 |
| classifiedAssets.bySection.home.page_html | 37 |
| classifiedAssets.bySection.photoworks.vc_media_grid | 87 |
| classifiedAssets.bySection.artwork.detail_html_reference | 10 |
| classifiedAssets.bySection.home.page | 50 |
| classifiedAssets.bySection.home.envira_lenta | 50 |
| classifiedAssets.bySection.wp.media_library_unreferenced | 424 |
| classifiedAssets.bySection.shop.product | 48 |

## Source Warnings

| Severity | Code | Detail | Affected |
| --- | --- | --- | --- |
| high | duplicate_artwork_title | Several dt_portfolios share title "Ожидание". | ozhidanie, dver |
| low | dimensions_missing | skvoz-pylnoe-steklo: Сквозь пыльное стекло | skvoz-pylnoe-steklo |
| low | medium_missing | solncze-avgusta: Солнце Августа | solncze-avgusta |
| low | dimensions_missing | solncze-avgusta: Солнце Августа | solncze-avgusta |
| low | source_title_typo_mngnovenie | na-mngnovene-stalo-tiho: На мнгновенье стало тихо | na-mngnovene-stalo-tiho |
| low | medium_missing | predchuvstvie: Предчувствие | predchuvstvie |
| low | dimensions_missing | predchuvstvie: Предчувствие | predchuvstvie |
| low | medium_missing | mir-masterskoj: Мир мастерской | mir-masterskoj |
| low | dimensions_missing | mir-masterskoj: Мир мастерской | mir-masterskoj |
| medium | slug_title_mismatch_dver_title_ozhidanie | dver: Ожидание | dver |
| medium | slug_title_mismatch_s_kraskami_title_9_maya | s-kraskami: 9 мая | s-kraskami |
| medium | photoworks_not_visible_in_sitemap_images | Photoworks are embedded as Visual Composer media IDs; page sitemap reports zero image entries. | masterskaya-nikity-pichugina |
| medium | wp_contains_public_demo_shop_pages | REST exposes 66 pages and 22 products; most are theme demo/shop pages outside the artist-site primary scope. | wp/v2/pages, wp/v2/product |
| low | large_unreferenced_media_library | 424 media attachments are public through REST but were not referenced by primary pages or public sitemaps. | wp/v2/media |
| low | wp_media_rest_header_total_differs_from_fetchable_records | wp/v2/media reports 760 records in headers; paginated fetch returned source records separately in summary. | wp/v2/media |

## Artworks / Paintings

| # | WP ID | Slug | Title | Type | Year | Medium | Dimensions | Images | Notes |
| ---: | ---: | --- | --- | --- | --- | --- | --- | ---: | --- |
| 1 | 15578 | dyhanie-leta | Дыхание лета | painting_or_mixed_media | 2023 | Холст, масло | 100 x 70 | 7 |  |
| 2 | 15207 | skvoz-pylnoe-steklo | Сквозь пыльное стекло | painting_or_mixed_media | 2022 | Холст, масло |  | 3 | dimensions_missing |
| 3 | 15270 | iz-proshlogo | Из прошлого | painting_or_mixed_media | 2022 | Акрил, картон, темпера | 100 x 110 | 1 |  |
| 4 | 14357 | solncze-avgusta | Солнце Августа | unknown_artwork_object | 2023 |  |  | 5 | medium_missing, dimensions_missing |
| 5 | 14356 | na-mngnovene-stalo-tiho | На мнгновенье стало тихо | painting_or_mixed_media | 2023 | Холст, масло | 90 x 80 | 1 | source_title_typo_mngnovenie |
| 6 | 14354 | ozhidanie | Ожидание | painting_or_mixed_media | 2022 | Картон, темпера | 110 x 90 | 1 |  |
| 7 | 14353 | predchuvstvie | Предчувствие | unknown_artwork_object | 2023 |  |  | 5 | medium_missing, dimensions_missing |
| 8 | 14352 | vremya-zastylo | Время застыло | painting_or_mixed_media | 2023 | Холст, масло | 60 x 55 | 1 |  |
| 9 | 14349 | utro-avgusta | Утро августа | painting_or_mixed_media | 2023 | Холст, масло | 18 x 25 | 8 |  |
| 10 | 14347 | otrazhenie-marta | Отражение | painting_or_mixed_media | 2023 | Картон, масло | 100 x 70 | 6 |  |
| 11 | 15155 | mir-masterskoj | Мир мастерской | unknown_artwork_object | 2023 |  |  | 5 | medium_missing, dimensions_missing |
| 12 | 15554 | uhodit-vek | Уходит век | work_on_paper | 2022 | Бумага, акварель | 23 x 32 | 1 |  |
| 13 | 15552 | osennee-bezmolvie | Осеннее безмолвие | painting_or_mixed_media | 2016 | Холст, масло | 40 x 55 | 1 |  |
| 14 | 15550 | dary-leta | Дары лета | painting_or_mixed_media | 2015 | Холст, масло | 80 x 90 | 1 |  |
| 15 | 15547 | sentyabr | Сентябрь | painting_or_mixed_media | 2018 | Холст, масло | 90 x 80 | 5 |  |
| 16 | 15545 | melanholiya | Меланхолия | work_on_paper | 2021 | Бумага, акварель | 90 x 80 | 2 |  |
| 17 | 15300 | dver | Ожидание | painting_or_mixed_media | 2020 | Картон, темпера | 100 x 70 | 1 | slug_title_mismatch_dver_title_ozhidanie |
| 18 | 15296 | utro-v-masterskoj | Утро в мастерской | work_on_paper | 2021 | Бумага, акварель | 50 x 70 | 6 |  |
| 19 | 15291 | pervyj-sneg | Первый снег | painting_or_mixed_media | 2019 | Холст, масло | 50 x 70 | 2 |  |
| 20 | 15287 | moj-nomer-35 | Мой номер 35 | work_on_paper | 2021 | Бумага, акварель | 50 x 60 | 5 |  |
| 21 | 15283 | s-kraskami | 9 мая | work_on_paper | 2021 | Бумага, акварель | 50 x 60 | 6 | slug_title_mismatch_s_kraskami_title_9_maya |
| 22 | 15277 | vyhod | Выход | painting_or_mixed_media | 2021 | Картон, акрил | 100 x 105 | 1 |  |
| 23 | 15261 | tihij-omut | Тихий омут | painting_or_mixed_media | 2019 | Холст, масло | 50 x 70 | 1 |  |
| 24 | 15258 | vesennij-den | Весенний день | painting_or_mixed_media | 2018 | Холст, масло | 40 x 40 | 1 |  |

## Home Envira Gallery

| # | Media ID | Kind | Year | Title | URL |
| ---: | ---: | --- | --- | --- | --- |
| 1 | 16081 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-44-42-1.jpg |
| 2 | 16095 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-44-31-2.jpg |
| 3 | 16089 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-44-14-1.jpg |
| 4 | 16093 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-45-11-2.jpg |
| 5 | 16092 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-45-02-2.jpg |
| 6 | 16071 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-44-59.jpg |
| 7 | 16073 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-45-07.jpg |
| 8 | 16068 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-44-46.jpg |
| 9 | 16069 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-44-51.jpg |
| 10 | 16065 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-44-35.jpg |
| 11 | 16060 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-44-14.jpg |
| 12 | 16067 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-44-42.jpg |
| 13 | 16063 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-44-28.jpg |
| 14 | 16061 | home_artwork_feed_item |  |  | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2026-06-25_13-44-20.jpg |
| 15 | 15977 | home_artwork_feed_item | 2019 | Вербное Воскресенье. 90 х 80 2019 | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_2_2025-03-03_09-33-52.jpg |
| 16 | 15978 | home_artwork_feed_item | 2025 | Замоскворечье. 50 х 73 х.м. 2025 | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_3_2025-03-03_09-33-52.jpg |
| 17 | 15979 | home_artwork_feed_item | 2025 | Этюд, 73 х 50 х.м. 2025г. | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_4_2025-03-03_09-33-52.jpg |
| 18 | 15980 | home_artwork_feed_item | 2025 | Дыхание весны. 50 х 73 х.м. 2025 | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_5_2025-03-03_09-33-52.jpg |
| 19 | 15981 | home_artwork_feed_item | 2025 | Этюд, 83 х 60 бумага, тушь 2025г. | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_6_2025-03-03_09-33-52.jpg |
| 20 | 15982 | home_artwork_feed_item | 2025 | Вечерний звон. 50 х 70 х.м. 2025 | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_7_2025-03-03_09-33-52.jpg |
| 21 | 15983 | home_artwork_feed_item | 2025 | Эдюд. 60 х 40 х.м. 2025 | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_8_2025-03-03_09-33-52.jpg |
| 22 | 15984 | home_artwork_feed_item | 2025 | Этюд. 50 х 73 х.м. 2025 | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_9_2025-03-03_09-33-52.jpg |
| 23 | 15985 | home_artwork_feed_item | 2025 | Этюд. 35 х 50 бумага, тушь 2025 | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_10_2025-03-03_09-33-52.jpg |
| 24 | 15986 | home_artwork_feed_item | 2025 | 62 х 83 бумага. тушь. 2025 | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_11_2025-03-03_09-33-52.jpg |
| 25 | 15987 | home_artwork_feed_item | 2025 | 83 х 62 бумага, тушь 2025 | https://nikitapichugin.ru/wp-content/uploads/2025/03/photo_12_2025-03-03_09-33-52.jpg |

## Photoworks

| # | Media ID | Title | Size | URL |
| ---: | ---: | --- | --- | --- |
| 1 | 15501 | 2016-10-26 10.47 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2016-10-26-10.47.jpg |
| 2 | 15499 | 2016-10-20 13.54 | 1224x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2016-10-20-13.54.jpg |
| 3 | 15498 | 2016-10-15 16.11 | 1224x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2016-10-15-16.11.jpg |
| 4 | 15497 | IMG_E2929 | 2016x1512 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_e2929.jpg |
| 5 | 15496 | IMG_E2872 | 2016x1512 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_e2872.jpg |
| 6 | 15495 | IMG_8320 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_8320.jpg |
| 7 | 15494 | IMG_5227 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_5227-rotated.jpg |
| 8 | 15493 | IMG_2886 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_2886-rotated.jpg |
| 9 | 15492 | IMG_0905 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0905.jpg |
| 10 | 15445 | IMG_0050 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0050.jpg |
| 11 | 15489 | IMG_0830 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0830-rotated.jpg |
| 12 | 15487 | IMG_0783 | 1224x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0783.jpg |
| 13 | 15505 | 2017-01-27 15.21 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2017-01-27-15.21.jpg |
| 14 | 15485 | IMG_0758 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0758.jpg |
| 15 | 15483 | IMG_0747 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0747.jpg |
| 16 | 15482 | IMG_0717 | 1224x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0717.jpg |
| 17 | 15479 | IMG_0465 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0465.jpg |
| 18 | 15478 | IMG_0398 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0398.jpg |
| 19 | 15459 | IMG_0125 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0125.jpg |
| 20 | 15476 | IMG_0358 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0358.jpg |
| 21 | 15475 | IMG_0346 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0346-rotated.jpg |
| 22 | 15472 | IMG_0280 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0280-1.jpg |
| 23 | 15470 | IMG_0270 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0270.jpg |
| 24 | 15469 | IMG_0197 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0197.jpg |
| 25 | 15468 | IMG_0186 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0186.jpg |
| 26 | 15466 | IMG_0180 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0180-rotated.jpg |
| 27 | 15507 | 2017-04-14 11.27 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2017-04-14-11.27.jpg |
| 28 | 15465 | IMG_0174 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0174.jpg |
| 29 | 15444 | IMG_0027 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0027.jpg |
| 30 | 15463 | IMG_0132 | 1632x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0132.jpg |
| 31 | 15458 | IMG_0122 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0122.jpg |
| 32 | 15457 | IMG_0121 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0121.jpg |
| 33 | 15456 | IMG_0116 | 1632x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0116.jpg |
| 34 | 15455 | IMG_0107 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0107.jpg |
| 35 | 15452 | IMG_0099 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0099.jpg |
| 36 | 15450 | IMG_0068 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0068.jpg |
| 37 | 15449 | IMG_0066 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0066.jpg |
| 38 | 15448 | IMG_0057 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0057.jpg |
| 39 | 15446 | IMG_0051 | 1632x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0051.jpg |
| 40 | 15464 | IMG_0136 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0136.jpg |
| 41 | 15443 | IMG_0026 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0026.jpg |
| 42 | 15440 | IMG_0003 | 480x640 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0003.jpg |
| 43 | 15500 | 2016-10-26 10.46 (1) | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2016-10-26-10.46-1.jpg |
| 44 | 15438 | 2021-11-12 14.50.24 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-11-12-14.50.24.jpg |
| 45 | 15503 | 2016-12-10 12.16 (1) | 1632x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2016-12-10-12.16-1.jpg |
| 46 | 15437 | 2021-10-17 11.22.51 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-10-17-11.22.51-rotated.jpg |
| 47 | 15477 | IMG_0362 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0362.jpg |
| 48 | 15436 | 2021-09-29 16.58.34 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-09-29-16.58.34-rotated.jpg |
| 49 | 15473 | IMG_0282 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0282-1.jpg |
| 50 | 15432 | 2021-09-09 11.16.15 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-09-09-11.16.15.jpg |
| 51 | 15471 | IMG_0279 | 1632x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0279.jpg |
| 52 | 15431 | 2021-09-09 10.07.56 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-09-09-10.07.56.jpg |
| 53 | 15429 | 2021-09-09 10.07.17 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-09-09-10.07.17.jpg |
| 54 | 15428 | 2021-08-26 10.11.18 | 1632x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-08-26-10.11.18.jpg |
| 55 | 15427 | 2021-08-26 10.10.03 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-08-26-10.10.03.jpg |
| 56 | 15442 | IMG_0008 (1) | 1632x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0008-1.jpg |
| 57 | 15425 | 2021-08-26 10.07.45 | 1632x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-08-26-10.07.45.jpg |
| 58 | 15422 | 2021-04-07 16.22.06 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-04-07-16.22.06-rotated.jpg |
| 59 | 15421 | 2021-02-27 18.00.45 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-02-27-18.00.45-rotated.jpg |
| 60 | 15420 | 2020-11-23 09.55.20 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-11-23-09.55.20.jpg |
| 61 | 15419 | 2020-10-20 15.10.28 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-10-20-15.10.28.jpg |
| 62 | 15418 | 2020-08-24 18.58.13 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-08-24-18.58.13-rotated.jpg |
| 63 | 15417 | 2020-07-07 18.30.52 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-07-07-18.30.52-rotated.jpg |
| 64 | 15416 | 2020-06-17 15.15.26 | 1632x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-06-17-15.15.26.jpg |
| 65 | 15415 | 2020-03-25 13.08.40 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-03-25-13.08.40-rotated.jpg |
| 66 | 15414 | 2020-02-29 16.10.09 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-02-29-16.10.09-rotated.jpg |
| 67 | 15413 | 2020-02-28 17.02.48 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-02-28-17.02.48.jpg |
| 68 | 15410 | 2020-02-13 15.59.45 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-02-13-15.59.45-rotated.jpg |
| 69 | 15508 | 2017-04-14 14.08 (7) | 1224x1530 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2017-04-14-14.08-7.jpg |
| 70 | 15486 | IMG_0782 | 1224x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0782.jpg |
| 71 | 15506 | 2017-03-08 16.38 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2017-03-08-16.38.jpg |
| 72 | 15408 | 2020-02-10 15.39.27 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-02-10-15.39.27-rotated.jpg |
| 73 | 15407 | 2020-02-09 15.14.00 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-02-09-15.14.00-rotated.jpg |
| 74 | 15405 | 2020-01-20 15.01.41 (2) | 1352x1670 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-01-20-15.01.41-2.jpg |
| 75 | 15404 | 2019-11-22 13.44.45 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2019-11-22-13.44.45.jpg |
| 76 | 15403 | 2019-10-29 15.58.49 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2019-10-29-15.58.49-rotated.jpg |
| 77 | 15491 | IMG_0868 | 1224x1224 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0868.jpg |
| 78 | 15512 | 2018-05-19 18.24.21 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2018-05-19-18.24.21-rotated.jpg |
| 79 | 15511 | 2017-06-29 15.04.32 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2017-06-29-15.04.32.jpg |
| 80 | 15447 | IMG_0055 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0055.jpg |
| 81 | 15509 | 2017-06-04 13.31 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2017-06-04-13.31.jpg |
| 82 | 15523 | 2016-12-18 10.09 (1) | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2016-12-18-10.09-1-2-rotated.jpg |
| 83 | 15524 | 2020-01-27 13.58.47 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-01-27-13.58.47-2.jpg |
| 85 | 15460 | IMG_0126 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/img_0126.jpg |
| 86 | 15526 | 2020-02-20 16.15.11 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-02-20-16.15.11-2.jpg |
| 87 | 15527 | 2020-02-20 17.09.11 | 1512x2016 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2020-02-20-17.09.11-2-rotated.jpg |
| 88 | 15528 | 2021-04-08 17.58.03 | 1224x1632 | https://nikitapichugin.ru/wp-content/uploads/2024/06/2021-04-08-17.58.03-2-rotated.jpg |

## Public Products / Demo Shop

| WP ID | Slug | Title | Images | Scope |
| ---: | --- | --- | ---: | --- |
| 99 | woollen-thread-blue | Woollen Thread blue | 1 | secondary/demo |
| 14457 | woollen-thread-brown | Woollen Thread brown | 1 | secondary/demo |
| 93 | dustbin | Dustbin | 1 | secondary/demo |
| 90 | woo-album-3 | Candles | 1 | secondary/demo |
| 14456 | clay-horse | Clay Horse | 1 | secondary/demo |
| 83 | white-candles | White candles | 1 | secondary/demo |
| 79 | pen-holder-type-i | Pen Holder Type I | 2 | secondary/demo |
| 76 | pen-stand-type-ii | Pen stand Type II | 2 | secondary/demo |
| 73 | ceramic-bird | Ceramic bird | 1 | secondary/demo |
| 70 | calling-bell | Calling Bell | 1 | secondary/demo |
| 67 | clay-piglet | Clay piglet | 1 | secondary/demo |
| 60 | pottery-squirrel | Pottery squirrel | 1 | secondary/demo |
| 56 | aroma-bag | Aroma bag | 1 | secondary/demo |
| 53 | porcelain-rooster | Porcelain Rooster | 1 | secondary/demo |
| 50 | soldier-with-rifle | Soldier with rifle | 1 | secondary/demo |
| 47 | cannon-toys | Cannon toys | 1 | secondary/demo |
| 40 | earthen-teapot | Earthen Teapot | 1 | secondary/demo |
| 37 | modern-art-idol | Modern art idol | 1 | secondary/demo |
| 34 | clay-lion | Clay Lion | 1 | secondary/demo |
| 31 | flower-pot | Flower pot | 1 | secondary/demo |
| 22 | terracotta-horse | Terracotta horse | 1 | secondary/demo |
| 15 | penstand | Penstand | 1 | secondary/demo |

Full asset-level classification is in `content/audit/live-content-assets.csv` and `content/audit/live-content-inventory.json`.

