import { NextRequest, NextResponse } from 'next/server';

/**
 * 代理：转发到 app/backend 的 GET /internal/users/:address/ledger/summary
 * Query: address, range (today|week|month|all)
 *
 * 该 internal 查询接口开放访问，无需注入 x-internal-key。
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    if (!address) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }
    const range = searchParams.get('range') ?? 'today';

    const base = process.env.APP_BACKEND_URL;
    if (!base) {
      return NextResponse.json({ error: 'APP_BACKEND_URL not configured' }, { status: 500 });
    }

    const url = `${base.replace(/\/$/, '')}/internal/users/${encodeURIComponent(
      address.toLowerCase(),
    )}/ledger/summary?range=${encodeURIComponent(range)}`;
    const resp = await fetch(url);
    const json = await resp.json().catch(() => ({}));
    return NextResponse.json(json?.data ?? json, { status: resp.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
