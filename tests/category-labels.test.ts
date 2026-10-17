import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translateCategoryName, translateProductName} from '../lib/category-labels';

test('Existing Georgian category names switch to English/Russian without changing stored names', () => {
  const name = 'კოსტიუმი';
  assert.equal(translateCategoryName(name, 'en'), 'Suits');
  assert.equal(translateCategoryName(name, 'ru'), 'Костюмы');
  assert.equal(translateCategoryName('კოსტუმი', 'en'), 'Suits');
  assert.equal(translateCategoryName('  ПЛАТЬЯ  ', 'ka'), 'კაბები');
  assert.equal(name, 'კოსტიუმი');
});
test('Explicit names win per language; an empty override returns to the default translation', () => {
  assert.equal(translateCategoryName('კაბები', 'en', {en: '  The evening edit  ', ru: 'Вечерняя коллекция'}), 'The evening edit');
  assert.equal(translateCategoryName('კაბები', 'en', {en: '', ru: 'Вечерняя коллекция'}), 'Dresses');
  assert.equal(translateCategoryName('Archive 01', 'ka', {ka: 'არქივი 01'}), 'არქივი 01');
  assert.equal(translateCategoryName('Archive 01', 'en', {ka: 'არქივი 01'}), 'Archive 01');
});
test('Custom collections are preserved, with no substring guessing or invented translation', () => {
  assert.equal(translateCategoryName('Topuria Dress Archive', 'ru'), 'Topuria Dress Archive');
  assert.equal(translateCategoryName('ქალის კაბები — Atelier 01', 'en'), 'ქალის კაბები — Atelier 01');
});
test('Generic product titles remain singular while categories use their collection names', () => {
  assert.equal(translateProductName('კაბა', 'en'), 'Dress');
  assert.equal(translateCategoryName('კაბა', 'en'), 'Dresses');
  assert.equal(translateProductName('პერანგი', 'ru'), 'Рубашка');
  assert.equal(translateProductName('კოსტუმი', 'en'), 'Suit');
  assert.equal(translateProductName('Topuria Atelier 01', 'ru'), 'Topuria Atelier 01');
});
