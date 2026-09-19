import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { assertSameOrigin, parseCart, priceInCents, readShopBody, validateCheckoutUrl, validateLineId, validateQuantity, validateVariantId } from "../lib/shop/validation.ts";

test("cart mutations require a same-origin browser request", () => {
  const url = "https://www.dropgeardisappear.us/api/shop/cart";
  assert.doesNotThrow(() => assertSameOrigin(new Request(url, { headers: { Origin: new URL(url).origin } })));
  for (const origin of ["https://evil.com", "null", "http://www.dropgeardisappear.us"]) assert.throws(() => assertSameOrigin(new Request(url, { headers: { Origin: origin } })));
  assert.throws(() => assertSameOrigin(new Request(url)));
  assert.throws(() => assertSameOrigin(new Request(url, { headers: { Origin: new URL(url).origin, "Sec-Fetch-Site": "cross-site" } })));
});

test("quantities reject negative, fractional, coerced, and excessive values", () => {
  for (const value of [-1, 0, 0.5, 100, Infinity, NaN, "2", null, undefined, true]) assert.throws(() => validateQuantity(value));
  assert.equal(validateQuantity(1), 1);
  assert.equal(validateQuantity(99), 99);
});

test("product and cart line IDs must be UUIDs", () => {
  const id = randomUUID();
  assert.equal(validateVariantId(id.toUpperCase()), id);
  assert.equal(validateLineId(id), id);
  for (const value of ["123", "gid://shopify/ProductVariant/123", id + "?price=0", id + "\n", null]) {
    assert.throws(() => validateVariantId(value));
    assert.throws(() => validateLineId(value));
  }
});

test("untrusted cart cookies discard amounts and reject duplicates or oversized carts", () => {
  const key = randomUUID(), productId = randomUUID();
  assert.deepEqual(parseCart({ key, lines: [{ productId, quantity: 2, price_cents: 1 }], total: 1 }), { key, lines: [{ productId, quantity: 2 }] });
  for (const value of [null, [], {}, { key, lines: "bad" }, { key, lines: [{ productId, quantity: 0 }] }, { key, lines: [{ productId, quantity: 1 }, { productId, quantity: 1 }] }, { key, lines: Array.from({ length: 31 }, () => ({ productId: randomUUID(), quantity: 1 })) }]) assert.equal(parseCart(value), null);
});

test("checkout redirects only to Stripe's secure hosted checkout", () => {
  const url = "https://checkout.stripe.com/c/pay/cs_test_example";
  assert.equal(validateCheckoutUrl(url), url);
  for (const value of ["https://evil.com/checkout", "https://checkout.stripe.com.evil.com/", "http://checkout.stripe.com/", "javascript:alert(1)", "https://attacker@checkout.stripe.com/", "https://checkout.stripe.com:444/"]) assert.throws(() => validateCheckoutUrl(value));
});

test("prices use exact decimal cents and reject ambiguous inputs", () => {
  assert.equal(priceInCents(""), null);
  assert.equal(priceInCents("0.50"), 50);
  assert.equal(priceInCents("12.34"), 1234);
  assert.equal(priceInCents("999999.99"), 99999999);
  for (const value of ["-1", "1.234", "1e3", "$5", "1,000", "1000000", "Infinity"]) assert.throws(() => priceInCents(value));
});

test("request bodies must be small JSON objects even without content-length", async () => {
  const make = (body, contentType = "application/json") => new Request("https://dgd.test/api/shop/cart", { method: "POST", headers: { "Content-Type": contentType }, body });
  assert.deepEqual(await readShopBody(make('{"quantity":2}')), { quantity: 2 });
  for (const body of ["null", "[]", "2", "invalid", "{", JSON.stringify({ x: "a".repeat(4096) })]) await assert.rejects(readShopBody(make(body)));
  await assert.rejects(readShopBody(make('{"quantity":2}', "text/plain")));
});
