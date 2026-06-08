import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/upload-banner - 上传 Banner 图片
 * 代理到 app/backend 的 POST /upload
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

    // 获取 FormData
    const formData = await req.formData();
    
    // 转发到后端内部上传接口（注入 x-internal-key）
    const url = `${base.replace(/\/$/, '')}/upload/internal`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'x-internal-key': key,
      },
      body: formData,
    });
    
    const json = await resp.json().catch(() => ({}));
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
