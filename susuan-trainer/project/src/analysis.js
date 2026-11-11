import { timingFor } from './timing.js';

// Each series is built from one mode only; stored result judgments stay unchanged.
export function analyze(records, mode, reference) {
  const seen = new Set();
  const all = records.filter(r => {
    const s = r?.summary;
    if (r?.modeId !== mode.id || seen.has(r.id) || !Number.isFinite(Date.parse(r.date)) || !Number.isInteger(s?.total) || s.total <= 0 || !Number.isInteger(s.correct) || s.correct < 0 || s.correct > s.total) return false;
    seen.add(r.id); return true;
  }).sort((a,b) => Date.parse(a.date) - Date.parse(b.date));
  const flash = mode.kind === 'flash';
  const points = all.map((r, i) => {
    const s = r.summary;
    const seconds = !mode.untimed && !r.untimed && Number.isFinite(s.totalMs) && s.totalMs >= 0 ? s.totalMs / 1000 : null;
    const threshold = mode.timing ? timingFor(mode, s.total, reference) : null;
    const eligible = seconds !== null && threshold !== null;
    return { id:r.id, date:r.date, total:s.total, correct:s.correct, accuracy:s.correct/s.total*100, seconds,
      pace:seconds === null ? null : seconds/(flash ? 1 : s.total), threshold, passed:eligible ? s.correct===s.total && seconds<=threshold.pass : null };
  });
  points.forEach((p,i) => {
    const eligible=points.slice(Math.max(0,i-9),i+1).filter(x=>x.passed!==null);
    p.passSamples=eligible.length;
    p.passRate=eligible.length ? eligible.filter(x=>x.passed).length/eligible.length*100 : null;
  });
  const recent=points.slice(-10);
  const total=recent.reduce((n,p)=>n+p.total,0), correct=recent.reduce((n,p)=>n+p.correct,0);
  const timed=recent.filter(p=>p.seconds!==null), eligible=recent.filter(p=>p.passed!==null);
  const paceOf=list=>{const valid=list.filter(p=>p.seconds!==null);return valid.length ? valid.reduce((n,p)=>n+p.seconds,0)/valid.reduce((n,p)=>n+(flash?1:p.total),0) : null;};
  let change=null;
  if(recent.length===10){
    const before=recent.slice(0,5), after=recent.slice(5);
    const accuracyOf=list=>list.reduce((n,p)=>n+p.correct,0)/list.reduce((n,p)=>n+p.total,0)*100;
    const a=paceOf(before), b=paceOf(after);
    change={accuracy:accuracyOf(after)-accuracyOf(before), speed:a!==null&&a>0&&b!==null&&before.every(p=>p.seconds!==null)&&after.every(p=>p.seconds!==null)?(a-b)/a*100:null};
  }
  return {points:recent, total, correct, errorRate:total?(total-correct)/total*100:null, accuracy:total?correct/total*100:null,
    pace:paceOf(recent), timedCount:timed.length, passRate:eligible.length?eligible.filter(p=>p.passed).length/eligible.length*100:null, passSamples:eligible.length, change, flash};
}

export function chart(model) {
  const points=model.points;
  if(!points.length) return '<div class="analysis-empty">还没有完成的练习。完成一组后，这里就会出现统计。</div>';
  const left=42, right=430, top=26, bottom=206;
  const maxTime=Math.max(1,...points.map(p=>p.pace??0));
  const timeCeiling=Math.ceil(maxTime/5)*5;
  const x=i=>points.length===1?(left+right)/2:left+i/(points.length-1)*(right-left);
  const yRate=v=>bottom-v/100*(bottom-top);
  const yTime=v=>bottom-v/timeCeiling*(bottom-top);
  const line=(key,y,color,dash='')=>{
    let path='',open=false;
    points.forEach((p,i)=>{if(p[key]===null){open=false;return;}path+=`${open?'L':'M'}${x(i)},${y(p[key])} `;open=true;});
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" ${dash?`stroke-dasharray="${dash}"`:''}/>`+points.map((p,i)=>p[key]===null?'':`<circle cx="${x(i)}" cy="${y(p[key])}" r="3.5" fill="${color}"/>`).join('');
  };
  return `<svg class="trend-chart" viewBox="0 0 480 242" role="img" aria-label="本题型最近十次练习：正确率、近十次合格率与用时双轴折线图">${[0,25,50,75,100].map(v=>`<line x1="${left}" y1="${yRate(v)}" x2="${right}" y2="${yRate(v)}" stroke="#dce5d8"/><text x="35" y="${yRate(v)+5}" text-anchor="end">${v}%</text>${model.timedCount?`<text x="438" y="${yRate(v)+5}">${+(timeCeiling*v/100).toFixed(1)}</text>`:''}`).join('')}${line('pace',yTime,'#aa6925')}${line('accuracy',yRate,'#247c46')}${line('passRate',yRate,'#6261b3','6 4')}${points.map((p,i)=>`<text x="${x(i)}" y="230" text-anchor="middle">${i+1}</text>`).join('')}</svg>`;
}
