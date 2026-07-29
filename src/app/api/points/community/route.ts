import { NextRequest, NextResponse } from 'next/server';
import { MAX_TIMESTAMP_GAP_MS, MembershipType } from '@/constants';
import prisma from '@/lib/prisma';
import { updateUserType } from '@/lib/user';
import { verifyTokenTransfer, verifyBatchActivationTransfer, type ActivationTransferItem } from '@/utils/chain';
import { getBatchTransferContract, getNodeDisperseRecipients, getVerifier1, getVerifier2 } from '@/lib/config';
import { UserType, TokenType } from '@prisma/client';
import { ErrorCode } from '@/lib/errors';
import { operationControl } from '@/utils/auth';
import decimal from 'decimal.js';


export async function POST(req: NextRequest) {

  try {
    const body = await req.json();
    const { txHash, dev_address, dev_referralCode, dev_type, dev_tokenType } = body;

    if (!txHash) {
      return NextResponse.json(
        { error: ErrorCode.INVALID_TRANSACTION },
        { status: 400 }
      );
    }

    // Make sure the hash won't be reused
    const operationKey = `${txHash}:buynode`;
    if (operationControl.has(operationKey)) {
      return NextResponse.json(
        { error: ErrorCode.DUPLICATED_OPERATION },
        { status: 400 }
      );
    }
    operationControl.set(operationKey, true, MAX_TIMESTAMP_GAP_MS);

    // Verify transaction on-chain
    let verifyResult: {
      isValid: boolean;
      error?: string;
      fromAddress?: string;
      referralCode?: string;
      type?: string;
    };

    // 检查是否配置了批量转账接收列表
    const disperseRecipients = await getNodeDisperseRecipients();
    const batchContract = await getBatchTransferContract();

    if (disperseRecipients.length > 0) {
      // 批量转账模式：根据价格和比例构造期望转账列表
      const priceMap: Record<string, number> = {
        VERIFIER1: Number((await getVerifier1()).toString()),
        VERIFIER2: Number((await getVerifier2()).toString()),
      };
      const price = priceMap[dev_type];
      if (!price) {
        return NextResponse.json(
          { error: ErrorCode.INVALID_TRANSACTION },
          { status: 400 }
        );
      }

      const expectedList: ActivationTransferItem[] = disperseRecipients.map(r => ({
        address: r.address.toLowerCase(),
        amount: new decimal(price).mul(r.ratio).toDecimalPlaces(2, decimal.ROUND_DOWN).toFixed(2),
      }));

      const tokenAddress = dev_tokenType === 'HAKP'
        ? process.env.NEXT_PUBLIC_HAKP_ADDRESS
        : process.env.NEXT_PUBLIC_USDT_ADDRESS;
      const batchResult = await verifyBatchActivationTransfer(txHash, expectedList, batchContract, tokenAddress);
      if (!batchResult.isValid) {
        console.log(`Invalid batch transaction: ${batchResult.error}, txHash: ${txHash}`);
        return NextResponse.json(
          { error: ErrorCode.INVALID_TRANSACTION },
          { status: 400 }
        );
      }
      verifyResult = {
        isValid: true,
        fromAddress: batchResult.fromAddress,
        referralCode: dev_referralCode,
        type: dev_type,
      };
    } else {
      // 回退到单笔转账校验
      verifyResult = await verifyTokenTransfer(txHash);
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
        await updateUserType({
          walletAddress,
          type: type as MembershipType,
          txHash,
          tx: prisma,
          tokenType: (dev_tokenType === 'HAKP' ? TokenType.HAKP : TokenType.USDT) as TokenType,
        });
    } catch (error) {
      console.error('Transaction failed:', error);
      return NextResponse.json(
        { error: ErrorCode.TRANSACTION_FAILED },
        { status: 500 }
      );
    }

    // 通知 app/backend 更新 nodeType
    const appBackendUrl = process.env.APP_BACKEND_URL;
    const internalApiKey = process.env.INTERNAL_API_KEY;
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
    console.error('Error adding points:', error);
    return NextResponse.json(
      { error: ErrorCode.TRANSACTION_FAILED },
      { status: 500 }
    );
  }
}
