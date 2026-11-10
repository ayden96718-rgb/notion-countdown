import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateSession, expression, roundQuotient, formatAnswer } from '../src/engine.js';
import { modeById } from '../src/modes.js';
import { timingFor } from '../src/timing.js';
import { TrainingSession, isCorrectAnswer } from '../src/session.js';

const reference = JSON.parse(await readFile(new URL('../data/timing-reference.json', import.meta.url)));

test('multiple addition follows the new screenshot: four independent two-digit addends, all shown together', () => {
  for (let seed = 0; seed < 100; seed++) {
    for (const count of [5, 10, 15, 100]) {
      const spec = generateSession('many-addition', count, { seed });
      assert.equal(spec.kind, 'quiz');
      assert.equal(spec.questions.length, count);
      for (const q of spec.questions) {
        assert.equal(q.terms.length, 4);
        assert.ok(q.terms.every(n => Number.isInteger(n) && n >= 10 && n <= 99));
        assert.equal(q.answer, q.terms.reduce((sum, n) => sum + n, 0));
        assert.equal(expression(q), q.terms.join(' + '));
      }
    }
  }
  const timing = timingFor(modeById('many-addition'), 10, reference);
  assert.deepEqual([timing.pass, timing.good, timing.excellent, timing.derived], [90, 75, 60, false]);
  assert.equal(timingFor(modeById('many-addition'), 15, reference).derived, true);
});

test('multiple-addition results retain original four operands, entered answers and consistent durations', () => {
  const spec = generateSession('many-addition', 10, { seed: 35 });
  let tick = 0;
  const session = new TrainingSession(spec, { now: () => tick });
  for (const [i, q] of spec.questions.entries()) {
    tick += 750;
    session.submit(String(q.answer + (i === 3 ? 1 : 0)));
  }
  assert.deepEqual(session.summary(), { total: 10, correct: 9, wrong: 1, totalMs: 7500 });
  assert.ok(session.records.every(q => q.terms.length === 4 && q.elapsedMs === 750));
});

test('new division examples preserve operand widths, include non-integer results and use their own timing evidence', () => {
  for (const [id, firstDigits, secondDigits, times] of [
    ['three-by-one-divide', 3, 1, [38, 30, 24]],
    ['three-by-two-divide', 3, 2, [90, 75, 60]],
    ['five-by-three-divide', 5, 3, [90, 75, 60]],
    ['fraction-to-percent', 3, 4, [90, 75, 60]]
  ]) {
    let nonInteger = 0;
    for (let seed = 0; seed < 100; seed++) {
      const spec = generateSession(id, 10, { seed });
      for (const q of spec.questions) {
        assert.equal(String(q.a).length, firstDigits);
        assert.equal(String(q.b).length, secondDigits);
        assert.ok(q.b > 0);
        assert.equal(q.op, '/');
        const exact = q.a / q.b * (id === 'fraction-to-percent' ? 100 : 1);
        assert.equal(q.exactAnswer ?? q.answer, exact);
        nonInteger += Number(q.a % q.b !== 0);
        if (id === 'fraction-to-percent') { assert.equal(q.unit, '%'); assert.ok(exact > 0 && exact < 100); }
      }
    }
    assert.ok(nonInteger > 200, `${id} must not filter away the non-integer examples`);
    const timing = timingFor(modeById(id), 10, reference);
    assert.deepEqual([timing.pass, timing.good, timing.excellent, timing.derived], [...times, false]);
    assert.equal(timingFor(modeById(id), 15, reference).derived, true);
  }
});

test('multiplication estimation follows two-digit operand examples and 48/40/32-second timing', () => {
  for (let seed = 0; seed < 100; seed++) {
    for (const q of generateSession('multiplication-estimation', 10, { seed }).questions) {
      assert.ok(q.a >= 10 && q.a <= 99 && q.b >= 10 && q.b <= 99);
      assert.equal(q.op, '*');
      assert.equal(q.answer, q.a * q.b);
    }
  }
  const timing = timingFor(modeById('multiplication-estimation'), 10, reference);
  assert.deepEqual([timing.pass, timing.good, timing.excellent], [48, 40, 32]);
});

test('ordinary division rounds exact rational half ties correctly and leaves group 7 halves untouched', () => {
  for (const [a, b, expected] of [[291, 40, 7.28], [578, 6, 96.33], [718, 7, 102.57], [85241, 761, 112.01], [942, 19, 49.58], [201, 200, 1.01], [1999, 200, 10], [120, 30, 4]]) {
    assert.equal(roundQuotient(a, b), expected);
  }
  for (const id of ['three-by-one-divide', 'three-by-two-divide', 'five-by-three-divide']) {
    for (const q of generateSession(id, 100, { seed: 42 }).questions) {
      assert.equal(q.decimalPlaces, 2);
      assert.equal(q.exactAnswer, q.a / q.b);
      assert.equal(isCorrectAnswer(q.answer, q), true);
      assert.equal(isCorrectAnswer(q.answer + 0.01, q), false);
      assert.match(formatAnswer(q), /^\d+\.\d{2}$/);
    }
  }
  for (const q of generateSession('7', 100, { seed: 42 }).questions) {
    assert.equal(q.decimalPlaces, undefined);
    assert.equal(q.answer, q.a / 2);
  }
});

test('estimated multiplication accepts inclusive relative 5% boundaries and rejects values outside them', () => {
  const q = { answer: 5184, relativeTolerance: 0.05 };
  for (const value of [4924.8, 5000, 5184, 5443.2]) assert.equal(isCorrectAnswer(value, q), true);
  for (const value of [4924.79999, 5443.20001, 0, NaN, Infinity]) assert.equal(isCorrectAnswer(value, q), false);
  assert.equal(isCorrectAnswer(100.000000001, { answer: 100 }), false);
});

test('percent mode uses percentage values and relative 3%, never ±3 percentage points or the decimal ratio', () => {
  const six = { answer: 6, unit: '%', relativeTolerance: 0.03 };
  for (const value of [5.82, 6, 6.18]) assert.equal(isCorrectAnswer(value, six), true);
  for (const value of [0.06, 3, 9, 5.81999, 6.18001]) assert.equal(isCorrectAnswer(value, six), false);
  const screenshot = { answer: 557 / 8598 * 100, unit: '%', relativeTolerance: 0.03 };
  assert.equal(formatAnswer(screenshot), '≈6.4783%');
  assert.equal(isCorrectAnswer(6.28, screenshot), false);
  assert.equal(isCorrectAnswer(6.29, screenshot), true);
  assert.equal(isCorrectAnswer(6.67, screenshot), true);
  assert.equal(isCorrectAnswer(6.68, screenshot), false);
  assert.equal(isCorrectAnswer(screenshot.answer * 1.03, screenshot), true);
});

test('new tolerance rules are recorded per question; result totals and original exact-answer behavior remain consistent', () => {
  for (const [id, tolerance] of [['multiplication-estimation', 0.05], ['fraction-to-percent', 0.03]]) {
    const spec = generateSession(id, 10, { seed: 20 });
    let clock = 0;
    const session = new TrainingSession(spec, { now: () => clock });
    for (const [i, q] of spec.questions.entries()) {
      assert.equal(q.relativeTolerance, tolerance);
      clock += 300;
      session.submit(String(q.answer * (1 + tolerance * (i < 7 ? 0.5 : 2))));
    }
    assert.deepEqual(session.summary(), { correct: 7, wrong: 3, total: 10, totalMs: 3000 });
    assert.ok(session.records.every(q => q.relativeTolerance === tolerance));
    assert.ok(session.records.every(q => q.elapsedMs === 300));
  }
});
