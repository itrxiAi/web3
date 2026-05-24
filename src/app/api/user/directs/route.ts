import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ErrorCode } from '@/lib/errors';

/**
 * Get user's direct referrals (users whose superior is the current user)
 */
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

    // Get user's direct referrals
    const directs = await prisma.user.findMany({
      where: {
        superior: walletAddress,
        cards: { gt: 0 }, // Only include users with cards (early consensus)
      },
      select: {
        walletAddress: true,
        equityType: true,
        cards: true,
        equityActivedAt: true,
        createdAt: true,
      },
      orderBy: {
        equityActivedAt: 'asc', // Order by activation time
      },
    });

    // Calculate consensus amount based on cards purchased
    const directsWithConsensus = directs.map((direct, index) => {
      // 根据 cards 数量反推 verifier 类型，再获取对应的价格
      // VERIFIER_1: 1 card = 500 USDT
      // VERIFIER_2: 2 cards = 1000 USDT
      // VERIFIER_3: 10 cards = 5000 USDT
      // VERIFIER_4: 20 cards = 10000 USDT
      let consensusAmount = 0;
      const cards = direct.cards || 0;
      
      if (cards === 1) {
        consensusAmount = 500;  // VERIFIER_1
      } else if (cards === 2) {
        consensusAmount = 1000; // VERIFIER_2
      } else if (cards === 10) {
        consensusAmount = 5000; // VERIFIER_3
      } else if (cards === 20) {
        consensusAmount = 10000; // VERIFIER_4
      } else {
        // 如果不匹配标准套餐，按比例计算（假设平均每卡500 USDT）
        consensusAmount = cards * 500;
      }
      
      return {
        sequence: index + 1,
        address: direct.walletAddress,
        equityType: direct.equityType,
        cards: direct.cards,
        consensusAmount,
        activatedAt: direct.equityActivedAt,
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
