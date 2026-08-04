import { NextRequest, NextResponse } from 'next/server';
import { parseUnits } from 'viem';
import prisma from '@/lib/prisma';
import { TxFlowType, TxFlowStatus } from '@prisma/client';
import { ErrorCode } from '@/lib/errors';
import { buildShieldTransaction, type ShieldRecipientWei } from '@/lib/railgun/shield';
import { getTokenAddress } from '@/lib/tokens';

const USDT_DECIMALS = 18;

interface ActivationSplitDescription {
  kind: string;
  shieldList?: { recipient: string; amount: string; token: string }[];
  shieldTotal?: { token: string; amount: string }[];
  shieldType?: 'railgun' | 'disperse';
}

/**
 * 构造系统份额的 RAILGUN shield 交易 calldata（服务端）。
 *
 * 0zk 接收地址只在服务端、绝不下发浏览器。前端流程：
 *   1) 调 /quote 拿到 shieldSignatureMessage；
 *   2) 用 MetaMask 对该消息签名；
 *   3) 带 { quoteId, signature } 调本接口，拿到 { to, data, proxyContract, totalWei }；
 *   4) approve USDT 给 proxyContract，再用 MetaMask 广播该 shield 交易。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quoteId, signature } = body as { quoteId?: string; signature?: string };

    if (!quoteId || typeof quoteId !== 'string') {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    const quoteTx = await prisma.transaction.findUnique({ where: { id: quoteId } });
    if (!quoteTx || quoteTx.status !== TxFlowStatus.PENDING) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    // 同时支持激活(EQUITY)和节点认购(PURCHASE)
    if (quoteTx.type !== TxFlowType.EQUITY && quoteTx.type !== TxFlowType.PURCHASE) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    let desc: ActivationSplitDescription;
    try {
      desc = JSON.parse(quoteTx.description || '{}') as ActivationSplitDescription;
    } catch {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    if ((desc.kind !== 'activation_split' && desc.kind !== 'node_purchase') || !Array.isArray(desc.shieldList) || !desc.shieldList.length) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    // disperse 模式不需要构造 RAILGUN shield calldata，直接拒绝
    if (desc.shieldType === 'disperse') {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    const recipients: ShieldRecipientWei[] = desc.shieldList.map((it) => ({
      recipient: it.recipient,
      amountWei: parseUnits(it.amount, USDT_DECIMALS),
      tokenAddress: getTokenAddress(it.token),
    }));

    const { to, data, proxyContract, tokens } = await buildShieldTransaction({
      signature,
      recipients,
    });

    // 关键：持久化服务端生成的 shield calldata（含我方 0zk 接收地址）。
    // 确认接口将据此逐字节比对链上 tx.input，确保资金确实进入我方私密地址，
    // 防止用户改用自己的 0zk 地址自建等额 shield 骗过校验。
    await prisma.transaction.update({
      where: { id: quoteTx.id },
      data: {
        description: JSON.stringify({
          ...desc,
          expectedShieldCalldata: (data as string).toLowerCase(),
          shieldTo: (to as string).toLowerCase(),
        }),
      },
    });

    return NextResponse.json({
      to,
      data,
      proxyContract,
      tokens: tokens.map((t) => ({ token: t.token, totalWei: t.totalWei.toString() })),
    });
  } catch (error) {
    console.error('Error building shield transaction:', error);
    return NextResponse.json({ error: ErrorCode.TRANSACTION_FAILED }, { status: 500 });
  }
}
