import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateBearerToken } from '@/utils/auth';
import { TxFlowStatus, TxFlowType, TokenType } from '@prisma/client';

export async function POST(req: NextRequest) {
  // Validate admin authentication

  try {
    // Get all auditing OUT transactions
    return await getAuditingWithdrawals();
  } catch (error) {
    console.error('Error in withdrawal API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

/**
 * 获取所有审核中的提现交易，按创建时间排序
 */
async function getAuditingWithdrawals() {
  try {
    // Build where clause for auditing OUT transactions
    const whereClause: any = {
      type: TxFlowType.WITHDRAW, // Only get withdrawal transactions
      status: TxFlowStatus.AUDITING, // Only get auditing transactions
    };

    // Get all auditing withdrawals ordered by created_at
    const withdrawals = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'asc', // Order by created_at ascending
      },
    });

    return NextResponse.json({
      data: withdrawals,
    });
  } catch (error) {
    console.error('Error fetching auditing withdrawals:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
