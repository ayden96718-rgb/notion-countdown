export const MODES = [
  { id: '1', number: 1, title: '个位数相加', symbol: '+', note: '10个数字 · 连续心算', kind: 'flash', hint: '记住第一张数字，之后把每张数字加上去。点击卡片切换，最后只答一次。' },
  { id: '2', number: 2, title: '个位数相减', symbol: '−', note: '起始数 + 10个减数', kind: 'flash', hint: '记住起始数，之后逐张减去卡片上的数字。点击卡片切换，最后只答一次。' },
  { id: '3', number: 3, title: '两位数加法', symbol: '+', note: '每题个位必进位', timing: 'two-digit-add-sub' },
  { id: '4', number: 4, title: '两位数减法', symbol: '−', note: '每题个位必借位', timing: 'two-digit-add-sub' },
  { id: '5', number: 5, title: '两位数加减混合', symbol: '±', note: '进位与借位交替挑战', timing: 'two-digit-add-sub', mixed: true },
  { id: '6', number: 6, title: '两位数×2', symbol: '×2', note: '不计时 · 专注倍增', untimed: true },
  { id: '7', number: 7, title: '两位数÷2', symbol: '÷2', note: '不计时 · 含 .5 答案', untimed: true },
  { id: '8', number: 8, title: '三位数加法', symbol: '+', note: '拓展你的心算跨度', timing: 'three-digit-addition' },
  { id: '9', number: 9, title: '三位数减法', symbol: '−', note: '三位数之间的减法', timing: 'three-digit-subtraction' },
  { id: '10', number: 10, title: '三位数加减混合', symbol: '±', note: '两种运算 · 随机混排', timing: 'three-digit-mixed-user-assigned', mixed: true }
];

export const EXTRA_MODES = [
  { id: 'three-minus-two', title: '三位数减两位数', symbol: '−', note: '跨位数减法', timing: 'three-minus-two', op: '-', digits: [3, 2] },
  { id: 'two-by-one', title: '两位数×一位数', symbol: '×', note: '基础乘法练习', timing: 'two-by-one-multiply', op: '*', digits: [2, 1] },
  { id: 'three-by-one', title: '三位数×一位数', symbol: '×', note: '乘法进阶练习', timing: 'three-by-one-multiply', op: '*', digits: [3, 1] },
  { id: 'two-by-11', title: '两位数×11', symbol: '×11', note: '固定倍数练习', timing: 'two-by-11', op: '*', digits: [2, 2], fixed: 11 },
  { id: 'two-by-15', title: '两位数×15', symbol: '×15', note: '固定倍数练习', timing: 'two-by-15', op: '*', digits: [2, 2], fixed: 15 },
  { id: 'two-by-two', title: '两位数×两位数', symbol: '×', note: '提高乘法熟练度', timing: 'two-by-two-multiply', op: '*', digits: [2, 2] },
  { id: 'custom', title: '自定义练习', symbol: '…', note: '位数、运算符与数值范围', custom: true }
];

export const ALL_MODES = [...MODES, ...EXTRA_MODES];
export const modeById = (id) => ALL_MODES.find((mode) => mode.id === String(id));
export const opSymbol = (op) => ({ '+': '+', '-': '−', '*': '×', '/': '÷' })[op];
