import { NextRequest, NextResponse } from 'next/server';
import decimal from 'decimal.js';
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
        return NextResponse.json({
          id: null,
          referral_code: null,
          superior_referral_code: null,
          type: null,
          level: 0,
          performance: new decimal(0),
          usdt_points: new decimal(0),
          token_points: new decimal(0),
          usdt_withdrawable: new decimal(0),
          token_withdrawable: new decimal(0),
          token_locked_points: new decimal(0),
          token_staked_points: new decimal(0),
          stake_reward_cap: new decimal(0),
          stake_dynamic_reward_cap: new decimal(0),
          active_percent: 0,
          is_special: false,
          equityType: null,
          cards: 0,
          points: 0,
        });
      }
      return NextResponse.json(
        { error: ErrorCode.SERVER_ERROR },
        { status: 500 }
      );
    }

    const data = await response.json();
    const user = data.data?.user ?? data.user;
    const directInvitees = data.data?.directInvitees ?? data.directInvitees ?? [];

    const superior_referral_code = user.ancestors?.length
      ? user.ancestors[user.ancestors.length - 1]?.shortCode ?? null
      : null;

    const directVipCount = directInvitees.filter((d: any) => d.nodeType === 'VERIFIER1').length;
    const directSvipCount = directInvitees.filter((d: any) => d.nodeType === 'VERIFIER2').length;

    return NextResponse.json({
      id: user.id,
      referral_code: user.shortCode,
      superior_referral_code,
      type: user.nodeType,
      level: 0,
      performance: new decimal(user.performance ?? 0),
      active_percent: 100,
      is_special: false,
      equityType: user.activation?.package ?? null,
      cards: user.hakcard ?? 0,
      points: user.tribute ?? 0,
      createdAt: user.createdAt,
      purchaseAt: user.activation?.activatedAt ?? null,
      equityActivedAt: user.activation?.activatedAt ?? null,
      directVipCount,
      directSvipCount,
      allVipCount: user.allVipCount ?? 0,
      allSvipCount: user.allSvipCount ?? 0,
    });
  } catch (error) {
    console.error('Error getting points:', error);
    if (error instanceof Error) {
      console.error(error.message, error.stack);
    }
    return NextResponse.json(
      { error: ErrorCode.SERVER_ERROR },
      { status: 500 }
    );
  }
}
