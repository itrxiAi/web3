import { NextRequest, NextResponse } from 'next/server';
//import { setBanStatus, validateBearerToken } from '@/utils/auth';
import { setGalaxy } from '@/lib/user';
import { getSpecialAddress } from '@/lib/config';

export async function GET(req: NextRequest) {

    return NextResponse.json({
        success: true,
        data: await getSpecialAddress()
    });
}
