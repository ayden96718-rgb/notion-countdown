"""Focused regressions for direct entry and history quantity restoration."""
import json, re, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = browser.new_context()
    ctx.add_init_script("if (!localStorage.getItem('susuan.v1.settings')) localStorage.setItem('susuan.v1.settings', JSON.stringify({count:7, customCount:false, modeId:'3'}))")
    page = ctx.new_page()
    page.goto(os.environ.get('TEST_URL', 'http://127.0.0.1:4173/susuan-trainer/'))
    expect(page.locator('.quantity-row')).to_contain_text('自定义（7题）')
    page.locator('[data-action="quantity"]').click()
    expect(page.locator('[name="countMode"][value="custom"]')).to_be_checked()
    page.locator('[data-action="close-modal"]').click()
    page.locator('[data-action="help"]').click()
    expect(page.locator('dialog')).to_contain_text('点击题型格子直接开始')
    assert '先选题量，再开始' not in page.locator('dialog').inner_text()
    page.locator('[data-action="close-modal"]').click()
    page.locator('[data-mode="3"]').click()
    for _ in range(7):
        nums = [int(n) for n in re.findall(r'\d+',page.locator('.equation').inner_text())]
        page.locator('#answer').fill(str(sum(nums)))
        page.keyboard.press('Enter')
    page.locator('[data-action="close-modal"]').click()
    page.locator('[data-action="home"]').click()
    page.locator('[data-action="quantity"]').click()
    page.locator('[name="countMode"][value="15"]').check()
    page.locator('#quantity-form button[type="submit"]').click()
    page.locator('a[data-nav="history"]').click()
    page.locator('.history-item').first.click()
    page.locator('[data-action="retry-result"]').click()
    expect(page.locator('.progress-text')).to_contain_text('/ 7')
    page.locator('[data-action="leave"]').click()
    page.locator('#confirm-action').click()
    expect(page.locator('.quantity-row')).to_contain_text('自定义（7题）')
    page.locator('[data-action="quantity"]').click()
    page.locator('[name="countMode"][value="15"]').check()
    page.locator('#quantity-form button[type="submit"]').click()
    page.locator('[data-mode="1"]').click()
    total = 0
    for _ in range(10):
        total += int(page.locator('#flash-digit').inner_text())
        page.locator('.flash-card').click()
    page.locator('#answer').fill(str(total))
    page.keyboard.press('Enter')
    page.locator('[data-action="retry-result"]').click()
    page.locator('[data-action="leave"]').click()
    page.locator('#confirm-action').click()
    expect(page.locator('.quantity-row')).to_contain_text('正常（15题）')
    assert page.locator('#current-mode,.practice-panel,[data-action="start"]').count() == 0
    browser.close()
result = {'status':'passed','build_cache':re.search(r"CACHE_PREFIX \+ '([a-f0-9]+)'", (root/'dist/sw.js').read_text())[1],'checks':['help describes direct entry','legacy custom quantity normalized','quiz history retry restores custom count','flash retry preserves global normal quantity']}
(root/'docs/evidence/direct-final-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
