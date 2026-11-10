export function timingFor(mode, count, reference) {
  if (!mode?.timing || mode.untimed) return null;
  const records = reference.timings.filter(t => t.id === mode.timing);
  const exact = records.find(t => t.count === count);
  const base = exact ?? records.find(t => t.count === 10);
  if (!base) return null;
  const ratio = exact ? 1 : count / base.count;
  return {
    pass: Math.round(base.pass_s * ratio * 10) / 10,
    good: Math.round(base.good_s * ratio * 10) / 10,
    excellent: Math.round(base.excellent_s * ratio * 10) / 10,
    derived: !exact,
    source: base.image,
    note: exact ? `已核对的${count}题标准` : '按比例推算，非原应用截图原值'
  };
}

// Time is reported separately from correctness; no unconfirmed combined grade.
export function timeReference(totalMs, timing) {
  if (!timing) return null;
  const seconds = totalMs / 1000;
  return seconds <= timing.excellent ? '优秀用时区间' : seconds <= timing.good ? '良好用时区间' : seconds <= timing.pass ? '合格用时区间' : '继续练习';
}

export function formatTime(ms) {
  const seconds = Math.max(0, ms) / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)} 秒` : `${Math.floor(seconds / 60)} 分 ${(seconds % 60).toFixed(1)} 秒`;
}
