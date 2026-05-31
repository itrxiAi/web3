import { NextRequest, NextResponse } from 'next/server';

/**
 * 代理：转发到 app/backend 的 POST /internal/users/:address/credit
 * Body: { address: string, hakcard?: number, tribute?: string | number }
 *
 * 注入 x-internal-key（仅服务端持有 INTERNAL_API_KEY）。
 */
export async function POST(req: NextRequest) {
  try {
    const base = process.env.APP_BACKEND_URL;
    const key = process.env.INTERNAL_API_KEY;
    if (!base) {
      return NextResponse.json({ error: 'APP_BACKEND_URL not configured' }, { status: 500 });
    }
    if (!key) {
      return NextResponse.json({ error: 'INTERNAL_API_KEY not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { address, hakcard, tribute } = body || {};
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }

    const url = `${base.replace(/\/$/, '')}/internal/users/${encodeURIComponent(address)}/credit`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': key,
      },
      body: JSON.stringify({ hakcard, tribute }),
    });
    const json = await resp.json().catch(() => ({}));
    return NextResponse.json(json?.data ?? json, { status: resp.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
