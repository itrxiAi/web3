import { NextRequest, NextResponse } from 'next/server';

/**
 * 代理：转发到 app/backend 的 POST /api/v1/community/:id/approve
 * 注意：APP_BACKEND_URL 已包含 /api/v1，不需要再拼接
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const base = process.env.APP_BACKEND_URL;
    if (!base) {
      return NextResponse.json({ error: 'APP_BACKEND_URL not configured' }, { status: 500 });
    }
    
    const key = process.env.INTERNAL_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'INTERNAL_API_KEY not configured' }, { status: 500 });
    }
    
    const body = await req.json();
    const url = `${base.replace(/\/$/, '')}/community/${params.id}/approve`;
    
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': key,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
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
