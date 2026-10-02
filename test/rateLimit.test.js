import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../server/api/rateLimit.js';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test('200 comandi nello stesso istante: ne passano 50, un solo avviso', () => {
  const c = clock();
  const rl = new RateLimiter({ now: c.now });
  const results = Array.from({ length: 200 }, () => rl.take());
  assert.equal(results.filter((r) => r.allowed).length, 50);
  assert.equal(results.filter((r) => r.notify).length, 1);
  assert.equal(results.some((r) => r.close), false);
});

test('200 comandi distribuiti in 1 secondo: ne passano al massimo 50', () => {
  const c = clock();
  const rl = new RateLimiter({ now: c.now });
  let allowed = 0;
  for (let i = 0; i < 200; i++) {
    if (rl.take().allowed) allowed++;
    c.advance(5);
  }
  assert.equal(allowed, 50);
});

test('in nessun intervallo di 1 secondo passano più di 50 comandi', () => {
  const c = clock();
  const rl = new RateLimiter({ now: c.now });
  const accepted = [];
  for (let i = 0; i < 5000; i++) {
    if (rl.take().allowed) accepted.push(c.now());
    c.advance(1 + (i % 7));
  }
  for (let i = 50; i < accepted.length; i++) assert.ok(accepted[i] - accepted[i - 50] >= 1000);
});

test('20 comandi al secondo (cursore con throttling) non vengono mai scartati', () => {
  const c = clock();
  const rl = new RateLimiter({ now: c.now });
  for (let i = 0; i < 20 * 60; i++) {
    assert.equal(rl.take().allowed, true);
    c.advance(50);
  }
});

test('chiusura dopo 10 secondi consecutivi oltre il limite', () => {
  const c = clock(0);
  const rl = new RateLimiter({ now: c.now });
  let closedAt = null;
  for (let ms = 0; ms < 12_000 && closedAt === null; ms += 5) {
    if (rl.take().close) closedAt = ms;
    c.advance(5);
  }
  assert.ok(closedAt !== null && closedAt >= 9000 && closedAt < 10_000, `chiusura a ${closedAt} ms`);
});

test('una pausa azzera il conteggio dei secondi consecutivi', () => {
  const c = clock(0);
  const rl = new RateLimiter({ now: c.now });
  const flood = (seconds) => {
    let close = false;
    for (let ms = 0; ms < seconds * 1000; ms += 5) {
      close ||= rl.take().close;
      c.advance(5);
    }
    return close;
  };
  assert.equal(flood(5), false);
  c.advance(3000);
  assert.equal(flood(5), false);
});
