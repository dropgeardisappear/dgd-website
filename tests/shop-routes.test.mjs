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
    "./catalog": {}, "./cart": {}, "./validation": validation,
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
    "./catalog": { getProductRows: async () => [row], toProduct: () => ({ title: "Sticker", handle: "sticker", availableForSale: false, featuredImage: null }) },
    "./supabase-server": { paymentDatabase: () => db, ShopUnavailableError: class extends Error {}, CartUpdateError: class extends Error {} },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_live_unit_test_only";
    process.env.SUPABASE_SECRET_KEY = "unit_test_only";
    const input = { key: "cart-unit", lines: [{ productId: "product-unit", quantity: 2 }] };
    const returning = await cart.publicCart(input);
    assert.equal(returning.lines[0].merchandise.availableForSale, true);
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
    "server-only": {}, stripe: TestStripe, "node:crypto": require("node:crypto"), resend: {}, "./catalog": {}, "./validation": validation,
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
