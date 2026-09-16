import test from 'node:test';
import assert from 'node:assert/strict';
import { shopFinderReturnPath } from '../lib/shop-finder/login-return.js';
test('returns a shop owner to signup after login',()=>assert.equal(shopFinderReturnPath('?next=%2Fshop-finder%2Flist-your-shop'),'/shop-finder/list-your-shop'));
test('returns a reviewer to the review page',()=>assert.equal(shopFinderReturnPath('?next=/shop-finder/review'),'/shop-finder/review'));
test('rejects external and unapproved destinations',()=>{for(const next of ['https://example.com','//example.com','javascript:alert(1)','/shop-finder/list-your-shop?next=//example.com','/admin'])assert.equal(shopFinderReturnPath('?next='+encodeURIComponent(next)),'/account')});
test('keeps the existing account destination for ordinary login',()=>assert.equal(shopFinderReturnPath(''),'/account'));

test("returns owners to the dashboard",()=>{assert.equal(shopFinderReturnPath("?next=%2Fshop-finder%2Fdashboard"),"/shop-finder/dashboard");});
