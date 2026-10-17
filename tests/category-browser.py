"""Category translations and burgundy styling against disposable local fixtures only.

Run with the isolated tests/browser-fixtures.ts data and a production test server.
Never accepts a remote base URL or changes any non-fixture product/category.
"""
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright


base = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:3000').rstrip('/')
parsed = urlparse(base)
if parsed.hostname not in ('127.0.0.1', 'localhost') or parsed.scheme != 'http' or parsed.path:
    raise SystemExit('Category browser validation only accepts a local HTTP test server.')

artifacts = Path('/tmp/topuria-validation/screenshots')
artifacts.mkdir(parents=True, exist_ok=True)
errors = []
category_slug = 'v7-test-dresses'
product_slug = 'v7-test-dress'
labels = {
    'ka': {'category': 'კაბები', 'filters': 'ფილტრი', 'menu': 'მენიუ', 'language': 'ენა', 'recent': 'ახლახან დამატებული'},
    'en': {'category': 'Dresses', 'filters': 'Filters', 'menu': 'Menu', 'language': 'Language', 'recent': 'Recently added'},
    'ru': {'category': 'Платья', 'filters': 'Фильтры', 'menu': 'Меню', 'language': 'Язык', 'recent': 'Недавно добавленные'},
}


def api(page, path, method='GET', data=None):
    result = page.evaluate("""async ({path, method, data}) => {
      const response = await fetch(path, {method, cache: 'no-store',
        ...(data === null ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)})});
      return {status: response.status, body: await response.json()};
    }""", {'path': path, 'method': method, 'data': data})
    assert 200 <= result['status'] < 300, f'{method} {path}: {result}'
    return result['body']


def set_language(page, locale):
    """Exercise the real selector, including the mobile drawer selector."""
    if page.viewport_size['width'] <= 680:
        current = page.locator('html').get_attribute('lang')
        page.locator('.header').get_by_role('button', name=labels[current]['menu'], exact=True).click()
        page.locator('#store-menu').get_by_role('combobox', name=labels[current]['language'], exact=True).select_option(locale)
        page.keyboard.press('Escape')
        expect(page.locator('#store-menu')).to_have_count(0)
    else:
        page.locator('.header .tpPref select').select_option(locale)
    expect(page.locator('html')).to_have_attribute('lang', locale)


def no_overflow(page, description):
    assert not page.evaluate('document.documentElement.scrollWidth > window.innerWidth'), description


def check_category_views(page, locale, category_name):
    """The same label must appear in navigation, category heading/filter and breadcrumb."""
    page.goto(base + '/shop?category=' + category_slug)
    expect(page.locator('html')).to_have_attribute('lang', locale)
    expect(page.locator('.directCatalogHeading h1')).to_have_text(category_name)
    expect(page.locator('.productCard')).to_have_count(2)
    if page.viewport_size['width'] > 950:
        nav = page.locator('.header nav').get_by_role('link', name=category_name, exact=True)
        expect(nav).to_have_attribute('aria-current', 'page')
        expect(nav).to_have_attribute('href', '/shop?category=' + category_slug)
    else:
        page.locator('.header').get_by_role('button', name=labels[locale]['menu'], exact=True).click()
        nav = page.locator('#store-menu').get_by_role('link', name=category_name, exact=True)
        expect(nav).to_have_attribute('aria-current', 'page')
        expect(nav).to_have_attribute('href', '/shop?category=' + category_slug)
        no_overflow(page, f'Collection drawer overflow: {locale} {page.viewport_size["width"]}')
        page.keyboard.press('Escape')
    page.locator('.catalogBar').get_by_role('button', name=labels[locale]['filters'], exact=True).click()
    radio = page.locator('.catalogFilterPanel').get_by_role('radio', name=category_name, exact=True)
    expect(radio).to_be_checked()
    assert radio.evaluate('(element) => getComputedStyle(element).accentColor') in ('rgb(112, 38, 56)', 'rgb(225, 164, 179)')
    no_overflow(page, f'Category filter overflow: {locale} {page.viewport_size["width"]}')
    page.keyboard.press('Escape')
    expect(page.locator('.catalogFilterPanel')).to_have_count(0)
    page.goto(base + '/product/' + product_slug)
    expect(page.locator('.productBreadcrumb span')).to_have_text('/ ' + category_name)
    expect(page.locator('.details .eyebrow')).to_have_text(category_name)
    no_overflow(page, f'Product detail overflow: {locale} {page.viewport_size["width"]}')


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' and 'hydration' in message.text.lower() else None)

    page.goto(base + '/')
    catalog = api(page, '/api/catalog')
    assert {product['slug'] for product in catalog['products']} == {'v7-test-dress', 'v7-test-second'}, 'Expected only the two isolated browser fixtures.'
    assert len(catalog['categories']) == 1 and catalog['categories'][0]['slug'] == category_slug
    assert all(product['name'].startswith('V7 სატესტო') for product in catalog['products']), 'Expected untouched isolated fixture product names.'

    page.goto(base + '/admin/login')
    page.get_by_label('ელფოსტა').fill('owner@v7.test')
    page.get_by_label('პაროლი', exact=True).fill('isolated-test-password')
    page.get_by_role('button', name='შესვლა', exact=True).click()
    page.wait_for_url('**/admin/dashboard')
    original_product = next(product for product in api(page, '/api/admin/products') if product['slug'] == product_slug)
    categories = api(page, '/api/admin/categories?translations=1')
    assert categories['translationsReady'], 'The local test translation table must be prepared first.'
    original_category = next(category for category in categories['categories'] if category['slug'] == category_slug)
    assert original_category['name'] == 'კაბები'
    category_id = original_category['id']
    product_id = original_product['id']

    try:
        page.goto(base + '/')
        set_language(page, 'en')
        expect(page.locator('.header nav').get_by_role('link', name='Dresses', exact=True)).to_be_visible()
        expect(page.locator('.catalogBar select option:checked')).to_have_text('Recently added')
        check_category_views(page, 'en', 'Dresses')
        set_language(page, 'ru')
        expect(page.locator('.header nav').get_by_role('link', name='Платья', exact=True)).to_be_visible()
        check_category_views(page, 'ru', 'Платья')
        set_language(page, 'ka')
        check_category_views(page, 'ka', 'კაბები')

        # Write custom translations through the real admin editor and verify persistence.
        page.goto(base + '/admin/categories')
        page.locator('.categoryManagementRow').filter(has_text='კაბები').get_by_role('button', name='რედაქტირება', exact=True).click()
        editor = page.locator('#category-editor')
        expect(editor.get_by_label('English', exact=True)).to_be_enabled()
        editor.get_by_label('English', exact=True).fill('Studio dresses')
        editor.get_by_label('Русский', exact=True).fill('Платья студии')
        editor.get_by_role('button', name='ცვლილებების შენახვა', exact=True).click()
        page.get_by_role('status').filter(has_text='კატეგორია განახლდა').wait_for()
        persisted = next(category for category in api(page, '/api/admin/categories?translations=1')['categories'] if category['id'] == category_id)
        assert persisted['name'] == 'კაბები' and persisted['slug'] == category_slug
        assert persisted['translations']['en'] == 'Studio dresses' and persisted['translations']['ru'] == 'Платья студии'
        page.goto(base + '/')
        set_language(page, 'en')
        check_category_views(page, 'en', 'Studio dresses')
        set_language(page, 'ru')
        check_category_views(page, 'ru', 'Платья студии')

        # Clearing one locale falls back without deleting a different locale or links.
        api(page, '/api/admin/categories', 'PATCH', {'id': category_id, 'translations': {'en': ''}})
        persisted = next(category for category in api(page, '/api/admin/categories?translations=1')['categories'] if category['id'] == category_id)
        assert 'en' not in persisted['translations'] and persisted['translations']['ru'] == 'Платья студии'
        page.goto(base + '/')
        set_language(page, 'en')
        check_category_views(page, 'en', 'Dresses')
        set_language(page, 'ru')
        check_category_views(page, 'ru', 'Платья студии')
        api(page, '/api/admin/categories', 'PATCH', {'id': category_id, 'translations': {'ru': ''}})

        # Generic product labels shown in the user's screenshot localize as singulars.
        api(page, '/api/admin/products', 'PATCH', {'id': product_id, 'name': 'კაბა'})
        page.goto(base + '/')
        set_language(page, 'en')
        expect(page.locator('.productMeta strong').filter(has_text='Dress')).to_have_count(1)
        page.goto(base + '/product/' + product_slug)
        expect(page.locator('.details h1')).to_have_text('Dress')
        set_language(page, 'ru')
        expect(page.locator('.details h1')).to_have_text('Платье')
        set_language(page, 'ka')
        expect(page.locator('.details h1')).to_have_text('კაბა')

        # Verify real computed burgundy styles, native control accent and keyboard focus.
        page.goto(base + '/shop?category=' + category_slug)
        set_language(page, 'en')
        for theme, accent, button in [('burgundy', 'rgb(112, 38, 56)', 'rgb(112, 38, 56)'), ('light', 'rgb(112, 38, 56)', 'rgb(112, 38, 56)'), ('dark', 'rgb(225, 164, 179)', 'rgb(163, 71, 96)')]:
            page.locator('.v7Footer select').select_option(theme)
            expect(page.locator('html')).to_have_attribute('data-theme', theme)
            active = page.locator('.header nav a[aria-current=page]')
            expect(active).to_have_count(1)
            assert active.evaluate('(element) => getComputedStyle(element).color') == accent
            assert page.locator('.productMeta > b').first.evaluate('(element) => getComputedStyle(element).color') == accent
            sort = page.locator('.catalogBar select')
            sort.focus()
            assert sort.evaluate('(element) => getComputedStyle(element).outlineColor') == accent
            assert sort.evaluate('(element) => getComputedStyle(element).outlineStyle') == 'solid'
            page.locator('.catalogBar').get_by_role('button', name='Filters', exact=True).click()
            panel = page.locator('.catalogFilterPanel')
            expect(panel.get_by_role('radio', name='Dresses', exact=True)).to_be_checked()
            assert panel.get_by_role('radio', name='Dresses', exact=True).evaluate('(element) => getComputedStyle(element).accentColor') == accent
            medium = panel.locator('.sizes').get_by_role('button', name='M', exact=True)
            if medium.get_attribute('aria-pressed') != 'true':
                medium.click()
            selected = panel.locator('.sizes button[aria-pressed=true]')
            assert selected.evaluate('(element) => getComputedStyle(element).backgroundColor') == button
            assert panel.locator('.filterApply').evaluate('(element) => getComputedStyle(element).backgroundColor') == button
            page.keyboard.press('Escape')
            page.locator('.catalogBar').get_by_role('button', name='Filters', exact=True).focus()
            if theme in ('burgundy', 'dark'):
                page.screenshot(path=str(artifacts / ('burgundy-storefront-en.png' if theme == 'burgundy' else 'burgundy-storefront-dark.png')), full_page=True)

        page.locator('.v7Footer select').select_option('burgundy')
        for width in (1440, 390, 320):
            page.set_viewport_size({'width': width, 'height': 1000 if width == 1440 else 844})
            for locale in ('ka', 'en', 'ru'):
                page.goto(base + '/')
                set_language(page, locale)
                no_overflow(page, f'Home overflow: {locale} {width}')
                expect(page.locator('.catalogBar select option:checked')).to_have_text(labels[locale]['recent'])
                check_category_views(page, locale, labels[locale]['category'])
            if width == 390:
                page.goto(base + '/')
                set_language(page, 'en')
                page.screenshot(path=str(artifacts / 'burgundy-storefront-mobile.png'), full_page=True)
        assert not errors, 'Browser runtime/hydration errors: ' + repr(errors)
    finally:
        # Return the shared disposable fixtures to their initial state for other checks.
        api(page, '/api/admin/products', 'PATCH', {'id': product_id, 'name': original_product['name']})
        api(page, '/api/admin/categories', 'PATCH', {'id': category_id, 'translations': {locale: original_category['translations'].get(locale, '') for locale in ('ka', 'en', 'ru')}})
        browser.close()

print('Category browser checks passed: live KA/EN/RU switching, category editor translations, partial-clear fallback, stable links, singular product names, burgundy/light/dark accents, focus, and 1440/390/320px layouts.')
print('Screenshots contain isolated local fixtures and brand logos, not live product photographs.')
