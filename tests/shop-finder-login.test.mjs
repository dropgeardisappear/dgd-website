import test from 'node:test';
import assert from 'node:assert/strict';
import { shopFinderReturnPath } from '../lib/shop-finder/login-return.js';
test('returns a shop owner to signup after login',()=>assert.equal(shopFinderReturnPath('?next=%2Fshop-finder%2Flist-your-shop'),'/shop-finder/list-your-shop'));
test('returns a reviewer to the review page',()=>assert.equal(shopFinderReturnPath('?next=/shop-finder/review'),'/shop-finder/review'));
test('rejects external and unapproved destinations',()=>{for(const next of ['https://example.com','//example.com','javascript:alert(1)','/shop-finder/list-your-shop?next=//example.com','/admin'])assert.equal(shopFinderReturnPath('?next='+encodeURIComponent(next)),'/account')});
test('keeps the existing account destination for ordinary login',()=>assert.equal(shopFinderReturnPath(''),'/account'));

test("returns owners to the dashboard",()=>{assert.equal(shopFinderReturnPath("?next=%2Fshop-finder%2Fdashboard"),"/shop-finder/dashboard");});

test('returns customers to exact shop profiles',()=>assert.equal(shopFinderReturnPath('?next=/shop-finder/shops/ded7777b-8089-4a24-a3fc-6f0d688a6e6b'),'/shop-finder/shops/ded7777b-8089-4a24-a3fc-6f0d688a6e6b'));
test('rejects malformed shop return paths',()=>{for(const path of ['/shop-finder/shops/anything','/shop-finder/shops/../admin','/shop-finder/shops/ded7777b-8089-4a24-a3fc-6f0d688a6e6b?next=https://example.com']) assert.equal(shopFinderReturnPath('?next='+encodeURIComponent(path)),'/account');});
