import assert from 'node:assert/strict';
import { createGame, step, commandMove, ownedCount, capacity } from '../src/sim.js';
import { createAI, stepAI } from '../src/ai.js';

const g = createGame();
assert.equal(g.points.filter(p => p.base).length, 4);
assert.equal(g.units.length, 12);
assert.equal(ownedCount(g, 0), 1);

// Nokta ele geçirme + kapasite artışı
const target = g.points.find(p => p.owner === -1 && Math.hypot(p.x - g.points[0].x, p.y - g.points[0].y) < 4);
const mine = g.units.filter(u => u.team === 0).map(u => u.id);
commandMove(g, mine, target.x, target.y);
const cap0 = capacity(g, 0);
for (let i = 0; i < 400; i++) step(g, 0.05);
assert.equal(target.owner, 0, 'nokta ele geçirilmeli');
assert.ok(capacity(g, 0) > cap0, 'kapasite artmalı');

// Yapay zeka ile uzun koşu: çökmemeli, kapasite aşılmamalı
const g2 = createGame();
const ais = [0, 1, 2, 3].map(createAI);
for (let i = 0; i < 20 * 600; i++) { ais.forEach(a => stepAI(g2, a, 0.05)); step(g2, 0.05); }
for (const t of g2.teams) assert.ok(g2.units.filter(u => u.team === t.id).length <= capacity(g2, t.id) + 3);
console.log('ok; kazanan:', g2.winner, 'sahip olunan:', [0, 1, 2, 3].map(t => ownedCount(g2, t)));
