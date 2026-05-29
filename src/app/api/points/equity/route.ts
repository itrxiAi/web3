import { NextRequest, NextResponse } from 'next/server';
import { DEV_ENV, MAX_TIMESTAMP_GAP_MS } from '@/constants';
import prisma from '@/lib/prisma';
import { updateUserEquity } from '@/lib/user';
import { verifyTokenTransfer } from '@/utils/chain';
import { getEnvironment } from '@/lib/config';
import { EquityType } from '@prisma/client';
import { ErrorCode } from '@/lib/errors';
import { operationControl } from '@/utils/auth';

// Equity 类型到 App Package 的映射
const EQUITY_TO_PACKAGE: Record<EquityType, string> = {
  BASE: 'P100',
  PLUS: 'P500',
  PREMIUM: 'P1000',
  EXPERT: 'P5000',
  VIP: 'P10000',
};

// 调用 app 后端 internal 激活接口
async function notifyAppBackend(params: {
  address: string;
  equityType: EquityType;
  amount: number;
  txHash: string;
  activatedAt: Date;
}) {
  const appBackendUrl = process.env.APP_BACKEND_URL;
  const internalApiKey = process.env.INTERNAL_API_KEY;

  if (!appBackendUrl || !internalApiKey) {
    console.warn('APP_BACKEND_URL or INTERNAL_API_KEY not configured, skipping app backend notification');
    return;
  }

  try {
    const response = await fetch(`${appBackendUrl}/internal/activations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': internalApiKey,
      },
      body: JSON.stringify({
        address: params.address,
        package: EQUITY_TO_PACKAGE[params.equityType],
        amountUsdt: params.amount.toString(),
        activatedAt: params.activatedAt.toISOString(),
        txHash: params.txHash,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      
      // 用户不存在是正常情况（用户还未在 app 中登录），只记录日志
      if (response.status === 404 && error.code === 'USER_NOT_FOUND') {
        console.log(`User ${params.address} not found in app backend, skipping activation notification`);
        return;
      }
      
      // 其他错误才需要记录
      console.error('Failed to notify app backend:', error);
      throw new Error(`App backend returned ${response.status}: ${JSON.stringify(error)}`);
    }

    console.log('Successfully notified app backend for activation:', params.address);
  } catch (error) {
    console.error('Error notifying app backend:', error);
    // 不抛出错误，避免影响主流程
  }
}


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

    let updateResult;
    try {
        updateResult = await updateUserEquity({
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

    // 调用 app 后端 internal 激活接口
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: { equityActivedAt: true }
    });

    // 获取交易记录中的金额
    const transaction = await prisma.transaction.findUnique({
      where: { id: updateResult.txId },
      select: { amount: true }
    });

    await notifyAppBackend({
      address: walletAddress,
      equityType: type as EquityType,
      amount: transaction?.amount.toNumber() || 0,
      txHash,
      activatedAt: user?.equityActivedAt || new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding points:', error);
    return NextResponse.json(
      { error: ErrorCode.TRANSACTION_FAILED },
      { status: 500 }
    );
  }
}
