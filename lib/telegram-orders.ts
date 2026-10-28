import {db} from './db';

// Telegram delivery is best-effort and never changes the bank payment outcome.
// An atomic database lease prevents concurrent callbacks from sending twice.
export async function notifyPaidOrder(paymentId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;
  const now = new Date();
  const claimed = await db.payment.updateMany({
    where: {
      id: paymentId, status: 'PAID', telegramSentAt: null,
      OR: [{telegramClaimedAt: null}, {telegramClaimedAt: {lt: new Date(now.getTime() - 120_000)}}],
    },
    data: {telegramClaimedAt: now},
  });
  if (claimed.count !== 1) return;
  try {
    const payment = await db.payment.findUnique({
      where: {id: paymentId},
      include: {order: {include: {items: true}}},
    });
    if (!payment || payment.status !== 'PAID') return;
    const order = payment.order;
    const lines = order.items.map(i => {
      const variant = [i.size ? 'ზომა: ' + i.size : '', i.color ? 'ფერი: ' + i.color : ''].filter(Boolean).join(', ');
      return '• ' + i.name + (variant ? ' (' + variant + ')' : '') + ' × ' + i.quantity + ' — ' + (i.price * i.quantity).toFixed(2) + ' ₾';
    });
    const message = [
      '🛍️ TOPURIA PREMIUM — გადახდილი შეკვეთა' + (payment.environment !== 'production' ? ' 🧪 TEST' : ''),
      '📦 შეკვეთა: ' + order.orderNo,
      '👤 მომხმარებელი: ' + (order.customerName?.trim() || 'არ არის მითითებული'),
      '📞 ტელეფონი: ' + (order.phone?.trim() || 'არ არის მითითებული'),
      '📧 ელფოსტა: ' + (order.email?.trim() || 'არ არის მითითებული'),
      '📍 მისამართი: ' + (order.address?.trim() || 'არ არის მითითებული'),
      ...lines,
      '💰 ჯამი: ' + (payment.amountMinor / 100).toFixed(2) + ' ₾',
      '💳 გადახდა: დადასტურებულია ✅',
      '🚚 მიღება: ' + (order.address === 'ადგილზე გატანა' ? 'ადგილზე გატანა' : 'მიწოდება'),
    ].join('\n');
    const response = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({chat_id: chatId, text: message}),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    const result = await response.json() as {ok?: boolean};
    if (!response.ok || result.ok !== true) throw new Error('Telegram rejected notification');
    await db.payment.update({where: {id: paymentId}, data: {telegramSentAt: new Date()}});
  } catch {
    // Retry on the next verified payment reconciliation; never log secrets or customer data.
    await db.payment.updateMany({where: {id: paymentId, telegramSentAt: null, telegramClaimedAt: now}, data: {telegramClaimedAt: null}}).catch(() => {});
  }
}
