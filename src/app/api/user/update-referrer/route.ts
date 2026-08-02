import { NextResponse } from 'next/server'
import { generateOperationHash, verifySignature } from '@/utils/auth';
import { MAX_TIMESTAMP_GAP_MS, UPDATE_REFERRAL } from '@/constants';
import { operationControl } from '@/utils/auth';
import { ErrorCode } from '@/lib/errors';

/**
 * 绑定上级：web3 前端签名校验通过后，转发到 app backend 的
 * POST /internal/users/:address/inviter（InternalKeyGuard 鉴权）。
 * 不再读写 web3 自有数据库。
 */
export async function POST(request: Request) {

    const body = await request.json();
    const { walletAddress, referralCode, operationType, timestamp, signature } = body;
    const lowerCaseAddress = walletAddress.toLowerCase()
    const hash = await generateOperationHash({
        operationType: UPDATE_REFERRAL,
        amount: 0,
        walletAddress,
        description: referralCode,
        timestamp
    });

    // Make sure the hash won't be reused
    const operationKey = `${lowerCaseAddress}:${operationType}`;
    if (operationControl.has(operationKey)) {
        return NextResponse.json(
            { error: ErrorCode.DUPLICATED_OPERATION },
            { status: 400 }
        );
    }
    operationControl.set(operationKey, true, MAX_TIMESTAMP_GAP_MS);

    const isValid = await verifySignature(walletAddress, signature, hash);
    if (!isValid) {
        return NextResponse.json(
            { error: ErrorCode.INVALID_SIGNATURE },
            { status: 401 }
        );
    }

    const appBackendUrl = process.env.APP_BACKEND_URL;
    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!appBackendUrl || !internalApiKey) {
        return NextResponse.json(
            { error: 'BACKEND_NOT_CONFIGURED' },
            { status: 500 }
        );
    }

    console.log(`update referral for ${lowerCaseAddress} with code ${referralCode}`)

    try {
        const response = await fetch(`${appBackendUrl}/internal/users/${lowerCaseAddress}/inviter`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-key': internalApiKey,
            },
            body: JSON.stringify({ code: referralCode }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error('bind inviter failed:', response.status, err);
            // 透传后端错误码（INVITER_ALREADY_BOUND / INVITER_NOT_FOUND / INVITER_SELF / INVITER_IN_SUBTREE ...）
            return NextResponse.json(
                { error: err.code || ErrorCode.OPERATION_FAILED },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json({ data: true, ...data });
    } catch (e) {
        console.error('update-referrer failed:', e);
        return NextResponse.json(
            { error: ErrorCode.OPERATION_FAILED },
            { status: 500 }
        );
    }
}
