import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, chart } from '../src/analysis.js';
import { modeById } from '../src/modes.js';
import { readFileSync } from 'node:fs';
const reference=JSON.parse(readFileSync(new URL('../data/timing-reference.json',import.meta.url)));
const record=(i,{modeId='3',total=10,correct=10,ms=20000}={})=>({id:String(i),date:new Date(Date.UTC(2026,0,i+1)).toISOString(),modeId,summary:{total,correct,totalMs:ms}});
test('analysis isolates modes, orders records and limits each to its most recent ten',()=>{
 const list=Array.from({length:12},(_,i)=>record(i));
 const data=analyze([...list.reverse(),record(30,{modeId:'4',correct:0}),record(11)],modeById('3'),reference);
 assert.equal(data.points.length,10);assert.equal(data.points[0].id,'2');assert.equal(data.accuracy,100);assert.equal(data.passRate,100);assert.equal(data.points[0].passSamples,3);
});
test('accuracy is weighted by answers, time normalizes count, qualification requires both full accuracy and speed',()=>{
 const data=analyze([record(0),record(1,{total:5,correct:4,ms:10000}),record(2,{ms:28001}),record(3,{ms:28000})],modeById('3'),reference);
 assert.equal(data.total,35);assert.equal(data.correct,34);assert.equal(data.passRate,50);assert.equal(data.points[3].passed,true);assert.equal(data.points[2].passed,false);assert.equal(data.points[1].pace,2);assert.ok(Math.abs(data.errorRate-100/35)<1e-8);
});
test('rolling qualification uses ten same-mode sessions through each point',()=>{
 const data=analyze(Array.from({length:15},(_,i)=>record(i,{correct:i<5?0:10})),modeById('3'),reference);
 assert.ok(Math.abs(data.points[0].passRate-100/6)<1e-9);assert.equal(data.points.at(-1).passRate,100);assert.equal(data.points.at(-1).passSamples,10);
});
test('untimed and flash modes never invent a qualification threshold or zero duration',()=>{
 for(const id of ['6','7']){const d=analyze([record(0,{modeId:id,ms:1234})],modeById(id),reference);assert.equal(d.pace,null);assert.equal(d.passRate,null);}
 const flash=analyze([record(1,{modeId:'1',total:1,correct:1,ms:20000})],modeById('1'),reference);assert.equal(flash.pace,20);assert.equal(flash.passRate,null);
 const missing=analyze([record(0,{ms:null})],modeById('3'),reference);assert.equal(missing.pace,null);assert.equal(missing.passRate,null);
});
test('comparison needs ten sessions; malformed data ignored; empty and single points render safely',()=>{
 const mode=modeById('3');assert.equal(analyze([record(0)],mode,reference).change,null);
 const d=analyze(Array.from({length:10},(_,i)=>record(i,{ms:i<5?30000:15000})),mode,reference);assert.equal(d.change.speed,50);
 const empty=analyze([{...record(0),date:'bad'},record(1,{total:0}),record(2,{correct:11})],mode,reference);assert.equal(empty.total,0);assert.ok(chart(empty).includes('还没有'));
 const svg=chart(analyze([record(0)],mode,reference));assert.ok(!/NaN|Infinity/.test(svg));assert.ok(svg.includes('<circle'));
});
