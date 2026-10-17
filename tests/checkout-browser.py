"""Local checkout browser checks. Provider replies are explicitly mocked; no bank calls or charges."""
import json
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:3000')
if urlparse(base).hostname not in ('127.0.0.1', 'localhost'):
    raise SystemExit('Checkout browser checks only support a disposable local test server.')

artifacts = Path('/tmp/topuria-validation/screenshots')
artifacts.mkdir(parents=True, exist_ok=True)
errors = []
one_item = [{'slug': 'v7-test-dress', 'size': 'S', 'qty': 1}]
config = {
    'enabled': True, 'mode': 'sandbox',
    'delivery': {'mode': 'pickup', 'label': 'სატესტო გატანის ადგილი'},
    'methods': [{'id': method, 'label': method, 'enabled': True} for method in ['card', 'apple_pay', 'bnpl', 'bog_loan']],
}


def install_cart(page, items):
    page.goto(base + '/cart')
    page.locator('.empty').wait_for()
    page.evaluate("items => {localStorage.setItem('tp-cart', JSON.stringify(items)); sessionStorage.clear()}", items)
    page.goto(base + '/checkout')
    page.locator('.checkoutSummary').wait_for()


def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Checkout overflows viewport'


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    install_cart(page, one_item)
    expect(page.get_by_role('heading', name='შეკვეთის გაფორმება', exact=True)).to_be_visible()
    expect(page.locator('.checkoutActivation')).to_be_visible()
    expect(page.get_by_role('button', name='გადახდაზე გადასვლა', exact=True)).to_be_disabled()
    assert page.locator('.checkoutMethods input:disabled').count() == 4
    assert page.locator('input[name*="card"], input[name*="cvv"], input[name*="expiry"]').count() == 0
    for label in ['Visa / Mastercard', 'Apple Pay', 'ნაწილ-ნაწილ', 'განვადება']:
        expect(page.locator('.checkoutMethods').get_by_text(label, exact=True)).to_be_visible()
    no_overflow(page)
    page.screenshot(path=str(artifacts / 'checkout-desktop.png'), full_page=True)
    for width in [390, 320]:
        page.set_viewport_size({'width': width, 'height': 844})
        no_overflow(page)
        expect(page.get_by_role('button', name='გადახდაზე გადასვლა', exact=True)).to_be_disabled()
        if width == 390:
            page.screenshot(path=str(artifacts / 'checkout-mobile.png'), full_page=True)
    context.close()

    # UI behavior only: sandbox provider/config and all responses below are mocked.
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    context.route('**/api/checkout/config', lambda route: route.fulfill(status=200, json=config))
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    install_cart(page, one_item)
    expect(page.get_by_role('button', name='გადახდაზე გადასვლა', exact=True)).to_be_enabled()
    assert page.locator('.checkoutMethods input:disabled').count() == 0
    submitted = []
    status = {'value': 'PENDING'}
    receipt = {
        'id': 'ui-test-payment', 'token': 'local-ui-test-token', 'orderNo': 'UI-TEST-ONLY',
        'status': 'PENDING', 'amountMinor': 19000, 'currency': 'GEL',
        'expiresAt': '2099-01-01T00:00:00.000Z', 'mode': 'sandbox',
        'items': [{'slug': 'v7-test-dress', 'name': 'V7 სატესტო კაბა', 'priceMinor': 19000, 'qty': 1, 'size': 'S'}],
    }

    def submit_mock(route):
        if route.request.method != 'POST':
            route.continue_()
            return
        submitted.append(route.request.post_data_json)
        if len(submitted) == 1:
            route.fulfill(status=409, json={'error': 'სატესტო ხელმისაწვდომობა შეიცვალა. გადაამოწმეთ შეკვეთა.', 'safeToRestart': True})
        elif len(submitted) == 2:
            route.abort('failed')
        else:
            route.fulfill(status=200, json=receipt)

    context.route('**/api/checkout', submit_mock)
    context.route('**/api/checkout/ui-test-payment?**', lambda route: route.fulfill(status=200, json={**receipt, 'status': status['value']}))

    # Browser constraint validation must stop an empty form before a request.
    page.get_by_role('button', name='გადახდაზე გადასვლა', exact=True).click()
    assert not submitted
    assert not page.locator('input[name="name"]').evaluate('(element) => element.validity.valid')
    page.locator('input[name="name"]').fill('სატესტო მყიდველი')
    page.locator('input[name="phone"]').fill('+995555123456')
    page.locator('input[name="email"]').fill('checkout@local.test')
    page.locator('label.checkoutMethod').filter(has_text='ნაწილ-ნაწილ').click()
    expect(page.locator('.checkoutHint').filter(has_text='პირობებსა და ხელმისაწვდომობას')).to_be_visible()
    page.locator('label.checkoutMethod').filter(has_text='საბანკო ბარათი').click()
    page.get_by_role('button', name='გადახდაზე გადასვლა', exact=True).click()
    expect(page.locator('.checkoutAlert')).to_contain_text('სატესტო ხელმისაწვდომობა')
    expect(page.locator('input[name="name"]')).to_be_enabled()
    assert page.locator('.checkoutResume').count() == 0, 'A server-proven rejection should unlock editing'
    page.get_by_role('button', name='გადახდაზე გადასვლა', exact=True).click()
    expect(page.locator('.checkoutResume')).to_be_visible()
    expect(page.locator('input[name="name"]')).to_be_disabled()
    expect(page.locator('.checkoutMethods input[value="card"]')).to_be_disabled()
    assert len(submitted) == 2
    assert submitted[0]['expectedTotalMinor'] == 19000
    assert submitted[0]['items'] == one_item
    assert submitted[0]['customer'] == {'name': 'სატესტო მყიდველი', 'phone': '+995555123456', 'email': 'checkout@local.test'}
    assert submitted[0]['delivery'] == 'pickup' and submitted[0]['method'] == 'card'
    uuid.UUID(submitted[0]['idempotencyKey'], version=4)
    expect(page.get_by_role('button', name='იგივე მცდელობის გაგრძელება', exact=False)).to_be_enabled()
    page.get_by_role('button', name='იგივე მცდელობის გაგრძელება', exact=False).click()
    page.wait_for_url('**/checkout/return?**')
    expect(page.get_by_role('heading', name='გადახდა მოწმდება', exact=True)).to_be_visible()
    assert len(submitted) == 3 and submitted[1] == submitted[2], 'Retry changed payload/key'
    assert submitted[0]['idempotencyKey'] != submitted[1]['idempotencyKey'], 'A proven rejection may restart safely'

    # A success query is never evidence of payment; the mocked backend still says PENDING.
    page.goto(base + '/checkout/return?reference=ui-test-payment&token=local-ui-test-token&success=true')
    expect(page.get_by_role('heading', name='გადახდა მოწმდება', exact=True)).to_be_visible()
    assert page.get_by_role('heading', name='გადახდა დადასტურებულია', exact=True).count() == 0
    assert page.evaluate("JSON.parse(localStorage.getItem('tp-cart'))") == one_item
    assert 'token=' not in page.url

    # A reservation may make the buyer's last item unavailable in the public catalog.
    # Keep their saved attempt reachable while still blocking a new checkout.
    catalog = page.request.get(base + '/api/catalog').json()
    for product in catalog['products']:
        if product['slug'] == 'v7-test-dress':
            product['stock'] = 0
    context.route('**/api/catalog', lambda route: route.fulfill(status=200, json=catalog))
    page.goto(base + '/cart')
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    expect(page.locator('.cartStockNotice').first).to_be_visible()
    resume = page.get_by_role('link', name='დაწყებული გადახდის გაგრძელება', exact=False)
    expect(resume).to_be_visible()
    assert resume.get_attribute('href') == '/checkout/return?reference=ui-test-payment&token=local-ui-test-token'
    assert page.get_by_role('link', name='შეკვეთის გაფორმება', exact=True).count() == 0
    assert len(submitted) == 3
    resume.click()
    expect(page.get_by_role('heading', name='გადახდა მოწმდება', exact=True)).to_be_visible()
    assert len(submitted) == 3, 'Resuming a saved payment must not create another checkout'
    context.unroute('**/api/catalog')

    # Preserve later cart additions: subtract only the quantities from the paid receipt.
    remaining_before = [{'slug': 'v7-test-dress', 'size': 'S', 'qty': 2}, {'slug': 'v7-test-second', 'size': 'M', 'qty': 1}]
    page.evaluate("items => localStorage.setItem('tp-cart', JSON.stringify(items))", remaining_before)
    status['value'] = 'PAID'
    page.reload()
    expect(page.get_by_role('heading', name='გადახდა დადასტურებულია', exact=True)).to_be_visible()
    expected_cart = [{'slug': 'v7-test-dress', 'size': 'S', 'qty': 1}, {'slug': 'v7-test-second', 'size': 'M', 'qty': 1}]
    page.wait_for_function("expected => JSON.stringify(JSON.parse(localStorage.getItem('tp-cart'))) === JSON.stringify(expected)", arg=expected_cart)
    page.reload()
    expect(page.get_by_role('heading', name='გადახდა დადასტურებულია', exact=True)).to_be_visible()
    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    assert page.evaluate("JSON.parse(localStorage.getItem('tp-cart'))") == expected_cart, 'Repeated receipt cleared cart twice'
    no_overflow(page)
    context.close()

    context = browser.new_context(viewport={'width': 320, 'height': 844})
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + '/cart')
    page.locator('.empty').wait_for()
    page.evaluate("items => localStorage.setItem('tp-cart', JSON.stringify(items))", one_item)
    context.route('**/api/checkout/ui-test-failed?**', lambda route: route.fulfill(status=200, json={**receipt, 'id': 'ui-test-failed', 'status': 'FAILED'}))
    page.goto(base + '/checkout/return?reference=ui-test-failed&token=local-ui-failed-token')
    expect(page.get_by_role('heading', name='გადახდა ვერ შესრულდა', exact=True)).to_be_visible()
    expect(page.get_by_role('link', name='კალათაში დაბრუნება', exact=False)).to_be_visible()
    assert page.evaluate("JSON.parse(localStorage.getItem('tp-cart'))") == one_item
    no_overflow(page)
    context.close()
    browser.close()

assert not errors, errors
print('Checkout browser checks passed: disabled configuration, responsive layout, request validation, stable retry, authoritative status and purchased-row cart clearing. All payment replies mocked; no bank calls.')
