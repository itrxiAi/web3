import { NextRequest, NextResponse } from 'next/server';
import { DEV_ENV, MAX_TIMESTAMP_GAP_MS } from '@/constants';
import prisma from '@/lib/prisma';
import { verifyBatchActivationTransfer, type ActivationTransferItem } from '@/utils/chain';
import { getEnvironment } from '@/lib/config';
import { EquityType, TxFlowStatus, TxFlowType } from '@prisma/client';
import { ErrorCode } from '@/lib/errors';
import { operationControl } from '@/utils/auth';
import { notifyActivation } from '@/lib/activation-quote';

interface ActivationSplitDescription {
  kind: string;
  package: string;
  dev_type: EquityType;
  amountUsdt: string;
  batchTransferContract: string;
  transferList: ActivationTransferItem[];
}

/**
 * 确认激活付款（链上 Disperse 批量转账）。
 *
 * 流程：前端用 quoteId（PENDING 交易）发起一笔批量转账后，带 { quoteId, txHash } 回调本接口。
 * 本接口读取该交易 description 中保存的 transferList（金额校验依据），核验链上交易，
 * 通过后落库并通知 app/backend 记录激活。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quoteId, txHash } = body as { quoteId?: string; txHash?: string };

    if (!quoteId || typeof quoteId !== 'string') {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    if (!txHash || typeof txHash !== 'string') {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    const isDev = getEnvironment() === DEV_ENV;

    // 防重放：同一 txHash 不可重复处理
    const operationKey = `${txHash}:buyequity`;
    if (operationControl.has(operationKey)) {
      return NextResponse.json({ error: ErrorCode.DUPLICATED_OPERATION }, { status: 400 });
    }
    operationControl.set(operationKey, true, MAX_TIMESTAMP_GAP_MS);

    // 1. 读取报价交易（PENDING + EQUITY），取出 transferList
    const quoteTx = await prisma.transaction.findUnique({ where: { id: quoteId } });
    if (!quoteTx || quoteTx.type !== TxFlowType.EQUITY || quoteTx.status !== TxFlowStatus.PENDING) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    let desc: ActivationSplitDescription;
    try {
      desc = JSON.parse(quoteTx.description || '{}') as ActivationSplitDescription;
    } catch {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    if (desc.kind !== 'activation_split' || !Array.isArray(desc.transferList) || !desc.batchTransferContract) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    const walletAddress = quoteTx.fromAddress.toLowerCase();

    // 2. 链上校验（开发环境跳过）
    if (!isDev) {
      const verifyResult = await verifyBatchActivationTransfer(
        txHash,
        desc.transferList,
        desc.batchTransferContract,
      );
      if (!verifyResult.isValid) {
        console.log(`Invalid activation tx: ${verifyResult.error}, txHash: ${txHash}`);
        return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
      }
      // 付款人必须与报价用户一致
      if (verifyResult.fromAddress && verifyResult.fromAddress.toLowerCase() !== walletAddress) {
        console.log(`Payer mismatch: tx from ${verifyResult.fromAddress}, expected ${walletAddress}`);
        return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
      }
    }

    // 3. 落库：更新报价交易为 CONFIRMED + 写入 txHash；更新用户 equity
    const activatedAt = new Date();
    try {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: quoteTx.id },
          data: { txHash, status: TxFlowStatus.CONFIRMED },
        });
        await tx.user.update({
          where: { walletAddress },
          data: { equityType: desc.dev_type, equityActivedAt: activatedAt },
        });
      });
    } catch (error) {
      console.error('Activation persist failed:', error);
      return NextResponse.json({ error: ErrorCode.TRANSACTION_FAILED }, { status: 500 });
    }

    // 4. 通知 app/backend 记录激活（直推/间推奖励已在链上发放，app 端不再重复发放）
    await notifyActivation({
      address: walletAddress,
      package: desc.package,
      amountUsdt: desc.amountUsdt,
      activatedAt: activatedAt.toISOString(),
      txHash,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error confirming activation:', error);
    return NextResponse.json({ error: ErrorCode.TRANSACTION_FAILED }, { status: 500 });
  }
}
