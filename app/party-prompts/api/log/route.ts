import { NextResponse } from 'next/server';
import { appendServerLog } from '@/lib/logger_server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { level, namespace, msg, data } = body;

    if (!namespace || !msg) {
      return NextResponse.json({ error: 'Invalid log payload' }, { status: 400 });
    }

    appendServerLog({
      level: level || 'info',
      namespace: namespace || 'CLIENT',
      msg,
      data
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling log endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
