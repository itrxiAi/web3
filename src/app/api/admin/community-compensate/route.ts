import { NextRequest, NextResponse } from 'next/server';
import { validateBearerToken } from '@/utils/auth';

export async function POST(req: NextRequest) {
  const validationResponse = validateBearerToken(req);
  if (validationResponse) {
    return validationResponse;
  }

  try {
    const { walletAddress, txHash, nodeType } = await req.json();

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    if (!nodeType || !['VERIFIER1', 'VERIFIER2'].includes(nodeType)) {
      return NextResponse.json(
        { error: 'nodeType must be VERIFIER1 or VERIFIER2' },
        { status: 400 }
      );
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const effectiveTxHash =
      typeof txHash === 'string' && txHash.trim().length > 0
        ? txHash.trim()
        : `manual-community-${normalizedAddress}-${Date.now()}`;

    const appBackendUrl = process.env.APP_BACKEND_URL;
    const internalApiKey = process.env.INTERNAL_API_KEY;

    if (!appBackendUrl || !internalApiKey) {
      return NextResponse.json(
        { error: 'BACKEND_NOT_CONFIGURED' },
        { status: 500 }
      );
    }

    const response = await fetch(`${appBackendUrl}/internal/users/node-type`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': internalApiKey,
      },
      body: JSON.stringify({ address: normalizedAddress, nodeType }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('node-type failed:', response.status, err);
      return NextResponse.json(
        { error: 'Failed to set nodeType' },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      status: 'success',
      message: 'Community compensation completed',
      txHash: effectiveTxHash,
      result
    });
  } catch (error) {
    console.error('Error compensating community transaction:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
