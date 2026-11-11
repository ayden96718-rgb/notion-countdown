"""Real touch regression for stable controls and exactly one action per tap."""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
root = Path(__file__).resolve().parents[1]
results = []
with sync_playwright() as p:
    for name in ('chromium', 'webkit'):
        options = {'executable_path': '/usr/bin/chromium', 'args': ['--no-sandbox']} if name == 'chromium' else {'executable_path': os.environ['WEBKIT_EXECUTABLE_PATH']}
        browser = getattr(p, name).launch(headless=True, **options)
        ctx = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        base = os.environ.get('TEST_URL','http://127.0.0.1:4173/susuan-trainer/')
        def home():
            if page.locator('[data-action="leave"]').count():
                page.locator('[data-action="leave"]').tap()
                page.locator('#confirm-action').tap()
            else:
                page.goto(base)
            page.wait_for_selector('[data-mode="1"]')
        home()
        page.locator('[data-mode="3"]').tap()
        expect(page.locator('#answer')).to_be_visible()
        page.evaluate('window.originalKey = document.querySelector(".keypad [data-key=\\"1\\"]"); window.originalInput = document.querySelector("#answer")')
        for _ in range(3): page.locator('.keypad [data-key="1"]').tap()
        expect(page.locator('#answer')).to_have_value('111')
        page.locator('[data-key="clear"]').tap()
        for _ in range(4):
            a,b = map(int,re.findall(r'\d+',page.locator('.equation').inner_text()))
            for digit in str(a+b): page.locator(f'.keypad [data-key="{digit}"]').tap()
            page.locator('[data-action="submit"]').tap()
            expect(page.locator('#answer')).to_have_value('')
            assert page.evaluate('originalKey === document.querySelector(".keypad [data-key=\\"1\\"]") && originalInput === document.querySelector("#answer")')
        expect(page.locator('.progress-text')).to_contain_text('5 / 10')
        for mode, count in [('1',10),('2',11)]:
            home(); page.locator(f'[data-mode="{mode}"]').tap()
            page.evaluate('window.originalCard = document.querySelector(".flash-card")')
            digits=[]
            for i in range(count):
                expect(page.locator('.progress-text')).to_contain_text(f'{i+1} / {count}')
                digits.append(int(page.locator('#flash-digit').inner_text()))
                page.locator('.flash-card').tap()
                if i < count-1:
                    assert page.evaluate('originalCard === document.querySelector(".flash-card")')
            expect(page.locator('#answer')).to_be_visible()
            result=sum(digits) if mode=='1' else digits[0]-sum(digits[1:])
            for digit in str(result): page.locator(f'.keypad [data-key="{digit}"]').tap()
            page.locator('[data-action="submit"]').tap()
            expect(page.locator('.result-hero h2')).to_have_text(str(result))
        assert not errors, errors
        results.append({'browser':name,'status':'passed','checks':['single tap enters training','repeated digit taps are not lost or duplicated','four submissions keep keypad and input mounted','both flash modes keep card mounted and advance exactly once per tap','final answers match visible sequence','zero JavaScript errors']})
        browser.close()
(root/'docs/evidence/touch-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False))
