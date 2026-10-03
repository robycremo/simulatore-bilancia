import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeighString, fillTemplate, checksum } from '../server/domain/format.js';
import { DEFAULT_CONFIG } from '../server/domain/engine.js';

const cfg = { ...DEFAULT_CONFIG, prefix: '$', checksum: 'none', division: 0.1, unit: 'kg', decimalSep: ',' };

// Pesata di esempio (valori di fantasia): 15/06/2026 10:30:00, progressivo 42, lordo 250,0 kg, tara 12,5 kg, netto 237,5 kg.
const rec = {
  date: '15/06/2026',
  time: '10:30:00',
  prog: 42,
  code: 0,
  desc: '',
  cgen: '',
  result: 0,
  gross: 250,
  tare: 12.5,
  net: 237.5,
  mpp: 42,
};

// Campi della spec § 6 in ordine: [nome, inizio, lunghezza, valore atteso]
const FIELDS = [
  ['inizio', 0, 1, '$'],
  ['data', 1, 10, '15/06/2026'],
  ['ora', 11, 8, '10:30:00'],
  ['progressivo', 19, 6, '    42'],
  ['codice merce', 25, 6, '     0'],
  ['descrizione', 31, 20, ' '.repeat(20)],
  ['codice generico', 51, 8, ' '.repeat(8)],
  ['risultato', 59, 8, '       0'],
  ['lordo', 67, 12, '    250,0 kg'],
  ['tara', 79, 12, '     12,5 kg'],
  ['netto', 91, 12, '    237,5 kg'],
];

test('stringa pesata: 104 caratteri, campo per campo come da formato', () => {
  const s = buildWeighString(rec, cfg);
  assert.equal(s.length, 104);
  for (const [name, start, len, expected] of FIELDS) {
    assert.equal(s.slice(start, start + len), expected, `campo ${name}`);
  }
  assert.equal(s.at(-1), '\r');
});

test('stringa pesata: corrisponde all\'esempio di riferimento', () => {
  const manual =
    '15/06/202610:30:00    42     0' + ' '.repeat(28) + '       0    250,0 kg     12,5 kg    237,5 kg';
  assert.equal(buildWeighString(rec, cfg), '$' + manual + '\r');
});

test('stringa pesata: campi testo troncati e allineati', () => {
  const s = buildWeighString({ ...rec, code: 123, desc: 'PROSCIUTTO COTTO ALTA QUALITA', cgen: 'ABCDEFGHIJ' }, cfg);
  assert.equal(s.length, 104);
  assert.equal(s.slice(25, 31), '   123');
  assert.equal(s.slice(31, 51), 'PROSCIUTTO COTTO ALT');
  assert.equal(s.slice(51, 59), 'ABCDEFGH');
});

const xorHex = (body) => [...Buffer.from(body, 'latin1')].reduce((a, b) => a ^ b, 0).toString(16).toUpperCase().padStart(2, '0');
const sumHex = (body) => ([...Buffer.from(body, 'latin1')].reduce((a, b) => a + b, 0) % 256).toString(16).toUpperCase().padStart(2, '0');

test('checksum XOR e somma: 106 caratteri, calcolati sul corpo senza "$"', () => {
  for (const [type, fn] of [
    ['xor', xorHex],
    ['sum', sumHex],
  ]) {
    const s = buildWeighString(rec, { ...cfg, checksum: type });
    assert.equal(s.length, 106, type);
    const body = s.slice(1, 103);
    assert.equal(s.slice(103, 105), fn(body), type);
    assert.match(s.slice(103, 105), /^[0-9A-F]{2}$/);
  }
  assert.equal(checksum('AB', 'xor'), '03');
  assert.equal(checksum('AB', 'sum'), '83');
  assert.equal(checksum('AB', 'none'), '');
});

test('template MPP e fine partita', () => {
  assert.equal(fillTemplate('{data}{ora}{mpp}{prog}{netto}', rec, cfg), '$15/06/202610:30:00    42    42    237,5 kg\r');
  assert.equal(
    fillTemplate('FP{npesate}{totnetto}{sconosciuto}', rec, cfg, { npesate: '     3', totnetto: '       500,0 kg' }),
    '$FP     3       500,0 kg{sconosciuto}\r'
  );
});
