/** Size-level stock is stored on the Product row so product locks protect both totals and variants. */
export function parseSizeStock(raw: string | null | undefined): Record<string, number> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const out: Record<string, number> = {};
    for (const [size, qty] of Object.entries(value)) {
      if (!size.trim() || size.length > 80 || !Number.isSafeInteger(qty) || Number(qty) < 0) return null;
      out[size] = Number(qty);
    }
    return out;
  } catch { return null; }
}
export function sizeStockTotal(stock: Record<string, number>) {
  return Object.values(stock).reduce((sum, n) => sum + n, 0);
}
export function validateSizeStock(value: unknown, sizes: string[]): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('თითოეული ზომის მარაგი მიუთითეთ.');
  const input = value as Record<string, unknown>;
  const unique = [...new Set(sizes)];
  if (unique.length !== sizes.length || unique.length > 60) throw new Error('ზომები არ უნდა მეორდებოდეს.');
  if (Object.keys(input).length !== unique.length || Object.keys(input).some(k => !unique.includes(k))) throw new Error('შეავსეთ ყველა ზომის მარაგი.');
  const result: Record<string, number> = {};
  for (const size of unique) {
    const n = input[size];
    if (!Number.isSafeInteger(n) || Number(n) < 0 || Number(n) > 2147483647) throw new Error('ზომის მარაგი უნდა იყოს მთელი არაუარყოფითი რიცხვი.');
    result[size] = Number(n);
  }
  if (sizeStockTotal(result) > 2147483647) throw new Error('საერთო მარაგი ზედმეტად დიდია.');
  return result;
}
