import { NextRequest, NextResponse } from 'next/server';

/**
 * 代理：GET /internal/users/:address/team-revenue?date=YYYY-MM-DD
 * 客户端调用：/api/admin/team-revenue?address=0x...&date=2026-05-30
 */
export async function GET(req: NextRequest) {
  try {
    const base = process.env.APP_BACKEND_URL;
    if (!base) {
      return NextResponse.json({ error: 'APP_BACKEND_URL not configured' }, { status: 500 });
    }
    const { searchParams } = new URL(req.url);
    const address = (searchParams.get('address') || '').trim();
    const date = (searchParams.get('date') || '').trim();
    if (!address) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }
    const url = `${base.replace(/\/$/, '')}/internal/users/${encodeURIComponent(address)}/team-revenue?date=${encodeURIComponent(date)}`;
    const resp = await fetch(url, { cache: 'no-store' });
    const json = await resp.json().catch(() => ({}));
    return NextResponse.json(json?.data ?? json, { status: resp.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
