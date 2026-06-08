import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/banners - 获取 Banner 列表
 * 代理到 app/backend 的 GET /config/banners（公开接口）
 */
export async function GET() {
  try {
    const base = process.env.APP_BACKEND_URL;
    if (!base) {
      return NextResponse.json({ error: 'APP_BACKEND_URL not configured' }, { status: 500 });
    }

    const url = `${base.replace(/\/$/, '')}/config/banners`;
    const resp = await fetch(url);
    const json = await resp.json().catch(() => ({}));
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/banners - 更新 Banner 列表
 * 代理到 app/backend 的 PUT /config/banners
 * 注入 x-internal-key（仅服务端持有）
 */
export async function PUT(req: NextRequest) {
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
    const { banners } = body || {};
    if (!Array.isArray(banners)) {
      return NextResponse.json({ error: 'banners array is required' }, { status: 400 });
    }

    const url = `${base.replace(/\/$/, '')}/config/banners`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': key,
      },
      body: JSON.stringify({ banners }),
    });
    const json = await resp.json().catch(() => ({}));
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
