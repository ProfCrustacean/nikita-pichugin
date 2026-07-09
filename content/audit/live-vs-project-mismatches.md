# Live WordPress vs Project Content Mismatches

Generated: 2026-07-08T22:02:06.776Z
Source inventory: `content/audit/live-content-inventory.json`
Project content: `src/data/site-content.json`

## Summary

Total findings: 27

| Severity | Code | Count |
| --- | --- | ---: |
| high | artwork_image_count_mismatch | 11 |
| high | artwork_duplicate_size_variants_imported | 11 |
| high | artwork_extra_untrusted_images | 2 |
| high | artwork_raw_html_extra_refs_imported | 2 |
| medium | live_wp_has_public_secondary_demo_shop_content | 1 |

## Findings

| Severity | Code | Section | Slug | Detail |
| --- | --- | --- | --- | --- |
| high | artwork_image_count_mismatch | artworks | iz-proshlogo | iz-proshlogo: project has 5 image records; live trusted sitemap/schema has 1. |
| high | artwork_duplicate_size_variants_imported | artworks | iz-proshlogo | iz-proshlogo: project imported WordPress size variants as separate artwork images. |
| high | artwork_image_count_mismatch | artworks | na-mngnovene-stalo-tiho | na-mngnovene-stalo-tiho: project has 5 image records; live trusted sitemap/schema has 1. |
| high | artwork_duplicate_size_variants_imported | artworks | na-mngnovene-stalo-tiho | na-mngnovene-stalo-tiho: project imported WordPress size variants as separate artwork images. |
| high | artwork_image_count_mismatch | artworks | ozhidanie | ozhidanie: project has 8 image records; live trusted sitemap/schema has 1. |
| high | artwork_extra_untrusted_images | artworks | ozhidanie | ozhidanie: project contains canonical images that are not trusted sitemap/schema artwork images. |
| high | artwork_duplicate_size_variants_imported | artworks | ozhidanie | ozhidanie: project imported WordPress size variants as separate artwork images. |
| high | artwork_raw_html_extra_refs_imported | artworks | ozhidanie | ozhidanie: project imported raw HTML upload references not present in trusted sitemap/schema images. |
| high | artwork_image_count_mismatch | artworks | vremya-zastylo | vremya-zastylo: project has 28 image records; live trusted sitemap/schema has 1. |
| high | artwork_extra_untrusted_images | artworks | vremya-zastylo | vremya-zastylo: project contains canonical images that are not trusted sitemap/schema artwork images. |
| high | artwork_duplicate_size_variants_imported | artworks | vremya-zastylo | vremya-zastylo: project imported WordPress size variants as separate artwork images. |
| high | artwork_raw_html_extra_refs_imported | artworks | vremya-zastylo | vremya-zastylo: project imported raw HTML upload references not present in trusted sitemap/schema images. |
| high | artwork_image_count_mismatch | artworks | uhodit-vek | uhodit-vek: project has 3 image records; live trusted sitemap/schema has 1. |
| high | artwork_duplicate_size_variants_imported | artworks | uhodit-vek | uhodit-vek: project imported WordPress size variants as separate artwork images. |
| high | artwork_image_count_mismatch | artworks | osennee-bezmolvie | osennee-bezmolvie: project has 5 image records; live trusted sitemap/schema has 1. |
| high | artwork_duplicate_size_variants_imported | artworks | osennee-bezmolvie | osennee-bezmolvie: project imported WordPress size variants as separate artwork images. |
| high | artwork_image_count_mismatch | artworks | dary-leta | dary-leta: project has 4 image records; live trusted sitemap/schema has 1. |
| high | artwork_duplicate_size_variants_imported | artworks | dary-leta | dary-leta: project imported WordPress size variants as separate artwork images. |
| high | artwork_image_count_mismatch | artworks | dver | dver: project has 5 image records; live trusted sitemap/schema has 1. |
| high | artwork_duplicate_size_variants_imported | artworks | dver | dver: project imported WordPress size variants as separate artwork images. |
| high | artwork_image_count_mismatch | artworks | vyhod | vyhod: project has 5 image records; live trusted sitemap/schema has 1. |
| high | artwork_duplicate_size_variants_imported | artworks | vyhod | vyhod: project imported WordPress size variants as separate artwork images. |
| high | artwork_image_count_mismatch | artworks | tihij-omut | tihij-omut: project has 5 image records; live trusted sitemap/schema has 1. |
| high | artwork_duplicate_size_variants_imported | artworks | tihij-omut | tihij-omut: project imported WordPress size variants as separate artwork images. |
| high | artwork_image_count_mismatch | artworks | vesennij-den | vesennij-den: project has 6 image records; live trusted sitemap/schema has 1. |
| high | artwork_duplicate_size_variants_imported | artworks | vesennij-den | vesennij-den: project imported WordPress size variants as separate artwork images. |
| medium | live_wp_has_public_secondary_demo_shop_content | scope |  | Live WordPress exposes public demo/shop/test pages. They should stay explicitly out-of-scope or be intentionally handled; do not mix them into artist sections. |

