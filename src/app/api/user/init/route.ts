import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { randomReferralCode } from '@/utils/auth';
import { updateUserPath } from '@/lib/user';
export async function POST(request: Request) {

    const body = await request.json();
    const { address, referralCode } = body;

    const exist = await prisma.user.findUnique({
        where: { walletAddress: address.toLowerCase() },
        select: { walletAddress: true, type: true}
    });

    if (exist) {
        return NextResponse.json({
            exist: true,
            data: exist
        })
    }

    let superior: { walletAddress: string, path: string | null } | null = null;
    if (referralCode) {
        superior = await prisma.user.findUnique({
            where: { referralCode: referralCode },
            select: { walletAddress: true, path: true}
        });
    }


    try {
        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    walletAddress: address.toLowerCase(),
                    superior: superior?.walletAddress || null,
                    referralCode: randomReferralCode(address.toLowerCase()),
                    //last_activity: new Date(),
                }
            });

            await updateUserPath(user.id, superior?.path || null, tx);
        });
    } catch (e) {
        console.error('user init transaction failed:', e);
        return NextResponse.json(
            { error: 'USER_INIT_FAILED' },
            { status: 500 }
        );
    }

    return NextResponse.json({
        exist: true,
        data: {
            address: address.toLowerCase(),
        }
    })
}