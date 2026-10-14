"""Browser checks against disposable local validation data; never runs against a remote site."""
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

base = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:3000')
if urlparse(base).hostname not in ('127.0.0.1', 'localhost'):
    raise SystemExit('Browser validation is restricted to a local test server.')
artifacts = Path('/tmp/topuria-validation/screenshots')
artifacts.mkdir(parents=True, exist_ok=True)
errors = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1440,'height':1000})
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda message: errors.append(message.text) if message.type=='error' and 'Hydration' in message.text else None)
    page.goto(base + '/admin/login')
    page.get_by_label('ელფოსტა').fill('owner@v7.test')
    page.get_by_label('პაროლი', exact=True).fill('isolated-test-password')
    page.get_by_role('button', name='შესვლა', exact=True).click()
    page.wait_for_url('**/admin/dashboard')
    page.get_by_role('heading', name='მთავარი პანელი').wait_for()
    assert page.locator('.overviewTable tbody tr').count() == 1
    page.screenshot(path=str(artifacts/'admin-desktop.png'),full_page=True)
    page.get_by_role('button',name='ნათელი რეჟიმი',exact=True).click()
    assert page.locator('.dash').get_attribute('data-admin-theme') == 'light'
    page.screenshot(path=str(artifacts/'admin-light.png'),full_page=True)
    page.get_by_role('button',name='მუქი რეჟიმი',exact=True).click()
    page.locator('.segmented').get_by_role('button',name='შეკვეთები',exact=True).click()
    page.locator('.chartHits button').last.click()
    assert 'შეკვეთა' in page.locator('.chartCaption').inner_text()
    page.goto(base+'/shop')
    page.locator('.productCard').first.wait_for()
    assert page.locator('.productCard').count() == 2
    page.get_by_label('სორტირება').select_option('high')
    assert 'მეორე მოდელი' in page.locator('.productCard').first.inner_text()
    page.get_by_label('სორტირება').select_option('low')
    assert 'სატესტო კაბა' in page.locator('.productCard').first.inner_text()
    page.locator('.productCard').first.get_by_role('button').click()
    page.goto(base+'/wishlist')
    assert page.locator('.productCard').count()==1
    page.goto(base+'/product/v7-test-dress')
    page.get_by_role('button',name='კალათაში დამატება',exact=True).click()
    page.goto(base+'/cart')
    page.get_by_role('heading',name='V7 სატესტო კაბა').wait_for()
    assert '190' in page.locator('.summary .total').inner_text()
    page.goto(base+'/search')
    page.get_by_placeholder('მოძებნე კაბა, კოსტიუმი, პალტო...').fill('მეორე')
    assert page.locator('.productCard').count()==1
    page.goto(base+'/')
    page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
    page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
    page.screenshot(path=str(artifacts/'store-desktop.png'),full_page=True)
    for width in [390,320]:
        page.set_viewport_size({'width':width,'height':844})
        for path in ['/','/shop','/product/v7-test-dress','/cart','/admin/dashboard','/admin/products','/admin/analytics']:
            page.goto(base+path)
            page.wait_for_timeout(300)
            overflow=page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
            assert not overflow, 'Horizontal overflow: '+str(width)+' '+path
        page.goto(base+'/admin/dashboard')
        page.get_by_role('button',name='მენიუს გახსნა',exact=True).click()
        page.wait_for_function("document.querySelector('.adminSidebar').getBoundingClientRect().left >= -1")
        page.locator('.adminSidebar nav').get_by_role('link',name='პროდუქტები',exact=True).click()
        page.wait_for_url('**/admin/products')
        page.locator('.v5ProductForm').wait_for()
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base+'/admin/dashboard');page.screenshot(path=str(artifacts/'admin-mobile.png'),full_page=True)
    page.goto(base+'/')
    page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
    page.wait_for_function('Array.from(document.images).every(i=>i.complete)')
    page.screenshot(path=str(artifacts/'store-mobile.png'),full_page=True)
    assert not errors, 'Browser errors: '+repr(errors)
    browser.close()
print('Browser checks passed: login, theme switch, chart, catalog sorting, wishlist, cart, search, mobile navigation and 320/390px layout.')
print('Screenshots use isolated validation fixtures, not live Neon records.')
