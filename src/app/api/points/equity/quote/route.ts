import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { EquityType, TokenType, TxFlowType, TxFlowStatus } from '@prisma/client';
import { ErrorCode } from '@/lib/errors';
import { getBatchTransferContract } from '@/lib/config';
import {
  EQUITY_TO_PACKAGE,
  getEquityDisplayPrice,
  fetchActivationQuote,
} from '@/lib/activation-quote';
import { getShieldSignatureMessage, getRailgunProxyContract } from '@/lib/railgun/shield';

function isEquityType(s: string): s is EquityType {
  return Object.prototype.hasOwnProperty.call(EQUITY_TO_PACKAGE, s);
}

type ShieldType = 'railgun' | 'disperse';

function detectShieldType(shieldList: { recipient: string }[]): ShieldType {
  if (!shieldList.length) return 'railgun';
  const first = shieldList[0].recipient.trim();
  return first.startsWith('0zk') ? 'railgun' : 'disperse';
}

/**
 * 激活付款拆分报价。
 *
 * 流程：web3 端点击激活 -> 调用本接口 -> app/backend 拼接目标地址与金额(transferList)
 * -> 本接口创建 PENDING 交易并把 transferList 存入 description（用于后续金额校验）
 * -> 返回给前端发起一笔 Disperse 批量转账。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dev_address, dev_type } = body as { dev_address?: string; dev_type?: string };

    if (!dev_address || typeof dev_address !== 'string') {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    if (!dev_type || !isEquityType(dev_type)) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    const address = dev_address.toLowerCase();
    const equityType = dev_type as EquityType;
    const pkg = EQUITY_TO_PACKAGE[equityType];
    if (!pkg) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    const priceDisplay = await getEquityDisplayPrice(equityType);
    if (!Number.isFinite(priceDisplay) || priceDisplay <= 0) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    const amountUsdt = priceDisplay.toFixed(2);

    // 1. 由 app/backend 拼接转账列表（直推/间推/系统钱包）
    let quote;
    try {
      quote = await fetchActivationQuote({ address, package: pkg, amountUsdt });
    } catch (e) {
      console.error('fetchActivationQuote failed:', e);
      return NextResponse.json({ error: ErrorCode.TRANSACTION_FAILED }, { status: 500 });
    }

    const batchTransferContract = quote.batchTransferContract || (await getBatchTransferContract());

    // 检测 shieldList 地址类型：0zk → RAILGUN shield，0x → Disperse 批量转账
    const shieldType = detectShieldType(quote.shieldList);
    const railgunProxyContract = getRailgunProxyContract();

    // 2. 创建 PENDING 交易；referralList(0x) 与 shieldList 均保存到 description
    //    （referralList 用于 Disperse 金额校验；shieldList 用于服务端构造 shield calldata 与校验）。
    const transaction = await prisma.transaction.create({
      data: {
        fromAddress: address,
        toAddress: batchTransferContract.toLowerCase(),
        amount: priceDisplay,
        tokenType: TokenType.USDT,
        type: TxFlowType.EQUITY,
        status: TxFlowStatus.PENDING,
        description: JSON.stringify({
          kind: 'activation_split',
          package: pkg,
          dev_type: equityType,
          amountUsdt: amountUsdt,
          batchTransferContract: batchTransferContract.toLowerCase(),
          referralList: quote.referralList,
          shieldList: quote.shieldList,
          shieldTotal: quote.shieldTotal,
          railgunProxyContract: railgunProxyContract.toLowerCase(),
          shieldType,
        }),
      },
    });

    const baseResponse = {
      quoteId: transaction.id,
      // 推荐奖励：0x Disperse（当前恒为空）
      referralList: quote.referralList,
      batchTransferContract: batchTransferContract.toLowerCase(),
      shieldTotal: quote.shieldTotal,
      amountUsdt,
      shieldType,
    };

    if (shieldType === 'disperse') {
      // 0x 公开地址：直接下发 shieldList 作为 Disperse 转账列表
      return NextResponse.json({
        ...baseResponse,
        shieldList: quote.shieldList,
      });
    }

    // 0zk 私密地址：不下发地址，仅返回签名消息与代理合约
    return NextResponse.json({
      ...baseResponse,
      shieldSignatureMessage: getShieldSignatureMessage(),
      railgunProxyContract: railgunProxyContract.toLowerCase(),
    });
  } catch (error) {
    console.error('Error building activation quote:', error);
    return NextResponse.json({ error: ErrorCode.TRANSACTION_FAILED }, { status: 500 });
  }
}
