# DGD shop setup

The existing Next.js site keeps its community and adds a shop at `/shop`, a persistent cart, Stripe-hosted checkout, and an owner dashboard at `/admin/shop`. Supabase stores products, stock, settings, and orders. Adding or editing a product does not require another deployment. Both the storefront and dashboard have desktop and mobile layouts.

There is no Shopify dependency or subscription. Stripe processing fees and any hosting, database, email, or optional Stripe Tax charges still apply. This is a focused merchandise shop, not a complete replacement for every Shopify feature.

## 1. Database and owner access

Migration `supabase/migrations/20260911043240_dgd_shop_catalog_and_payments.sql` has been applied to the existing DGD project. It adds isolated shop tables and a public `shop-product-images` bucket. It does not change the community tables or their policies. Apply it once when setting up a separate database; do not rerun it in the DGD project, where it is already recorded in migration history.

Migration `supabase/migrations/20260911052003_dgd_stamped_letter_shipping.sql` is also applied. It adds editable letter shipping, a public read-only quote function, and order packing snapshots. A separate database needs both migrations in order. The quote and payment reservation use the same shipping calculation; the reservation rechecks prices and shipping while holding inventory and settings locks.

Existing administrators are copied once into `shop_admins`. Later changes to a member's profile cannot grant shop access. Additional shop owners must be added to that table by a database administrator using a verified existing auth user ID. Do not expose shop membership writes to browsers.

Sign in with the existing owner account and open `/admin/shop` (also linked from the moderation dashboard). Product and settings writes are protected by database row-level security. Order details are visible only to shop owners and the payment server. Customers can check a limited confirmation using their original browser's cart cookie and Stripe session ID; that endpoint does not expose their address or email.

Supabase's advisor flags `shop_is_admin` and `shop_mark_shipped` as authenticated-callable security-definer functions. That access is intentional: the first checks protected membership, and the second checks that membership before updating fulfillment. The database tests verify a non-owner cannot use the shipping operation. Payment RPCs are restricted to the server role. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

The **DGD Logo Sticker** is published in the existing database with the owner's confirmed **$5 price, 450 units, 3.31 × 7.50 inch dimensions, and 8 gram packed weight**. It is marked eligible for a regular paper envelope. The supplied PNG is retained unchanged at `public/dgd-logo-sticker.png`; unconfirmed material and durability claims are left blank. The original migration starts a new database with a private draft; the existing DGD listing was updated separately. Checkout remains closed.

## 2. Connect Stripe securely

The owner completes Stripe business, identity, and bank setup directly in Stripe. Keep private keys out of chat and GitHub. Start with Stripe test credentials.

Open the existing [DGD Vercel environment settings](https://vercel.com/drop-gear-dissapear-s-projects/dgd-website/settings/environment-variables). Add the server-only keys below to the **Preview** environment, scoped to `codex/dgd-shop` where appropriate, then redeploy that branch. The public Supabase variables are already used by the site.

The current chat can update the repository and Supabase, but Vercel project access returns **403 Forbidden**, and the installed Stripe plugin does not expose account tools in this session. The owner must enter the private keys directly in Vercel and configure the Stripe endpoint. Do not send key values in chat or commit them to GitHub.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing project's URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Existing public anon or publishable key |
| `SUPABASE_SECRET_KEY` | Server secret key for that same project; alternatively use `SUPABASE_SERVICE_ROLE_KEY` for a legacy service-role key |
| `STRIPE_SECRET_KEY` | Prefer a restricted test key (`rk_test_…`) with the permissions needed to create/retrieve Checkout Sessions and read their expanded payment/charge data; test its permissions before opening. A standard test secret is also supported. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this environment's Stripe webhook endpoint |
| `STRIPE_PAYMENT_METHOD_CONFIGURATION` | Optional `pmc_…` configuration for this shop; omit to use the account's dynamic payment-method settings |
| `SHOP_SITE_URL` | Optional full site origin; otherwise returns use this deployment's `VERCEL_URL` |
| `RESEND_API_KEY` | Optional owner email alerts; retain existing community configuration |
| `SHOP_FROM_EMAIL` | Optional verified Resend sender, such as `DGD <orders@your-domain>` |

Never prefix server secrets with `NEXT_PUBLIC_`. The browser never receives the Stripe or Supabase server key. Missing payment keys disable checkout without breaking the build or community. Existing Twilio and Resend routes also initialize their optional clients only when called.

Create a Stripe webhook pointing to `https://YOUR-DEPLOYMENT/api/shop/webhook`, using API version **2026-08-26.dahlia** (matching Stripe SDK 22.6.2), with these events:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `charge.refunded`

The endpoint must be reachable by Stripe; Vercel preview login protection can block it. Choose an appropriate reachable test deployment and verify delivery. This code does not change deployment access settings. Test and live endpoints have separate signing secrets. Do not send live events to a test environment.

The existing branch endpoint is `https://dgd-website-git-codex-dgd-shop-drop-gear-dissapear-s-projects.vercel.app/api/shop/webhook`. Use it only after confirming Stripe can reach that preview. Keep `SHOP_SITE_URL` unset for per-deployment return URLs, or set it to that stable preview origin. For production, use the production domain and its own live webhook secret after launch approval.

Card details are entered on Stripe's hosted page. Apple Pay and Google Pay are offered on eligible devices and browsers with supported wallet and account configuration. A wallet is not guaranteed to appear for every customer. Enable and verify the desired payment methods in Stripe. No public Stripe key is needed for this hosted redirect integration.

For this launch, configure cards and the requested wallets in Stripe. Checkout uses dynamic payment methods instead of a hardcoded list. This is a one-time purchase (`mode: payment`), so a Stripe Billing subscription is unnecessary. If delayed payment methods are enabled later, inventory remains reserved until the payment succeeds or fails; a completed checkout alone is not proof of payment. Verified failures release reservations and let the customer retry.

## 3. Add and publish merchandise

In **Manage shop → Products**, edit the sticker listing or choose **Add product**:

1. Enter the title, URL handle, description, category, real USD price, and optional SKU.
2. Enter physical units currently available and the packed weight in grams. Reserved units are shown separately; do not subtract them again from physical stock.
3. Add confirmed dimensions, material, finish, and application/care details. Empty specs are hidden. Do not claim waterproofing or UV resistance unless verified with the manufacturer.
4. Upload up to ten JPG, PNG, or WebP images, up to 5 MB each. Choose the main image. The seeded sticker image already works on the site; uploading it through the dashboard also makes it available as a photo in hosted checkout.
5. Save as **Draft**, **Published**, or **Archived**. Published products require a price of at least $0.50, packed weight, and a photo. Set quantity to zero to show sold out, or archive to remove a product from the catalog.

For eligible stickers, select **Ships in a regular paper envelope** and enter the measured packed weight per unit, including packaging. With stamped shipping selected, items that are unmarked or over 28 grams cannot proceed to checkout. Switch to a properly configured flat rate before selling merchandise that needs a package. Merely publishing a hoodie must not give it sticker postage.

Images use a public product-photo bucket, including uploaded draft photos. Do not upload confidential documents. Removing a photo from a listing does not immediately delete the original storage object. Draft product rows remain private.

The storefront reads Supabase on each visit: one product gets the featured layout; multiple products get a grid with pagination. A stale editor will ask you to refresh if another edit or stock reservation changed that product, preventing an old form from overwriting current inventory.

This version supports one USD price/SKU per product. Different sizes or designs can be separate products. A variant editor, discount codes, subscriptions, shipping-label purchases, customer order history, and automatic tracking emails are not included.

## 4. Shipping, taxes, and opening the store

In **Manage shop → Settings**, the current shipping method is **U.S. stamped letters, $1.50 per envelope, up to 3 stickers per envelope**. Shipping is separate from the $5 sticker price. The cart shows the charge, envelope count, and total before tax, and the same amount is sent to Stripe. The shop labels this service **no tracking**.

| Sticker quantity | Envelopes | Shipping charge |
| --- | --- | --- |
| 1–3 | 1 | $1.50 |
| 4–6 | 2 | $3.00 |
| 7–9 | 3 | $4.50 |

The calculation counts 8 grams per sticker, including a full packaging allowance for each unit, and limits each estimated envelope to 28 grams and at most 3 items. Different products are packed separately. Rates and item limits are editable without a deployment; there is also an optional free-shipping threshold. This is a merchant-set shipping charge, not a live USPS quote or a postage purchase.

Before opening, test a real **three-sticker envelope**: it must remain flexible, rectangular, evenly filled, within USPS letter dimensions, no thicker than ¼ inch, and within the weight limit. The sticker dimensions alone do not establish envelope eligibility. If the stack is too stiff or thick, lower the item limit, adjust the shipping method/rate, or use a suitable package. [USPS letter requirements](https://pe.usps.com/businessmail101?ViewName=Letters), [current USPS postage and shape surcharges](https://www.usps.com/ship/first-class-mail.htm).

Stamped-letter mode is limited to `US` in both the form and database. International or tracked package shipping is not configured. The existing flat-rate mode remains available for later merchandise; it also does not fetch carrier rates. Enter the real support email, processing time, shipping/lost-mail terms, and return/refund policy before enabling checkout. These business terms are still blank.

Choose either Stripe Tax (requires merchant setup and can add fees) or no tax collection only if appropriate for your business. This code does not determine where you must register or collect tax. Review the site's privacy and terms pages for the added commerce flow.

The dashboard shows whether payment environment variables are present; that check does not verify their validity or merchant activation. After completing test setup, enable **Open checkout**. A visible test banner identifies test payment mode. Keep checkout closed until you intend to accept orders in that environment. Because preview and production use the same database, product/settings edits affect both; payment credentials remain environment-specific.

Configure customer receipts in Stripe. Optional owner alerts use Resend and the support email in shop settings. Verify both delivery paths with a test order; setting environment variables alone does not prove delivery.

## 5. Orders and inventory

Customers can check out as guests. The cart stores only product IDs and quantities in an HttpOnly, SameSite=Lax cookie (Secure in production). The server reloads prices and stock before creating checkout; browser-supplied amounts are never trusted.

A live checkout reserves inventory atomically before its payment URL reaches the buyer. Concurrent reservations cannot oversell the same units. Checkout Sessions expire after roughly 30–40 minutes; a verified expiration releases reserved inventory. An open cart alone does not reserve stock. Repeated checkout clicks reuse the order for that unchanged cart.

Returning from checkout preserves access to the units reserved for that cart. Editing the cart first expires its unpaid Stripe Session and verifies the result before releasing inventory. If payment completed at the same time, the edit is stopped so a paid order cannot be treated as abandoned.

If a product-price total or shipping rate/method changes before a buyer reopens an unpaid checkout, that old session is expired and the buyer must review the updated cart before continuing. An unchanged pending checkout is reused.

Payment webhooks verify the Stripe signature and retrieve current payment state. Inventory is deducted once after a matching paid total is confirmed. A success-page visit cannot mark an order paid. Stripe retries failed webhook deliveries; **Orders → Sync payments** also checks up to ten pending orders or missing owner alerts per click. If webhook delivery is broken, unpaid reservations can remain held until synchronization confirms their expiration. Monitor delivery before opening the store.

Test orders are labeled **Test · do not ship** and do not reserve or deduct live inventory. Database transaction tests exercise live reservation behavior on temporary fixtures without charging anyone.

Paid orders show purchased item snapshots, the shipping address, totals, and the saved envelope packing plan in the owner dashboard. Later rate/product edits do not change an existing order's packing snapshot. Weigh and inspect every packed envelope before purchasing postage. Record a carrier and optional tracking number when marking an order shipped (stamped sticker mail has no package tracking). Refunds are initiated in Stripe and synchronized to the order after verified refund events. Refunds do not automatically restock physical goods; adjust stock after deciding whether a returned item is sellable. This version does not purchase postage or send tracking emails.

## 6. Validation and launch

Automated checks:

```bash
node --test tests/shop-*.test.mjs
npx tsc --noEmit
npm run build
```

Run `supabase/tests/shop.sql` and `supabase/tests/shop-shipping.sql` against the migrated project to exercise permissions, inventory/payment transitions, shipping tiers, weight/eligibility limits, tampered totals, and packing snapshots. Both roll back fixture rows and setting changes. Identity sequences can advance during rolled-back tests, so order numbers need not be consecutive.

Before live launch, verify with Stripe test credentials:

1. Edit/publish a product and confirm photos, specs, price, and stock update without a deployment.
2. On desktop and a phone, check navigation, the image gallery, cart quantity changes, removal, refresh persistence, and the owner forms.
3. Complete and cancel test checkouts. Verify configured shipping, taxes, webhook delivery, owner order details, customer receipt, and owner alert.
4. Verify wallets on eligible real devices using Stripe's supported test procedure.
5. Test an expired checkout, duplicate webhook delivery, and a Stripe test refund. Confirm synchronization is safe to repeat.
6. Confirm actual sticker price, stock, shipping costs, policies, and business settings. Switch to live credentials and a matching live webhook only when ready, then approve the production merge/deployment.

Automated checks do not replace browser/device, merchant-account, wallet, notification, or end-to-end payment testing. Those require the owner's account setup. No live charge is needed for the code checks.

## References

- [Stripe Checkout](https://docs.stripe.com/payments/checkout)
- [Stripe webhook signatures and delivery](https://docs.stripe.com/webhooks)
- [Stripe PaymentIntent lifecycle](https://docs.stripe.com/payments/paymentintents/lifecycle)
- [Stripe payment pricing](https://stripe.com/pricing)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel Hobby plan and commercial use](https://vercel.com/docs/plans/hobby)
