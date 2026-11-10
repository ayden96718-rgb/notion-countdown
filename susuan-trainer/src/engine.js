import { modeById, opSymbol } from './modes.js';

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function createSeed() {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}

const int = (rng, low, high) => low + Math.floor(rng() * (high - low + 1));
const pick = (rng, list) => list[int(rng, 0, list.length - 1)];
function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = int(rng, 0, i);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const digitWeights = [1, 2, 3, 4, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9];
function flashDigits(rng) {
  // Guarantee a clear majority of large digits while retaining variety.
  const digits = Array.from({ length: 7 }, () => int(rng, 6, 9));
  digits.push(...Array.from({ length: 3 }, () => pick(rng, digitWeights)));
  return shuffle(digits, rng);
}

export function countBorrows(start, digits) {
  let current = start;
  let borrows = 0;
  const steps = digits.map((digit) => {
    const borrowed = current % 10 < digit;
    const before = current;
    borrows += Number(borrowed);
    current -= digit;
    return { before, digit, borrowed, after: current };
  });
  return { borrows, answer: current, steps };
}

function generateFlash(group, rng) {
  if (group === '1') {
    let digits;
    for (let attempt = 0; attempt < 100; attempt++) {
      digits = flashDigits(rng);
      if (new Set(digits).size >= 4 && Math.max(...digits.map(d => digits.filter(n => n === d).length)) <= 4) break;
    }
    return { kind: 'flash', digits, cards: digits, answer: digits.reduce((a, b) => a + b, 0) };
  }
  const candidates = [];
  for (let attempt = 0; attempt < 96; attempt++) {
    const digits = flashDigits(rng);
    const distinct = new Set(digits).size;
    const mostRepeated = Math.max(...digits.map(d => digits.filter(n => n === d).length));
    if (distinct < 4 || mostRepeated > 4) continue;
    const sum = digits.reduce((a, b) => a + b, 0);
    // Each possible starting units digit changes the actual borrowing pattern.
    for (let start = sum + 1; start <= 99; start++) {
      const result = countBorrows(start, digits);
      candidates.push({ start, digits, ...result, score: result.borrows * 10 + distinct - mostRepeated / 2 });
    }
  }
  // Finite fallback is diverse, positive and has 8 borrows, even with a pathological RNG.
  if (!candidates.length) {
    const digits = [7, 6, 9, 7, 8, 8, 9, 9, 7, 7];
    const start = int(rng, 81, 99);
    const result = countBorrows(start, digits);
    return { kind: 'flash', start, digits, cards: [start, ...digits], ...result };
  }
  const bestScore = Math.max(...candidates.map(c => c.score));
  const selected = pick(rng, candidates.filter(c => c.score >= bestScore - 1));
  const { score, ...result } = selected;
  return { kind: 'flash', ...result, cards: [result.start, ...result.digits] };
}

const additionPools = [[], [], []];
const subtractionPool = [];
for (let a = 10; a <= 99; a++) {
  for (let b = 10; b <= 99; b++) {
    if (a % 10 + b % 10 >= 10) additionPools[Number(a < 20) + Number(b < 20)].push([a, b]);
    if (a > b && a % 10 < b % 10) subtractionPool.push([a, b]);
  }
}

export const calculate = (a, op, b) => op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b;
export const expression = (q) => `${q.a} ${opSymbol(q.op)} ${q.b}`;
const question = (a, op, b) => ({ a, op, b, answer: calculate(a, op, b) });
function opsFor(count, share, rng) {
  const plusCount = Math.max(1, Math.min(count - 1, Math.round(count * share)));
  return shuffle(Array.from({ length: count }, (_, i) => i < plusCount ? '+' : '-'), rng);
}
const bounds = (digits) => [10 ** (digits - 1), 10 ** digits - 1];

export function validateCustom(config) {
  if (!config || !Number.isInteger(config.firstDigits) || config.firstDigits < 1 || config.firstDigits > 4) throw new Error('首数位数须为1～4位');
  if (!Array.isArray(config.ops) || !config.ops.length || config.ops.some(op => !['+', '-', '*'].includes(op))) throw new Error('至少选择一种加、减、乘运算');
  if (!['digits', 'fixed', 'range'].includes(config.secondType)) throw new Error('请选择后数类型');
  if (config.secondType === 'digits' && (!Number.isInteger(config.secondDigits) || config.secondDigits < 1 || config.secondDigits > 4)) throw new Error('后数位数须为1～4位');
  if (config.secondType === 'fixed' && (!Number.isInteger(config.fixed) || config.fixed < 1 || config.fixed > 9999)) throw new Error('固定数字须为1～9999的整数');
  if (config.secondType === 'range' && (!Number.isInteger(config.min) || !Number.isInteger(config.max) || config.min < 1 || config.max > 9999 || config.min > config.max)) throw new Error('后数范围须为1～9999，且下限不大于上限');
  return config;
}

export function generateSession(id, count = 10, options = {}) {
  const mode = modeById(id);
  if (!mode) throw new Error('未知题型');
  if (!Number.isInteger(count) || count < 5 || count > 100) throw new Error('题量须为5～100的整数');
  const seed = options.seed ?? createSeed();
  const rng = seededRandom(seed);
  if (mode.kind === 'flash') return { modeId: mode.id, seed, count: 10, ...generateFlash(mode.id, rng) };
  const share = options.mixedShare ?? 0.5;
  if (![0.3, 0.5, 0.7].includes(share)) throw new Error('混合比例无效');
  const ops = mode.mixed ? opsFor(count, share, rng) : Array(count).fill(['4', '9', 'three-minus-two'].includes(mode.id) ? '-' : '+');
  let easyAdditions = 0;
  const easyLimit = Math.floor(0.3 * ops.filter(op => op === '+').length);
  const used = new Set();
  const questions = [];
  const custom = mode.custom ? validateCustom(options.custom) : null;
  for (let i = 0; i < count; i++) {
    let q;
    for (let retry = 0; retry < 80; retry++) {
      if (['3', '4', '5'].includes(mode.id)) {
        if (ops[i] === '+') {
          const choice = rng();
          const bucket = choice < 0.8 ? 0 : choice < 0.96 || easyAdditions >= easyLimit ? 1 : 2;
          const [a, b] = pick(rng, additionPools[bucket]);
          q = question(a, '+', b);
        } else {
          const [a, b] = pick(rng, subtractionPool);
          q = question(a, '-', b);
        }
      } else if (['6', '7'].includes(mode.id)) {
        q = question(int(rng, 10, 99), mode.id === '6' ? '*' : '/', 2);
      } else if (['8', '9', '10'].includes(mode.id)) {
        let a = int(rng, 100, 999), b = int(rng, 100, 999);
        if (ops[i] === '-') {
          if (a === b) continue;
          if (a < b) [a, b] = [b, a];
        }
        q = question(a, ops[i], b);
      } else if (custom) {
        const a = int(rng, ...bounds(custom.firstDigits));
        const b = custom.secondType === 'fixed' ? custom.fixed : custom.secondType === 'range' ? int(rng, custom.min, custom.max) : int(rng, ...bounds(custom.secondDigits));
        q = question(a, pick(rng, custom.ops), b);
      } else {
        q = question(int(rng, ...bounds(mode.digits[0])), mode.op, mode.fixed ?? int(rng, ...bounds(mode.digits[1])));
      }
      if (!used.has(expression(q)) || retry === 79) break;
    }
    if (!q) throw new Error('生成题目失败，请重试');
    if (q.op === '+' && q.a < 20 && q.b < 20) easyAdditions++;
    used.add(expression(q));
    questions.push(q);
  }
  return { modeId: mode.id, kind: 'quiz', seed, count, questions, options: { mixedShare: share, ...(custom ? { custom } : {}) } };
}
