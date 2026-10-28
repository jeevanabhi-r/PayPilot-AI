import test from 'node:test';import assert from 'node:assert/strict';import {parseRequest,validatePlan,catalog} from './logic.js';
test('catalog contains valid USD prices',()=>assert.ok(catalog.every(p=>p.price>0&&p.id)));
test('extracts budget',()=>assert.equal(parseRequest('I need a mouse under $50').budget,50));
test('recognizes product',()=>assert.equal(parseRequest('I need a keyboard').productId,'keyboard'));
test('rejects unknown plan',()=>assert.equal(validatePlan({productId:'not-real'}),null));
