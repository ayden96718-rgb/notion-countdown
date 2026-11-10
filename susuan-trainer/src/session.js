export function parseAnswer(raw) {
  const text = String(raw).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && Math.abs(value) <= 1e12 ? value : null;
}

export function isCorrectAnswer(value, question) {
  if (!Number.isFinite(value) || !Number.isFinite(question.answer)) return false;
  if (!question.relativeTolerance) return value === question.answer;
  const allowance = Math.abs(question.answer) * question.relativeTolerance;
  const roundingSlack = Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(question.answer)) * 8;
  return Math.abs(value - question.answer) <= allowance + roundingSlack;
}

export class TrainingSession {
  constructor(spec, { untimed = false, now = () => performance.now() } = {}) {
    this.spec = spec;
    this.untimed = untimed;
    this.now = now;
    this.index = 0;
    this.startedAt = untimed ? null : now();
    this.lastAt = this.startedAt;
    this.records = [];
    this.phase = spec.kind === 'flash' ? 'cards' : 'answer';
    this.finished = false;
  }
  nextCard() {
    if (this.phase !== 'cards' || this.finished) return false;
    this.index++;
    if (this.index >= this.spec.cards.length) this.phase = 'answer';
    return true;
  }
  get current() {
    return this.spec.kind === 'flash' ? { answer: this.spec.answer } : this.spec.questions[this.records.length];
  }
  submit(raw) {
    if (this.finished || this.phase !== 'answer') return null;
    const value = parseAnswer(raw);
    if (value === null) return null;
    const stamp = this.untimed ? null : this.now();
    const q = this.current;
    const record = { ...q, entered: String(raw), value, correct: isCorrectAnswer(value, q), elapsedMs: this.untimed ? null : Math.max(0, stamp - this.lastAt) };
    this.records.push(record);
    this.lastAt = stamp;
    const expectedCount = this.spec.kind === 'flash' ? 1 : this.spec.count;
    if (this.records.length === expectedCount) {
      this.finished = true;
      this.phase = 'finished';
      this.totalMs = this.untimed ? null : Math.max(0, stamp - this.startedAt);
    }
    return record;
  }
  elapsed() {
    return this.untimed ? null : this.finished ? this.totalMs : Math.max(0, this.now() - this.startedAt);
  }
  summary() {
    if (!this.finished) throw new Error('练习尚未完成');
    const correct = this.records.filter(r => r.correct).length;
    return { correct, wrong: this.records.length - correct, total: this.records.length, totalMs: this.totalMs };
  }
}
