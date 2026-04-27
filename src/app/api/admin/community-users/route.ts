import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateBearerToken } from '@/utils/auth';
import { UserType } from '@prisma/client';

export async function GET(req: NextRequest) {

  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 20);

    const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
    const safePageSize = Number.isNaN(pageSize) || pageSize < 1 ? 20 : Math.min(pageSize, 200);

    const where = { type: UserType.COMMUNITY };

    const [count, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        select: {
          id: true,
          walletAddress: true,
          type: true,
          referralCode: true,
          superior: true,
          purchaseAt: true,
          equityActivedAt: true,
          createdAt: true
        }
      })
    ]);

    return NextResponse.json({
      count,
      users,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.max(1, Math.ceil(count / safePageSize))
    });
  } catch (error) {
    console.error('Error querying community users:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
