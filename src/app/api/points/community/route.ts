import { NextRequest, NextResponse } from 'next/server';
import { MAX_TIMESTAMP_GAP_MS } from '@/constants';
import prisma from '@/lib/prisma';
import {
  verifyBatchActivationTransfer,
  verifyShieldTransfer,
  type ActivationTransferItem,
} from '@/utils/chain';
import { getHotWalletAddress } from '@/lib/config';
import { TxFlowType, TxFlowStatus, TokenType } from '@prisma/client';
import { ErrorCode } from '@/lib/errors';
import { operationControl } from '@/utils/auth';
import { getTokenAddress } from '@/lib/tokens';
import decimal from 'decimal.js';

interface NodePurchaseDescription {
  kind: string;
  dev_type: string;
  amountUsdt: string;
  batchTransferContract: string;
  shieldList: { recipient: string; amount: string; token: string }[];
  shieldTotal: { token: string; amount: string }[];
  railgunProxyContract: string;
  shieldType?: 'railgun' | 'disperse';
  expectedShieldCalldata?: string;
}

/**
 * 确认节点认购（VIP/SVIP）付款。
 *
 * 与激活(equity)流程对齐：
 * - 前端带 { quoteId, shieldTxHash } 回调本接口
 * - 读取 PENDING 交易的 description，按 shieldType 分别校验：
 *   - railgun：校验 RAILGUN shield 交易（0zk 私密地址）
 *   - disperse：校验 Disperse 批量转账（0x 公开地址）
 * - 校验通过后更新交易状态 + 通知 app/backend 设置 nodeType
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quoteId, shieldTxHash } = body as {
      quoteId?: string;
      shieldTxHash?: string;
    };

    if (!quoteId || typeof quoteId !== 'string') {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    if (!shieldTxHash || typeof shieldTxHash !== 'string') {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    // 防重放
    const operationKey = `${shieldTxHash}:buynode`;
    if (operationControl.has(operationKey)) {
      return NextResponse.json({ error: ErrorCode.DUPLICATED_OPERATION }, { status: 400 });
    }
    operationControl.set(operationKey, true, MAX_TIMESTAMP_GAP_MS);

    // 1. 读取报价交易（PENDING + PURCHASE）
    const quoteTx = await prisma.transaction.findUnique({ where: { id: quoteId } });
    if (!quoteTx || quoteTx.type !== TxFlowType.PURCHASE || quoteTx.status !== TxFlowStatus.PENDING) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    let desc: NodePurchaseDescription;
    try {
      desc = JSON.parse(quoteTx.description || '{}') as NodePurchaseDescription;
    } catch {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    if (desc.kind !== 'node_purchase' || !Array.isArray(desc.shieldList) || !desc.shieldList.length) {
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }
    const shieldType = desc.shieldType ?? 'railgun';
    if (shieldType === 'railgun' && !desc.expectedShieldCalldata) {
      console.log('Missing expectedShieldCalldata; shield route not called before confirm');
      return NextResponse.json({ error: ErrorCode.INVALID_TRANSACTION }, { status: 400 });
    }

    const walletAddress = quoteTx.fromAddress.toLowerCase();
    const type = desc.dev_type;

    // 1.5 先把 txHash 落库（不管后续校验成不成功），便于定时任务补偿 PENDING 交易
    try {
      await prisma.transaction.update({
        where: { id: quoteTx.id },
        data: { txHash: shieldTxHash },
      });
    } catch (error) {
      console.error('Failed to persist shieldTxHash:', error);
    }

    // 2. 链上校验
    if (shieldType === 'disperse') {
      // 0x 公开地址：Disperse 批量转账校验
      const shieldItems: ActivationTransferItem[] = desc.shieldList.map((it) => ({
        address: it.recipient,
        amount: it.amount,
        token: it.token,
      }));
      const tokenAddress = getTokenAddress(desc.shieldList[0]?.token ?? 'USDT');
      const shieldResult = await verifyBatchActivationTransfer(
        shieldTxHash,
        shieldItems,
        desc.batchTransferContract,
        tokenAddress,
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
      // 0zk 私密地址：校验 RAILGUN shield 交易
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

    // 3. 售罄检查 + 重复购买检查
    const appBackendUrl = process.env.APP_BACKEND_URL;
    const internalApiKey = process.env.INTERNAL_API_KEY;

    // verifier 节点写死售罄
    if (type === 'VERIFIER1' || type === 'VERIFIER2') {
      return NextResponse.json(
        { error: `${type} nodes are sold out` },
        { status: 400 }
      );
    }

    if (appBackendUrl) {
      // 检查用户是否已有节点
      const detailRes = await fetch(`${appBackendUrl}/internal/users/${walletAddress}/detail`);
      if (detailRes.ok) {
        const detail = await detailRes.json();
        const detailData = detail.data ?? detail;
        if (detailData.user?.nodeType && detailData.user.nodeType !== 'NORMAL') {
          return NextResponse.json(
            { error: 'User already has a node' },
            { status: 400 }
          );
        }
      }
    }

    // 4. 落库：更新报价交易为 CONFIRMED（txHash 已在 1.5 步写入）
    try {
      await prisma.transaction.update({
        where: { id: quoteTx.id },
        data: { status: TxFlowStatus.CONFIRMED },
      });
    } catch (error) {
      console.error('Transaction update failed:', error);
      return NextResponse.json({ error: ErrorCode.TRANSACTION_FAILED }, { status: 500 });
    }

    // 5. 通知 app/backend 更新 nodeType
    if (appBackendUrl && internalApiKey) {
      const nodeTypeMap: Record<string, string> = {
        VERIFIER1: 'VERIFIER1',
        VERIFIER2: 'VERIFIER2',
      };
      const nodeType = nodeTypeMap[type];
      if (nodeType) {
        try {
          await fetch(`${appBackendUrl}/internal/users/node-type`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-key': internalApiKey,
            },
            body: JSON.stringify({ address: walletAddress, nodeType }),
          });
        } catch (e) {
          console.error('Failed to set nodeType on backend:', e);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error confirming node purchase:', error);
    return NextResponse.json({ error: ErrorCode.TRANSACTION_FAILED }, { status: 500 });
  }
}
