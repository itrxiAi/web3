import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ErrorCode } from '@/lib/errors';

/**
 * Get user points
 */
export async function POST(req: NextRequest) {
  try {
    // Get wallet address from query params
    const { walletAddress, isDirect, nodeType } = await req.json();

    const lowerCaseAddress = walletAddress.toLowerCase()

    if (!lowerCaseAddress) {
      return NextResponse.json(
        { error: ErrorCode.MISSING_WALLET_ADDRESS },
        { status: 400 }
      );
    }

    // Get user info and balance
    let count = 0
    if (isDirect) {
      let whereCondition: any = {
        superior: lowerCaseAddress,
        // Exclude the user themselves
      };

      // Add nodeType condition if provided
      if (nodeType) {
        whereCondition.type = nodeType;
      }
      count = await prisma.user.count({
        where: whereCondition
      });
    } else {
      const user = await prisma.user.findUnique({
        where: {
          walletAddress: lowerCaseAddress
        },
        select: {
          path: true
        }
      })
      if (!user || !user.path) {
        console.log(`user not found: ${lowerCaseAddress}`)
        return NextResponse.json(
          { error: ErrorCode.SERVER_ERROR },
          { status: 500 }
        );
      }
      // Build the where condition
      let whereCondition: any = {
        path: {
          startsWith: user.path
        },
        // Exclude the user themselves
        address: {
          not: lowerCaseAddress
        }
      };

      // Add nodeType condition if provided
      if (nodeType) {
        whereCondition.type = nodeType;
      }

      count = await prisma.user.count({
        where: whereCondition
      });
    }

    return NextResponse.json({
      count
    });
  } catch (error) {
    console.error('Error getting points:', error);
    return NextResponse.json(
      { error: ErrorCode.SERVER_ERROR },
      { status: 500 }
    );
  }
}
