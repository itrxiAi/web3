import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getWithdrawInnerFee, getWithdrawTokenFeeRatio } from '@/lib/config';
import decimal from 'decimal.js';
import { ErrorCode } from '@/lib/errors';
//import { getUserLevel, getUserTotalPerformance } from '@/lib/userCache';
import { getActivePercent } from '@/lib/user';
import { UserType } from '@prisma/client';

/**
 * Get user points
 */
export async function GET(req: NextRequest) {
  try {
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

    // Get user info and balance
    const userInfo = await prisma.user.findUnique({
      where: { walletAddress: walletAddress },
      select: {
        id: true,
        type: true,
        referralCode: true,
        superior: true,
        createdAt: true,
        purchaseAt: true,
        equityActivedAt: true
      }
    })
    // const userLevel = await getUserLevel(walletAddress)
    // const performance = await getUserTotalPerformance(walletAddress)
    let activePercent = 100;
    // if (userInfo?.type == UserType.GALAXY && !userInfo?.interest_active) {
    //   activePercent = await getActivePercent({
    //     walletAddress,
    //     userType: userInfo?.type || UserType.GROUP
    //   })
    // }

    // const userBalance = await prisma.user_balance.findUnique({
    //   where: { address: walletAddress },
    //   select: {
    //     usdt_points: true,
    //     token_points: true,
    //     token_locked_points: true,
    //     token_staked_points: true,
    //     stake_reward_cap: true,
    //     stake_dynamic_reward_cap: true
    //   }
    // })

    if (!userInfo) {
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
        is_special: false
      });
    }

    let superior_referral_code: string | null = null;

    if (userInfo.superior) {
      const superiorInfo = await prisma.user.findUnique({
        where: { walletAddress: userInfo.superior },
        select: {
          referralCode: true
        }
      })
      superior_referral_code = superiorInfo?.referralCode || null;
    }
    

    // Calculate withdrawable amounts
    //const usdt_withdrawable = Math.max(0, new decimal(userBalance?.usdt_points || 0).dividedBy(new decimal(1 + await getWithdrawTokenFeeRatio())).toNumber());
    //const token_withdrawable = Math.max(0, new decimal(userBalance?.token_points || 0).dividedBy(new decimal(1 + await getWithdrawTokenFeeRatio())).toNumber());

    return NextResponse.json({
      ...userInfo,
      // Set interest_active to true if usertype is not GALAXY
      //interest_active: userInfo?.type !== UserType.GALAXY ? true : userInfo?.interest_active,
      //level: userLevel,
      performance: performance,
      active_percent: activePercent,
      superior_referral_code,
      // ...userBalance || {
      //   usdt_points: new decimal(0),
      //   token_points: new decimal(0),
      //   token_locked_points: new decimal(0),
      //   token_staked_points: new decimal(0),
      //   stake_reward_cap: new decimal(0),
      //   stake_dynamic_reward_cap: new decimal(0)
      // },
      // usdt_withdrawable: new decimal(usdt_withdrawable),
      // token_withdrawable: new decimal(token_withdrawable),
      is_special: false
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
