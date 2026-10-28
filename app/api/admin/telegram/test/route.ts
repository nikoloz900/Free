import {NextResponse} from 'next/server';
import {getAdmin} from '../../../../../lib/auth';
import {rejectCrossOrigin} from '../../../../../lib/request';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const blocked = rejectCrossOrigin(req);
  if (blocked) return blocked;
  const admin = await getAdmin();
  if (!admin || admin.role !== 'SUPER_ADMIN') return NextResponse.json({error: 'Forbidden'}, {status: 403});
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return NextResponse.json({error: 'Telegram is not configured'}, {status: 503});
  try {
    const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        chat_id: chatId,
        text: '🛍️ TOPURIA PREMIUM\n🤖 Production Telegram Test\n✅ საიტი წარმატებით დაუკავშირდა ბოტს!\n🧪 ეს სატესტო შეტყობინებაა — შეკვეთა არ შექმნილა.',
      }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    const result = await response.json() as {ok?: boolean};
    if (!response.ok || !result.ok) return NextResponse.json({error: 'Telegram delivery failed'}, {status: 502});
    return NextResponse.json({ok: true});
  } catch {
    return NextResponse.json({error: 'Telegram connection failed'}, {status: 502});
  }
}
