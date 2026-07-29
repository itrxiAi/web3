import { NextRequest, NextResponse } from 'next/server';
import { ErrorCode } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tmpAddress = searchParams.get('address');

    if (!tmpAddress) {
      return NextResponse.json(
        { error: ErrorCode.MISSING_WALLET_ADDRESS },
        { status: 400 }
      );
    }

    const walletAddress = tmpAddress.toLowerCase();

    const appBackendUrl = process.env.APP_BACKEND_URL;
    if (!appBackendUrl) {
      return NextResponse.json(
        { error: ErrorCode.SERVER_ERROR },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${appBackendUrl}/internal/users/${walletAddress}/detail`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ directs: [], total: 0 });
      }
      return NextResponse.json(
        { error: ErrorCode.SERVER_ERROR },
        { status: 500 }
      );
    }

    const data = await response.json();
    const directInvitees = data.directInvitees ?? [];

    const directsWithConsensus = directInvitees.map((direct: any, index: number) => {
      let consensusAmount = 0;
      const nodeType = direct.nodeType;
      if (nodeType === 'VERIFIER1') {
        consensusAmount = 500;
      } else if (nodeType === 'VERIFIER2') {
        consensusAmount = 1000;
      }

      return {
        sequence: index + 1,
        address: direct.address,
        equityType: direct.activation?.package ?? null,
        cards: direct.hakcard ?? 0,
        consensusAmount,
        activatedAt: direct.activation?.activatedAt ?? null,
      };
    });

    return NextResponse.json({
      directs: directsWithConsensus,
      total: directsWithConsensus.length,
    });
  } catch (error) {
    console.error('Error getting direct referrals:', error);
    if (error instanceof Error) {
      console.error(error.message, error.stack);
    }
    return NextResponse.json(
      { error: ErrorCode.SERVER_ERROR },
      { status: 500 }
    );
  }
}
