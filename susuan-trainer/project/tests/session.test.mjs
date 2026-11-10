import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrainingSession, parseAnswer } from '../src/session.js';
import { generateSession } from '../src/engine.js';
import { LocalStore } from '../src/storage.js';

test('flash workflow cannot submit before last card; subtraction has exactly 11 cards', () => {
  for (const id of ['1', '2']) {
    const spec = generateSession(id, 10, { seed: 5 });
    let tick = 0;
    const session = new TrainingSession(spec, { now: () => tick });
    assert.equal(session.submit(spec.answer), null);
    for (let i = 0; i < spec.cards.length; i++) {
      assert.equal(session.phase, 'cards');
      tick += 100;
      assert.equal(session.nextCard(), true);
    }
    assert.equal(session.phase, 'answer');
    assert.equal(session.nextCard(), false);
    tick += 200;
    assert.equal(session.submit(spec.answer).correct, true);
    assert.equal(session.finished, true);
    assert.equal(session.summary().totalMs, tick);
    assert.equal(session.summary().total, 1);
    assert.equal(session.submit(spec.answer), null);
  }
});

test('quiz statistics, actual per-question durations and total agree, including wrong answers', () => {
  const spec = generateSession('3', 15, { seed: 2 });
  let tick = 200;
  const session = new TrainingSession(spec, { now: () => tick });
  assert.throws(() => session.summary(), /未完成/);
  assert.equal(session.submit(''), null);
  assert.equal(session.submit('12x'), null);
  for (let i = 0; i < spec.count; i++) {
    const duration = (i + 1) * 123.5;
    tick += duration;
    const answer = i % 3 ? spec.questions[i].answer : spec.questions[i].answer + 1;
    const record = session.submit(String(answer));
    assert.equal(record.elapsedMs, duration);
  }
  assert.deepEqual(session.summary(), { correct: 10, wrong: 5, total: 15, totalMs: tick - 200 });
  assert.equal(session.records.reduce((a, r) => a + r.elapsedMs, 0), session.totalMs);
  assert.equal(session.submit('123'), null);
  tick += 90000;
  assert.equal(session.elapsed(), session.totalMs);
});

test('untimed groups do not even call a clock; all time fields stay null including results', () => {
  for (const id of ['6', '7']) {
    const spec = generateSession(id, 10, { seed: 3 });
    const session = new TrainingSession(spec, { untimed: true, now: () => { throw new Error('must not time'); } });
    spec.questions.forEach(q => session.submit(String(q.answer)));
    assert.equal(session.summary().correct, 10);
    assert.equal(session.summary().totalMs, null);
    assert.equal(session.elapsed(), null);
    assert.ok(session.records.every(r => r.elapsedMs === null));
  }
});

test('decimal and signed input validates full string instead of truncating', () => {
  assert.equal(parseAnswer('18.5'), 18.5);
  assert.equal(parseAnswer('-42'), -42);
  assert.equal(parseAnswer(' 20.0 '), 20);
  assert.equal(parseAnswer('0'), 0);
  for (const raw of ['', ' ', 'NaN', 'Infinity', '20a', '.', '-', '1.2.3', '1e2', '<script>', '18.']) assert.equal(parseAnswer(raw), null);
});

test('local records are idempotent, bounded to 100, and unavailable storage does not break practice', () => {
  const data = new Map();
  const store = new LocalStore({ getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) });
  for (let i = 0; i < 110; i++) store.add({ id: String(i), modeId: '3', records: [], summary: { total: 10 } });
  assert.equal(store.history().length, 100);
  const head = store.history()[0];
  store.add(head);
  assert.equal(store.history().length, 100);
  assert.deepEqual(store.history()[0], head);
  assert.equal(store.clear(), true);
  assert.deepEqual(store.history(), []);
  const unavailable = new LocalStore({ getItem() { throw new Error(); }, setItem() { throw new Error(); } });
  assert.deepEqual(unavailable.history(), []);
  assert.equal(unavailable.add(head), false);
  assert.equal(unavailable.available, false);
});
