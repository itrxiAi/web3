import { NextRequest, NextResponse } from 'next/server';

/**
 * 检查用户是否存在（通过调用 app backend internal API）
 */
export async function GET(req: NextRequest) {
  console.log('[USER_EXISTS] API called');
  const searchParams = req.nextUrl.searchParams;
  const address = searchParams.get('address');
  console.log('[USER_EXISTS] Address:', address);

  if (!address) {
    console.log('[USER_EXISTS] No address provided');
    return NextResponse.json(
      { exists: false, error: 'Address is required' },
      { status: 400 }
    );
  }

  const appBackendUrl = process.env.APP_BACKEND_URL;
  const internalApiKey = process.env.INTERNAL_API_KEY;
  console.log('[USER_EXISTS] Config:', { appBackendUrl: appBackendUrl ? 'set' : 'missing', internalApiKey: internalApiKey ? 'set' : 'missing' });

  if (!appBackendUrl || !internalApiKey) {
    console.warn('APP_BACKEND_URL or INTERNAL_API_KEY not configured');
    // 如果未配置，默认返回存在，不阻止激活
    return NextResponse.json({ exists: true });
  }

  try {
    const apiUrl = `${appBackendUrl}/internal/users/exists?address=${encodeURIComponent(address)}`;
    console.log('[USER_EXISTS] Calling app backend:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-internal-key': internalApiKey,
      },
    });

    console.log('[USER_EXISTS] Response status:', response.status);

    if (!response.ok) {
      console.error('[USER_EXISTS] Failed to check user exists:', response.status);
      // 如果调用失败，默认返回存在，不阻止激活
      return NextResponse.json({ exists: true });
    }

    const responseData = await response.json();
    console.log('[USER_EXISTS] Response data:', responseData);
    
    // app backend 的响应格式是 { data: { exists, user } }
    const actualData = responseData.data || responseData;
    const result = {
      exists: actualData.exists,
      user: actualData.user,
    };
    console.log('[USER_EXISTS] Returning:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[USER_EXISTS] Error checking user exists:', error);
    // 如果出错，默认返回存在，不阻止激活
    return NextResponse.json({ exists: true });
  }
}
