import { NextRequest, NextResponse } from 'next/server';

/**
 * 代理：转发到 app/backend 的 GET /internal/activations
 */
export async function GET(req: NextRequest) {
  try {
    const base = process.env.APP_BACKEND_URL;
    if (!base) {
      return NextResponse.json({ error: 'APP_BACKEND_URL not configured' }, { status: 500 });
    }
    const { search } = new URL(req.url);
    const url = `${base.replace(/\/$/, '')}/internal/activations${search}`;
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
