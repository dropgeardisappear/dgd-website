import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSameOrigin, readShopBody, validateCheckoutUrl, validateLineId, validateQuantity, validateStoreDomain, validateVariantId } from "../lib/shop/validation.ts";

test("store credentials can only be sent to a myshopify.com hostname", () => {
  assert.equal(validateStoreDomain(" DGD-TEST.myshopify.com "), "dgd-test.myshopify.com");
  for (const domain of ["evil.com", "dgd.myshopify.com.evil.com", "https://dgd.myshopify.com", "dgd.myshopify.com/path", "dgd.myshopify.com@evil.com", "localhost"]) assert.throws(() => validateStoreDomain(domain));
});

test("cart mutations require a same-origin browser request", () => {
  const valid = new Request("https://www.dropgeardisappear.us/api/shop/cart", { headers: { Origin: "https://www.dropgeardisappear.us" } });
  assert.doesNotThrow(() => assertSameOrigin(valid));
  for (const origin of ["https://evil.com", "null", "http://www.dropgeardisappear.us"]) assert.throws(() => assertSameOrigin(new Request(valid.url, { headers: { Origin: origin } })));
  assert.throws(() => assertSameOrigin(new Request(valid.url)));
  assert.throws(() => assertSameOrigin(new Request(valid.url, { headers: { Origin: "https://www.dropgeardisappear.us", "Sec-Fetch-Site": "cross-site" } })));
});

test("cart quantities reject negative, fractional, coerced, and excessive values", () => {
  for (const quantity of [-1, 0, 0.5, 100, Infinity, NaN, "2", null, undefined, true]) assert.throws(() => validateQuantity(quantity));
  assert.equal(validateQuantity(1), 1);
  assert.equal(validateQuantity(99), 99);
});

test("only product variant identifiers may be added", () => {
  assert.equal(validateVariantId("gid://shopify/ProductVariant/123"), "gid://shopify/ProductVariant/123");
  for (const id of ["123", "gid://shopify/Product/123", "gid://shopify/ProductVariant/123?price=0", "gid://shopify/ProductVariant/123\n", null]) assert.throws(() => validateVariantId(id));
});

test("line identifiers support Shopify's cart suffix but reject wrong resources", () => {
  assert.equal(validateLineId("gid://shopify/CartLine/abc?cart=token"), "gid://shopify/CartLine/abc?cart=token");
  for (const id of ["gid://shopify/Cart/abc", "gid://shopify/CartLine/abc\n", "gid://shopify/CartLine/" + "a".repeat(513)]) assert.throws(() => validateLineId(id));
});

test("checkout only redirects to configured secure hosts", () => {
  const store = "dgd.myshopify.com";
  assert.equal(validateCheckoutUrl("https://dgd.myshopify.com/checkouts/example", store), "https://dgd.myshopify.com/checkouts/example");
  assert.equal(validateCheckoutUrl("https://checkout.dropgeardisappear.us/checkouts/example", store, "checkout.dropgeardisappear.us"), "https://checkout.dropgeardisappear.us/checkouts/example");
  for (const url of ["https://evil.com/checkout", "https://dgd.myshopify.com.evil.com/checkout", "https://other.myshopify.com/checkout", "http://dgd.myshopify.com/checkout", "javascript:alert(1)", "https://attacker@dgd.myshopify.com/checkout", "https://dgd.myshopify.com:444/checkout"]) assert.throws(() => validateCheckoutUrl(url, store));
});

test("request bodies must be small JSON objects, including requests without content-length", async () => {
  const make = (body, contentType = "application/json") => new Request("https://dgd.test/api/shop/cart", { method: "POST", headers: { "Content-Type": contentType }, body });
  assert.deepEqual(await readShopBody(make('{"quantity":2}')), { quantity: 2 });
  for (const body of ["null", "[]", "2", "invalid", "{", JSON.stringify({ x: "a".repeat(4096) })]) await assert.rejects(readShopBody(make(body)));
  await assert.rejects(readShopBody(make('{"quantity":2}', "text/plain")));
});
