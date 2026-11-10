import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateSession, countBorrows, seededRandom, expression, validateCustom } from '../src/engine.js';
import { MODES, EXTRA_MODES, modeById } from '../src/modes.js';
import { timingFor, timeReference } from '../src/timing.js';

const reference = JSON.parse(await readFile(new URL('../data/timing-reference.json', import.meta.url)));

test('all ten original group numbers, names, direct flash modes and untimed exceptions remain intact', () => {
  assert.deepEqual(MODES.map(m => m.number), [1,2,3,4,5,6,7,8,9,10]);
  assert.equal(modeById('1').title, '个位数相加');
  assert.equal(modeById('2').title, '个位数相减');
  for (const id of ['6', '7']) assert.equal(modeById(id).untimed, true);
});

test('2,000 addition flash sets have ten nonzero digits, a clear large-digit majority and variety', () => {
  const series = new Set();
  let big = 0;
  for (let seed = 0; seed < 2000; seed++) {
    const s = generateSession('1', 15, { seed });
    assert.equal(s.count, 10);
    assert.equal(s.digits.length, 10);
    assert.deepEqual(s.cards, s.digits);
    assert.ok(s.digits.every(d => Number.isInteger(d) && d >= 1 && d <= 9));
    assert.ok(s.digits.filter(d => d >= 6).length >= 7);
    assert.ok(new Set(s.digits).size >= 4);
    assert.equal(s.answer, s.digits.reduce((a, b) => a + b, 0));
    big += s.digits.filter(d => d >= 6).length;
    series.add(s.digits.join(','));
  }
  assert.ok(series.size > 1950);
  assert.ok(big / 20000 >= .7);
});

test('given subtraction demonstration really has 8 borrows and answer 14', () => {
  const result = countBorrows(91, [7,6,9,7,8,8,9,9,7,7]);
  assert.equal(result.borrows, 8);
  assert.equal(result.answer, 14);
});

test('1,000 subtraction sets have dynamic positive starts ≤99, 10 subtrahends and high actual borrowing', () => {
  const starts = new Set(), series = new Set();
  let borrowTotal = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const s = generateSession('2', 10, { seed });
    assert.equal(s.cards.length, 11);
    assert.equal(s.digits.length, 10);
    assert.equal(s.cards[0], s.start);
    assert.ok(s.start >= 1 && s.start <= 99);
    assert.ok(s.digits.every(d => d >= 1 && d <= 9));
    assert.ok(s.digits.filter(d => d >= 6).length >= 7);
    assert.ok(new Set(s.digits).size >= 4);
    assert.ok(Math.max(...s.digits.map(d => s.digits.filter(n => n === d).length)) <= 4);
    const actual = countBorrows(s.start, s.digits);
    assert.ok(actual.steps.every(step => step.after > 0));
    assert.equal(s.answer, actual.answer);
    assert.equal(s.borrows, actual.borrows);
    assert.ok(actual.borrows >= 7 && actual.borrows < 10);
    starts.add(s.start); series.add(s.cards.join(',')); borrowTotal += s.borrows;
  }
  assert.ok(starts.size >= 15);
  assert.ok(series.size > 950);
  assert.ok(borrowTotal / 1000 >= 7.5);
});

for (const id of ['3', '4', '5']) test(`group ${id}: 18,000+ samples across every supported count satisfy forced carry/borrow and easy-addition caps`, () => {
  let sampled = 0;
  for (let n = 5; n <= 100; n++) {
    for (let seed = 0; seed < 4; seed++) {
      const s = generateSession(id, n, { seed });
      assert.equal(s.questions.length, n);
      const adds = s.questions.filter(q => q.op === '+');
      assert.ok(adds.filter(q => q.a < 20 && q.b < 20).length <= Math.floor(.3 * adds.length));
      for (const q of s.questions) {
        assert.ok(q.a >= 10 && q.a <= 99 && q.b >= 10 && q.b <= 99);
        if (q.op === '+') {
          assert.ok(q.a % 10 + q.b % 10 >= 10);
          assert.equal(q.answer, q.a + q.b);
        } else {
          assert.equal(q.op, '-');
          assert.ok(q.a > q.b && q.a % 10 < q.b % 10);
          assert.equal(q.answer, q.a - q.b);
          assert.ok(!(q.a < 20 && q.b < 20));
        }
        sampled++;
      }
      assert.ok(s.questions.every((q, i) => !i || expression(q) !== expression(s.questions[i-1])));
      if (id === '3') assert.equal(adds.length, n);
      if (id === '4') assert.equal(adds.length, 0);
      if (id === '5') { assert.ok(adds.length && adds.length < n); }
    }
  }
  assert.ok(sampled > 18000);
});

test('mixed operation shares are configurable; generated order is reproducible but not fixed alternating/blocked', () => {
  const sequences = new Set();
  for (const share of [.3, .5, .7]) {
    for (let seed = 0; seed < 50; seed++) {
      const s = generateSession('5', 10, { seed, mixedShare: share });
      assert.equal(s.questions.filter(q => q.op === '+').length, Math.round(10 * share));
      sequences.add(s.questions.map(q => q.op).join(''));
    }
  }
  assert.ok(sequences.size > 30);
  assert.deepEqual(generateSession('5', 15, { seed: 90 }), generateSession('5', 15, { seed: 90 }));
});

test('groups 6 and 7 include two-digit inputs, and odd ÷2 answers use exact halves', () => {
  let odd = 0;
  for (let seed = 0; seed < 100; seed++) for (const id of ['6', '7']) {
    const s = generateSession(id, 15, { seed });
    for (const q of s.questions) {
      assert.ok(q.a >= 10 && q.a <= 99);
      assert.equal(q.b, 2);
      assert.equal(q.answer, id === '6' ? q.a * 2 : q.a / 2);
      if (id === '7' && q.a % 2) { assert.equal(q.answer % 1, .5); odd++; }
    }
    assert.equal(timingFor(modeById(id), 15, reference), null);
  }
  assert.ok(odd > 500);
});

test('three-digit groups never copy four-digit screenshot operand; carry/borrow is not artificially forced', () => {
  for (const id of ['8', '9', '10']) {
    let withCarry = 0, withoutCarry = 0, withBorrow = 0, withoutBorrow = 0;
    for (let seed = 0; seed < 100; seed++) {
      const s = generateSession(id, 15, { seed });
      for (const q of s.questions) {
        assert.ok(q.a >= 100 && q.a <= 999 && q.b >= 100 && q.b <= 999);
        if (q.op === '+') {
          assert.equal(q.answer, q.a + q.b);
          q.a % 10 + q.b % 10 >= 10 ? withCarry++ : withoutCarry++;
        } else {
          assert.ok(q.a > q.b);
          assert.equal(q.answer, q.a - q.b);
          q.a % 10 < q.b % 10 ? withBorrow++ : withoutBorrow++;
        }
      }
    }
    if (id !== '9') assert.ok(withCarry && withoutCarry);
    if (id !== '8') assert.ok(withBorrow && withoutBorrow);
  }
});

test('timings use exact evidence per count; only unverified quantities are labelled derived', () => {
  for (const id of ['3', '4', '5']) {
    const quick = timingFor(modeById(id), 10, reference);
    assert.deepEqual([quick.pass, quick.good, quick.excellent, quick.derived], [28,22,18,false]);
    const normal = timingFor(modeById(id), 15, reference);
    assert.deepEqual([normal.pass, normal.good, normal.excellent, normal.derived], [42,33,27,false]);
    const custom = timingFor(modeById(id), 7, reference);
    assert.deepEqual([custom.pass, custom.good, custom.excellent, custom.derived], [19.6,15.4,12.6,true]);
  }
  for (const [id, expected] of [['8',[40,32,26]],['9',[38,30,24]],['10',[42,34,28]]]) {
    const quick = timingFor(modeById(id), 10, reference);
    assert.deepEqual([quick.pass, quick.good, quick.excellent], expected);
    assert.equal(quick.derived, false);
    const normal = timingFor(modeById(id), 15, reference);
    assert.equal(normal.derived, true);
    assert.equal(normal.pass, expected[0] * 1.5);
  }
  assert.equal(timeReference(18000, timingFor(modeById('3'), 10, reference)), '优秀用时区间');
  assert.equal(timeReference(28001, timingFor(modeById('3'), 10, reference)), '继续练习');
});

test('only clearly supported additional modes are live and use their own screenshot timings', () => {
  for (const mode of EXTRA_MODES.filter(m => !m.custom && m.kind !== 'multi')) {
    for (const q of generateSession(mode.id, 10, { seed: 22 }).questions) {
      assert.ok(q.a >= 10 ** (mode.digits[0] - 1) && q.a < 10 ** mode.digits[0]);
      const expected = mode.op === '*' ? q.a * q.b : mode.op === '/' ? q.a / q.b * (mode.percent ? 100 : 1) : q.a - q.b;
      assert.equal(q.exactAnswer ?? q.answer, expected);
      if (mode.fixed) assert.equal(q.b, mode.fixed);
    }
    assert.equal(timingFor(mode, 10, reference).derived, false);
    assert.equal(timingFor(mode, 15, reference).derived, true);
  }
});

test('custom builder respects first digits, second fixed/range and multiple operators including negatives', () => {
  const config = { firstDigits: 1, ops: ['+', '-', '*'], secondType: 'range', secondDigits: 2, fixed: 99, min: 200, max: 300 };
  const s = generateSession('custom', 100, { seed: 3, custom: config });
  assert.ok(s.questions.every(q => q.a >= 1 && q.a <= 9 && q.b >= 200 && q.b <= 300));
  assert.ok(s.questions.some(q => q.answer < 0));
  assert.equal(new Set(s.questions.map(q => q.op)).size, 3);
  const fixed = generateSession('custom', 5, { seed: 4, custom: { ...config, secondType: 'fixed' } });
  assert.ok(fixed.questions.every(q => q.b === 99));
  assert.throws(() => validateCustom({ ...config, min: 400 }), /下限/);
  assert.throws(() => validateCustom({ ...config, ops: [] }), /至少/);
  assert.throws(() => validateCustom({ ...config, ops: ['/'] }), /至少/);
  assert.throws(() => generateSession('3', 4), /题量/);
  assert.throws(() => generateSession('3', 10.5), /题量/);
  assert.equal(typeof seededRandom(1)(), 'number');
});
