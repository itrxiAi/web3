import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getWithdrawInnerFee, getWithdrawTokenFeeRatio } from '@/lib/config';
import decimal from 'decimal.js';
import { ErrorCode } from '@/lib/errors';
//import { getUserLevel } from '@/lib/userCache';
import { getActivePercent } from '@/lib/user';
import { UserType } from '@prisma/client';
import { randomReferralCode } from '@/utils/auth';

/**
 * Get user points
 */
export async function GET(req: NextRequest) {
    // Get wallet address from query params
    const { searchParams } = new URL(req.url);
    const tmpAddress = searchParams.get('address');
    if (!tmpAddress) {
      return NextResponse.json(
        { error: ErrorCode.MISSING_WALLET_ADDRESS },
        { status: 400 }
      );
    }
    const walletAddress = tmpAddress.toLowerCase();
    const referralCode = randomReferralCode(walletAddress);

    return NextResponse.json({ referralCode });
}
