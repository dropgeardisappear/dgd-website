# DGD Shop Finder

Routes: `/shop-finder`, `/shop-finder/list-your-shop`, `/shop-finder/review`.

Uses the existing DGD Supabase login, original logo, and Geist font. It does not use the standalone Sites prototype's database or authentication. Merchandise checkout is unchanged.

The `dgd_shop_finder` and `fix_directory_contact_conflict` migrations have been applied to the existing project. Shop listings and private contact emails are separate, with row-level policies. Existing `shop_admins` can approve listings through the review page. Edits return listings to pending review. All listings start free; the plan column allows future pro/exclusive tiers, but no subscriptions or charges are created.

Set server-only `OPENAI_API_KEY` and `OPENAI_SHOP_FINDER_MODEL` to enable AI interpretation. Without these, search explicitly reports service-tag matching. AI selects from the fixed catalog; results always come from approved database listings. The paid AI endpoint needs a deployment-level rate limit before public activation. Do not enable keys without configuring a spending cap and request limits.

US city/ZIP lookups use OpenStreetMap Nominatim with cached requests and attribution. Before high-volume launch, replace the public geocoder with a suitable hosted service. If geocoding fails, city/ZIP matching remains available and distance results are not invented. Make/model are passed to AI for interpreting requests; shops currently declare compatibility by vehicle type only, so users must confirm exact vehicle support with the shop.

Validation: database ownership, private email access, review permission, and edit-to-pending tests passed in a transaction that rolled back all test data. The project security advisor reported no new Shop Finder findings; pre-existing findings in unrelated features were left unchanged.
