import { NextRequest, NextResponse } from 'next/server';

/**
 * 代理：转发到 app/backend 的 POST /internal/users/:address/withdraw
 * Body: { address: string, asset: 'HAK' | 'USDT', amount: string }
 *
 * 提现只能提到本人地址：服务端强制 toAddress = address，忽略客户端传入的目标地址。
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
    const { address, asset, amount } = body || {};
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }
    if (asset !== 'HAK' && asset !== 'USDT') {
      return NextResponse.json({ error: 'asset must be HAK or USDT' }, { status: 400 });
    }
    if (amount === undefined || amount === null || !/^\d+(\.\d+)?$/.test(String(amount))) {
      return NextResponse.json({ error: 'amount is required' }, { status: 400 });
    }

    const addr = address.toLowerCase();
    const url = `${base.replace(/\/$/, '')}/internal/users/${encodeURIComponent(addr)}/withdraw`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': key,
      },
      body: JSON.stringify({ asset, amount: String(amount), toAddress: addr }),
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
