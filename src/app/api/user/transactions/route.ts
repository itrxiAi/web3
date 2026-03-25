import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ErrorCode } from '@/lib/errors';
import { TxFlowStatus } from '@prisma/client';

export async function POST(request: Request) {

  const body = await request.json();
  const { address, flowTypeArr, cursor, take } = body;

  if (!address.toLowerCase()) {
    return NextResponse.json({ error: ErrorCode.MISSING_WALLET_ADDRESS }, { status: 400 })
  }

  // Get where clause for both queries
  const whereClause = {
    from_address: address.toLowerCase(),
    status: {
      in: [TxFlowStatus.CONFIRMED, TxFlowStatus.PENDING, TxFlowStatus.AUDITING, TxFlowStatus.REFUSED]
    },
    ...(flowTypeArr && {
      type: {
        in: flowTypeArr
      }
    })
  };

  // Get total count for pagination
  const totalCount = await prisma.transaction.count({
    where: whereClause
  });

  // Get paginated data
  const txFlows = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: {
      updatedAt: 'desc'
    },
    take: take ? Number(take) : undefined,
    skip: cursor ? Number(cursor) : 0
  });

  return NextResponse.json({
    data: txFlows,
    nextCursor: txFlows.length === take ? txFlows[txFlows.length - 1].id : null,
    total: totalCount
  })
}