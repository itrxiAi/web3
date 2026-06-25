import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { TxFlowType, TxFlowStatus } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const { startDate, endDate, page = 1, pageSize = 20 } = await req.json();

    const where = {
      type: TxFlowType.EQUITY,
      txHash: { not: null as string | null },
      status: TxFlowStatus.CONFIRMED,
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [count, aggregate, items] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          txHash: true,
          fromAddress: true,
          toAddress: true,
          amount: true,
          tokenType: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      count,
      totalAmount: aggregate._sum.amount?.toString() ?? '0',
      items: items.map((t) => ({
        ...t,
        amount: t.amount.toString(),
        createdAt: t.createdAt.toISOString(),
      })),
      totalPages: Math.max(1, Math.ceil(count / pageSize)),
      page,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
