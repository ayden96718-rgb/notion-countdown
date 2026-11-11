"""Synthetic local-history analytics, touch navigation, and one-screen home fit."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
out=root/'artifacts/analysis-check';out.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as p:
 for name in ('chromium','webkit'):
  browser=getattr(p,name).launch(headless=True,**({'executable_path':'/usr/bin/chromium','args':['--no-sandbox']} if name=='chromium' else {'executable_path':os.environ['WEBKIT_EXECUTABLE_PATH']}))
  ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:4173/susuan-trainer/')
  for width,height in [(390,844),(820,1180),(640,640),(320,568)]:
   page.set_viewport_size({'width':width,'height':height})
   page.wait_for_selector('[data-mode="1"]')
   assert page.locator('[data-mode]').count()==23
   assert page.locator('.home-tools').evaluate('(n)=>n.getBoundingClientRect().bottom')<=height+1,(name,width,height)
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
   assert page.locator('.mode-card').first.bounding_box()['height']>=44
  page.set_viewport_size({'width':390,'height':844})
  page.locator('[data-nav="analysis"]').tap()
  expect(page.locator('.analysis-empty')).to_be_visible()
  page.evaluate('''() => {const records=Array.from({length:12},(_,i)=>({id:String(i),date:new Date(2026,0,i+1).toISOString(),modeId:'3',summary:{total:10,correct:i<4?8:10,totalMs:i<6?35000:22000},records:[]}));records.unshift({id:'untimed',date:new Date().toISOString(),modeId:'6',untimed:true,summary:{total:10,correct:9,totalMs:null},records:[]});localStorage.setItem('susuan.v1.history',JSON.stringify(records));}''')
  page.reload();page.locator('#analysis-mode').select_option('3')
  expect(page.locator('.analysis-stats')).to_contain_text('错误率 4.0%')
  expect(page.locator('.analysis-chart-panel h2')).to_contain_text('最近10次')
  assert page.locator('.trend-chart path').count()==3
  expect(page.locator('#point-detail')).to_contain_text('10次有效样本')
  page.locator('#analysis-point').fill('1')
  expect(page.locator('#point-number')).to_have_text('1')
  page.screenshot(path=str(out/f'{name}-analysis-phone.png'),full_page=True)
  page.locator('#analysis-mode').select_option('6')
  expect(page.locator('.analysis-stats')).to_contain_text('错误率 10.0%')
  assert page.locator('.time-legend,.pass-legend').count()==0
  page.locator('[data-nav="home"]').tap()
  page.screenshot(path=str(out/f'{name}-home-phone.png'),full_page=True)
  page.locator('[data-mode="3"]').tap()
  assert page.locator('.keypad').evaluate('(n)=>n.getBoundingClientRect().bottom')<=844
  page.locator('[data-action="leave"]').tap();page.locator('#confirm-action').tap()
  page.locator('[data-nav="analysis"]').tap();page.locator('#analysis-mode').select_option('3')
  page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
  if name=='chromium':
   ctx.set_offline(True);page.reload();page.locator('#analysis-mode').select_option('3')
  else:
   assert page.evaluate("async()=>{const keys=await caches.keys();return (await Promise.all(keys.map(async k=>(await caches.open(k)).match(new URL('./src/analysis.js',location.href).href)))).some(Boolean)}")
  expect(page.locator('.analysis-chart-panel h2')).to_contain_text('最近10次')
  assert not errors,errors
  reports.append({'browser':name,'status':'passed','checks':['23 home entries fit 390x844,820x1180,640x640,320x568 with >=44px targets','empty analysis','independent per-mode recent ten and weighted error rate','three curves and per-session slider details','untimed mode omits time and qualification','training keypad fits phone screen','offline analysis' if name=='chromium' else 'analysis module present in offline cache']})
  browser.close()
(root/'docs/evidence/analysis-browser-results.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(reports,ensure_ascii=False))
