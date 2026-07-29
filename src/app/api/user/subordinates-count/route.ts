import { NextRequest, NextResponse } from 'next/server';
import { ErrorCode } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, isDirect, nodeType } = await req.json();

    const lowerCaseAddress = walletAddress?.toLowerCase();

    if (!lowerCaseAddress) {
      return NextResponse.json(
        { error: ErrorCode.MISSING_WALLET_ADDRESS },
        { status: 400 }
      );
    }

    const appBackendUrl = process.env.APP_BACKEND_URL;
    if (!appBackendUrl) {
      return NextResponse.json(
        { error: ErrorCode.SERVER_ERROR },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${appBackendUrl}/internal/users/${lowerCaseAddress}/detail`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ count: 0 });
      }
      return NextResponse.json(
        { error: ErrorCode.SERVER_ERROR },
        { status: 500 }
      );
    }

    const data = await response.json();
    const user = data.user;
    const directInvitees = data.directInvitees ?? [];

    let count = 0;
    if (isDirect) {
      if (nodeType) {
        count = directInvitees.filter((d: any) => d.nodeType === nodeType).length;
      } else {
        count = directInvitees.length;
      }
    } else {
      if (nodeType === 'VERIFIER1') {
        count = user.allVipCount ?? 0;
      } else if (nodeType === 'VERIFIER2') {
        count = user.allSvipCount ?? 0;
      } else {
        count = user.teamSize ?? 0;
      }
    }

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error getting subordinates count:', error);
    return NextResponse.json(
      { error: ErrorCode.SERVER_ERROR },
      { status: 500 }
    );
  }
}
