import { NextRequest, NextResponse } from 'next/server';
import { parseUnits } from 'viem';
import prisma from '@/lib/prisma';
import { TxFlowType, TxFlowStatus, TokenType } from '@prisma/client';
import { ErrorCode } from '@/lib/errors';
import {
  getBatchTransferContract,
  getNodeDisperseRecipients,
  getVerifier1,
  getVerifier2,
} from '@/lib/config';
import { getShieldSignatureMessage, getRailgunProxyContract } from '@/lib/railgun/shield';
import decimal from 'decimal.js';

const USDT_DECIMALS = 18;

type ShieldType = 'railgun' | 'disperse';

function detectShieldType(shieldList: { recipient: string }[]): ShieldType {
  if (!shieldList.length) return 'railgun';
  const first = shieldList[0].recipient.trim();
  return first.startsWith('0zk') ? 'railgun' : 'disperse';
}

function round2(n: decimal): string {
  return n.toDecimalPlaces(2, decimal.ROUND_DOWN).toFixed(2);
}

/**
 * 节点认购（VIP/SVIP）付款拆分报价。
 *
 * 与激活(equity)流程对齐：
 * - 从 Config 表读取 NODE_DISPERSE_RECIPIENTS（目标地址 + 比例）
 * - 0zk 地址 → RAILGUN shield（混币器），0x 地址 → Disperse 批量转账
 * - 仅支持单币种 USDT（与激活的多币种不同）
 * - 创建 PENDING 交易，shieldList 存入 description 供后续校验
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dev_address, dev_type, token_type } = body as { dev_address?: string; dev_type?: string; token_type?: string };

    if (!dev_address || typeof dev_address !== 'string') {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    if (!dev_type || (dev_type !== 'VERIFIER1' && dev_type !== 'VERIFIER2')) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    const tokenType: 'USDT' | 'HAKP' = token_type === 'HAKP' ? 'HAKP' : 'USDT';
    const address = dev_address.toLowerCase();

    // 1. 读取价格
    const priceBig =
      dev_type === 'VERIFIER1' ? await getVerifier1() : await getVerifier2();
    const priceDisplay = priceBig.toNumber();
    if (!Number.isFinite(priceDisplay) || priceDisplay <= 0) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    const amountUsdt = priceDisplay.toFixed(2);

    // 2. 读取目标地址列表（从 web3 数据库 Config 表）
    const recipients = await getNodeDisperseRecipients();
    if (!recipients.length) {
      return NextResponse.json(
        { error: 'NODE_DISPERSE_RECIPIENTS not configured' },
        { status: 500 }
      );
    }

    const batchTransferContract = await getBatchTransferContract();
    const railgunProxyContract = getRailgunProxyContract();

    // 3. 构造 shieldList：按比例分配金额（HAKP 与 USDT 1:1，金额不变）
    const total = new decimal(amountUsdt);
    const ratioSum = recipients.reduce((sum, r) => sum + r.ratio, 0);
    const shieldList = recipients.map((r) => ({
      recipient: r.address,
      amount: round2(total.mul(r.ratio).div(ratioSum)),
      token: tokenType,
    }));

    // 修正尾差：确保金额之和等于 total
    const sumAmounts = shieldList.reduce((acc, s) => acc.add(new decimal(s.amount)), new decimal(0));
    const drift = total.sub(sumAmounts);
    if (!drift.isZero() && shieldList.length > 0) {
      shieldList[0].amount = round2(new decimal(shieldList[0].amount).add(drift));
    }

    // 4. 按币种汇总 shieldTotal
    const shieldTotal = [{ token: tokenType, amount: amountUsdt }];

    // 5. 检测 shieldType
    const shieldType = detectShieldType(shieldList);

    // 6. 创建 PENDING 交易
    const transaction = await prisma.transaction.create({
      data: {
        fromAddress: address,
        toAddress: batchTransferContract.toLowerCase(),
        amount: priceDisplay,
        tokenType: tokenType === 'HAKP' ? TokenType.HAKP : TokenType.USDT,
        type: TxFlowType.PURCHASE,
        status: TxFlowStatus.PENDING,
        description: JSON.stringify({
          kind: 'node_purchase',
          dev_type,
          amountUsdt,
          batchTransferContract: batchTransferContract.toLowerCase(),
          shieldList,
          shieldTotal,
          railgunProxyContract: railgunProxyContract.toLowerCase(),
          shieldType,
        }),
      },
    });

    const baseResponse = {
      quoteId: transaction.id,
      batchTransferContract: batchTransferContract.toLowerCase(),
      shieldTotal,
      amountUsdt,
      shieldType,
    };

    if (shieldType === 'disperse') {
      // 0x 公开地址：直接下发 shieldList 作为 Disperse 转账列表
      return NextResponse.json({
        ...baseResponse,
        shieldList,
      });
    }

    // 0zk 私密地址：不下发地址，仅返回签名消息与代理合约
    return NextResponse.json({
      ...baseResponse,
      shieldSignatureMessage: getShieldSignatureMessage(),
      railgunProxyContract: railgunProxyContract.toLowerCase(),
    });
  } catch (error) {
    console.error('Error building node purchase quote:', error);
    return NextResponse.json({ error: ErrorCode.TRANSACTION_FAILED }, { status: 500 });
  }
}
