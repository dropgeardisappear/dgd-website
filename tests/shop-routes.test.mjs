import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import Stripe from "stripe";
import * as validation from "../lib/shop/validation.ts";

const require = createRequire(import.meta.url);
// Execute the actual TypeScript route with controlled network dependencies.
function loadRoute(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const module = { exports: {} };
  const resolve = name => {
    if (name in dependencies) return dependencies[name];
    if (name === "next/server") return require(name);
    if (name === "@/lib/shop/validation") return validation;
    throw new Error(`Unexpected dependency: ${name}`);
  };
  new Function("require", "module", "exports", outputText)(resolve, module, module.exports);
  return module.exports;
}

test("checkout uses database prices and shipping and lets Stripe select payment methods", async () => {
  const names = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_SECRET_KEY", "SHOP_SITE_URL", "STRIPE_PAYMENT_METHOD_CONFIGURATION"];
  const saved = names.map(name => process.env[name]);
  const captured = [];
  let quotedSubtotal = 2000;
  let prior = null;
  const session = { id: "cs_test_unit", currency: "usd", livemode: false, status: "open", payment_status: "unpaid", client_reference_id: "cart-unit", metadata: { dgd_cart_key: "cart-unit" }, url: "https://checkout.stripe.com/c/pay/cs_test_unit" };
  const query = { eq: () => query, maybeSingle: async () => ({ data: prior, error: null }) };
  const db = { from: () => ({ select: () => query }), rpc: async (name, input) => { captured.push({ name, input }); return { data: { stripe_session_id: "cs_test_unit" }, error: null }; } };
  const product = { id: "product-unit", title: "DGD Logo Sticker", price_cents: 500, stock_quantity: 450, reserved_quantity: 0, weight_grams: 8, images: [] };
  class TestStripe {
    checkout = { sessions: {
      create: async (input, options) => { captured.push({ checkout: input, options }); return session; },
      retrieve: async () => session,
      expire: async () => { captured.push({ expire: true }); session.status = "expired"; },
    } };
  }
  const payments = loadRoute("../lib/shop/payments.ts", {
    "server-only": {}, stripe: TestStripe, "node:crypto": require("node:crypto"), resend: {}, "./validation": validation,
    "./catalog": { getShopSettings: async () => ({ store_open: true, tax_mode: "no_tax", shipping_countries: ["US"] }), getProductRows: async () => [product] },
    "./cart": { readCart: async () => ({ key: "cart-unit", lines: [{ productId: product.id, quantity: 4 }] }), renewCart: async () => captured.push({ renew: true }) },
    "./shipping": { quoteShipping: async lines => { assert.deepEqual(lines, [{ productId: product.id, quantity: 4 }]); return { subtotal_cents: quotedSubtotal, shipping_cents: 300, method: "stamped_letters", envelope_count: 2 }; } },
    "./supabase-server": { paymentDatabase: () => db, ShopUnavailableError: class extends Error {}, CartUpdateError: class extends Error {} },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_unit_test_only";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit_test_only";
    process.env.SUPABASE_SECRET_KEY = "unit_test_only";
    process.env.SHOP_SITE_URL = "https://dgd.test";
    process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION = "pmc_unit_test";
    const url = await payments.createCheckout(new Request("https://dgd.test/api/shop/checkout", { method: "POST", body: JSON.stringify({ price: 1, shipping: 0 }) }));
    assert.equal(url, "https://checkout.stripe.com/c/pay/cs_test_unit");
    const checkout = captured[0].checkout;
    assert.equal(checkout.line_items[0].price_data.unit_amount, 500);
    assert.equal(checkout.line_items[0].quantity, 4);
    assert.equal(checkout.shipping_options[0].shipping_rate_data.fixed_amount.amount, 300);
    assert.match(checkout.shipping_options[0].shipping_rate_data.display_name, /no tracking/);
    assert.deepEqual(checkout.shipping_address_collection.allowed_countries, ["US"]);
    assert.equal(checkout.payment_method_types, undefined);
    assert.equal(checkout.payment_method_configuration, "pmc_unit_test");
    assert.match(checkout.integration_identifier, /^dgd_shop_[a-z]{8}$/);
    assert.equal(captured[1].name, "shop_reserve_order");
    assert.equal(captured[1].input.p_shipping_cents, 300);
    assert.equal(captured[1].input.p_items[0].unit_price_cents, 500);
    quotedSubtotal = 1999;
    await assert.rejects(payments.createCheckout(new Request("https://dgd.test/api/shop/checkout")), /price changed/);
    assert.equal(captured.length, 2, "A stale quote must stop before creating a session");
    quotedSubtotal = 2000;
    prior = { id: "order-unit", cart_key: "cart-unit", stripe_session_id: session.id, status: "pending", livemode: false, subtotal_cents: 2000, shipping_cents: 300, shipping_details: { method: "stamped_letters" } };
    assert.equal(await payments.createCheckout(new Request("https://dgd.test/api/shop/checkout")), session.url);
    assert.equal(captured.length, 2, "An unchanged pending checkout is reused");
    prior.shipping_cents = 150;
    await assert.rejects(payments.createCheckout(new Request("https://dgd.test/api/shop/checkout")), /Prices or shipping changed/);
    assert.deepEqual(captured.slice(2).map(action => action.expire ? "expire" : action.renew ? "renew" : action.input.p_state), ["expire", "expired", "renew"]);
  } finally {
    names.forEach((name, index) => { if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index]; });
  }
});

test("failed payments require retrieved confirmation and can recover without the webhook", async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  const settled = [];
  const session = { id: "cs_test_unit", currency: "usd", livemode: false, client_reference_id: "cart-unit", metadata: { dgd_cart_key: "cart-unit" }, payment_status: "unpaid", status: "complete", payment_intent: { id: "pi_unit", status: "processing" } };
  const query = { eq: () => query, maybeSingle: async () => ({ data: { id: "order-unit", cart_key: "cart-unit", livemode: false }, error: null }) };
  const db = { from: () => ({ select: () => query }), rpc: async (_name, input) => { settled.push(input.p_state); return { data: "order-unit", error: null }; } };
  class TestStripe { checkout = { sessions: { retrieve: async () => session } }; }
  const payments = loadRoute("../lib/shop/payments.ts", {
    "server-only": {}, stripe: TestStripe, "node:crypto": require("node:crypto"), resend: {}, "./catalog": {}, "./cart": {}, "./shipping": {}, "./validation": validation,
    "./supabase-server": { paymentDatabase: () => db, ShopUnavailableError: class extends Error {}, CartUpdateError: class extends Error {} },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_unit_test_only";
    await assert.rejects(payments.syncSession(session.id, false, true), /not been confirmed/);
    assert.deepEqual(settled, []);
    session.payment_intent.status = "requires_payment_method";
    await payments.syncSession(session.id, false);
    assert.deepEqual(settled, ["failed"]);
    session.payment_status = "paid";
    await payments.syncSession(session.id, false, true);
    assert.deepEqual(settled, ["failed", "paid"], "Current paid state wins over a stale failure event");
  } finally {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previousKey;
  }
});

test("checkout rejects cross-origin requests before creating a payment", async () => {
  let calls = 0;
  const route = loadRoute("../app/api/shop/checkout/route.ts", {
    "@/lib/shop/supabase-server": { CartUpdateError: class extends Error {} },
    "@/lib/shop/payments": { createCheckout: async () => { calls++; return "https://checkout.stripe.com/c/pay/test"; } },
  });
  const url = "https://dgd.test/api/shop/checkout";
  assert.equal((await route.POST(new Request(url, { method: "POST", headers: { origin: "https://evil.test" } }))).status, 400);
  assert.equal(calls, 0);
  const response = await route.POST(new Request(url, { method: "POST", headers: { origin: "https://dgd.test" } }));
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("webhooks require valid Stripe signatures and retry failed confirmation", async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY, previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = "whsec_dgd_unit_test_only";
  const stripe = new Stripe("sk_test_unit_test_only");
  const calls = [];
  let fail = false;
  const route = loadRoute("../app/api/shop/webhook/route.ts", {
    "@/lib/shop/payments": {
      stripeClient: () => stripe,
      syncSession: async id => { calls.push(id); if (fail) throw new Error("temporary failure"); },
      syncRefund: async id => calls.push(id),
    },
  });
  const payload = JSON.stringify({ id: "evt_unit", type: "checkout.session.completed", data: { object: { id: "cs_test_unit", metadata: { dgd_cart_key: "cart-unit" } } } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const request = (body = payload, signed = signature) => new Request("https://dgd.test/api/shop/webhook", { method: "POST", body, headers: signed ? { "stripe-signature": signed } : {} });
  try {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    assert.equal((await route.POST(request())).status, 503);
    process.env.STRIPE_SECRET_KEY = "sk_test_unit_test_only";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    assert.equal((await route.POST(request(payload, ""))).status, 400);
    assert.equal((await route.POST(request(payload + " "))).status, 400);
    assert.deepEqual(calls, []);
    assert.equal((await route.POST(request())).status, 200);
    assert.deepEqual(calls, ["cs_test_unit"]);
    fail = true;
    assert.equal((await route.POST(request())).status, 503);
  } finally {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previousKey;
    if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
  }
});

test("owner API rejects non-owners before exposing payment configuration", async () => {
  let calls = 0, authorized = false;
  const route = loadRoute("../app/api/admin/shop/status/route.ts", {
    "@/lib/shop/supabase-server": { requireShopOwner: async () => authorized ? {} : null },
    "@/lib/shop/payments": { paymentSetup: () => { calls++; return { ready: false }; } },
  });
  const request = new Request("https://dgd.test/api/admin/shop/status");
  assert.equal((await route.GET(request)).status, 403);
  assert.equal(calls, 0);
  authorized = true;
  assert.equal((await route.GET(request)).status, 200);
  assert.equal(calls, 1);
});

test("order confirmation requires the original cart before reading private orders", async () => {
  let calls = 0;
  const route = loadRoute("../app/api/shop/order-status/route.ts", {
    "@/lib/shop/cart": { readCart: async () => null, saveCart: async () => {} },
    "@/lib/shop/supabase-server": { paymentDatabase: () => { calls++; throw new Error("must not access orders"); } },
    "@/lib/shop/payments": { syncSession: async () => { throw new Error("must not query Stripe"); } },
  });
  const response = await route.GET(new Request("https://dgd.test/api/shop/order-status?session_id=cs_test_0123456789abcdef"));
  assert.equal(response.status, 404);
  assert.equal(calls, 0);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("payment reconciliation records an earlier refund and rejects mismatched sessions", async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  const actions = [];
  const session = { id: "cs_test_unit", currency: "usd", livemode: false, client_reference_id: "cart-unit", metadata: { dgd_cart_key: "cart-unit" }, payment_status: "paid", status: "complete", amount_subtotal: 500, amount_total: 600, total_details: { amount_shipping: 100, amount_tax: 0 }, payment_intent: { id: "pi_unit", latest_charge: { id: "ch_unit", currency: "usd", livemode: false, payment_intent: "pi_unit", amount_refunded: 600 } } };
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "order-unit", cart_key: "cart-unit", livemode: false }, error: null }) }) }),
      update: data => ({ eq: () => ({ eq: () => ({ lt: async () => { actions.push({ refund: data }); return { error: null }; } }) }) }),
    }),
    rpc: async (name, input) => { actions.push({ name, input }); return { error: null, data: "order-unit" }; },
  };
  class TestStripe {
    checkout = { sessions: { retrieve: async (id, options) => { assert.equal(id, session.id); assert.deepEqual(options.expand, ["payment_intent.latest_charge"]); return session; } } };
  }
  const payments = loadRoute("../lib/shop/payments.ts", {
    "server-only": {}, stripe: TestStripe, "node:crypto": require("node:crypto"), resend: {},
    "./catalog": {}, "./cart": {}, "./shipping": {}, "./validation": validation,
    "./supabase-server": { paymentDatabase: () => db, ShopUnavailableError: class extends Error {}, CartUpdateError: class extends Error {} },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_unit_test_only";
    await payments.syncSession(session.id, false);
    assert.equal(actions[0].name, "shop_settle_order");
    assert.equal(actions[0].input.p_state, "paid");
    assert.deepEqual(actions[1], { refund: { refunded_cents: 600 } });
    session.metadata.dgd_cart_key = "wrong-cart";
    await assert.rejects(payments.syncSession(session.id, false), /does not match/);
    assert.equal(actions.length, 2);
  } finally {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previousKey;
  }
});

test("a returning cart can use its own reservation and recover a paid confirmation", async () => {
  const saved = { stripe: process.env.STRIPE_SECRET_KEY, database: process.env.SUPABASE_SECRET_KEY };
  const record = { status: "pending", livemode: true, stripe_session_id: "cs_live_unit", shop_order_items: [{ product_id: "product-unit", quantity: 2 }] };
  const db = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: record, error: null }) }) }) }) }) };
  const row = { id: "product-unit", price_cents: 500, stock_quantity: 2, reserved_quantity: 2 };
  const cart = loadRoute("../lib/shop/cart.ts", {
    "server-only": {}, "node:crypto": require("node:crypto"), "next/headers": {}, "./validation": validation,
    "./shipping": { quoteShipping: async () => ({ subtotal_cents: 1000, shipping_cents: 150, method: "stamped_letters", envelope_count: 1 }) },
    "./catalog": { getProductRows: async () => [row], toProduct: () => ({ title: "Sticker", handle: "sticker", availableForSale: false, featuredImage: null }) },
    "./supabase-server": { paymentDatabase: () => db, ShopUnavailableError: class extends Error {}, CartUpdateError: class extends Error {} },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_live_unit_test_only";
    process.env.SUPABASE_SECRET_KEY = "unit_test_only";
    const input = { key: "cart-unit", lines: [{ productId: "product-unit", quantity: 2 }] };
    const returning = await cart.publicCart(input);
    assert.equal(returning.lines[0].merchandise.availableForSale, true);
    assert.equal(returning.cost.subtotalAmount.amount, "10.00");
    assert.equal(returning.shipping.amount.amount, "1.50");
    assert.equal(returning.cost.totalAmount.amount, "11.50");
    record.status = "paid";
    assert.equal((await cart.publicCart(input)).confirmationUrl, "/shop/complete?session_id=cs_live_unit");
  } finally {
    if (saved.stripe === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = saved.stripe;
    if (saved.database === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = saved.database;
  }
});

test("cart edits verify expiration and stop when payment wins the race", async () => {
  const names = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_SECRET_KEY"];
  const saved = names.map(name => process.env[name]);
  const actions = [];
  let paid = false;
  const session = () => ({ id: "cs_test_unit", currency: "usd", livemode: false, client_reference_id: "cart-unit", metadata: { dgd_cart_key: "cart-unit" }, payment_status: paid ? "paid" : "unpaid", status: paid ? "complete" : "expired", amount_subtotal: 500, amount_total: 600, total_details: { amount_shipping: 100, amount_tax: 0 }, payment_intent: paid ? "pi_unit" : null });
  const query = { eq: () => query, maybeSingle: async () => ({ data: { id: "order-unit", cart_key: "cart-unit", livemode: false, status: "pending", stripe_session_id: "cs_test_unit" }, error: null }) };
  const db = { from: () => ({ select: () => query }), rpc: async (_name, input) => { actions.push(input.p_state); return { data: "order-unit", error: null }; } };
  class TestStripe {
    checkout = { sessions: { expire: async () => { actions.push("expire request"); if (paid) throw new Error("Already complete"); }, retrieve: async () => session() } };
  }
  const payments = loadRoute("../lib/shop/payments.ts", {
    "server-only": {}, stripe: TestStripe, "node:crypto": require("node:crypto"), resend: {}, "./catalog": {}, "./shipping": {}, "./validation": validation,
    "./cart": { readCart: async () => ({ key: "cart-unit", lines: [] }), renewCart: async () => actions.push("renew cart") },
    "./supabase-server": { paymentDatabase: () => db, ShopUnavailableError: class extends Error {}, CartUpdateError: class extends Error {} },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_unit_test_only";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_unit_test_only";
    process.env.SUPABASE_SECRET_KEY = "unit_test_only";
    await payments.releaseCheckoutForCartEdit();
    assert.deepEqual(actions, ["expire request", "expired", "renew cart"]);
    actions.length = 0; paid = true;
    await assert.rejects(payments.releaseCheckoutForCartEdit(), /already paid/);
    assert.deepEqual(actions, ["expire request", "paid"]);
  } finally {
    names.forEach((name, index) => { if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index]; });
  }
});
