import { NextRequest, NextResponse } from 'next/server';
import { DEV_ENV, MAX_TIMESTAMP_GAP_MS } from '@/constants';
import prisma from '@/lib/prisma';
import {
  verifyBatchActivationTransfer,
  verifyShieldTransfer,
  type ActivationTransferItem,
} from '@/utils/chain';
import { getEnvironment } from '@/lib/config';
import { EquityType, TxFlowStatus, TxFlowType } from '@prisma/client';
import { ErrorCode } from '@/lib/errors';
import { operationControl } from '@/utils/auth';
import { notifyActivation } from '@/lib/activation-quote';
import { getTokenAddress } from '@/lib/tokens';

interface ActivationSplitDescription {
  kind: string;
  package: string;
  dev_type: EquityType;
  amountUsdt: string;
  batchTransferContract: string;
  referralList: ActivationTransferItem[];
  shieldList: { recipient: string; amount: string; token: string }[];
  shieldTotal: { token: string; amount: string }[];
  railgunProxyContract: string;
  /** 系统份额转账类型：railgun（混币器）或 disperse（批量转账）。 */
  shieldType?: 'railgun' | 'disperse';
  /** 服务端在 /shield 构造交易时存档的 calldata（含我方 0zk 接收地址），用于强校验收款人。 */
  expectedShieldCalldata?: string;
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
    const { quoteId, referralTxHash, shieldTxHash } = body as {
      quoteId?: string;
      referralTxHash?: string | null;
      shieldTxHash?: string;
    };

    if (!quoteId || typeof quoteId !== 'string') {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    // 系统份额 shield 交易是必须的；推荐奖励 Disperse 交易仅在存在上级时才有。
    if (!shieldTxHash || typeof shieldTxHash !== 'string') {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    const isDev = getEnvironment() === DEV_ENV;

    // 防重放：同一 shield txHash 不可重复处理
    const operationKey = `${shieldTxHash}:buyequity`;
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
    if (
      desc.kind !== 'activation_split' ||
      !Array.isArray(desc.referralList) ||
      !Array.isArray(desc.shieldList) ||
      !desc.railgunProxyContract
    ) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    const shieldType = desc.shieldType ?? 'railgun';
    // railgun 模式：shield calldata 必须已由 /shield 接口生成并存档（否则无法校验收款人，拒绝）
    if (shieldType === 'railgun' && !desc.expectedShieldCalldata) {
      console.log('Missing expectedShieldCalldata; shield route not called before confirm');
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    const walletAddress = quoteTx.fromAddress.toLowerCase();

    // 2. 链上校验（开发环境跳过）
    if (!isDev) {
      // 2a. 推荐奖励 Disperse（仅当存在上级、referralList 非空时需要）
      if (desc.referralList.length > 0) {
        if (!referralTxHash || typeof referralTxHash !== 'string') {
          return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
        }
        const referralResult = await verifyBatchActivationTransfer(
          referralTxHash,
          desc.referralList,
          desc.batchTransferContract,
        );
        if (!referralResult.isValid) {
          console.log(`Invalid referral tx: ${referralResult.error}, txHash: ${referralTxHash}`);
          return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
        }
        if (referralResult.fromAddress && referralResult.fromAddress.toLowerCase() !== walletAddress) {
          console.log(`Referral payer mismatch: ${referralResult.fromAddress}, expected ${walletAddress}`);
          return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
        }
      }

      // 2b. 系统份额：按 shieldType 分别校验

      if (shieldType === 'disperse') {
        // 0x 公开地址：DualDisperse 多币种批量转账校验
        const shieldItems: ActivationTransferItem[] = desc.shieldList.map((it) => ({
          address: it.recipient,
          amount: it.amount,
          token: it.token,
        }));
        const shieldResult = await verifyBatchActivationTransfer(
          shieldTxHash,
          shieldItems,
          desc.batchTransferContract,
        );
        if (!shieldResult.isValid) {
          console.log(`Invalid disperse shield tx: ${shieldResult.error}, txHash: ${shieldTxHash}`);
          return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
        }
        if (shieldResult.fromAddress && shieldResult.fromAddress.toLowerCase() !== walletAddress) {
          console.log(`Shield payer mismatch: ${shieldResult.fromAddress}, expected ${walletAddress}`);
          return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
        }
      } else {
        // 0zk 私密地址：校验 RAILGUN shield 交易（多币种）
        const expectedTokens = (desc.shieldTotal ?? []).map((st) => ({
          tokenAddress: getTokenAddress(st.token),
          amount: st.amount,
        }));
        const shieldResult = await verifyShieldTransfer(
          shieldTxHash,
          desc.railgunProxyContract,
          expectedTokens,
          desc.expectedShieldCalldata!,
        );
        if (!shieldResult.isValid) {
          console.log(`Invalid shield tx: ${shieldResult.error}, txHash: ${shieldTxHash}`);
          return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
        }
        if (shieldResult.fromAddress && shieldResult.fromAddress.toLowerCase() !== walletAddress) {
          console.log(`Shield payer mismatch: ${shieldResult.fromAddress}, expected ${walletAddress}`);
          return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
        }
      }
    }

    // 3. 落库：更新报价交易为 CONFIRMED + 写入 txHash；更新用户 equity
    const activatedAt = new Date();
    try {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: quoteTx.id },
          data: { txHash: shieldTxHash, status: TxFlowStatus.CONFIRMED },
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

    // 4. 通知 app/backend 记录激活（直推/间推奖励由 app 端在激活回调中按链下账本发放）
    await notifyActivation({
      address: walletAddress,
      package: desc.package,
      amountUsdt: desc.amountUsdt,
      activatedAt: activatedAt.toISOString(),
      txHash: shieldTxHash,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error confirming activation:', error);
    return NextResponse.json({ error: ErrorCode.TRANSACTION_FAILED }, { status: 500 });
  }
}
