export type CategoryLocale = 'ka' | 'en' | 'ru';
export type CategoryTranslations = Partial<Record<CategoryLocale, string>>;

// Exact names/aliases only: a custom collection must never be renamed because
// its slug happens to contain a familiar word. Admin overrides take priority.
const terms: {ka: string; en: string; ru: string; aliases?: string[]}[] = [
  {ka:'კაბები',en:'Dresses',ru:'Платья',aliases:['კაბა','dress','платье']},
  {ka:'კოსტიუმები',en:'Suits',ru:'Костюмы',aliases:['კოსტიუმი','კოსტუმი','კოსტუმები','suit','костюм']},
  {ka:'შარვლები',en:'Trousers',ru:'Брюки',aliases:['შარვალი','pants','trousers','брюки']},
  {ka:'ჯინსები',en:'Jeans',ru:'Джинсы',aliases:['ჯინსი','denim']},
  {ka:'ქვედაბოლოები',en:'Skirts',ru:'Юбки',aliases:['ქვედაბოლო','ქვედა ბოლოები','skirt','юбка']},
  {ka:'შორტები',en:'Shorts',ru:'Шорты',aliases:['შორტი']},
  {ka:'პერანგები',en:'Shirts',ru:'Рубашки',aliases:['პერანგი','shirt','рубашка']},
  {ka:'ბლუზები',en:'Blouses',ru:'Блузки',aliases:['ბლუზა','ბლუზი','blouse','блузка']},
  {ka:'მაისურები',en:'T-shirts',ru:'Футболки',aliases:['მაისური','t-shirt','t shirts','t shirt','футболка']},
  {ka:'ტოპები',en:'Tops',ru:'Топы',aliases:['ტოპი','top','топ']},
  {ka:'ზედა',en:'Tops',ru:'Топы',aliases:['ზედები']},
  {ka:'ბოდეები',en:'Bodysuits',ru:'Боди',aliases:['ბოდე','ბოდი','bodysuit']},
  {ka:'ჟაკეტები',en:'Jackets',ru:'Жакеты',aliases:['ჟაკეტი','жакет']},
  {ka:'კარდიგანები',en:'Cardigans',ru:'Кардиганы',aliases:['კარდიგანი','cardigan','кардиган']},
  {ka:'პიჯაკები',en:'Blazers',ru:'Пиджаки',aliases:['პიჯაკი','blazer','пиджак']},
  {ka:'ქურთუკები',en:'Jackets',ru:'Куртки',aliases:['ქურთუკი','jacket','куртка']},
  {ka:'ტრენჩები',en:'Trenches',ru:'Тренчи',aliases:['ტრენჩი','trench','trenches','тренч','тренчи']},
  {ka:'ლაბადები',en:'Trench coats',ru:'Плащи',aliases:['ლაბადა','trench coat','trench coats','плащ','плащи']},
  {ka:'პალტოები',en:'Coats',ru:'Пальто',aliases:['პალტო','coat']},
  {ka:'მოსაცმელები',en:'Outerwear',ru:'Верхняя одежда',aliases:['მოსაცმელი','ზედა ტანსაცმელი']},
  {ka:'სვიტერები',en:'Sweaters',ru:'Свитеры',aliases:['სვიტერი','ჯემპრები','ჯემპრი','sweater','jumpers','свитер']},
  {ka:'ტრიკოტაჟი',en:'Knitwear',ru:'Трикотаж'},
  {ka:'ჰუდები',en:'Hoodies',ru:'Худи',aliases:['ჰუდი','hoodie']},
  {ka:'კომბინეზონები',en:'Jumpsuits',ru:'Комбинезоны',aliases:['კომბინეზონი','jumpsuit','комбинезон']},
  {ka:'კომპლექტები',en:'Sets',ru:'Комплекты',aliases:['კომპლექტი','set','co-ords','комплект']},
  {ka:'საცურაო კოსტიუმები',en:'Swimwear',ru:'Купальники',aliases:['საცურაო კოსტიუმი','საცურაო','swimsuits','купальник']},
  {ka:'თეთრეული',en:'Lingerie',ru:'Бельё',aliases:['საცვლები','underwear','белье']},
  {ka:'ფეხსაცმელი',en:'Shoes',ru:'Обувь',aliases:['ფეხსაცმელები','shoe']},
  {ka:'ჩანთები',en:'Bags',ru:'Сумки',aliases:['ჩანთა','bag','handbags','сумка']},
  {ka:'აქსესუარები',en:'Accessories',ru:'Аксессуары',aliases:['აქსესუარი','accessory','аксессуар']},
  {ka:'ქამრები',en:'Belts',ru:'Ремни',aliases:['ქამარი','belt','ремень']},
  {ka:'შარფები',en:'Scarves',ru:'Шарфы',aliases:['შარფი','scarf','шарф']},
  {ka:'სამკაულები',en:'Jewellery',ru:'Украшения',aliases:['სამკაული','jewelry','jewellery','украшение']},
  {ka:'სათვალეები',en:'Sunglasses',ru:'Солнцезащитные очки',aliases:['სათვალე','მზის სათვალეები','sunglasses']},
  {ka:'პლუს ზომები',en:'Plus size',ru:'Большие размеры',aliases:['პლუს ზომა','დიდი ზომები','plus-size','plus sizes','plus']},
  {ka:'საღამოს კაბები',en:'Evening dresses',ru:'Вечерние платья',aliases:['საღამოს კაბა']},
  {ka:'ყოველდღიური კაბები',en:'Everyday dresses',ru:'Повседневные платья',aliases:['ყოველდღიური კაბა']},
  {ka:'სპორტული ტანსაცმელი',en:'Activewear',ru:'Спортивная одежда',aliases:['სპორტულები','sportswear']},
  {ka:'ქალის ტანსაცმელი',en:'Womenswear',ru:'Женская одежда',aliases:["women's clothing",'womens clothing','ქალები','women','женщины']},
  {ka:'კაცის ტანსაცმელი',en:'Menswear',ru:'Мужская одежда',aliases:["men's clothing",'mens clothing','კაცები','men','მამაკაცის ტანსაცმელი']},
  {ka:'სიახლეები',en:'New arrivals',ru:'Новинки',aliases:['ახალი კოლექცია','new collection','new','новая коллекция']},
  {ka:'ფასდაკლება',en:'Sale',ru:'Распродажа',aliases:['ფასდაკლებები','sale','скидки']},
];
const normalize = (name: string) => name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const dictionary = new Map(terms.flatMap(term => [term.ka, term.en, term.ru, ...(term.aliases || [])].map(name => [normalize(name), term] as const)));

export function translateCategoryName(name: string, lang: CategoryLocale, overrides?: CategoryTranslations): string {
  const explicit = overrides?.[lang]?.trim();
  return explicit || dictionary.get(normalize(name))?.[lang] || name;
}

// Existing products sometimes use the generic singular garment name as their
// entire title. Translate those exact titles, preserving branded/custom titles.
const productTerms = [
  {ka:'კაბა',en:'Dress',ru:'Платье'}, {ka:'კოსტიუმი',en:'Suit',ru:'Костюм'},
  {ka:'პერანგი',en:'Shirt',ru:'Рубашка'}, {ka:'შარვალი',en:'Trousers',ru:'Брюки'},
  {ka:'ბლუზა',en:'Blouse',ru:'Блузка'}, {ka:'მაისური',en:'T-shirt',ru:'Футболка'},
  {ka:'ტოპი',en:'Top',ru:'Топ'}, {ka:'ქვედაბოლო',en:'Skirt',ru:'Юбка'},
  {ka:'პიჯაკი',en:'Blazer',ru:'Пиджак'}, {ka:'ქურთუკი',en:'Jacket',ru:'Куртка'},
  {ka:'ჟაკეტი',en:'Jacket',ru:'Жакет'}, {ka:'კარდიგანი',en:'Cardigan',ru:'Кардиган'},
  {ka:'პალტო',en:'Coat',ru:'Пальто'}, {ka:'კომბინეზონი',en:'Jumpsuit',ru:'Комбинезон'},
  {ka:'კომპლექტი',en:'Set',ru:'Комплект'}, {ka:'ჩანთა',en:'Bag',ru:'Сумка'},
];
const productDictionary = new Map(productTerms.flatMap(term => [term.ka, term.en, term.ru].map(name => [normalize(name), term] as const)));
export function translateProductName(name: string, lang: CategoryLocale): string {
  const normalized = normalize(name) === 'კოსტუმი' ? 'კოსტიუმი' : normalize(name);
  return productDictionary.get(normalized)?.[lang] || translateCategoryName(name, lang);
}
