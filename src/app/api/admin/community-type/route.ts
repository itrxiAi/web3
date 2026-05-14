import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateBearerToken } from '@/utils/auth';
import { UserType } from '@prisma/client';

export async function POST(req: NextRequest) {

  try {
    const { walletAddress, points, cards } = await req.json();

    return NextResponse.json(
        { error: 'not available' },
        { status: 400 }
      );

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    if (typeof points !== 'number' || typeof cards !== 'number') {
      return NextResponse.json(
        { error: 'points and cards must be numbers' },
        { status: 400 }
      );
    }

    const normalizedAddress = walletAddress.toLowerCase();

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

    // Derive userType: non-zero points/cards => COMMUNITY, else null
    const nextType = (points !== 0 || cards !== 0) ? UserType.COMMUNITY : null;

    const now = new Date();
    const updated = await prisma.user.update({
      where: { walletAddress: normalizedAddress },
      data: {
        type: nextType,
        points,
        cards,
        purchaseAt: nextType ? now : null,
        equityActivedAt: nextType ? now : null
      },
      select: {
        id: true,
        walletAddress: true,
        type: true,
        points: true,
        cards: true,
        purchaseAt: true,
        equityActivedAt: true,
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
