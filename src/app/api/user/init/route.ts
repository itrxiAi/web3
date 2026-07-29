import { NextResponse } from 'next/server'
import { randomReferralCode } from '@/utils/auth';

export async function POST(request: Request) {

    const body = await request.json();
    const { address, referralCode } = body;

    const lowerCaseAddress = address.toLowerCase();
    const shortCode = randomReferralCode(lowerCaseAddress);

    const appBackendUrl = process.env.APP_BACKEND_URL;
    const internalApiKey = process.env.INTERNAL_API_KEY;

    if (!appBackendUrl || !internalApiKey) {
        return NextResponse.json(
            { error: 'BACKEND_NOT_CONFIGURED' },
            { status: 500 }
        );
    }

    try {
        const response = await fetch(`${appBackendUrl}/internal/sync/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-key': internalApiKey,
            },
            body: JSON.stringify({
                address: lowerCaseAddress,
                shortCode,
                inviterAddress: referralCode || null,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error('sync/user failed:', response.status, err);
            return NextResponse.json(
                { error: 'USER_INIT_FAILED' },
                { status: 500 }
            );
        }

        const data = await response.json();
        return NextResponse.json({
            exist: true,
            data: {
                address: lowerCaseAddress,
                shortCode,
            }
        });
    } catch (e) {
        console.error('user init failed:', e);
        return NextResponse.json(
            { error: 'USER_INIT_FAILED' },
            { status: 500 }
        );
    }
}