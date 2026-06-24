import { NextResponse } from 'next/server';

/**
 * 代理：转发到 app/backend 的 GET /internal/app-download，返回 App 安装包下载地址。
 * 走服务端调用，避免前端直连 app backend 的跨域问题。
 * 该后端接口为 GET 查询，免 x-internal-key。
 *
 * 注意：APP_BACKEND_URL 已包含 /api/v1，无需再拼接。
 */
const FALLBACK_URL =
  'https://pub-09029cfd573f4a42b7d6bba0442c3fd2.r2.dev/app/harmonylink-0.2.1.apk';

export async function GET() {
  try {
    const base = process.env.APP_BACKEND_URL;
    if (!base) {
      return NextResponse.json({ url: FALLBACK_URL, version: null });
    }
    const url = `${base.replace(/\/$/, '')}/internal/app-download`;
    const resp = await fetch(url, { cache: 'no-store' });
    const json = await resp.json().catch(() => ({}));
    // NestJS 全局响应拦截器包装为 { data: ... }，在代理里拆一层
    const data = json?.data ?? json;
    return NextResponse.json({
      url: data?.url || FALLBACK_URL,
      version: data?.version ?? null,
    });
  } catch {
    // 任何失败都回退到内置地址，保证下载入口始终可用
    return NextResponse.json({ url: FALLBACK_URL, version: null });
  }
}
