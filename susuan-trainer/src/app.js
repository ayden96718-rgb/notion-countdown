import { MODES, EXTRA_MODES, modeById } from './modes.js';
import { generateSession, expression, formatAnswer, answerRule, validateCustom } from './engine.js';
import { TrainingSession } from './session.js';
import { timingFor, timeReference, formatTime } from './timing.js';
import { LocalStore } from './storage.js';

const main = document.querySelector('#main');
const modal = document.querySelector('#modal');
const escape = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let local;
try { local = window.localStorage; } catch { local = { getItem() { throw new Error('Unavailable'); }, setItem() { throw new Error('Unavailable'); } }; }
const store = new LocalStore(local);
const saved = store.read('settings', {});
const settings = {
  count: Number.isInteger(saved?.count) && saved.count >= 5 && saved.count <= 100 ? saved.count : 10,
  customCount: saved?.customCount === true || (Number.isInteger(saved?.count) && saved.count >= 5 && saved.count <= 100 && ![10, 15].includes(saved.count)),
  mixedShare: [0.3, 0.5, 0.7].includes(saved?.mixedShare) ? saved.mixedShare : 0.5,
  modeId: modeById(saved?.modeId) ? saved.modeId : '1'
};
let selected = modeById(settings.modeId);
let training = null;
let latestResult = null;
let timerHandle;
let toastHandle;
let reference;
let customConfig = store.read('custom', { firstDigits: 2, ops: ['+'], secondType: 'digits', secondDigits: 2, fixed: 11, min: 10, max: 99 });
try { validateCustom(customConfig); } catch { customConfig = { firstDigits: 2, ops: ['+'], secondType: 'digits', secondDigits: 2, fixed: 11, min: 10, max: 99 }; }

function toast(message) {
  const node = document.querySelector('#toast');
  node.textContent = message;
  node.classList.add('visible');
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => node.classList.remove('visible'), 3600);
}

function saveSettings() {
  if (!store.write('settings', settings)) toast('此浏览器无法保存设置；仍可继续练习。');
}
function hideToast() { clearTimeout(toastHandle); document.querySelector('#toast').classList.remove('visible'); }
function setRoute(hash) {
  hideToast();
  history.pushState(null, '', `#${hash}`);
  renderRoute();
}
function focusMain() { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
function stopTimer() { clearInterval(timerHandle); }
function activeTraining() { return training && !training.finished; }

function showDialog(html) {
  if (modal.open) modal.close();
  modal.innerHTML = html;
  modal.showModal();
}
function closeDialog() { modal.close(); }
function confirmAction(title, message, action, confirmLabel = '确定') {
  showDialog(`<h2 id="modal-title">${escape(title)}</h2><p>${escape(message)}</p><div class="dialog-actions"><button class="button" data-action="close-modal" autofocus>继续当前练习</button><button class="button primary" id="confirm-action">${escape(confirmLabel)}</button></div>`);
  modal.querySelector('#confirm-action').addEventListener('click', () => { closeDialog(); action(); }, { once: true });
}
function leaveFor(hash) {
  if (activeTraining()) confirmAction('离开这组练习？', '本组尚未完成，离开后不会记录这次成绩。', () => { stopTimer(); training = null; setRoute(hash); }, '离开练习');
  else setRoute(hash);
}

function modeCard(mode) {
  return `<button class="mode-card" data-mode="${mode.id}" data-core="${Boolean(mode.number)}" aria-label="${mode.number ? `第${mode.number}组 ` : ''}${mode.title}，点击开始">
    ${mode.number ? `<span class="mode-number">${String(mode.number).padStart(2, '0')}</span>` : ''}<strong>${mode.title}</strong></button>`;
}

function quantityLabel() {
  return settings.customCount ? `自定义（${settings.count}题）` : `${settings.count === 15 ? '正常' : '快速'}（${settings.count}题）`;
}

function renderHome() {
  stopTimer();
  main.classList.add('home-page');
  main.innerHTML = `<section class="direct-home" aria-label="训练题型"><button class="quantity-row" data-action="quantity" data-current-count="${settings.count}"><strong>题量</strong><span>${quantityLabel()}　›</span></button><section class="training-section" aria-label="点击题型直接开始"><div class="training-grid">${[...MODES, ...EXTRA_MODES].map(modeCard).join('')}</div></section><div class="home-tools"><button class="button" data-action="export-menu">导出题目</button><a class="button" href="#history">历史记录</a></div></section>`;
}

function showQuantity() {
  showDialog(`<h2 id="modal-title">题量</h2><form id="quantity-form"><div class="quantity-options">${[10, 15, 'custom'].map(value => `<label><input type="radio" name="countMode" value="${value}"${value === 'custom' ? settings.customCount ? ' checked' : '' : !settings.customCount && settings.count === value ? ' checked' : ''}>${value === 'custom' ? '自定义' : `${value === 10 ? '快速' : '正常'}（${value}题）`}</label>`).join('')}</div><label class="field-label" for="custom-count">自定义题数（5～100）</label><input class="field" id="custom-count" name="customCount" type="number" inputmode="numeric" min="5" max="100" step="1" value="${settings.count}"${settings.customCount ? '' : ' disabled'}><p>个位数加减固定10个数字。</p><details><summary>混合加减比例</summary><select class="field" name="mixedShare">${[0.3, 0.5, 0.7].map(n => `<option value="${n}"${settings.mixedShare === n ? ' selected' : ''}>约${n * 100}%加法 / ${100 - n * 100}%减法</option>`).join('')}</select></details><div class="dialog-actions"><button type="button" class="button" data-action="close-modal">取消</button><button type="submit" class="button primary">确定</button></div></form>`);
  const form = modal.querySelector('#quantity-form');
  form.addEventListener('change', () => {
    form.elements.customCount.disabled = form.elements.countMode.value !== 'custom';
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const custom = form.elements.countMode.value === 'custom';
    const count = Number(custom ? form.elements.customCount.value : form.elements.countMode.value);
    if (!Number.isInteger(count) || count < 5 || count > 100) return;
    settings.count = count;
    settings.customCount = custom;
    settings.mixedShare = Number(form.elements.mixedShare.value);
    saveSettings(); closeDialog(); renderHome();
  });
}

function showExport() {
  showDialog(`<h2 id="modal-title">导出题目</h2><form id="export-form"><label class="field-label" for="export-mode">题型</label><select class="field" id="export-mode">${[...MODES, ...EXTRA_MODES].map(mode => `<option value="${mode.id}"${selected.id === mode.id ? ' selected' : ''}>${mode.title}</option>`).join('')}</select><p>普通练习${settings.count}题，个位数加减固定10个数字。</p><div class="dialog-actions"><button type="button" class="button" data-action="close-modal">取消</button><button type="submit" class="button primary">导出</button></div></form>`);
  modal.querySelector('#export-form').addEventListener('submit', e => {
    e.preventDefault();
    const mode = modeById(modal.querySelector('#export-mode').value);
    if (mode) { exportQuestions(mode); closeDialog(); }
  });
}

function start(mode = selected) {
  hideToast();
  selected = mode; settings.modeId = mode.id; saveSettings();
  try {
    const spec = generateSession(mode.id, settings.count, { mixedShare: settings.mixedShare, custom: customConfig });
    training = new TrainingSession(spec, { untimed: mode.untimed });
    latestResult = null;
    history.pushState(null, '', '#train');
    renderTraining();
    focusMain();
    if (training.phase === 'answer') focusAnswer();
  } catch (error) { toast(error.message); }
}

function thresholds(mode, count) {
  if (mode.untimed) return '<div class="thresholds">不计时，按自己的节奏练习。</div>';
  const timing = timingFor(mode, count, reference);
  if (!timing) return mode.kind === 'flash' ? '' : '<div class="thresholds">记录用时 · 此题型时间门槛待核实</div>';
  return `<div class="thresholds">合格 <strong>${timing.pass}s</strong>　良好 <strong>${timing.good}s</strong>　优秀 <strong>${timing.excellent}s</strong>${timing.derived ? '<span class="threshold-note">按比例推算，非原应用截图原值</span>' : ''}</div>`;
}

function keypad() {
  const negative = training.spec.kind === 'quiz' && training.spec.questions.some(q => q.answer < 0);
  return `<div class="keypad" role="group" aria-label="数字键盘"><button class="utility" data-key="clear" aria-label="清空答案">清空</button><button class="utility" data-key="backspace" aria-label="退格">⌫ 退格</button><button class="utility" data-key="${negative ? 'sign' : '.'}" aria-label="${negative ? '切换正负号' : '输入小数点'}">${negative ? '±' : '小数点'}</button>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-key="${n}" aria-label="数字${n}">${n}</button>`).join('')}<button data-key="." aria-label="小数点">.</button><button data-key="0" aria-label="数字0">0</button><button class="confirm" data-action="submit">确定 ↵</button></div>`;
}

function answerArea() {
  return `<form id="answer-form" autocomplete="off"><label class="answer-label" for="answer">${training.spec.kind === 'flash' ? '所有数字已结束，请填写最终答案' : training.current.unit === '%' ? '你的答案（百分数数值）' : '你的答案'}</label><input id="answer" class="answer-input" type="text" inputmode="none" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="14" placeholder="输入答案" aria-describedby="answer-error"><div id="answer-error" class="answer-error" role="status"></div><button type="submit" hidden tabindex="-1">提交答案</button></form>${keypad()}<div class="keypad-caption">支持触屏与实体键盘 · Enter 确定 · Backspace 退格</div>`;
}

function renderTraining() {
  main.classList.remove('home-page');
  stopTimer();
  const mode = modeById(training.spec.modeId);
  const flash = training.spec.kind === 'flash';
  const cards = training.phase === 'cards';
  const index = flash ? Math.min(training.index + 1, training.spec.cards.length) : training.records.length + 1;
  const total = flash ? training.spec.cards.length : training.spec.count;
  const progress = flash ? training.index / total : training.records.length / total;
  main.innerHTML = `<section class="training" aria-labelledby="training-name"><div class="training-top"><button class="back-button" data-action="leave">← 返回首页</button><h1 id="training-name">${mode.title}</h1><span class="quiet">${mode.number ? `第 ${String(mode.number).padStart(2, '0')} 组` : '拓展练习'}</span></div>
    <div class="session-card"><div class="session-meta"><div class="progress-text">${cards ? '数卡' : flash ? '最终作答' : '题目'} <strong>${index}</strong> / ${total}</div>${mode.untimed ? '<span>自由练习</span>' : `<span class="timer" aria-label="累计用时">◷ <span id="timer">${formatTime(training.elapsed())}</span></span>`}</div><div class="progress-track" role="progressbar" aria-label="练习进度" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${cards ? training.index : flash ? total : training.records.length}"><div class="progress-fill" style="width:${progress * 100}%"></div></div>
    ${cards ? `<div class="flash-area"><span class="flash-stage">${mode.id === '2' ? training.index === 0 ? '先记住这个起始数' : `减去第 ${training.index} 个数字` : `记住并加上第 ${training.index + 1} 个数字`}</span><button class="flash-card" data-action="next-card" aria-label="当前数字${training.spec.cards[training.index]}，点击查看下一张"><span id="flash-digit">${training.spec.cards[training.index]}</span><span class="flash-tag">${training.index === total - 1 ? '点击，填写最终答案' : '点击卡片，继续 →'}</span></button><p class="flash-instruction">${mode.hint}</p></div>` : `${flash ? '<div class="equation">最后的结果是？</div>' : `<div class="equation${training.current.terms || training.current.unit ? ' wide-equation' : ''}" aria-label="${escape(expression(training.current))} 等于多少">${escape(expression(training.current))} =${training.current.unit ? ` ${training.current.unit}` : ''}</div>${answerRule(training.current) ? `<p class="answer-rule">${answerRule(training.current)}</p>` : ''}`}${thresholds(mode, training.spec.count)}${answerArea()}`}
    </div><div class="training-bottom"><p>${mode.untimed ? '不记录用时。' : '从首题显示计至最后一次提交，切到后台仍继续计时。'}${mode.id === '7' ? '奇数可用 .5 作答。' : ''}</p>${mode.custom ? '<button class="text-button" data-action="custom-builder">出题设置</button>' : ''}<button class="text-button" data-action="restart">↻ 重新开始</button></div></section>`;
  if (!mode.untimed) timerHandle = setInterval(() => {
    const timer = document.querySelector('#timer');
    if (timer && training) timer.textContent = formatTime(training.elapsed());
  }, 100);
  if (!cards) focusAnswer();
}

function focusAnswer() { document.querySelector('#answer')?.focus({ preventScroll: true }); }
function nextCard() {
  if (!training?.nextCard()) return;
  renderTraining();
  if (training.phase === 'cards') document.querySelector('.flash-card')?.focus({ preventScroll: true });
}
function keyInput(key) {
  const input = document.querySelector('#answer');
  if (!input || !activeTraining()) return;
  if (key === 'clear') input.value = '';
  else if (key === 'backspace') input.value = input.value.slice(0, -1);
  else if (key === 'sign') input.value = input.value.startsWith('-') ? input.value.slice(1) : `-${input.value}`;
  else if (key === '.') {
    if (!input.value.includes('.')) input.value = input.value === '' || input.value === '-' ? `${input.value}0.` : `${input.value}.`;
  } else if (input.value.length < 14) input.value += key;
  document.querySelector('#answer-error').textContent = '';
  focusAnswer();
}

function submit() {
  const input = document.querySelector('#answer');
  if (!input || !activeTraining()) return;
  const record = training.submit(input.value);
  if (!record) { document.querySelector('#answer-error').textContent = '请输入完整的数字答案'; focusAnswer(); return; }
  if (training.finished) complete();
  else renderTraining();
}

function complete() {
  stopTimer();
  latestResult = {
    id: crypto.randomUUID(), date: new Date().toISOString(), modeId: training.spec.modeId,
    spec: training.spec, records: training.records, summary: training.summary(),
    untimed: training.untimed, timing: timingFor(modeById(training.spec.modeId), training.spec.count, reference)
  };
  const savedOK = store.add(latestResult);
  history.replaceState(null, '', '#result');
  renderResult(latestResult, training.spec.kind !== 'flash');
  focusMain();
  if (!savedOK) toast('成绩已展示，但此浏览器无法保存历史；可以手动导出。');
}

function resultStats(result) {
  const { summary, timing, untimed } = result;
  const timeLabel = untimed ? '' : timeReference(summary.totalMs, timing);
  return `<div class="result-stats"><div><strong class="correct">${summary.correct}</strong><span>答对</span></div><div><strong class="${summary.wrong ? 'wrong' : ''}">${summary.wrong}</strong><span>答错</span></div>${untimed ? '' : `<div><strong>${formatTime(summary.totalMs)}</strong><span>整组用时</span></div>`}</div>${timeLabel ? `<p class="result-note">${timeLabel} · 仅作速度参考，正确率单独记录。${timing.derived ? '<br>时间门槛按比例推算，非原应用截图原值。' : ''}</p>` : ''}`;
}

function renderResult(result, popup = false) {
  main.classList.remove('home-page');
  stopTimer();
  if (!result) { setRoute('home'); return; }
  const mode = modeById(result.modeId);
  const flash = result.spec?.kind === 'flash';
  const correctCount = result.summary.correct;
  let review;
  if (flash) {
    const correct = result.records[0]?.correct;
    review = `<h2>按顺序回顾</h2>${result.spec.start ? `<div class="flash-start">起始数 <strong>${result.spec.start}</strong> · 依次减去下列数字</div>` : ''}<div class="digit-review">${result.spec.digits.map((n, i) => `<div><strong>${n}</strong><small>第 ${i + 1} 个</small></div>`).join('')}</div><p class="notice ${correct ? 'correct' : 'wrong'}">${correct ? '✓ 答对了' : '× 答错了'} · 你的答案 ${escape(result.records[0]?.entered)} · 正确答案 <strong>${result.spec.answer}</strong>${result.modeId === '2' ? `<br>逐步验算：本组发生 ${result.spec.borrows} 次个位借位 / 10 次减法` : ''}</p>`;
  } else {
    review = `<div class="section-label"><h2>逐题复盘</h2><span>${result.summary.total} 道题</span></div><div class="review-table-wrap"><table class="review-table"><thead><tr><th scope="col">题目</th><th scope="col">${result.records.some(q => q.relativeTolerance) ? '参考答案' : '正确答案'}</th><th scope="col">你的答案</th>${result.untimed ? '' : '<th scope="col">用时</th>'}</tr></thead><tbody>${result.records.map((q, i) => `<tr><td><span class="review-index">${i + 1}</span>${escape(expression(q))}</td><td>${formatAnswer(q)}</td><td class="${q.correct ? 'correct' : 'wrong'}">${escape(q.entered)}${q.unit ?? ''} ${q.correct ? '✓' : '×'}</td>${result.untimed ? '' : `<td>${(q.elapsedMs / 1000).toFixed(1)}s</td>`}</tr>`).join('')}</tbody></table></div>`;
  }
  main.innerHTML = `<section class="training"><div class="result-header"><div><div class="eyebrow">PRACTICE COMPLETE</div><h1>${flash ? '这一组，完成了。' : '练习完成。'}</h1></div><span class="quiet">${escape(mode?.title ?? '练习记录')}</span></div><div class="result-hero"><div class="result-kicker">${flash ? '最终心算结果' : '本次正确率'}</div><h2>${flash ? result.spec.answer : `${Math.round(correctCount / result.summary.total * 100)}%`}</h2>${resultStats(result)}${result.untimed ? '<p class="result-note">自由练习 · 不计时、不评级</p>' : ''}</div>${review}${result.records[0]?.relativeTolerance ? `<p class="result-note">${answerRule(result.records[0])}。${result.records[0].unit ? '参考百分数显示最多4位小数，误差按未取整的正确值计算。' : ''}</p>` : ''}<div class="result-actions"><button class="button primary" data-action="retry-result">再练一组 →</button><button class="button" data-action="home">返回首页</button><button class="text-button" data-action="export-result">导出本次记录 ↗</button></div></section>`;
  if (popup) showDialog(`<h2 id="modal-title">练习结果</h2><p>${escape(mode?.title ?? '')} · 共 ${result.summary.total} 道题</p>${resultStats(result)}<div class="dialog-actions"><button class="button" data-action="modal-home">返回首页</button><button class="button primary" data-action="close-modal" autofocus>查看逐题复盘</button></div>`);
}

function renderHistory() {
  main.classList.remove('home-page');
  stopTimer();
  const records = store.history();
  main.innerHTML = `<section class="training"><div class="eyebrow">YOUR PRACTICE LOG</div><h1>每一次练习，都算数。</h1><p class="quiet" style="margin-top:12px">仅保存最近100组，存于此浏览器。不同设备之间不会自动同步。</p>${records.length ? `<div class="history-list">${records.map(r => `<button class="history-item" data-record="${escape(r.id)}"><span><strong>${escape(modeById(r.modeId)?.title ?? '练习记录')}</strong><small>${escape(new Date(r.date).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</small></span><span class="score">${r.summary.correct} / ${r.summary.total} <span aria-hidden="true">↗</span><small>${r.untimed ? '自由练习 · 不计时' : formatTime(r.summary.totalMs)}</small></span></button>`).join('')}</div><div class="history-toolbar"><button class="button" data-action="export-history">导出全部记录</button><button class="button danger subtle" data-action="clear-history">清空本机记录</button></div>` : '<div class="empty-state"><h2>第一条记录，等你来写。</h2><p>完成一组练习，就能在这里回看答案。</p><button class="button primary" data-action="home">开始练习 →</button></div>'}</section>`;
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportQuestions(mode = selected) {
  const spec = generateSession(mode.id, settings.count, { mixedShare: settings.mixedShare, custom: customConfig });
  if (spec.kind === 'flash') {
    const lines = [`速算 · ${mode.title}`, '固定10个数字，按顺序逐张心算，最后统一作答。', ...(spec.start ? [`起始数：${spec.start}`, '依次减去下列数字：'] : ['依次相加下列数字：']), ...spec.digits.map((n, i) => `${i + 1}. ${n}`), '\n—— 参考答案 ——', String(spec.answer)];
    download(`速算-${mode.title}-10个数字.txt`, '\uFEFF' + lines.join('\n'), 'text/plain;charset=utf-8');
    toast('已导出一套新数卡；不会提前揭示下一次练习的数字。');
    return;
  }
  const lines = [`速算 · ${mode.title}`, `${spec.count}题 / 答案见末页`, ...(answerRule(spec.questions[0]) ? [answerRule(spec.questions[0])] : []), ''];
  spec.questions.forEach((q, i) => lines.push(`${i + 1}. ${expression(q)} = ______${q.unit ?? ''}`));
  lines.push('\n\n—— 参考答案 ——');
  spec.questions.forEach((q, i) => lines.push(`${i + 1}. ${formatAnswer(q)}`));
  download(`速算-${mode.title}-${spec.count}题.txt`, '\uFEFF' + lines.join('\n'), 'text/plain;charset=utf-8');
  toast('已生成一套新题；不会提前揭示下一次练习的题目。');
}

function showCustomBuilder() {
  const c = customConfig;
  const digits = (name, value) => `<select name="${name}" class="field">${[1, 2, 3, 4].map(n => `<option value="${n}"${value === n ? ' selected' : ''}>${n}位数</option>`).join('')}</select>`;
  showDialog(`<h2 id="modal-title">自定义练习</h2><p>本站支持加、减、乘运算。减法保留你设定的两数范围，可能出现负数答案。</p><form id="builder-form"><div class="form-grid"><label>首数位数${digits('firstDigits', c.firstDigits)}</label><label>后数类型<select class="field" name="secondType"><option value="digits"${c.secondType === 'digits' ? ' selected' : ''}>随机位数</option><option value="fixed"${c.secondType === 'fixed' ? ' selected' : ''}>固定数字</option><option value="range"${c.secondType === 'range' ? ' selected' : ''}>随机范围</option></select></label><div class="form-full"><span class="field-label">运算符（可多选）</span><div class="checkbox-row">${['+', '-', '*'].map(op => `<label><input type="checkbox" name="ops" value="${op}"${c.ops.includes(op) ? ' checked' : ''}>${{ '+': '加 ＋', '-': '减 −', '*': '乘 ×' }[op]}</label>`).join('')}</div></div><label class="form-full" data-builder="digits">后数位数${digits('secondDigits', c.secondDigits)}</label><label class="form-full" data-builder="fixed">固定数字<input class="field" name="fixed" type="number" min="1" max="9999" step="1" value="${c.fixed}"></label><label data-builder="range">范围下限<input class="field" name="min" type="number" min="1" max="9999" step="1" value="${c.min}"></label><label data-builder="range">范围上限<input class="field" name="max" type="number" min="1" max="9999" step="1" value="${c.max}"></label></div><div class="form-error" id="builder-error" role="status"></div><p>无已核实的时间门槛；规则保存在此浏览器。</p><div class="dialog-actions"><button type="button" class="button" data-action="close-modal">取消</button><button type="submit" class="button primary">应用并重新开始</button></div></form>`);
  const form = document.querySelector('#builder-form');
  const update = () => form.querySelectorAll('[data-builder]').forEach(node => {
    const visible = node.dataset.builder === form.elements.secondType.value;
    node.hidden = !visible; node.querySelectorAll('input, select').forEach(input => input.disabled = !visible);
  });
  form.elements.secondType.addEventListener('change', update); update();
  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(form);
    const config = { firstDigits: Number(data.get('firstDigits')), ops: data.getAll('ops'), secondType: data.get('secondType'), secondDigits: Number(data.get('secondDigits') ?? c.secondDigits), fixed: Number(data.get('fixed') ?? c.fixed), min: Number(data.get('min') ?? c.min), max: Number(data.get('max') ?? c.max) };
    try {
      validateCustom(config); customConfig = config; store.write('custom', config); closeDialog(); start(modeById('custom'));
    } catch (error) { document.querySelector('#builder-error').textContent = error.message; }
  });
}

function help() {
  showDialog(`<h2 id="modal-title">一间随身心算练习室</h2><p><strong>连续心算：</strong>第1、2组点击首页入口即开始，逐张点卡换数字，全部结束后只答一次。第2组先记起始数，再依次相减。</p><p><strong>逐题作答：</strong>点击题型格子直接开始，题量可按需调整。数字键盘或实体键盘均可输入；第7组允许奇数，用 .5 表示半整数。</p><p><strong>切换题型：</strong>点击首页任一格子，直接进入对应训练；首页“题量”只调整普通练习，个位数加减固定10个数字。自定义练习在答题页可修改规则。</p><p><strong>新增题型：</strong>普通除法四舍五入到2位小数；乘法估算允许相对误差±5%；三位÷四位填写百分数数值（例如6%填6），允许相对误差±3%。</p><p><strong>计时：</strong>首题显示至最后提交，包括后台和离开页面前的等待。第6、7组完全不计时。参考时间与正确率分别显示，尚未设定错题对等级的影响。</p><p><strong>安装与离线：</strong>iPhone/iPad Safari 点“分享 → 添加到主屏幕”。首次联网打开并完成缓存后可离线练习；清除浏览器数据会删除成绩。</p><p><strong>隐私：</strong>免费，无广告、账号或云端同步。最近100组成绩只存在当前浏览器，可以在练习记录页导出。</p><div class="dialog-actions"><button class="button primary" data-action="close-modal" autofocus>知道了</button></div>`);
}

function renderRoute() {
  if (!reference) return;
  const route = location.hash.slice(1) || 'home';
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', route === a.dataset.nav || route === 'result' && a.dataset.nav === 'history' || route === 'train' && a.dataset.nav === 'home'));
  if (route === 'history') renderHistory();
  else if (route === 'train' && training && !training.finished) renderTraining();
  else if (route === 'result' && latestResult) renderResult(latestResult);
  else { history.replaceState(null, '', '#home'); renderHome(); }
}

document.addEventListener('click', e => {
  const modeButton = e.target.closest('[data-mode]');
  if (modeButton) {
    const mode = modeById(modeButton.dataset.mode);
    if (mode) start(mode);
    return;
  }
  const key = e.target.closest('[data-key]');
  if (key) { keyInput(key.dataset.key); return; }
  const record = e.target.closest('[data-record]');
  if (record) { latestResult = store.history().find(r => r.id === record.dataset.record); setRoute('result'); focusMain(); return; }
  const nav = e.target.closest('a[href^="#"]');
  if (nav && nav.getAttribute('href') !== '#main') { e.preventDefault(); leaveFor(nav.hash.slice(1)); return; }
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'quantity') showQuantity();
  else if (action === 'export-menu') showExport();
  else if (action === 'next-card') nextCard();
  else if (action === 'submit') submit();
  else if (action === 'help') help();
  else if (action === 'leave') leaveFor('home');
  else if (action === 'home') setRoute('home');
  else if (action === 'close-modal') { closeDialog(); if (activeTraining()) focusAnswer(); }
  else if (action === 'modal-home') { closeDialog(); setRoute('home'); }
  else if (action === 'restart') confirmAction('重新开始这组练习？', '本次未完成的答案将丢弃，重新生成一组新题。', () => start(modeById(training.spec.modeId)), '重新开始');
  else if (action === 'retry-result') { const mode = modeById(latestResult.modeId); if (mode) { if (latestResult.spec.kind !== 'flash') { settings.count = latestResult.spec.count; settings.customCount = ![10, 15].includes(settings.count); } if (latestResult.spec.options?.custom) customConfig = latestResult.spec.options.custom; if (latestResult.spec.options?.mixedShare) settings.mixedShare = latestResult.spec.options.mixedShare; start(mode); } }
  else if (action === 'export-questions') exportQuestions();
  else if (action === 'export-result') download('速算-本次记录.json', JSON.stringify(latestResult, null, 2), 'application/json');
  else if (action === 'export-history') download('速算-练习记录.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records: store.history() }, null, 2), 'application/json');
  else if (action === 'clear-history') confirmAction('清空此浏览器的记录？', '将删除本机全部练习记录。建议先导出备份，此操作无法撤销。', () => { if (store.clear()) { renderHistory(); toast('本机记录已清空'); } else toast('无法清除本机存储'); }, '清空记录');
  else if (action === 'custom-builder') showCustomBuilder();
});

document.addEventListener('submit', e => { if (e.target.id === 'answer-form') { e.preventDefault(); submit(); } });
document.addEventListener('input', e => { if (e.target.id === 'answer') document.querySelector('#answer-error').textContent = ''; });
document.addEventListener('keydown', e => {
  if (modal.open || !activeTraining() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (training.phase === 'cards' && [' ', 'Enter', 'ArrowRight'].includes(e.key)) { e.preventDefault(); nextCard(); return; }
  if (training.phase !== 'answer') return;
  if (e.key === 'Enter') { e.preventDefault(); submit(); }
  else if (e.target.id !== 'answer' && /^\d$/.test(e.key)) { e.preventDefault(); keyInput(e.key); }
  else if (e.target.id !== 'answer' && e.key === '.') { e.preventDefault(); keyInput('.'); }
  else if (e.target.id !== 'answer' && e.key === 'Backspace') { e.preventDefault(); keyInput('backspace'); }
});
window.addEventListener('hashchange', () => {
  if (activeTraining() && location.hash !== '#train') {
    const destination = location.hash.slice(1) || 'home';
    history.replaceState(null, '', '#train');
    leaveFor(destination);
  } else renderRoute();
});
window.addEventListener('beforeunload', e => { if (activeTraining()) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('online', updateOfflineStatus);
window.addEventListener('offline', updateOfflineStatus);
async function updateOfflineStatus() {
  const node = document.querySelector('#offline-status');
  const scopeId = encodeURIComponent(new URL('../', import.meta.url).pathname);
  const ready = 'serviceWorker' in navigator && await caches.has(`susuan-${scopeId}-cf838cdf7300`);
  node.textContent = !navigator.onLine ? '当前离线 · 成绩仅存于此设备' : ready ? '离线已就绪 · 成绩仅存于此设备' : '本机计算 · 成绩仅存于此设备';
}

try {
  const response = await fetch('./data/timing-reference.json');
  if (!response.ok) throw new Error('计时资料加载失败');
  reference = await response.json();
  renderRoute();
  if (!store.available) toast('浏览器存储不可用，仍可练习；成绩请手动导出。');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      const check = () => updateOfflineStatus();
      if (registration.active) check();
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', check);
      });
      navigator.serviceWorker.addEventListener('controllerchange', check);
    }).catch(() => { document.querySelector('#offline-status').textContent = '离线缓存未启用 · 联网练习可用'; });
  }
} catch {
  main.innerHTML = '<section class="empty-state"><h1>练习室暂时没有打开。</h1><p>请联网后刷新。如在本地使用，请先运行 npm run dev，再打开显示的地址。</p><button class="button primary" id="reload">重新加载</button></section>';
  document.querySelector('#reload').addEventListener('click', () => location.reload());
}
