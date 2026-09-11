# DGD shop setup

The existing Next.js site keeps its community and adds a shop at `/shop`, a persistent cart, Stripe-hosted checkout, and an owner dashboard at `/admin/shop`. Supabase stores products, stock, settings, and orders. Adding or editing a product does not require another deployment. Both the storefront and dashboard have desktop and mobile layouts.

There is no Shopify dependency or subscription. Stripe processing fees and any hosting, database, email, or optional Stripe Tax charges still apply. This is a focused merchandise shop, not a complete replacement for every Shopify feature.

## 1. Database and owner access

Migration `supabase/migrations/20260911043240_dgd_shop_catalog_and_payments.sql` has been applied to the existing DGD project. It adds isolated shop tables and a public `shop-product-images` bucket. It does not change the community tables or their policies. Apply it once when setting up a separate database; do not rerun it in the DGD project, where it is already recorded in migration history.

Existing administrators are copied once into `shop_admins`. Later changes to a member's profile cannot grant shop access. Additional shop owners must be added to that table by a database administrator using a verified existing auth user ID. Do not expose shop membership writes to browsers.

Sign in with the existing owner account and open `/admin/shop` (also linked from the moderation dashboard). Product and settings writes are protected by database row-level security. Order details are visible only to shop owners and the payment server. Customers can check a limited confirmation using their original browser's cart cookie and Stripe session ID; that endpoint does not expose their address or email.

Supabase's advisor flags `shop_is_admin` and `shop_mark_shipped` as authenticated-callable security-definer functions. That access is intentional: the first checks protected membership, and the second checks that membership before updating fulfillment. The database tests verify a non-owner cannot use the shipping operation. Payment RPCs are restricted to the server role. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

The seeded **DGD Logo Sticker** is a private draft. The supplied PNG is retained unchanged at `public/dgd-logo-sticker.png`. Price, dimensions, material, packed weight, and available quantity have not been assumed. Until an active product exists, the public shop shows the approved coming-soon sticker design.

## 2. Connect Stripe securely

The owner completes Stripe business, identity, and bank setup directly in Stripe. Keep private keys out of chat and GitHub. Start with Stripe test credentials.

Add these environment variables to the intended Vercel project and environment, then redeploy:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing project's URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Existing public anon or publishable key |
| `SUPABASE_SECRET_KEY` | Server secret key for that same project; alternatively use `SUPABASE_SERVICE_ROLE_KEY` for a legacy service-role key |
| `STRIPE_SECRET_KEY` | Stripe test secret key initially; the server creates and retrieves Checkout Sessions and retrieves charges |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this environment's Stripe webhook endpoint |
| `SHOP_SITE_URL` | Optional full site origin; otherwise returns use this deployment's `VERCEL_URL` |
| `RESEND_API_KEY` | Optional owner email alerts; retain existing community configuration |
| `SHOP_FROM_EMAIL` | Optional verified Resend sender, such as `DGD <orders@your-domain>` |

Never prefix server secrets with `NEXT_PUBLIC_`. The browser never receives the Stripe or Supabase server key. Missing payment keys disable checkout without breaking the build or community. Existing Twilio and Resend routes also initialize their optional clients only when called.

Create a Stripe webhook pointing to `https://YOUR-DEPLOYMENT/api/shop/webhook`, using API version **2026-08-26.dahlia** (matching Stripe SDK 22.6.2), with these events:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`

The endpoint must be reachable by Stripe; Vercel preview login protection can block it. Choose an appropriate reachable test deployment and verify delivery. This code does not change deployment access settings. Test and live endpoints have separate signing secrets. Do not send live events to a test environment.

Card details are entered on Stripe's hosted page. Apple Pay and Google Pay are offered on eligible devices and browsers with supported wallet and account configuration. A wallet is not guaranteed to appear for every customer. Enable and verify the desired payment methods in Stripe. No public Stripe key is needed for this hosted redirect integration.

## 3. Add and publish merchandise

In **Manage shop → Products**, edit the sticker draft or choose **Add product**:

1. Enter the title, URL handle, description, category, real USD price, and optional SKU.
2. Enter physical units currently available and the packed weight in grams. Reserved units are shown separately; do not subtract them again from physical stock.
3. Add confirmed dimensions, material, finish, and application/care details. Empty specs are hidden. Do not claim waterproofing or UV resistance unless verified with the manufacturer.
4. Upload up to ten JPG, PNG, or WebP images, up to 5 MB each. Choose the main image. The seeded sticker image already works on the site; uploading it through the dashboard also makes it available as a photo in hosted checkout.
5. Save as **Draft**, **Published**, or **Archived**. Published products require a price of at least $0.50, packed weight, and a photo. Set quantity to zero to show sold out, or archive to remove a product from the catalog.

Images use a public product-photo bucket, including uploaded draft photos. Do not upload confidential documents. Removing a photo from a listing does not immediately delete the original storage object. Draft product rows remain private.

The storefront reads Supabase on each visit: one product gets the featured layout; multiple products get a grid with pagination. A stale editor will ask you to refresh if another edit or stock reservation changed that product, preventing an old form from overwriting current inventory.

This version supports one USD price/SKU per product. Different sizes or designs can be separate products. A variant editor, discount codes, subscriptions, shipping-label purchases, customer order history, and automatic tracking emails are not included.

## 4. Shipping, taxes, and opening the store

In **Manage shop → Settings**, enter the support email, a flat shipping amount, an optional free-shipping threshold, allowed country codes, and real shipping/return policies. The draft country value is `US`; confirm your selling area before opening. Packed weight is recorded for fulfillment; this first version does not calculate carrier rates from weight.

Choose either Stripe Tax (requires merchant setup and can add fees) or no tax collection only if appropriate for your business. This code does not determine where you must register or collect tax. Review the site's privacy and terms pages for the added commerce flow.

The dashboard shows whether payment environment variables are present; that check does not verify their validity or merchant activation. After completing test setup, enable **Open checkout**. A visible test banner identifies test payment mode. Keep checkout closed until you intend to accept orders in that environment. Because preview and production use the same database, product/settings edits affect both; payment credentials remain environment-specific.

Configure customer receipts in Stripe. Optional owner alerts use Resend and the support email in shop settings. Verify both delivery paths with a test order; setting environment variables alone does not prove delivery.

## 5. Orders and inventory

Customers can check out as guests. The cart stores only product IDs and quantities in an HttpOnly, SameSite=Lax cookie (Secure in production). The server reloads prices and stock before creating checkout; browser-supplied amounts are never trusted.

A live checkout reserves inventory atomically before its payment URL reaches the buyer. Concurrent reservations cannot oversell the same units. Checkout Sessions expire after roughly 30–40 minutes; a verified expiration releases reserved inventory. An open cart alone does not reserve stock. Repeated checkout clicks reuse the order for that unchanged cart.

Returning from checkout preserves access to the units reserved for that cart. Editing the cart first expires its unpaid Stripe Session and verifies the result before releasing inventory. If payment completed at the same time, the edit is stopped so a paid order cannot be treated as abandoned.

Payment webhooks verify the Stripe signature and retrieve current payment state. Inventory is deducted once after a matching paid total is confirmed. A success-page visit cannot mark an order paid. Stripe retries failed webhook deliveries; **Orders → Sync payments** also checks up to ten pending orders or missing owner alerts per click. If webhook delivery is broken, unpaid reservations can remain held until synchronization confirms their expiration. Monitor delivery before opening the store.

Test orders are labeled **Test · do not ship** and do not reserve or deduct live inventory. Database transaction tests exercise live reservation behavior on temporary fixtures without charging anyone.

Paid orders show purchased item snapshots, the shipping address, and totals in the owner dashboard. Record a carrier and optional tracking number when marking an order shipped (stamped sticker mail may have no tracking). Refunds are initiated in Stripe and synchronized to the order after verified refund events. Refunds do not automatically restock physical goods; adjust stock after deciding whether a returned item is sellable. This version does not purchase postage or send tracking emails.

## 6. Validation and launch

Automated checks:

```bash
node --test tests/shop-*.test.mjs
npx tsc --noEmit
npm run build
```

Run `supabase/tests/shop.sql` against the migrated project to exercise database permissions and stock/payment transitions. It rolls back its fixture rows and setting changes. Identity sequences can advance during rolled-back tests, so order numbers need not be consecutive.

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
- [Stripe payment pricing](https://stripe.com/pricing)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel Hobby plan and commercial use](https://vercel.com/docs/plans/hobby)
