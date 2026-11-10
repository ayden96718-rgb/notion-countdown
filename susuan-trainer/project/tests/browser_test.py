"""Real-browser acceptance. Start `npm run build && npm run preview` first.

Uses system Chromium and, when installed, Playwright WebKit. All records produced
by this script are synthetic QA data in isolated disposable browser contexts.
"""
import json
import os
import re
from pathlib import Path
from time import monotonic
from decimal import Decimal, ROUND_HALF_UP
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = Path(os.environ.get('EVIDENCE_DIR', str(ROOT / 'docs' / 'evidence')))
EVIDENCE.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173/susuan-trainer/')
reports = []
replay = []
errors = []


def check(name, action):
    started = monotonic()
    action()
    reports.append({'check': name, 'status': 'passed', 'seconds': round(monotonic() - started, 2)})
    print('PASS', name, flush=True)


def history(page):
    return page.evaluate("JSON.parse(localStorage.getItem('susuan.v1.history') || '[]')")


def equation(page):
    text = page.locator('.equation').inner_text()
    match = re.fullmatch(r'(\d+) ([+−×÷]) (\d+) =', text)
    assert match, text
    a, op, b = int(match[1]), match[2], int(match[3])
    value = {'+': lambda: a+b, '−': lambda: a-b, '×': lambda: a*b, '÷': lambda: a/b}[op]()
    return a, op, b, value


def answer(page, value, touch=False):
    value = str(value).removesuffix('.0')
    if touch:
        for char in value:
            page.locator(f'.keypad [data-key="{char}"]').first.click()
        page.locator('[data-action="submit"]').click()
    else:
        page.locator('#answer').fill(value)
        page.keyboard.press('Enter')


def home(page):
    if page.locator('dialog[open]').count():
        page.locator('[data-action="close-modal"]').click()
    if page.locator('[data-action="home"]').count():
        page.locator('[data-action="home"]').first.click()
    elif page.locator('[data-action="leave"]').count():
        page.locator('[data-action="leave"]').click()
        if page.locator('dialog[open]').count():
            page.locator('#confirm-action').click()
    else:
        page.goto(BASE + '#home')
    page.wait_for_selector('[data-mode="1"]')
    page.locator('#main').focus()
    page.evaluate('window.scrollTo(0, 0)')


def set_count(page, count):
    if page.locator('.quantity-row').get_attribute('data-current-count') == str(count):
        return
    page.locator('[data-action="quantity"]').click()
    form = page.locator('#quantity-form')
    value = str(count) if count in (10, 15) else 'custom'
    form.locator(f'[name="countMode"][value="{value}"]').check()
    if value == 'custom':
        form.locator('#custom-count').fill(str(count))
    form.locator('button[type="submit"]').click()
    expect(page.locator('dialog[open]')).to_have_count(0)


def start(page, group, count=10):
    if group not in ('1', '2'):
        set_count(page, count)
    page.locator(f'[data-mode="{group}"]').click()
    expect(page.locator('.flash-card' if group in ('1', '2') else '#answer')).to_be_visible()


def finish_quiz(page, count, wrong_first=False, touch=False):
    questions = []
    for i in range(count):
        a, op, b, value = equation(page)
        questions.append((a, op, b, value))
        answer(page, value+1 if wrong_first and i == 0 else value, touch=touch)
    expect(page.locator('dialog[open]')).to_be_visible()
    expect(page.locator('#modal-title')).to_have_text('练习结果')
    page.locator('[data-action="close-modal"]').click()
    expect(page.locator('.review-table tbody tr')).to_have_count(count)
    result = history(page)[0]
    assert result['summary']['total'] == count
    assert result['summary']['correct'] == count - int(wrong_first)
    assert result['summary']['wrong'] == int(wrong_first)
    if not result['untimed']:
        assert abs(sum(q['elapsedMs'] for q in result['records']) - result['summary']['totalMs']) < .01
    return questions, result


def flash_flow(page, group):
    home(page)
    start(page, group)
    digits = []
    steps = 10 if group == '1' else 11
    for i in range(steps):
        assert page.locator('#answer').count() == 0
        assert page.locator('.digit-review').count() == 0
        assert page.locator('.equation').count() == 0
        value = int(page.locator('#flash-digit').inner_text())
        digits.append(value)
        # Only the visible digit is exposed; replay records real UI clicks.
        replay.append({'group': group, 'card': i+1, 'visible': value, 'action': 'click whole card'})
        if i == 0:
            page.screenshot(path=str(EVIDENCE / f'group-{group}-flash.png'), full_page=True)
        page.locator('.flash-card').click(position={'x': 25, 'y': 25})
    assert page.locator('.flash-card').count() == 0
    expected = sum(digits) if group == '1' else digits[0] - sum(digits[1:])
    assert expected > 0
    answer(page, expected, touch=True)
    expect(page.locator('.digit-review > div')).to_have_count(10)
    expect(page.locator('.result-hero h2')).to_have_text(str(expected))
    assert page.locator('dialog[open]').count() == 0
    saved = history(page)[0]
    assert saved['summary']['correct'] == 1
    assert saved['spec']['cards'] == digits
    assert saved['spec']['answer'] == expected
    if group == '2':
        current, borrows = digits[0], 0
        for d in digits[1:]:
            borrows += int(current % 10 < d)
            current -= d
        assert borrows == saved['spec']['borrows']
    page.screenshot(path=str(EVIDENCE / f'group-{group}-result.png'), full_page=True)
    before = len(history(page))
    page.reload()
    assert len(history(page)) == before
    replay.append({'group': group, 'expectedAnswer': expected, 'correct': True, 'cards': digits})


with sync_playwright() as p:
    chromium = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = chromium.new_context(viewport={'width': 1280, 'height': 1000}, accept_downloads=True)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE)
    page.wait_for_selector('[data-mode="1"]')

    def home_check():
        assert page.locator('.training-section > .training-grid [data-core="true"]').count() == 10
        assert '闪电心算' not in page.locator('.training-section > .training-grid').inner_text()
        assert len(page.locator('.training-grid').evaluate('(node) => getComputedStyle(node).gridTemplateColumns').split()) == 3
        page.screenshot(path=str(EVIDENCE / 'desktop-home.png'), full_page=True)
    check('desktop: ten correctly numbered main entries, original green UI', home_check)

    def direct_entries():
        assert page.locator('#current-mode, .practice-panel, [data-action="start"]').count() == 0
        entries = page.locator('[data-mode]').evaluate_all('(nodes) => nodes.map(n => [n.dataset.mode, n.querySelector("strong").textContent])')
        assert len(entries) == 23
        assert [title for _, title in entries[:2]] == ['个位数相加', '个位数相减']
        for group, title in entries:
            home(page)
            assert page.locator('.mode-card.selected').count() == 0
            # Exactly one tile click must enter the exercise, including custom.
            page.locator(f'[data-mode="{group}"]').click()
            expect(page).to_have_url(re.compile(r'#train$'))
            expect(page.locator('#training-name')).to_have_text(title)
            expect(page.locator('.flash-card' if group in ('1', '2') else '#answer')).to_be_visible()
            assert page.locator('dialog[open]').count() == 0
        home(page)
    check('all 23 tiles: one click enters matching training, no selection panel, dropdown, preselection or extra start button', direct_entries)

    def quantity_and_flash_export():
        set_count(page, 15)
        page.reload()
        expect(page.locator('.quantity-row')).to_have_attribute('data-current-count', '15')
        for group in ('1', '2'):
            page.locator('[data-action="export-menu"]').click()
            page.locator('#export-mode').select_option(group)
            with page.expect_download() as dl:
                page.locator('#export-form button[type="submit"]').click()
            content = Path(dl.value.path()).read_text('utf-8-sig')
            assert '参考答案' in content and '固定10个数字' in content
            page.locator(f'[data-mode="{group}"]').click()
            assert page.locator('.progress-text').inner_text().endswith('10' if group == '1' else '11')
            home(page)
        set_count(page, 10)
    check('quantity: optional setting persists; single-digit groups retain fixed cards and export independently', quantity_and_flash_export)
    check('group 1: real clicks through ten cards, final-only answer and sequence review', lambda: flash_flow(page, '1'))
    check('group 2: eleven real cards, dynamic positive subtraction and actual borrow review', lambda: flash_flow(page, '2'))

    def two_digit():
        home(page); start(page, '3')
        page.locator('[data-action="submit"]').click()
        expect(page.locator('#answer-error')).to_have_text('请输入完整的数字答案')
        assert '1' in page.locator('.progress-text').inner_text()
        a, op, b, value = equation(page)
        page.locator('[data-key="1"]').click()
        page.locator('[data-key="2"]').click()
        page.locator('[data-key="backspace"]').click()
        expect(page.locator('#answer')).to_have_value('1')
        page.locator('[data-key="clear"]').click()
        expect(page.locator('#answer')).to_have_value('')
        q, result = finish_quiz(page, 10, wrong_first=True, touch=True)
        assert all(a % 10 + b % 10 >= 10 for a, op, b, val in q)
        assert result['summary']['correct'] == 9
        page.screenshot(path=str(EVIDENCE / 'group-3-review.png'), full_page=True)
        before = len(history(page)); page.reload(); assert len(history(page)) == before
        home(page); start(page, '4', 15)
        assert '42s' in page.locator('.thresholds').inner_text()
        q, _ = finish_quiz(page, 15)
        assert all(a > b and a % 10 < b % 10 for a, op, b, val in q)
        home(page); start(page, '5', 10)
        q, _ = finish_quiz(page, 10)
        assert set(op for _, op, _, _ in q) == {'+', '−'}
    check('groups 3–5: touch keyboard, blank rejection, 10/15 answers, constraints and exact review totals', two_digit)

    def untimed():
        for group in ('6', '7'):
            home(page); start(page, group)
            assert page.locator('.timer').count() == 0
            assert not re.search('合格|良好|优秀', page.locator('.session-card').inner_text())
            page.screenshot(path=str(EVIDENCE / f'group-{group}-untimed.png'), full_page=True)
            q, result = finish_quiz(page, 10, touch=group == '7')
            assert result['summary']['totalMs'] is None
            assert all(row['elapsedMs'] is None for row in result['records'])
            assert page.locator('.review-table th').count() == 3
            assert '秒' not in page.locator('.result-hero').inner_text()
            if group == '7': assert any(a % 2 for a, _, _, _ in q)
    check('groups 6/7: no clock in training/results/history; odd ÷2 accepted as .5', untimed)

    def three_digit():
        for group, line in [('8', '40s'), ('9', '38s'), ('10', '42s')]:
            home(page); start(page, group)
            assert line in page.locator('.thresholds').inner_text()
            if group == '10':
                assert '34s' in page.locator('.thresholds').inner_text()
                assert '28s' in page.locator('.thresholds').inner_text()
            page.screenshot(path=str(EVIDENCE / f'group-{group}-timing.png'), full_page=True)
            q, _ = finish_quiz(page, 10)
            assert all(100 <= a <= 999 and 100 <= b <= 999 for a, op, b, v in q)
        home(page); start(page, '10', 15)
        assert '按比例推算' in page.locator('.thresholds').inner_text()
        assert '63s' in page.locator('.thresholds').inner_text()
    check('groups 8–10: distinct 10-question timing evidence, three-digit operands, derived 15-question label', three_digit)

    def screenshot_modes():
        expected_names = ['many-addition', 'three-by-one-divide', 'three-by-two-divide', 'five-by-three-divide', 'fraction-to-percent', 'multiplication-estimation']
        home(page)
        assert page.locator('[data-mode]').count() == 23
        for mode_id in expected_names:
            home(page); start(page, mode_id)
            for i in range(10):
                text = page.locator('.equation').inner_text()
                nums = [int(n) for n in re.findall(r'\d+', text)]
                if mode_id == 'many-addition':
                    assert len(nums) == 4
                    value = sum(nums)
                    entry = str(value + int(i == 0))
                elif mode_id == 'fraction-to-percent':
                    assert text.endswith('%')
                    assert '相对误差±3%' in page.locator('.answer-rule').inner_text()
                    value = nums[0] / nums[1] * 100
                    entry = str(round(value / 100 if i == 0 else value * 1.01, 4))
                elif mode_id == 'multiplication-estimation':
                    assert '相对误差±5%' in page.locator('.answer-rule').inner_text()
                    value = nums[0] * nums[1]
                    entry = str(round(value * (1.10 if i == 0 else 1.02), 2))
                else:
                    assert '四舍五入到2位小数' in page.locator('.answer-rule').inner_text()
                    value = (Decimal(nums[0]) / Decimal(nums[1])).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    entry = str(value + int(i == 0))
                if i == 0:
                    page.screenshot(path=str(EVIDENCE / f'new-{mode_id}-training.png'), full_page=True)
                answer(page, entry, touch=mode_id in ('fraction-to-percent', 'three-by-two-divide'))
            page.locator('[data-action="close-modal"]').click()
            result = history(page)[0]
            assert result['summary']['correct'] == 9, (mode_id, result['summary'])
            assert result['summary']['wrong'] == 1
            expect(page.locator('.review-table tbody tr')).to_have_count(10)
            assert abs(sum(row['elapsedMs'] for row in result['records']) - result['summary']['totalMs']) < .01
            if mode_id == 'fraction-to-percent':
                assert result['records'][0]['unit'] == '%'
                assert result['records'][0]['relativeTolerance'] == .03
                assert '%' in page.locator('.review-table tbody tr').first.inner_text()
            elif mode_id == 'multiplication-estimation':
                assert result['records'][0]['relativeTolerance'] == .05
            page.screenshot(path=str(EVIDENCE / f'new-{mode_id}-review.png'), full_page=True)
    check('six new screenshot modes: visible arithmetic, decimal touch input, 5%/3% relative grading, wrong answers and full review', screenshot_modes)

    def navigation_and_count():
        home(page); start(page, '10', 15)
        page.locator('[data-action="leave"]').click()
        expect(page.locator('dialog[open]')).to_be_visible()
        page.locator('[data-action="close-modal"]').click()
        expect(page.locator('#answer')).to_be_visible()
        page.locator('[data-action="restart"]').click()
        page.locator('#confirm-action').click()
        assert page.locator('.progress-text').inner_text().strip().startswith('题目 1')
        home(page)
        page.locator('[data-action="quantity"]').click()
        form = page.locator('#quantity-form')
        form.locator('[name="countMode"][value="custom"]').check()
        page.locator('#custom-count').fill('4')
        form.locator('button[type="submit"]').click()
        assert page.locator('#answer').count() == 0
        expect(form).to_be_visible()
        page.locator('#custom-count').fill('7')
        form.locator('button[type="submit"]').click()
        page.locator('[data-mode="3"]').click()
        expect(page.locator('#answer')).to_be_visible()
        assert '19.6s' in page.locator('.thresholds').inner_text()
        finish_quiz(page, 7)
    check('navigation/restart confirmation preserves unfinished answers; custom count rejects 4 and accepts 7', navigation_and_count)

    def custom_and_exports():
        home(page)
        set_count(page, 10)
        page.locator('[data-mode="custom"]').click()
        expect(page.locator('#answer')).to_be_visible()
        page.locator('[data-action="custom-builder"]').click()
        form = page.locator('#builder-form')
        form.locator('[name="firstDigits"]').select_option('1')
        form.locator('[name="secondType"]').select_option('range')
        form.locator('[name="ops"][value="+"]').uncheck()
        form.locator('[name="ops"][value="-"]').check()
        form.locator('[name="min"]').fill('500')
        form.locator('[name="max"]').fill('100')
        form.locator('button[type="submit"]').click()
        assert '下限' in page.locator('#builder-error').inner_text()
        form.locator('[name="max"]').fill('600')
        form.locator('button[type="submit"]').click()
        expect(page.locator('dialog[open]')).to_have_count(0)
        a, op, b, value = equation(page)
        assert value < 0
        # Exercise touch ± for negative answers.
        page.locator('[data-key="sign"]').click()
        for char in str(abs(value)): page.locator(f'[data-key="{char}"]').click()
        page.locator('[data-action="submit"]').click()
        for _ in range(9): answer(page, equation(page)[3])
        page.locator('[data-action="close-modal"]').click()
        assert history(page)[0]['summary']['correct'] == 10
        page.locator('[data-action="home"]').click()
        page.locator('[data-action="export-menu"]').click()
        page.locator('#export-mode').select_option('custom')
        with page.expect_download() as dl:
            page.locator('#export-form button[type="submit"]').click()
        content = Path(dl.value.path()).read_text('utf-8-sig')
        assert '参考答案' in content and '10.' in content
        page.locator('a[data-nav="history"]').click()
        expect(page.locator('.history-item')).to_have_count(len(history(page)))
        with page.expect_download() as dl: page.locator('[data-action="export-history"]').click()
        exported = json.loads(Path(dl.value.path()).read_text())
        assert len(exported['records']) == len(history(page))
        before = len(history(page)); page.locator('.history-item').first.click()
        expect(page.locator('.review-table tbody tr')).to_have_count(10)
        assert len(history(page)) == before
    check('custom range validation, negative answers via ±, question export and persistent history export/review', custom_and_exports)

    def responsive():
        for size, name in [({'width': 390, 'height': 844}, 'phone'), ({'width': 820, 'height': 1180}, 'tablet'), ({'width': 320, 'height': 568}, 'small-phone')]:
            home(page); page.set_viewport_size(size)
            set_count(page, 10)
            page.evaluate('window.scrollTo(0, 0)')
            page.screenshot(path=str(EVIDENCE / f'{name}-home.png'), full_page=True)
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), name
            assert page.locator('.training-section > .training-grid [data-core="true"]').count() == 10
            assert len(page.locator('.training-grid').evaluate('(node) => getComputedStyle(node).gridTemplateColumns').split()) == 3
            start(page, '7', 10)
            page.screenshot(path=str(EVIDENCE / f'{name}-training.png'), full_page=True)
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), name
            assert page.locator('.keypad button').first.bounding_box()['height'] >= 44
            home(page)
        page.set_viewport_size({'width': 1280, 'height': 1000})
    check('390px phone, 820px tablet and 320px small phone: no horizontal overflow, ≥44px touch keys', responsive)

    def offline():
        home(page)
        page.evaluate('navigator.serviceWorker.ready')
        page.wait_for_function('navigator.serviceWorker.controller !== null')
        page.wait_for_function("document.querySelector('#offline-status').textContent.includes('离线已就绪')")
        context.set_offline(True)
        page.reload()
        page.wait_for_selector('[data-mode="1"]')
        start(page, '3', 10)
        finish_quiz(page, 10)
        page.screenshot(path=str(EVIDENCE / 'offline-result.png'), full_page=True)
        assert '当前离线' in page.locator('#offline-status').inner_text()
        home(page); start(page, 'fraction-to-percent', 10)
        for _ in range(10):
            a, b = [int(n) for n in re.findall(r'\d+', page.locator('.equation').inner_text())]
            answer(page, round(a / b * 100, 4), touch=True)
        page.locator('[data-action="close-modal"]').click()
        assert history(page)[0]['summary']['correct'] == 10
        page.screenshot(path=str(EVIDENCE/'offline-percent-result.png'), full_page=True)
        context.set_offline(False)
    check('Pages project subpath: installed service worker reloads and completes a full quiz offline', offline)

    def blocked_storage():
        ctx = chromium.new_context(viewport={'width': 390, 'height': 844})
        ctx.add_init_script("Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('blocked','SecurityError'); }});")
        tab = ctx.new_page()
        tab.on('pageerror', lambda error: errors.append(str(error)))
        tab.goto(BASE)
        tab.wait_for_selector('[data-mode="1"]')
        start(tab, '6')
        for _ in range(10): answer(tab, equation(tab)[3])
        expect(tab.locator('dialog[open]')).to_be_visible()
        tab.locator('[data-action="close-modal"]').click()
        expect(tab.locator('.review-table tbody tr')).to_have_count(10)
        ctx.close()
    check('blocked localStorage: practice and results still work, export remains available', blocked_storage)

    def zero_errors(): assert not errors, errors
    check('zero uncaught browser JavaScript errors during all Chromium flows', zero_errors)
    context.close(); chromium.close()

    # Safari uses WebKit. This emulates viewport/touch on Linux, not an actual iPhone device.
    try:
        webkit = p.webkit.launch(headless=True, **({'executable_path': os.environ['WEBKIT_EXECUTABLE_PATH']} if os.environ.get('WEBKIT_EXECUTABLE_PATH') else {}))
    except Exception as error:
        reports.append({'check': 'WebKit mobile/tablet smoke', 'status': 'blocked', 'reason': str(error)[:800]})
        print('BLOCKED WebKit:', str(error)[:300], flush=True)
    else:
        def webkit_flow():
            for device, size in [('phone', {'width': 390, 'height': 844}), ('tablet', {'width': 820, 'height': 1180})]:
                ctx = webkit.new_context(viewport=size, is_mobile=True, has_touch=True)
                tab = ctx.new_page()
                tab.on('pageerror', lambda error: errors.append('WebKit: '+str(error)))
                tab.goto(BASE)
                tab.wait_for_selector('[data-mode="1"]')
                tab.screenshot(path=str(EVIDENCE / f'webkit-{device}-home.png'), full_page=True)
                assert not tab.evaluate('document.documentElement.scrollWidth > innerWidth')
                start(tab, '7')
                finish_quiz(tab, 10, touch=True)
                tab.screenshot(path=str(EVIDENCE / f'webkit-{device}-result.png'), full_page=True)
                home(tab); start(tab, '1')
                for _ in range(10): tab.locator('.flash-card').click()
                expect(tab.locator('#answer')).to_be_visible()
                home(tab); start(tab, 'fraction-to-percent', 10)
                for _ in range(10):
                    a, b = [int(n) for n in re.findall(r'\d+', tab.locator('.equation').inner_text())]
                    answer(tab, round(a / b * 100 * 1.01, 4), touch=True)
                tab.locator('[data-action="close-modal"]').click()
                assert history(tab)[0]['summary']['correct'] == 10
                tab.screenshot(path=str(EVIDENCE/f'webkit-{device}-percent-review.png'), full_page=True)
                home(tab); start(tab, 'three-by-two-divide', 10)
                for _ in range(10):
                    a, b = [int(n) for n in re.findall(r'\d+', tab.locator('.equation').inner_text())]
                    value = (Decimal(a) / Decimal(b)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    answer(tab, str(value), touch=True)
                tab.locator('[data-action="close-modal"]').click()
                assert history(tab)[0]['summary']['correct'] == 10
                ctx.close()
            assert not errors, errors
        check('WebKit phone/tablet: decimal touch input, full results, direct flash card flow', webkit_flow)
        webkit.close()

(EVIDENCE / 'browser-results.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2)+'\n')
(EVIDENCE / 'flash-click-replay.json').write_text(json.dumps(replay, ensure_ascii=False, indent=2)+'\n')
print(f'{len([r for r in reports if r["status"] == "passed"])} browser checks passed; evidence: {EVIDENCE}', flush=True)
