import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateBearerToken } from '@/utils/auth';
import { UserType } from '@prisma/client';

export async function POST(req: NextRequest) {

  try {
    const { walletAddress, type } = await req.json();

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    const normalizedAddress = walletAddress.toLowerCase();

    if (type !== 'COMMUNITY' && type !== null) {
      return NextResponse.json(
        { error: 'type must be COMMUNITY or null' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
      select: { id: true, walletAddress: true, type: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const nextType = type === 'COMMUNITY' ? UserType.COMMUNITY : null;

    const updated = await prisma.user.update({
      where: { walletAddress: normalizedAddress },
      data: { type: nextType },
      select: {
        id: true,
        walletAddress: true,
        type: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      status: 'success',
      user: updated
    });
  } catch (error) {
    console.error('Error updating community type:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
