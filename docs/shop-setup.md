# DGD shop setup

This branch adds `/shop`, product pages, a persistent cart, and a Shopify Checkout handoff to the existing Next.js/Vercel website. Supabase continues to power the community. Product management, inventory, payments, order notifications, and fulfillment are handled in Shopify after setup.

**Status:** the code is an integration draft. It does not create a Shopify account, subscribe to a plan, connect a bank account, or enable live payments. Without Shopify credentials, the shop displays the supplied DGD sticker as “Coming soon” with purchasing disabled. It never invents a product price, stock count, material, or shipping promise. No changes to Supabase are required.

## 1. Connect a Shopify store

Use a Shopify plan that supports the Headless channel and the required commerce features. Confirm plan cost before subscribing. The owner completes Shopify Payments identity and bank setup directly with Shopify; do not put bank information or private credentials into GitHub or chat.

1. Install Shopify's **Headless** sales channel and create a storefront for DGD. Use the Storefront API integration, not the Buy Button channel. Shopify documents that Buy Button does not support Apple Pay.
2. Give the storefront access to product listings and cart/checkout operations (`unauthenticated_read_product_listings`, `unauthenticated_read_checkouts`, and `unauthenticated_write_checkouts`, as available in the Headless permissions screen).
3. Find the store's original `your-store.myshopify.com` domain and its **private Storefront API token**. This is not an Admin API token or a public Storefront token.
4. Add these values to Vercel's project environment variables, scoped to the intended preview/production environments:

   | Variable | Value |
   | --- | --- |
   | `SHOPIFY_STORE_DOMAIN` | `your-store.myshopify.com`, without a protocol or path |
   | `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` | Private token from the Headless storefront |
   | `SHOPIFY_STOREFRONT_API_VERSION` | `2026-07` |
   | `SHOPIFY_CHECKOUT_DOMAIN` | Optional exact hostname when Shopify uses a custom checkout domain |

5. Redeploy the relevant Vercel environment after changing environment variables. Keep all existing Supabase, Twilio, and Resend variables.

For local work, copy the relevant variable names from `.env.example` into `.env.local` and enter the values there. Never commit `.env.local`. The private token and full cart ID stay on the server. The cart cookie is HttpOnly, SameSite=Lax, and Secure on production builds. The browser receives only cart merchandise and totals.

## 2. Create the sticker listing

In Shopify **Products → Add product**:

- Title: **DGD Logo Sticker** (editable).
- Main photo: `public/dgd-logo-sticker.png`, copied from the supplied PNG without altering the artwork or QR code.
- Description: enter the actual product description. Descriptions display as plain text in this first version.
- Set the real selling price, SKU, and quantity available to ship. Do not infer available inventory from a past purchase order.
- Mark it as a physical product. Enter the packed weight and configure shipping separately.
- Enable inventory tracking; disable **Continue selling when out of stock** unless intentionally taking preorders.
- Add size/color variants only when they exist.
- Set the product to **Active** and publish it to the DGD **Headless** sales channel and intended market/catalog. A product that is not published there will not appear on DGD.

The shop queries Shopify on page load, so published products and edits appear without another code change or deployment. One product gets a large featured layout; multiple products get a grid. Catalog pages show 24 products with pagination. Product variants and cart lines are fetched across pages. The image gallery shows the first ten product images. Subscription products requiring a selling plan are intentionally unavailable in this physical-merchandise shop.

## 3. Add specs without changing code

Create optional product metafield definitions in Shopify's custom data settings. Give the definitions Storefront **PUBLIC_READ** access and use plain text fields. Empty fields are hidden.

| Namespace and key | Suggested field type | Display label |
| --- | --- | --- |
| `custom.dimensions` | Single-line text | Dimensions |
| `custom.material` | Single-line text | Material |
| `custom.finish` | Single-line text | Finish |
| `custom.application_care` | Multi-line text | Application & care |

Only state waterproof, UV resistance, outdoor lifespan, and similar claims if the sticker manufacturer confirms them. Price and specs are not hardcoded into the DGD source.

## 4. Configure checkout and order handling

- In Shopify **Settings → Payments**, configure the supported payment provider and enable Apple Pay and Google Pay where available. Wallet buttons depend on merchant configuration and the buyer's device/browser/wallet. Card entry is handled in Shopify Checkout.
- Allow guest checkout. DGD community accounts are separate; this integration does not synchronize Shopify customer accounts or order history into Supabase.
- Configure selling regions, shipping rates, packaging, processing times, and applicable tax settings in Shopify. Verify the final shipping and tax calculation with test orders.
- Add real shipping and refund policies. The shop footer links to the policies published in Shopify. Review DGD's existing privacy and terms pages for the new commerce flow before launch; this change does not rewrite those policies.
- Set up customer order confirmations and owner new-order notifications in Shopify. Add tracking when fulfilling orders. Actual notifications and payment statuses are owned by Shopify, not a browser redirect or this website's existing email endpoint.
- Discounts are entered in Shopify Checkout. Create discount codes in Shopify; no discount input is duplicated in the DGD cart.
- The cart shows an estimated subtotal. Shopify recalculates availability, discounts, shipping, taxes, and the final total before payment. Adding to cart does not reserve stock.

## 5. Verify before going live

Use a development store or the payment provider's test mode for payment tests. This task does not place orders or enable live charging.

1. Publish a test product to the Headless channel and confirm its description, image, specs, currency, and real price appear in the preview.
2. Edit its price in Shopify and refresh DGD; verify the edit appears without a code deployment.
3. Add an item, change quantity, navigate back to the shop, reload, and remove it. Check on a phone and desktop.
4. Confirm sold-out variants cannot be purchased. Also reduce inventory in Shopify while an item is in the cart and verify checkout's final stock check.
5. Complete a test card checkout. Check shipping, tax, discounts, order status, buyer receipt, owner alert, and fulfillment. Test cancelling checkout and returning to the saved cart.
6. Verify Apple Pay/Google Pay on supported devices under the provider's supported wallet-testing procedure. They are not validated just because their settings are enabled.
7. Review customer-facing policies and support contact details, then merge and deploy only after setup and verification are complete.

Local automated checks: `node --test tests/shop-validation.test.mjs` and `npm run build` (with the site's required environment variables). The new tests cover quantity/identifier validation, request size and origin checks, and allowed checkout destinations. Live Shopify requests and payments still require merchant setup and integration testing.

## References

- [Shopify with an existing stack](https://shopify.dev/docs/storefronts/headless)
- [Headless / Storefront API setup](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/getting-started)
- [Creating and updating carts](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage)
- [Product management](https://help.shopify.com/en/manual/products/add-update-products)
- [Apple Pay setup and limitations](https://help.shopify.com/en/manual/payments/accelerated-checkouts/apple-pay)
- [Google Pay setup](https://help.shopify.com/en/manual/payments/accelerated-checkouts/google-pay)
