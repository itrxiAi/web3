import { NextRequest, NextResponse } from 'next/server';
import { DEV_ENV, MAX_TIMESTAMP_GAP_MS } from '@/constants';
import prisma from '@/lib/prisma';
import { updateUserEquity } from '@/lib/user';
import { verifyTokenTransfer } from '@/utils/chain';
import { getEnvironment } from '@/lib/config';
import { EquityType } from '@prisma/client';
import { ErrorCode } from '@/lib/errors';
import { operationControl } from '@/utils/auth';


export async function POST(req: NextRequest) {

  try {
    const body = await req.json();
    const { txHash, dev_address, dev_referralCode, dev_type } = body;

    if (!txHash || typeof txHash !== 'string') {
      return NextResponse.json(
        { error: ErrorCode.INVALID_TRANSACTION },
        { status: 400 }
      );
    }

    const isDev = getEnvironment() === DEV_ENV;
    if (isDev && (!dev_address || !dev_type)) {
      return NextResponse.json(
        { error: ErrorCode.INVALID_TRANSACTION },
        { status: 400 }
      );
    }

    // Make sure the hash won't be reused
    const operationKey = `${txHash}:buyequity`;
    if (operationControl.has(operationKey)) {
      return NextResponse.json(
        { error: ErrorCode.DUPLICATED_OPERATION },
        { status: 400 }
      );
    }
    operationControl.set(operationKey, true, MAX_TIMESTAMP_GAP_MS);

    // Skip transaction verification in development mode
    let verifyResult: {
      isValid: boolean;
      error?: string;
      fromAddress?: string;
      referralCode?: string;
      type?: string;
    } = {
      isValid: true,
      fromAddress: dev_address,
      referralCode: dev_referralCode,
      type: dev_type
    };

    if (!isDev) {
      verifyResult = await verifyTokenTransfer(txHash, true);
      if (!verifyResult.isValid) {
        console.log(`Invalid transaction: ${verifyResult.error}, txHash: ${txHash}`);
        return NextResponse.json(
          { error: ErrorCode.INVALID_TRANSACTION },
          { status: 400 }
        );
      }
    }

    if (!verifyResult.fromAddress) {
      console.log(`fromAddress is empty, txHash: ${txHash}`);
      return NextResponse.json(
        { error: ErrorCode.INVALID_TRANSACTION },
        { status: 400 }
      );
    }

    if (!verifyResult.type) {
      console.log(`type is empty, txHash: ${txHash}`);
      return NextResponse.json(
        { error: ErrorCode.INVALID_TRANSACTION },
        { status: 400 }
      );
    }
    
    const fromAddress = verifyResult.fromAddress.toLowerCase();
    const type = verifyResult.type;

    // Use fromAddress as the wallet address
    const walletAddress = fromAddress;

    try {
        await updateUserEquity({
          walletAddress,
          equityType: type as EquityType,
          txHash,
          tx: prisma
        });
    } catch (error) {
      console.error('Transaction failed:', error);
      return NextResponse.json(
        { error: ErrorCode.TRANSACTION_FAILED },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding points:', error);
    return NextResponse.json(
      { error: ErrorCode.TRANSACTION_FAILED },
      { status: 500 }
    );
  }
}
