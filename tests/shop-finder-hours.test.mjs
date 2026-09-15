import test from 'node:test';
import assert from 'node:assert/strict';
import {openNow} from '../lib/shop-finder/hours.ts';
test('respects the shop timezone and closing boundary',()=>{const week=Array.from({length:7},()=>({open:'09:00',close:'17:00'}));assert.equal(openNow(week,'America/New_York',new Date('2026-09-15T13:00:00Z')),true);assert.equal(openNow(week,'America/New_York',new Date('2026-09-15T21:00:00Z')),false);});
test('handles overnight hours and closed days',()=>{const week=Array.from({length:7},()=>({open:'',close:''}));week[1]={open:'20:00',close:'02:00'};assert.equal(openNow(week,'America/New_York',new Date('2026-09-15T05:00:00Z')),true);assert.equal(openNow(week,'America/New_York',new Date('2026-09-15T07:00:00Z')),false);assert.equal(openNow(null,'America/New_York'),false);});
