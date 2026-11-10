import { writeFile } from 'node:fs/promises';
import { generateSession } from '../src/engine.js';
const audit = { method: 'Deterministic seeds 0..999 for flash subtraction; 4 seeds × every count 5..100 for groups 3–5.', groups: {} };
const flash = Array.from({ length: 1000 }, (_, seed) => generateSession('2', 10, { seed }));
audit.groups['2'] = {
  sampledSets: flash.length,
  minBorrows: Math.min(...flash.map(s => s.borrows)),
  maxBorrows: Math.max(...flash.map(s => s.borrows)),
  averageBorrows: flash.reduce((n, s) => n + s.borrows, 0) / flash.length,
  distinctStartingNumbers: new Set(flash.map(s => s.start)).size,
  minimumAnswer: Math.min(...flash.map(s => s.answer)),
  maximumStartingNumber: Math.max(...flash.map(s => s.start)),
  example: generateSession('2', 10, { seed: 20261110 })
};
for (const id of ['3', '4', '5']) {
  const result = { sampledQuestions: 0, additionQuestions: 0, subtractionQuestions: 0, carryViolations: 0, borrowViolations: 0, teenCapViolations: 0 };
  for (let count = 5; count <= 100; count++) for (let seed = 0; seed < 4; seed++) {
    const s = generateSession(id, count, { seed });
    const adds = s.questions.filter(q => q.op === '+');
    result.teenCapViolations += Number(adds.filter(q => q.a < 20 && q.b < 20).length > Math.floor(.3 * adds.length));
    for (const q of s.questions) {
      result.sampledQuestions++;
      if (q.op === '+') { result.additionQuestions++; result.carryViolations += Number(q.a % 10 + q.b % 10 < 10); }
      else { result.subtractionQuestions++; result.borrowViolations += Number(q.a <= q.b || q.a % 10 >= q.b % 10); }
    }
  }
  audit.groups[id] = result;
}
await writeFile(new URL('../docs/evidence/algorithm-audit.json', import.meta.url), JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify(audit, null, 2));
