import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateBearerToken } from '@/utils/auth';
import { updateUserType } from '@/lib/user';
import { UserType } from '@prisma/client';

export async function POST(req: NextRequest) {
  const validationResponse = validateBearerToken(req);
  if (validationResponse) {
    return validationResponse;
  }

  try {
    const { walletAddress, txHash } = await req.json();

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const effectiveTxHash =
      typeof txHash === 'string' && txHash.trim().length > 0
        ? txHash.trim()
        : `manual-community-${normalizedAddress}-${Date.now()}`;

    const user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
      select: { id: true, walletAddress: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const result = await updateUserType({
      walletAddress: normalizedAddress,
      type: UserType.COMMUNITY,
      txHash: effectiveTxHash,
      tx: prisma
    });

    return NextResponse.json({
      status: 'success',
      message: 'Community compensation completed',
      txHash: effectiveTxHash,
      result
    });
  } catch (error) {
    console.error('Error compensating community transaction:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
